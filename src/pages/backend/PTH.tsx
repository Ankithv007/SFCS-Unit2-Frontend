import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../../utils/api';
import styles from './PTH.module.css';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../hooks/useAuth';
import { Search, Package, Plus } from 'lucide-react';

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
    created_by: string;
    created_at: string;
    status: 'active' | 'completed';
    scanned_count: number;
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
    previous_batch?: string;
    remarks?: string;
    selectedReason?: string;
}

interface FailModalProps {
    item: ScanRecord;
    remark: string;
    setRemark: (val: string) => void;
    onSubmit: () => void;
    onClose: () => void;
    error: string;
}

const FailModal: React.FC<FailModalProps> = ({ item, remark, setRemark, onSubmit, onClose, error }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const reason = item.selectedReason || "";

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.focus();
        }
    }, []);

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
                <div className={styles.modalHeader}>
                    <h3>{reason.toUpperCase()} Details - {item.barcode}</h3>
                </div>
                <div className={styles.modalBody}>
                    <div className={styles.inputGroup}>
                        <label>Remark *</label>
                        <textarea 
                            ref={textareaRef}
                            className={styles.textarea}
                            placeholder={`Enter ${reason} details...`}
                            value={remark}
                            onChange={(e) => {
                                setRemark(e.target.value);
                                e.target.style.height = 'auto';
                                e.target.style.height = e.target.scrollHeight + 'px';
                            }}
                        />
                    </div>
                    {error && <p className={styles.errorText}>{error}</p>}
                </div>
                <div className={styles.modalFooter}>
                    <button className={styles.secondaryBtn} onClick={onClose}>
                        Cancel
                    </button>
                    <button className={styles.primaryBtn} onClick={onSubmit}>
                        Submit Failure
                    </button>
                </div>
            </div>
        </div>
    );
};

