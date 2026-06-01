import React, { useState, useEffect } from 'react';
import { X, Search, FileText, User, Calendar, AlertCircle } from 'lucide-react';
import styles from './CountDetailsModal.module.css';

interface SMTRecord {
    serial_number: string;
    status: string;
    scanned_by: string | null;
    scanned_at: string | null;
    rework_reason: string | null;
}

interface SMTCountDetailsModalProps {
    workOrderId: string;
    stage: string;
    type: string;
    label: string;
    onClose: () => void;
}

const SMTCountDetailsModal: React.FC<SMTCountDetailsModalProps> = ({
    workOrderId,
    stage,
    type,
    label,
    onClose
}) => {
    const [data, setData] = useState<SMTRecord[]>([]);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [limit] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchDetails = async (currentPage: number, searchVal: string) => {
        setLoading(true);
        setError(null);
        try {
            const url = new URL('/api/smt/track/count-details', window.location.origin);
            url.searchParams.set('workOrderId', workOrderId);
            url.searchParams.set('stage', stage);
            url.searchParams.set('type', type);
            url.searchParams.set('page', currentPage.toString());
            url.searchParams.set('limit', limit.toString());
            url.searchParams.set('search', searchVal);

            const res = await fetch(url.toString());
            const contentType = res.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                throw new Error('Server returned an unexpected non-JSON response (possibly Route/Gateway mismatch).');
            }

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to fetch details');
            }
            const response = await res.json();
            
            if (response) {
                setData(response.data || []);
                setTotalPages(Math.ceil((response.total || 0) / limit) || 1);
                setTotalRecords(response.total || 0);
            }
        } catch (err: any) {
            console.error('Error fetching SMT unit details:', err);
            setError(err.message || 'Failed to retrieve unit details.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const delayDebounce = setTimeout(() => {
            setPage(1);
            fetchDetails(1, search);
        }, 300);

        return () => clearTimeout(delayDebounce);
    }, [search, workOrderId, stage, type]);

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setPage(newPage);
            fetchDetails(newPage, search);
        }
    };

    const getStatusClass = (status: string = '') => {
        const s = status.toUpperCase();
        if (['PASS', 'PASSED', 'COMPLETED', 'REVALIDATED_PASS', 'PASSED RECHECK'].includes(s)) return styles.statusPassed;
        if (['REWORK', 'PENDING REPAIR', 'READY FOR RECHECK', 'READY_FOR_RECHECK', 'FAILED'].includes(s)) return styles.statusRework;
        if (['FAIL', 'FAILED_AGAIN', 'FAILED AGAIN'].includes(s)) return styles.statusDebug;
        return styles.statusPending;
    };

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
                {/* Header */}
                <div className={styles.modalHeader}>
                    <div>
                        <h2>Work Order: {workOrderId}</h2>
                        <p>{stage} - {label} ({totalRecords})</p>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>
                        <X size={22} />
                    </button>
                </div>

                {/* Search Bar */}
                <div className={styles.searchBarWrapper}>
                    <div className={styles.searchContainer}>
                        <Search size={18} className={styles.searchIcon} />
                        <input
                            type="text"
                            placeholder="Filter by Barcode..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className={styles.searchInput}
                            autoFocus
                        />
                        {search && (
                            <button className={styles.clearSearchBtn} onClick={() => setSearch('')}>
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Body */}
                <div className={styles.modalBody}>
                    {loading ? (
                        <div className={styles.loaderWrapper}>
                            <div className={styles.spinner}></div>
                            <p>Fetching SMT unit traceability logs...</p>
                        </div>
                    ) : error ? (
                        <div className={styles.errorWrapper}>
                            <AlertCircle size={40} className={styles.errorIcon} />
                            <h3>Failed to load details</h3>
                            <p>{error}</p>
                            <button className={styles.retryBtn} onClick={() => fetchDetails(page, search)}>
                                Retry
                            </button>
                        </div>
                    ) : data.length === 0 ? (
                        <div className={styles.emptyWrapper}>
                            <FileText size={48} className={styles.emptyIcon} />
                            <h3>No Records Found</h3>
                            <p>No units match the selected filters or criteria.</p>
                        </div>
                    ) : (
                        <div className={styles.tableWrapper}>
                            <table className={styles.detailsTable}>
                                <thead>
                                    <tr>
                                        <th>Barcode / Serial Number</th>
                                        <th>Process Stage</th>
                                        <th>Status</th>
                                        <th>Scan Date & Time</th>
                                        <th>Operator</th>
                                        <th>Remarks / Defect Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.map((record, index) => (
                                        <tr key={index}>
                                            <td>
                                                <div className={styles.barcodeCell}>
                                                    <span className={styles.barcodeText}>{record.serial_number}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={styles.stageBadge}>
                                                    {stage}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`${styles.statusBadge} ${getStatusClass(record.status)}`}>
                                                    {(record.status || 'PENDING').toUpperCase()}
                                                </span>
                                            </td>
                                            <td>
                                                <div className={styles.dateCell}>
                                                    <Calendar size={12} style={{ marginRight: '4px' }} />
                                                    {record.scanned_at ? new Date(record.scanned_at).toLocaleString() : 'N/A'}
                                                </div>
                                            </td>
                                            <td>
                                                <div className={styles.operatorCell}>
                                                    <User size={12} style={{ marginRight: '4px' }} />
                                                    {record.scanned_by || 'System'}
                                                </div>
                                            </td>
                                            <td>
                                                <div className={styles.remarksCell}>
                                                    <p className={styles.remarksText}>
                                                        {record.rework_reason || '-'}
                                                    </p>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {!loading && !error && totalRecords > 0 && (
                    <div className={styles.modalFooter}>
                        <div className={styles.recordsCount}>
                            Showing <strong>{((page - 1) * limit) + 1}</strong> to{' '}
                            <strong>{Math.min(page * limit, totalRecords)}</strong> of{' '}
                            <strong>{totalRecords}</strong> records
                        </div>
                        <div className={styles.paginationControls}>
                            <button
                                className={styles.paginationBtn}
                                onClick={() => handlePageChange(page - 1)}
                                disabled={page === 1}
                            >
                                Previous
                            </button>
                            <span className={styles.pageNumber}>
                                Page <strong>{page}</strong> of <strong>{totalPages}</strong>
                            </span>
                            <button
                                className={styles.paginationBtn}
                                onClick={() => handlePageChange(page + 1)}
                                disabled={page === totalPages}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SMTCountDetailsModal;
