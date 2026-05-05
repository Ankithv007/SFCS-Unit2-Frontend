import React, { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
import styles from './Spi.module.css';
import { useSmtAuth } from '../../context/SmtAuthContext';

// --- Detail View Component (Internal) ---
interface SpiDetailProps {
    woId: string;
    onBack: () => void;
    operatorName: string;
}

const SpiDetail: React.FC<SpiDetailProps> = ({ woId, onBack, operatorName }) => {
    const [serials, setSerials] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [reworkTarget, setReworkTarget] = useState<number | null>(null);
    const [reworkReason, setReworkReason] = useState('');
    const [scanBarcode, setScanBarcode] = useState('');

    useEffect(() => {
        if (woId) fetchSerials();
    }, [woId]);

    const fetchSerials = async () => {
        setLoading(true);
        try {
            const url = new URL('/api/smt/serial-numbers', window.location.origin);
            url.searchParams.set('work_order_id', woId);
            url.searchParams.set('current_step', 'SPI');

            const res = await fetch(url.toString());
            if (res.ok) {
                const data = await res.json();
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

    const handlePassFail = async (serialId: number, status: 'PASS' | 'FAIL') => {
        if (status === 'FAIL' && !reworkReason) {
            setReworkTarget(serialId);
            return;
        }

        try {
            const res = await fetch('/api/smt/inspections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serial_id: serialId,
                    process_step: 'SPI',
                    scanned_by: operatorName || 'System',
                    status: status,
                    rework_reason: status === 'FAIL' ? reworkReason : null
                })
            });

            if (res.ok) {
                setReworkTarget(null);
                setReworkReason('');
                fetchSerials();
            } else {
                alert(`Failed to save ${status} status.`);
            }
        } catch (err) {
            console.error("Pass/Fail error:", err);
        }
    };

    const processScan = async (barcodeInput: string) => {
        const cleanInput = barcodeInput.trim().replace(/-/g, '').toUpperCase();
        if (!cleanInput) return false;

        const serialObj = serials.find((s: any) =>
            [s.serial_number, s.barcode].some((value) =>
                value?.toString().replace(/-/g, '').toUpperCase() === cleanInput
            )
        );

        if (!serialObj) {
            alert(`Serial Number "${barcodeInput}" not found in this view.`);
            setScanBarcode('');
            return false;
        }

        if (serialObj.is_completed_here === true || String(serialObj.is_completed_here).toLowerCase() === 'true') {
            alert(`Serial Number "${barcodeInput}" is already passed.`);
            setScanBarcode('');
            return false;
        }

        await handlePassFail(serialObj.id, 'PASS');
        setScanBarcode('');
        return true;
    };

    const handleScan = async (e: React.FormEvent) => {
        e.preventDefault();
        await processScan(scanBarcode);
    };

    useEffect(() => {
        const tryAutoScan = async () => {
            const cleanInput = scanBarcode.trim().replace(/-/g, '').toUpperCase();
            if (!cleanInput) return;

            const match = serials.find((s: any) =>
                [s.serial_number, s.barcode].some((value) =>
                    value?.toString().replace(/-/g, '').toUpperCase() === cleanInput
                )
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
                        <h3>🔍 SPI Inspection Detail: {woId}</h3>
                        <div className={styles.detailStats}>
                            <span>Total: <strong>{serials.length}</strong></span>
                            <span style={{ color: '#059669' }}>Passed: <strong>{completedSerials.length}</strong></span>
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
                        <input value={operatorName || 'System'} readOnly className={styles.detailOperatorInput} />
                    </div>
                    <div className={styles.detailScanRow}>
                        <input
                            type="text"
                            value={scanBarcode}
                            onChange={(e) => setScanBarcode(e.target.value)}
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
                            <th>ACTION</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem' }}>Loading...</td></tr>
                        ) : serials.map((s, idx) => {
                            const isDone = completedSerials.includes(s);
                            const isFail = s.last_status === 'FAIL' && s.last_step === 'SPI';
                            return (
                                <tr key={s.id || idx} className={isDone ? styles.detailDoneRow : styles.detailPendingRow}>
                                    <td className={styles.detailSerialCell}>{s.serial_number}</td>
                                    <td style={{ textAlign: 'center', padding: '0.75rem 0' }}>
                                        <div style={{ display: 'grid', gap: '0.4rem', justifyItems: 'center' }}>
                                            <QRCode value={(s.barcode || s.serial_number).replace(/-/g, '')} size={80} />
                                            <span style={{ fontSize: '0.8rem', color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '110px' }}>
                                                {s.barcode || s.serial_number}
                                            </span>
                                        </div>
                                    </td>
                                    <td>
                                        <span style={{
                                            padding: '4px 12px',
                                            borderRadius: '999px',
                                            fontSize: '0.75rem',
                                            fontWeight: 'bold',
                                            backgroundColor: isFail ? '#fee2e2' : (isDone ? '#dcfce7' : '#fef3c7'),
                                            color: isFail ? '#991b1b' : (isDone ? '#166534' : '#92400e')
                                        }}>
                                            {isFail ? '● FAIL' : (isDone ? 'PASSED' : '🕒 PENDING')}
                                        </span>
                                    </td>
                                    <td>
                                        {reworkTarget === s.id ? (
                                            <div style={{ display: 'flex', gap: '5px' }}>
                                                <input
                                                    type="text"
                                                    className={styles.detailRemarkInput}
                                                    placeholder="Reason..."
                                                    value={reworkReason}
                                                    onChange={e => setReworkReason(e.target.value)}
                                                    autoFocus
                                                />
                                                <button type="button" onClick={() => handlePassFail(s.id, 'FAIL')} className={styles.detailRemarkSubmit}>Submit</button>
                                                <button type="button" onClick={() => setReworkTarget(null)} className={styles.detailRemarkCancel}>Cancel</button>
                                            </div>
                                        ) : (
                                            <div className={styles.detailActionButtons}>
                                                <button type="button" onClick={() => handlePassFail(s.id, 'PASS')} className={styles.detailActionPass}>Pass</button>
                                                <button type="button" onClick={() => setReworkTarget(s.id)} className={styles.detailActionFail}>Fail</button>
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
