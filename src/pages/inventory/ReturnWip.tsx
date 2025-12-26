import React from 'react';
import styles from '../dashboard/Dashboard.module.css';

export const ReturnWip: React.FC = () => {
    return (
        <div className={styles.container}>
            <main className={styles.content}>
                <div className={styles.card}>
                    <h2>Return From WIP</h2>
                    <p>Process returns from Work In Progress.</p>
                </div>
            </main>
        </div>
    );
};
