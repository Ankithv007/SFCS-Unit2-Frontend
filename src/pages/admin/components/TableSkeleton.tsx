import React from 'react';
import styles from '../AdminPanel.module.css';

interface TableSkeletonProps {
    rows?: number;
    cols?: number;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({ rows = 5, cols: _cols = 6 }) => {
    return (
        <div style={{ padding: '1rem' }}>
            {Array.from({ length: rows }).map((_, rIdx) => (
                <div key={rIdx} className={styles.skeletonRow} />
            ))}
        </div>
    );
};
