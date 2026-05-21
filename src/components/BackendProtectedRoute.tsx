import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useBackendAuth } from '../context/BackendAuthContext';

interface BackendProtectedRouteProps {
    children: React.ReactNode;
}

export const BackendProtectedRoute: React.FC<BackendProtectedRouteProps> = ({ children }) => {
    const { isBackendAuth, backendLoading, authenticatedPath } = useBackendAuth();
    const location = useLocation();

    if (backendLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <div className="loading-spinner">Verifying Backend Access...</div>
            </div>
        );
    }

    // Check if not authenticated, or if the current path doesn't start with the authenticated path
    const isAuthorizedPath = authenticatedPath && location.pathname.startsWith(authenticatedPath);

    if (!isBackendAuth || !isAuthorizedPath) {
        // Redirect to Backend login but save the current location they were trying to go to
        return <Navigate to="/backend/login" state={{ from: location }} replace />;
    }

    return <>{children}</>;
};
