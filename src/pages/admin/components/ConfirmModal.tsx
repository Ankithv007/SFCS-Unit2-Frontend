import React from 'react';
import styles from '../AdminPanel.module.css';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isDanger = false,
    onConfirm,
    onCancel
}) => {
    if (!isOpen) return null;

    return (
        <div className={styles.modalOverlay} onClick={onCancel}>
            <div className={styles.modalContent} style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h3 className={styles.modalTitle} style={{ color: isDanger ? '#dc3545' : 'inherit' }}>
                        {isDanger ? '⚠️ ' : ''}{title}
                    </h3>
                    <button className={styles.closeBtn} onClick={onCancel}>&times;</button>
                </div>
                <div className={styles.modalBody}>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.5, margin: 0 }}>
                        {message}
                    </p>
                </div>
                <div className={styles.modalFooter}>
                    <button
                        className={styles.pageBtn}
                        onClick={onCancel}
                    >
                        {cancelText}
                    </button>
                    <button
                        className={styles.primaryActionBtn}
                        style={{
                            backgroundColor: isDanger ? '#dc3545' : 'var(--primary-color)',
                            borderColor: isDanger ? '#dc3545' : 'var(--primary-color)'
                        }}
                        onClick={onConfirm}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};
