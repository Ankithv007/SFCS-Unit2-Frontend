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

// ─── Detail View Component (Internal) ──────────────────────────────────────────
interface SmtFgDetailProps {
    woId: string;
    onBack: () => void;
    operatorName: string;
}

const SmtFgDetail: React.FC<SmtFgDetailProps> = ({ woId, onBack, operatorName }) => {
    const [tableSerials, setTableSerials] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [scanBarcode, setScanBarcode] = useState('');
    const [toasts, setToasts] = useState<Toast[]>([]);
    const toastId = useRef(0);
    const scanInputRef = useRef<HTMLInputElement>(null);
    const [allWoSerials, setAllWoSerials] = useState<any[]>([]);

    const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
        const id = ++toastId.current;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    }, []);

    const removeToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch all serials for this WO with their latest Post AOI step status
            const totalUrl = new URL('/api/smt/serial-numbers', window.location.origin);
            totalUrl.searchParams.set('work_order_id', woId);
            totalUrl.searchParams.set('current_step', 'Post AOI');
            const totalRes = await fetch(totalUrl.toString());
            if (totalRes.ok) {
                const totalData = await totalRes.json();
                setAllWoSerials(totalData);
            }

            // Fetch SMT FG history
            const inspUrl = new URL('/api/smt/inspections', window.location.origin);
            inspUrl.searchParams.set('work_order_id', woId);
            inspUrl.searchParams.set('process_step', 'SMT FG');
            const res = await fetch(inspUrl.toString());
            const data = res.ok ? await res.json() : [];

            const visited = data.map((i: any) => ({
                id: i.serial_id,
                serial_number: i.serial_number,
                barcode: i.serial_number,
                last_status: i.status,
                last_step: i.process_step,
                scanned_by: i.scanned_by,
                scanned_at: i.scanned_at,
                rework_reason: i.rework_reason
            }));
            setTableSerials(visited);
        } catch (err) {
            console.error('Error fetching SMT FG data:', err);
            addToast('Failed to load SMT FG data.', 'error');
        } finally {
            setLoading(false);
        }
    }, [woId, addToast]);

    useEffect(() => {
        fetchData();
        scanInputRef.current?.focus();
    }, [fetchData]);

    const handlePass = async (serialId: number) => {
        try {
            const res = await fetch('/api/smt/inspections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serial_id: serialId,
                    process_step: 'SMT FG',
                    scanned_by: operatorName || 'System',
                    status: 'PASS'
                })
            });
            if (res.ok) {
                const newInsp = await res.json();
                setTableSerials(prev => {
                    const exists = prev.find(s => s.id === serialId);
                    if (exists) {
                        return prev.map(s =>
                            s.id === serialId ? { ...s, last_status: 'PASS', last_step: 'SMT FG', scanned_by: newInsp.scanned_by, scanned_at: newInsp.scanned_at, rework_reason: null } : s
                        );
                    } else {
                        const sInfo = allWoSerials.find(s => s.id === serialId) || {};
                        return [{
                            id: serialId,
                            serial_number: sInfo.serial_number,
                            barcode: sInfo.serial_number,
                            last_status: 'PASS',
                            last_step: 'SMT FG',
                            scanned_by: newInsp.scanned_by,
                            scanned_at: newInsp.scanned_at,
                            barcode_source: sInfo.barcode_source,
                            rework_reason: null
                        }, ...prev];
                    }
                });
                addToast('Item marked as PASS.', 'success');
                return true;
            } else {
                const errData = await res.json().catch(() => ({}));
                addToast(errData.error || 'Failed to save SMT FG PASS status.', 'error');
                return false;
            }
        } catch {
            addToast('Network error.', 'error');
            return false;
        } finally {
            scanInputRef.current?.focus();
        }
    };



    const processScan = async (barcodeInput: string) => {
        const cleanInput = (barcodeInput || '').trim().replace(/-/g, '').toUpperCase();
        if (!cleanInput) return;

        const match = allWoSerials.find((s: any) =>
            [s.serial_number, s.barcode].some(v =>
                (v || '').toString().replace(/-/g, '').toUpperCase() === cleanInput
            )
        );

        if (!match) {
            addToast(`Barcode ${barcodeInput} not found in this Work Order.`, 'error');
            alert(`Barcode "${barcodeInput}" not found in this Work Order.`);
            setScanBarcode('');
            scanInputRef.current?.focus();
            return;
        }

        // Validate Post AOI status (must be PASS)
        if (match.step_status !== 'PASS') {
            addToast(`Previous stage not passed: Barcode has not passed Post AOI stage.`, 'error');
            alert(`Previous stage not passed: Barcode "${barcodeInput}" has not passed the Post AOI stage (current status: ${match.step_status || 'PENDING'}). Cannot continue to SMT Finished Goods release.`);
            setScanBarcode('');
            scanInputRef.current?.focus();
            return;
        }

        // Check duplicate or re-scans in SMT FG
        const alreadyInTable = tableSerials.find((s: any) =>
            [s.serial_number, s.barcode].some(v =>
                (v || '').toString().replace(/-/g, '').toUpperCase() === cleanInput
            )
        );

        if (alreadyInTable) {
            if (alreadyInTable.last_status === 'PASS') {
                addToast(`Barcode ${barcodeInput} has already passed SMT FG.`, 'info');
                alert(`Barcode "${barcodeInput}" has already passed SMT Finished Goods release.`);
                setScanBarcode('');
                scanInputRef.current?.focus();
                return;
            }
            // Auto-PASS on scan if it failed earlier
            await handlePass(alreadyInTable.id);
            setScanBarcode('');
            scanInputRef.current?.focus();
            return;
        }

        // Auto-PASS on scan
        await handlePass(match.id);
        setScanBarcode('');
        scanInputRef.current?.focus();
    };

    // Auto-scan effect
    useEffect(() => {
        const cleanInput = (scanBarcode || '').trim().replace(/-/g, '').toUpperCase();
        if (cleanInput.length < 5) return;

        const match = allWoSerials.find((s: any) =>
            [s.serial_number, s.barcode].some(v =>
                (v || '').toString().replace(/-/g, '').toUpperCase() === cleanInput
            )
        );

        if (match) {
            const alreadyInTable = tableSerials.find((s: any) =>
                [s.serial_number, s.barcode].some(v =>
                    (v || '').toString().replace(/-/g, '').toUpperCase() === cleanInput
                )
            );
            if (!alreadyInTable || alreadyInTable.last_status !== 'PASS') {
                processScan(scanBarcode);
            }
        }
    }, [scanBarcode, allWoSerials, tableSerials]);

    const handleScan = async (e: React.FormEvent) => {
        e.preventDefault();
        await processScan(scanBarcode);
    };

    const sortedTableSerials = [...tableSerials].sort((a, b) => {
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
                <div className={styles.detailHeaderCard} style={{ background: 'linear-gradient(to right, #e0f2fe, #f0f9ff)', border: '1px solid #bae6fd' }}>
                    <div className={styles.detailHeaderRow}>
                        <div>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#0369a1', marginBottom: '0.5rem' }}>📦 SMT FG Detail: {woId}</h3>
                            <div className={styles.detailStats} style={{ gap: '2rem' }}>
                                <span style={{ color: '#8b5cf6' }}>Post AOI Passed: <strong>{allWoSerials.filter(s => s.step_status === 'PASS').length}</strong></span>
                                <span style={{ color: '#0369a1' }}>Total Scanned: <strong style={{ color: '#2563eb' }}>{tableSerials.filter(s => s.last_status === 'PASS').length} / {allWoSerials.filter(s => s.step_status === 'PASS').length}</strong></span>
                                <span style={{ color: '#0369a1' }}>Passed: <strong>{tableSerials.filter(s => s.last_status === 'PASS').length}</strong></span>
                                <span style={{ color: '#0369a1' }}>Failed: <strong>{tableSerials.filter(s => s.last_status === 'FAIL').length}</strong></span>
                                <span style={{ color: '#0369a1' }}>Pending: <strong>{allWoSerials.filter(s => s.step_status === 'PASS').length - tableSerials.filter(s => s.last_status === 'PASS').length}</strong></span>
                            </div>
                        </div>
                        <button className={styles.secondaryButton} onClick={onBack}>Back</button>
                    </div>
                </div>

                <div className={styles.card} style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div className={styles.inputGroup} style={{ maxWidth: '300px' }}>
                            <label>Released By *</label>
                            <input type="text" className={styles.input} value={operatorName} readOnly style={{ backgroundColor: '#f9fafb', height: '42px' }} />
                        </div>
                        <div className={styles.inputGroup}>
                            <label style={{ marginBottom: '0.25rem' }}>Scan Item Barcode (must have passed Post AOI)...</label>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <form onSubmit={handleScan} style={{ flex: 1 }}>
                                    <input
                                        ref={scanInputRef}
                                        type="text"
                                        className={styles.input}
                                        placeholder="Scan barcode for final release..."
                                        value={scanBarcode}
                                        onChange={(e) => setScanBarcode(e.target.value)}
                                        style={{ width: '100%', borderColor: '#0284c7', borderWidth: '2px' }}
                                    />
                                </form>
                                <button className={styles.button} style={{ width: '140px', background: '#0284c7' }} onClick={() => processScan(scanBarcode)}>RELEASE</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className={styles.card}>
                    <div className={styles.tableHeader}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Finished Goods ({tableSerials.length})</h3>
                    </div>
                    <div className={styles.tableContainer}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th style={{ textAlign: 'center' }}>BARCODE PREVIEW</th>
                                    <th>BARCODE NUMBER</th>
                                    <th>STATUS</th>
                                    <th>RELEASED BY</th>
                                    <th>RELEASED AT</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>Loading...</td></tr>
                                ) : tableSerials.length === 0 ? (
                                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>📦 Scan a barcode above for Final Finished Goods release</td></tr>
                                ) : sortedTableSerials.map((s, idx) => {
                                    const isPass = s.last_status === 'PASS';
                                    const isFail = s.last_status === 'FAIL';
                                    const showBarcodeImage = s.barcode_source === 'GENERATED' || !s.barcode_source || (s.barcode_source === 'PRE_EXISTING' && s.serial_number);
                                    const isNew = Date.now() - new Date(s.scanned_at || 0).getTime() < 4000;

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
                                            <td style={{ padding: '1rem', fontWeight: 700, color: '#1e293b', fontSize: '1rem' }}>
                                                {(s.serial_number || '').toUpperCase()}
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                <span style={{
                                                    padding: '6px 14px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 'bold',
                                                    display: 'inline-flex', alignItems: 'center',
                                                    backgroundColor: isPass ? '#dcfce7' : isFail ? '#fee2e2' : '#fef3c7',
                                                    color: isPass ? '#166534' : isFail ? '#991b1b' : '#92400e'
                                                }}>
                                                    {isPass ? '✓ RELEASED' : isFail ? '● FG REJECT' : '🕒 PENDING'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem', fontWeight: 600, color: '#475569' }}>
                                                {s.scanned_by || 'System'}
                                            </td>
                                            <td style={{ padding: '1rem', fontSize: '0.85rem', color: '#64748b' }}>
                                                {s.scanned_at ? new Date(s.scanned_at).toLocaleString() : '-'}
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

// ─── Main Page Component ───────────────────────────────────────────────────────
const SMTFG: React.FC = () => {
    const { smtUser, smtLogout } = useSmtAuth();
    const { user } = useAuth();
    const isSuperAdmin = (user?.role || '').toLowerCase() === 'admin' || user?.role === 'Super Admin';
    const [workOrders, setWorkOrders] = useState<any[]>([]);
    const [selectedWoId, setSelectedWoId] = useState<string | null>(null);

    const [toasts, setToasts] = useState<Toast[]>([]);
    const toastId = useRef(0);

    const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
        const id = ++toastId.current;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    }, []);

    const removeToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

    const [formWoId, setFormWoId] = useState('');
    const [productName, setProductName] = useState('');
    const [woQty, setWoQty] = useState('');
    const [panelQty, setPanelQty] = useState('');
    const [barcodeSource, setBarcodeSource] = useState('');
    const [createdBy, setCreatedBy] = useState('');
    const [savedEntries, setSavedEntries] = useState<any[]>([]);
    const [inspections, setInspections] = useState<any[]>([]);
    const [postAoiInspections, setPostAoiInspections] = useState<any[]>([]);

    const fetchData = useCallback(async () => {
        try {
            const woRes = await fetch('/api/smt/work-orders/registered');
            if (woRes.ok) {
                const data = await woRes.json();
                setWorkOrders(data);
            }

            const setupRes = await fetch('/api/smt/process-setups?process_name=SMT_FG');
            if (setupRes.ok) {
                const data = await setupRes.json();
                setSavedEntries(data);
            }

            const inspRes = await fetch('/api/smt/inspections?process_step=SMT FG');
            if (inspRes.ok) {
                const data = await inspRes.json();
                setInspections(data);
            }

            const postAoiInspRes = await fetch('/api/smt/inspections?process_step=Post%20AOI');
            if (postAoiInspRes.ok) {
                const data = await postAoiInspRes.json();
                setPostAoiInspections(data);
            }

            if (smtUser) {
                setCreatedBy(smtUser.name || smtUser.userId || 'System');
            }
        } catch (err) {
            console.error("Failed to fetch SMT FG metadata:", err);
        }
    }, [smtUser]);

    useEffect(() => {
        fetchData();
    }, [fetchData, smtUser]);

    const handleSelectWo = (woId: string) => {
        setFormWoId(woId);
        const wo = workOrders.find(w => (w.id === woId || w.work_order_id === woId));
        if (wo) {
            setProductName(wo.product_name);
            setWoQty(wo.quantity.toString());
            setPanelQty(wo.panel_quantity.toString());
            setBarcodeSource(wo.barcode_source || 'GENERATED');
        } else {
            setProductName('');
            setWoQty('');
            setPanelQty('');
            setBarcodeSource('');
        }
    };

    const getShift = () => {
        const hour = new Date().getHours();
        if (hour >= 23 || hour < 7) return 'C (11PM - 07AM)';
        if (hour >= 15 && hour < 23) return 'B (03PM - 11PM)';
        if (hour >= 8 && hour < 17) return 'G (08AM - 05PM)';
        if (hour >= 6 && hour < 15) return 'A (06AM - 03PM)';
        return 'N/A';
    };

    const handleStartProcess = async () => {
        if (!formWoId) {
            alert('Please select a Work Order.');
            return;
        }

        try {
            const res = await fetch('/api/smt/process-setups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    work_order_id: formWoId,
                    process_name: 'SMT_FG',
                    product_name: productName,
                    quantity: parseInt(woQty)
                })
            });

            if (res.ok) {
                const newEntry = await res.json();
                setSavedEntries([newEntry, ...savedEntries]);
                setSelectedWoId(formWoId);
                alert(`Starting SMT Finished Goods release for WO: ${formWoId}`);
            } else {
                alert("Failed to save SMT FG setup");
            }
        } catch (err) {
            console.error("Error saving setup:", err);
            alert("Connection error while saving setup");
        }
    };

    const getPassedCount = (woId: string) => {
        const woInspections = inspections.filter(i => (i.work_order_id || '').toUpperCase() === woId.toUpperCase());
        const latestBySerial: { [key: number]: string } = {};
        const sorted = [...woInspections].sort((a, b) => new Date(a.scanned_at).getTime() - new Date(b.scanned_at).getTime());
        sorted.forEach(i => {
            latestBySerial[i.serial_id] = i.status;
        });
        return Object.values(latestBySerial).filter(status => status === 'PASS').length;
    };

    const getPostAoiPassedCount = (woId: string) => {
        const woInspections = postAoiInspections.filter(i => (i.work_order_id || '').toUpperCase() === woId.toUpperCase());
        const latestBySerial: { [key: number]: string } = {};
        const sorted = [...woInspections].sort((a, b) => new Date(a.scanned_at).getTime() - new Date(b.scanned_at).getTime());
        sorted.forEach(i => { latestBySerial[i.serial_id] = i.status; });
        return Object.values(latestBySerial).filter(status => status === 'PASS').length;
    };

    const dropdownWorkOrders = workOrders.filter(wo => {
        const woId = wo.id || wo.work_order_id;
        const hasSetup = savedEntries.some(entry => (entry.work_order_id || '').toUpperCase() === woId.toUpperCase());
        const passedCount = getPassedCount(woId);
        const targetQty = wo.scanned_count || wo.quantity || 0;
        const isCompleted = passedCount >= targetQty && targetQty > 0;
        return !hasSetup && !isCompleted;
    });

    const pendingEntries = savedEntries.filter(entry => {
        const woId = entry.work_order_id;
        const wo = workOrders.find(w => (w.id || w.work_order_id).toUpperCase() === (woId || '').toUpperCase());
        const passedCount = getPassedCount(woId);
        const targetQty = wo ? (wo.scanned_count || wo.quantity) : 0;
        return passedCount < targetQty || targetQty === 0;
    });

    const completedEntries = savedEntries.filter(entry => {
        const woId = entry.work_order_id;
        const wo = workOrders.find(w => (w.id || w.work_order_id).toUpperCase() === (woId || '').toUpperCase());
        if (!wo) return false;
        const passedCount = getPassedCount(woId);
        const targetQty = wo.scanned_count || wo.quantity;
        return passedCount >= targetQty && targetQty > 0;
    });

    return (
        <>
            <Toaster toasts={toasts} onRemove={removeToast} />
            <div className={styles.container}>
                <div className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#1e293b' }}>📦 SMT Finished Goods (FG)</h2>
                        <p style={{ color: '#64748b' }}>Manage SMT FG Release. Logged in as: <strong>{smtUser?.name}</strong> | Shift: <strong>{getShift()}</strong></p>
                    </div>
                    <button
                        onClick={() => {
                            if (window.confirm("Are you sure you want to logout from SMT?")) {
                                smtLogout();
                            }
                        }}
                        className={styles.secondaryButton}
                        style={{ borderColor: '#ef4444', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <span>🔒</span> Logout SMT
                    </button>
                </div>

                {selectedWoId ? (
                    <SmtFgDetail
                        woId={selectedWoId}
                        onBack={() => {
                            setSelectedWoId(null);
                            fetchData();
                        }}
                        operatorName={smtUser?.name || 'System'}
                    />
                ) : (
                    <>
                        <div className={styles.card}>
                            <h3 style={{ marginBottom: '1.5rem', borderBottom: '2px solid #f1f5f9', paddingBottom: '0.75rem' }}>SMT FG Setup Form</h3>
                            <div className={styles.formGrid}>
                                <div className={styles.inputGroup}>
                                    <label>Select Work Order *</label>
                                    <select className={styles.input} value={formWoId} onChange={(e) => handleSelectWo(e.target.value)}>
                                        <option value="">-- Select Work Order --</option>
                                        {dropdownWorkOrders.map((wo) => (
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
                                    <label>Barcode Source (Auto-filled)</label>
                                    <input type="text" className={styles.input} value={barcodeSource} disabled style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold' }} />
                                </div>

                                <div className={styles.inputGroup}>
                                    <label>Generated By *</label>
                                    <input type="text" className={styles.input} value={createdBy} readOnly style={{ backgroundColor: '#f3f4f6', color: '#6b7280', fontWeight: 'bold' }} />
                                </div>
                            </div>
                            <div style={{ marginTop: '30px' }}>
                                <button className={styles.button} onClick={handleStartProcess}>
                                    Start SMT FG Process
                                </button>
                            </div>
                        </div>

                        {/* Pending Sessions */}
                        <div className={styles.card}>
                            <h3>Pending SMT FG Sessions</h3>
                            <div className={styles.tableContainer}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>WORK ORDER</th>
                                            <th>LINE ID</th>
                                            <th>PRODUCT NAME</th>
                                            <th>BARCODE SOURCE</th>
                                            <th>TOTAL QTY</th>
                                            <th>POST AOI PASSED</th>
                                            <th>SCANNED QTY</th>
                                            <th>PENDING QTY</th>
                                            <th>STATUS</th>
                                            <th>ACTION</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pendingEntries.map((entry) => {
                                            const wo = workOrders.find(w => (w.id || w.work_order_id || '').toUpperCase() === (entry.work_order_id || '').toUpperCase());
                                            const barcodeSrc = wo?.barcode_source || 'GENERATED';
                                            const totalQty = entry.quantity || entry.wo_qty || (wo ? (wo.scanned_count || wo.quantity) : 0);
                                            const scannedQty = inspections.filter(i => (i.work_order_id || '').toUpperCase() === (entry.work_order_id || '').toUpperCase()).length;
                                            const postAoiPassedQty = getPostAoiPassedCount(entry.work_order_id);
                                            const pendingQty = Math.max(0, postAoiPassedQty - scannedQty);
                                            return (
                                                <tr key={entry.id}>
                                                    <td style={{ color: '#2563eb', fontWeight: 600 }}>{(entry.work_order_id || '').toUpperCase()}</td>
                                                    <td>{wo?.line_id || '-'}</td>
                                                    <td>{(entry.product_name || '').toUpperCase()}</td>
                                                    <td style={{ fontWeight: 'bold' }}>{barcodeSrc}</td>
                                                    <td>{totalQty}</td>
                                                    <td style={{ fontWeight: 'bold', color: '#3b82f6' }}>{postAoiPassedQty}</td>
                                                    <td style={{ color: '#2563eb', fontWeight: 'bold' }}>{scannedQty}</td>
                                                    <td style={{ color: '#f59e0b', fontWeight: 'bold' }}>{pendingQty}</td>
                                                    <td>
                                                        <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', backgroundColor: '#fef3c7', color: '#d97706' }}>
                                                            PENDING
                                                        </span>
                                                    </td>
                                                    <td style={{ display: 'flex', gap: '5px' }}>
                                                        <button
                                                            className={styles.button}
                                                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', height: 'auto', lineHeight: 'normal', backgroundColor: '#3b82f6', borderColor: '#3b82f6' }}
                                                            onClick={() => setSelectedWoId(entry.work_order_id || entry.wo_id || entry.work_order)}
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
                                                                    addToast("Access Denied: Only Super Admin can delete.", "error");
                                                                    return;
                                                                }
                                                                if (window.confirm('Are you sure you want to delete this entry?')) {
                                                                    await apiFetch(`/api/smt/process-setups/${entry.id}`, { method: 'DELETE' });
                                                                    setSavedEntries(prev => prev.filter(e => e.id !== entry.id));
                                                                    addToast("Entry deleted successfully.", "success");
                                                                }
                                                            }}
                                                        >
                                                            Delete
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {pendingEntries.length === 0 && (
                                            <tr>
                                                <td colSpan={10} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                                                    No pending SMT FG sessions found.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Completed Sessions */}
                        <div className={styles.card}>
                            <h3>Completed SMT FG Sessions</h3>
                            <div className={styles.tableContainer}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>WORK ORDER</th>
                                            <th>LINE ID</th>
                                            <th>PRODUCT NAME</th>
                                            <th>BARCODE SOURCE</th>
                                            <th>TOTAL QTY</th>
                                            <th>COMPLETED QTY</th>
                                            <th>STATUS</th>
                                            <th>ACTION</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {completedEntries.map((entry) => {
                                            const wo = workOrders.find(w => (w.id || w.work_order_id || '').toUpperCase() === (entry.work_order_id || '').toUpperCase());
                                            const barcodeSrc = wo?.barcode_source || 'GENERATED';
                                            const totalQty = entry.quantity || entry.wo_qty || (wo ? (wo.scanned_count || wo.quantity) : 0);
                                            const scannedQty = inspections.filter(i => (i.work_order_id || '').toUpperCase() === (entry.work_order_id || '').toUpperCase()).length;
                                            return (
                                                <tr key={entry.id}>
                                                    <td style={{ color: '#2563eb', fontWeight: 600 }}>{(entry.work_order_id || '').toUpperCase()}</td>
                                                    <td>{wo?.line_id || '-'}</td>
                                                    <td>{(entry.product_name || '').toUpperCase()}</td>
                                                    <td style={{ fontWeight: 'bold' }}>{barcodeSrc}</td>
                                                    <td>{totalQty}</td>
                                                    <td style={{ color: '#059669', fontWeight: 'bold' }}>{scannedQty}</td>
                                                    <td>
                                                        <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', backgroundColor: '#dcfce7', color: '#15803d' }}>
                                                            COMPLETED
                                                        </span>
                                                    </td>
                                                    <td style={{ display: 'flex', gap: '5px' }}>
                                                        <button
                                                            className={styles.secondaryButton}
                                                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                                                            onClick={() => setSelectedWoId(entry.work_order_id || entry.wo_id || entry.work_order)}
                                                        >
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
                await apiFetch(`/api/smt/process-setups/${entry.id}`, { method: 'DELETE' });
setSavedEntries(prev => prev.filter(e => e.id !== entry.id));
                    addToast("Entry deleted successfully.", "success");
                                                                }
                                                            }}
                                                        >
                                                            Delete
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {completedEntries.length === 0 && (
                                            <tr>
                                                <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                                                    No completed SMT FG sessions found.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </>
    );
};

export default SMTFG;
