import React, { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'react-qr-code';
import styles from './Spi.module.css'; // sharing premium CSS styles
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
                background: t.type === 'error' ? '#fee2e2' : t.type === 'success' ? '#dcfce7' : '#e0f2fe',
                color: t.type === 'error' ? '#991b1b' : t.type === 'success' ? '#166534' : '#0c4a6e',
                border: `1px solid ${t.type === 'error' ? '#fca5a5' : t.type === 'success' ? '#86efac' : '#7dd3fc'}`,
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
    const [serials, setSerials] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [scanBarcode, setScanBarcode] = useState('');
    const [toasts, setToasts] = useState<Toast[]>([]);
    const toastId = useRef(0);
    const scanInputRef = useRef<HTMLInputElement>(null);
    const processingRef = useRef(false);
    const [allWoSerials, setAllWoSerials] = useState<any[]>([]);

    const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
        const id = ++toastId.current;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    }, []);

    const removeToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

    const fetchSerials = useCallback(async () => {
        setLoading(true);
        try {
            const url = new URL('/api/smt/serial-numbers', window.location.origin);
            url.searchParams.set('work_order_id', woId);
            const res = await fetch(url.toString());
            if (res.ok) {
                const data = await res.json();
                setAllWoSerials(data);

                // Filter for items whose LATEST overall inspection state is FAIL and process step was Post AOI
                const reworkItems = data.filter((s: any) =>
                    s.last_status === 'FAIL' && s.last_step === 'Post AOI'
                );
                setSerials(reworkItems);
            }
        } catch (err) {
            console.error('Error fetching rework serials:', err);
            addToast('Failed to load rework data.', 'error');
        } finally {
            setLoading(false);
        }
    }, [woId, addToast]);

    useEffect(() => {
        if (woId) fetchSerials();
    }, [woId, fetchSerials]);

    useEffect(() => {
        scanInputRef.current?.focus();
    }, []);

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
                const newInsp = await res.json();
                setSerials(prev => prev.map(s =>
                    s.id === serialId
                        ? { ...s, last_status: 'PASS', last_step: 'Rework', scanned_by: newInsp.scanned_by, scanned_at: newInsp.scanned_at, rework_reason: null }
                        : s
                ));
                addToast('Item marked as PASS/REPAIRED in rework.', 'success');
                // Refresh list
                fetchSerials();
                return true;
            } else {
                addToast('Failed to save PASS status.', 'error');
                return false;
            }
        } catch {
            addToast('Network error.', 'error');
            return false;
        }
    };

    const processScan = async (barcodeInput: string) => {
        if (processingRef.current) return;
        processingRef.current = true;

        const cleanInput = (barcodeInput || '').trim().replace(/-/g, '').toUpperCase();
        setScanBarcode('');

        if (!cleanInput) {
            processingRef.current = false;
            return;
        }

        // Find matches in all WO serial numbers
        const match = allWoSerials.find((s: any) =>
            [s.serial_number, s.barcode].some(v =>
                (v || '').toString().replace(/-/g, '').toUpperCase() === cleanInput
            )
        );

        if (!match) {
            addToast(`Barcode "${barcodeInput}" not found in this Work Order.`, 'error');
            alert(`Barcode "${barcodeInput}" not found in this Work Order.`);
            processingRef.current = false;
            scanInputRef.current?.focus();
            return;
        }

        // Must have failed in Post AOI
        if (match.last_status === 'PASS') {
            addToast(`Reject barcode: Barcode has already passed inspection.`, 'error');
            alert(`Reject barcode: Barcode "${barcodeInput}" is currently in PASS status (Stage: ${match.last_step || 'N/A'}). Rework is not required.`);
            processingRef.current = false;
            scanInputRef.current?.focus();
            return;
        }

        if (match.last_step !== 'Post AOI' || match.last_status !== 'FAIL') {
            addToast(`Reject barcode: Barcode has not failed in Post AOI stage.`, 'error');
            alert(`Reject barcode: Barcode "${barcodeInput}" did not fail in the Post AOI stage (Stage: ${match.last_step || 'N/A'}, Status: ${match.last_status || 'N/A'}). Cannot continue to Rework.`);
            processingRef.current = false;
            scanInputRef.current?.focus();
            return;
        }

        // Valid for rework scan! Marks as pass automatically
        await handleMarkPass(match.id);
        processingRef.current = false;
        scanInputRef.current?.focus();
    };

    // Auto-scan
    useEffect(() => {
        const clean = (scanBarcode || '').trim().replace(/-/g, '').toUpperCase();
        if (!clean || processingRef.current) return;
        const match = allWoSerials.find((s: any) =>
            [s.serial_number, s.barcode].some(v =>
                (v || '').toString().replace(/-/g, '').toUpperCase() === clean
            )
        );
        if (match) {
            processScan(scanBarcode);
        }
    }, [scanBarcode, allWoSerials]);

    const handleScan = (e: React.FormEvent) => {
        e.preventDefault();
        processScan(scanBarcode);
    };

    const sortedSerials = [...serials].sort((a, b) => {
        const timeA = a.scanned_at ? new Date(a.scanned_at).getTime() : Date.now();
        const timeB = b.scanned_at ? new Date(b.scanned_at).getTime() : Date.now();
        return timeB - timeA;
    });

    return (
        <>
            <style>{`
                @keyframes rowHighlight {
                    0% { box-shadow: inset 0 0 20px rgba(99, 102, 241, 0.4); }
                    100% { box-shadow: none; }
                }
            `}</style>
            <Toaster toasts={toasts} onRemove={removeToast} />
            <div className={styles.detailPage}>
                <div className={styles.detailHeaderCard} style={{ background: 'linear-gradient(to right, #fffbeb, #fef3c7)', border: '1px solid #fde68a' }}>
                    <div className={styles.detailHeaderRow}>
                        <div>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#92400e', marginBottom: '0.5rem' }}>🛠️ Rework Detail: {woId}</h3>
                            <div className={styles.detailStats} style={{ gap: '2rem' }}>
                                <span style={{ color: '#b45309' }}>Pending Rework: <strong>{serials.length}</strong></span>
                                <span style={{ color: '#b45309' }}>🏭 Work Order Total: <strong style={{ color: '#d97706' }}>{allWoSerials.length}</strong></span>
                                <span style={{ color: '#b45309' }}>✅ completed: <strong style={{ color: '#059669' }}>{allWoSerials.filter(s => s.last_step === 'Rework' && s.last_status === 'PASS').length}</strong></span>
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
                            <label style={{ marginBottom: '0.25rem' }}>Scan Item Barcode (must have FAILED in Post AOI)...</label>
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
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Rework Items ({serials.length})</h3>
                    </div>
                    <div className={styles.tableContainer}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th style={{ textAlign: 'center' }}>BARCODE PREVIEW</th>
                                    <th>BARCODE NUMBER</th>
                                    <th>DEFECT REASON</th>
                                    <th>STATUS</th>
                                    <th>SCANNED BY</th>
                                    <th>SCANNED AT</th>
                                    <th>ACTION</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>Loading...</td></tr>
                                ) : serials.length === 0 ? (
                                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>📦 No failed items waiting for rework</td></tr>
                                ) : sortedSerials.map((s, idx) => {
                                    const isPass = s.last_status === 'PASS';
                                    const isFail = s.last_status === 'FAIL';
                                    const isNew = Date.now() - new Date(s.scanned_at || 0).getTime() < 4000;
                                    const showBarcodeImage = s.barcode_source === 'GENERATED' || !s.barcode_source || (s.barcode_source === 'PRE_EXISTING' && s.serial_number);

                                    return (
                                        <tr 
                                            key={s.id || idx}
                                            style={{
                                                transition: 'all 0.2s',
                                                animation: isNew ? 'rowHighlight 4s ease-out' : undefined
                                            }}
                                        >
                                            <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                                {showBarcodeImage ? (
                                                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                                        <QRCode value={(s.serial_number || '').toUpperCase()} size={64} />
                                                    </div>
                                                ) : (
                                                    <span style={{ color: '#9ca3af' }}>-</span>
                                                )}
                                            </td>
                                            <td style={{ fontWeight: 700, color: '#1e293b', fontSize: '1rem' }}>
                                                {(s.serial_number || '').toUpperCase()}
                                            </td>
                                            <td style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 600 }}>
                                                {s.rework_reason || 'Defect Registered'}
                                            </td>
                                            <td>
                                                <span style={{
                                                    padding: '4px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700,
                                                    backgroundColor: isPass ? '#dcfce7' : isFail ? '#fee2e2' : '#fef3c7',
                                                    color: isPass ? '#166534' : isFail ? '#991b1b' : '#92400e'
                                                }}>
                                                    {isPass ? '✓ REWORKED' : isFail ? '● FAILED (Post AOI)' : '🕒 WAITING'}
                                                </span>
                                            </td>
                                            <td style={{ fontWeight: 600, color: '#475569' }}>
                                                {s.scanned_by || 'System'}
                                            </td>
                                            <td style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                                {s.scanned_at ? new Date(s.scanned_at).toLocaleString() : '-'}
                                            </td>
                                            <td>
                                                <button
                                                    onClick={() => handleMarkPass(s.id)}
                                                    className={styles.button}
                                                    style={{ height: '32px', padding: '0 12px', fontSize: '0.8rem', backgroundColor: '#059669' }}
                                                >
                                                    REPAIR PASS
                                                </button>
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

// ─── Main Page ────────────────────────────────────────────────────────────────
const Rework: React.FC = () => {
    const { smtUser, smtLogout } = useSmtAuth();
    const { user } = useAuth();
    const isSuperAdmin = (user?.role || '').toLowerCase() === 'admin' || user?.role === 'Super Admin';
    const [workOrders, setWorkOrders] = useState<any[]>([]);

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
    const [inspections, setInspections] = useState<any[]>([]);

    const fetchData = useCallback(async () => {
        try {
            const woRes = await fetch('/api/smt/work-orders/registered');
            if (woRes.ok) setWorkOrders(await woRes.json());

            const setupRes = await fetch('/api/smt/process-setups?process_name=rework');
            if (setupRes.ok) setSavedEntries(await setupRes.json());

            const inspRes = await fetch('/api/smt/inspections?process_step=Rework');
            if (inspRes.ok) {
                const data = await inspRes.json();
                setInspections(data);
            }

            if (smtUser) setCreatedBy(smtUser.name || smtUser.userId || 'System');
        } catch (err) {
            console.error('Failed to fetch rework metadata:', err);
        }
    }, [smtUser]);

    useEffect(() => {
        fetchData();
    }, [fetchData, smtUser]);

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

    const dropdownWorkOrders = workOrders.filter(wo => {
        const woId = wo.id || wo.work_order_id;
        const hasSetup = savedEntries.some(entry => (entry.work_order_id || '').toUpperCase() === woId.toUpperCase());
        const inspectedCount = inspections.filter(i => (i.work_order_id || '').toUpperCase() === woId.toUpperCase()).length;
        const targetQty = wo.scanned_count || wo.quantity || 0;
        const isCompleted = inspectedCount >= targetQty && targetQty > 0;
        return !hasSetup && !isCompleted;
    });

    const pendingEntries = savedEntries.filter(entry => {
        const wo = workOrders.find(w => (w.id || w.work_order_id).toUpperCase() === (entry.work_order_id || '').toUpperCase());
        const inspectedCount = inspections.filter(i => (i.work_order_id || '').toUpperCase() === (entry.work_order_id || '').toUpperCase()).length;
        const targetQty = wo ? (wo.scanned_count || wo.quantity) : 0;
        return inspectedCount < targetQty || targetQty === 0;
    });

    const completedEntries = savedEntries.filter(entry => {
        const wo = workOrders.find(w => (w.id || w.work_order_id).toUpperCase() === (entry.work_order_id || '').toUpperCase());
        if (!wo) return false;
        const inspectedCount = inspections.filter(i => (i.work_order_id || '').toUpperCase() === (entry.work_order_id || '').toUpperCase()).length;
        const targetQty = wo.scanned_count || wo.quantity;
        return inspectedCount >= targetQty && targetQty > 0;
    });

    if (viewingWoId) {
        return (
            <ReworkDetail
                woId={viewingWoId!}
                onBack={() => {
                    setViewingWoId(null);
                    fetchData();
                }}
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
                        <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#1e293b' }}>🛠️ SMT Rework</h2>
                        <p style={{ color: '#64748b' }}>
                            Manage SMT rework &amp; repair tasks. Logged in as: <strong>{smtUser?.name}</strong> | Shift: <strong>{getShift()}</strong>
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
                                {dropdownWorkOrders.map(wo => (
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

                {/* Pending Sessions */}
                <div className={styles.card}>
                    <h3>Pending Rework Sessions</h3>
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
                                {pendingEntries.map(entry => (
                                    <tr key={entry.id}>
                                        <td style={{ color: '#2563eb', fontWeight: 600 }}>{(entry.work_order_id || '').toUpperCase()}</td>
                                        <td>{(entry.product_name || '').toUpperCase()}</td>
                                        <td>{entry.quantity || entry.wo_qty}</td>
                                        <td>{entry.panel_qty || 'N/A'}</td>
                                        <td style={{ fontSize: '0.85rem', color: '#6b7280' }}>{new Date(entry.timestamp).toLocaleTimeString()}</td>
                                        <td style={{ display: 'flex', gap: '5px' }}>
                                            <button
                                                className={styles.button}
                                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', height: 'auto', lineHeight: 'normal', backgroundColor: '#3b82f6', borderColor: '#3b82f6' }}
                                                onClick={() => setViewingWoId(entry.work_order_id)}
                                            >
                                                Resume
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
                                {pendingEntries.length === 0 && (
                                    <tr>
                                        <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>No pending rework sessions found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Completed Sessions */}
                <div className={styles.card}>
                    <h3>Completed Rework Sessions</h3>
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
                                {completedEntries.map(entry => (
                                    <tr key={entry.id}>
                                        <td style={{ color: '#2563eb', fontWeight: 600 }}>{(entry.work_order_id || '').toUpperCase()}</td>
                                        <td>{(entry.product_name || '').toUpperCase()}</td>
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
                                {completedEntries.length === 0 && (
                                    <tr>
                                        <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>No completed rework sessions found.</td>
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
