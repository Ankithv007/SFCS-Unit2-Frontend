import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import styles from './Dashboard.module.css';

export const Dashboard: React.FC = () => {
    const { user } = useAuth();

    return (
        <div className={styles.container}>
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
