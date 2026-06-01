import React, { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'react-qr-code';
import styles from './Spi.module.css'; // sharing premium CSS styles
import { useSmtAuth } from '../../context/SmtAuthContext';
import { useAuth } from '../../hooks/useAuth';
import { apiFetch } from '../../utils/api';
import SMTCountDetailsModal from '../../components/SMTCountDetailsModal';

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
    onCountClick?: (stage: string, type: string, label: string) => void;
}

const ReworkDetail: React.FC<ReworkDetailProps> = ({ woId, onBack, operatorName, onCountClick }) => {
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

    const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');

    const removeToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

    const fetchSerials = useCallback(async () => {
        setLoading(true);
        try {
            const url = new URL('/api/smt/serial-numbers', window.location.origin);
            url.searchParams.set('work_order_id', woId);
            const res = await fetch(url.toString());
            const data = res.ok ? await res.json() : [];
            setAllWoSerials(data);

            // Fetch all inspections for this Work Order to reconstruct full repair audit history
            const inspRes = await fetch(`/api/smt/inspections?work_order_id=${woId}`);
            const inspections = inspRes.ok ? await inspRes.json() : [];

            // Group inspections by serial_id
            const inspBySerial: Record<number, any[]> = {};
            inspections.forEach((insp: any) => {
                if (!inspBySerial[insp.serial_id]) {
                    inspBySerial[insp.serial_id] = [];
                }
                inspBySerial[insp.serial_id].push(insp);
            });

            const processedItems: any[] = [];
            for (const serialIdStr in inspBySerial) {
                const serialId = Number(serialIdStr);
                const sorted = [...inspBySerial[serialId]].sort(
                    (a: any, b: any) => new Date(a.scanned_at).getTime() - new Date(b.scanned_at).getTime()
                );

                // Find the latest Post AOI failure in sorted records
                let latestFailure: any = null;
                for (let i = sorted.length - 1; i >= 0; i--) {
                    if (sorted[i].process_step === 'Post AOI' && sorted[i].status === 'FAIL') {
                        latestFailure = sorted[i];
                        break;
                    }
                }

                if (!latestFailure) continue;

                // Find the latest Rework scan logged AFTER the latest failure
                let latestRepair: any = null;
                for (let i = sorted.length - 1; i >= 0; i--) {
                    if (
                        sorted[i].process_step === 'Rework' &&
                        sorted[i].status === 'PASS' &&
                        new Date(sorted[i].scanned_at).getTime() > new Date(latestFailure.scanned_at).getTime()
                    ) {
                        latestRepair = sorted[i];
                        break;
                    }
                }

                // Find the latest Post AOI scan logged AFTER the latest repair
                let latestRevalidation: any = null;
                if (latestRepair) {
                    for (let i = sorted.length - 1; i >= 0; i--) {
                        if (
                            sorted[i].process_step === 'Post AOI' &&
                            new Date(sorted[i].scanned_at).getTime() > new Date(latestRepair.scanned_at).getTime()
                        ) {
                            latestRevalidation = sorted[i];
                            break;
                        }
                    }
                }

                let currentStatus = 'FAILED';
                if (latestRevalidation) {
                    currentStatus = latestRevalidation.status === 'PASS' ? 'REVALIDATED_PASS' : 'FAILED_AGAIN';
                } else if (latestRepair) {
                    currentStatus = 'READY_FOR_RECHECK';
                }

                const sInfo = data.find((x: any) => x.id === serialId) || {};

                processedItems.push({
                    id: serialId,
                    serial_number: sInfo.serial_number || latestFailure.serial_number,
                    barcode: sInfo.serial_number || latestFailure.serial_number,
                    barcode_source: sInfo.barcode_source || 'GENERATED',
                    failure_remark: latestFailure.rework_reason || 'Defect Registered',
                    failed_time: latestFailure.scanned_at,
                    failed_by: latestFailure.scanned_by || 'System',
                    repair_remark: latestRepair ? latestRepair.rework_reason : null,
                    repair_time: latestRepair ? latestRepair.scanned_at : null,
                    repaired_by: latestRepair ? latestRepair.scanned_by : null,
                    status: currentStatus
                });
            }

            setSerials(processedItems);
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

    const handleMarkPass = async (serialId: number, remark: string) => {
        try {
            const res = await fetch('/api/smt/inspections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serial_id: serialId,
                    process_step: 'Rework',
                    scanned_by: operatorName || 'System',
                    status: 'PASS',
                    rework_reason: remark
                })
            });
            if (res.ok) {
                addToast('Item marked as PASS/REPAIRED in rework.', 'success');
                await fetchSerials();
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

        // Prompt for repair remark - MUST be mandatory!
        const remark = window.prompt(`Please enter Repair Action taken for barcode "${barcodeInput}" (Mandatory):`);
        if (remark === null) {
            processingRef.current = false;
            scanInputRef.current?.focus();
            return;
        }
        if (!remark.trim()) {
            addToast('Repair action remark is required.', 'error');
            alert('Repair action remark is required to complete rework.');
            processingRef.current = false;
            scanInputRef.current?.focus();
            return;
        }

        // Valid for rework scan! Marks as pass automatically
        await handleMarkPass(match.id, remark.trim());
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

    const pendingItems = serials.filter(s => s.status === 'FAILED' || s.status === 'FAILED_AGAIN')
        .sort((a, b) => new Date(b.failed_time).getTime() - new Date(a.failed_time).getTime());

    const historyItems = serials.filter(s => s.status === 'READY_FOR_RECHECK' || s.status === 'REVALIDATED_PASS')
        .sort((a, b) => new Date(b.repair_time || 0).getTime() - new Date(a.repair_time || 0).getTime());

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
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#92400e', marginBottom: '0.5rem' }}>🛠️ SMT Rework Detail: {woId}</h3>
                            <div className={styles.detailStats} style={{ gap: '2rem' }}>
                                <span style={{ color: '#b45309' }}>Pending Rework:{' '}
                                    <strong 
                                        className="smt-clickable-count smt-pending"
                                        onClick={() => onCountClick && onCountClick('Rework', 'pending', 'Pending Rework')}
                                    >
                                        {pendingItems.length}
                                    </strong>
                                </span>
                                <span style={{ color: '#b45309' }}>🛠️ Total Failed Ever:{' '}
                                    <strong 
                                        className="smt-clickable-count smt-total"
                                        onClick={() => onCountClick && onCountClick('Rework', 'total', 'Total Failed Ever')}
                                    >
                                        {serials.length}
                                    </strong>
                                </span>
                                <span style={{ color: '#b45309' }}>✅ Repaired & Revalidated:{' '}
                                    <strong 
                                        className="smt-clickable-count smt-passed"
                                        onClick={() => onCountClick && onCountClick('Rework', 'passed', 'Repaired & Revalidated')}
                                    >
                                        {historyItems.filter(h => h.status === 'REVALIDATED_PASS').length}
                                    </strong>
                                </span>
                            </div>
                        </div>
                        <button className={styles.secondaryButton} onClick={onBack}>Back</button>
                    </div>
                </div>

                <div className={styles.card} style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div className={styles.inputGroup} style={{ maxWidth: '300px' }}>
                            <label>Rework Technician *</label>
                            <input type="text" className={styles.input} value={operatorName} readOnly style={{ backgroundColor: '#f9fafb', height: '42px' }} />
                        </div>
                        <div className={styles.inputGroup}>
                            <label style={{ marginBottom: '0.25rem' }}>Scan Failed Board Barcode...</label>
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

                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                    <button
                        onClick={() => setActiveTab('pending')}
                        style={{
                            padding: '0.75rem 1.5rem',
                            borderRadius: '8px',
                            fontWeight: 600,
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            backgroundColor: activeTab === 'pending' ? '#d97706' : '#e2e8f0',
                            color: activeTab === 'pending' ? 'white' : '#475569',
                            boxShadow: activeTab === 'pending' ? '0 4px 6px -1px rgba(217, 119, 6, 0.2)' : 'none'
                        }}
                    >
                        Pending Rework Queue ({pendingItems.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        style={{
                            padding: '0.75rem 1.5rem',
                            borderRadius: '8px',
                            fontWeight: 600,
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            backgroundColor: activeTab === 'history' ? '#d97706' : '#e2e8f0',
                            color: activeTab === 'history' ? 'white' : '#475569',
                            boxShadow: activeTab === 'history' ? '0 4px 6px -1px rgba(217, 119, 6, 0.2)' : 'none'
                        }}
                    >
                        Rework History / Audit Trail ({historyItems.length})
                    </button>
                </div>

                <div className={styles.card}>
                    {activeTab === 'pending' ? (
                        <>
                            <div className={styles.tableHeader}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#92400e' }}>Pending Rework ({pendingItems.length})</h3>
                            </div>
                            <div className={styles.tableContainer}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th style={{ textAlign: 'center' }}>BARCODE PREVIEW</th>
                                            <th>BARCODE NUMBER</th>
                                            <th>DEFECT REASON</th>
                                            <th>FAILED BY</th>
                                            <th>FAILED AT</th>
                                            <th>STATUS</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>Loading...</td></tr>
                                        ) : pendingItems.length === 0 ? (
                                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>📦 No failed items waiting for rework</td></tr>
                                        ) : pendingItems.map((s, idx) => {
                                            const showBarcodeImage = s.barcode_source === 'GENERATED' || !s.barcode_source || (s.barcode_source === 'PRE_EXISTING' && s.serial_number);
                                            return (
                                                <tr key={s.id || idx}>
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
                                                        {s.failure_remark}
                                                    </td>
                                                    <td style={{ fontWeight: 600, color: '#475569' }}>
                                                        {s.failed_by}
                                                    </td>
                                                    <td style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                                        {s.failed_time ? new Date(s.failed_time).toLocaleString() : '-'}
                                                    </td>
                                                    <td>
                                                        <span style={{
                                                            padding: '4px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700,
                                                            backgroundColor: s.status === 'FAILED_AGAIN' ? '#fee2e2' : '#fef3c7',
                                                            color: s.status === 'FAILED_AGAIN' ? '#991b1b' : '#92400e'
                                                        }}>
                                                            {s.status === 'FAILED_AGAIN' ? '● FAILED AGAIN' : '🕒 PENDING REPAIR'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className={styles.tableHeader}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#059669' }}>Rework History / Audit Trail ({historyItems.length})</h3>
                            </div>
                            <div className={styles.tableContainer}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>BARCODE NUMBER</th>
                                            <th>DEFECT REASON</th>
                                            <th>FAILED AT</th>
                                            <th>REPAIR ACTION</th>
                                            <th>REPAIR TECHNICIAN</th>
                                            <th>REPAIRED AT</th>
                                            <th>STATUS</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>Loading...</td></tr>
                                        ) : historyItems.length === 0 ? (
                                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>📦 No repaired items in history</td></tr>
                                        ) : historyItems.map((s, idx) => {
                                            return (
                                                <tr key={s.id || idx}>
                                                    <td style={{ fontWeight: 700, color: '#1e293b', fontSize: '1rem' }}>
                                                        {(s.serial_number || '').toUpperCase()}
                                                    </td>
                                                    <td style={{ color: '#64748b', fontSize: '0.85rem' }}>
                                                        {s.failure_remark}
                                                    </td>
                                                    <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                                        {s.failed_time ? new Date(s.failed_time).toLocaleString() : '-'}
                                                    </td>
                                                    <td style={{ color: '#0f766e', fontWeight: 600, fontSize: '0.9rem' }}>
                                                        {s.repair_remark || '-'}
                                                    </td>
                                                    <td style={{ fontWeight: 600, color: '#475569' }}>
                                                        {s.repaired_by || '-'}
                                                    </td>
                                                    <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                                        {s.repair_time ? new Date(s.repair_time).toLocaleString() : '-'}
                                                    </td>
                                                    <td>
                                                        <span style={{
                                                            padding: '4px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700,
                                                            backgroundColor: s.status === 'REVALIDATED_PASS' ? '#dcfce7' : '#fef3c7',
                                                            color: s.status === 'REVALIDATED_PASS' ? '#166534' : '#92400e'
                                                        }}>
                                                            {s.status === 'REVALIDATED_PASS' ? '✓ PASSED RECHECK' : '● READY FOR RECHECK'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const Rework: React.FC = () => {
    const { smtUser, smtLogout } = useSmtAuth();
    const { user } = useAuth();
    const isSuperAdmin = (user?.role || '').toLowerCase() === 'admin' || user?.role === 'Super Admin' || smtUser?.userId === 'ADMIN';
    const [workOrders, setWorkOrders] = useState<any[]>([]);
    const [exportingWoId, setExportingWoId] = useState<string | null>(null);

    const handleExportExcel = async (workOrderId: string, processStep: string) => {
        if (exportingWoId !== null) return;
        setExportingWoId(workOrderId);
        try {
            const blob = await apiFetch(`/api/smt/export/excel?work_order_id=${workOrderId}&process_step=${processStep}`) as Blob;
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;

            const now = new Date();
            const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-');
            const cleanWo = workOrderId.replace(/[^a-zA-Z0-9_-]/g, '_');
            const fileName = `SMT_${processStep.replace(/\s+/g, '_')}_Report_${cleanWo}_${timestamp}.xlsx`;

            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            addToast('Report downloaded successfully!', 'success');
        } catch (error: any) {
            console.error('Export error:', error);
            addToast(error.message || 'Failed to export report', 'error');
        } finally {
            setExportingWoId(null);
        }
    };

    const [toasts, setToasts] = useState<Toast[]>([]);
    const toastId = useRef(0);

    const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
        const id = ++toastId.current;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    }, []);

    const removeToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));
    const [viewingWoId, setViewingWoId] = useState<string | null>(null);
    const [selectedCount, setSelectedCount] = useState<{
        workOrderId: string;
        stage: string;
        type: string;
        label: string;
    } | null>(null);

    const [formWoId, setFormWoId] = useState('');
    const [productName, setProductName] = useState('');
    const [woQty, setWoQty] = useState('');
    const [panelQty, setPanelQty] = useState('');
    const [createdBy, setCreatedBy] = useState('');
    const [savedEntries, setSavedEntries] = useState<any[]>([]);

    const fetchData = useCallback(async () => {
        try {
            const woRes = await fetch('/api/smt/work-orders/registered');
            if (woRes.ok) setWorkOrders(await woRes.json());

            const setupRes = await fetch('/api/smt/process-setups?process_name=rework');
            if (setupRes.ok) setSavedEntries(await setupRes.json());

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
        const activeFailed = parseInt(wo.active_failed_count || '0');
        return !hasSetup && activeFailed > 0;
    });

    const pendingEntries = savedEntries.filter(entry => {
        const wo = workOrders.find(w => (w.id || w.work_order_id).toUpperCase() === (entry.work_order_id || '').toUpperCase());
        if (!wo) return true;
        const activeFailed = parseInt(wo.active_failed_count || '0');
        return activeFailed > 0;
    });

    const completedEntries = savedEntries.filter(entry => {
        const wo = workOrders.find(w => (w.id || w.work_order_id).toUpperCase() === (entry.work_order_id || '').toUpperCase());
        if (!wo) return false;
        const activeFailed = parseInt(wo.active_failed_count || '0');
        return activeFailed === 0;
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
                onCountClick={(stage, type, label) => setSelectedCount({
                    workOrderId: viewingWoId!,
                    stage,
                    type,
                    label
                })}
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
                                        <td 
                                            className="smt-clickable-count smt-total"
                                            onClick={() => setSelectedCount({
                                                workOrderId: entry.work_order_id,
                                                stage: 'Rework',
                                                type: 'total',
                                                label: 'WO Quantity'
                                            })}
                                        >
                                            {entry.quantity || entry.wo_qty}
                                        </td>
                                        <td 
                                            className="smt-clickable-count smt-panel-count"
                                            onClick={() => setSelectedCount({
                                                workOrderId: entry.work_order_id,
                                                stage: 'Rework',
                                                type: 'total',
                                                label: 'Panel Quantity'
                                            })}
                                        >
                                            {entry.panel_qty || 'N/A'}
                                        </td>
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
                                    <th>DOWNLOAD</th>
                                    <th>ACTION</th>
                                </tr>
                            </thead>
                            <tbody>
                                {completedEntries.map(entry => (
                                    <tr key={entry.id}>
                                        <td style={{ color: '#2563eb', fontWeight: 600 }}>{(entry.work_order_id || '').toUpperCase()}</td>
                                        <td>{(entry.product_name || '').toUpperCase()}</td>
                                        <td 
                                            className="smt-clickable-count smt-total"
                                            onClick={() => setSelectedCount({
                                                workOrderId: entry.work_order_id,
                                                stage: 'Rework',
                                                type: 'total',
                                                label: 'WO Quantity'
                                            })}
                                        >
                                            {entry.quantity || entry.wo_qty}
                                        </td>
                                        <td 
                                            className="smt-clickable-count smt-panel-count"
                                            onClick={() => setSelectedCount({
                                                workOrderId: entry.work_order_id,
                                                stage: 'Rework',
                                                type: 'total',
                                                label: 'Panel Quantity'
                                            })}
                                        >
                                            {entry.panel_qty || 'N/A'}
                                        </td>
                                        <td style={{ fontSize: '0.85rem', color: '#6b7280' }}>{new Date(entry.timestamp).toLocaleTimeString()}</td>
                                        <td>
                                            <button 
                                                className={styles.secondaryButton}
                                                disabled={exportingWoId === entry.work_order_id}
                                                onClick={() => handleExportExcel(entry.work_order_id, 'Rework')}
                                                style={{
                                                    padding: '0.4rem',
                                                    minWidth: '40px',
                                                    width: '40px',
                                                    height: '40px',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    borderRadius: '50%',
                                                    backgroundColor: '#f0fdf4',
                                                    border: '1px solid #bbf7d0',
                                                    color: '#166534',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease',
                                                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                                                }}
                                                title="Export to Excel"
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.backgroundColor = '#166534';
                                                    e.currentTarget.style.color = '#ffffff';
                                                    e.currentTarget.style.borderColor = '#166534';
                                                    e.currentTarget.style.transform = 'scale(1.08)';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.backgroundColor = '#f0fdf4';
                                                    e.currentTarget.style.color = '#166534';
                                                    e.currentTarget.style.borderColor = '#bbf7d0';
                                                    e.currentTarget.style.transform = 'scale(1)';
                                                }}
                                            >
                                                {exportingWoId === entry.work_order_id ? (
                                                    <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>...</span>
                                                ) : (
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                                                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                                                        <polyline points="14 2 14 8 20 8"/>
                                                        <line x1="8" y1="13" x2="16" y2="13"/>
                                                        <line x1="8" y1="17" x2="16" y2="17"/>
                                                        <line x1="10" y1="9" x2="9" y2="9"/>
                                                    </svg>
                                                )}
                                            </button>
                                        </td>
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
                                ))}
                                {completedEntries.length === 0 && (
                                    <tr>
                                        <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>No completed rework sessions found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            {selectedCount && (
                <SMTCountDetailsModal
                    workOrderId={selectedCount.workOrderId}
                    stage={selectedCount.stage}
                    type={selectedCount.type}
                    label={selectedCount.label}
                    onClose={() => setSelectedCount(null)}
                />
            )}
        </>
    );
};

export default Rework;
