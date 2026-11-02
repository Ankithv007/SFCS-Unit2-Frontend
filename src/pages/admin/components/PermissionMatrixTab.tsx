import React, { useState } from 'react';
import styles from '../AdminPanel.module.css';
import type { AdminDepartment } from '../services/adminService';
import { TableSkeleton } from './TableSkeleton';

interface PermissionMatrixTabProps {
    departments: AdminDepartment[];
    loading: boolean;
}

export const PermissionMatrixTab: React.FC<PermissionMatrixTabProps> = ({
    departments,
    loading
}) => {
    const [selectedDeptId, setSelectedDeptId] = useState<number | 'ALL'>('ALL');

    if (loading) {
        return <TableSkeleton rows={5} />;
    }

    const displayedDepts = selectedDeptId === 'ALL'
        ? departments
        : departments.filter(d => d.id === selectedDeptId);

    return (
        <div>
            {/* Toolbar */}
            <div className={styles.toolbar}>
                <div className={styles.filterGroup}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Filter Department:</label>
                    <select
                        className={styles.selectInput}
                        value={selectedDeptId}
                        onChange={(e) => setSelectedDeptId(e.target.value === 'ALL' ? 'ALL' : parseInt(e.target.value))}
                    >
                        <option value="ALL">All Departments ({departments.length})</option>
                        {departments.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {displayedDepts.length === 0 ? (
                <div className={styles.tableContainer}>
                    <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>🔐</div>
                        <div className={styles.emptyTitle}>No Permissions Configured</div>
                        <p style={{ fontSize: '0.85rem' }}>Select a department or edit a department to configure permission matrix rules.</p>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {displayedDepts.map((dept) => (
                        <div key={dept.id} className={styles.tableContainer}>
                            <div style={{ padding: '0.85rem 1.15rem', backgroundColor: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                                    📁 {dept.name} — Permission Matrix
                                </div>
                                <span className={`${styles.badge} ${styles.roleSupervisor}`}>
                                    {dept.permissions?.length || 0} Configured Pages
                                </span>
                            </div>

                            {(!dept.permissions || dept.permissions.length === 0) ? (
                                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                    No page permissions assigned yet.
                                </div>
                            ) : (
                                <table className={styles.dataTable}>
                                    <thead>
                                        <tr>
                                            <th>Module</th>
                                            <th>Page / Route</th>
                                            <th style={{ textAlign: 'center' }}>View</th>
                                            <th style={{ textAlign: 'center' }}>Create</th>
                                            <th style={{ textAlign: 'center' }}>Edit</th>
                                            <th style={{ textAlign: 'center' }}>Delete</th>
                                            <th style={{ textAlign: 'center' }}>Export</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dept.permissions.map((p, pIdx) => (
                                            <tr key={pIdx}>
                                                <td>
                                                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                                                        {p.module || 'General'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                                        {p.page}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>{p.can_view ? '✅' : '❌'}</td>
                                                <td style={{ textAlign: 'center' }}>{p.can_create ? '✅' : '❌'}</td>
                                                <td style={{ textAlign: 'center' }}>{p.can_edit ? '✅' : '❌'}</td>
                                                <td style={{ textAlign: 'center' }}>{p.can_delete ? '✅' : '❌'}</td>
                                                <td style={{ textAlign: 'center' }}>{p.can_export ? '✅' : '❌'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
