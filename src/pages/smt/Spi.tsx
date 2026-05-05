import React, { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'react-qr-code';
import styles from './Spi.module.css';
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

// --- Detail View Component (Internal) ---
interface SpiDetailProps {
    woId: string;
    onBack: () => void;
    operatorName: string;
}

const SpiDetail: React.FC<SpiDetailProps> = ({ woId, onBack, operatorName }) => {
    const [tableSerials, setTableSerials] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [totalSerials, setTotalSerials] = useState(0);
    const [scanBarcode, setScanBarcode] = useState('');
    const [toasts, setToasts] = useState<Toast[]>([]);
    const toastId = useRef(0);
    const scanInputRef = useRef<HTMLInputElement>(null);

    const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
        const id = ++toastId.current;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    }, []);

    const removeToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch total registered serials for this WO
            const totalUrl = new URL('/api/smt/serial-numbers', window.location.origin);
            totalUrl.searchParams.set('work_order_id', woId);
            const totalRes = await fetch(totalUrl.toString());
            if (totalRes.ok) {
                const totalData = await totalRes.json();
                setTotalSerials(totalData.length);
            }

            // Fetch SPI history
            const inspUrl = new URL('/api/smt/inspections', window.location.origin);
            inspUrl.searchParams.set('work_order_id', woId);
            inspUrl.searchParams.set('process_step', 'SPI');
            const res = await fetch(inspUrl.toString());
            const data = res.ok ? await res.json() : [];
            
            const visited = data.map((i: any) => ({
                id: i.serial_id,
                serial_number: i.serial_number,
                barcode: i.serial_number,
                last_status: i.status,
                last_step: i.process_step,
                scanned_at: i.scanned_at
            }));
            setTableSerials(visited);
        } catch (err) {
            console.error('Error fetching SPI data:', err);
            addToast('Failed to load SPI data.', 'error');
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
                    process_step: 'SPI',
                    scanned_by: operatorName || 'System',
                    status: 'PASS'
                })
            });
            if (res.ok) {
                setTableSerials(prev => prev.map(s => 
                    s.id === serialId ? { ...s, last_status: 'PASS', last_step: 'SPI' } : s
                ));
                addToast('Item marked as PASS.', 'success');
            } else {
                addToast('Failed to save status.', 'error');
            }
        } catch { addToast('Network error.', 'error'); }
    };

    const handleFailOnly = async (serialId: number) => {
        const reason = window.prompt('Please enter the reason for failure (Remark):');
        if (reason === null) return;
        if (!reason.trim()) { addToast('Remark is required.', 'error'); return; }

        try {
            const res = await fetch('/api/smt/inspections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serial_id: serialId,
                    process_step: 'SPI',
                    scanned_by: operatorName || 'System',
                    status: 'FAIL',
                    rework_reason: reason.trim()
                })
            });
            if (res.ok) {
                setTableSerials(prev => prev.map(s => 
                    s.id === serialId ? { ...s, last_status: 'FAIL', last_step: 'SPI', rework_reason: reason.trim() } : s
                ));
                addToast('Item marked as FAIL.', 'info');
            } else {
                addToast('Failed to save status.', 'error');
            }
        } catch { addToast('Network error.', 'error'); }
    };

    const processScan = async (barcodeInput: string) => {
        const cleanInput = barcodeInput.trim().replace(/-/g, '').toUpperCase();
        if (!cleanInput) return;

        const alreadyInTable = tableSerials.find((s: any) =>
            [s.serial_number, s.barcode].some(v =>
                v?.toString().replace(/-/g, '').toUpperCase() === cleanInput
            )
        );
        if (alreadyInTable) {
            addToast(`Barcode ${barcodeInput} is already in the list.`, 'info');
            setScanBarcode('');
            return;
        }

        try {
            const url = new URL('/api/smt/serial-numbers', window.location.origin);
            url.searchParams.set('work_order_id', woId);

            const res = await fetch(url.toString());
            if (!res.ok) { addToast('Server error.', 'error'); return; }

            const allSerials: any[] = await res.json();
            const match = allSerials.find((s: any) =>
                [s.serial_number, s.barcode].some(v =>
                    v?.toString().replace(/-/g, '').toUpperCase() === cleanInput
                )
            );

            if (!match) {
                addToast(`Barcode ${barcodeInput} not found in this Work Order.`, 'error');
                setScanBarcode('');
                return;
            }

            setTableSerials(prev => [{ ...match, last_status: 'PENDING', last_step: 'SPI' }, ...prev]);
            setScanBarcode('');
            addToast(`${match.serial_number} scanned successfully.`, 'success');
        } catch { addToast('Connection error.', 'error'); }
    };

    const handleScan = async (e: React.FormEvent) => {
        e.preventDefault();
        await processScan(scanBarcode);
    };

    return (
        <>
            <Toaster toasts={toasts} onRemove={removeToast} />
            <div className={styles.detailPage}>
                <div className={styles.detailHeaderCard}>
                    <div className={styles.detailHeaderRow}>
                        <div>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.5rem' }}>🔍 SPI Inspection Detail: {woId}</h3>
                            <div className={styles.detailStats} style={{ gap: '2rem' }}>
                                <span style={{ color: '#475569' }}>Total Scanned: <strong>{tableSerials.length} / {totalSerials}</strong></span>
                                <span style={{ color: '#475569' }}>🏭 Available: <strong style={{ color: '#2563eb' }}>{totalSerials}</strong></span>
                                <span style={{ color: '#475569' }}>✅ completed: <strong style={{ color: '#059669' }}>{tableSerials.filter(s => s.last_status === 'PASS').length}</strong></span>
                                <span style={{ color: '#475569' }}>🔄 pending: <strong style={{ color: '#f59e0b' }}>{totalSerials - tableSerials.length}</strong></span>
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
                            <label style={{ marginBottom: '0.25rem' }}>Scan Item Barcode...</label>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <form onSubmit={handleScan} style={{ flex: 1 }}>
                                    <input
                                        ref={scanInputRef}
                                        type="text"
                                        className={styles.input}
                                        placeholder="Scan barcode..."
                                        value={scanBarcode}
                                        onChange={(e) => setScanBarcode(e.target.value)}
                                        style={{ width: '100%', borderColor: '#6366f1', borderWidth: '2px' }}
                                    />
                                </form>
                                <button className={styles.button} style={{ width: '140px' }} onClick={() => processScan(scanBarcode)}>SCAN</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className={styles.card}>
                    <div className={styles.tableHeader}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Items ({tableSerials.length})</h3>
                    </div>
                    <div className={styles.tableContainer}>
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
                                {loading ? (
                                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>Loading...</td></tr>
                                ) : tableSerials.length === 0 ? (
                                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>📦 Scan a barcode above to begin inspection</td></tr>
                                ) : tableSerials.map((s, idx) => {
                                    const isPass = s.last_status === 'PASS';
                                    const isFail = s.last_status === 'FAIL';
                                    return (
                                        <tr key={s.id || idx}>
                                            <td style={{ color: '#9ca3af', fontWeight: 500 }}>{tableSerials.length - idx}</td>
                                            <td style={{ fontWeight: 600 }}>{s.serial_number}</td>
                                            <td style={{ textAlign: 'center' }}>
                                                <div style={{ display: 'grid', gap: '0.3rem', justifyItems: 'center' }}>
                                                    <QRCode value={s.serial_number} size={60} />
                                                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{s.serial_number}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span style={{
                                                    padding: '4px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700,
                                                    backgroundColor: isPass ? '#dcfce7' : isFail ? '#fee2e2' : '#fef3c7',
                                                    color: isPass ? '#166534' : isFail ? '#991b1b' : '#92400e'
                                                }}>
                                                    {isPass ? '✓ PASSED' : isFail ? '● FAIL' : '🕒 PENDING'}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    {!isPass && <button onClick={() => handlePass(s.id)} className={styles.button} style={{ height: '32px', padding: '0 12px', fontSize: '0.8rem', backgroundColor: '#059669' }}>PASS</button>}
                                                    {!isFail && <button onClick={() => handleFailOnly(s.id)} className={styles.button} style={{ height: '32px', padding: '0 12px', fontSize: '0.8rem', backgroundColor: '#ef4444' }}>FAIL</button>}
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

// --- Main Page Component ---
const Spi: React.FC = () => {
    const { smtUser, smtLogout } = useSmtAuth();
    const [workOrders, setWorkOrders] = useState<any[]>([]);
    const [selectedWoId, setSelectedWoId] = useState<string | null>(null);

    // Form state
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
                if (woRes.ok) {
                    const data = await woRes.json();
                    setWorkOrders(data);
                }

                const setupRes = await fetch('/api/smt/process-setups?process_name=SPI');
                if (setupRes.ok) {
                    const data = await setupRes.json();
                    setSavedEntries(data);
                }

                if (smtUser) {
                    setCreatedBy(smtUser.name || smtUser.userId || 'System');
                }
            } catch (err) {
                console.error("Failed to fetch data:", err);
            }
        };
        fetchData();
    }, [smtUser]);

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

        try {
            const res = await fetch('/api/smt/process-setups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    work_order_id: formWoId,
                    process_name: 'SPI',
                    product_name: productName,
                    quantity: parseInt(woQty)
                })
            });

            if (res.ok) {
                const newEntry = await res.json();
                setSavedEntries([newEntry, ...savedEntries]);
                alert(`Starting SPI Inspection for WO: ${formWoId}`);
            } else {
                alert("Failed to save SPI setup");
            }
        } catch (err) {
            console.error("Error saving setup:", err);
            alert("Connection error while saving setup");
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#1e293b' }}>🔍 SPI Inspection</h2>
                    <p style={{ color: '#64748b' }}>Manage SMT Solder Paste Inspection tasks. Logged in as: <strong>{smtUser?.name}</strong> | Shift: <strong>{getShift()}</strong></p>
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
                <SpiDetail
                    woId={selectedWoId}
                    onBack={() => setSelectedWoId(null)}
                    operatorName={smtUser?.name || 'System'}
                />
            ) : (
                <>
                    <div className={styles.card}>
                        <h3 style={{ marginBottom: '1.5rem', borderBottom: '2px solid #f1f5f9', paddingBottom: '0.75rem' }}>SPI Setup Form</h3>
                        <div className={styles.formGrid}>
                            <div className={styles.inputGroup}>
                                <label>Select Work Order (Serial Number Scanned Only) *</label>
                                <select
                                    className={styles.input}
                                    value={formWoId}
                                    onChange={(e) => handleSelectWo(e.target.value)}
                                >
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
                                <label>Generated By *</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    value={createdBy}
                                    readOnly
                                    style={{ backgroundColor: '#f3f4f6', color: '#6b7280', fontWeight: 'bold' }}
                                />
                            </div>
                        </div>
                        <div style={{ marginTop: '30px' }}>
                            <button className={styles.button} onClick={handleStartProcess}>
                                Start SPI Inspection
                            </button>
                        </div>
                    </div>

                    <div className={styles.card}>
                        <h3>Recent SPI Entries</h3>
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
                                                    onClick={() => setSelectedWoId(entry.work_order_id)}
                                                >
                                                    View
                                                </button>
                                                <button
                                                    className={styles.secondaryButton}
                                                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', borderColor: '#ef4444', color: '#ef4444' }}
                                                    onClick={async () => {
                                                        if (window.confirm("Are you sure you want to delete this entry?")) {
                                                            const res = await fetch(`/api/smt/process-setups/${entry.id}`, { method: 'DELETE' });
                                                            if (res.ok) setSavedEntries(savedEntries.filter(e => e.id !== entry.id));
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
                </>
            )}
        </div>
    );
};

export default Spi;
