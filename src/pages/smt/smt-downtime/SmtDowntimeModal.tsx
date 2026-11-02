import React from 'react';
import styles from './SmtDowntimeTracker.module.css';
import type { DowntimeRecord } from './smtDowntime.types';

interface SmtDowntimeModalProps {
    record: DowntimeRecord | null;
    onClose: () => void;
}

export const SmtDowntimeModal: React.FC<SmtDowntimeModalProps> = ({ record, onClose }) => {
    if (!record) return null;

    const formatDateTime = (isoString?: string) => {
        if (!isoString) return '—';
        const d = new Date(isoString);
        return d.toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h3>🔍 Downtime Incident Details</h3>
                    <button className={styles.modalCloseBtn} onClick={onClose}>&times;</button>
                </div>
                <div className={styles.modalBody}>
                    <div className={styles.detailGrid}>
                        <div>
                            <strong>Shift:</strong> {record.shift}
                        </div>
                        <div>
                            <strong>Line:</strong> {record.line}
                        </div>
                        <div>
                            <strong>Machine:</strong> {record.machine_name}
                        </div>
                        <div>
                            <strong>Category:</strong> {record.downtime_category}
                        </div>
                        <div>
                            <strong>Start Time:</strong> {formatDateTime(record.start_time)}
                        </div>
                        <div>
                            <strong>End Time:</strong> {formatDateTime(record.end_time)}
                        </div>
                        <div>
                            <strong>Duration:</strong> {Number(record.duration).toFixed(1)} Minutes
                        </div>
                        <div>
                            <strong>Responsible:</strong> {record.responsible_person}
                        </div>
                        <div>
                            <strong>Logged By:</strong> {record.created_by_name || record.created_by || 'System User'}
                        </div>
                    </div>

                    {record.work_order_id && (
                        <div style={{ marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                            <strong style={{ color: '#1e3a5f', fontSize: '0.95rem', display: 'block', marginBottom: '0.5rem' }}>📋 Linked Work Order Details</strong>
                            <div className={styles.detailGrid} style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', fontSize: '0.9rem' }}>
                                <div><strong>Work Order ID:</strong> {record.work_order_id}</div>
                                <div><strong>PO ID:</strong> {record.po_id || '—'}</div>
                                <div><strong>Product Name:</strong> {record.product_name || '—'}</div>
                                <div><strong>Number of Sides:</strong> {record.work_order_sides || '—'}</div>
                                <div><strong>Quantity:</strong> {record.work_order_quantity || '—'}</div>
                                <div><strong>Panel Quantity:</strong> {record.panel_quantity || '—'}</div>
                                <div style={{ gridColumn: 'span 2' }}><strong>Product Description:</strong> {record.product_description || '—'}</div>
                            </div>
                        </div>
                    )}

                    <div style={{ marginTop: '1rem' }}>
                        <strong>Description:</strong>
                        <p style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', marginTop: '0.25rem', color: '#334155' }}>
                            {record.downtime_description}
                        </p>
                    </div>

                    <div style={{ marginTop: '0.75rem' }}>
                        <strong>Action Taken:</strong>
                        <p style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', marginTop: '0.25rem', color: '#334155' }}>
                            {record.action_taken}
                        </p>
                    </div>

                    {record.remarks && (
                        <div style={{ marginTop: '0.75rem' }}>
                            <strong>Remarks:</strong>
                            <p style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', marginTop: '0.25rem', color: '#334155' }}>
                                {record.remarks}
                            </p>
                        </div>
                    )}
                </div>
                <div className={styles.modalFooter}>
                    <button className={styles.button} onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};
