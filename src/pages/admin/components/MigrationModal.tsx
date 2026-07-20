import React, { useState } from 'react';
import styles from '../AdminPanel.module.css';

interface MigrationModalProps {
    isOpen: boolean;
    customUsers: any[];
    departments: any[];
    onMigrate: (customUsers: any[], departments: any[]) => Promise<void>;
    onClose: () => void;
}

export const MigrationModal: React.FC<MigrationModalProps> = ({
    isOpen,
    customUsers,
    departments,
    onMigrate,
    onClose
}) => {
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    if (!isOpen) return null;

    const handleConfirm = async () => {
        try {
            setSubmitting(true);
            setErrorMsg('');
            await onMigrate(customUsers, departments);
            onClose();
        } catch (err: any) {
            setErrorMsg(err.message || 'Migration failed');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalContent} style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h3 className={styles.modalTitle}>⚡ Migrate Browser Local Storage Data</h3>
                    <button className={styles.closeBtn} onClick={onClose}>&times;</button>
                </div>
                <div className={styles.modalBody}>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '1rem', lineHeight: 1.5 }}>
                        The system detected custom users and departments stored in your browser's local storage. Transferring this data into the PostgreSQL database ensures multi-session syncing, security hashing, and server persistence.
                    </p>

                    {errorMsg && (
                        <div style={{ padding: '0.65rem 0.85rem', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                            ⚠️ {errorMsg}
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                        <div style={{ padding: '0.85rem', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>👤 Custom Users ({customUsers.length})</div>
                            <ul style={{ paddingLeft: '1.2rem', marginTop: '0.4rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                {customUsers.map((u, i) => (
                                    <li key={i}>{u.name || u.email} ({u.role || 'User'})</li>
                                ))}
                            </ul>
                        </div>

                        <div style={{ padding: '0.85rem', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>📁 Departments ({departments.length})</div>
                            <ul style={{ paddingLeft: '1.2rem', marginTop: '0.4rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                {departments.map((d, i) => (
                                    <li key={i}>{d.name} ({d.users?.length || 0} users)</li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    <div style={{ fontSize: '0.82rem', color: '#8c4b00', backgroundColor: '#fff8e6', border: '1px solid #ffe0b2', padding: '0.65rem 0.85rem', borderRadius: '6px' }}>
                        💡 <strong>Safe Migration guarantee:</strong> Existing database records will not be overwritten. Unhashed passwords will automatically be hashed with bcrypt. Local storage will only be cleared after server confirmation.
                    </div>
                </div>
                <div className={styles.modalFooter}>
                    <button className={styles.pageBtn} onClick={onClose} disabled={submitting}>
                        Cancel
                    </button>
                    <button className={styles.migrationBtn} onClick={handleConfirm} disabled={submitting}>
                        {submitting ? 'Migrating Data...' : 'Confirm & Migrate to Database'}
                    </button>
                </div>
            </div>
        </div>
    );
};
