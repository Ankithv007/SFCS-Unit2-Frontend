import React, { useEffect, useMemo } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from './Toast';
import { systemPagesConfig } from '../constants/systemPages';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

/** Compute whether the current user has permission for a given path. */
function checkAccess(
    userRole: string,
    pathname: string,
    userPermissions: any[]
): boolean {
    const normalized = pathname.replace(/\/$/, '').toLowerCase();
    
    // 1. Super Admin Bypass
    if (userRole === 'Super Admin') {
        return true;
    }

    // 2. Dashboard is open to all authenticated users
    if (normalized === '/dashboard') {
        return true;
    }

    // 3. Find matching page in config (most specific match first)
    const sortedConfig = [...systemPagesConfig].sort((a, b) => b.route_path.length - a.route_path.length);
    const configPage = sortedConfig.find(p => {
        const normRoute = p.route_path.replace(/\/$/, '').toLowerCase();
        return normalized === normRoute || normalized.startsWith(normRoute + '/');
    });

    if (!configPage) {
        // Not a permission-managed route, allow access
        return true;
    }

    // 4. Resolve permissions (view capability)
    const userPerm = userPermissions.find(p => p.permission_key === configPage.permission_key);
    return !!(userPerm && userPerm.can_view);
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const { isAuthenticated, isLoading, user, permissions = [] } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const { showToast } = useToast();

    // Stable key that changes only when the path changes
    const pathKey = location.pathname;

    // Compute access synchronously
    const hasAccess = useMemo(() => {
        if (!user) return false;
        return checkAccess(user.role, pathKey, permissions);
    }, [user, pathKey, permissions]);

    useEffect(() => {
        if (isLoading) return;
        if (!user) return;
        if (hasAccess) return;

        showToast("⚠️ You don't have permission to access this page.", 'error');
        navigate('/dashboard', { replace: true });
    }, [hasAccess, pathKey, user, navigate, showToast, isLoading]);

    // --- Guards ---
    if (isLoading) return <div className="flex items-center justify-center h-screen bg-slate-900 text-white">Loading...</div>;
    if (!isAuthenticated) return <Navigate to="/login" replace />;

    // Block rendering entirely while we're about to redirect — no blank page flash
    if (!hasAccess) return null;

    return <>{children}</>;
};
