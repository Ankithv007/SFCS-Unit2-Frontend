import React, { createContext, useContext, useState, useEffect } from 'react';

interface SmtUser {
    id: string;
    name: string;
    userId: string;
}

interface SmtAuthContextType {
    smtUser: SmtUser | null;
    isSmtAuthenticated: boolean;
    smtLoading: boolean;
    authenticatedPath: string | null;
    smtLogin: (user: SmtUser, path: string) => void;
    smtLogout: () => void;
}

const SmtAuthContext = createContext<SmtAuthContextType | undefined>(undefined);

export const SmtAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [smtUser, setSmtUser] = useState<SmtUser | null>(null);
    const [authenticatedPath, setAuthenticatedPath] = useState<string | null>(null);
    const [smtLoading, setSmtLoading] = useState(true);

    useEffect(() => {
        setSmtLoading(false);
    }, []);

    const smtLogin = (user: SmtUser, path: string) => {
        setSmtUser(user);
        setAuthenticatedPath(path);
    };

    const smtLogout = () => {
        setSmtUser(null);
        setAuthenticatedPath(null);
    };

    return (
        <SmtAuthContext.Provider value={{ 
            smtUser, 
            isSmtAuthenticated: !!smtUser, 
            smtLoading, 
            authenticatedPath,
            smtLogin, 
            smtLogout 
        }}>
            {children}
        </SmtAuthContext.Provider>
    );
};

export const useSmtAuth = () => {
    const context = useContext(SmtAuthContext);
    if (context === undefined) {
        throw new Error('useSmtAuth must be used within an SmtAuthProvider');
    }
    return context;
};
