import React from 'react';
import styles from './SmtDowntimeTracker.module.css';

interface SmtDeleteConfirmModalProps {
    targetId: string | null;
    deleting: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export const SmtDeleteConfirmModal: React.FC<SmtDeleteConfirmModalProps> = ({
    targetId,
    deleting,
    onConfirm,
    onCancel
}) => {
    if (!targetId) return null;

    return (
        <div className={styles.modalOverlay} onClick={onCancel}>
            <div className={styles.modalContent} style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader} style={{ borderBottom: '1px solid #fee2e2' }}>
                    <h3 style={{ color: '#dc2626' }}>⚠️ Delete Downtime Record</h3>
                    <button className={styles.modalCloseBtn} onClick={onCancel}>&times;</button>
                </div>
                <div className={styles.modalBody}>
                    <p style={{ color: '#475569', fontSize: '0.95rem', margin: '0.5rem 0' }}>
                        Are you sure you want to permanently delete this downtime record? This action cannot be undone.
                    </p>
                </div>
                <div className={styles.modalFooter} style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button className={styles.secondaryButton} onClick={onCancel} disabled={deleting}>
                        Cancel
                    </button>
                    <button className={styles.deleteBtn} style={{ padding: '8px 16px', fontSize: '0.875rem' }} onClick={onConfirm} disabled={deleting}>
                        {deleting ? 'Deleting...' : 'Yes, Delete Record'}
                    </button>
                </div>
            </div>
        </div>
    );
};
