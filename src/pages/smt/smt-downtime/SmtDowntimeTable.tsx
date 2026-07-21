import React from 'react';
import type { DowntimeRecord } from './smtDowntime.types';
import styles from './SmtDowntimeTracker.module.css';

interface SmtDowntimeTableProps {
    records: DowntimeRecord[];
    search: string;
    onSearchChange: (value: string) => void;
    sortBy: string;
    sortOrder: 'ASC' | 'DESC';
    onSort: (field: string) => void;
    page: number;
    totalPages: number;
    totalRecords: number;
    onPageChange: (newPage: number) => void;
    loading: boolean;
    onView: (record: DowntimeRecord) => void;
    onEdit: (record: DowntimeRecord) => void;
    onDelete: (id?: string) => void;
}

export const SmtDowntimeTable: React.FC<SmtDowntimeTableProps> = ({
    records,
    search,
    onSearchChange,
    sortBy,
    sortOrder,
    onSort,
    page,
    totalPages,
    totalRecords,
    onPageChange,
    loading,
    onView,
    onEdit,
    onDelete
}) => {
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
        <div className={styles.card}>
            <div className={styles.tableHeaderRow}>
                <div>
                    <h3 className={styles.tableTitle}>📋 SMT Downtime Records Log</h3>
                    <span className={styles.tableSubTitle}>Total {totalRecords} incidents recorded</span>
                </div>
                <div className={styles.tableSearchWrapper}>
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className={styles.searchInput}
                        placeholder="Search by Machine, Shift, Line, Category..."
                    />
                    {search && (
                        <button onClick={() => onSearchChange('')} className={styles.searchClearBtn} title="Clear search">
                            ✕
                        </button>
                    )}
                </div>
            </div>

            <div className={styles.tableScrollContainer}>
                {loading ? (
                    <div className={styles.tableLoadingState}>
                        <span className={styles.spinner} /> Loading incident records...
                    </div>
                ) : (
                    <table className={styles.table}>
                        <thead className={styles.stickyThead}>
                            <tr>
                                <th style={{ width: '50px' }}>#</th>
                                <th onClick={() => onSort('shift')} className={styles.sortableHeader}>
                                    Shift {sortBy === 'shift' ? (sortOrder === 'ASC' ? '▲' : '▼') : ''}
                                </th>
                                <th onClick={() => onSort('line')} className={styles.sortableHeader}>
                                    Line {sortBy === 'line' ? (sortOrder === 'ASC' ? '▲' : '▼') : ''}
                                </th>
                                <th onClick={() => onSort('machine_name')} className={styles.sortableHeader}>
                                    Machine {sortBy === 'machine_name' ? (sortOrder === 'ASC' ? '▲' : '▼') : ''}
                                </th>
                                <th onClick={() => onSort('downtime_category')} className={styles.sortableHeader}>
                                    Category {sortBy === 'downtime_category' ? (sortOrder === 'ASC' ? '▲' : '▼') : ''}
                                </th>
                                <th onClick={() => onSort('start_time')} className={styles.sortableHeader}>
                                    Start Time {sortBy === 'start_time' ? (sortOrder === 'ASC' ? '▲' : '▼') : ''}
                                </th>
                                <th onClick={() => onSort('end_time')} className={styles.sortableHeader}>
                                    End Time {sortBy === 'end_time' ? (sortOrder === 'ASC' ? '▲' : '▼') : ''}
                                </th>
                                <th onClick={() => onSort('duration')} className={styles.sortableHeader}>
                                    Duration {sortBy === 'duration' ? (sortOrder === 'ASC' ? '▲' : '▼') : ''}
                                </th>
                                <th onClick={() => onSort('responsible_person')} className={styles.sortableHeader}>
                                    Responsible {sortBy === 'responsible_person' ? (sortOrder === 'ASC' ? '▲' : '▼') : ''}
                                </th>
                                <th style={{ textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {records.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className={styles.tableEmptyRow}>
                                        No downtime logs found matching current search criteria.
                                    </td>
                                </tr>
                            ) : (
                                records.map((record, index) => {
                                    const dur = Number(record.duration) || 0;
                                    return (
                                        <tr key={record.id || index} className={styles.tableRow}>
                                            <td className={styles.indexCell}>{(page - 1) * 10 + index + 1}</td>
                                            <td className={styles.fontMedium}>{record.shift}</td>
                                            <td>{record.line}</td>
                                            <td className={styles.machineCell}>{record.machine_name}</td>
                                            <td>
                                                <span className={`${styles.categoryBadge} ${record.downtime_category === 'Planned' ? styles.catPlanned : styles.catUnplanned}`}>
                                                    {record.downtime_category}
                                                </span>
                                            </td>
                                            <td className={styles.timeCell}>{formatDateTime(record.start_time)}</td>
                                            <td className={styles.timeCell}>{formatDateTime(record.end_time)}</td>
                                            <td>
                                                <span className={`${styles.durationBadge} ${dur > 60 ? styles.durHigh : (dur > 30 ? styles.durMed : styles.durLow)}`}>
                                                    {dur.toFixed(1)} mins
                                                </span>
                                            </td>
                                            <td className={styles.fontMedium}>{record.responsible_person}</td>
                                            <td className={styles.actionCell}>
                                                <button onClick={() => onView(record)} className={styles.actionBtnView} title="View Details">
                                                    👁 View
                                                </button>
                                                <button onClick={() => onEdit(record)} className={styles.actionBtnEdit} title="Edit Incident">
                                                    ✏ Edit
                                                </button>
                                                <button onClick={() => onDelete(record.id)} className={styles.actionBtnDelete} title="Delete Record">
                                                    🗑 Delete
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {totalPages > 1 && (
                <div className={styles.paginationRow}>
                    <span className={styles.paginationInfo}>
                        Showing Page {page} of {totalPages} ({totalRecords} records)
                    </span>
                    <div className={styles.paginationButtons}>
                        <button
                            onClick={() => onPageChange(Math.max(page - 1, 1))}
                            disabled={page === 1}
                            className={styles.paginationBtn}
                        >
                            ◀ Prev
                        </button>
                        {Array.from({ length: totalPages }).map((_, idx) => (
                            <button
                                key={idx}
                                onClick={() => onPageChange(idx + 1)}
                                className={`${styles.paginationBtn} ${page === idx + 1 ? styles.activePage : ''}`}
                            >
                                {idx + 1}
                            </button>
                        ))}
                        <button
                            onClick={() => onPageChange(Math.min(page + 1, totalPages))}
                            disabled={page === totalPages}
                            className={styles.paginationBtn}
                        >
                            Next ▶
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
