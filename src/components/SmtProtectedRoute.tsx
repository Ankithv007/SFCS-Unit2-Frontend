import React, { useEffect } from 'react';
import { useSmtAuth } from '../context/SmtAuthContext';
import { useAuth } from '../hooks/useAuth';

interface SmtProtectedRouteProps {
    children: React.ReactNode;
}

export const SmtProtectedRoute: React.FC<SmtProtectedRouteProps> = ({ children }) => {
    const { isSmtAuthenticated, smtLoading, smtLogin } = useSmtAuth();
    const { user } = useAuth();

    // Auto-login to SMT silently if user is logged in globally
    useEffect(() => {
        if (!isSmtAuthenticated && user) {
            smtLogin({
                id: user.id.toString(),
                name: user.name || '',
                userId: user.email || '',
                role: user.role || 'Operator'
            }, window.location.pathname);
        }
    }, [isSmtAuthenticated, user, smtLogin]);

    if (smtLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <div className="loading-spinner">Verifying SMT Access...</div>
            </div>
        );
    }

    return <>{children}</>;
};

