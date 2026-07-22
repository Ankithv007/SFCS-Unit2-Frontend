import { useContext, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import type { User, UserPermission } from '../context/AuthContext';
import { processAvatarImage } from '../utils/imageUtils';
import { apiFetch } from '../utils/api';

export type { User, UserPermission };

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }

    const {
        user,
        permissions,
        isAuthenticated,
        isLoading,
        error,
        setUser,
        login,
        logout,
        refreshUser
    } = context;

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

    const updateUserAvatar = useCallback(async (file: File): Promise<void> => {
        try {
            const base64Avatar = await processAvatarImage(file);
            if (user?.email) {
                await apiFetch('/api/auth/update-avatar', {
                    method: 'POST',
                    body: JSON.stringify({
                        email: user.email,
                        avatar: base64Avatar
                    })
                });
            }

            setUser((prev) => {
                if (!prev) return null;
                const updatedUser = { ...prev, avatar: base64Avatar };
                localStorage.setItem('user_data', JSON.stringify(updatedUser));
                return updatedUser;
            });
        } catch (error) {
            console.error("Failed to process avatar:", error);
            throw error;
        }
    }, [user, setUser]);

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
                const updatedUser = { ...prev, avatar: undefined };
                localStorage.setItem('user_data', JSON.stringify(updatedUser));
                return updatedUser;
            });
        } catch (error) {
            console.error("Failed to remove avatar:", error);
            throw error;
        }
    }, [user, setUser]);

    return {
        user,
        permissions,
        isAuthenticated,
        isLoading,
        error,
        login,
        logout,
        refreshUser,
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
