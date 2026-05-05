import React, { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'react-qr-code';
import styles from './Rework.module.css';
import { useSmtAuth } from '../../context/SmtAuthContext';

// ─── Toaster ─────────────────────────────────────────────────────────────────
interface Toast { id: number; message: string; type: 'success' | 'error' | 'info'; }

const Toaster: React.FC<{ toasts: Toast[]; onRemove: (id: number) => void }> = ({ toasts, onRemove }) => (
    <div style={{ position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {toasts.map(t => (
            <div key={t.id} onClick={() => onRemove(t.id)} style={{
                padding: '0.85rem 1.25rem', borderRadius: '0.6rem', cursor: 'pointer', minWidth: '280px',
                background: t.type === 'error' ? '#fee2e2' : t.type === 'success' ? '#dcfce7' : '#e0f2fe',
                color: t.type === 'error' ? '#991b1b' : t.type === 'success' ? '#166534' : '#0c4a6e',
                border: `1px solid ${t.type === 'error' ? '#fca5a5' : t.type === 'success' ? '#86efac' : '#7dd3fc'}`,
                fontWeight: 600, fontSize: '0.9rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}>
                {t.type === 'error' ? '❌ ' : t.type === 'success' ? '✅ ' : 'ℹ️ '}{t.message}
            </div>
        ))}
    </div>
);

// ─── Detail View ──────────────────────────────────────────────────────────────
interface ReworkDetailProps {
    woId: string;
    onBack: () => void;
    operatorName: string;
}

const ReworkDetail: React.FC<ReworkDetailProps> = ({ woId, onBack, operatorName }) => {
    // All rework items – never filtered out after load
    const [serials, setSerials] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [scanBarcode, setScanBarcode] = useState('');
    const [toasts, setToasts] = useState<Toast[]>([]);
    const toastId = useRef(0);
    const scanInputRef = useRef<HTMLInputElement>(null);
    const processingRef = useRef(false); // debounce guard for auto-scan

    useEffect(() => { if (woId) fetchSerials(); }, [woId]);
    useEffect(() => { scanInputRef.current?.focus(); }, []);

    const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
        const id = ++toastId.current;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    }, []);

    const removeToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

    // Fetch ALL items that are currently in FAIL state from SPI or Post AOI
    // (initial load only — subsequent updates are done locally)
    const fetchSerials = async () => {
        setLoading(true);
        try {
            const url = new URL('/api/smt/serial-numbers', window.location.origin);
            url.searchParams.set('work_order_id', woId);
            url.searchParams.set('filter_status', 'FAIL');
            url.searchParams.set('current_step', 'Rework');

            const res = await fetch(url.toString());
            if (res.ok) {
                const data = await res.json();
                // Only items whose last status is FAIL from SPI or Post AOI
                const reworkItems = data.filter((s: any) =>
                    s.last_status === 'FAIL' &&
                    (s.last_step === 'SPI' || s.last_step === 'Post AOI')
                );
                setSerials(reworkItems);
            }
        } catch (err) {
            console.error('Error fetching serials:', err);
        } finally {
            setLoading(false);
        }
    };

    // ── Pass / Fail handlers — update LOCAL state only (no re-fetch) ─────────
    const handleMarkPass = async (serialId: number) => {
        try {
            const res = await fetch('/api/smt/inspections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serial_id: serialId,
                    process_step: 'Rework',
                    scanned_by: operatorName || 'System',
                    status: 'PASS'
                })
            });
            if (res.ok) {
                // Update row in place – item stays visible
                setSerials(prev => prev.map(s =>
                    s.id === serialId
                        ? { ...s, rework_status: 'PASS' }
                        : s
                ));
                addToast('Item marked as PASSED in Rework.', 'success');
            } else {
                addToast('Failed to save PASS status.', 'error');
            }
        } catch { addToast('Network error.', 'error'); }
    };

    const handleMarkFail = async (serialId: number, reason: string) => {
        try {
            const res = await fetch('/api/smt/inspections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serial_id: serialId,
                    process_step: 'Rework',
                    scanned_by: operatorName || 'System',
                    status: 'FAIL',
                    rework_reason: reason
                })
            });
            if (res.ok) {
                setSerials(prev => prev.map(s =>
                    s.id === serialId
                        ? { ...s, rework_status: 'FAIL', rework_fail_reason: reason }
                        : s
                ));
                addToast('Item marked as FAILED in Rework.', 'info');
            } else {
                addToast('Failed to save FAIL status.', 'error');
            }
        } catch { addToast('Network error.', 'error'); }
    };

    // ── Barcode scan ─────────────────────────────────────────────────────────
    const processScan = useCallback(async (barcodeInput: string) => {
        if (processingRef.current) return;
        processingRef.current = true;

        const cleanInput = barcodeInput.trim().replace(/-/g, '').toUpperCase();
        setScanBarcode('');

        if (!cleanInput) { processingRef.current = false; return; }

        const serialObj = serials.find((s: any) =>
            [s.serial_number, s.barcode].some(v =>
                v?.toString().replace(/-/g, '').toUpperCase() === cleanInput
            )
        );

        if (!serialObj) {
            addToast(`Barcode "${barcodeInput}" not found in Rework list.`, 'error');
            processingRef.current = false;
            scanInputRef.current?.focus();
            return;
        }

        if (serialObj.rework_status === 'PASS') {
            addToast(`"${barcodeInput}" is already passed in Rework.`, 'info');
            processingRef.current = false;
            scanInputRef.current?.focus();
            return;
        }

        await handleMarkPass(serialObj.id);
        processingRef.current = false;
        scanInputRef.current?.focus();
    }, [serials, addToast]);

    const handleScan = (e: React.FormEvent) => { e.preventDefault(); processScan(scanBarcode); };

    // Auto-scan when full barcode is typed
    useEffect(() => {
        const clean = scanBarcode.trim().replace(/-/g, '').toUpperCase();
        if (!clean || processingRef.current) return;
        const match = serials.find((s: any) =>
            [s.serial_number, s.barcode].some(v =>
                v?.toString().replace(/-/g, '').toUpperCase() === clean
            )
        );
        if (match) processScan(scanBarcode);
    }, [scanBarcode]); // intentionally omit processScan / serials to avoid infinite loop

    // ── Derived counts ───────────────────────────────────────────────────────
    const passedCount  = serials.filter(s => s.rework_status === 'PASS').length;
    const failedCount  = serials.filter(s => s.rework_status === 'FAIL').length;
    const pendingCount = serials.length - passedCount - failedCount;

    return (
        <>
            <Toaster toasts={toasts} onRemove={removeToast} />
            <div className={styles.detailPage}>
                {/* Header */}
                <div className={styles.detailHeaderCard}>
                    <div className={styles.detailHeaderRow}>
                        <div>
                            <h3>🛠️ Rework Detail: {woId}</h3>
                            <div className={styles.detailStats}>
                                <span>Total: <strong>{serials.length}</strong></span>
                                <span style={{ color: '#059669' }}>Passed: <strong>{passedCount}</strong></span>
                                <span style={{ color: '#d97706' }}>Pending: <strong>{pendingCount}</strong></span>
                                {failedCount > 0 && (
                                    <span style={{ color: '#dc2626' }}>Still Failed: <strong>{failedCount}</strong></span>
                                )}
                            </div>
                        </div>
                        <button onClick={onBack} className={styles.detailBackButton}>Back</button>
                    </div>
                </div>

                {/* Scan Bar */}
                <div className={styles.detailScanCard}>
                    <form onSubmit={handleScan} className={styles.detailScanForm}>
                        <div className={styles.detailOperatorGroup}>
                            <label>Scanned By *</label>
                            <input value={operatorName || 'System'} readOnly className={styles.detailOperatorInput} />
                        </div>
                        <div className={styles.detailScanRow}>
                            <input
                                ref={scanInputRef}
                                type="text"
                                value={scanBarcode}
                                onChange={e => setScanBarcode(e.target.value)}
                                placeholder="Scan barcode to mark as PASS..."
                                className={styles.detailScanInput}
                                autoFocus
                            />
                            <button type="submit" className={styles.detailScanButton}>SCAN</button>
                        </div>
                    </form>
                </div>

                {/* Table — all rework items always remain visible */}
                <div className={styles.detailItemsSection}>
                    <div className={styles.detailItemsHeader}>
                        <h3>Rework Items ({serials.length})</h3>
                    </div>
                    <div className={styles.detailTableContainer}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>SERIAL NUMBER</th>
                                    <th>BARCODE</th>
                                    <th>FAILURE REASON</th>
                                    <th>STATUS</th>
                                    <th>ACTION</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>Loading...</td></tr>
                                ) : serials.length === 0 ? (
                                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>No rework items found for this work order.</td></tr>
                                ) : serials.map((s, idx) => {
                                    const isPassed = s.rework_status === 'PASS';
                                    const isFailedAgain = s.rework_status === 'FAIL';
                                    const isPending = !isPassed && !isFailedAgain;

                                    return (
                                        <tr
                                            key={s.id || idx}
                                            className={isPassed ? styles.detailDoneRow : isFailedAgain ? styles.detailPendingRow : ''}
                                            style={isPassed ? { background: '#f0fdf4' } : isFailedAgain ? { background: '#fef2f2' } : {}}
                                        >
                                            <td style={{ color: '#9ca3af', fontWeight: 500 }}>{idx + 1}</td>
                                            <td className={styles.detailSerialCell}>{s.serial_number}</td>
                                            <td style={{ textAlign: 'center', padding: '0.75rem 0' }}>
                                                <div style={{ display: 'grid', gap: '0.4rem', justifyItems: 'center' }}>
                                                    <QRCode value={(s.barcode || s.serial_number).replace(/-/g, '')} size={72} />
                                                    <span style={{ fontSize: '0.75rem', color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '110px' }}>
                                                        {s.barcode || s.serial_number}
                                                    </span>
                                                </div>
                                            </td>
                                            <td style={{ color: '#ef4444', fontSize: '0.85rem' }}>{s.rework_reason || 'N/A'}</td>
                                            <td>
                                                <span style={{
                                                    padding: '4px 12px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 'bold',
                                                    backgroundColor: isPassed ? '#dcfce7' : isFailedAgain ? '#fee2e2' : '#fef3c7',
                                                    color: isPassed ? '#166534' : isFailedAgain ? '#991b1b' : '#92400e'
                                                }}>
                                                    {isPassed ? '✓ PASSED' : isFailedAgain ? '✗ FAILED' : '🕒 PENDING'}
                                                </span>
                                            </td>
                                            <td>
                                                {isPassed ? (
                                                    <span style={{ color: '#166534', fontWeight: 700 }}>✓ Done</span>
                                                ) : isPending ? (
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <button
                                                            onClick={() => handleMarkPass(s.id)}
                                                            style={{ background: '#22c55e', color: 'white', border: 'none', padding: '5px 14px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                                                        >Pass</button>
                                                        <FailButton serialId={s.id} onFail={handleMarkFail} />
                                                    </div>
                                                ) : (
                                                    // isFailedAgain — allow retry
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <button
                                                            onClick={() => handleMarkPass(s.id)}
                                                            style={{ background: '#22c55e', color: 'white', border: 'none', padding: '5px 14px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                                                        >Retry Pass</button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </>
    );
};

// Inline fail button with inline reason input to avoid prop-drilling reworkTarget state
const FailButton: React.FC<{ serialId: number; onFail: (id: number, reason: string) => void }> = ({ serialId, onFail }) => {
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState('');

    if (!open) return (
        <button onClick={() => setOpen(true)} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '5px 14px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>Fail</button>
    );

    return (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Reason..."
                autoFocus
                style={{ padding: '4px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', minWidth: '160px' }}
            />
            <button onClick={() => { if (!reason.trim()) { alert('Reason is mandatory.'); return; } onFail(serialId, reason); setOpen(false); setReason(''); }}
                style={{ background: '#ef4444', color: 'white', border: 'none', padding: '5px 12px', borderRadius: '4px', cursor: 'pointer' }}>
                Submit
            </button>
            <button onClick={() => { setOpen(false); setReason(''); }}
                style={{ background: '#f8fafc', color: '#334155', border: '1px solid #cbd5e1', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>
                Cancel
            </button>
        </div>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const Rework: React.FC = () => {
    const { smtUser, smtLogout } = useSmtAuth();
    const [workOrders, setWorkOrders] = useState<any[]>([]);
    const [viewingWoId, setViewingWoId] = useState<string | null>(null);

    const [formWoId, setFormWoId] = useState('');
    const [productName, setProductName] = useState('');
    const [woQty, setWoQty] = useState('');
    const [panelQty, setPanelQty] = useState('');
    const [createdBy, setCreatedBy] = useState('');
    const [savedEntries, setSavedEntries] = useState<any[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const woRes = await fetch('/api/smt/work-orders/registered');
                if (woRes.ok) setWorkOrders(await woRes.json());

                const setupRes = await fetch('/api/smt/process-setups?process_name=REWORK');
                if (setupRes.ok) setSavedEntries(await setupRes.json());

                if (smtUser) setCreatedBy(smtUser.name || smtUser.userId || 'System');
            } catch (err) {
                console.error('Failed to fetch data:', err);
            }
        };
        fetchData();
    }, [smtUser]);

    const handleSelectWo = (woId: string) => {
        setFormWoId(woId);
        const wo = workOrders.find(w => w.id === woId || w.work_order_id === woId);
        if (wo) {
            setProductName(wo.product_name);
            setWoQty(wo.quantity.toString());
            setPanelQty(wo.panel_quantity.toString());
        } else {
            setProductName(''); setWoQty(''); setPanelQty('');
        }
    };

    const getShift = () => {
        const h = new Date().getHours();
        if (h >= 23 || h < 7)  return 'C (11PM – 07AM)';
        if (h >= 15 && h < 23) return 'B (03PM – 11PM)';
        if (h >= 8  && h < 17) return 'G (08AM – 05PM)';
        if (h >= 6  && h < 15) return 'A (06AM – 03PM)';
        return 'N/A';
    };

    const handleStartProcess = async () => {
        if (!formWoId) { alert('Please select a Work Order.'); return; }
        try {
            const res = await fetch('/api/smt/process-setups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ work_order_id: formWoId, process_name: 'REWORK', product_name: productName, quantity: parseInt(woQty) })
            });
            if (res.ok) {
                const newEntry = await res.json();
                setSavedEntries(prev => [newEntry, ...prev]);
                setViewingWoId(formWoId);
            } else {
                alert('Failed to save Rework setup');
            }
        } catch (err) {
            console.error('Error saving setup:', err);
            alert('Connection error while saving setup');
        }
    };

    if (viewingWoId) {
        return (
            <ReworkDetail
                woId={viewingWoId}
                onBack={() => setViewingWoId(null)}
                operatorName={smtUser?.name || 'System'}
            />
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#1e293b' }}>🛠️ SMT Rework</h2>
                    <p style={{ color: '#64748b' }}>
                        Manage SMT Rework &amp; Correction tasks. Logged in as: <strong>{smtUser?.name}</strong> | Shift: <strong>{getShift()}</strong>
                    </p>
                </div>
                <button
                    onClick={() => { if (window.confirm('Are you sure you want to logout from SMT?')) smtLogout(); }}
                    className={styles.secondaryButton}
                    style={{ borderColor: '#ef4444', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                    <span>🔒</span> Logout SMT
                </button>
            </div>

            {/* Setup Form */}
            <div className={styles.card}>
                <h3 style={{ marginBottom: '1.5rem', borderBottom: '2px solid #f1f5f9', paddingBottom: '0.75rem' }}>Rework Setup Form</h3>
                <div className={styles.formGrid}>
                    <div className={styles.inputGroup}>
                        <label>Select Work Order *</label>
                        <select className={styles.input} value={formWoId} onChange={e => handleSelectWo(e.target.value)}>
                            <option value="">-- Select Work Order --</option>
                            {workOrders.map(wo => (
                                <option key={wo.id || wo.work_order_id} value={wo.id || wo.work_order_id}>
                                    {wo.id || wo.work_order_id} - {wo.product_name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className={styles.inputGroup}>
                        <label>Product Name (Auto-filled)</label>
                        <input type="text" className={styles.input} value={productName} disabled style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold' }} />
                    </div>
                    <div className={styles.inputGroup}>
                        <label>WO Qty (Auto-filled)</label>
                        <input type="number" className={styles.input} value={woQty} disabled style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold' }} />
                    </div>
                    <div className={styles.inputGroup}>
                        <label>Panel Qty (Auto-filled)</label>
                        <input type="number" className={styles.input} value={panelQty} disabled style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold' }} />
                    </div>
                    <div className={styles.inputGroup}>
                        <label>Generated By *</label>
                        <input type="text" className={styles.input} value={createdBy} readOnly style={{ backgroundColor: '#f3f4f6', color: '#6b7280', fontWeight: 'bold' }} />
                    </div>
                </div>
                <div style={{ marginTop: '30px' }}>
                    <button className={styles.button} onClick={handleStartProcess}>Start Rework Process</button>
                </div>
            </div>

            {/* Recent Entries */}
            <div className={styles.card}>
                <h3>Recent Rework Entries</h3>
                <div className={styles.tableContainer}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>WO NUMBER</th>
                                <th>PRODUCT NAME</th>
                                <th>WO QTY</th>
                                <th>PANEL QTY</th>
                                <th>TIME</th>
                                <th>ACTION</th>
                            </tr>
                        </thead>
                        <tbody>
                            {savedEntries.map(entry => (
                                <tr key={entry.id}>
                                    <td style={{ color: '#2563eb', fontWeight: 600 }}>{entry.work_order_id}</td>
                                    <td>{entry.product_name}</td>
                                    <td>{entry.quantity || entry.wo_qty}</td>
                                    <td>{entry.panel_qty || 'N/A'}</td>
                                    <td style={{ fontSize: '0.85rem', color: '#6b7280' }}>{new Date(entry.timestamp).toLocaleTimeString()}</td>
                                    <td style={{ display: 'flex', gap: '5px' }}>
                                        <button className={styles.secondaryButton} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setViewingWoId(entry.work_order_id)}>
                                            View
                                        </button>
                                        <button
                                            className={styles.secondaryButton}
                                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', borderColor: '#ef4444', color: '#ef4444' }}
                                            onClick={async () => {
                                                if (window.confirm('Are you sure you want to delete this entry?')) {
                                                    const res = await fetch(`/api/smt/process-setups/${entry.id}`, { method: 'DELETE' });
                                                    if (res.ok) setSavedEntries(prev => prev.filter(e => e.id !== entry.id));
                                                }
                                            }}
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {savedEntries.length === 0 && (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>No recent rework entries found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Rework;
