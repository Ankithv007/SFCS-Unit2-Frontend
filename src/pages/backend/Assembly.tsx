import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../../utils/api';
import styles from './Assembly.module.css';
import ExpandableText from '../../components/ExpandableText';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../hooks/useAuth';
import { Search, Package, Plus, Building2, Settings, Hash, User, Calendar, CheckCircle, MessageSquare, AlertTriangle } from 'lucide-react';

interface WorkOrder {
    id: number;
    wo_number: string;
    quantity: number;
    customer_name: string;
    model: string;
    created_by: string;
    created_at: string;
}

interface Batch {
    id: number;
    batch_number: string;
    work_order_id: number;
    wo_number: string;
    wo_qty: number;
    customer_name?: string;
    created_by: string;
    created_at: string;
    status: 'active' | 'completed';
    scanned_qty?: number;
    passed?: number;
    rework?: number;
    debug?: number;
}

interface ScanRecord {
    id: number;
    barcode: string;
    scanned_by: string;
    scanned_at: string;
    status: string;
    remarks: string;
    failed_at?: string | null;
    failed_remarks?: string | null;
    resolution_remarks?: string | null;
}

interface ScanDecisionModalProps {
    barcode: string;
    onFinalize: (status: string, remarks?: string) => void;
    onClose: () => void;
}

