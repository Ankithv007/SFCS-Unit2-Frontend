import { useState, useEffect, useCallback } from 'react';
import { processAvatarImage } from '../utils/imageUtils';
import { apiFetch } from '../utils/api';

export interface User {
    email: string;
    name?: string;
    id: string;
    avatar?: string;
    role: string;
}

export interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
}

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
            try {
                const parsed = JSON.parse(storedUser);
                if (parsed && parsed.email && parsed.email.toLowerCase().endsWith('@sfcs.local')) {
                    parsed.email = '';
                    localStorage.setItem('user_data', JSON.stringify(parsed));
                }
                setUser(parsed);
            } catch (e) {
                setUser(JSON.parse(storedUser));
            }
            setIsAuthenticated(true);
        }
        setIsLoading(false);
    }, []);

    const checkEmail = useCallback(async (email: string): Promise<{ exists: boolean; message: string }> => {
        return await apiFetch('/api/auth/check-email', {
            method: 'POST',
            body: JSON.stringify({ email })
        });
    }, []);

    const requestSignupOtp = useCallback(async (name: string, email: string): Promise<void> => {
        await apiFetch('/api/auth/request-signup-otp', {
            method: 'POST',
            body: JSON.stringify({ name, email })
        });
    }, []);

    const verifySignupOtp = useCallback(async (email: string, otp: string): Promise<void> => {
        await apiFetch('/api/auth/verify-signup-otp', {
            method: 'POST',
            body: JSON.stringify({ email, otp })
        });
    }, []);

    const createPassword = useCallback(async (email: string, password: string, confirmPassword: string): Promise<void> => {
        await apiFetch('/api/auth/create-password', {
            method: 'POST',
            body: JSON.stringify({ email, password, confirmPassword })
        });
    }, []);

    const resendOtp = useCallback(async (email: string, purpose: 'signup' | 'forgot'): Promise<void> => {
        await apiFetch('/api/auth/resend-otp', {
            method: 'POST',
            body: JSON.stringify({ email, purpose })
        });
    }, []);

    const login = useCallback(async (email: string, password: string): Promise<void> => {
        setIsLoading(true);
        setError(null);
        try {
            let data;
            try {
                data = await apiFetch('/api/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({ email, password })
                });
            } catch (backendErr: any) {
                const identifier = email.trim().toLowerCase();

                // 1. Check if identifier is a registered employee code (from Signup page)
                //    If so, resolve it to an email and retry the backend login
                const empCodes = JSON.parse(localStorage.getItem('registered_employee_codes') || '{}');
                if (empCodes[identifier]) {
                    const resolvedEmail = empCodes[identifier];
                    try {
                        const retryData = await apiFetch('/api/auth/login', {
                            method: 'POST',
                            body: JSON.stringify({ email: resolvedEmail, password })
                        });
                        const sessionUser: User = {
                            email: retryData.user.email,
                            name: retryData.user.name,
                            id: retryData.user.id,
                            avatar: retryData.user.avatar,
                            role: retryData.user.role || 'User'
                        };
                        setUser(sessionUser);
                        setIsAuthenticated(true);
                        localStorage.setItem('auth_token', retryData.token);
                        localStorage.setItem('user_data', JSON.stringify(sessionUser));
                        return;
                    } catch {
                        // Fall through to custom user check
                    }
                }

                 // 2. Check custom users in localStorage — match by email OR employee code
                const storedCustomUsers = localStorage.getItem('custom_users');
                const customUsers = storedCustomUsers ? JSON.parse(storedCustomUsers) : [];
                const customUser = customUsers.find(
                    (u: any) =>
                        (((u.email && u.email.toLowerCase() === identifier) || (u.employeeCode && u.employeeCode.toLowerCase() === identifier)))
                        && u.password === password
                );

                if (customUser) {
                    if (customUser.status === 'Inactive') {
                        throw new Error('User account is inactive.');
                    }
                    const sessionUser: User = {
                        email: customUser.email || '',
                        name: customUser.name,
                        id: customUser.id || customUser.employeeCode || customUser.email || Date.now().toString(),
                        role: customUser.position || 'User'
                    };

                    setUser(sessionUser);
                    setIsAuthenticated(true);

                    localStorage.setItem('auth_token', 'mock_token_' + sessionUser.id);
                    localStorage.setItem('user_data', JSON.stringify(sessionUser));
                    return;
                }
                // If not found locally either, rethrow the backend error
                throw backendErr;
            }

            // Backend successfully logged in
            const sessionUser: User = {
                email: data.user.email,
                name: data.user.name,
                id: data.user.id,
                avatar: data.user.avatar,
                role: data.user.role || 'User'
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
        await apiFetch('/api/auth/request-forgot-otp', {
            method: 'POST',
            body: JSON.stringify({ email })
        });
    }, []);

    const confirmForgotOtp = useCallback(async (email: string, otp: string, newPassword: string): Promise<void> => {
        await apiFetch('/api/auth/confirm-forgot-otp', {
            method: 'POST',
            body: JSON.stringify({ email, otp, newPassword })
        });
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
                await apiFetch('/api/auth/update-avatar', {
                    method: 'POST',
                    body: JSON.stringify({
                        email: user.email,
                        avatar: base64Avatar
                    })
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
                await apiFetch('/api/auth/update-avatar', {
                    method: 'POST',
                    body: JSON.stringify({
                        email: user.email,
                        avatar: null
                    })
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
