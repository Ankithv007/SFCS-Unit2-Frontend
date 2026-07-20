import React from 'react';
import styles from '../AdminPanel.module.css';
import type { AuditLogItem } from '../services/adminService';
import { TableSkeleton } from './TableSkeleton';

interface AuditLogsTabProps {
    logs: AuditLogItem[];
    totalLogs: number;
    page: number;
    limit: number;
    totalPages: number;
    loading: boolean;
    searchQuery: string;
    actionFilter: string;
    startDate: string;
    endDate: string;
    onSearchChange: (q: string) => void;
    onActionChange: (act: string) => void;
    onStartDateChange: (d: string) => void;
    onEndDateChange: (d: string) => void;
    onPageChange: (p: number) => void;
    onLimitChange: (l: number) => void;
    onViewDetail: (log: AuditLogItem) => void;
}

export const AuditLogsTab: React.FC<AuditLogsTabProps> = ({
    logs,
    totalLogs,
    page,
    limit,
    totalPages,
    loading,
    searchQuery,
    actionFilter,
    startDate,
    endDate,
    onSearchChange,
    onActionChange,
    onStartDateChange,
    onEndDateChange,
    onPageChange,
    onLimitChange,
    onViewDetail
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
                            placeholder="Search Action, Admin Name, Target ID..."
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                        />
                    </div>

                    <select
                        className={styles.selectInput}
                        value={actionFilter}
                        onChange={(e) => onActionChange(e.target.value)}
                    >
                        <option value="ALL">All Actions</option>
                        <option value="USER_CREATED">USER_CREATED</option>
                        <option value="USER_UPDATED">USER_UPDATED</option>
                        <option value="USER_SOFT_DELETED">USER_SOFT_DELETED</option>
                        <option value="USER_RESTORED">USER_RESTORED</option>
                        <option value="DEPARTMENT_CREATED">DEPARTMENT_CREATED</option>
                        <option value="DEPARTMENT_UPDATED">DEPARTMENT_UPDATED</option>
                        <option value="DEPARTMENT_DELETED">DEPARTMENT_DELETED</option>
                        <option value="PASSWORD_RESET_BY_ADMIN">PASSWORD_RESET_BY_ADMIN</option>
                        <option value="LEGACY_DATA_MIGRATED">LEGACY_DATA_MIGRATED</option>
                    </select>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem' }}>
                        <span>From:</span>
                        <input
                            type="date"
                            className={styles.selectInput}
                            value={startDate}
                            onChange={(e) => onStartDateChange(e.target.value)}
                        />
                        <span>To:</span>
                        <input
                            type="date"
                            className={styles.selectInput}
                            value={endDate}
                            onChange={(e) => onEndDateChange(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Table or Skeleton */}
            {loading ? (
                <TableSkeleton rows={7} />
            ) : logs.length === 0 ? (
                <div className={styles.tableContainer}>
                    <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>📜</div>
                        <div className={styles.emptyTitle}>No Audit Logs Found</div>
                        <p style={{ fontSize: '0.85rem' }}>No audit events match your search or date range filters.</p>
                    </div>
                </div>
            ) : (
                <div className={styles.tableContainer}>
                    <table className={styles.dataTable}>
                        <thead>
                            <tr>
                                <th>Log ID</th>
                                <th>Action</th>
                                <th>Performed By</th>
                                <th>Target</th>
                                <th>IP Address</th>
                                <th>Timestamp</th>
                                <th style={{ textAlign: 'right' }}>Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((log) => (
                                <tr key={log.id}>
                                    <td>
                                        <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>
                                            #{log.id}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`${styles.badge} ${
                                            log.action.includes('CREATED') ? styles.badgeActive :
                                            log.action.includes('DELETED') ? styles.badgeDeleted :
                                            styles.roleManager
                                        }`}>
                                            {log.action}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>{log.performer_name || 'System'}</div>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{log.performer_email || '—'}</div>
                                    </td>
                                    <td>
                                        <span style={{ fontSize: '0.82rem' }}>
                                            {log.target_type} {log.target_id ? `(#${log.target_id})` : ''}
                                        </span>
                                    </td>
                                    <td>
                                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                                            {log.ip_address || 'Internal'}
                                        </span>
                                    </td>
                                    <td>
                                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                            {new Date(log.created_at).toLocaleString()}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <button
                                            className={`${styles.iconBtn} ${styles.iconBtnPrimary}`}
                                            onClick={() => onViewDetail(log)}
                                            title="Inspect JSON Differences & Details"
                                        >
                                            📜 JSON Diff
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Pagination Footer */}
                    <div className={styles.paginationBar}>
                        <div>
                            Showing <strong>{logs.length}</strong> of <strong>{totalLogs}</strong> audit logs
                        </div>
                        <div className={styles.pageControls}>
                            <label style={{ marginRight: '0.5rem', fontSize: '0.82rem' }}>Per page:</label>
                            <select
                                className={styles.selectInput}
                                style={{ padding: '0.2rem 0.4rem', marginRight: '0.75rem' }}
                                value={limit}
                                onChange={(e) => onLimitChange(parseInt(e.target.value))}
                            >
                                <option value={15}>15</option>
                                <option value={30}>30</option>
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
