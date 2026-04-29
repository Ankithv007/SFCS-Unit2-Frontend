import React from 'react';
import styles from './SPI.module.css';

export const SPI: React.FC = () => {
    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2>SPI (Solder Paste Inspection)</h2>
                <p>Manage Solder Paste Inspection processes and monitor print quality.</p>
            </div>
            
            <div className={styles.card}>
                <h3>SPI Dashboard</h3>
                <p style={{ color: '#6b7280', marginTop: '1rem' }}>
                    Welcome to the SPI module. Connect your scanning equipment to verify solder paste deposition.
                </p>
                <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center', padding: '3rem', border: '2px dashed #e5e7eb', borderRadius: '1rem', backgroundColor: '#f9fafb' }}>
                    <p style={{ color: '#9ca3af', fontWeight: 600, fontSize: '1.2rem' }}>SPI scanning and verification integration coming soon.</p>
                </div>
            </div>
        </div>
    );
};
