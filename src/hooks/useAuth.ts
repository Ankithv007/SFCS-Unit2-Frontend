import { useState, useEffect, useCallback } from 'react';
import { processAvatarImage } from '../utils/imageUtils';

export interface User {
    email: string;
    name?: string;
    id: string;
    avatar?: string;
}

export interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const useAuth = () => {
    const [user, setUser] = useState<User | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Check for existing session from localStorage (token persistence)
        const token = localStorage.getItem('auth_token');
        const storedUser = localStorage.getItem('user_data');

        if (token && storedUser) {
            setUser(JSON.parse(storedUser));
            setIsAuthenticated(true);
        }
        setIsLoading(false);
    }, []);

    const apiCall = async (endpoint: string, method: string, body?: any) => {
        try {
            const headers: HeadersInit = {
                'Content-Type': 'application/json',
            };

            const token = localStorage.getItem('auth_token');
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'API Error');
            }

            return data;
        } catch (err: any) {
            throw new Error(err.message || 'Network Error');
        }
    };

    const checkEmail = useCallback(async (email: string): Promise<{ exists: boolean; message: string }> => {
        return await apiCall('/api/auth/check-email', 'POST', { email });
    }, []);

    const requestSignupOtp = useCallback(async (name: string, email: string): Promise<void> => {
        await apiCall('/api/auth/request-signup-otp', 'POST', { name, email });
    }, []);

    const verifySignupOtp = useCallback(async (email: string, otp: string): Promise<void> => {
        await apiCall('/api/auth/verify-signup-otp', 'POST', { email, otp });
    }, []);

    const createPassword = useCallback(async (email: string, password: string, confirmPassword: string): Promise<void> => {
        await apiCall('/api/auth/create-password', 'POST', { email, password, confirmPassword });
    }, []);

    const resendOtp = useCallback(async (email: string, purpose: 'signup' | 'forgot'): Promise<void> => {
        await apiCall('/api/auth/resend-otp', 'POST', { email, purpose });
    }, []);

    const login = useCallback(async (email: string, password: string): Promise<void> => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await apiCall('/api/auth/login', 'POST', { email, password });
            // Backend now returns avatar in user object
            const sessionUser = {
                email: data.user.email,
                name: data.user.name,
                id: data.user.id,
                avatar: data.user.avatar
            };

            setUser(sessionUser);
            setIsAuthenticated(true);

            localStorage.setItem('auth_token', data.token);
            localStorage.setItem('user_data', JSON.stringify(sessionUser));
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const requestForgotOtp = useCallback(async (email: string): Promise<void> => {
        await apiCall('/api/auth/request-forgot-otp', 'POST', { email });
    }, []);

    const confirmForgotOtp = useCallback(async (email: string, otp: string, newPassword: string): Promise<void> => {
        await apiCall('/api/auth/confirm-forgot-otp', 'POST', { email, otp, newPassword });
    }, []);

    const logout = useCallback(async () => {
        setUser(null);
        setIsAuthenticated(false);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
    }, []);

    const updateUserAvatar = useCallback(async (file: File): Promise<void> => {
        try {
            // Process the image (resize & compress)
            const base64Avatar = await processAvatarImage(file);

            // Upload to server
            if (user?.email) {
                await apiCall('/api/auth/update-avatar', 'POST', {
                    email: user.email,
                    avatar: base64Avatar
                });
            }

            // Update local state
            setUser((prev) => {
                if (!prev) return null;
                const updatedUser = { ...prev, avatar: base64Avatar };

                // Update local storage for session
                localStorage.setItem('user_data', JSON.stringify(updatedUser));

                return updatedUser;
            });
        } catch (error) {
            console.error("Failed to process avatar:", error);
            throw error;
        }
    }, [user]);

    const removeUserAvatar = useCallback(async (): Promise<void> => {
        try {
            if (user?.email) {
                await apiCall('/api/auth/update-avatar', 'POST', {
                    email: user.email,
                    avatar: null
                });
            }

            setUser((prev) => {
                if (!prev) return null;
                const updatedUser = { ...prev, avatar: undefined }; // or null, but interface says optional string
                localStorage.setItem('user_data', JSON.stringify(updatedUser));
                return updatedUser;
            });
        } catch (error) {
            console.error("Failed to remove avatar:", error);
            throw error;
        }
    }, [user]);

    return {
        user,
        isAuthenticated,
        isLoading,
        error,
        login,
        logout,
        checkEmail,
        requestSignupOtp,
        verifySignupOtp,
        resendOtp,
        requestForgotOtp,
        confirmForgotOtp,
        createPassword,
        updateUserAvatar,
        removeUserAvatar
    };
};
