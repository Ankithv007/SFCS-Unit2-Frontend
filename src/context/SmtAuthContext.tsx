import React, { createContext, useContext, useState, useEffect } from 'react';

interface SmtUser {
    id: string;
    name: string;
    userId: string;
    role: string;
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
        const storedUser = localStorage.getItem('smtUser');
        const storedPath = localStorage.getItem('smtAuthenticatedPath');
        if (storedUser) {
            setSmtUser(JSON.parse(storedUser));
        }
        if (storedPath) {
            setAuthenticatedPath(storedPath);
        }
        setSmtLoading(false);
    }, []);

    const smtLogin = (user: SmtUser, path: string) => {
        setSmtUser(user);
        setAuthenticatedPath(path);
        localStorage.setItem('smtUser', JSON.stringify(user));
        localStorage.setItem('smtAuthenticatedPath', path);
        localStorage.setItem('X-User-Name', user.name);
    };

    const smtLogout = () => {
        setSmtUser(null);
        setAuthenticatedPath(null);
        localStorage.removeItem('smtUser');
        localStorage.removeItem('smtAuthenticatedPath');
        localStorage.removeItem('X-User-Name');
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
