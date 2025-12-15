import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/Button';
import { FormField } from '../components/FormField';
import { OtpInput } from '../components/OtpInput';
import { useToast } from '../components/Toast';
import styles from './Signup.module.css';
import loginGif from '../assets/login-animation.mp4.gif';
import logo from '../assets/velankani-software.jpg';

type SignupStep = 'details' | 'otp' | 'password' | 'success';

export const Signup: React.FC = () => {
    const navigate = useNavigate();
    const { checkEmail, requestSignupOtp, verifySignupOtp, createPassword, resendOtp, isLoading } = useAuth();
    const { showToast } = useToast();

    const [step, setStep] = useState<SignupStep>('details');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string; confirmPassword?: string }>({});
    const [timer, setTimer] = useState(30);

    useEffect(() => {
        let interval: any;
        if (step === 'otp' && timer > 0) {
            interval = setInterval(() => setTimer((t) => t - 1), 1000);
        }
        return () => clearInterval(interval);
    }, [step, timer]);

    const validateDetails = () => {
        const newErrors: { name?: string; email?: string } = {};
        if (!name) newErrors.name = 'Name is required';
        if (!email) newErrors.email = 'Email is required';
        else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Invalid email format';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleDetailsSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateDetails()) return;

        try {
            // 1. Check Email
            const emailCheck = await checkEmail(email);
            if (emailCheck.exists) {
                showToast(emailCheck.message, 'error');
                return;
            }

            // 2. Request OTP (Create Pending User)
            await requestSignupOtp(name, email);
            setStep('otp');
            setTimer(30);
            showToast('OTP is sent', 'success');
        } catch (err: any) {
            showToast(err.message || 'Failed to send OTP', 'error');
        }
    };

    const handleOtpSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (otp.length !== 6) {
            showToast('Please enter a valid 6-digit OTP', 'error');
            return;
        }

        try {
            await verifySignupOtp(email, otp);
            setStep('password');
            showToast('OTP is verified', 'success');
        } catch (err: any) {
            showToast(err.message || 'Verification failed', 'error');
        }
    };

    const validatePassword = () => {
        const newErrors: { password?: string; confirmPassword?: string } = {};
        if (!password) newErrors.password = 'Password is required';
        else if (password.length < 8) newErrors.password = 'Password must be at least 8 characters';
        else if (!/(?=.*\d)(?=.*[a-zA-Z])/.test(password)) newErrors.password = 'Password must contain at least one letter and one number';

        if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validatePassword()) return;

        try {
            await createPassword(email, password, confirmPassword);
            setStep('success');
            showToast('Account created successfully!', 'success');
        } catch (err: any) {
            showToast(err.message || 'Failed to create password', 'error');
        }
    };

    const handleResendOtp = async () => {
        if (timer > 0) return;
        try {
            await resendOtp(email, 'signup');
            setTimer(30);
            showToast('OTP resent', 'success');
        } catch (err: any) {
            showToast(err.message || 'Failed to resend OTP', 'error');
        }
    };

    if (step === 'success') {
        return (
            <div className={styles.container}>
                <div className={styles.leftPanel}>
                    <div className={styles.logoPlaceholder}>
                        <img src={logo} alt="Velankani" className={styles.logo} />
                    </div>
                    <div className={styles.successContent}>
                        <div className={styles.successIcon}>✓</div>
                        <h2 className={styles.title}>Account Created!</h2>
                        <p className={styles.subtitle}>You have successfully signed up.</p>
                        <Button onClick={() => navigate('/login')} fullWidth>
                            Go to Login
                        </Button>
                    </div>
                    <div className={styles.footer}>
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
            </div >
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.leftPanel}>
                <div className={styles.logoPlaceholder}>
                    <img src={logo} alt="Velankani" className={styles.logo} />
                </div>

                <h1 className={styles.title}>
                    {step === 'details' ? 'Create Account' : step === 'otp' ? 'Verify Email' : 'Set Password'}
                </h1>
                <p className={styles.subtitle}>
                    {step === 'details'
                        ? 'Start your journey with us.'
                        : step === 'otp'
                            ? `Enter the code sent to ${email}`
                            : 'Create a secure password for your account.'}
                </p>

                {step === 'details' && (
                    <form onSubmit={handleDetailsSubmit} className={styles.form}>
                        <FormField
                            id="name"
                            label="Full Name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            error={errors.name}
                            placeholder="Ankith v"
                            disabled={isLoading}
                            icon={
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                </svg>
                            }
                        />
                        <FormField
                            id="email"
                            label="Email address"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            error={errors.email}
                            placeholder="ankith@example.com"
                            disabled={isLoading}
                            icon={
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect width="20" height="16" x="2" y="4" rx="2" />
                                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                                </svg>
                            }
                        />
                        <Button type="submit" fullWidth isLoading={isLoading}>
                            Next
                        </Button>
                    </form>
                )}

                {step === 'otp' && (
                    <form onSubmit={handleOtpSubmit} className={styles.form}>
                        <OtpInput
                            value={otp}
                            onChange={setOtp}
                            disabled={isLoading}
                        />
                        <div className={styles.resendWrapper}>
                            <button
                                type="button"
                                className={styles.resendButton}
                                onClick={handleResendOtp}
                                disabled={timer > 0 || isLoading}
                            >
                                {timer > 0 ? `Resend code in ${timer}s` : 'Resend code'}
                            </button>
                        </div>
                        <div className={styles.buttonGroup}>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setStep('details')}
                                disabled={isLoading}
                            >
                                Back
                            </Button>
                            <Button type="submit" isLoading={isLoading}>
                                Verify
                            </Button>
                        </div>
                    </form>
                )}

                {step === 'password' && (
                    <form onSubmit={handlePasswordSubmit} className={styles.form}>
                        <FormField
                            id="password"
                            label="Password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            error={errors.password}
                            placeholder="Create a password"
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
                            label="Confirm Password"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            error={errors.confirmPassword}
                            placeholder="Confirm your password"
                            disabled={isLoading}
                            icon={
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                            }
                        />
                        <Button type="submit" fullWidth isLoading={isLoading}>
                            Create Account
                        </Button>
                    </form>
                )}

                <div className={styles.footer}>
                    <span className={styles.footerText}>Already have an account?</span>
                    <Link to="/login" className={styles.loginLink}>
                        Log in
                    </Link>
                    <div style={{ marginTop: '1rem' }}>
                        © 2024-2025 Velankani Group. All rights reserved.
                    </div>
                </div>
            </div>

            <div className={styles.rightPanel}>
                <img
                    src={loginGif}
                    alt="Shop Floor Control Animation"
                    className={styles.image}
                />
            </div>
        </div >
    );
};
