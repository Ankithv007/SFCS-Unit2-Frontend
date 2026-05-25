import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSmtAuth } from '../../context/SmtAuthContext';
import { useAuth } from '../../hooks/useAuth';
import styles from './Printing.module.css';
import QRCode from 'react-qr-code';
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

// --- Detail View Component (Internal) ---
interface PrintingDetailProps {
    woId: string;
    onBack: () => void;
    operatorName: string;
    workOrderQty: number;
}

const PrintingDetail: React.FC<PrintingDetailProps> = ({ woId, onBack, operatorName, workOrderQty }) => {
    const [serials, setSerials] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [scanBarcode, setScanBarcode] = useState('');
    const [scannedBy, setScannedBy] = useState(operatorName);
    const scanInputRef = useRef<HTMLInputElement>(null);

    // Toast state
    const [toasts, setToasts] = useState<Toast[]>([]);
    const toastId = useRef(0);

    const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
        const id = ++toastId.current;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    }, []);

    const removeToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

    useEffect(() => {
        setScannedBy(operatorName);
    }, [operatorName]);

    useEffect(() => {
        if (woId) fetchSerials();
    }, [woId]);

    const fetchSerials = async () => {
        setLoading(true);
        try {
            // Fetch only those that passed PCB Generation
            const res = await fetch(`/api/smt/serial-numbers?work_order_id=${encodeURIComponent(woId)}&filter_step=PCB Generation&filter_status=PASS&current_step=Printing`);
            if (res.ok) {
                const data = await res.json();
                setSerials(data);
            }
        } catch (err) {
            console.error("Error fetching serials:", err);
            addToast("Failed to load serials list.", "error");
        } finally {
            setLoading(false);
        }
    };

    const handlePass = async (serialId: number) => {
        try {
            const res = await fetch('/api/smt/inspections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serial_id: serialId,
                    process_step: 'Printing',
                    scanned_by: scannedBy || 'System',
                    status: 'PASS'
                })
            });

            if (res.ok) {
                addToast('Item marked as PASS.', 'success');
                fetchSerials();
            } else {
                const errData = await res.json().catch(() => ({}));
                addToast(errData.error || "Failed to save printing record", 'error');
            }
        } catch (err) {
            console.error("Pass error:", err);
            addToast("Network error.", "error");
        } finally {
            scanInputRef.current?.focus();
        }
    };

    const scannedSerials = serials
        .filter(s => s.step_status !== null && s.step_status !== undefined)
        .sort((a, b) => new Date(b.step_scanned_at || 0).getTime() - new Date(a.step_scanned_at || 0).getTime());

    const processScan = async (barcodeInput: string) => {
        const cleanInput = barcodeInput.trim().replace(/-/g, "").toUpperCase();
        if (!cleanInput) return false;

        const serialObj = serials.find(s =>
            (s.serial_number && s.serial_number.replace(/-/g, "").toUpperCase() === cleanInput) ||
            (s.barcode && s.barcode.replace(/-/g, "").toUpperCase() === cleanInput)
        );

        if (!serialObj) {
            addToast(`Serial Number "${barcodeInput}" not found, does not belong to this Work Order, or has not passed PCB Generation stage!`, "error");
            setScanBarcode('');
            scanInputRef.current?.focus();
            return false;
        }

        // Check if already scanned and PASSed in Printing stage to prevent duplicates
        const alreadyScanned = scannedSerials.find(s => s.id === serialObj.id);
        if (alreadyScanned && alreadyScanned.step_status === 'PASS') {
            addToast(`Barcode "${barcodeInput}" has already been printed successfully (PASS)!`, "info");
            setScanBarcode('');
            scanInputRef.current?.focus();
            return false;
        }

        // Automatic PASS scan
        await handlePass(serialObj.id);
        setScanBarcode('');
        return true;
    };

    const handleScan = async (e: React.FormEvent) => {
        e.preventDefault();
        await processScan(scanBarcode);
    };

    useEffect(() => {
        scanInputRef.current?.focus();
    }, []);

    useEffect(() => {
        const tryAutoScan = async () => {
            const cleanInput = scanBarcode.trim().replace(/-/g, "").toUpperCase();
            if (cleanInput.length < 5) return; // Min length for auto-trigger

            const match = serials.find(s =>
                (s.serial_number && s.serial_number.replace(/-/g, "").toUpperCase() === cleanInput) ||
                (s.barcode && s.barcode.replace(/-/g, "").toUpperCase() === cleanInput)
            );

            // Only trigger auto scan if it has not been successfully processed yet (meaning it's not already PASS in scannedSerials)
            if (match) {
                const alreadyScanned = scannedSerials.find(s => s.id === match.id);
                if (!alreadyScanned || alreadyScanned.step_status !== 'PASS') {
                    await processScan(scanBarcode);
                }
            }
        };

        tryAutoScan();
    }, [scanBarcode, serials]);

    const passedQty = scannedSerials.filter(s => s.step_status === 'PASS').length;
    const failedQty = scannedSerials.filter(s => s.step_status === 'FAIL').length;
    const pendingQty = workOrderQty - passedQty;

    return (
        <div className={styles.detailPage}>
            <Toaster toasts={toasts} onRemove={removeToast} />
            <style>{`
                @keyframes rowHighlight {
                    0% { box-shadow: inset 0 0 20px rgba(59, 130, 246, 0.4); }
                    100% { box-shadow: none; }
                }
            `}</style>
            <div className={styles.detailHeaderCard}>
                <div className={styles.detailHeaderRow}>
                    <div>
                        <h3>🖨️ Printing Batch Detail: {woId}</h3>
                        <div className={styles.detailStats} style={{ gap: '1.5rem' }}>
                            <span style={{ color: '#475569' }}>Total Scanned: <strong style={{ color: '#2563eb' }}>{passedQty} / {workOrderQty}</strong></span>
                            <span style={{ color: '#059669' }}>Passed: <strong>{passedQty}</strong></span>
                            <span style={{ color: '#ef4444' }}>Failed: <strong>{failedQty}</strong></span>
                            <span style={{ color: '#d97706' }}>Pending: <strong>{pendingQty}</strong></span>
                        </div>
                    </div>
                    <button onClick={onBack} className={styles.detailBackButton}>Back</button>
                </div>
            </div>

            <div className={styles.detailScanCard}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className={styles.detailOperatorGroup} style={{ maxWidth: '300px' }}>
                        <label>Scanned By *</label>
                        <input
                            type="text"
                            value={scannedBy}
                            onChange={e => setScannedBy(e.target.value)}
                            placeholder="Operator name"
                            className={styles.detailOperatorInput}
                            readOnly
                            style={{ backgroundColor: '#f9fafb', height: '42px' }}
                        />
                    </div>
                    <div className={styles.detailScanRow}>
                        <form onSubmit={handleScan} style={{ flex: 1 }}>
                            <input
                                ref={scanInputRef}
                                type="text"
                                value={scanBarcode}
                                onChange={e => setScanBarcode(e.target.value)}
                                placeholder="Scan Item Barcode..."
                                className={styles.detailScanInput}
                                style={{ width: '100%', borderColor: '#3b82f6', borderWidth: '2px' }}
                            />
                        </form>
                        <button type="button" onClick={() => processScan(scanBarcode)} className={styles.detailScanButton}>SCAN</button>
                    </div>
                </div>
            </div>

            <div className={styles.detailItemsSection}>
                <div className={styles.detailItemsHeader}>
                    <h3>Items ({scannedSerials.length})</h3>
                </div>

                <div className={styles.detailTableContainer}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'center' }}>BARCODE PREVIEW</th>
                                <th>BARCODE NUMBER</th>
                                <th>STATUS</th>
                                <th>REMARK</th>
                                <th>SCANNED BY</th>
                                <th>SCANNED AT</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>Loading...</td></tr>
                            ) : scannedSerials.map((s, idx) => {
                                const isDone = s.step_status === 'PASS';
                                const isFailed = s.step_status === 'FAIL';
                                const barcodeValue = (s.serial_number || s.barcode || '').toUpperCase();
                                const isNew = Date.now() - new Date(s.step_scanned_at || 0).getTime() < 4000;

                                let badgeBg = '#f3f4f6';
                                let badgeColor = '#4b5563';
                                let badgeText = 'PENDING';

                                if (isDone) {
                                    badgeBg = '#dcfce7';
                                    badgeColor = '#15803d';
                                    badgeText = 'PASS';
                                } else if (isFailed) {
                                    badgeBg = '#fee2e2';
                                    badgeColor = '#b91c1c';
                                    badgeText = 'FAIL';
                                } else {
                                    badgeBg = '#fffbeb';
                                    badgeColor = '#d97706';
                                    badgeText = 'PENDING';
                                }

                                return (
                                    <tr 
                                        key={s.id || idx} 
                                        style={{ 
                                            backgroundColor: isDone ? '#f0fdf4' : '#fee2e2',
                                            transition: 'all 0.2s',
                                            animation: isNew ? 'rowHighlight 4s ease-out' : undefined
                                        }}
                                    >
                                        <td className={styles.detailQrCell}>
                                            {barcodeValue ? (
                                                <div className={styles.detailQrItem}>
                                                    <QRCode value={barcodeValue} size={64} />
                                                    <p>{barcodeValue}</p>
                                                </div>
                                            ) : (
                                                <span style={{ color: '#9ca3af' }}>-</span>
                                            )}
                                        </td>
                                        <td className={styles.detailSerialCell} style={{ fontWeight: 700, color: '#1e293b', fontSize: '1rem' }}>
                                            {(s.serial_number || '').toUpperCase()}
                                        </td>
                                        <td>
                                            <span style={{
                                                padding: '6px 14px',
                                                borderRadius: '999px',
                                                fontSize: '0.75rem',
                                                fontWeight: 'bold',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                backgroundColor: badgeBg,
                                                color: badgeColor
                                            }}>
                                                {badgeText === 'PASS' && '✓ '}
                                                {badgeText === 'FAIL' && '● '}
                                                {badgeText === 'PENDING' && '🕒 '}
                                                {badgeText}
                                            </span>
                                        </td>
                                        <td style={{ fontWeight: 500, color: isFailed ? '#b91c1c' : '#64748b' }}>
                                            {isFailed ? (s.step_remark || '-') : '-'}
                                        </td>
                                        <td style={{ fontWeight: 600, color: '#475569' }}>
                                            {s.step_scanned_by || 'System'}
                                        </td>
                                        <td style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                            {s.step_scanned_at ? new Date(s.step_scanned_at).toLocaleString() : '-'}
                                        </td>
                                    </tr>
                                );
                            })}
                            {!loading && scannedSerials.length === 0 && (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                                        No items scanned yet.
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

// --- Main Page Component ---
export const Printing: React.FC = () => {
    const { smtUser, smtLogout } = useSmtAuth();
    const { user } = useAuth();
    const isSuperAdmin = (user?.role || '').toLowerCase() === 'admin' || user?.role === 'Super Admin';
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

    // Form state
    const [formWoId, setFormWoId] = useState('');
    const [productName, setProductName] = useState('');
    const [woQty, setWoQty] = useState('');
    const [panelQty, setPanelQty] = useState('');
    const [stencilName, setStencilName] = useState('');
    const [squeezeNumber, setSqueezeNumber] = useState('');
    const [solderPaste, setSolderPaste] = useState('');
    const [side, setSide] = useState('TOP');
    const [savedEntries, setSavedEntries] = useState<any[]>([]);
    const [inspections, setInspections] = useState<any[]>([]);

    const fetchData = useCallback(async () => {
        try {
            const woRes = await fetch('/api/smt/work-orders/registered');
            if (woRes.ok) {
                const data = await woRes.json();
                setWorkOrders(data);
            }

            const setupRes = await fetch('/api/smt/process-setups?process_name=PRINTING');
            if (setupRes.ok) {
                const data = await setupRes.json();
                setSavedEntries(data);
            }

            const inspRes = await fetch('/api/smt/inspections?process_step=Printing');
            if (inspRes.ok) {
                const data = await inspRes.json();
                setInspections(data);
            }
        } catch (err) {
            console.error("Failed to fetch data:", err);
        }
    }, []);

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
        } else {
            setProductName('');
            setWoQty('');
            setPanelQty('');
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
        if (!stencilName.trim()) {
            alert('Please enter a Stencil Name.');
            return;
        }
        if (!squeezeNumber.trim()) {
            alert('Please enter a Squeegee Number.');
            return;
        }
        if (!solderPaste.trim()) {
            alert('Please enter Solder Paste details.');
            return;
        }

        try {
            const res = await fetch('/api/smt/process-setups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    work_order_id: formWoId,
                    process_name: 'PRINTING',
                    product_name: productName || 'N/A',
                    quantity: parseInt(woQty) || 0,
                    stencil_name: stencilName.trim(),
                    squeegee_number: squeezeNumber.trim(),
                    solder_paste: solderPaste.trim(),
                    side: side || 'TOP'
                })
            });

            if (res.ok) {
                const newEntry = await res.json();
                setSavedEntries([newEntry, ...savedEntries]);
                setViewingWoId(formWoId);
                alert(`Starting Printing Process for WO: ${formWoId}`);
            } else {
                const errorData = await res.json();
                alert(`Failed to save Printing setup: ${errorData.error || 'Unknown error'}`);
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
                        <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#1e293b' }}>🖨️ SMT Printing</h2>
                        <p style={{ color: '#64748b' }}>Manage SMT Stencil Printing tasks. Logged in as: <strong>{smtUser?.name}</strong> | Shift: <strong>{getShift()}</strong></p>
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

                {viewingWoId ? (
                    <PrintingDetail
                        woId={viewingWoId}
                        onBack={() => {
                            setViewingWoId(null);
                            fetchData();
                        }}
                        operatorName={smtUser?.name || 'System'}
                        workOrderQty={workOrders.find(w => (w.id || w.work_order_id).toUpperCase() === (viewingWoId || '').toUpperCase())?.quantity || 0}
                    />
                ) : (
                    <>
                        <div className={styles.card}>
                            <h3 style={{ marginBottom: '1.5rem', borderBottom: '2px solid #f1f5f9', paddingBottom: '0.75rem' }}>Printing Setup Form</h3>
                            <div className={styles.formGrid}>
                                <div className={styles.inputGroup}>
                                    <label>Select Work Order *</label>
                                    <select
                                        className={styles.input}
                                        value={formWoId}
                                        onChange={(e) => handleSelectWo(e.target.value)}
                                    >
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
                                    <input
                                        type="text"
                                        className={styles.input}
                                        value={productName}
                                        disabled
                                        style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold' }}
                                    />
                                </div>

                                <div className={styles.inputGroup}>
                                    <label>WO Qty (Auto-filled)</label>
                                    <input
                                        type="number"
                                        className={styles.input}
                                        value={woQty}
                                        disabled
                                        style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold' }}
                                    />
                                </div>

                                <div className={styles.inputGroup}>
                                    <label>Panel Qty (Auto-filled)</label>
                                    <input
                                        type="number"
                                        className={styles.input}
                                        value={panelQty}
                                        disabled
                                        style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold' }}
                                    />
                                </div>

                                <div className={styles.inputGroup}>
                                    <label>Stencil Name *</label>
                                    <input
                                        type="text"
                                        className={styles.input}
                                        value={stencilName}
                                        onChange={(e) => setStencilName(e.target.value.replace(/[^a-zA-Z\s]/g, ''))}
                                        placeholder="Enter Stencil Name"
                                    />
                                </div>

                                <div className={styles.inputGroup}>
                                    <label>Squeegee Number *</label>
                                    <input
                                        type="text"
                                        className={styles.input}
                                        value={squeezeNumber}
                                        onChange={(e) => setSqueezeNumber(e.target.value.replace(/[^0-9]/g, ''))}
                                        placeholder="Enter Squeegee Number"
                                    />
                                </div>

                                <div className={styles.inputGroup}>
                                    <label>Solder Paste *</label>
                                    <input
                                        type="text"
                                        className={styles.input}
                                        value={solderPaste}
                                        onChange={(e) => setSolderPaste(e.target.value)}
                                        placeholder="Enter Solder Paste"
                                    />
                                </div>

                                <div className={styles.inputGroup}>
                                    <label>Side Selection *</label>
                                    <select
                                        className={styles.input}
                                        value={side}
                                        onChange={(e) => setSide(e.target.value)}
                                    >
                                        <option value="TOP">TOP</option>
                                        <option value="BOTTOM">BOTTOM</option>
                                    </select>
                                </div>
                            </div>
                            <div style={{ marginTop: '30px' }}>
                                <button className={styles.button} onClick={handleStartProcess}>
                                    Start Printing Process
                                </button>
                            </div>
                        </div>

                        <div className={styles.card}>
                            <h3>Pending Printing Sessions</h3>
                            <div className={styles.tableContainer}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>WO NUMBER</th>
                                            <th>PRODUCT NAME</th>
                                            <th>WO QTY</th>
                                            <th>PANEL QTY</th>
                                            <th>STENCIL NAME</th>
                                            <th>SQUEEGEE NUMBER</th>
                                            <th>SOLDER PASTE</th>
                                            <th>SIDE</th>
                                            <th>TIME</th>
                                            <th>ACTION</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pendingEntries.map((entry) => (
                                            <tr key={entry.id}>
                                                <td style={{ color: '#2563eb', fontWeight: 600 }}>{(entry.work_order_id || '').toUpperCase()}</td>
                                                <td>{(entry.product_name || '').toUpperCase()}</td>
                                                <td>{entry.quantity || entry.wo_qty}</td>
                                                <td>{entry.panel_qty || 'N/A'}</td>
                                                <td>{entry.stencil_name || '-'}</td>
                                                <td>{entry.squeegee_number || '-'}</td>
                                                <td>{entry.solder_paste || '-'}</td>
                                                <td>{entry.side || '-'}</td>
                                                <td style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                                                    {new Date(entry.timestamp).toLocaleTimeString()}
                                                </td>
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
                                                            if (window.confirm("Are you sure you want to delete this entry?")) {
                                                                await apiFetch(`/api/smt/process-setups/${entry.id}`, { method: 'DELETE' });
setSavedEntries(savedEntries.filter(e => e.id !== entry.id));
                addToast("Entry deleted successfully.", "success");
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
                                                <td colSpan={10} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                                                    No pending sessions found.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className={styles.card}>
                            <h3>Completed Printing Sessions</h3>
                            <div className={styles.tableContainer}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>WO NUMBER</th>
                                            <th>PRODUCT NAME</th>
                                            <th>WO QTY</th>
                                            <th>PANEL QTY</th>
                                            <th>STENCIL NAME</th>
                                            <th>SQUEEGEE NUMBER</th>
                                            <th>SOLDER PASTE</th>
                                            <th>SIDE</th>
                                            <th>TIME</th>
                                            <th>ACTION</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {completedEntries.map((entry) => (
                                            <tr key={entry.id}>
                                                <td style={{ color: '#2563eb', fontWeight: 600 }}>{(entry.work_order_id || '').toUpperCase()}</td>
                                                <td>{(entry.product_name || '').toUpperCase()}</td>
                                                <td>{entry.quantity || entry.wo_qty}</td>
                                                <td>{entry.panel_qty || 'N/A'}</td>
                                                <td>{entry.stencil_name || '-'}</td>
                                                <td>{entry.squeegee_number || '-'}</td>
                                                <td>{entry.solder_paste || '-'}</td>
                                                <td>{entry.side || '-'}</td>
                                                <td style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                                                    {new Date(entry.timestamp).toLocaleTimeString()}
                                                </td>
                                                <td style={{ display: 'flex', gap: '5px' }}>
                                                    <button
                                                        className={styles.secondaryButton}
                                                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                                                        onClick={() => setViewingWoId(entry.work_order_id)}
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
                                                            if (window.confirm("Are you sure you want to delete this entry?")) {
                                                                await apiFetch(`/api/smt/process-setups/${entry.id}`, { method: 'DELETE' });
setSavedEntries(savedEntries.filter(e => e.id !== entry.id));
                addToast("Entry deleted successfully.", "success");
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
                                                <td colSpan={10} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                                                    No completed sessions found.
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
