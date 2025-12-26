import React from 'react';
import styles from './PreTesting.module.css';

export const IQC: React.FC = () => {
    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2><span role="img" aria-label="icon">🔍</span> Incoming Quality Control (IQC)</h2>
                <p>Verify the quality of incoming raw materials and components.</p>
            </div>

            <div className={styles.content}>
                <div className={styles.placeholderIcon}>🔍</div>
                <h3>IQC Module Under Construction</h3>
                <p>This module will allow you to record and track inspection results for incoming materials. Features will include checklist management, defect logging, and acceptance/rejection workflows.</p>
            </div>
        </div>
    );
};