const ScanDecisionModal: React.FC<ScanDecisionModalProps> = ({ barcode, onFinalize, onClose }) => {
    const [mode, setMode] = useState<'select' | 'input'>('select');
    const [status, setStatus] = useState<'accepted' | 'rework' | 'debug'>('accepted');
    const [text, setText] = useState('');
    const [focusedIndex, setFocusedIndex] = useState(0);

    const bufferRef = useRef('');
    const actions: ('accepted' | 'rework' | 'debug')[] = ['accepted', 'rework', 'debug'];

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
                    if (bufferRef.current.toUpperCase() === 'RESOLVED') {
                        handleAction('accepted');
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

    const handleAction = (selectedStatus: 'accepted' | 'rework' | 'debug') => {
        if (selectedStatus === 'accepted') {
            onFinalize('accepted');
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
                                onClick={() => handleAction('accepted')}
                                onMouseEnter={() => setFocusedIndex(0)}
                            >
                                <CheckCircle size={32} className={styles.passIcon} />
                                Pass
                            </button>
                            <button
                                className={`${styles.decisionBtn} ${focusedIndex === 1 ? styles.defaultAction : ''}`}
                                onClick={() => handleAction('rework')}
                                onMouseEnter={() => setFocusedIndex(1)}
                            >
                                <MessageSquare size={32} className={styles.reworkIcon} />
                                Rework
                            </button>
                            <button
                                className={`${styles.decisionBtn} ${focusedIndex === 2 ? styles.defaultAction : ''}`}
                                onClick={() => handleAction('debug')}
                                onMouseEnter={() => setFocusedIndex(2)}
                            >
                                <AlertTriangle size={32} className={styles.debugIcon} />
                                Debug
                            </button>
                        </div>
                    ) : (
                        <div className={styles.inputGroup}>
                            <label style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>
                                {status === 'rework' ? 'Rework Details' : 'Debug Reason'} *
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
                                    onClick={() => onFinalize(status, text)}
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

const Assembly: React.FC = () => {
    const { user } = useAuth();
    const { showToast } = useToast();

    const [step, setStep] = useState<'select' | 'scan'>('select');
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
    const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
    const [batches, setBatches] = useState<Batch[]>([]);
    const [activeBatch, setActiveBatch] = useState<Batch | null>(null);
    const [scannedItems, setScannedItems] = useState<ScanRecord[]>([]);
    const [barcode, setBarcode] = useState('');
    const [tableSearch, setTableSearch] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [currentDateTime, setCurrentDateTime] = useState("");
    const scanInputRef = useRef<HTMLInputElement>(null);
    const [pendingBarcode, setPendingBarcode] = useState<string | null>(null);

    useEffect(() => {
        fetchWorkOrders();
        fetchBatches();
        const now = new Date();
        setCurrentDateTime(now.toLocaleString());
    }, []);

    useEffect(() => {
        if (step === 'scan' && scanInputRef.current && !pendingBarcode) {
            scanInputRef.current.focus();
        }
    });

    useEffect(() => {
        if (barcode.trim().length >= 14 && !isScanning && activeBatch) {
            handleScan();
        }
    }, [barcode, isScanning, activeBatch]);

    const fetchWorkOrders = async () => {
        try {
            const data = await apiFetch('/api/backend/work-order');
            if (data) setWorkOrders(data);
        } catch (error) {
            showToast('Failed to load work orders', 'error');
        }
    };

    const fetchBatches = async () => {
        try {
            const data = await apiFetch('/api/backend/assembly/batch');
            if (data) setBatches(data);
        } catch (error) {
            showToast('Failed to load batches', 'error');
        }
    };

    const fetchScans = async (batchId: number) => {
        try {
            const data = await apiFetch(`/api/backend/assembly/scan/${batchId}`);
            setScannedItems(data);
        } catch (error) {
            console.error('Error fetching scans:', error);
        }
    };

    const handleSelectWO = (id: string) => {
        const wo = workOrders.find(w => w.id === parseInt(id));
        setSelectedWO(wo || null);
    };

    const handleCreateBatch = async () => {
        if (!selectedWO) {
            showToast('Please select a Work Order', 'error');
            return;
        }
        try {
            const newBatch = await apiFetch('/api/backend/assembly/batch', {
                method: 'POST',
                body: JSON.stringify({
                    work_order_id: selectedWO.id,
                    created_by: user?.name || 'Operator'
                })
            });
            setActiveBatch(newBatch);
            setScannedItems([]);
            setStep('scan');
            setBarcode('');
            showToast(`Batch ${newBatch.batch_number} created`, 'success');
        } catch (error: any) {
            showToast(error.message || 'Failed to create batch', 'error');
        }
    };

    const handleResume = async (batch: Batch) => {
        try {
            await fetchScans(batch.id);
            setActiveBatch(batch);
            setStep('scan');
            setBarcode('');
            showToast(`Resuming session ${batch.batch_number}`, 'success');
        } catch (error) {
            showToast('Failed to resume session', 'error');
        }
    };

    const handleEndSession = () => {
        setActiveBatch(null);
        setStep('select');
        setSelectedWO(null);
        fetchBatches();
        showToast('Session ended', 'success');
    };

    const handleDeleteBatch = async (id: number) => {
        const isAdmin = user?.role?.toLowerCase().includes('admin');
        if (!isAdmin) {
            alert('Only admin can delete');
            return;
        }
        if (!window.confirm('Delete this batch? This will remove all associated scans.')) return;
        try {
            await apiFetch(`/api/backend/assembly/batch/${id}`, { method: 'DELETE' });
            showToast('Batch deleted successfully', 'success');
            fetchBatches();
        } catch (error) {
            showToast('Failed to delete batch', 'error');
        }
    };

    const handleScan = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!barcode.trim() || isScanning || !activeBatch) return;
        setPendingBarcode(barcode.trim().toUpperCase());
        setBarcode('');
    };

    const handleScanFinalize = async (status: string, remarks?: string) => {
        if (!pendingBarcode || !activeBatch) return;
        setIsScanning(true);
        try {
            let resolution_remarks = '';
            let failed_at = null;
            let failed_remarks = null;

            if (status.toLowerCase() === 'accepted') {
                const existing = scannedItems.find(item => 
                    item.barcode.trim().toUpperCase() === pendingBarcode.trim().toUpperCase() &&
                    (item.status.toLowerCase() === 'rework' || item.status.toLowerCase() === 'debug')
                );
                
                if (existing) {
                    failed_at = existing.failed_at || existing.scanned_at;
                    failed_remarks = existing.failed_remarks || existing.remarks;
                }

                try {
                    const res = await apiFetch(`/api/backend/rework/resolution/${pendingBarcode}`);
                    if (res && res.remarks) {
                        resolution_remarks = res.remarks;
                    }
                } catch (e) {
                    // Resolution not found
                }
            }

            const newScan = await apiFetch('/api/backend/assembly/scan', {
                method: 'POST',
                body: JSON.stringify({
                    batch_id: activeBatch.id,
                    barcode: pendingBarcode,
                    scanned_by: user?.name || 'Operator',
                    status: status,
                    remarks: remarks,
                    resolution_remarks: resolution_remarks,
                    failed_at: failed_at,
                    failed_remarks: failed_remarks
                })
            });
            setScannedItems(prev => {
                const isAccepted = status.toLowerCase() === 'accepted';
                if (isAccepted) {
                    const cleanedPrev = prev.filter(item => 
                        item.barcode.trim().toUpperCase() !== pendingBarcode.trim().toUpperCase()
                    );
                    return [newScan, ...cleanedPrev];
                }
                return [newScan, ...prev];
            });
            showToast(`Item marked as ${status.toUpperCase()}`, 'success');
            setPendingBarcode(null);
        } catch (error: any) {
            showToast(error.message || 'Scan failed', 'error');
        } finally {
            setIsScanning(false);
        }
    };

    const filteredItems = scannedItems.filter(item =>
        item.barcode.toLowerCase().includes(tableSearch.toLowerCase())
    );

    return (
        <div className={styles.container}>
            {!activeBatch ? (
                <>
                    <div className={styles.header}>
                        <div>
                            <h2>🛠️ Assembly Page</h2>
                            <p>Manage Assembly production sessions and verify scanning status.</p>
                        </div>
                    </div>

                    <div className={styles.card}>
                        <h2 className={styles.title}>
                            <Package size={18} /> Create New Assembly Batch
                        </h2>
                        <div className={styles.grid}>
                            <div className={styles.inputGroup}>
                                <label><Hash size={14} /> Work Order ID *</label>
                                <select className={styles.select} onChange={(e) => handleSelectWO(e.target.value)} defaultValue="">
                                    <option value="" disabled>-- Select Work Order --</option>
                                    {workOrders.filter(wo => !batches.some(b => b.wo_number === wo.wo_number)).map(wo => (
                                        <option key={wo.id} value={wo.id}>{wo.wo_number}</option>
                                    ))}
                                </select>
                            </div>
                            <div className={styles.inputGroup}>
                                <label><Building2 size={14} /> Customer Name *</label>
                                <input type="text" className={styles.input} value={selectedWO?.customer_name || ""} disabled />
                            </div>
                            <div className={styles.inputGroup}>
                                <label><Package size={14} /> Quantity *</label>
                                <input type="text" className={styles.input} value={selectedWO?.quantity || ""} disabled />
                            </div>
                            <div className={styles.inputGroup}>
                                <label><Settings size={14} /> Model *</label>
                                <input type="text" className={styles.input} value={selectedWO?.model || ""} disabled />
                            </div>
                            <div className={styles.inputGroup}>
                                <label><User size={14} /> Created By *</label>
                                <input type="text" className={styles.input} value={user?.name || "Operator"} disabled />
                            </div>
                            <div className={styles.inputGroup}>
                                <label><Calendar size={14} /> Created At *</label>
                                <input type="text" className={styles.input} value={currentDateTime} disabled />
                            </div>
                        </div>
                        <button className={styles.primaryBtn} onClick={handleCreateBatch} disabled={!selectedWO}>
                            <Plus size={16} /> Create Batch
                        </button>

                        <div className={styles.card} style={{ marginTop: '2rem' }}>
                            <h3>Pending Assembly Batches</h3>
                            <div className={styles.tableWrapper}>
                                <table className={styles.scanTable}>
                                    <thead>
                                        <tr>
                                            <th>Batch Number</th>
                                            <th>Customer Name</th>
                                            <th>Created By</th>
                                            <th>Date & Time</th>
                                            <th>Total QTY</th>
                                            <th>Scanned</th>
                                            <th>Passed</th>
                                            <th>Pending</th>
                                            <th>Rework</th>
                                            <th>Debug</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {batches.filter(b => (Number(b.scanned_qty) < Number(b.wo_qty)) || (Number(b.rework) > 0) || (Number(b.debug) > 0)).length > 0 ? (
                                            batches.filter(b => (Number(b.scanned_qty) < Number(b.wo_qty)) || (Number(b.rework) > 0) || (Number(b.debug) > 0)).map(batch => (
                                                <tr key={batch.id}>
                                                    <td style={{ fontWeight: 700, color: '#1e293b' }}>{batch.batch_number}</td>
                                                    <td>{batch.customer_name || "-"}</td>
                                                    <td>{batch.created_by}</td>
                                                    <td>{new Date(batch.created_at).toLocaleString()}</td>
                                                    <td style={{ fontWeight: 600 }}>{batch.wo_qty}</td>
                                                    <td className={styles.statusBlue}>{batch.scanned_qty ?? 0}</td>
                                                    <td className={styles.statusGreen}>{batch.passed ?? 0}</td>
                                                    <td style={{ fontWeight: 600, color: '#64748b' }}>{Math.max(0, (batch.wo_qty ?? 0) - (batch.scanned_qty ?? 0))}</td>
                                                    <td style={{ color: '#f59e0b', fontWeight: 700 }}>{batch.rework ?? 0}</td>
                                                    <td style={{ color: '#ef4444', fontWeight: 700 }}>{batch.debug ?? 0}</td>
                                                    <td className={styles.actionCell}>
                                                        <button className={styles.viewBtn} onClick={() => handleResume(batch)}>View</button>
                                                        <button className={styles.deleteBtn} onClick={() => handleDeleteBatch(batch.id)}>Delete</button>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr><td colSpan={11} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No pending batches</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className={styles.card} style={{ marginTop: '2rem', borderTop: '4px solid #10b981' }}>
                            <h3 style={{ color: '#059669' }}>Completed Assembly Batches</h3>
                            <div className={styles.tableWrapper}>
                                <table className={styles.scanTable}>
                                    <thead>
                                        <tr>
                                            <th>Batch Number</th>
                                            <th>Customer Name</th>
                                            <th>Created By</th>
                                            <th>Date & Time</th>
                                            <th>Total QTY</th>
                                            <th>Scanned</th>
                                            <th>Passed</th>
                                            <th>Pending</th>
                                            <th>Rework</th>
                                            <th>Debug</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {batches.filter(b => (Number(b.scanned_qty) >= Number(b.wo_qty)) && (Number(b.rework) === 0) && (Number(b.debug) === 0)).length > 0 ? (
                                            batches.filter(b => (Number(b.scanned_qty) >= Number(b.wo_qty)) && (Number(b.rework) === 0) && (Number(b.debug) === 0)).map(batch => (
                                                <tr key={batch.id}>
                                                    <td style={{ fontWeight: 700, color: '#1e293b' }}>{batch.batch_number}</td>
                                                    <td>{batch.customer_name || "-"}</td>
                                                    <td>{batch.created_by}</td>
                                                    <td>{new Date(batch.created_at).toLocaleString()}</td>
                                                    <td style={{ fontWeight: 600 }}>{batch.wo_qty}</td>
                                                    <td className={styles.statusBlue}>{batch.scanned_qty ?? 0}</td>
                                                    <td className={styles.statusGreen}>{batch.passed ?? 0}</td>
                                                    <td style={{ fontWeight: 600, color: '#64748b' }}>{Math.max(0, (batch.wo_qty ?? 0) - (batch.scanned_qty ?? 0))}</td>
                                                    <td style={{ color: '#f59e0b', fontWeight: 700 }}>{batch.rework ?? 0}</td>
                                                    <td style={{ color: '#ef4444', fontWeight: 700 }}>{batch.debug ?? 0}</td>
                                                    <td className={styles.actionCell}>
                                                        <button className={styles.viewBtn} onClick={() => handleResume(batch)}>View</button>
                                                        <button className={styles.deleteBtn} onClick={() => handleDeleteBatch(batch.id)}>Delete</button>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr><td colSpan={11} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No completed batches</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <div className={styles.headerBar}>
                        <div className={styles.headerInfo}>
                            <h2 style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Assembly Page</h2>
                            <h1 className={styles.woNumber}>{activeBatch.batch_number}</h1>
                            <p className={styles.woMeta}>
                                🏭 Total Serial Number Available: {activeBatch.wo_qty} |
                                ✅ Completed: {scannedItems.length} |
                                🔄 Pending: {Math.max(0, activeBatch.wo_qty - scannedItems.length)} |
                                📝 Passed: {scannedItems.filter(s => s.status === 'accepted').length} |
                                ⚠️ Rework: {scannedItems.filter(s => s.status === 'rework').length} |
                                🛠️ Debug: {scannedItems.filter(s => s.status === 'debug').length}
                            </p>
                        </div>
                        <button className={styles.endSessionBtn} onClick={handleEndSession}>End Session</button>
                    </div>

                    <div className={styles.scanContent}>
                        <div className={styles.operatorSection}>
                            <label>Scanned By</label>
                            <input type="text" className={styles.operatorInput} value={user?.name || ""} disabled />
                        </div>
                        <div className={styles.scanBoxWrapper}>
                            <form onSubmit={handleScan} className={styles.scanBox}>
                                <input ref={scanInputRef} type="text" className={styles.largeScanInput} placeholder="Scan Item Barcode..." value={barcode} onChange={(e) => setBarcode(e.target.value)} autoFocus />
                                <button type="submit" className={styles.largeScanBtn} disabled={isScanning}>{isScanning ? '...' : 'SCAN'}</button>
                            </form>
                        </div>
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
                                            <th>BARCODE <Search size={14} style={{ marginLeft: 4 }} /></th>
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
                                                    <td className={styles.barcodeCell}>{scan.barcode}</td>
                                                    <td>{scan.scanned_by}</td>
                                                    <td>{new Date(scan.scanned_at).toLocaleString()}</td>
                                                    <td>
                                                        {scan.status === 'accepted' && <span className={styles.acceptedBadge}>ACCEPTED</span>}
                                                        {scan.status === 'rework' && <span className={styles.reworkBadge}>REWORK</span>}
                                                        {scan.status === 'debug' && <span className={styles.failedBadge}>DEBUG</span>}
                                                    </td>
                                                    <td>{scan.status.toLowerCase() === 'accepted' && scan.failed_at ? new Date(scan.failed_at).toLocaleString() : "-"}</td>
                                                    <td>
                                                        <ExpandableText text={scan.failed_remarks || "-"} />
                                                    </td>
                                                    <td>
                                                        <ExpandableText text={scan.resolution_remarks || "-"} />
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                                                    No items found.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </>
            )}
            {pendingBarcode && <ScanDecisionModal barcode={pendingBarcode} onFinalize={handleScanFinalize} onClose={() => setPendingBarcode(null)} />}
        </div>
    );
};

export default Assembly;
