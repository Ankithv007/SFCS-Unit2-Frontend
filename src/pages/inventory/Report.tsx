import React from 'react';
import styles from './Report.module.css';

export const Report: React.FC = () => {
    return (
        <div className={styles.container}>
            <h2>Report</h2>
            <p>View and manage inventory reports.</p>

            <div className={styles.section}>
                <h3 className={styles.title}>Inventory Summary</h3>
                <p>Report content will go here...</p>
            </div>
        </div>
    );
};
