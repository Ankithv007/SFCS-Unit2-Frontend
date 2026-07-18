import React, { useEffect, useMemo } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from './Toast';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

/** Compute whether the current user has permission for a given path. */
function checkAccess(userEmail: string, userRole: string, pathname: string): boolean {
    const normalized = pathname.replace(/\/$/, '').toLowerCase();
    
    // Explicitly block User and Operator from accessing admin-panel and its subpages
    if (userRole === 'User' || userRole === 'Operator') {
        if (normalized === '/admin-panel' || normalized.startsWith('/admin-panel/')) {
            return false;
        }
    }

    // Allow Super Admin, Admin, and Manager to access admin-panel and its subpages
    if (userRole === 'Super Admin' || userRole === 'Admin' || userRole === 'Manager') {
        if (normalized === '/admin-panel' || normalized.startsWith('/admin-panel/')) {
            return true;
        }
    }

    if (userRole === 'Super Admin' || userRole === 'Admin') return true;
    if (normalized === '/dashboard') return true;

    const storedDepartments = localStorage.getItem('departments');
    const departments: any[] = storedDepartments ? JSON.parse(storedDepartments) : [];

    const userDepts = departments.filter((dept) =>
        dept.users && dept.users.some((u: any) => u.email.toLowerCase() === userEmail.toLowerCase())
    );

    const allowedPages = new Set<string>();
    userDepts.forEach((dept) => {
        (dept.pages ?? []).forEach((p: string) => allowedPages.add(p.replace(/\/$/, '').toLowerCase()));
    });

    return Array.from(allowedPages).some((allowed) =>
        normalized === allowed || normalized.startsWith(allowed + '/')
    );
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const { isAuthenticated, isLoading, user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const { showToast } = useToast();

    // Stable key that changes only when the path changes — prevents re-firing on unrelated re-renders
    const pathKey = location.pathname;

    // Compute access synchronously (memoised per path change)
    const hasAccess = useMemo(() => {
        if (!user) return true; // defer to auth guard below
        return checkAccess(user.email, user.role, pathKey);
    }, [user, pathKey]);



    useEffect(() => {
        if (!user) return;
        if (hasAccess) return;

        showToast("⚠️ You don't have permission to access this page.", 'error');
        navigate('/dashboard', { replace: true });
    }, [hasAccess, pathKey, user, navigate, showToast]);

    // --- Guards ---
    if (isLoading) return <div>Loading...</div>;
    if (!isAuthenticated) return <Navigate to="/login" replace />;

    // Block rendering entirely while we're about to redirect — no blank page flash
    if (!hasAccess) return null;

    return <>{children}</>;
};
