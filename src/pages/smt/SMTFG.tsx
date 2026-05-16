import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from './SMTFG.module.css';
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
interface SmtFgDetailProps {
    woId: string;
    onBack: () => void;
    operatorName: string;
}

const SmtFgDetail: React.FC<SmtFgDetailProps> = ({ woId, onBack, operatorName }) => {
    const [tableSerials, setTableSerials] = useState<any[]>([]);
    const [totalSerials, setTotalSerials] = useState(0);
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
            
            // For SMT FG, valid items are those that passed Post AOI OR Rework
            const validData = await apiFetch(`/api/smt/serial-numbers?work_order_id=${woId}&filter_step=Post AOI,Rework&filter_status=PASS`);
            setAllValidSerials(validData);

            // Fetch visited items
            const data = await apiFetch(`/api/smt/inspections?work_order_id=${woId}&process_step=SMT FG`);
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
            console.error('Error fetching SMT FG history:', err);
            addToast('Failed to load FG history.', 'error');
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
            addToast(`Barcode ${barcodeInput} is already in the FG list.`, 'info');
            setScanBarcode('');
            return;
        }

        const match = allValidSerials.find((s: any) =>
            [s.serial_number, s.barcode].some(v =>
                (v || '').toString().replace(/-/g, '').toUpperCase() === cleanInput
            )
        );

        if (!match) {
            addToast(`Barcode ${barcodeInput} not found or has not passed Post AOI/Rework.`, 'error');
            setScanBarcode('');
            return;
        }

        // AUTO PASS for FG Scan
        try {
            await apiFetch('/api/smt/inspections', {
                method: 'POST',
                body: JSON.stringify({
                    serial_id: match.id,
                    process_step: 'SMT FG',
                    scanned_by: operatorName,
                    status: 'PASS'
                })
            });

            setTableSerials(prev => [{ ...match, last_status: 'PASS', last_step: 'SMT FG', scanned_at: new Date().toISOString() }, ...prev]);
            addToast(`${match.serial_number} marked as Finished Good.`, 'success');
        } catch (err: any) {
            addToast(err.message || 'Failed to register FG status', 'error');
        }
        
        setScanBarcode('');
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

    return (
        <div className={styles.detailContainer}>
            <Toaster toasts={toasts} onRemove={removeToast} />
            <div className={styles.detailHeader}>
                <button className={styles.backButton} onClick={onBack}>← Back to Work Orders</button>
                <div className={styles.detailTitle}>
                    <h2>FG Gate: {woId.toUpperCase()}</h2>
                    <span className={styles.statsBadge}>Completed: {tableSerials.length} / {totalSerials}</span>
                </div>
            </div>

            <div className={styles.scanSection}>
                <div className={styles.scanInstruction}>
                    <h3>Final SMT Acceptance</h3>
                    <p>Scan boards that have successfully completed all production stages.</p>
                </div>
                <form onSubmit={e => { e.preventDefault(); processScan(scanBarcode); }} className={styles.scanForm}>
                    <input
                        ref={scanInputRef}
                        type="text"
                        className={styles.scanInput}
                        placeholder="Scan PCB Barcode for Final Release..."
                        value={scanBarcode}
                        onChange={e => setScanBarcode(e.target.value)}
                        autoFocus
                    />
                    <button type="submit" className={styles.scanButton}>COMPLETE</button>
                </form>
            </div>

            <div className={styles.tableCard}>
                <h3 style={{ marginBottom: '1.5rem' }}>Recently Completed FG Boards</h3>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Serial Number</th>
                            <th>Status</th>
                            <th>Completion Time</th>
                            <th>Operator</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tableSerials.map(s => (
                            <tr key={s.id}>
                                <td style={{ fontWeight: 600 }}>{s.serial_number}</td>
                                <td>
                                    <span className={`${styles.statusBadge} ${styles.bgPass}`}>
                                        SMT COMPLETE
                                    </span>
                                </td>
                                <td style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                    {new Date(s.scanned_at).toLocaleString()}
                                </td>
                                <td>{operatorName}</td>
                            </tr>
                        ))}
                        {tableSerials.length === 0 && (
                            <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>No boards completed yet.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const SMTFG: React.FC = () => {
    const { smtUser, smtLogout } = useSmtAuth();
    const [workOrders, setWorkOrders] = useState<any[]>([]);
    const [viewingWoId, setViewingWoId] = useState<string | null>(null);
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

    const fetchWOs = async () => {
        try {
            // Fetch WOs that have at least one board passed Post AOI or Rework
            const data = await apiFetch('/api/smt/work-orders/registered?last_status=PASS');
            setWorkOrders(data);
        } catch (err) {
            console.error('Fetch error:', err);
        }
    };

    useEffect(() => { fetchWOs(); }, []);

    if (viewingWoId) {
        return <SmtFgDetail woId={viewingWoId} onBack={() => { setViewingWoId(null); fetchWOs(); }} operatorName={smtUser?.name || 'System'} />;
    }

    return (
        <div className={styles.container}>
            <Toaster toasts={toasts} onRemove={removeToast} />
            <div className={styles.header}>
                <div>
                    <h2>📦 SMT Finished Goods (FG)</h2>
                    <p>Final Step: Releasing boards for the next production line. Logged in: <strong>{smtUser?.name}</strong></p>
                </div>
                <button onClick={smtLogout} className={styles.secondaryButton}>Logout SMT</button>
            </div>

            <div className={styles.card}>
                <h3>Select Work Order for Final Release</h3>
                <div className={styles.tableContainer}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>WO NUMBER</th>
                                <th>PRODUCT NAME</th>
                                <th>READY FOR FG</th>
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
                                        <button className={styles.button} onClick={() => setViewingWoId(wo.id)}>Open FG Gate</button>
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

export default SMTFG;
