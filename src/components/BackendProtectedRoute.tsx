import React, { useEffect } from 'react';
import { useBackendAuth } from '../context/BackendAuthContext';
import { useAuth } from '../hooks/useAuth';

interface BackendProtectedRouteProps {
    children: React.ReactNode;
}

export const BackendProtectedRoute: React.FC<BackendProtectedRouteProps> = ({ children }) => {
    const { isBackendAuth, backendLoading, backendLogin } = useBackendAuth();
    const { user } = useAuth();

    // Auto-login to backend silently if user is logged in globally
    useEffect(() => {
        if (!isBackendAuth && user) {
            backendLogin({
                id: user.id.toString(),
                name: user.name || '',
                userId: user.email || '',
                role: user.role || 'Operator'
            }, window.location.pathname);
        }
    }, [isBackendAuth, user, backendLogin]);

    if (backendLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <div className="loading-spinner">Verifying Backend Access...</div>
            </div>
        );
    }

    return <>{children}</>;
};
