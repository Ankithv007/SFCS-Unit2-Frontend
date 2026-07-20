import React from 'react';
import styles from '../AdminPanel.module.css';
import type { AdminDepartment } from '../services/adminService';

interface DepartmentViewModalProps {
    isOpen: boolean;
    department: AdminDepartment | null;
    onClose: () => void;
}

export const DepartmentViewModal: React.FC<DepartmentViewModalProps> = ({
    isOpen,
    department,
    onClose
}) => {
    if (!isOpen || !department) return null;

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalContent} style={{ maxWidth: '750px' }} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <div>
                        <h3 className={styles.modalTitle}>📂 {department.name}</h3>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0 0' }}>
                            {department.description || 'No description available'}
                        </p>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>&times;</button>
                </div>
                <div className={styles.modalBody}>
                    {/* Assigned Members Section */}
                    <div style={{ marginBottom: '1.25rem' }}>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                            👥 Department Members ({department.users?.length || 0})
                        </h4>
                        {(!department.users || department.users.length === 0) ? (
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                No users currently assigned to this department.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                {department.users.map((u) => (
                                    <div
                                        key={u.user_id}
                                        style={{
                                            padding: '0.4rem 0.75rem',
                                            backgroundColor: 'var(--bg-main)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '6px',
                                            fontSize: '0.82rem'
                                        }}
                                    >
                                        <span style={{ fontWeight: 600 }}>{u.name}</span>
                                        <span style={{ color: 'var(--text-secondary)', marginLeft: '0.35rem' }}>({u.email})</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Permissions Section */}
                    <div>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                            🔐 Page Permission Matrix ({department.permissions?.length || 0} pages configured)
                        </h4>
                        {(!department.permissions || department.permissions.length === 0) ? (
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                No permissions configured.
                            </div>
                        ) : (
                            <div className={styles.tableContainer} style={{ maxHeight: '280px' }}>
                                <table className={styles.dataTable}>
                                    <thead>
                                        <tr>
                                            <th>Page / Path</th>
                                            <th>View</th>
                                            <th>Create</th>
                                            <th>Edit</th>
                                            <th>Delete</th>
                                            <th>Export</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {department.permissions.map((p, idx) => (
                                            <tr key={idx}>
                                                <td>
                                                    <div style={{ fontWeight: 600 }}>{p.page}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{p.module}</div>
                                                </td>
                                                <td>{p.can_view ? '✅' : '❌'}</td>
                                                <td>{p.can_create ? '✅' : '❌'}</td>
                                                <td>{p.can_edit ? '✅' : '❌'}</td>
                                                <td>{p.can_delete ? '✅' : '❌'}</td>
                                                <td>{p.can_export ? '✅' : '❌'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
                <div className={styles.modalFooter}>
                    <button className={styles.primaryActionBtn} onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
