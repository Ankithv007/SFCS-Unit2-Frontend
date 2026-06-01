import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSmtAuth } from '../context/SmtAuthContext';

interface SmtProtectedRouteProps {
    children: React.ReactNode;
}

export const SmtProtectedRoute: React.FC<SmtProtectedRouteProps> = ({ children }) => {
    const { isSmtAuthenticated, smtLoading, authenticatedPath, smtUser } = useSmtAuth();
    const location = useLocation();

    if (smtLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <div className="loading-spinner">Verifying SMT Access...</div>
            </div>
        );
    }

    // Check if not authenticated, or if the current path doesn't start with the authenticated path
    const isAuthorizedPath = authenticatedPath && location.pathname.startsWith(authenticatedPath);

    if (!isSmtAuthenticated || !isAuthorizedPath) {
        // Redirect to SMT login but save the current location they were trying to go to
        return <Navigate to="/smt/login" state={{ from: location }} replace />;
    }

    // Enforce SMT Work Order / History page restrictions: only Admins and Managers can access them
    const isWorkOrderPath = location.pathname.startsWith('/smt/work-order') || location.pathname.startsWith('/smt/workorder-history');
    if (isWorkOrderPath) {
        const authorizedRoles = ['Super Admin', 'Admin', 'Manager'];
        if (!smtUser || !authorizedRoles.includes(smtUser.role)) {
            // Redirect unauthorized operators/employees to standard station page
            return <Navigate to="/smt/printing" state={{ accessError: 'Access Denied: Only Admins or Managers can access this page.' }} replace />;
        }
    }

    return <>{children}</>;
};
