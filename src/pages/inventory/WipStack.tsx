import React from 'react';
import styles from '../dashboard/Dashboard.module.css';

export const WipStack: React.FC = () => {
    return (
        <div className={styles.container}>
            <main className={styles.content}>
                <div className={styles.card}>
                    <h2>WIP Stack [Prod]</h2>
                    <p>View and manage Work In Progress stack.</p>
                </div>
            </main>
        </div>
    );
};
