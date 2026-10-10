import React, { useState, useMemo, useEffect } from 'react';
import { X, Search, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import styles from './CountDetailsModal.module.css';
import type { PreviousStageUnit } from '../hooks/usePreviousStagePassed';

interface PreviousStagePassedModalProps {
    isOpen: boolean;
    onClose: () => void;
    units: PreviousStageUnit[];
    count: number;
    workOrderId: string;
    side: string;
    currentStage?: string;
    previousStage?: string;
    loading?: boolean;
}

export const PreviousStagePassedModal: React.FC<PreviousStagePassedModalProps> = ({
    isOpen,
    onClose,
    units,
    count,
    workOrderId,
    side,
    previousStage = 'Previous Stage',
    loading = false
}) => {
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const limit = 10;

    // Reset to page 1 whenever the units array is refreshed (avoids stale empty pages)
    useEffect(() => {
        setPage(1);
    }, [units]);

    const filteredUnits = useMemo(() => {
        if (!search.trim()) return units;
        const q = search.trim().toLowerCase();
        return units.filter(u =>
            (u.serial_number && u.serial_number.toLowerCase().includes(q)) ||
            (u.scanned_by && u.scanned_by.toLowerCase().includes(q)) ||
            (u.current_stage && u.current_stage.toLowerCase().includes(q)) ||
            (u.previous_stage && u.previous_stage.toLowerCase().includes(q)) ||
            (u.side && u.side.toLowerCase().includes(q)) ||
            (u.status && u.status.toLowerCase().includes(q))
        );
    }, [units, search]);

    const totalPages = Math.max(1, Math.ceil(filteredUnits.length / limit));
    const paginatedUnits = useMemo(() => {
        const start = (page - 1) * limit;
        return filteredUnits.slice(start, start + limit);
    }, [filteredUnits, page, limit]);

    if (!isOpen) return null;

    const formatDateTime = (dateStr: string | null | undefined) => {
        if (!dateStr) return '—';
        try {
            return new Date(dateStr).toLocaleString('en-IN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });
        } catch {
            return dateStr;
        }
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                {/* Modal Header */}
                <div className={styles.modalHeader}>
                    <div>
                        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            Pending at Current Stage Units
                            {loading ? (
                                <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', color: '#6d28d9' }} />
                            ) : (
                                <span style={{ color: '#6d28d9' }}>({units.length})</span>
                            )}
                        </h2>
                        <p>
                            Work Order: <strong>{workOrderId}</strong> &nbsp;|&nbsp; 
                            Side: <strong>{side}</strong>
                            {!loading && count !== units.length && count > 0 && (
                                <span style={{ marginLeft: '8px', fontSize: '0.78rem', color: '#92400e', background: '#fef3c7', padding: '1px 6px', borderRadius: '4px' }}>
                                    Syncing…
                                </span>
                            )}
                        </p>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose} title="Close Modal">
                        <X size={20} />
                    </button>
                </div>

                {/* Search Bar */}
                <div className={styles.searchBarWrapper}>
                    <div className={styles.searchContainer}>
                        <Search size={18} className={styles.searchIcon} />
                        <input
                            type="text"
                            className={styles.searchInput}
                            placeholder="Search by serial number, scanned by, status..."
                            value={search}
                            onChange={e => {
                                setSearch(e.target.value);
                                setPage(1);
                            }}
                        />
                        {search && (
                            <button
                                className={styles.clearSearchBtn}
                                onClick={() => {
                                    setSearch('');
                                    setPage(1);
                                }}
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Modal Body & Table */}
                <div className={styles.modalBody}>
                    <div className={styles.tableWrapper}>
                        <table className={styles.detailsTable}>
                            <thead>
                                <tr>
                                    <th style={{ width: '60px' }}>#</th>
                                    <th>Serial Number / Unit Serial Number</th>
                                    <th>Side</th>
                                    <th>Current Stage</th>
                                    <th>Previous Stage</th>
                                    <th>Status</th>
                                    <th>Scanned By</th>
                                    <th>Scanned At</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedUnits.map((unit, idx) => {
                                    const rowNum = (page - 1) * limit + idx + 1;
                                    return (
                                        <tr key={unit.id || `${unit.serial_number}-${idx}`}>
                                            <td style={{ fontWeight: 600, color: '#64748b' }}>{rowNum}</td>
                                            <td>
                                                <div className={styles.barcodeCell}>
                                                    <span className={styles.barcodeText}>{unit.serial_number}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span style={{ fontWeight: 600, color: '#334155' }}>
                                                    {unit.side}
                                                </span>
                                            </td>
                                            <td>
                                                <span style={{ 
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    padding: '2px 8px',
                                                    borderRadius: '6px',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 600,
                                                    backgroundColor: '#e0f2fe',
                                                    color: '#0369a1'
                                                }}>
                                                    {unit.current_stage || '—'}
                                                </span>
                                            </td>
                                            <td>
                                                <span style={{ 
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    padding: '2px 8px',
                                                    borderRadius: '6px',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 600,
                                                    backgroundColor: '#ede9fe',
                                                    color: '#6d28d9'
                                                }}>
                                                    {unit.previous_stage || '—'}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={styles.statusPassed} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                    <CheckCircle2 size={13} />
                                                    {unit.status}
                                                </span>
                                            </td>
                                            <td className={styles.userCell}>{unit.scanned_by || '—'}</td>
                                            <td className={styles.dateCell}>{formatDateTime(unit.scanned_at)}</td>
                                        </tr>
                                    );
                                })}

                                {paginatedUnits.length === 0 && (
                                    <tr>
                                        <td colSpan={8} style={{ textAlign: 'center', padding: '3rem 1.5rem', color: '#64748b' }}>
                                            {loading ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                                                    <span>Loading pending units...</span>
                                                </div>
                                            ) : search ? (
                                                <div>No matching units found for &quot;{search}&quot;.</div>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                                                    <AlertCircle size={28} style={{ color: '#94a3b8' }} />
                                                    <span>No units from previous stage (<strong>{previousStage}</strong>) are currently pending at this stage for Work Order <strong>{workOrderId}</strong> on side <strong>{side}</strong>.</span>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Modal Footer / Pagination */}
                <div className={styles.modalFooter}>
                    <div className={styles.totalRecords}>
                        Showing {filteredUnits.length === 0 ? 0 : (page - 1) * limit + 1} to {Math.min(page * limit, filteredUnits.length)} of {filteredUnits.length} units
                        {search.trim() && filteredUnits.length !== units.length && ` (filtered from ${units.length} total)`}
                    </div>

                    <div className={styles.paginationControls}>
                        <button
                            className={styles.pageBtn}
                            disabled={page <= 1}
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                        >
                            Previous
                        </button>
                        <span className={styles.pageIndicator}>
                            Page {page} of {totalPages}
                        </span>
                        <button
                            className={styles.pageBtn}
                            disabled={page >= totalPages}
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PreviousStagePassedModal;
