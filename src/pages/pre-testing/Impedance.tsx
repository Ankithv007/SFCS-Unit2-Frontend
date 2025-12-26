import React from 'react';
import styles from './PreTesting.module.css';

export const Impedance: React.FC = () => {
    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2><span role="img" aria-label="icon">⚡</span> Impedance Testing</h2>
                <p>Measure and verify impedance characteristics of PCBs.</p>
            </div>

            <div className={styles.content}>
                <div className={styles.placeholderIcon}>⚡</div>
                <h3>Impedance Module Under Construction</h3>
                <p>This module will facilitate the recording of impedance measurements. It will support defining test points, setting tolerance limits, and generating pass/fail reports.</p>
            </div>
        </div>
    );
};
