import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSmtAuth } from '../context/SmtAuthContext';
import { useAuth } from '../hooks/useAuth';

interface SmtProtectedRouteProps {
    children: React.ReactNode;
}

export const SmtProtectedRoute: React.FC<SmtProtectedRouteProps> = ({ children }) => {
    const { isSmtAuthenticated, smtLoading, authenticatedPath, smtUser, smtLogin } = useSmtAuth();
    const { user } = useAuth();
    const location = useLocation();

    const authorizedRoles = ['Super Admin', 'Admin', 'Manager'];
    const isGlobalAdmin = user && authorizedRoles.includes(user.role);

    // Auto-login to SMT if user is a global Admin/Manager/Super Admin but not yet SMT authenticated
    useEffect(() => {
        if (!isSmtAuthenticated && isGlobalAdmin) {
            smtLogin({
                id: user.id.toString(),
                name: user.name || '',
                userId: user.email || '',
                role: user.role || 'Operator'
            }, '/smt/work-order');
        }
    }, [isSmtAuthenticated, isGlobalAdmin, user, smtLogin]);

    if (smtLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <div className="loading-spinner">Verifying SMT Access...</div>
            </div>
        );
    }

    const hasAccess = isSmtAuthenticated || isGlobalAdmin;

    // Check if not authenticated, or if the current path doesn't start with the authenticated path
    // Global admins can access any SMT path
    const isAuthorizedPath = (authenticatedPath && location.pathname.startsWith(authenticatedPath)) || isGlobalAdmin;

    if (!hasAccess || !isAuthorizedPath) {
        // Redirect to SMT login but save the current location they were trying to go to
        return <Navigate to="/smt/login" state={{ from: location }} replace />;
    }

    // Enforce SMT Work Order / History page restrictions: only Admins and Managers can access them
    const isWorkOrderPath = location.pathname.startsWith('/smt/work-order') || location.pathname.startsWith('/smt/workorder-history');
    if (isWorkOrderPath) {
        const currentRole = (smtUser?.role || user?.role || '').trim().toLowerCase();
        const allowed = ['super admin', 'admin', 'manager'];
        if (!currentRole || !allowed.includes(currentRole)) {
            // Redirect unauthorized operators/employees to standard station page
            return <Navigate to="/smt/printing" state={{ accessError: 'Access Denied: Only Admins or Managers can access this page.' }} replace />;
        }
    }

    return <>{children}</>;
};

