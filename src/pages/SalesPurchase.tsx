import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './SalesPurchase.module.css';

export const SalesPurchase: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1>Sales & Purchase Module</h1>
            </header>
            <main className={styles.content}>
                <p>Welcome to the Sales & Purchase Module.</p>
                <p><em>This module is currently under construction.</em></p>
                {/* Future content will go here */}
            </main>
        </div>
    );
};
