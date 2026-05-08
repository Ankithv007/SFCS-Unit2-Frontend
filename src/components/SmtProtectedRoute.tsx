import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSmtAuth } from '../context/SmtAuthContext';

interface SmtProtectedRouteProps {
    children: React.ReactNode;
}

export const SmtProtectedRoute: React.FC<SmtProtectedRouteProps> = ({ children }) => {
    const { isSmtAuthenticated, smtLoading } = useSmtAuth();
    const location = useLocation();

    if (smtLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <div className="loading-spinner">Verifying SMT Access...</div>
            </div>
        );
    }

    if (!isSmtAuthenticated) {
        // Redirect to SMT login but save the current location they were trying to go to
        return <Navigate to="/smt/login" state={{ from: location }} replace />;
    }

    return <>{children}</>;
};
