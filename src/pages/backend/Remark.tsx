import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../../utils/api';
import styles from './Remark.module.css';
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
    scanned_qty: number;
    passed?: number;
    created_by: string;
    created_at: string;
    status: 'active' | 'completed';
    total_remarked?: number;
}

interface ScanRecord {
    id: number;
    barcode: string;
    scanned_by: string;
    scanned_at: string;
    status: string;
    previous_batch?: string;
    remarks?: string;
    stage?: string;
}

interface ScanDecisionModalProps {
    barcode: string;
    onFinalize: (status: string, remarks?: string) => void;
    onClose: () => void;
}

const ScanDecisionModal: React.FC<ScanDecisionModalProps> = ({ barcode, onFinalize, onClose }) => {
    const [mode, setMode] = useState<'select' | 'input'>('select');
    const [status, setStatus] = useState<'accepted' | 'remark' | 'debug'>('accepted');
    const [text, setText] = useState('');
    const [focusedIndex, setFocusedIndex] = useState(0);

    const bufferRef = useRef('');

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
                        if (focusedIndex === 0) {
                            handleAction('accepted');
                        }
                    }
                    bufferRef.current = '';
                } else if (e.key.length === 1) {
                    bufferRef.current += e.key;
                    // Clear buffer if it gets too long without Enter
                    if (bufferRef.current.length > 20) bufferRef.current = '';
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [mode, focusedIndex]);

    const handleAction = (selectedStatus: 'accepted' | 'remark' | 'debug') => {
        setStatus(selectedStatus);
        setMode('input');
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
                                onClick={() => handleAction('remark')}
                                disabled 
                                style={{ opacity: 0.5, cursor: 'not-allowed' }}
                                onMouseEnter={() => setFocusedIndex(1)}
                            >
                                <MessageSquare size={32} className={styles.remarkIcon} />
                                Remark
                            </button>
                            <button 
                                className={`${styles.decisionBtn} ${focusedIndex === 2 ? styles.defaultAction : ''}`} 
                                onClick={() => handleAction('debug')}
                                disabled 
                                style={{ opacity: 0.5, cursor: 'not-allowed' }}
                                onMouseEnter={() => setFocusedIndex(2)}
                            >
                                <AlertTriangle size={32} className={styles.debugIcon} />
                                Debug
                            </button>
                        </div>
                    ) : (
                        <div className={styles.inputGroup}>
                            <label style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>
                                {status === 'accepted' ? `What is Resolved action in ${barcode}?` : status === 'remark' ? `What is Remarked in ${barcode}?` : `What is Debugged in ${barcode}?`} *
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

const Remark: React.FC = () => {
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
    const [pendingBarcode, setPendingBarcode] = useState<string | null>(null);
    const [pendingStationItems, setPendingStationItems] = useState<any[]>([]);

    const scanInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchWorkOrders();
        fetchBatches();
        fetchPendingStationItems();
        setCurrentDateTime(new Date().toLocaleString());
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

    const filteredItems = scannedItems.filter(item =>
        item.barcode.toLowerCase().includes(tableSearch.toLowerCase())
    );

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
            const data = await apiFetch('/api/backend/remark/batches');
            if (data) setBatches(data);
        } catch (error) {
            showToast('Failed to load batches', 'error');
        }
    };

    const fetchPendingStationItems = async () => {
        try {
            const data = await apiFetch('/api/backend/remark/pending-items');
            if (data) setPendingStationItems(data);
        } catch (error) {
            console.error('Failed to load pending station items');
        }
    };

    const fetchScans = async (batchId: number) => {
        try {
            const data = await apiFetch(`/api/backend/remark/scans/${batchId}`);
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
        if (!selectedWO) return;
        try {
            const newBatch = await apiFetch('/api/backend/remark/batch', {
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
    };

    const handleDeleteBatch = async (id: number) => {
        const isAdmin = user?.role?.toLowerCase().includes('admin');
        if (!isAdmin) {
            alert('Only admin can delete');
            return;
        }
        if (!window.confirm('Delete this batch?')) return;
        try {
            await apiFetch(`/api/backend/remark/batch/${id}`, { method: 'DELETE' });
            showToast('Batch deleted', 'success');
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
            const newScan = await apiFetch('/api/backend/remark/scan', {
                method: 'POST',
                body: JSON.stringify({
                    batch_id: activeBatch.id,
                    barcode: pendingBarcode,
                    scanned_by: user?.name || 'Operator',
                    status: status,
                    remarks: remarks
                })
            });
            setScannedItems(prev => [newScan, ...prev]);
            showToast(`Item marked as ${status.toUpperCase()}`, 'success');
            setPendingBarcode(null);
            fetchPendingStationItems();
            fetchBatches();
        } catch (error: any) {
            showToast(error.message || 'Scan failed', 'error');
        } finally {
            setIsScanning(false);
        }
    };

    return (
        <div className={styles.container}>
            {!activeBatch ? (
                <>
                    <div className={styles.header}>
                        <div>
                            <h2>🛠️ Remark Batch Management</h2>
                            <p>Manage Remark production sessions and verify scanning status.</p>
                        </div>
                    </div>

                    <div className={styles.card}>
                        <h2 className={styles.title}><Package size={18} /> Create New Remark Batch</h2>
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
                    </div>

                    {/* Pending Table */}
                    <div className={styles.card} style={{ marginTop: '2rem' }}>
                        <h3>Pending Remark Batches</h3>
                        <div className={styles.tableWrapper}>
                            <table className={styles.scanTable}>
                                <thead>
                                    <tr>
                                        <th>Batch Number</th>
                                        <th>Customer Name</th>
                                        <th>Created By</th>
                                        <th>Date & Time</th>
                                        <th>Pending Remark</th>
                                        <th>Scanned</th>
                                        <th>Passed</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {batches.filter(b => Number(b.total_remarked ?? 0) > 0).length > 0 ? (
                                        batches.filter(b => Number(b.total_remarked ?? 0) > 0).map(batch => (
                                            <tr key={batch.id}>
                                                <td style={{ fontWeight: 700, color: '#1e293b' }}>{batch.batch_number}</td>
                                                <td>{batch.customer_name || "-"}</td>
                                                <td>{batch.created_by}</td>
                                                <td>{new Date(batch.created_at).toLocaleString()}</td>
                                                <td style={{ fontWeight: 600, color: '#f59e0b' }}>{batch.total_remarked ?? 0}</td>
                                                <td className={styles.statusBlue}>{batch.scanned_qty ?? 0}</td>
                                                <td className={styles.statusGreen}>{batch.passed ?? 0}</td>
                                                <td className={styles.actionCell}>
                                                    <button className={styles.viewBtn} onClick={() => handleResume(batch)}>View</button>
                                                    <button className={styles.deleteBtn} onClick={() => handleDeleteBatch(batch.id)}>Delete</button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No pending batches</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Completed Table */}
                    <div className={styles.card} style={{ marginTop: '2rem', borderTop: '4px solid #10b981' }}>
                        <h3 style={{ color: '#059669' }}>Completed Remark Batches</h3>
                        <div className={styles.tableWrapper}>
                            <table className={styles.scanTable}>
                                <thead>
                                    <tr>
                                        <th>Batch Number</th>
                                        <th>Customer Name</th>
                                        <th>Created By</th>
                                        <th>Date & Time</th>
                                        <th>Pending Remark</th>
                                        <th>Scanned</th>
                                        <th>Passed</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {batches.filter(b => Number(b.total_remarked ?? 0) === 0).length > 0 ? (
                                        batches.filter(b => Number(b.total_remarked ?? 0) === 0).map(batch => (
                                            <tr key={batch.id}>
                                                <td style={{ fontWeight: 700, color: '#1e293b' }}>{batch.batch_number}</td>
                                                <td>{batch.customer_name || "-"}</td>
                                                <td>{batch.created_by}</td>
                                                <td>{new Date(batch.created_at).toLocaleString()}</td>
                                                <td style={{ fontWeight: 600, color: '#f59e0b' }}>{batch.total_remarked ?? 0}</td>
                                                <td className={styles.statusBlue}>{batch.scanned_qty ?? 0}</td>
                                                <td className={styles.statusGreen}>{batch.passed ?? 0}</td>
                                                <td className={styles.actionCell}>
                                                    <button className={styles.viewBtn} onClick={() => handleResume(batch)}>View</button>
                                                    <button className={styles.deleteBtn} onClick={() => handleDeleteBatch(batch.id)}>Delete</button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No completed batches</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Pending Items from Stations */}
                    <div className={styles.card} style={{ marginTop: '2rem', borderLeft: '4px solid #f59e0b' }}>
                        <h3 style={{ color: '#d97706', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <AlertTriangle size={18} /> Items Pending Remark from Production Stations
                        </h3>
                        <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
                            These items were marked as 'Remark' at various production stages and require attention.
                        </p>
                        <div className={styles.tableWrapper}>
                            <table className={styles.scanTable}>
                                <thead>
                                    <tr>
                                        <th>Station</th>
                                        <th>Batch Number</th>
                                        <th>Barcode</th>
                                        <th>Reported By</th>
                                        <th>Time</th>
                                        <th>Defect/Remark</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pendingStationItems.length > 0 ? (
                                        pendingStationItems.map((item, idx) => (
                                            <tr key={idx}>
                                                <td style={{ fontWeight: 700, color: '#6366f1' }}>{item.station}</td>
                                                <td style={{ fontWeight: 700, color: '#1e293b' }}>{item.batch_number}</td>
                                                <td style={{ fontWeight: 600 }}>{item.barcode}</td>
                                                <td>{item.scanned_by}</td>
                                                <td>{new Date(item.scanned_at).toLocaleString()}</td>
                                                <td>
                                                    <span className={styles.remarkBadge} style={{ background: '#fef3c7', color: '#92400e' }}>
                                                        {item.remarks || "No remark provided"}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No items pending from stations</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <div className={styles.headerBar}>
                        <div className={styles.headerInfo}>
                            <h2 style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Remark Page</h2>
                            <h1 className={styles.woNumber}>{activeBatch.batch_number}</h1>
                            <p className={styles.woMeta}>
                                🏭 Total Remark Available: {activeBatch.wo_qty} | 
                                ✅ Resolved: {scannedItems.length} | 
                                🔄 Pending: {Math.max(0, activeBatch.wo_qty - scannedItems.length)} | 
                                📝 Passed: {scannedItems.filter(s => s.status === 'accepted').length} | 
                                ⚠️ Remark: {scannedItems.filter(s => s.status === 'remark').length} | 
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
                                <input
                                    ref={scanInputRef}
                                    type="text"
                                    className={styles.largeScanInput}
                                    placeholder="Scan Item Barcode..."
                                    value={barcode}
                                    onChange={(e) => setBarcode(e.target.value)}
                                    autoFocus
                                />
                                <button type="submit" className={styles.largeScanBtn} disabled={isScanning}>SCAN</button>
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
                                            <th>STAGES</th>
                                            <th>REMARK/DEBUG Remarks</th>
                                            <th>REMARK</th>
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
                                                        {scan.status === 'remark' && <span className={styles.remarkBadge}>REMARK</span>}
                                                        {scan.status === 'debug' && <span className={styles.failedBadge}>DEBUG</span>}
                                                    </td>
                                                    <td>
                                                        <span style={{ fontWeight: 600, color: '#6366f1' }}>{scan.stage || "-"}</span>
                                                    </td>
                                                    <td>{scan.previous_batch || "-"}</td>
                                                    <td>{scan.remarks || "-"}</td>
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

export default Remark;