const PTH: React.FC = () => {
    const { user } = useAuth();
    const { showToast } = useToast();

    // Navigation & State (State-based flow like Warehouse.tsx)
    const [step, setStep] = useState<'select' | 'scan'>('select');
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
    const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
    const [batches, setBatches] = useState<Batch[]>([]);
    const [activeBatch, setActiveBatch] = useState<Batch | null>(null);
    const [scannedItems, setScannedItems] = useState<ScanRecord[]>([]);

    // Scan Form State
    const [barcode, setBarcode] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [currentDateTime, setCurrentDateTime] = useState("");

    const scanInputRef = useRef<HTMLInputElement>(null);

    // Fail Modal State
    const [failItem, setFailItem] = useState<ScanRecord | null>(null);
    const [remark, setRemark] = useState("");
    const [modalError, setModalError] = useState("");

    // Initial load and refresh when returning to select step
    useEffect(() => {
        fetchWorkOrders();
        fetchBatches();
        
        // Set current date/time
        const now = new Date();
        setCurrentDateTime(now.toLocaleString());
    }, []);

    useEffect(() => {
        if (step === 'scan' && scanInputRef.current && !failItem) {
            scanInputRef.current.focus();
        }
    });

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
            const data = await apiFetch('/api/backend/pth/batch'); // Using singular as per request
            if (data) setBatches(data);
        } catch (error) {
            showToast('Failed to load batches', 'error');
        }
    };

    const fetchScans = async (batchId: number) => {
        try {
            const data = await apiFetch(`/api/backend/pth/scan/${batchId}`); // Using singular as per request
            setScannedItems(data);
        } catch (error) {
            console.error('Error fetching scans:', error);
        }
    };

    const handleSelectWO = (id: string) => {
        const wo = workOrders.find(w => w.id === parseInt(id));
        setSelectedWO(wo || null);
    };

    // STEP 2: CREATE BATCH (IMPORTANT)
    const handleCreateBatch = async () => {
        if (!selectedWO) {
            showToast('Please select a Work Order', 'error');
            return;
        }
        try {
            const newBatch = await apiFetch('/api/backend/pth/batch', {
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

    // STEP 7: RESUME FUNCTION
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

    // STEP 4: END SESSION (MOST IMPORTANT)
    const handleEndSession = async () => {
        if (!activeBatch) return;
        try {
            await apiFetch(`/api/backend/pth/batch/${activeBatch.id}/complete`, {
                method: 'PUT'
            });

            showToast('Session ended and batch saved', 'success');
            setActiveBatch(null);
            setStep('select');
            setSelectedWO(null);
            fetchBatches(); // 🔥 REFRESH TABLE
        } catch (error) {
            showToast('Failed to complete batch', 'error');
        }
    };

    const handleDeleteBatch = async (id: number) => {
        if (user?.role !== 'admin') {
            alert('Only admin can delete');
            return;
        }

        if (!window.confirm('Delete this batch? This will remove all associated scans.')) return;
        try {
            await apiFetch(`/api/backend/pth/batch/${id}`, { method: 'DELETE' });
            showToast('Batch deleted successfully', 'success');
            fetchBatches();
        } catch (error) {
            showToast('Failed to delete batch', 'error');
        }
    };

    const openFailModal = (item: ScanRecord, type: string) => {
        setFailItem({
            ...item,
            selectedReason: type
        });
        setRemark("");
        setModalError("");
        console.log("Opening fail modal with reason:", type);
    };

    const handleScan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!barcode.trim() || isScanning || !activeBatch) return;

        setIsScanning(true);
        try {
            // STEP 3: SCAN MODE (POST /backend/pth/scan)
            const newScan = await apiFetch('/api/backend/pth/scan', {
                method: 'POST',
                body: JSON.stringify({
                    work_order_id: activeBatch.work_order_id,
                    batch_id: activeBatch.id,
                    barcode: barcode.trim().toUpperCase(),
                    scanned_by: user?.name || 'Operator',
                    status: 'accepted'
                })
            });

            setBarcode('');
            setScannedItems(prev => [newScan, ...prev]);
            showToast('Item scanned', 'success');
        } catch (error: any) {
            showToast(error.message || 'Scan failed', 'error');
        } finally {
            setIsScanning(false);
            if (scanInputRef.current) scanInputRef.current.focus();
        }
    };

    const handleFailSubmit = async () => {
        if (!remark.trim()) {
            setModalError("Remark is required");
            return;
        }
        if (!failItem || !failItem.selectedReason) return;

        setModalError("");
        console.log("Submitting failure with status:", failItem.selectedReason);
        try {
            await apiFetch(`/api/backend/pth/scan/${failItem.id}/status`, {
                method: 'PUT',
                body: JSON.stringify({
                    status: failItem.selectedReason, // 🔥 Use reason as status
                    remarks: remark
                })
            });

            showToast(`Item marked as ${failItem.selectedReason.toUpperCase()}`, 'success');
            setFailItem(null);
            setRemark("");
            if (activeBatch) fetchScans(activeBatch.id);
        } catch (error) {
            showToast('Failed to update status', 'error');
        }
    };

    // --- MAIN RENDER (STATE-BASED SWITCHING LIKE PRECALIBRATION) ---
    return (
        <div className={styles.container}>
            {!activeBatch ? (
                <>
                    <div className={styles.header}>
                        <div>
                            <h2>⚙️ PTH Batch Management</h2>
                            <p>Manage PTH production sessions and verify scanning status.</p>
                        </div>
                    </div>

                    {/* Create Batch Section */}
                    <div className={styles.card}>
                        <h2 className={styles.title}>
                            <Package size={18} /> Create New PTH Batch
                        </h2>

                        <div className={styles.grid}>
                            <div className={styles.inputGroup}>
                                <label>Select Work Order *</label>
                                <select
                                    className={styles.select}
                                    onChange={(e) => handleSelectWO(e.target.value)}
                                    defaultValue=""
                                >
                                    <option value="" disabled>-- Select Work Order --</option>
                                    {workOrders.map(wo => (
                                        <option key={wo.id} value={wo.id}>{wo.wo_number}</option>
                                    ))}
                                </select>
                            </div>

                            <div className={styles.inputGroup}>
                                <label>Customer Name</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    value={selectedWO?.customer_name || ""}
                                    disabled
                                />
                            </div>

                            <div className={styles.inputGroup}>
                                <label>WO Quantity</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    value={selectedWO?.quantity || ""}
                                    disabled
                                />
                            </div>

                            <div className={styles.inputGroup}>
                                <label>Model</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    value={selectedWO?.model || ""}
                                    disabled
                                />
                            </div>

                            <div className={styles.inputGroup}>
                                <label>Created By</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    value={user?.name || "Operator"}
                                    disabled
                                />
                            </div>

                            <div className={styles.inputGroup}>
                                <label>Created At</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    value={currentDateTime}
                                    disabled
                                />
                            </div>
                        </div>

                        <button
                            className={styles.primaryBtn}
                            onClick={handleCreateBatch}
                            disabled={!selectedWO}
                        >
                            <Plus size={16} /> Create Batch
                        </button>
                    </div>

                    {/* Pending Table */}
                    <div className={styles.card} style={{ marginTop: '2rem' }}>
                        <h3>Recent PTH Batches</h3>
                        <div className={styles.tableWrapper}>
                            <table className={styles.scanTable}>
                                <thead>
                                    <tr>
                                        <th>Batch Number</th>
                                        <th>Created By</th>
                                        <th>Date</th>
                                        <th>Scanned Qty</th>
                                        <th>Passed</th>
                                        <th>Rework</th>
                                        <th>Debug</th>
                                        <th>Status</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {batches.length > 0 ? (
                                        batches.map(batch => (
                                            <tr key={batch.id}>
                                                <td style={{ fontWeight: 700, color: '#1e293b' }}>{batch.batch_number}</td>
                                                <td>{batch.created_by}</td>
                                                <td>{new Date(batch.created_at).toLocaleDateString()}</td>
                                                <td className={styles.statusBlue}>{batch.scanned_qty ?? 0}</td>
                                                <td className={styles.statusGreen}>{batch.passed ?? 0}</td>
                                                <td>{batch.rework ?? 0}</td>
                                                <td>{batch.debug ?? 0}</td>
                                                <td>
                                                    {batch.scanned_count >= batch.wo_qty ? (
                                                        <span className={styles.completed}>Completed</span>
                                                    ) : (
                                                        <span className={styles.pending}>Pending</span>
                                                    )}
                                                </td>
                                                <td className={styles.actionCell}>
                                                    <button
                                                        className={styles.viewBtn}
                                                        onClick={() => handleResume(batch)}
                                                    >
                                                        View
                                                    </button>
                                                    <button
                                                        className={styles.deleteBtn}
                                                        onClick={() => handleDeleteBatch(batch.id)}
                                                    >
                                                        Delete
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                                                No batches found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    {/* Header Bar */}
                    <div className={styles.headerBar}>
                        <div className={styles.headerInfo}>
                            <h1 className={styles.woNumber}>{activeBatch.batch_number}</h1>
                            <p className={styles.woMeta}>
                                Expected: {activeBatch.wo_qty} |
                                Scanned: {scannedItems.length} |
                                Created by: {activeBatch.created_by}
                            </p>
                        </div>
                        <button className={styles.endSessionBtn} onClick={handleEndSession}>
                            End Session
                        </button>
                    </div>

                    <div className={styles.scanContent}>
                        {/* Operator Name Input */}
                        <div className={styles.operatorSection}>
                            <label>Scanned By</label>
                            <input
                                type="text"
                                className={styles.operatorInput}
                                value={user?.name || ""}
                                disabled
                            />
                        </div>

                        {/* Scan Box */}
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

                        {/* Scanned Items Table */}
                        <div className={styles.tableCard}>
                            <div className={styles.tableHeader}>
                                <h3>Scanned Items ({scannedItems.length})</h3>
                            </div>
                            <div className={styles.tableWrapper}>
                                <table className={styles.scanTable}>
                                    <thead>
                                        <tr>
                                            <th>BARCODE <Search size={14} style={{ marginLeft: 4 }} /></th>
                                            <th>SCANNED BY</th>
                                            <th>TIME</th>
                                            <th>STATUS</th>
                                            <th>PREVIOUS BATCH</th>
                                            <th>REMARKS</th>
                                            <th>ACTION</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {scannedItems.length > 0 ? (
                                            scannedItems.map((scan) => (
                                                <tr key={scan.id}>
                                                    <td className={styles.barcodeCell}>{scan.barcode}</td>
                                                    <td>{scan.scanned_by}</td>
                                                    <td>{new Date(scan.scanned_at).toLocaleTimeString()}</td>
                                                    <td>
                                                        {scan.status === 'accepted' && (
                                                            <span className={styles.acceptedBadge}>ACCEPTED</span>
                                                        )}
                                                        {scan.status === 'rework' && (
                                                            <span className={styles.reworkBadge}>REWORK</span>
                                                        )}
                                                        {scan.status === 'debug' && (
                                                            <span className={styles.failedBadge}>DEBUG</span>
                                                        )}
                                                    </td>
                                                    <td>{scan.previous_batch || "-"}</td>
                                                    <td>{scan.remarks || "-"}</td>
                                                    <td className={styles.actionCell}>
                                                        <button 
                                                            className={styles.reworkBtn} 
                                                            onClick={() => openFailModal(scan, 'rework')}
                                                        >
                                                            Rework
                                                        </button>
                                                        <button 
                                                            className={styles.debugBtn} 
                                                            onClick={() => openFailModal(scan, 'debug')}
                                                        >
                                                            Debug
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                                                    No items scanned. Start scanning barcodes.
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

            {/* Fail Modal */}
            {failItem && (
                <FailModal 
                    item={failItem}
                    remark={remark}
                    setRemark={setRemark}
                    onSubmit={handleFailSubmit}
                    onClose={() => { setFailItem(null); setModalError(""); }}
                    error={modalError}
                />
            )}
        </div>
    );
};

export default PTH;
