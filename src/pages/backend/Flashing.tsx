import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../../utils/api';
import { formatScanError } from '../../utils/errorFormatter';
import { checkDeletePermission } from '../../utils/security';
import styles from './Flashing.module.css';
import sharedStyles from '../smt/work-order/WorkOrder.module.css';

import { useToast } from '../../components/Toast';
import { useAuth } from '../../hooks/useAuth';
import { useBackendAuth } from '../../context/BackendAuthContext';
import SearchInput from '../../components/SearchInput';
import { Search, CheckCircle, MessageSquare, AlertTriangle, ArrowLeft, Eye, Trash2, Pencil } from 'lucide-react';
import CountDetailsModal from '../../components/CountDetailsModal';
import EditScanModal from '../../components/EditScanModal';

interface Batch {
    id: number;
    batch_number: string;
    customer_name?: string;
    model?: string;
    workOrderQty: number;
    previousStagePassed?: number;
    scanned: number;
    pending: number;
    passed: number;
    failed: number;
    rework: number;
    debug: number;
    status: 'pending' | 'in_progress' | 'completed';
    selectedStages?: string[] | string | null;
}

interface ScanRecord {
    id: number | string;
    barcode: string;
    scanned_by: string;
    scanned_at: string;
    status: string;
    remarks?: string;
    remark_debug_time?: string;
    remark_debug_remarks?: string;
    unit_serial_number?: string;
}

interface ScanDecisionModalProps {
    barcode: string;
    onFinalize: (status: string, remarks?: string) => void;
    onClose: () => void;
}

