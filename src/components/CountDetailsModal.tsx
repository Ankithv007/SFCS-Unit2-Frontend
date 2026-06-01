import React, { useState, useEffect } from 'react';
import { X, Search, FileText, User, Calendar, AlertCircle } from 'lucide-react';
import { apiFetch } from '../utils/api';
import styles from './CountDetailsModal.module.css';

interface UnitRecord {
    barcode: string;
    unit_serial_number?: string;
    wo_number: string;
    batch_number: string;
    customer_name?: string;
    model?: string;
    current_stage?: string;
    status?: string;
    scan_date_time?: string;
    operator?: string;
    failed_stage?: string;
    rework_debug_reason?: string;
}

interface CountDetailsModalProps {
    batchId: number;
    batchNumber: string;
    stageCode: string;
    columnType: 'previousStagePassed' | 'scanned' | 'pending' | 'passed' | 'rework' | 'debug';
    columnLabel: string;
    failedStageId?: number; // Used for Rework/Debug stages
    onClose: () => void;
}

const CountDetailsModal: React.FC<CountDetailsModalProps> = ({
    batchId,
    batchNumber,
    stageCode,
    columnType,
    columnLabel,
    failedStageId,
    onClose
}) => {
    const [data, setData] = useState<UnitRecord[]>([]);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [limit] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch batch unit details
    const fetchDetails = async (currentPage: number, searchVal: string) => {
        setLoading(true);
        setError(null);
        try {
            const endpoint = `/api/backend/track/batch-units?batchId=${batchId}&stageCode=${stageCode}&columnType=${columnType}&failedStageId=${failedStageId || ''}&page=${currentPage}&limit=${limit}&search=${encodeURIComponent(searchVal)}`;
            const response = await apiFetch(endpoint);
            
            if (response) {
                setData(response.data || []);
                setTotalPages(response.totalPages || 1);
                setTotalRecords(response.total || 0);
            }
        } catch (err: any) {
            console.error('Error fetching unit details:', err);
            setError(err.message || 'Failed to retrieve batch unit details.');
        } finally {
            setLoading(false);
        }
    };

    // Debounce search fetching
    useEffect(() => {
        const delayDebounce = setTimeout(() => {
            setPage(1);
            fetchDetails(1, search);
        }, 300);

        return () => clearTimeout(delayDebounce);
    }, [search]);

    // Handle pagination change
    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setPage(newPage);
            fetchDetails(newPage, search);
        }
    };

    const getStatusClass = (status: string = '') => {
        const s = status.toUpperCase();
        if (['ACCEPTED', 'PASSED', 'RESOLVED'].includes(s)) return styles.statusPassed;
        if (['REWORK'].includes(s)) return styles.statusRework;
        if (['DEBUG', 'FAILED'].includes(s)) return styles.statusDebug;
        return styles.statusPending;
    };

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
                {/* Modal Header */}
                <div className={styles.modalHeader}>
                    <div>
                        <h2>Batch Details: {batchNumber}</h2>
                        <p>{columnLabel} Units ({totalRecords})</p>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>
                        <X size={22} />
                    </button>
                </div>

                {/* Modal Search Bar */}
                <div className={styles.searchBarWrapper}>
                    <div className={styles.searchContainer}>
                        <Search size={18} className={styles.searchIcon} />
                        <input
                            type="text"
                            placeholder="Filter by Barcode, USN, Model, Stage, Status..."
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

                {/* Modal Body */}
                <div className={styles.modalBody}>
                    {loading ? (
                        <div className={styles.loaderWrapper}>
                            <div className={styles.spinner}></div>
                            <p>Fetching unit traceability logs...</p>
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
                                        <th>Barcode / USN</th>
                                        <th>WO Number</th>
                                        <th>Customer & Model</th>
                                        <th>Current Stage</th>
                                        <th>Status</th>
                                        <th>Scan Date & Time</th>
                                        <th>Operator</th>
                                        <th>Rework/Debug Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.map((record, index) => (
                                        <tr key={index}>
                                            <td>
                                                <div className={styles.barcodeCell}>
                                                    <span className={styles.barcodeText}>{record.barcode}</span>
                                                    {record.unit_serial_number && (
                                                        <span className={styles.usnBadge} title="Unit Serial Number">
                                                            USN: {record.unit_serial_number}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className={styles.woCell}>{record.wo_number}</td>
                                            <td>
                                                <div className={styles.customerModelCell}>
                                                    <span className={styles.customerText}>{record.customer_name || '-'}</span>
                                                    <span className={styles.modelText}>{record.model || '-'}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={styles.stageBadge}>
                                                    {record.current_stage || 'Unknown'}
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
                                                    {record.scan_date_time ? new Date(record.scan_date_time).toLocaleString() : 'N/A'}
                                                </div>
                                            </td>
                                            <td>
                                                <div className={styles.operatorCell}>
                                                    <User size={12} style={{ marginRight: '4px' }} />
                                                    {record.operator || '-'}
                                                </div>
                                            </td>
                                            <td>
                                                <div className={styles.remarksCell}>
                                                    {record.failed_stage && (
                                                        <span className={styles.failedStageTag}>
                                                            Failed at: {record.failed_stage}
                                                        </span>
                                                    )}
                                                    <p className={styles.remarksText}>
                                                        {record.rework_debug_reason || '-'}
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

                {/* Modal Footer (Pagination) */}
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

export default CountDetailsModal;
