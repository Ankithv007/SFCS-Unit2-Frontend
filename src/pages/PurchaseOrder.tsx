import React from 'react';
import styles from './Dashboard.module.css';

export const PurchaseOrder: React.FC = () => {
    return (
        <div className={styles.container}>
            <main className={styles.content}>
                <div className={styles.card}>
                    <h2>Purchase Order (PO)</h2>
                    <p>Manage your purchase orders here.</p>
                </div>
            </main>
        </div>
    );
};
