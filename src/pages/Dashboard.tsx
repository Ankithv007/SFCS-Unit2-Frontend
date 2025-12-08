import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import styles from './Dashboard.module.css';

export const Dashboard: React.FC = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1>Welcome, {user?.name || 'User'}!</h1>
                <button onClick={handleLogout} className={styles.logoutButton}>
                    Logout
                </button>
            </header>
            <main className={styles.content}>
                <p>This is your dashboard. You have successfully logged in.</p>
                <div className={styles.card}>
                    <h2>Your Profile</h2>
                    <p><strong>Email:</strong> {user?.email}</p>
                    <p><strong>ID:</strong> {user?.id}</p>
                </div>
            </main>
        </div>
    );
};
