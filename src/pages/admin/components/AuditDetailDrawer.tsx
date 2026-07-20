import React from 'react';
import styles from '../AdminPanel.module.css';
import type { AuditLogItem } from '../services/adminService';

interface AuditDetailDrawerProps {
    isOpen: boolean;
    log: AuditLogItem | null;
    onClose: () => void;
}

export const AuditDetailDrawer: React.FC<AuditDetailDrawerProps> = ({
    isOpen,
    log,
    onClose
}) => {
    if (!isOpen || !log) return null;

    return (
        <div className={styles.drawerOverlay} onClick={onClose}>
            <div className={styles.drawerContent} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <div>
                        <h3 className={styles.modalTitle}>📜 Audit Event Details</h3>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Log ID #{log.id}</div>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>&times;</button>
                </div>
                <div className={styles.modalBody} style={{ gap: '1rem', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
                        <div>
                            <span className={styles.formLabel}>Action:</span>
                            <div style={{ fontWeight: 600, color: 'var(--primary-color)' }}>{log.action}</div>
                        </div>
                        <div>
                            <span className={styles.formLabel}>Performed By:</span>
                            <div style={{ fontWeight: 600 }}>{log.performer_name || 'System'} ({log.performer_email || '—'})</div>
                        </div>
                        <div>
                            <span className={styles.formLabel}>Target:</span>
                            <div>{log.target_type} {log.target_id ? `(#${log.target_id})` : ''}</div>
                        </div>
                        <div>
                            <span className={styles.formLabel}>Timestamp:</span>
                            <div>{new Date(log.created_at).toLocaleString()}</div>
                        </div>
                        <div>
                            <span className={styles.formLabel}>IP Address:</span>
                            <div>{log.ip_address || 'Internal / N/A'}</div>
                        </div>
                        <div>
                            <span className={styles.formLabel}>Status:</span>
                            <div>{log.success ? '✅ Success' : `❌ Failed (${log.error_message || ''})`}</div>
                        </div>
                    </div>

                    {log.old_values && (
                        <div>
                            <div className={styles.formLabel} style={{ marginBottom: '0.35rem' }}>Before (Old Values):</div>
                            <pre className={styles.jsonBox}>
                                {JSON.stringify(log.old_values, null, 2)}
                            </pre>
                        </div>
                    )}

                    {log.new_values && (
                        <div>
                            <div className={styles.formLabel} style={{ marginBottom: '0.35rem' }}>After (New Values):</div>
                            <pre className={styles.jsonBox}>
                                {JSON.stringify(log.new_values, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
                <div className={styles.modalFooter}>
                    <button className={styles.primaryActionBtn} onClick={onClose}>
                        Close Drawer
                    </button>
                </div>
            </div>
        </div>
    );
};
