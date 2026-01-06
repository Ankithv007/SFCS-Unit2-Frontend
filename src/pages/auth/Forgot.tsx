import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/Button';
import { FormField } from '../../components/FormField';
import { OtpInput } from '../../components/OtpInput';
import { useToast } from '../../components/Toast';
import styles from './Forgot.module.css';
import loginGif from '../../assets/login-animation.mp4.gif';
import logo from '../../assets/velankani-software.jpg';

type ForgotStep = 'email' | 'reset';

export const Forgot: React.FC = () => {
    const navigate = useNavigate();
    const { requestForgotOtp, confirmForgotOtp, resendOtp, isLoading } = useAuth();
    const { showToast } = useToast();

    const [step, setStep] = useState<ForgotStep>('email');
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [timer, setTimer] = useState(0);
    const [errors, setErrors] = useState<{ email?: string; password?: string; confirmPassword?: string }>({});

    useEffect(() => {
        let interval: any;
        if (step === 'reset' && timer > 0) {
            interval = setInterval(() => setTimer((t) => t - 1), 1000);
        }
        return () => clearInterval(interval);
    }, [step, timer]);

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        try {
            // 1. Request OTP (Backend checks if account exists)
            await requestForgotOtp(email);
            setStep('reset');
            setTimer(30);
            showToast('Reset instructions sent', 'success');
        } catch (err: any) {
            if (err.message === 'Account not found' || err.message.includes('not found')) {
                showToast('Account not found. Please Sign Up first.', 'error');
            } else {
                showToast(err.message || 'Failed to send instructions', 'error');
            }
        }
    };

    const validateReset = () => {
        const newErrors: { password?: string; confirmPassword?: string } = {};
        if (!newPassword) newErrors.password = 'Password is required';
        else if (newPassword.length < 8) newErrors.password = 'Password must be at least 8 characters';

        if (newPassword !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleResetSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateReset()) return;
        if (otp.length !== 6) {
            showToast('Please enter a valid 6-digit OTP', 'error');
            return;
        }

        try {
            await confirmForgotOtp(email, otp, newPassword);
            showToast('Password changed successfully. Please login.', 'success');
            navigate('/login');
        } catch (err: any) {
            showToast(err.message || 'Failed to reset password', 'error');
        }
    };

    const handleResendOtp = async () => {
        if (timer > 0) return;
        try {
            await resendOtp(email, 'forgot');
            setTimer(30);
            showToast('OTP resent', 'success');
        } catch (err: any) {
            showToast(err.message || 'Failed to resend OTP', 'error');
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.leftPanel}>
                <div className={styles.logoPlaceholder}>
                    <img src={logo} alt="Velankani" className={styles.logo} />
                </div>

                <h1 className={styles.title}>Reset Password</h1>
                <p className={styles.subtitle}>
                    {step === 'email'
                        ? 'Enter your email to receive reset instructions.'
                        : `Enter OTP sent to ${email} and new password.`}
                </p>

                {step === 'email' ? (
                    <form onSubmit={handleEmailSubmit} className={styles.form}>
                        <FormField
                            id="email"
                            label="Email address"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter your email"
                            disabled={isLoading}
                            required
                            icon={
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect width="20" height="16" x="2" y="4" rx="2" />
                                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                                </svg>
                            }
                        />
                        <Button type="submit" fullWidth isLoading={isLoading}>
                            Send Instructions
                        </Button>
                    </form>
                ) : (
                    <form onSubmit={handleResetSubmit} className={styles.form}>
                        <OtpInput
                            value={otp}
                            onChange={setOtp}
                            disabled={isLoading}
                        />

                        <FormField
                            id="newPassword"
                            label="New Password"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            error={errors.password}
                            placeholder="Enter new password"
                            disabled={isLoading}
                            icon={
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                            }
                        />
                        <FormField
                            id="confirmPassword"
                            label="Confirm New Password"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            error={errors.confirmPassword}
                            placeholder="Confirm new password"
                            disabled={isLoading}
                            icon={
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                            }
                        />

                        <div className={styles.resendWrapper}>
                            {timer > 0 ? (
                                <div className={styles.timerContainer}>
                                    <svg className={styles.timerSvg} width="40" height="40">
                                        <circle
                                            className={styles.timerCircleBg}
                                            cx="20"
                                            cy="20"
                                            r="18"
                                        />
                                        <circle
                                            className={styles.timerCircleFg}
                                            cx="20"
                                            cy="20"
                                            r="18"
                                            style={{
                                                strokeDasharray: 113,
                                                strokeDashoffset: 113 - (113 * timer) / 30,
                                            }}
                                        />
                                    </svg>
                                    <span className={styles.timerText}>{timer}</span>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    className={styles.resendButton}
                                    onClick={handleResendOtp}
                                    disabled={isLoading}
                                >
                                    Resend Code
                                </button>
                            )}
                        </div>

                        <Button type="submit" fullWidth isLoading={isLoading}>
                            Reset Password
                        </Button>
                    </form>
                )}

                <div className={styles.footer}>
                    <Link to="/login" className={styles.backLink}>
                        ← Back to Login
                    </Link>
                </div>

                <div className={styles.copyright}>
                    © 2024-2025 Velankani Group. All rights reserved.
                </div>
            </div>

            <div className={styles.rightPanel}>
                <img
                    src={loginGif}
                    alt="Shop Floor Control Animation"
                    className={styles.image}
                />
            </div>
        </div>
    );
};
