import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../../utils/api';
import { formatScanError } from '../../utils/errorFormatter';
import { checkDeletePermission } from '../../utils/security';
import styles from './Debug.module.css';
import sharedStyles from '../smt/work-order/WorkOrder.module.css';

import { useToast } from '../../components/Toast';
import { useAuth } from '../../hooks/useAuth';
import { useBackendAuth } from '../../context/BackendAuthContext';
import SearchInput from '../../components/SearchInput';
import ScanDecisionModal from '../../components/ScanDecisionModal';
import { Search, ArrowLeft, CheckCircle, Clock, Monitor, Activity, Trash2, Pencil } from 'lucide-react';
import CountDetailsModal from '../../components/CountDetailsModal';
import EditScanModal from '../../components/EditScanModal';

interface Batch {
    id: number;
    work_order_id: number;
    wo_number: string;
    batch_number: string;
    customer_name?: string;
    model?: string;
    workOrderQty: number;
    sourceStage?: string;
    failedStageId?: number;
    pending: number;
    scanned: number;
    rework: number;
    debug: number;
    passed: number;
    status: 'pending' | 'in_progress' | 'completed';
}

interface ScanRecord {
    id: number | string;
    barcode: string;
    unit_serial_number?: string;
    scanned_by: string;
    scanned_at: string;
    status: string;
    remarks?: string;
    repair_remark?: string;
    failed_at?: string;
    failure_remark?: string;
    failed_remarks?: string;
}

