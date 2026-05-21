import React, { createContext, useContext, useState, useEffect } from 'react';

interface BackendUser {
    id: string;
    name: string;
    userId: string;
}

interface BackendAuthContextType {
    backendUser: BackendUser | null;
    isBackendAuth: boolean;
    backendLoading: boolean;
    authenticatedPath: string | null;
    backendLogin: (user: BackendUser, path: string) => void;
    backendLogout: () => void;
}

const BackendAuthContext = createContext<BackendAuthContextType | undefined>(undefined);

export const BackendAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [backendUser, setBackendUser] = useState<BackendUser | null>(null);
    const [authenticatedPath, setAuthenticatedPath] = useState<string | null>(null);
    const [backendLoading, setBackendLoading] = useState(true);

    useEffect(() => {
        setBackendLoading(false);
    }, []);

    const backendLogin = (user: BackendUser, path: string) => {
        setBackendUser(user);
        setAuthenticatedPath(path);
    };

    const backendLogout = () => {
        setBackendUser(null);
        setAuthenticatedPath(null);
    };

    return (
        <BackendAuthContext.Provider value={{ 
            backendUser, 
            isBackendAuth: !!backendUser, 
            backendLoading, 
            authenticatedPath,
            backendLogin, 
            backendLogout 
        }}>
            {children}
        </BackendAuthContext.Provider>
    );
};

export const useBackendAuth = () => {
    const context = useContext(BackendAuthContext);
    if (context === undefined) {
        throw new Error('useBackendAuth must be used within a BackendAuthProvider');
    }
    return context;
};
