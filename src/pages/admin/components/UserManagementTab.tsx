import React from 'react';
import styles from '../AdminPanel.module.css';
import type { AdminUser, AdminDepartment } from '../services/adminService';
import { TableSkeleton } from './TableSkeleton';

interface UserManagementTabProps {
    users: AdminUser[];
    totalUsers: number;
    page: number;
    limit: number;
    totalPages: number;
    loading: boolean;
    departments: AdminDepartment[];
    searchQuery: string;
    roleFilter: string;
    statusFilter: string;
    includeDeleted: boolean;
    onSearchChange: (q: string) => void;
    onRoleChange: (r: string) => void;
    onStatusChange: (s: string) => void;
    onIncludeDeletedToggle: (val: boolean) => void;
    onPageChange: (newPage: number) => void;
    onLimitChange: (newLimit: number) => void;
    onEditUser: (user: AdminUser) => void;
    onResetPassword: (user: AdminUser) => void;
    onToggleStatus: (user: AdminUser) => void;
    onRestoreUser: (user: AdminUser) => void;
    onDeleteUser: (user: AdminUser) => void;
}

export const UserManagementTab: React.FC<UserManagementTabProps> = ({
    users,
    totalUsers,
    page,
    limit,
    totalPages,
    loading,
    departments: _departments,
    searchQuery,
    roleFilter,
    statusFilter,
    includeDeleted,
    onSearchChange,
    onRoleChange,
    onStatusChange,
    onIncludeDeletedToggle,
    onPageChange,
    onLimitChange,
    onEditUser,
    onResetPassword,
    onToggleStatus,
    onRestoreUser,
    onDeleteUser
}) => {
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
                            placeholder="Search Name, Email, Employee Code..."
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                        />
                    </div>

                    <select
                        className={styles.selectInput}
                        value={roleFilter}
                        onChange={(e) => onRoleChange(e.target.value)}
                    >
                        <option value="ALL">All Roles</option>
                        <option value="Super Admin">Super Admin</option>
                        <option value="Admin">Admin</option>
                        <option value="Manager">Manager</option>
                        <option value="Supervisor">Supervisor</option>
                        <option value="Operator">Operator</option>
                        <option value="User">User</option>
                    </select>

                    <select
                        className={styles.selectInput}
                        value={statusFilter}
                        onChange={(e) => onStatusChange(e.target.value)}
                    >
                        <option value="ALL">All Statuses</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>

                    <label style={{ fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            className={styles.checkbox}
                            checked={includeDeleted}
                            onChange={(e) => onIncludeDeletedToggle(e.target.checked)}
                        />
                        Show Soft-Deleted Users
                    </label>
                </div>
            </div>

            {/* Table or Skeleton */}
            {loading ? (
                <TableSkeleton rows={6} />
            ) : users.length === 0 ? (
                <div className={styles.tableContainer}>
                    <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>👤</div>
                        <div className={styles.emptyTitle}>No Users Found</div>
                        <p style={{ fontSize: '0.85rem' }}>No user accounts matched your search or filter criteria.</p>
                    </div>
                </div>
            ) : (
                <div className={styles.tableContainer}>
                    <table className={styles.dataTable}>
                        <thead>
                            <tr>
                                <th>Employee Code</th>
                                <th>Name & Email</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Departments</th>
                                <th>Last Updated</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((user) => {
                                const isDeleted = !!user.deleted_at;
                                return (
                                    <tr key={user.id} className={isDeleted ? styles.trDeleted : ''}>
                                        <td>
                                            <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>
                                                {user.employee_code || '—'}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{user.name}</div>
                                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{user.email}</div>
                                        </td>
                                        <td>
                                            <span className={`${styles.badge} ${
                                                user.role === 'Super Admin' ? styles.roleSuperAdmin :
                                                user.role === 'Admin' ? styles.roleAdmin :
                                                user.role === 'Manager' ? styles.roleManager :
                                                user.role === 'Supervisor' ? styles.roleSupervisor :
                                                styles.roleUser
                                            }`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td>
                                            {isDeleted ? (
                                                <span className={`${styles.badge} ${styles.badgeDeleted}`}>Soft-Deleted</span>
                                            ) : (
                                                <span className={`${styles.badge} ${user.status === 'active' ? styles.badgeActive : styles.badgeInactive}`}>
                                                    {user.status === 'active' ? '🟢 Active' : '🔴 Inactive'}
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            {(!user.departments || user.departments.length === 0) ? (
                                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>None</span>
                                            ) : (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                                                    {user.departments.map((d) => (
                                                        <span key={d.id} style={{ fontSize: '0.72rem', backgroundColor: '#e2e8f0', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                                                            {d.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                                {user.updated_at ? new Date(user.updated_at).toLocaleDateString() : '—'}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div className={styles.actionCell} style={{ justifyContent: 'flex-end' }}>
                                                {!isDeleted ? (
                                                    <>
                                                        <button
                                                            className={`${styles.iconBtn} ${styles.iconBtnPrimary}`}
                                                            onClick={() => onEditUser(user)}
                                                            title="Edit User Details"
                                                        >
                                                            ✏️
                                                        </button>
                                                        <button
                                                            className={styles.iconBtn}
                                                            onClick={() => onResetPassword(user)}
                                                            title="Reset User Password"
                                                        >
                                                            🔑
                                                        </button>
                                                        <button
                                                            className={styles.iconBtn}
                                                            onClick={() => onToggleStatus(user)}
                                                            title={user.status === 'active' ? 'Deactivate User Account' : 'Activate User Account'}
                                                        >
                                                            {user.status === 'active' ? '🔴' : '🟢'}
                                                        </button>
                                                        <button
                                                            className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                                                            onClick={() => onDeleteUser(user)}
                                                            title="Soft-Delete Account"
                                                        >
                                                            🗑️
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        className={`${styles.iconBtn} ${styles.iconBtnSuccess}`}
                                                        onClick={() => onRestoreUser(user)}
                                                        title="Restore Soft-Deleted Account"
                                                    >
                                                        ↩️ Restore
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {/* Pagination Footer */}
                    <div className={styles.paginationBar}>
                        <div>
                            Showing <strong>{users.length}</strong> of <strong>{totalUsers}</strong> users
                        </div>
                        <div className={styles.pageControls}>
                            <label style={{ marginRight: '0.5rem', fontSize: '0.82rem' }}>Per page:</label>
                            <select
                                className={styles.selectInput}
                                style={{ padding: '0.2rem 0.4rem', marginRight: '0.75rem' }}
                                value={limit}
                                onChange={(e) => onLimitChange(parseInt(e.target.value))}
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                            </select>

                            <button
                                className={styles.pageBtn}
                                disabled={page <= 1}
                                onClick={() => onPageChange(page - 1)}
                            >
                                ← Prev
                            </button>
                            <span style={{ margin: '0 0.5rem', fontWeight: 600 }}>
                                Page {page} of {totalPages || 1}
                            </span>
                            <button
                                className={styles.pageBtn}
                                disabled={page >= totalPages}
                                onClick={() => onPageChange(page + 1)}
                            >
                                Next →
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
