import React, { createContext, useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../utils/api';

export interface User {
    email: string;
    name?: string;
    id: string;
    avatar?: string;
    role: string;
    permission_version?: number;
}

export interface UserPermission {
    permission_key: string;
    can_view: boolean;
    can_create: boolean;
    can_edit: boolean;
    can_delete: boolean;
    can_export: boolean;
}

export interface AuthContextType {
    user: User | null;
    permissions: UserPermission[];
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
    setUser: React.Dispatch<React.SetStateAction<User | null>>;
    setIsAuthenticated: React.Dispatch<React.SetStateAction<boolean>>;
    setPermissions: React.Dispatch<React.SetStateAction<UserPermission[]>>;
    refreshUser: () => Promise<void>;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [permissions, setPermissions] = useState<UserPermission[]>([]);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const refreshUser = useCallback(async () => {
        const token = localStorage.getItem('auth_token');
        if (!token) {
            setIsLoading(false);
            return;
        }

        try {
            const data = await apiFetch('/api/auth/me', { method: 'GET' });
            if (data.success && data.user) {
                setUser({
                    id: data.user.id,
                    name: data.user.name,
                    email: data.user.email,
                    avatar: data.user.avatar,
                    role: data.user.role,
                    permission_version: data.user.permission_version
                });
                setPermissions(data.permissions || []);
                setIsAuthenticated(true);
                // Update local storage to match
                localStorage.setItem('user_data', JSON.stringify({
                    id: data.user.id,
                    name: data.user.name,
                    email: data.user.email,
                    avatar: data.user.avatar,
                    role: data.user.role,
                    permission_version: data.user.permission_version
                }));
                if (data.token) {
                    localStorage.setItem('auth_token', data.token); // token refreshed!
                }
            } else {
                // Clear token if invalid profile
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user_data');
                setUser(null);
                setPermissions([]);
                setIsAuthenticated(false);
            }
        } catch (err: any) {
            console.error('Error fetching user profile:', err);
            // Don't log out on temporary network issues, but if it's 401/403, clear session
            if (err.status === 401 || err.status === 403) {
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user_data');
                setUser(null);
                setPermissions([]);
                setIsAuthenticated(false);
            }
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshUser();
    }, [refreshUser]);

    const login = useCallback(async (email: string, password: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await apiFetch('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });

            if (data && data.token) {
                localStorage.setItem('auth_token', data.token);
                // Profile & permissions will be fetched next
                await refreshUser();
            } else {
                throw new Error(data?.message || 'Login failed');
            }
        } catch (err: any) {
            setError(err.message || 'Login failed');
            setIsLoading(false);
            throw err;
        }
    }, [refreshUser]);

    const logout = useCallback(async () => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        setUser(null);
        setPermissions([]);
        setIsAuthenticated(false);
    }, []);

    return (
        <AuthContext.Provider value={{
            user,
            permissions,
            isAuthenticated,
            isLoading,
            error,
            setUser,
            setIsAuthenticated,
            setPermissions,
            refreshUser,
            login,
            logout
        }}>
            {children}
        </AuthContext.Provider>
    );
};
