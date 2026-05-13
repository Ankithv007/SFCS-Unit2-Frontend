import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from './Rework.module.css';
import { useSmtAuth } from '../../context/SmtAuthContext';
import { useAuth } from '../../hooks/useAuth';
import { apiFetch } from '../../utils/api';

// ─── Toaster ─────────────────────────────────────────────────────────────────
interface Toast { id: number; message: string; type: 'success' | 'error' | 'info'; }

const Toaster: React.FC<{ toasts: Toast[]; onRemove: (id: number) => void }> = ({ toasts, onRemove }) => (
    <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 9999, display: 'flex', flexDirection: 'column-reverse', gap: '0.5rem' }}>
        {toasts.map(t => (
            <div key={t.id} onClick={() => onRemove(t.id)} style={{
                padding: '0.85rem 1.25rem', borderRadius: '0.6rem', cursor: 'pointer', minWidth: '280px',
                background: t.type === 'error' ? '#fee2e2' : t.type === 'success' ? '#dcfce7' : '#fffbeb',
                color: t.type === 'error' ? '#991b1b' : t.type === 'success' ? '#166534' : '#92400e',
                border: `1px solid ${t.type === 'error' ? '#fca5a5' : t.type === 'success' ? '#86efac' : '#fde68a'}`,
                fontWeight: 600, fontSize: '0.9rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                animation: 'slideIn 0.2s ease'
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
            url.searchParams.set('current_step', 'rework');

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
                    process_step: 'rework',
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
                addToast('Item marked as PASSED in rework.', 'success');
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
                    process_step: 'rework',
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
                addToast('Item marked as FAILED in rework.', 'info');
            } else {
                addToast('Failed to save FAIL status.', 'error');
            }
        } catch { addToast('Network error.', 'error'); }
    };

    // ── Barcode scan ─────────────────────────────────────────────────────────
    const processScan = useCallback(async (barcodeInput: string) => {
        if (processingRef.current) return;
        processingRef.current = true;

        const cleanInput = (barcodeInput || '').trim().replace(/-/g, '').toUpperCase();
        setScanBarcode('');

        if (!cleanInput) { processingRef.current = false; return; }

        const serialObj = serials.find((s: any) =>
            [s.serial_number, s.barcode].some(v =>
                (v || '').toString().replace(/-/g, '').toUpperCase() === cleanInput
            )
        );

        if (!serialObj) {
            addToast(`Barcode "${barcodeInput}" not found in rework list.`, 'error');
            processingRef.current = false;
            scanInputRef.current?.focus();
            return;
        }

        if (serialObj.rework_status === 'PASS') {
            addToast(`"${barcodeInput}" is already passed in rework.`, 'info');
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
        const clean = (scanBarcode || '').trim().replace(/-/g, '').toUpperCase();
        if (!clean || processingRef.current) return;
        const match = serials.find((s: any) =>
            [s.serial_number, s.barcode].some(v =>
                (v || '').toString().replace(/-/g, '').toUpperCase() === clean
            )
        );
        if (match) processScan(scanBarcode);
    }, [scanBarcode]); // intentionally omit processScan / serials to avoid infinite loop

    return (
        <>
            <Toaster toasts={toasts} onRemove={removeToast} />
            <div className={styles.detailPage}>
                <div className={styles.detailHeaderCard} style={{ background: 'linear-gradient(to right, #fffbeb, #fef3c7)', border: '1px solid #fde68a' }}>
                    <div className={styles.detailHeaderRow}>
                        <div>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#92400e', marginBottom: '0.5rem' }}>🛠️ rework Detail: {woId}</h3>
                            <div className={styles.detailStats} style={{ gap: '2rem' }}>
                                <span style={{ color: '#b45309' }}>Total Scanned: <strong>{serials.length}</strong></span>
                                <span style={{ color: '#b45309' }}>🏭 Available (Fail from SPI/AOI): <strong style={{ color: '#d97706' }}>{serials.length}</strong></span>
                                <span style={{ color: '#b45309' }}>✅ completed: <strong style={{ color: '#059669' }}>{serials.filter(s => s.rework_status === 'PASS').length}</strong></span>
                                <span style={{ color: '#b45309' }}>🔄 pending: <strong style={{ color: '#f59e0b' }}>{serials.length - serials.filter(s => s.rework_status === 'PASS').length}</strong></span>
                            </div>
                        </div>
                        <button className={styles.secondaryButton} onClick={onBack}>Back</button>
                    </div>
                </div>

                <div className={styles.card} style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div className={styles.inputGroup} style={{ maxWidth: '300px' }}>
                            <label>Scanned By *</label>
                            <input type="text" className={styles.input} value={operatorName} readOnly style={{ backgroundColor: '#f9fafb', height: '42px' }} />
                        </div>
                        <div className={styles.inputGroup}>
                            <label style={{ marginBottom: '0.25rem' }}>Scan Item Barcode (must be FAILED)...</label>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <form onSubmit={handleScan} style={{ flex: 1 }}>
                                    <input
                                        ref={scanInputRef}
                                        type="text"
                                        className={styles.input}
                                        placeholder="Scan barcode..."
                                        value={scanBarcode}
                                        onChange={(e) => setScanBarcode(e.target.value)}
                                        style={{ width: '100%', borderColor: '#f59e0b', borderWidth: '2px' }}
                                    />
                                </form>
                                <button className={styles.button} style={{ width: '140px', background: '#d97706' }} onClick={() => processScan(scanBarcode)}>SCAN</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className={styles.card}>
                    <div className={styles.tableHeader}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>rework Items ({serials.length})</h3>
                    </div>
                    <div className={styles.tableContainer}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>SERIAL NUMBER</th>
                                    <th>FAIL REASON</th>
                                    <th>STATUS</th>
                                    <th>ACTION</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>Loading...</td></tr>
                                ) : serials.length === 0 ? (
                                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>📦 No failed items waiting for rework</td></tr>
                                ) : serials.map((s, idx) => {
                                    const isPass = s.rework_status === 'PASS';
                                    const isFail = s.rework_status === 'FAIL';
                                    return (
                                        <tr key={s.id || idx}>
                                            <td style={{ color: '#9ca3af', fontWeight: 500 }}>{serials.length - idx}</td>
                                            <td style={{ fontWeight: 600 }}>{s.serial_number}</td>
                                            <td style={{ color: '#64748b', fontSize: '0.9rem' }}>{s.rework_reason || 'N/A'}</td>
                                            <td>
                                                <span style={{
                                                    padding: '4px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700,
                                                    backgroundColor: isPass ? '#dcfce7' : isFail ? '#fee2e2' : '#fef3c7',
                                                    color: isPass ? '#166534' : isFail ? '#991b1b' : '#92400e'
                                                }}>
                                                    {isPass ? '✓ reworkED' : isFail ? '● RE-FAIL' : '🕒 WAITING'}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    {!isPass && <button onClick={() => handleMarkPass(s.id)} className={styles.button} style={{ height: '32px', padding: '0 12px', fontSize: '0.8rem', backgroundColor: '#059669' }}>PASS</button>}
                                                    {!isPass && <FailButton serialId={s.id} onFail={handleMarkFail} />}
                                                </div>
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
    const { user } = useAuth();
    const isSuperAdmin = user?.role === 'Super Admin';
    const [workOrders, setWorkOrders] = useState<any[]>([]);

    // Toast state
    const [toasts, setToasts] = useState<Toast[]>([]);
    const toastId = useRef(0);

    const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
        const id = ++toastId.current;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    }, []);

    const removeToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));
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

                const setupRes = await fetch('/api/smt/process-setups?process_name=rework');
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
                body: JSON.stringify({ work_order_id: formWoId, process_name: 'rework', product_name: productName, quantity: parseInt(woQty) })
            });
            if (res.ok) {
                const newEntry = await res.json();
                setSavedEntries(prev => [newEntry, ...prev]);
                setViewingWoId(formWoId);
            } else {
                alert('Failed to save rework setup');
            }
        } catch (err) {
            console.error('Error saving setup:', err);
            alert('Connection error while saving setup');
        }
    };

    if (viewingWoId) {
        return (
            <ReworkDetail
                woId={viewingWoId!}
                onBack={() => setViewingWoId(null)}
                operatorName={smtUser?.name || 'System'}
            />
        );
    }

    return (
        <>
            <Toaster toasts={toasts} onRemove={removeToast} />
            <div className={styles.container}>
            <div className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#1e293b' }}>🛠️ SMT rework</h2>
                    <p style={{ color: '#64748b' }}>
                        Manage SMT rework &amp; Correction tasks. Logged in as: <strong>{smtUser?.name}</strong> | Shift: <strong>{getShift()}</strong>
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
                <h3 style={{ marginBottom: '1.5rem', borderBottom: '2px solid #f1f5f9', paddingBottom: '0.75rem' }}>rework Setup Form</h3>
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
                    <button className={styles.button} onClick={handleStartProcess}>Start rework Process</button>
                </div>
            </div>

            {/* Recent Entries */}
            <div className={styles.card}>
                <h3>Recent rework Entries</h3>
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
                                                if (!isSuperAdmin) {
                                                    addToast("Access Denied: Only Super Admin can delete.", "error");
                                                    return;
                                                }
                                                if (window.confirm('Are you sure you want to delete this entry?')) {
                                                    const res = await apiFetch(`/api/smt/process-setups/${entry.id}`, { method: 'DELETE' });
                                                    if (res.ok) {
                                                        setSavedEntries(prev => prev.filter(e => e.id !== entry.id));
                                                        addToast("Entry deleted successfully.", "success");
                                                    }
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
        </>
    );
};

export default Rework;
