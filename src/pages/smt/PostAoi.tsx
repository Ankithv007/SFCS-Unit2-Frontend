import React, { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'react-qr-code';
import styles from './PostAoi.module.css';
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
                fontWeight: 600, fontSize: '0.9rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                animation: 'slideIn 0.2s ease'
            }}>
                {t.type === 'error' ? '❌ ' : t.type === 'success' ? '✅ ' : 'ℹ️ '}{t.message}
            </div>
        ))}
    </div>
);

// ─── Detail View ──────────────────────────────────────────────────────────────
interface PostAoiDetailProps {
    woId: string;
    onBack: () => void;
    operatorName: string;
}

const PostAoiDetail: React.FC<PostAoiDetailProps> = ({ woId, onBack, operatorName }) => {
    // Table holds only serials that have been scanned in THIS session
    const [tableSerials, setTableSerials] = useState<any[]>([]);
    const [reworkTarget, setReworkTarget] = useState<number | null>(null);
    const [reworkReason, setReworkReason] = useState('');
    const [scanBarcode, setScanBarcode] = useState('');
    const [toasts, setToasts] = useState<Toast[]>([]);
    const toastId = useRef(0);
    const scanInputRef = useRef<HTMLInputElement>(null);

    // Focus scan input on mount
    useEffect(() => { scanInputRef.current?.focus(); }, []);

    const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
        const id = ++toastId.current;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    }, []);

    const removeToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

    // ── Scan Logic ──────────────────────────────────────────────────────────
    const processScan = async (barcodeInput: string) => {
        const cleanInput = barcodeInput.trim().replace(/-/g, '').toUpperCase();
        if (!cleanInput) return;

        // Duplicate check
        const alreadyInTable = tableSerials.find((s: any) =>
            [s.serial_number, s.barcode].some(v =>
                v?.toString().replace(/-/g, '').toUpperCase() === cleanInput
            )
        );
        if (alreadyInTable) {
            addToast(`Barcode ${barcodeInput} is already in the table.`, 'info');
            setScanBarcode('');
            return;
        }

        // Validate: must exist in SPI PASS records for this WO
        try {
            const url = new URL('/api/smt/serial-numbers', window.location.origin);
            url.searchParams.set('work_order_id', woId);
            url.searchParams.set('filter_step', 'SPI');
            url.searchParams.set('filter_status', 'PASS');

            const res = await fetch(url.toString());
            if (!res.ok) { addToast('Server error while validating barcode.', 'error'); setScanBarcode(''); return; }

            const spiPassed: any[] = await res.json();
            const match = spiPassed.find((s: any) =>
                [s.serial_number, s.barcode].some(v =>
                    v?.toString().replace(/-/g, '').toUpperCase() === cleanInput
                )
            );

            if (!match) {
                addToast(`Barcode ${barcodeInput} has not passed SPI yet`, 'error');
                setScanBarcode('');
                return;
            }

            // Add to table
            setTableSerials(prev => [...prev, match]);
            addToast(`${match.serial_number} added to inspection list.`, 'success');
        } catch {
            addToast('Network error. Please try again.', 'error');
        }

        setScanBarcode('');
        scanInputRef.current?.focus();
    };

    const handleScan = (e: React.FormEvent) => { e.preventDefault(); processScan(scanBarcode); };

    // Auto-scan when full barcode typed (optional keep)
    useEffect(() => {
        const clean = scanBarcode.trim().replace(/-/g, '').toUpperCase();
        if (!clean) return;
        const match = tableSerials.find((s: any) =>
            [s.serial_number, s.barcode].some(v =>
                v?.toString().replace(/-/g, '').toUpperCase() === clean
            )
        );
        if (match) processScan(scanBarcode);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scanBarcode]);

    // ── Pass / Fail ─────────────────────────────────────────────────────────
    const handleFailOnly = async (serialId: number) => {
        if (!reworkReason) { setReworkTarget(serialId); return; }
        try {
            const res = await fetch('/api/smt/inspections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serial_id: serialId,
                    process_step: 'Post AOI',
                    scanned_by: operatorName || 'System',
                    status: 'FAIL',
                    rework_reason: reworkReason
                })
            });
            if (res.ok) {
                setReworkTarget(null);
                setReworkReason('');
                // Update local row status
                setTableSerials(prev => prev.map(s =>
                    s.id === serialId ? { ...s, last_status: 'FAIL', last_step: 'Post AOI', rework_reason: reworkReason } : s
                ));
                addToast('Item marked as FAIL.', 'info');
            } else {
                addToast('Failed to save FAIL status.', 'error');
            }
        } catch { addToast('Network error.', 'error'); }
    };

    const handlePass = async (serialId: number) => {
        try {
            const res = await fetch('/api/smt/inspections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serial_id: serialId,
                    process_step: 'Post AOI',
                    scanned_by: operatorName || 'System',
                    status: 'PASS'
                })
            });
            if (res.ok) {
                setTableSerials(prev => prev.map(s =>
                    s.id === serialId ? { ...s, last_status: 'PASS', last_step: 'Post AOI' } : s
                ));
                addToast('Item marked as PASS.', 'success');
            } else {
                addToast('Failed to save PASS status.', 'error');
            }
        } catch { addToast('Network error.', 'error'); }
    };

    const failedCount = tableSerials.filter(s => s.last_status === 'FAIL' && s.last_step === 'Post AOI').length;

    return (
        <>
            <Toaster toasts={toasts} onRemove={removeToast} />
            <div className={styles.detailPage}>
                {/* Header */}
                <div className={styles.detailHeaderCard}>
                    <div className={styles.detailHeaderRow}>
                        <div>
                            <h3>🔬 Post AOI Detail: {woId}</h3>
                            <div className={styles.detailStats}>
                                <span>Scanned: <strong>{tableSerials.length}</strong></span>
                                <span style={{ color: '#b91c1c' }}>Failed: <strong>{failedCount}</strong></span>
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
                                onChange={(e) => setScanBarcode(e.target.value)}
                                placeholder="Scan Item Barcode (must have passed SPI)..."
                                className={styles.detailScanInput}
                                autoFocus
                            />
                            <button type="submit" className={styles.detailScanButton}>SCAN</button>
                        </div>
                    </form>
                </div>

                {/* Table */}
                <div className={styles.detailItemsSection}>
                    <div className={styles.detailItemsHeader}>
                        <h3>Items ({tableSerials.length})</h3>
                    </div>
                    <div className={styles.detailTableContainer}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>SERIAL NUMBER</th>
                                    <th>BARCODE</th>
                                    <th>STATUS</th>
                                    <th>ACTION</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tableSerials.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
                                            📷 Scan a barcode above to begin inspection
                                        </td>
                                    </tr>
                                ) : tableSerials.map((s, idx) => {
                                    const isFail = s.last_status === 'FAIL' && s.last_step === 'Post AOI';
                                    const isPass = s.last_status === 'PASS' && s.last_step === 'Post AOI';
                                    return (
                                        <tr key={s.id || idx} className={isFail ? styles.detailPendingRow : isPass ? styles.detailDoneRow : ''}>
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
                                            <td>
                                                <span style={{
                                                    padding: '4px 12px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 'bold',
                                                    backgroundColor: isFail ? '#fee2e2' : isPass ? '#dcfce7' : '#fef3c7',
                                                    color: isFail ? '#991b1b' : isPass ? '#166534' : '#92400e'
                                                }}>
                                                    {isFail ? '● FAIL' : isPass ? '✓ PASSED' : '🕒 PENDING'}
                                                </span>
                                            </td>
                                            <td>
                                                {reworkTarget === s.id ? (
                                                    <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                                                        <input
                                                            value={reworkReason}
                                                            onChange={e => setReworkReason(e.target.value)}
                                                            placeholder="Rework reason..."
                                                            autoFocus
                                                            style={{ padding: '0.65rem 1rem', border: '1px solid #cbd5e1', borderRadius: '0.65rem', minWidth: '200px' }}
                                                        />
                                                        <button type="button" onClick={() => handleFailOnly(s.id)} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '0.65rem', cursor: 'pointer', padding: '0.65rem 1rem' }}>Submit</button>
                                                        <button type="button" onClick={() => setReworkTarget(null)} style={{ background: '#f8fafc', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '0.65rem', cursor: 'pointer', padding: '0.65rem 1rem' }}>Cancel</button>
                                                    </div>
                                                ) : isFail ? (
                                                    <span style={{ color: '#b91c1c', fontWeight: 700 }}>FAILED → Rework</span>
                                                ) : isPass ? (
                                                    <span style={{ color: '#166534', fontWeight: 700 }}>PASSED</span>
                                                ) : (
                                                    <div style={{ display: 'flex', gap: '10px' }}>
                                                        <button type="button" onClick={() => handlePass(s.id)} style={{ background: '#22c55e', color: 'white', border: 'none', padding: '0.65rem 1.2rem', borderRadius: '0.65rem', cursor: 'pointer', fontWeight: 600 }}>Pass</button>
                                                        <button type="button" onClick={() => setReworkTarget(s.id)} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.65rem 1.2rem', borderRadius: '0.65rem', cursor: 'pointer', fontWeight: 600 }}>Fail</button>
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

// ─── Main Page ────────────────────────────────────────────────────────────────
const PostAoi: React.FC = () => {
    const { smtUser, smtLogout } = useSmtAuth();
    const [workOrders, setWorkOrders] = useState<any[]>([]);
    const [viewingWoId, setViewingWoId] = useState<string | null>(null);

    // Form state
    const [formWoId, setFormWoId] = useState('');
    const [productName, setProductName] = useState('');
    const [woQty, setWoQty] = useState('');
    const [panelQty, setPanelQty] = useState('');
    const [createdBy, setCreatedBy] = useState('');
    const [savedEntries, setSavedEntries] = useState<any[]>([]);

    // Track which WOs have already been opened (persisted to sessionStorage)
    const openedWosKey = 'postAoi_openedWos';
    const getOpenedWos = (): string[] => {
        try { return JSON.parse(sessionStorage.getItem(openedWosKey) || '[]'); } catch { return []; }
    };
    const markWoOpened = (woId: string) => {
        const opened = getOpenedWos();
        if (!opened.includes(woId)) sessionStorage.setItem(openedWosKey, JSON.stringify([...opened, woId]));
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const woRes = await fetch('/api/smt/work-orders/registered');
                if (woRes.ok) setWorkOrders(await woRes.json());

                const setupRes = await fetch('/api/smt/process-setups?process_name=POST_AOI');
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
        if (h >= 23 || h < 7) return 'C (11PM – 07AM)';
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
                body: JSON.stringify({
                    work_order_id: formWoId,
                    process_name: 'POST_AOI',
                    product_name: productName,
                    quantity: parseInt(woQty)
                })
            });

            if (res.ok) {
                const newEntry = await res.json();
                setSavedEntries(prev => [newEntry, ...prev]);

                const isFirstTime = !getOpenedWos().includes(formWoId);
                markWoOpened(formWoId);

                if (isFirstTime) {
                    // Auto-redirect on first start
                    setViewingWoId(formWoId);
                } else {
                    alert(`Post AOI Inspection started for WO: ${formWoId}`);
                }
            } else {
                alert('Failed to save Post AOI setup');
            }
        } catch (err) {
            console.error('Error saving setup:', err);
            alert('Connection error while saving setup');
        }
    };

    if (viewingWoId) {
        return (
            <PostAoiDetail
                woId={viewingWoId}
                onBack={() => setViewingWoId(null)}
                operatorName={smtUser?.name || 'System'}
            />
        );
    }

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#1e293b' }}>🤖 Post AOI Inspection</h2>
                    <p style={{ color: '#64748b' }}>
                        Manage SMT Automated Optical Inspection tasks. Logged in as: <strong>{smtUser?.name}</strong> | Shift: <strong>{getShift()}</strong>
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
                <h3 style={{ marginBottom: '1.5rem', borderBottom: '2px solid #f1f5f9', paddingBottom: '0.75rem' }}>Post AOI Setup Form</h3>
                <div className={styles.formGrid}>
                    <div className={styles.inputGroup}>
                        <label>Select Work Order (Serial Number Scanned Only) *</label>
                        <select className={styles.input} value={formWoId} onChange={(e) => handleSelectWo(e.target.value)}>
                            <option value="">-- Select Work Order --</option>
                            {workOrders.map((wo) => (
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
                    <button className={styles.button} onClick={handleStartProcess}>
                        Start Post AOI Inspection
                    </button>
                </div>
            </div>

            {/* Recent Entries */}
            <div className={styles.card}>
                <h3>Recent Post AOI Entries</h3>
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
                            {savedEntries.map((entry) => (
                                <tr key={entry.id}>
                                    <td style={{ color: '#2563eb', fontWeight: 600 }}>{entry.work_order_id}</td>
                                    <td>{entry.product_name}</td>
                                    <td>{entry.quantity || entry.wo_qty}</td>
                                    <td>{entry.panel_qty || 'N/A'}</td>
                                    <td style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                                        {new Date(entry.timestamp).toLocaleTimeString()}
                                    </td>
                                    <td style={{ display: 'flex', gap: '5px' }}>
                                        <button
                                            className={styles.secondaryButton}
                                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                                            onClick={() => setViewingWoId(entry.work_order_id || entry.wo_id || entry.work_order)}
                                        >
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
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                                        No recent entries found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PostAoi;