const ScanDecisionModal: React.FC<ScanDecisionModalProps> = ({ barcode, onFinalize, onClose }) => {
    const [mode, setMode] = useState<'select' | 'input'>('select');
    const [status, setStatus] = useState<'ACCEPTED' | 'REWORK' | 'DEBUG'>('ACCEPTED');
    const [text, setText] = useState('');
    const [focusedIndex, setFocusedIndex] = useState(0);

    const bufferRef = useRef('');
    const actions: ('ACCEPTED' | 'REWORK' | 'DEBUG')[] = ['ACCEPTED', 'REWORK', 'DEBUG'];

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (mode === 'select') {
                if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    setFocusedIndex(prev => (prev + 1) % 3);
                } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    setFocusedIndex(prev => (prev - 1 + 3) % 3);
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if ((bufferRef.current || '').toUpperCase() === 'RESOLVED') {
                        handleAction('ACCEPTED');
                    } else if (bufferRef.current === '') {
                        handleAction(actions[focusedIndex]);
                    }
                    bufferRef.current = '';
                } else if (e.key.length === 1) {
                    bufferRef.current += e.key;
                    if (bufferRef.current.length > 20) bufferRef.current = '';
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [mode, focusedIndex]);

    const handleAction = (selectedStatus: 'ACCEPTED' | 'REWORK' | 'DEBUG') => {
        if (selectedStatus === 'ACCEPTED') {
            onFinalize('ACCEPTED');
        } else {
            setStatus(selectedStatus);
            setMode('input');
        }
    };

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
                <div className={styles.modalHeader}>
                    <h3>Scan Action - {barcode}</h3>
                    <button className={styles.closeBtn} onClick={onClose}>&times;</button>
                </div>
                <div className={styles.modalBody}>
                    {mode === 'select' ? (
                        <div className={styles.decisionGrid}>
                            <button
                                className={`${styles.decisionBtn} ${focusedIndex === 0 ? styles.defaultAction : ''}`}
                                onClick={() => handleAction('ACCEPTED')}
                                onMouseEnter={() => setFocusedIndex(0)}
                            >
                                <CheckCircle size={32} className={styles.passIcon} />
                                Pass
                            </button>
                            <button
                                className={`${styles.decisionBtn} ${focusedIndex === 1 ? styles.defaultAction : ''}`}
                                onClick={() => handleAction('REWORK')}
                                onMouseEnter={() => setFocusedIndex(1)}
                            >
                                <MessageSquare size={32} className={styles.reworkIcon} />
                                Rework
                            </button>
                            <button
                                className={`${styles.decisionBtn} ${focusedIndex === 2 ? styles.defaultAction : ''}`}
                                onClick={() => handleAction('DEBUG')}
                                onMouseEnter={() => setFocusedIndex(2)}
                            >
                                <AlertTriangle size={32} className={styles.debugIcon} />
                                Debug
                            </button>
                        </div>
                    ) : (
                        <div className={styles.inputGroup}>
                            <label style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>
                                {status === 'REWORK' ? 'Rework Details' : 'Debug Reason'} *
                            </label>
                            <textarea
                                autoFocus
                                className={styles.textarea}
                                placeholder={`Enter ${status} details...`}
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                            />
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
                                <button className={styles.secondaryBtn} onClick={() => setMode('select')}>Back</button>
                                <button
                                    className={styles.primaryBtn}
                                    style={{ marginTop: 0 }}
                                    onClick={() => onFinalize(status.toUpperCase(), text)}
                                    disabled={!text.trim()}
                                >
                                    Submit
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const Flashing: React.FC = () => {
    const { user } = useAuth();
    const { backendUser } = useBackendAuth();
    const { showToast } = useToast();

    const [pendingBatches, setPendingBatches] = useState<Batch[]>([]);
    const [pendingPage, setPendingPage] = useState(1);
    const [searchTermPending, setSearchTermPending] = useState('');
    const [pendingTotalPages, setPendingTotalPages] = useState(1);
    const [pendingTotalRecords, setPendingTotalRecords] = useState(0);

    const [completedBatches, setCompletedBatches] = useState<Batch[]>([]);
    const [completedPage, setCompletedPage] = useState(1);
    const [searchTermCompleted, setSearchTermCompleted] = useState('');
    const [completedTotalPages, setCompletedTotalPages] = useState(1);
    const [completedTotalRecords, setCompletedTotalRecords] = useState(0);
    const [activeBatch, setActiveBatch] = useState<Batch | null>(null);
    const [scannedItems, setScannedItems] = useState<ScanRecord[]>([]);

    const [barcode, setBarcode] = useState('');
    const [tableSearch, setTableSearch] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const [editingScan, setEditingScan] = useState<ScanRecord | null>(null);

    const canEdit = !!user;
    const canDelete = user?.role === 'Super Admin';

    const [activeModal, setActiveModal] = useState<{
        batchId: number;
        batchNumber: string;
        stageCode: string;
        columnType: 'previousStagePassed' | 'scanned' | 'pending' | 'passed' | 'rework' | 'debug';
        columnLabel: string;
        failedStageId?: number;
    } | null>(null);

    const handleCountClick = (
        batch: Batch,
        columnType: 'previousStagePassed' | 'scanned' | 'pending' | 'passed' | 'rework' | 'debug',
        columnLabel: string
    ) => {
        setActiveModal({
            batchId: batch.id,
            batchNumber: batch.batch_number,
            stageCode: 'FLASHING',
            columnType,
            columnLabel
        });
    };

    const [exportingBatchId, setExportingBatchId] = useState<number | null>(null);

    const handleExportExcel = async (batch: Batch) => {
        if (exportingBatchId !== null) return;
        setExportingBatchId(batch.id);
        try {
            const blob = await apiFetch(`/api/backend/export/batch-report?batchId=${batch.id}&stageCode=FLASHING`) as Blob;
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;

            const now = new Date();
            const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-');
            const cleanBatch = batch.batch_number.replace(/[^a-zA-Z0-9_-]/g, '_');
            const fileName = `Flashing_Batch_Report_${cleanBatch}_${timestamp}.xlsx`;

            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            showToast('Report downloaded successfully!', 'success');
        } catch (error: any) {
            console.error('Export error:', error);
            showToast(error.message || 'Failed to export batch report', 'error');
        } finally {
            setExportingBatchId(null);
        }
    };

    const scanInProgressRef = useRef(false);
    const scanInputRef = useRef<HTMLInputElement>(null);
    const [pendingBarcode, setPendingBarcode] = useState<string | null>(null);

    useEffect(() => {
        fetchBatches();
    }, []);

    useEffect(() => {
        fetchPendingBatches(1, searchTermPending);
    }, [searchTermPending]);

    useEffect(() => {
        fetchCompletedBatches(1, searchTermCompleted);
    }, [searchTermCompleted]);

    useEffect(() => {
        if (activeBatch && scanInputRef.current && !pendingBarcode) {
            scanInputRef.current.focus();
        }
    });

    const fetchPendingBatches = async (page = 1, search = searchTermPending) => {
        try {
            const data = await apiFetch(`/api/backend/flashing/batch?status=pending&page=${page}&limit=10&search=${search}`);
            setPendingBatches(data.data || []);
            setPendingTotalPages(data.totalPages || 1);
            setPendingTotalRecords(data.total || 0);
            setPendingPage(data.page || 1);
        } catch (error) {
            console.error("Error fetching pending batches:", error);
        }
    };

    const fetchCompletedBatches = async (page = 1, search = searchTermCompleted) => {
        try {
            const data = await apiFetch(`/api/backend/flashing/batch?status=completed&page=${page}&limit=10&search=${search}`);
            setCompletedBatches(data.data || []);
            setCompletedTotalPages(data.totalPages || 1);
            setCompletedTotalRecords(data.total || 0);
            setCompletedPage(data.page || 1);
        } catch (error) {
            console.error("Error fetching completed batches:", error);
        }
    };

    const fetchBatches = () => {
        fetchPendingBatches(1, searchTermPending);
        fetchCompletedBatches(1, searchTermCompleted);
    };

    const fetchScans = async (batchId: number, page = 1) => {
        try {
            const data = await apiFetch(`/api/backend/flashing/scan/${batchId}?page=${page}&limit=50`);
            if (data && data.data) {
                setScannedItems(data.data);
                setTotalPages(data.totalPages);
                setTotalRecords(data.total);
                setCurrentPage(data.page);
            } else {
                setScannedItems(Array.isArray(data) ? data : []);
                setTotalPages(1);
                setTotalRecords(Array.isArray(data) ? data.length : 0);
            }
        } catch (error) {
            console.error('Error fetching scans:', error);
            setScannedItems([]);
            setTotalPages(1);
            setTotalRecords(0);
        }
    };

    const handleStartScanning = async (batch: Batch) => {
        try {
            await fetchScans(batch.id);
            setActiveBatch(batch);
            setBarcode('');
            showToast(`Starting session for ${batch.batch_number}`, 'success');
        } catch (error) {
            showToast('Failed to load batch scans', 'error');
        }
    };

    const handleEndSession = () => {
        setActiveBatch(null);
        fetchBatches();
    };

    const handleScan = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const scannedVal = barcode.trim().toUpperCase();
        if (!scannedVal || scanInProgressRef.current || isScanning || !activeBatch) return;

        scanInProgressRef.current = true;
        setIsScanning(true);
        try {
            const preValRes = await apiFetch('/api/backend/track/validate', {
                method: 'POST',
                body: JSON.stringify({
                    stage_code: 'FLASHING',
                    barcode: scannedVal,
                    batch_number: activeBatch.batch_number,
                    work_order_id: (activeBatch as any).work_order_id || null,
                    failed_stage_id: (activeBatch as any).failedStageId || null
                })
            });

            if (preValRes && preValRes.success) {
                const resolvedVal = preValRes.data?.barcode || scannedVal;
                setPendingBarcode(resolvedVal);
                setBarcode('');
            } else {
                showToast(preValRes?.message || 'Validation failed', 'error');
                setBarcode('');
                setTimeout(() => {
                    scanInputRef.current?.focus();
                }, 100);
            }
        } catch (error: any) {
            showToast(formatScanError(error), 'error');
            setBarcode('');
            setTimeout(() => {
                scanInputRef.current?.focus();
            }, 100);
        } finally {
            setIsScanning(false);
            scanInProgressRef.current = false;
        }
    };

    const handleScanFinalize = async (status: string, remarks?: string) => {
        if (!pendingBarcode || !activeBatch) return;

        setIsScanning(true);
        try {
            const response = await apiFetch('/api/backend/flashing/scan', {
                method: 'POST',
                body: JSON.stringify({
                    batch_id: activeBatch.id,
                    barcode: pendingBarcode,
                    scanned_by: backendUser ? `${backendUser.name} (${backendUser.userId})` : (user?.name || 'Operator'),
                    status: status,
                    remarks: remarks
                })
            });

            const { scan, counters } = response.data || {};

            if (scan) {
                fetchScans(activeBatch.id, 1);
            }

            if (counters) {
                setActiveBatch(prev => prev ? { ...prev, ...counters } : null);
            }

            showToast(`Item marked as ${(status || 'UNKNOWN').toUpperCase()}`, 'success');
            setPendingBarcode(null);

            // Refresh batches in background
            fetchBatches();

            // Check for batch completion using the updated counters
            if (counters) {
                const isCompleted = counters.passed === activeBatch.workOrderQty &&
                    counters.rework === 0 &&
                    counters.debug === 0;

                if (isCompleted) {
                    showToast('Batch completed successfully!', 'success');
                    setActiveBatch(null);
                }
            }

        } catch (error: any) {
            showToast(formatScanError(error), 'error');
            setPendingBarcode(null);
        } finally {
            setIsScanning(false);
        }
    };

    const handleDeleteBatch = async (batchId: number) => {
        if (!checkDeletePermission(user?.role, showToast)) {
            return;
        }
        if (!window.confirm('Are you sure you want to delete this batch? This action cannot be undone.')) return;
        try {
            await apiFetch(`/api/backend/Flashing/batch/${batchId}`, {
                method: 'DELETE'
            });
            showToast('Batch deleted successfully', 'success');
            fetchBatches();
        } catch (error) {
            showToast('Failed to delete batch', 'error');
        }
    };

    const isStageSelected = (batch: Batch): boolean => {
        const raw = batch.selectedStages;
        if (raw === null || raw === undefined) return true; // legacy WO — allow
        let stages: string[];
        if (Array.isArray(raw)) {
            stages = raw;
        } else if (typeof raw === 'string') {
            try { stages = JSON.parse(raw); } catch { return true; }
        } else {
            return true;
        }
        if (stages.length === 0) return true;
        return stages.some(s => s.toLowerCase() === 'flashing');
    };

    const safeScannedItems = Array.isArray(scannedItems) ? scannedItems : [];
    const filteredItems = safeScannedItems.filter(item =>
        item.barcode?.toLowerCase().includes(tableSearch.toLowerCase()) ||
        item.unit_serial_number?.toLowerCase().includes(tableSearch.toLowerCase())
    );



    const BatchTable = ({
        data,
        title,
        showDelete = false,
        currentPage,
        totalPages,
        totalRecords,
        onPageChange,
        searchValue,
        onSearchChange
    }: {
        data: Batch[],
        title: string,
        showDelete?: boolean,
        currentPage: number,
        totalPages: number,
        totalRecords: number,
        onPageChange: (page: number) => void,
        searchValue: string,
        onSearchChange: (value: string) => void
    }) => (
        <div className={styles.card} style={{ marginBottom: '2rem' }}>
            <div className={styles.tableHeader}>
                <h3 style={{ margin: 0 }}>{title} ({totalRecords})</h3>
                <SearchInput
                    value={searchValue}
                    onChange={onSearchChange}
                    placeholder="Search Work Order..."
                />
            </div>
            <div className={styles.tableWrapper}>
                <table className={styles.scanTable}>
                    <thead>
                        <tr>
                            <th>Batch Number</th>
                            <th>Customer</th>
                            <th>Model</th>
                            <th>Work Order Qty</th>
                            {title === "Pending Batches" && data.some(b => b.previousStagePassed !== undefined) && <th>Previous Stage Passed</th>}
                            <th>Scanned</th>
                            <th>Pending</th>
                            <th>Passed</th>
                            <th>Rework</th>
                            <th>Debug</th>
                            <th>Download</th>
                            <th className={styles.actionColumn}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.length > 0 ? (
                            data.map(batch => (
                                <tr key={batch.id}>
                                    <td style={{ fontWeight: 700 }}>{batch.batch_number}</td>
                                    <td>{batch.customer_name || "-"}</td>
                                    <td>{batch.model || "-"}</td>
                                    <td style={{ fontWeight: 600 }}>{batch.workOrderQty}</td>
                                    {title === "Pending Batches" && batch.previousStagePassed !== undefined && (
                                        <td
                                            style={{ fontWeight: 600, color: '#4f46e5', cursor: 'pointer', textDecoration: 'underline' }}
                                            onClick={() => handleCountClick(batch, 'previousStagePassed', 'Previous Stage Passed')}
                                        >
                                            {batch.previousStagePassed}
                                        </td>
                                    )}
                                    {title === "Pending Batches" && !batch.previousStagePassed && batch.previousStagePassed !== 0 && data.some(b => b.previousStagePassed !== undefined) && (
                                        <td>-</td>
                                    )}
                                    <td
                                        className={styles.statusBlue}
                                        style={{ cursor: 'pointer', textDecoration: 'underline' }}
                                        onClick={() => handleCountClick(batch, 'scanned', 'Scanned')}
                                    >
                                        {batch.scanned ?? 0}
                                    </td>
                                    <td
                                        style={{ color: '#d97706', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                                        onClick={() => handleCountClick(batch, 'pending', 'Pending')}
                                    >
                                        {batch.pending ?? 0}
                                    </td>
                                    <td
                                        className={styles.statusGreen}
                                        style={{ cursor: 'pointer', textDecoration: 'underline' }}
                                        onClick={() => handleCountClick(batch, 'passed', 'Passed')}
                                    >
                                        {batch.passed ?? 0}
                                    </td>
                                    <td
                                        style={{ color: '#d97706', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                                        onClick={() => handleCountClick(batch, 'rework', 'Rework')}
                                    >
                                        {batch.rework ?? 0}
                                    </td>
                                    <td
                                        style={{ color: '#dc2626', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                                        onClick={() => handleCountClick(batch, 'debug', 'Debug')}
                                    >
                                        {batch.debug ?? 0}
                                    </td>
                                    <td>
                                        <button
                                            className={sharedStyles.secondaryButton}
                                            disabled={exportingBatchId === batch.id}
                                            onClick={() => handleExportExcel(batch)}
                                            style={{
                                                padding: '0.4rem',
                                                minWidth: '40px',
                                                width: '40px',
                                                height: '40px',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                borderRadius: '50%',
                                                backgroundColor: '#f0fdf4',
                                                border: '1px solid #bbf7d0',
                                                color: '#166534',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                                            }}
                                            title="Export to Excel"
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.backgroundColor = '#166534';
                                                e.currentTarget.style.color = '#ffffff';
                                                e.currentTarget.style.borderColor = '#166534';
                                                e.currentTarget.style.transform = 'scale(1.08)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = '#f0fdf4';
                                                e.currentTarget.style.color = '#166534';
                                                e.currentTarget.style.borderColor = '#bbf7d0';
                                                e.currentTarget.style.transform = 'scale(1)';
                                            }}
                                        >
                                            {exportingBatchId === batch.id ? (
                                                <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>...</span>
                                            ) : (
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                                                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                                                    <polyline points="14 2 14 8 20 8" />
                                                    <line x1="8" y1="13" x2="16" y2="13" />
                                                    <line x1="8" y1="17" x2="16" y2="17" />
                                                    <line x1="10" y1="9" x2="9" y2="9" />
                                                </svg>
                                            )}
                                        </button>
                                    </td>
                                    <td className={styles.actionColumn}>
                                        <div className={sharedStyles.actions}>
                                            {isStageSelected(batch) ? (
                                                <button className={sharedStyles.secondaryButton} onClick={() => handleStartScanning(batch)}>
                                                    {batch.status === 'completed' ? <><Eye size={14} /> View</> : <><Search size={14} /> Start Scanning</>}
                                                </button>
                                            ) : (
                                                <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.3rem',
                                                    padding: '0.3rem 0.75rem',
                                                    borderRadius: '999px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600,
                                                    backgroundColor: '#f3f4f6',
                                                    color: '#6b7280',
                                                    border: '1px solid #e5e7eb',
                                                    letterSpacing: '0.02em'
                                                }}>
                                                    — Skipped
                                                </span>
                                            )}
                                            {showDelete && canDelete && (
                                                <button className={sharedStyles.deleteButton} onClick={() => handleDeleteBatch(batch.id)}>
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan={12} style={{ textAlign: 'center', padding: '2rem' }}>No batches found in this category.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {totalRecords > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', padding: '0 1rem', paddingBottom: '1rem' }}>
                    <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
                        Showing {(currentPage - 1) * 10 + 1}-{Math.min(currentPage * 10, totalRecords)} of {totalRecords} batches
                    </span>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button
                            className={sharedStyles.secondaryButton}
                            disabled={currentPage === 1}
                            onClick={() => onPageChange(currentPage - 1)}
                            style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}
                        >
                            Previous
                        </button>
                        <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Page {currentPage} of {totalPages}</span>
                        <button
                            className={sharedStyles.secondaryButton}
                            disabled={currentPage === totalPages}
                            onClick={() => onPageChange(currentPage + 1)}
                            style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div className={styles.container}>
            {!activeBatch ? (
                <>
                    <div className={styles.header}>
                        <div>
                            <h2>⚙️ Flashing Stage</h2>
                            <p>Manage and process production batches for Flashing.</p>
                        </div>
                    </div>

                    <BatchTable
                        data={pendingBatches}
                        title="Pending Batches"
                        searchValue={searchTermPending}
                        onSearchChange={setSearchTermPending}
                        currentPage={pendingPage}
                        totalPages={pendingTotalPages}
                        totalRecords={pendingTotalRecords}
                        onPageChange={fetchPendingBatches}
                        showDelete={true}
                    />
                    <BatchTable
                        data={completedBatches}
                        title="Completed Batches"
                        searchValue={searchTermCompleted}
                        onSearchChange={setSearchTermCompleted}
                        currentPage={completedPage}
                        totalPages={completedTotalPages}
                        totalRecords={completedTotalRecords}
                        onPageChange={fetchCompletedBatches}
                        showDelete={false}
                    />
                </>
            ) : (
                <>
                    <div className={styles.headerBar}>
                        <div className={styles.headerInfo}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <button className={styles.backBtn} onClick={handleEndSession}>
                                    <ArrowLeft size={18} />
                                </button>
                                <h2 style={{ fontSize: '0.9rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, margin: 0 }}>Flashing Page</h2>
                            </div>
                            <h1 className={styles.woNumber}>{activeBatch.batch_number}</h1>
                            <p className={styles.woMeta}>
                                ✅ Total Scanned: {activeBatch.scanned}/{activeBatch.workOrderQty} |
                                📥 From QA Passed: {activeBatch.previousStagePassed} |
                                ⏳ Pending: {activeBatch.pending} |
                                📝 Passed: {activeBatch.passed} |
                                ⚠️ Rework: {activeBatch.rework} |
                                🛠️ Debug: {activeBatch.debug}
                            </p>
                        </div>
                        {activeBatch.status !== 'completed' && (
                            <button className={sharedStyles.secondaryButton} onClick={handleEndSession}>
                                Close Session
                            </button>
                        )}
                    </div>

                    <div className={styles.scanContent}>
                        {activeBatch.status !== 'completed' && (
                            <>
                                <div className={styles.operatorSection}>
                                    <label>Scanned By</label>
                                    <input type="text" className={styles.operatorInput} value={backendUser ? `${backendUser.name} (${backendUser.userId})` : (user?.name || "")} disabled />
                                </div>

                                <div className={styles.scanBoxWrapper}>
                                    <form onSubmit={handleScan} className={styles.scanBox}>
                                        <input
                                            ref={scanInputRef}
                                            type="text"
                                            className={styles.largeScanInput}
                                            placeholder="Scan Item Barcode..."
                                            value={barcode}
                                            onChange={(e) => setBarcode(e.target.value)}
                                            readOnly={isScanning || !!pendingBarcode}
                                            autoFocus
                                        />
                                        <button type="submit" className={styles.largeScanBtn} disabled={isScanning}>
                                            {isScanning ? '...' : 'SCAN'}
                                        </button>
                                    </form>
                                </div>
                            </>
                        )}

                        <div className={styles.tableCard}>
                            <div className={styles.tableHeader}>
                                <h3>Scanned Items ({scannedItems.length})</h3>
                                <div className={styles.tableSearchWrapper}>
                                    <Search size={16} className={styles.tableSearchIcon} />
                                    <input
                                        type="text"
                                        placeholder="Search Barcode / Unit Serial Number..."
                                        className={styles.tableSearchInput}
                                        value={tableSearch}
                                        onChange={(e) => setTableSearch(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className={styles.tableWrapper}>
                                <table className={styles.scanTable}>
                                    <thead>
                                        <tr>
                                            <th>BARCODE</th>
                                            <th>SCANNED BY</th>
                                            <th>DATE & TIME</th>
                                            <th>STATUS</th>
                                            <th>REWORK/DEBUG TIME</th>
                                            <th>Remarks</th>
                                            <th>REWORK/DEBUG Remarks</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredItems.length > 0 ? (
                                            filteredItems.map((scan) => (
                                                <tr key={scan.id}>
                                                    <td className={styles.barcodeCell}>{scan.barcode || '-'}</td>
                                                    <td>{scan.scanned_by || '-'}</td>
                                                    <td>{scan.scanned_at ? new Date(scan.scanned_at).toLocaleString() : '-'}</td>
                                                    <td>
                                                        <span className={styles[`${(scan.status || '').toLowerCase()}Badge`] || styles.acceptedBadge}>
                                                            {(scan.status || '-').toUpperCase()}
                                                        </span>
                                                    </td>
                                                    <td>{scan.remark_debug_time ? new Date(scan.remark_debug_time).toLocaleString() : '-'}</td>
                                                    <td>{scan.remarks || '-'}</td>
                                                    <td>{scan.remark_debug_remarks || '-'}</td>
                                                    <td>
                                                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', alignItems: 'center' }}>
                                                            {canEdit && (
                                                                <button
                                                                    className={sharedStyles.secondaryButton}
                                                                    onClick={() => setEditingScan(scan)}
                                                                    style={{
                                                                        padding: '0.4rem',
                                                                        minWidth: '28px',
                                                                        width: '28px',
                                                                        height: '28px',
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        borderRadius: '4px',
                                                                        border: '1px solid #cbd5e1',
                                                                        color: '#475569',
                                                                        cursor: 'pointer',
                                                                        transition: 'all 0.2s ease'
                                                                    }}
                                                                    onMouseEnter={(e) => {
                                                                        e.currentTarget.style.backgroundColor = '#6366f1';
                                                                        e.currentTarget.style.color = '#ffffff';
                                                                        e.currentTarget.style.borderColor = '#6366f1';
                                                                    }}
                                                                    onMouseLeave={(e) => {
                                                                        e.currentTarget.style.backgroundColor = 'white';
                                                                        e.currentTarget.style.color = '#475569';
                                                                        e.currentTarget.style.borderColor = '#cbd5e1';
                                                                    }}
                                                                    title="Edit Scan"
                                                                >
                                                                    <Pencil size={14} />
                                                                </button>
                                                            )}
                                                            {canDelete && (
                                                                <button
                                                                    className={sharedStyles.deleteBtn}
                                                                    onClick={async () => {
                                                                        if (!checkDeletePermission(user?.role, showToast)) {
                                                                            return;
                                                                        }
                                                                        if (!window.confirm('Are you sure you want to delete this record?')) return;
                                                                        try {
                                                                            await apiFetch(`/api/backend/flashing/scan/${scan.id}`, { method: 'DELETE' });
                                                                            showToast('Record deleted successfully.', 'success');
                                                                            fetchScans(activeBatch!.id, currentPage);
                                                                        } catch (err: any) {
                                                                            showToast(err?.message || 'Failed to delete record', 'error');
                                                                        }
                                                                    }}
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr><td colSpan={8} style={{ textAlign: 'center', padding: '3rem' }}>No items scanned.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            {totalRecords > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', padding: '0 1rem', paddingBottom: '1rem' }}>
                                    <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
                                        Showing {(currentPage - 1) * 50 + 1}-{Math.min(currentPage * 50, totalRecords)} of {totalRecords} records
                                    </span>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                        <button
                                            className={sharedStyles.secondaryButton}
                                            disabled={currentPage === 1}
                                            onClick={() => fetchScans(activeBatch!.id, currentPage - 1)}
                                            style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}
                                        >
                                            Previous
                                        </button>
                                        <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Page {currentPage} of {totalPages}</span>
                                        <button
                                            className={sharedStyles.secondaryButton}
                                            disabled={currentPage === totalPages}
                                            onClick={() => fetchScans(activeBatch!.id, currentPage + 1)}
                                            style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {pendingBarcode && (
                <ScanDecisionModal
                    barcode={pendingBarcode}
                    onFinalize={handleScanFinalize}
                    onClose={() => setPendingBarcode(null)}
                />
            )}

            {activeModal && (
                <CountDetailsModal
                    batchId={activeModal.batchId}
                    batchNumber={activeModal.batchNumber}
                    stageCode={activeModal.stageCode}
                    columnType={activeModal.columnType}
                    columnLabel={activeModal.columnLabel}
                    onClose={() => setActiveModal(null)}
                />
            )}

            {editingScan && (
                <EditScanModal
                    scanId={editingScan.id}
                    initialBarcode={editingScan.barcode}
                    initialUnitSerialNo={editingScan.unit_serial_number || ''}
                    onClose={() => setEditingScan(null)}
                    onSaveSuccess={() => fetchScans(activeBatch!.id, currentPage)}
                    hideUnitSerial={true}
                />
            )}
        </div>
    );
};

export default Flashing;
