import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/Button';
import { FormField } from '../../components/FormField';
import { useToast } from '../../components/Toast';
import styles from './Login.module.css';
import loginGif from '../../assets/login-animation.mp4.gif';


import logo from '../../assets/velankani-software.jpg';

export const Login: React.FC = () => {
    const navigate = useNavigate();
    const { login, isLoading } = useAuth();
    const { showToast } = useToast();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

    const validate = () => {
        const newErrors: { email?: string; password?: string } = {};
        // Accept either a valid email OR a non-empty employee code
        if (!email.trim()) newErrors.email = 'Email Address or Employee Code is required';

        if (!password) newErrors.password = 'Password is required';
        else if (password.length < 6) newErrors.password = 'Password must be at least 6 characters';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        try {
            await login(email, password);
            showToast('Successfully logged in!', 'success');
            navigate('/dashboard');
        } catch (err: any) {
            const msg = err.message;
            if (msg === 'Account not found') {
                showToast('Account not found — please sign up.', 'error');
            } else if (msg === 'Incorrect credentials') {
                showToast('Email or password incorrect.', 'error');
            } else {
                showToast(msg || 'Login failed', 'error');
            }
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.leftPanel}>
                <div className={styles.logoPlaceholder}>
                    <img src={logo} alt="Velankani" className={styles.logo} />
                </div>

                <h1 className={styles.title}>Shop Floor Control System</h1>
                <p className={styles.subtitle}>Unlock real-time visibility into your production.</p>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <FormField
                        id="email"
                        label="Email Address / Employee Code"
                        type="text"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        error={errors.email}
                        placeholder="Enter your email address or employee code"
                        disabled={isLoading}
                        icon={
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect width="20" height="16" x="2" y="4" rx="2" />
                                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                            </svg>
                        }
                    />

                    <div className={styles.passwordWrapper}>
                        <FormField
                            id="password"
                            label="Password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            error={errors.password}
                            placeholder="Enter your password"
                            disabled={isLoading}
                            icon={
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                            }
                        />
                        <Link to="/forgot" className={styles.forgotLink}>
                            Forgot password?
                        </Link>
                    </div>

                    <Button type="submit" fullWidth isLoading={isLoading}>
                        Sign In
                    </Button>

                    <div className={styles.footer}>
                        <span className={styles.footerText}>Don't have an account?</span>
                        <Link to="/signup" className={styles.signupLink}>
                            Sign up
                        </Link>
                    </div>
                </form>

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