const Debug: React.FC = () => {
    const { user } = useAuth();
    const { backendUser } = useBackendAuth();
    const { showToast } = useToast();

    const [activeFailureBatches, setActiveFailureBatches] = useState<Batch[]>([]);
    const [page, setPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);

    const [activeBatch, setActiveBatch] = useState<Batch | null>(null);
    const [scannedItems, setScannedItems] = useState<ScanRecord[]>([]);
    const [tableSearch, setTableSearch] = useState('');
    const [isScanning, setIsScanning] = useState(false);

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
            stageCode: 'DEBUG',
            columnType,
            columnLabel,
            failedStageId: batch.failedStageId
        });
    };

    const [editingScan, setEditingScan] = useState<ScanRecord | null>(null);

    const canEdit = !!user;
    const canDelete = user?.role === 'Super Admin';

    const [barcode, setBarcode] = useState('');
    const scanInProgressRef = useRef(false);
    const scanInputRef = useRef<HTMLInputElement>(null);
    const [pendingBarcode, setPendingBarcode] = useState<string | null>(null);

    useEffect(() => {
        fetchActiveBatches();

        // Add polling for real-time visibility (every 10 seconds)
        const interval = setInterval(() => {
            if (!activeBatch) {
                fetchActiveBatches();
            }
        }, 10000);

        return () => clearInterval(interval);
    }, [page, searchTerm, activeBatch]);

    useEffect(() => {
        if (activeBatch && scanInputRef.current && !pendingBarcode) {
            scanInputRef.current.focus();
        }
    });

    const fetchActiveBatches = async () => {
        try {
            const data = await apiFetch(`/api/backend/debug/batch?page=${page}&limit=10&search=${searchTerm}`);
            setActiveFailureBatches(data.data || []);
            setTotalPages(data.totalPages || 1);
            setTotalRecords(data.total || 0);
        } catch (error) {
            console.error("Error fetching debug batches:", error);
        }
    };

    const fetchScans = async (batchId: number, failedStageId?: number, page = 1) => {
        try {
            const url = failedStageId
                ? `/api/backend/debug/scan/${batchId}?failedStageId=${failedStageId}&page=${page}&limit=50`
                : `/api/backend/debug/scan/${batchId}?page=${page}&limit=50`;
            const data = await apiFetch(url);
            setScannedItems(data.data || []);
        } catch (error) {
            console.error('Error fetching scans:', error);
            setScannedItems([]);
        }
    };

    const handleStartScanning = async (batch: Batch) => {
        try {
            await fetchScans(batch.id, batch.failedStageId);
            setActiveBatch(batch);
            setBarcode('');
            showToast(`Debug session started for ${batch.batch_number}`, 'success');
        } catch (error) {
            showToast('Failed to load batch failures', 'error');
        }
    };

    const handleEndSession = () => {
        setActiveBatch(null);
        fetchActiveBatches();
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
                    stage_code: 'DEBUG',
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
        if (!remarks?.trim()) {
            showToast('Repair remark is mandatory', 'error');
            return;
        }

        setIsScanning(true);
        try {
            const response = await apiFetch('/api/backend/debug/scan', {
                method: 'POST',
                body: JSON.stringify({
                    batch_id: activeBatch.id,
                    work_order_id: activeBatch.work_order_id,
                    failed_stage_id: activeBatch.failedStageId,
                    barcode: pendingBarcode,
                    scanned_by: backendUser ? `${backendUser.name} (${backendUser.userId})` : (user?.name || 'Operator'),
                    status: status,
                    remarks: remarks
                })
            });

            if (response.success) {
                showToast(response.message || 'Item resolved', 'success');
                setPendingBarcode(null);
                fetchScans(activeBatch.id, 1);
                fetchActiveBatches();

                const updatedBatches = await apiFetch(`/api/backend/debug/batch?search=${activeBatch.batch_number}`);
                const updated = updatedBatches.data?.find((b: Batch) => b.id === activeBatch.id);
                if (updated) {
                    setActiveBatch(updated);
                } else {
                    showToast('All debug items resolved for this batch!', 'success');
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

    const BatchTable = () => (
        <div className={styles.card}>
            <div className={styles.tableHeader}>
                <h3 style={{ margin: 0 }}>Pending Debug ({totalRecords})</h3>
                <SearchInput
                    value={searchTerm}
                    onChange={setSearchTerm}
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
                            <th>Source Stage</th>
                            <th>Scanned</th>
                            <th>Pending</th>
                            <th>Passed</th>
                            <th>Debug</th>
                            <th className={styles.actionColumn}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {activeFailureBatches.length > 0 ? (
                            activeFailureBatches.map(batch => (
                                <tr key={`${batch.id}-${batch.failedStageId}`}>
                                    <td style={{ fontWeight: 700 }}>{batch.batch_number}</td>
                                    <td>{batch.customer_name || "-"}</td>
                                    <td>{batch.model || "-"}</td>
                                    <td style={{ fontWeight: 600 }}>{batch.workOrderQty}</td>
                                    <td style={{ color: '#6366f1', fontWeight: 700 }}>{batch.sourceStage || "-"}</td>
                                    <td
                                        className={styles.statusBlue}
                                        style={{ cursor: 'pointer', textDecoration: 'underline' }}
                                        onClick={() => handleCountClick(batch, 'scanned', 'Scanned')}
                                    >
                                        {batch.scanned || 0}
                                    </td>
                                    <td
                                        style={{ color: '#d97706', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                                        onClick={() => handleCountClick(batch, 'pending', 'Pending')}
                                    >
                                        {batch.pending || 0}
                                    </td>
                                    <td
                                        className={styles.statusGreen}
                                        style={{ cursor: 'pointer', textDecoration: 'underline' }}
                                        onClick={() => handleCountClick(batch, 'passed', 'Passed')}
                                    >
                                        {batch.passed || 0}
                                    </td>
                                    <td
                                        style={{ color: '#dc2626', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                                        onClick={() => handleCountClick(batch, 'debug', 'Debug')}
                                    >
                                        {batch.debug || 0}
                                    </td>
                                    <td className={styles.actionColumn}>
                                        <button className={sharedStyles.secondaryButton} onClick={() => handleStartScanning(batch)}>
                                            <Search size={14} /> Start Debugging
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem' }}>No active debug items found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {totalRecords > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', padding: '0 1rem', paddingBottom: '1rem' }}>
                    <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
                        Showing {(page - 1) * 10 + 1}-{Math.min(page * 10, totalRecords)} of {totalRecords} batches
                    </span>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button className={sharedStyles.secondaryButton} disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
                        <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Page {page} of {totalPages}</span>
                        <button className={sharedStyles.secondaryButton} disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next</button>
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
                            <h2>🛠️ Debug Stage</h2>
                            <p>Diagnose and resolve deep-level technical failures.</p>
                        </div>
                    </div>
                    <BatchTable />
                </>
            ) : (
                <>
                    <div className={styles.headerBar}>
                        <div className={styles.headerInfo}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <button className={styles.backBtn} onClick={handleEndSession}>
                                    <ArrowLeft size={18} />
                                </button>
                                <h2 style={{ fontSize: '0.9rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, margin: 0 }}>Debug Page</h2>
                            </div>
                            <h1 className={styles.woNumber}>{activeBatch.batch_number}</h1>
                            <p className={styles.woMeta}>
                                📥 Active Debug: <span style={{ color: '#ef4444', fontWeight: 800 }}>{activeBatch.debug}</span> |
                                📋 Work Order Qty: {activeBatch.workOrderQty}
                            </p>
                        </div>
                        <button className={sharedStyles.secondaryButton} onClick={handleEndSession}>Close Session</button>
                    </div>

                    <div className={styles.scanContent}>
                        {/* Session Counters */}
                        <div className={sharedStyles.statsGrid} style={{ marginBottom: '1.5rem' }}>
                            <div className={sharedStyles.statCard}>
                                <div className={sharedStyles.statHeader}>
                                    <span className={sharedStyles.statTitle}>SCANNED</span>
                                    <div className={`${sharedStyles.statIcon} ${sharedStyles.blue}`}>
                                        <Monitor size={16} />
                                    </div>
                                </div>
                                <div className={sharedStyles.statValue}>{scannedItems.length}</div>
                                <div className={sharedStyles.statLabel}>Processed in session</div>
                            </div>
                            <div className={sharedStyles.statCard}>
                                <div className={sharedStyles.statHeader}>
                                    <span className={sharedStyles.statTitle}>PENDING</span>
                                    <div className={`${sharedStyles.statIcon} ${sharedStyles.orange}`}>
                                        <Clock size={16} />
                                    </div>
                                </div>
                                <div className={sharedStyles.statValue}>{activeBatch.pending}</div>
                                <div className={sharedStyles.statLabel}>Waiting for debug</div>
                            </div>
                            <div className={sharedStyles.statCard}>
                                <div className={sharedStyles.statHeader}>
                                    <span className={sharedStyles.statTitle}>PASSED</span>
                                    <div className={`${sharedStyles.statIcon} ${sharedStyles.green}`}>
                                        <CheckCircle size={16} />
                                    </div>
                                </div>
                                <div className={sharedStyles.statValue}>{scannedItems.length}</div>
                                <div className={sharedStyles.statLabel}>Successfully fixed</div>
                            </div>
                            <div className={sharedStyles.statCard}>
                                <div className={sharedStyles.statHeader}>
                                    <span className={sharedStyles.statTitle}>DEBUG</span>
                                    <div className={`${sharedStyles.statIcon} ${sharedStyles.red}`}>
                                        <Activity size={16} />
                                    </div>
                                </div>
                                <div className={sharedStyles.statValue}>{activeBatch.debug}</div>
                                <div className={sharedStyles.statLabel}>Active failures</div>
                            </div>
                        </div>

                        <div className={styles.operatorSection}>
                            <label>Debug Engineer</label>
                            <input type="text" className={styles.operatorInput} value={backendUser ? `${backendUser.name} (${backendUser.userId})` : (user?.name || "")} disabled />
                        </div>

                        <div className={styles.scanBoxWrapper}>
                            <form onSubmit={handleScan} className={styles.scanBox}>
                                <input
                                    ref={scanInputRef}
                                    type="text"
                                    className={styles.largeScanInput}
                                    placeholder="Scan Barcode or Unit Serial Number..."
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

                        <div className={styles.tableCard}>
                            <div className={styles.tableHeader}>
                                <h3>Recently Debugged ({scannedItems.length})</h3>
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
                                            <th>UNIT SERIAL NO</th>
                                            <th>DEBUGGED BY</th>
                                            <th>DEBUG DATE &amp; TIME</th>
                                            <th>STATUS</th>
                                            <th>FAILURE DATE &amp; TIME</th>
                                            <th>FAILURE REMARK</th>
                                            <th>DEBUG REMARK</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {scannedItems.filter(s => s.barcode?.toLowerCase().includes(tableSearch.toLowerCase()) || (s.unit_serial_number || '').toLowerCase().includes(tableSearch.toLowerCase())).map((scan) => (
                                            <tr key={scan.id}>
                                                <td className={styles.barcodeCell}>{scan.barcode}</td>
                                                <td style={{ color: scan.unit_serial_number ? '#22c55e' : '#475569', fontWeight: scan.unit_serial_number ? 700 : 400, fontFamily: 'monospace' }}>{scan.unit_serial_number || '-'}</td>
                                                <td>{scan.scanned_by}</td>
                                                <td>{new Date(scan.scanned_at).toLocaleString()}</td>
                                                <td><span className={styles.acceptedBadge}>PASSED</span></td>
                                                <td>{scan.failed_at ? new Date(scan.failed_at).toLocaleString() : '-'}</td>
                                                <td style={{ color: '#ef4444' }}>{scan.failure_remark || '-'}</td>
                                                <td style={{ fontWeight: 600 }}>{scan.repair_remark || scan.remarks || '-'}</td>
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
                                                                    await apiFetch(`/api/backend/debug/scan/${scan.id}`, { method: 'DELETE' });
                                                                    showToast('Record deleted successfully.', 'success');
                                                                    fetchScans(activeBatch!.id, activeBatch!.failedStageId);
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
                                        ))}
                                        {scannedItems.length === 0 && (
                                            <tr><td colSpan={9} style={{ textAlign: 'center', padding: '3rem' }}>No debug sessions recorded yet.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {pendingBarcode && (
                <ScanDecisionModal
                    barcode={pendingBarcode}
                    repairMode="DEBUG"
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
                    failedStageId={activeModal.failedStageId}
                    onClose={() => setActiveModal(null)}
                />
            )}

            {editingScan && (
                <EditScanModal
                    scanId={editingScan.id}
                    initialBarcode={editingScan.barcode}
                    initialUnitSerialNo={editingScan.unit_serial_number || ''}
                    onClose={() => setEditingScan(null)}
                    onSaveSuccess={() => {
                        fetchScans(activeBatch!.id, activeBatch!.failedStageId);
                    }}
                />
            )}
        </div>
    );
};

export default Debug;
