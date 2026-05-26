import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../../utils/api';
import { formatScanError } from '../../utils/errorFormatter';
import styles from './QA.module.css';
import sharedStyles from '../smt/WorkOrder.module.css';

import { useToast } from '../../components/Toast';
import { useAuth } from '../../hooks/useAuth';
import SearchInput from '../../components/SearchInput';
import { Search, CheckCircle, MessageSquare, AlertTriangle, ArrowLeft, Eye, Trash2 } from 'lucide-react';

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

const QA: React.FC = () => {
    const { user } = useAuth();
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

    useEffect(() => {
        if (barcode.trim().length >= 14 && !isScanning && activeBatch) {
            handleScan();
        }
    }, [barcode, isScanning, activeBatch]);

    const fetchPendingBatches = async (page = 1, search = searchTermPending) => {
        try {
            const data = await apiFetch(`/api/backend/qa/batch?status=pending&page=${page}&limit=10&search=${search}`);
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
            const data = await apiFetch(`/api/backend/qa/batch?status=completed&page=${page}&limit=10&search=${search}`);
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
            const data = await apiFetch(`/api/backend/qa/scan/${batchId}?page=${page}&limit=50`);
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
        if (!scannedVal || isScanning || !activeBatch) return;

        setIsScanning(true);
        try {
            const preValRes = await apiFetch('/api/backend/track/validate', {
                method: 'POST',
                body: JSON.stringify({
                    stage_code: 'QA',
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
            }
        } catch (error: any) {
            showToast(formatScanError(error), 'error');
            setTimeout(() => {
                scanInputRef.current?.focus();
            }, 100);
        } finally {
            setIsScanning(false);
        }
    };

    const handleScanFinalize = async (status: string, remarks?: string) => {
        if (!pendingBarcode || !activeBatch) return;

        setIsScanning(true);
        try {
            const response = await apiFetch('/api/backend/qa/scan', {
                method: 'POST',
                body: JSON.stringify({
                    batch_id: activeBatch.id,
                    barcode: pendingBarcode,
                    scanned_by: user?.name || 'Operator',
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
        if (user?.role !== 'Super Admin') {
            showToast('Only SuperAdmin can perform delete operations.', 'error');
            return;
        }
        if (!window.confirm('Are you sure you want to delete this batch? This action cannot be undone.')) return;
        try {
            await apiFetch(`/api/backend/QA/batch/${batchId}`, {
                method: 'DELETE'
            });
            showToast('Batch deleted successfully', 'success');
            fetchBatches();
        } catch (error) {
            showToast('Failed to delete batch', 'error');
        }
    };

    const safeScannedItems = Array.isArray(scannedItems) ? scannedItems : [];
    const filteredItems = safeScannedItems.filter(item =>
        item.barcode?.toLowerCase().includes(tableSearch.toLowerCase())
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
                                    {title === "Pending Batches" && batch.previousStagePassed !== undefined && <td style={{ fontWeight: 600, color: '#6366f1' }}>{batch.previousStagePassed}</td>}
                                    <td className={styles.statusBlue}>{batch.scanned ?? 0}</td>
                                    <td style={{ color: 'orange', fontWeight: 700 }}>{batch.pending ?? 0}</td>
                                    <td className={styles.statusGreen}>{batch.passed ?? 0}</td>
                                    <td style={{ color: '#f59e0b', fontWeight: 700 }}>{batch.rework ?? 0}</td>
                                    <td style={{ color: '#ef4444', fontWeight: 700 }}>{batch.debug ?? 0}</td>
                                    <td className={styles.actionColumn}>
                                        <div className={sharedStyles.actions}>
                                            <button className={sharedStyles.secondaryButton} onClick={() => handleStartScanning(batch)}>
                                                {batch.status === 'completed' ? <><Eye size={14} /> View</> : <><Search size={14} /> Start Scanning</>}
                                            </button>
                                            {showDelete && (
                                                <button className={sharedStyles.deleteButton} onClick={() => handleDeleteBatch(batch.id)}>
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan={11} style={{ textAlign: 'center', padding: '2rem' }}>No batches found in this category.</td></tr>
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
                            <h2>⚙️ QA Stage</h2>
                            <p>Manage and process production batches for Quality Assurance.</p>
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
                                <h2 style={{ fontSize: '0.9rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, margin: 0 }}>QA Page</h2>
                            </div>
                            <h1 className={styles.woNumber}>{activeBatch.batch_number}</h1>
                            <p className={styles.woMeta}>
                                ✅ Total Scanned: {activeBatch.scanned}/{activeBatch.workOrderQty} |
                                📥 From VI Passed: {activeBatch.previousStagePassed} |
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
                                    <input type="text" className={styles.operatorInput} value={user?.name || ""} disabled />
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
                                        placeholder="Search barcode..."
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
                                                </tr>
                                            ))
                                        ) : (
                                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '3rem' }}>No items scanned.</td></tr>
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
        </div>
    );
};

export default QA;
