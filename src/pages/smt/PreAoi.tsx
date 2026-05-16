import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from './PreAoi.module.css';
import { useSmtAuth } from '../../context/SmtAuthContext';
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
interface PreAoiDetailProps {
    woId: string;
    onBack: () => void;
    operatorName: string;
}

const PreAoiDetail: React.FC<PreAoiDetailProps> = ({ woId, onBack, operatorName }) => {
    const [tableSerials, setTableSerials] = useState<any[]>([]);
    const [totalSerials, setTotalSerials] = useState(0);
    const [reworkTarget, setreworkTarget] = useState<number | null>(null);
    const [reworkReason, setreworkReason] = useState('');
    const [scanBarcode, setScanBarcode] = useState('');
    const [toasts, setToasts] = useState<Toast[]>([]);
    const toastId = useRef(0);
    const scanInputRef = useRef<HTMLInputElement>(null);
    const [allValidSerials, setAllValidSerials] = useState<any[]>([]);

    const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
        const id = ++toastId.current;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    }, []);

    const removeToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

    const fetchData = useCallback(async () => {
        try {
            // Fetch total serials available for this WO
            const totalData = await apiFetch(`/api/smt/serial-numbers?work_order_id=${woId}`);
            setTotalSerials(totalData.length);
            
            // For Pre AOI, valid items are those that passed SPI
            const validData = await apiFetch(`/api/smt/serial-numbers?work_order_id=${woId}&filter_step=SPI&filter_status=PASS`);
            setAllValidSerials(validData);

            // Fetch visited items
            const data = await apiFetch(`/api/smt/inspections?work_order_id=${woId}&process_step=Pre AOI`);
            const visited = data.map((i: any) => ({
                id: i.serial_id,
                serial_number: i.serial_number,
                barcode: i.serial_number,
                last_status: i.status,
                last_step: i.process_step,
                rework_reason: i.rework_reason,
                scanned_at: i.scanned_at
            }));
            setTableSerials(visited);
        } catch (err) {
            console.error('Error fetching Pre AOI history:', err);
            addToast('Failed to load inspection history.', 'error');
        }
    }, [woId, addToast]);

    useEffect(() => {
        fetchData();
        scanInputRef.current?.focus();
    }, [fetchData]);

    const processScan = async (barcodeInput: string) => {
        const cleanInput = (barcodeInput || '').trim().replace(/-/g, '').toUpperCase();
        if (!cleanInput) return;

        const alreadyInTable = tableSerials.find((s: any) =>
            [s.serial_number, s.barcode].some(v =>
                (v || '').toString().replace(/-/g, '').toUpperCase() === cleanInput
            )
        );
        if (alreadyInTable) {
            addToast(`Barcode ${barcodeInput} is already in the list.`, 'info');
            setScanBarcode('');
            return;
        }

        const match = allValidSerials.find((s: any) =>
            [s.serial_number, s.barcode].some(v =>
                (v || '').toString().replace(/-/g, '').toUpperCase() === cleanInput
            )
        );

        if (!match) {
            addToast(`Barcode ${barcodeInput} not found or has not passed SPI.`, 'error');
            setScanBarcode('');
            return;
        }

        setTableSerials(prev => [{ ...match, last_status: 'PENDING', last_step: 'Pre AOI' }, ...prev]);
        setScanBarcode('');
        addToast(`${match.serial_number} scanned successfully.`, 'success');
    };

    useEffect(() => {
        const cleanInput = (scanBarcode || '').trim().replace(/-/g, '').toUpperCase();
        if (cleanInput.length < 5) return;
        const match = allValidSerials.find((s: any) =>
            [s.serial_number, s.barcode].some(v =>
                (v || '').toString().replace(/-/g, '').toUpperCase() === cleanInput
            )
        );
        if (match) processScan(scanBarcode);
    }, [scanBarcode, allValidSerials]);

    const handleStatusUpdate = async (serialId: number, status: 'PASS' | 'REWORK' | 'SCRAP', reason?: string) => {
        try {
            await apiFetch('/api/smt/inspections', {
                method: 'POST',
                body: JSON.stringify({
                    serial_id: serialId,
                    process_step: 'Pre AOI',
                    scanned_by: operatorName,
                    status,
                    rework_reason: reason
                })
            });

            setTableSerials(prev => prev.map(s => s.id === serialId ? { ...s, last_status: status, rework_reason: reason, scanned_at: new Date().toISOString() } : s));
            addToast(`Board marked as ${status}`, 'success');
            if (status !== 'REWORK') setreworkTarget(null);
        } catch (err: any) {
            addToast(err.message || 'Failed to update status', 'error');
        }
    };

    return (
        <div className={styles.detailContainer}>
            <Toaster toasts={toasts} onRemove={removeToast} />
            <div className={styles.detailHeader}>
                <button className={styles.backButton} onClick={onBack}>← Back to Work Orders</button>
                <div className={styles.detailTitle}>
                    <h2>WO: {woId.toUpperCase()}</h2>
                    <span className={styles.statsBadge}>Inspected: {tableSerials.filter(s => s.last_status !== 'PENDING').length} / {totalSerials}</span>
                </div>
            </div>

            <div className={styles.scanSection}>
                <form onSubmit={e => { e.preventDefault(); processScan(scanBarcode); }} className={styles.scanForm}>
                    <input
                        ref={scanInputRef}
                        type="text"
                        className={styles.scanInput}
                        placeholder="Scan PCB Barcode..."
                        value={scanBarcode}
                        onChange={e => setScanBarcode(e.target.value)}
                        autoFocus
                    />
                    <button type="submit" className={styles.scanButton}>SCAN</button>
                </form>
            </div>

            <div className={styles.tableCard}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Serial Number</th>
                            <th>Status</th>
                            <th>Inspection Time</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tableSerials.map(s => (
                            <tr key={s.id}>
                                <td style={{ fontWeight: 600 }}>{s.serial_number}</td>
                                <td>
                                    <span className={`${styles.statusBadge} ${
                                        s.last_status === 'PASS' ? styles.bgPass : 
                                        s.last_status === 'REWORK' ? styles.bgRework : 
                                        s.last_status === 'SCRAP' ? styles.bgScrap : styles.bgPending
                                    }`}>
                                        {s.last_status}
                                    </span>
                                    {s.rework_reason && <div className={styles.reworkNote}>Reason: {s.rework_reason}</div>}
                                </td>
                                <td style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                    {s.scanned_at ? new Date(s.scanned_at).toLocaleString() : 'Just now'}
                                </td>
                                <td>
                                    {s.last_status === 'PENDING' ? (
                                        <div className={styles.actionGrid}>
                                            <button className={styles.btnPass} onClick={() => handleStatusUpdate(s.id, 'PASS')}>PASS</button>
                                            <button className={styles.btnRework} onClick={() => setreworkTarget(s.id)}>REWORK</button>
                                            <button className={styles.btnScrap} onClick={() => handleStatusUpdate(s.id, 'SCRAP')}>SCRAP</button>
                                        </div>
                                    ) : (
                                        <button className={styles.btnReset} onClick={() => setTableSerials(prev => prev.map(item => item.id === s.id ? { ...item, last_status: 'PENDING' } : item))}>
                                            Retest
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {reworkTarget && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <h3>Rework Details</h3>
                        <textarea
                            className={styles.textarea}
                            placeholder="Describe the defect and rework required..."
                            value={reworkReason}
                            onChange={e => setreworkReason(e.target.value)}
                        />
                        <div className={styles.modalActions}>
                            <button className={styles.secondaryButton} onClick={() => { setreworkTarget(null); setreworkReason(''); }}>Cancel</button>
                            <button className={styles.btnRework} onClick={() => handleStatusUpdate(reworkTarget, 'REWORK', reworkReason)}>Submit Rework</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const PreAoi: React.FC = () => {
    const { smtUser, smtLogout } = useSmtAuth();
    const [workOrders, setWorkOrders] = useState<any[]>([]);
    const [viewingWoId, setViewingWoId] = useState<string | null>(null);
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

    const fetchWOs = async () => {
        try {
            const data = await apiFetch('/api/smt/work-orders/registered?last_status=PASS');
            setWorkOrders(data);
        } catch (err) {
            console.error('Fetch error:', err);
        }
    };

    useEffect(() => { fetchWOs(); }, []);

    if (viewingWoId) {
        return <PreAoiDetail woId={viewingWoId} onBack={() => { setViewingWoId(null); fetchWOs(); }} operatorName={smtUser?.name || 'System'} />;
    }

    return (
        <div className={styles.container}>
            <Toaster toasts={toasts} onRemove={removeToast} />
            <div className={styles.header}>
                <div>
                    <h2>🔍 Pre AOI Inspection</h2>
                    <p>Stage 6: Component verification before AOI. Logged in: <strong>{smtUser?.name}</strong></p>
                </div>
                <button onClick={smtLogout} className={styles.secondaryButton}>Logout SMT</button>
            </div>

            <div className={styles.card}>
                <h3>Select Work Order to Inspect</h3>
                <div className={styles.tableContainer}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>WO NUMBER</th>
                                <th>PRODUCT NAME</th>
                                <th>QUANTITY</th>
                                <th>ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {workOrders.map(wo => (
                                <tr key={wo.id}>
                                    <td style={{ color: '#2563eb', fontWeight: 700 }}>{wo.id.toUpperCase()}</td>
                                    <td>{wo.product_name}</td>
                                    <td>{wo.panel_quantity}</td>
                                    <td>
                                        <button className={styles.button} onClick={() => setViewingWoId(wo.id)}>Start Inspection</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PreAoi;
