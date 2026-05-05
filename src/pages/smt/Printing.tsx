import React, { useState, useEffect } from 'react';
import { useSmtAuth } from '../../context/SmtAuthContext';
import styles from './Printing.module.css';
import QRCode from 'react-qr-code';

// --- Detail View Component (Internal) ---
interface PrintingDetailProps {
    woId: string;
    onBack: () => void;
}

const PrintingDetail: React.FC<PrintingDetailProps> = ({ woId, onBack }) => {
    const [serials, setSerials] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [scanBarcode, setScanBarcode] = useState('');
    const [scannedBy, setScannedBy] = useState('');

    useEffect(() => {
        if (woId) fetchSerials();
    }, [woId]);

    const fetchSerials = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/smt/serial-numbers?work_order_id=${encodeURIComponent(woId)}&current_step=Printing`);
            if (res.ok) {
                const data = await res.json();

                // Printing should show serials that completed Serial Number Scanning,
                // plus any serial already completed in Printing.
                const scannedOnly = data.filter((s: any) =>
                    s.status?.toString().toUpperCase() === 'SCANNED' ||
                    s.is_completed_here === true ||
                    String(s.is_completed_here).toLowerCase() === 'true'
                );

                setSerials(scannedOnly);
            }
        } catch (err) {
            console.error("Error fetching serials:", err);
        } finally {
            setLoading(false);
        }
    };

    const processScan = async (barcodeInput: string) => {
        const cleanInput = barcodeInput.trim().replace(/-/g, "");
        if (!cleanInput) return false;

        try {
            const serialObj = serials.find(s =>
                (s.serial_number && s.serial_number.replace(/-/g, "") === cleanInput) ||
                (s.barcode && s.barcode.replace(/-/g, "") === cleanInput)
            );

            if (!serialObj) {
                alert(`Serial Number "${barcodeInput}" not found or not ready for printing!`);
                setScanBarcode('');
                return false;
            }

            const res = await fetch('/api/smt/inspections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serial_id: serialObj.id,
                    process_step: 'Printing',
                    scanned_by: scannedBy || 'System',
                    status: 'PASS'
                })
            });

            if (res.ok) {
                setScanBarcode('');
                fetchSerials();
                return true;
            } else {
                alert("Failed to save printing record");
                return false;
            }
        } catch (err) {
            console.error("Scan error:", err);
            return false;
        }
    };

    const handleScan = async (e: React.FormEvent) => {
        e.preventDefault();
        await processScan(scanBarcode);
    };

    useEffect(() => {
        const tryAutoScan = async () => {
            const cleanInput = scanBarcode.trim().replace(/-/g, "");
            if (!cleanInput) return;

            const match = serials.find(s =>
                (s.serial_number && s.serial_number.replace(/-/g, "") === cleanInput) ||
                (s.barcode && s.barcode.replace(/-/g, "") === cleanInput)
            );

            if (match) {
                await processScan(scanBarcode);
            }
        };

        tryAutoScan();
    }, [scanBarcode, serials]);

    const completedSerials = serials.filter(s =>
        s.is_completed_here === true ||
        String(s.is_completed_here).toLowerCase() === 'true'
    );
    const pendingSerials = serials.filter(s => !completedSerials.includes(s));

    return (
        <div className={styles.detailPage}>
            <div className={styles.detailHeaderCard}>
                <div className={styles.detailHeaderRow}>
                    <div>
                        <h3>🖨️ Printing Batch Detail: {woId}</h3>
                        <div className={styles.detailStats}>
                            <span>Total: <strong>{serials.length}</strong></span>
                            <span style={{ color: '#059669' }}>Completed: <strong>{completedSerials.length}</strong></span>
                            <span style={{ color: '#d97706' }}>Pending: <strong>{pendingSerials.length}</strong></span>
                        </div>
                    </div>
                    <button onClick={onBack} className={styles.detailBackButton}>Back</button>
                </div>
            </div>

            <div className={styles.detailScanCard}>
                <form onSubmit={handleScan} className={styles.detailScanForm}>
                    <div className={styles.detailOperatorGroup}>
                        <label>Scanned By *</label>
                        <input
                            type="text"
                            value={scannedBy}
                            onChange={e => setScannedBy(e.target.value)}
                            placeholder="Operator name"
                            className={styles.detailOperatorInput}
                        />
                    </div>
                    <div className={styles.detailScanRow}>
                        <input
                            type="text"
                            value={scanBarcode}
                            onChange={e => setScanBarcode(e.target.value)}
                            placeholder="Scan Item Barcode..."
                            className={styles.detailScanInput}
                            autoFocus
                        />
                        <button type="submit" className={styles.detailScanButton}>SCAN</button>
                    </div>
                </form>
            </div>

            <div className={styles.detailItemsSection}>
                <div className={styles.detailItemsHeader}>
                    <h3>Items ({serials.length})</h3>
                </div>

                <div className={styles.detailTableContainer}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>SERIAL NUMBER</th>
                                <th>BARCODE</th>
                                <th>STATUS</th>
                                <th>GENERATED AT</th>
                                <th>ACTION</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>Loading...</td></tr>
                            ) : serials.map((s, idx) => {
                                const isDone = completedSerials.includes(s);
                                return (
                                    <tr key={s.id || idx} className={isDone ? styles.detailDoneRow : styles.detailPendingRow}>
                                        <td className={styles.detailSerialCell}>{s.serial_number}</td>
                                        <td className={styles.detailQrCell}>
                                            <div className={styles.detailQrItem}>
                                                <QRCode value={s.serial_number} size={80} />
                                                <p>{s.serial_number}</p>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={isDone ? styles.detailPassedBadge : styles.detailPendingBadge}>
                                                {isDone ? 'PASSED' : 'PENDING'}
                                            </span>
                                        </td>
                                        <td className={styles.detailDateCell}>
                                            {new Date(s.created_at).toLocaleString()}
                                        </td>
                                        <td>
                                            <button
                                                className={styles.secondaryButton}
                                                style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                                                type="button"
                                            >
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {!loading && serials.length === 0 && (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                                        No items found.
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
    const [workOrders, setWorkOrders] = useState<any[]>([]);
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

    useEffect(() => {
        const fetchData = async () => {
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
                    process_name: 'PRINTING',
                    product_name: productName || 'N/A',
                    quantity: parseInt(woQty) || 0,
                    stencil_name: stencilName || 'DEFAULT',
                    squeegee_number: squeezeNumber || 'DEFAULT',
                    solder_paste: solderPaste || 'DEFAULT',
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

    return (
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
                    onBack={() => setViewingWoId(null)}
                />
            ) : (
                <>
                    <div className={styles.card}>
                        <h3 style={{ marginBottom: '1.5rem', borderBottom: '2px solid #f1f5f9', paddingBottom: '0.75rem' }}>Printing Setup Form</h3>
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
                                <label>Stencil Name *</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    value={stencilName}
                                    onChange={(e) => setStencilName(e.target.value)}
                                    placeholder="Enter Stencil Name"
                                />
                            </div>

                            <div className={styles.inputGroup}>
                                <label>Squeegee Number *</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    value={squeezeNumber}
                                    onChange={(e) => setSqueezeNumber(e.target.value)}
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
                        <h3>Recent Printing Entries</h3>
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
                                                    onClick={() => setViewingWoId(entry.work_order_id)}
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
