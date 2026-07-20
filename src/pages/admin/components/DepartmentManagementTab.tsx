import React, { useState } from 'react';
import styles from '../AdminPanel.module.css';
import type { AdminDepartment } from '../services/adminService';
import { TableSkeleton } from './TableSkeleton';

interface DepartmentManagementTabProps {
    departments: AdminDepartment[];
    loading: boolean;
    onViewDepartment: (dept: AdminDepartment) => void;
    onEditDepartment: (dept: AdminDepartment) => void;
    onDeleteDepartment: (dept: AdminDepartment) => void;
}

export const DepartmentManagementTab: React.FC<DepartmentManagementTabProps> = ({
    departments,
    loading,
    onViewDepartment,
    onEditDepartment,
    onDeleteDepartment
}) => {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredDepts = departments.filter(d => 
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (d.description && d.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div>
            {/* Toolbar */}
            <div className={styles.toolbar}>
                <div className={styles.filterGroup}>
                    <div className={styles.searchInputWrapper}>
                        <span className={styles.searchIcon}>🔍</span>
                        <input
                            type="text"
                            className={styles.searchInput}
                            placeholder="Filter department names or descriptions..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Table or Skeleton */}
            {loading ? (
                <TableSkeleton rows={4} />
            ) : filteredDepts.length === 0 ? (
                <div className={styles.tableContainer}>
                    <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>📁</div>
                        <div className={styles.emptyTitle}>No Departments Found</div>
                        <p style={{ fontSize: '0.85rem' }}>No departments match your current filter.</p>
                    </div>
                </div>
            ) : (
                <div className={styles.tableContainer}>
                    <table className={styles.dataTable}>
                        <thead>
                            <tr>
                                <th>Department Name</th>
                                <th>Description</th>
                                <th>Assigned Members</th>
                                <th>Permission Matrix</th>
                                <th>Last Updated</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredDepts.map((dept) => (
                                <tr key={dept.id}>
                                    <td>
                                        <div style={{ fontWeight: 700, color: 'var(--primary-color)', fontSize: '0.92rem' }}>
                                            📁 {dept.name}
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                            {dept.description || 'No description provided'}
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`${styles.badge} ${styles.roleManager}`}>
                                            👥 {dept.users?.length || 0} Members
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`${styles.badge} ${styles.roleSupervisor}`}>
                                            🔐 {dept.permissions?.length || 0} Pages
                                        </span>
                                    </td>
                                    <td>
                                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                            {dept.updated_at ? new Date(dept.updated_at).toLocaleDateString() : '—'}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <div className={styles.actionCell} style={{ justifyContent: 'flex-end' }}>
                                            <button
                                                className={`${styles.iconBtn} ${styles.iconBtnPrimary}`}
                                                onClick={() => onViewDepartment(dept)}
                                                title="View Roster & Permissions"
                                            >
                                                👁️ View
                                            </button>
                                            <button
                                                className={styles.iconBtn}
                                                onClick={() => onEditDepartment(dept)}
                                                title="Edit Department & Permissions"
                                            >
                                                ✏️ Edit
                                            </button>
                                            <button
                                                className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                                                onClick={() => onDeleteDepartment(dept)}
                                                title="Delete Department"
                                            >
                                                🗑️ Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
