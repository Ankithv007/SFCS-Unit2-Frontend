import React, { useState, useEffect, useRef, useMemo } from 'react';
import styles from './StencilScan.module.css';
import { useToast } from '../../../components/Toast';
import { apiFetch } from '../../../utils/api';
import { isStencilSideCompatible } from '../../../utils/smtHelper';
import { WorkOrderSelector } from '../../../components/WorkOrderSelector';
import { 
    Barcode, ScanLine, Search, Clock, User, Info, ArrowRightLeft, CheckCircle2, RotateCcw, AlertTriangle
} from 'lucide-react';

interface StencilDetails {
    stencil_rack_number: string;
    job_number: string;
    stencil_name: string | null;
    revision: string | null;
    thickness_mills: number | null;
    manufacturing_date: string | null;
    side: 'TOP' | 'BOTTOM' | 'TOP/BOTTOM' | null;
    location_id: string;
    location_code: string;
    rack_id: string;
    rack_name: string;
    rack_status: 'ACTIVE' | 'INACTIVE';
    row_number: number;
    column_number: number;
    location_status: 'STORED' | 'CHECKED_OUT';
    remarks: string | null;
    holder: {
        employee_code: string;
        employee_name: string;
        department: string;
        role: string;
        received_at: string;
        elapsed_time: string | null;
        work_order_id?: string | null;
        work_order_number?: string | null;
        work_order_side?: string | null;
        machine?: string | null;
        production_line?: string | null;
        remarks?: string | null;
    } | null;
}

interface MovementHistory {
    id: string;
    stencil_rack_number: string | null;
    side?: string | null;
    action: 'CREATED' | 'ASSIGNED' | 'RECEIVED' | 'RETURNED' | 'RELOCATED' | 'UPDATED';
    employee_code: string;
    employee_name: string;
    department: string;
    role: string;
    machine: string | null;
    production_line: string | null;
    location_code: string | null;
    from_rack_name: string | null;
    from_row: number | null;
    from_col: number | null;
    to_rack_name: string | null;
    to_row: number | null;
    to_col: number | null;
    remarks: string | null;
    reason: string | null;
    condition: string | null;
    created_at: string;
    work_order_id?: string | null;
    work_order_number?: string | null;
    work_order_side?: string | null;
}

const StencilScan: React.FC = () => {
    const { showToast } = useToast();
    const barcodeInputRef = useRef<HTMLInputElement>(null);

    // Scan state
    const [scannedJobNumber, setScannedJobNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const [stencil, setStencil] = useState<StencilDetails | null>(null);
    const [history, setHistory] = useState<MovementHistory[]>([]);

    // Work Order options state
    const [workOrders, setWorkOrders] = useState<any[]>([]);
    const [selectedWoId, setSelectedWoId] = useState('');

    // Transaction form states
    const [machine, setMachine] = useState('');
    const [productionLine, setProductionLine] = useState('');
    const [txRemarks, setTxRemarks] = useState('');
    
    // Return form states
    const [targetLocationId, setTargetLocationId] = useState('');
    const [emptySlots, setEmptySlots] = useState<{ id: string; code: string }[]>([]);
    const [condition, setCondition] = useState<'Normal' | 'Damaged' | 'Needs Cleaning'>('Normal');
    const [relocateReason, setRelocateReason] = useState('');
    const [isChangingLocation, setIsChangingLocation] = useState(false);

    const [lifecycleRecords, setLifecycleRecords] = useState<any[]>([]);

    useEffect(() => {
        focusInput();
        fetchWorkOrders();
        fetchLifecycleRecords();
    }, []);

    const fetchWorkOrders = async () => {
        try {
            let res = await apiFetch('/api/smt/stencil-lifecycle/work-orders');
            let rawList: any[] = [];
            
            if (Array.isArray(res)) {
                rawList = res;
            } else if (res && res.success && Array.isArray(res.data)) {
                rawList = res.data;
            } else if (res && Array.isArray(res.workOrders)) {
                rawList = res.workOrders;
            } else {
                // Fallback to work-orders endpoint
                const fallbackRes = await apiFetch('/api/smt/work-orders');
                if (Array.isArray(fallbackRes)) {
                    rawList = fallbackRes;
                } else if (fallbackRes && Array.isArray(fallbackRes.data)) {
                    rawList = fallbackRes.data;
                } else if (fallbackRes && Array.isArray(fallbackRes.workOrders)) {
                    rawList = fallbackRes.workOrders;
                }
            }

            const normalizedList = rawList
                .filter((wo: any) => wo && wo.status !== 'Cancelled' && wo.status !== 'Deleted')
                .map((wo: any) => ({
                    ...wo,
                    work_order_id: String(wo.work_order_id || wo.id || ''),
                    id: String(wo.id || wo.work_order_id || ''),
                    sides: wo.sides || wo.side || '',
                    side: wo.sides || wo.side || '',
                }));

            setWorkOrders(normalizedList);
        } catch (err: any) {
            console.error('Failed to fetch work orders for stencil scan:', err);
        }
    };

    const fetchLifecycleRecords = async () => {
        try {
            const res = await apiFetch('/api/smt/stencil-lifecycle/records');
            if (Array.isArray(res)) setLifecycleRecords(res);
            else if (res && Array.isArray(res.records)) setLifecycleRecords(res.records);
        } catch (err) {
            console.error('Failed to fetch lifecycle records in StencilScan:', err);
        }
    };

    const selectedWO = useMemo(() => {
        return workOrders.find(wo => String(wo.work_order_id || wo.id) === String(selectedWoId));
    }, [workOrders, selectedWoId]);

    const isSideMismatch = useMemo(() => {
        if (!stencil || !selectedWO) return false;
        return !isStencilSideCompatible(selectedWO.sides || selectedWO.side, stencil.side);
    }, [stencil, selectedWO]);

    const sideMismatchErrorMsg = useMemo(() => {
        if (!isSideMismatch || !stencil || !selectedWO) return '';
        const rawWoSide = selectedWO.sides || selectedWO.side || 'N/A';
        const rawStencilSide = stencil.side || 'N/A';
        return `Work Order side is not compatible with the stencil side. Work Order: ${rawWoSide}, Stencil: ${rawStencilSide}`;
    }, [isSideMismatch, stencil, selectedWO]);

    const isSequenceMismatch = useMemo(() => {
        if (!stencil || !selectedWO) return false;
        const woSideNorm = (selectedWO.sides || selectedWO.side || '').trim().toLowerCase();
        const stencilSideNorm = (stencil.side || '').trim().toLowerCase();

        if (woSideNorm.includes('/') || woSideNorm === 'top / bottom' || woSideNorm === 'top/bottom') {
            const woId = String(selectedWO.work_order_id || selectedWO.id);
            const woRecords = lifecycleRecords.filter(r => String(r.work_order_id) === woId && !r.is_deleted);
            const hasBottom = woRecords.some(r => (r.sides || '').trim().toLowerCase() === 'bottom');

            if (stencilSideNorm.includes('top') && !stencilSideNorm.includes('bottom') && !hasBottom) {
                return true;
            }
        }
        return false;
    }, [stencil, selectedWO, lifecycleRecords]);

    const sequenceErrorMsg = 'Please register the BOTTOM stencil first for this TOP/BOTTOM Work Order.';

    const focusInput = () => {
        if (barcodeInputRef.current) {
            barcodeInputRef.current.focus();
        }
    };

    const handleScanSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!scannedJobNumber.trim()) return;

        setLoading(true);
        setStencil(null);
        setHistory([]);
        setIsChangingLocation(false);
        setTargetLocationId('');
        
        try {
            const res = await apiFetch(`/api/smt/stencil-rack/stencil-info/${scannedJobNumber.trim()}`);
            if (res.success) {
                setStencil(res.stencil);
                setHistory(res.history);
                
                // Clear fields
                setSelectedWoId('');
                setMachine('');
                setProductionLine('');
                setTxRemarks('');
                setRelocateReason('');
                setCondition('Normal');
            } else {
                showToast(res.message || 'Stencil scan failed.', 'error');
            }
        } catch (err: any) {
            showToast(err.message || 'Error fetching stencil information.', 'error');
        } finally {
            setLoading(false);
            focusInput();
        }
    };

    const fetchEmptySlots = async () => {
        try {
            // Fetch all active racks
            const racksRes = await apiFetch('/api/smt/stencil-rack');
            if (racksRes.success) {
                const emptyList: { id: string; code: string }[] = [];
                for (const rack of racksRes.racks) {
                    if (rack.status !== 'ACTIVE') continue;
                    const locsRes = await apiFetch(`/api/smt/stencil-rack/${rack.id}/locations`);
                    if (locsRes.success) {
                        const empties = locsRes.locations
                            .filter((l: any) => l.status === 'EMPTY')
                            .map((l: any) => ({ id: l.id, code: l.location_code }));
                        emptyList.push(...empties);
                    }
                }
                setEmptySlots(emptyList);
            }
        } catch (err: any) {
            console.error('Failed to load empty slots:', err);
        }
    };

    const handleReceive = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!stencil) return;

        if (!selectedWoId) {
            showToast('Please select a valid Work Order before checking out the stencil.', 'error');
            return;
        }

        if (isSideMismatch) {
            showToast(sideMismatchErrorMsg, 'error');
            return;
        }

        if (isSequenceMismatch) {
            showToast(sequenceErrorMsg, 'error');
            return;
        }

        setLoading(true);
        try {
            const res = await apiFetch('/api/smt/stencil-rack/scan/receive', {
                method: 'POST',
                body: JSON.stringify({
                    job_number: stencil.stencil_rack_number || stencil.job_number,
                    work_order_id: selectedWoId,
                    work_order_number: selectedWoId,
                    machine: machine.trim(),
                    production_line: productionLine.trim(),
                    remarks: txRemarks.trim()
                })
            });

            if (res.success) {
                showToast(res.message, 'success');
                setSelectedWoId('');
                setMachine('');
                setProductionLine('');
                setTxRemarks('');
                fetchWorkOrders();
                fetchLifecycleRecords();
                if (stencil.stencil_rack_number || stencil.job_number) {
                    const infoRes = await apiFetch(`/api/smt/stencil-rack/stencil-info/${stencil.stencil_rack_number || stencil.job_number}`);
                    if (infoRes.success) {
                        setStencil(infoRes.stencil);
                        setHistory(infoRes.history);
                    }
                }
            } else {
                showToast(res.message || 'Failed to checkout stencil.', 'error');
            }
        } catch (err: any) {
            console.error('Checkout stencil error:', err);
            showToast(err.message || 'Failed to checkout stencil.', 'error');
        } finally {
            setLoading(false);
            focusInput();
        }
    };

    const handleReturn = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!stencil) return;

        setLoading(true);
        try {
            const destLocationId = isChangingLocation ? targetLocationId : stencil.location_id;
            
            if (isChangingLocation && !destLocationId) {
                showToast('Please select a target return slot.', 'error');
                setLoading(false);
                return;
            }

            const res = await apiFetch('/api/smt/stencil-rack/scan/return', {
                method: 'POST',
                body: JSON.stringify({
                    job_number: stencil.stencil_rack_number || stencil.job_number,
                    target_location_id: destLocationId,
                    condition,
                    remarks: txRemarks.trim(),
                    reason: relocateReason.trim()
                })
            });

            if (res.success) {
                showToast(res.message, 'success');
                // Reload details
                const infoRes = await apiFetch(`/api/smt/stencil-rack/stencil-info/${stencil.stencil_rack_number || stencil.job_number}`);
                if (infoRes.success) {
                    setStencil(infoRes.stencil);
                    setHistory(infoRes.history);
                }
                setIsChangingLocation(false);
                setTargetLocationId('');
            }
        } catch (err: any) {
            showToast(err.message || 'Return transaction failed.', 'error');
        } finally {
            setLoading(false);
            focusInput();
        }
    };

    const getDotClass = (action: string) => {
        switch (action) {
            case 'CREATED': return styles.dotCreated;
            case 'ASSIGNED': return styles.dotAssigned;
            case 'RECEIVED': return styles.dotReceived;
            case 'RETURNED': return styles.dotReturned;
            case 'RELOCATED': return styles.dotRelocated;
            default: return styles.dotDefault;
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h2><Barcode size={24} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} /> Stencil Scan (Receive / Return)</h2>
                    <p style={{ color: '#64748b', margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>
                        Scan physical stencil barcode or Job Number to check out (receive to SMT line) or check in (return to rack).
                    </p>
                </div>
            </div>

            {/* Scan Card */}
            <div className={styles.scanCard}>
                <div className={styles.scanCardHeader}>
                    <div className={styles.scanCardTitle}>
                        <ScanLine size={20} className={styles.titleIcon} />
                        <h3>Scan / Search Stencil</h3>
                    </div>
                    <span className={styles.scanCardSubtitle}>
                        Scan barcode, enter Stencil Rack Number, or enter Job Number
                    </span>
                </div>
                <form onSubmit={handleScanSubmit} className={styles.scanForm}>
                    <div className={styles.scanInputWrapper}>
                        <Barcode className={styles.scanInputIcon} size={18} />
                        <input
                            ref={barcodeInputRef}
                            type="text"
                            className={styles.scanInput}
                            placeholder="Scan Stencil Barcode, Rack Number, or Job Number..."
                            value={scannedJobNumber}
                            onChange={(e) => setScannedJobNumber(e.target.value)}
                            disabled={loading}
                            autoFocus
                        />
                    </div>
                    <button 
                        type="submit" 
                        className={styles.btnScan} 
                        disabled={loading || !scannedJobNumber.trim()}
                    >
                        <Search size={18} />
                        <span>{loading ? 'Searching...' : 'Scan / Search'}</span>
                    </button>
                </form>
            </div>

            {/* Stencil Details & Actions */}
            {stencil && (
                <div className={styles.gridContainer}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {/* Stencil Card */}
                        <div className={styles.card}>
                            <div className={styles.cardHeader}>
                                <h3><Info size={20} /> Stencil Details</h3>
                                <span className={`${styles.statusBadge} ${
                                    stencil.location_status === 'STORED' ? styles.statusAvailable : styles.statusCheckedOut
                                }`}>
                                    {stencil.location_status === 'STORED' ? 'STORED' : 'CHECKED OUT'}
                                </span>
                            </div>

                            <div className={styles.dataGrid}>
                                <div className={styles.dataItem}>
                                    <span className={styles.dataLabel}>1. Stencil Rack Number</span>
                                    <span className={styles.dataValue} style={{ fontSize: '1.1rem', color: '#2563eb', fontWeight: 'bold' }}>{stencil.stencil_rack_number}</span>
                                </div>
                                <div className={styles.dataItem}>
                                    <span className={styles.dataLabel}>2. Job Number</span>
                                    <span className={styles.dataValue}>{stencil.job_number}</span>
                                </div>
                                <div className={styles.dataItem}>
                                    <span className={styles.dataLabel}>3. Stencil / Model Name</span>
                                    <span className={styles.dataValue}>{stencil.stencil_name || 'N/A'}</span>
                                </div>
                                <div className={styles.dataItem}>
                                    <span className={styles.dataLabel}>4. Revision</span>
                                    <span className={styles.dataValue}>{stencil.revision || 'N/A'}</span>
                                </div>
                                <div className={styles.dataItem}>
                                    <span className={styles.dataLabel}>5. Thickness (mills)</span>
                                    <span className={styles.dataValue}>{stencil.thickness_mills !== null ? `${stencil.thickness_mills} mills` : 'N/A'}</span>
                                </div>
                                <div className={styles.dataItem}>
                                    <span className={styles.dataLabel}>6. Manufacturing Date</span>
                                    <span className={styles.dataValue}>
                                        {stencil.manufacturing_date ? new Date(stencil.manufacturing_date).toLocaleDateString() : 'N/A'}
                                    </span>
                                </div>
                                <div className={styles.dataItem}>
                                    <span className={styles.dataLabel}>7. Sides</span>
                                    <span className={styles.dataValue} style={{ fontWeight: 600, color: '#0369a1' }}>{stencil.side || 'N/A'}</span>
                                </div>
                                <div className={styles.dataItem}>
                                    <span className={styles.dataLabel}>8. Current Rack</span>
                                    <span className={styles.dataValue}>{stencil.rack_name}</span>
                                </div>
                                <div className={styles.dataItem}>
                                    <span className={styles.dataLabel}>9. Current Row</span>
                                    <span className={styles.dataValue}>{stencil.row_number}</span>
                                </div>
                                <div className={styles.dataItem}>
                                    <span className={styles.dataLabel}>10. Current Column</span>
                                    <span className={styles.dataValue}>{stencil.column_number}</span>
                                </div>
                                <div className={styles.dataItem}>
                                    <span className={styles.dataLabel}>11. Location Code</span>
                                    <span className={styles.dataValue} style={{ color: '#0369a1', fontWeight: 600 }}>{stencil.location_code}</span>
                                </div>
                                <div className={styles.dataItem}>
                                    <span className={styles.dataLabel}>12. Current Status</span>
                                    <span className={`${styles.statusBadge} ${
                                        stencil.location_status === 'STORED' ? styles.statusAvailable : styles.statusCheckedOut
                                    }`}>
                                        {stencil.location_status === 'STORED' ? 'Available in Rack' : 'Checked Out'}
                                    </span>
                                </div>
                                <div className={styles.dataItem}>
                                    <span className={styles.dataLabel}>13. Current Holder</span>
                                    <span className={styles.dataValue}>
                                        {stencil.holder ? `${stencil.holder.employee_name} (${stencil.holder.employee_code})` : 'N/A'}
                                    </span>
                                </div>
                                <div className={styles.dataItem}>
                                    <span className={styles.dataLabel}>14. Received Date</span>
                                    <span className={styles.dataValue}>
                                        {stencil.holder ? new Date(stencil.holder.received_at).toLocaleDateString() : 'N/A'}
                                    </span>
                                </div>
                                <div className={styles.dataItem}>
                                    <span className={styles.dataLabel}>15. Received Time</span>
                                    <span className={styles.dataValue}>
                                        {stencil.holder ? new Date(stencil.holder.received_at).toLocaleTimeString() : 'N/A'}
                                    </span>
                                </div>
                                <div className={styles.dataItem}>
                                    <span className={styles.dataLabel}>16. Elapsed Time</span>
                                    <span className={styles.dataValue} style={{ color: stencil.holder ? '#b45309' : 'inherit' }}>
                                        {stencil.holder ? (stencil.holder.elapsed_time || 'Less than 1 minute') : 'N/A'}
                                    </span>
                                </div>
                                <div className={styles.dataItem} style={{ gridColumn: 'span 2' }}>
                                    <span className={styles.dataLabel}>17. Remarks</span>
                                    <span className={styles.dataValue}>{stencil.remarks || 'N/A'}</span>
                                </div>
                            </div>

                            {/* Active Holder details if checked out */}
                            {stencil.location_status === 'CHECKED_OUT' && stencil.holder && (
                                <div style={{ 
                                    marginTop: '1.5rem', 
                                    padding: '1rem', 
                                    backgroundColor: '#fffbeb', 
                                    border: '1px solid #fef3c7', 
                                    borderRadius: '8px' 
                                }}>
                                    <h4 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#b45309' }}>
                                        <User size={16} /> Active Holder & Checkout Details
                                    </h4>
                                    <div className={styles.dataGrid} style={{ gap: '0.75rem' }}>
                                        <div className={styles.dataItem}>
                                            <span className={styles.dataLabel}>Checked Out By</span>
                                            <span className={styles.dataValue} style={{ fontSize: '0.9rem' }}>
                                                {stencil.holder.employee_name} ({stencil.holder.employee_code})
                                            </span>
                                        </div>
                                        <div className={styles.dataItem}>
                                            <span className={styles.dataLabel}>Work Order</span>
                                            <span className={styles.dataValue} style={{ fontSize: '0.9rem', color: '#2563eb', fontWeight: 600 }}>
                                                {stencil.holder.work_order_number || stencil.holder.work_order_id || 'N/A'}
                                            </span>
                                        </div>
                                        <div className={styles.dataItem}>
                                            <span className={styles.dataLabel}>Work Order Side</span>
                                            <span className={styles.dataValue} style={{ fontSize: '0.9rem', color: '#2563eb', fontWeight: 600 }}>
                                                {stencil.holder.work_order_side || 'N/A'}
                                            </span>
                                        </div>
                                        <div className={styles.dataItem}>
                                            <span className={styles.dataLabel}>Target SMT Machine</span>
                                            <span className={styles.dataValue} style={{ fontSize: '0.9rem' }}>
                                                {stencil.holder.machine || 'N/A'}
                                            </span>
                                        </div>
                                        <div className={styles.dataItem}>
                                            <span className={styles.dataLabel}>Target Production Line</span>
                                            <span className={styles.dataValue} style={{ fontSize: '0.9rem' }}>
                                                {stencil.holder.production_line || 'N/A'}
                                            </span>
                                        </div>
                                        <div className={styles.dataItem}>
                                            <span className={styles.dataLabel}>Checked Out Date/Time</span>
                                            <span className={styles.dataValue} style={{ fontSize: '0.9rem' }}>
                                                {new Date(stencil.holder.received_at).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className={styles.dataItem}>
                                            <span className={styles.dataLabel}>Elapsed Checkout Duration</span>
                                            <span className={styles.dataValue} style={{ fontSize: '0.9rem', color: '#b45309' }}>
                                                {stencil.holder.elapsed_time || 'Less than 1 minute'}
                                            </span>
                                        </div>
                                        <div className={styles.dataItem} style={{ gridColumn: 'span 2' }}>
                                            <span className={styles.dataLabel}>Checkout Remarks</span>
                                            <span className={styles.dataValue} style={{ fontSize: '0.9rem' }}>
                                                {stencil.holder.remarks || 'N/A'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Interactive Workflow Forms */}
                        <div className={styles.card}>
                            {stencil.location_status === 'STORED' ? (
                                <div className={`${styles.actionCard} ${styles.actionReceive}`}>
                                    <h4 className={styles.actionHeader}><CheckCircle2 size={20} /> Check Out Stencil (Receive to SMT Line)</h4>
                                    <form onSubmit={handleReceive}>
                                        <div className={styles.inputGroup} style={{ marginBottom: '1rem' }}>
                                            <label>Work Order <span>*</span></label>
                                            <WorkOrderSelector
                                                options={workOrders}
                                                value={selectedWoId}
                                                onChange={(val) => setSelectedWoId(val)}
                                                placeholder="Select or search Work Order Number..."
                                                valueKey="work_order_id"
                                                labelKey="work_order_id"
                                                productNameKey="product_name"
                                                quantityKey="quantity"
                                                required
                                            />
                                            {selectedWO && (
                                                <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', backgroundColor: '#eff6ff', borderRadius: '6px', fontSize: '0.82rem', color: '#1e40af', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                                    <span><strong>WO:</strong> {selectedWO.work_order_id}</span>
                                                    <span><strong>Model:</strong> {selectedWO.product_name || 'N/A'}</span>
                                                    <span><strong>Qty:</strong> {selectedWO.quantity || 'N/A'}</span>
                                                    <span><strong>WO Side:</strong> {selectedWO.sides || selectedWO.side || 'N/A'}</span>
                                                    <span><strong>Stencil Side:</strong> {stencil.side || 'N/A'}</span>
                                                </div>
                                            )}
                                            {isSideMismatch && (
                                                <div style={{
                                                    marginTop: '0.75rem',
                                                    padding: '0.75rem 1rem',
                                                    backgroundColor: '#fef2f2',
                                                    border: '1px solid #fecaca',
                                                    borderRadius: '6px',
                                                    color: '#dc2626',
                                                    fontSize: '0.85rem',
                                                    fontWeight: 600,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.5rem'
                                                }}>
                                                    <AlertTriangle size={18} />
                                                    <span>{sideMismatchErrorMsg}</span>
                                                </div>
                                            )}
                                            {isSequenceMismatch && (
                                                <div style={{
                                                    marginTop: '0.75rem',
                                                    padding: '0.75rem 1rem',
                                                    backgroundColor: '#fef2f2',
                                                    border: '1px solid #fecaca',
                                                    borderRadius: '6px',
                                                    color: '#dc2626',
                                                    fontSize: '0.85rem',
                                                    fontWeight: 600,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.5rem'
                                                }}>
                                                    <AlertTriangle size={18} />
                                                    <span>{sequenceErrorMsg}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className={styles.formGrid}>
                                            <div className={styles.inputGroup}>
                                                <label>Target SMT Machine <span>*</span></label>
                                                <input 
                                                    type="text" 
                                                    className={styles.input} 
                                                    required
                                                    value={machine} 
                                                    onChange={e => setMachine(e.target.value)} 
                                                    placeholder="e.g. SMT-LINE1-PRINTER"
                                                />
                                            </div>
                                            <div className={styles.inputGroup}>
                                                <label>Target Production Line <span>*</span></label>
                                                <input 
                                                    type="text" 
                                                    className={styles.input} 
                                                    required
                                                    value={productionLine} 
                                                    onChange={e => setProductionLine(e.target.value)} 
                                                    placeholder="e.g. Line 1"
                                                />
                                            </div>
                                        </div>
                                        <div className={styles.inputGroup}>
                                            <label>Remarks</label>
                                            <input 
                                                type="text" 
                                                className={styles.input} 
                                                value={txRemarks} 
                                                onChange={e => setTxRemarks(e.target.value)} 
                                                placeholder="Remarks..."
                                            />
                                        </div>
                                        <button 
                                            type="submit" 
                                            className={`${styles.btnAction} ${styles.btnReceive}`} 
                                            disabled={!selectedWoId || isSideMismatch || isSequenceMismatch || !machine || !productionLine || loading}
                                        >
                                            Confirm Check-Out
                                        </button>
                                    </form>
                                </div>
                            ) : (
                                <div className={`${styles.actionCard} ${styles.actionReturn}`}>
                                    <h4 className={styles.actionHeader}><RotateCcw size={20} /> Check In Stencil (Return to Rack)</h4>
                                    <form onSubmit={handleReturn}>
                                        <div className={styles.formGrid}>
                                            <div className={styles.inputGroup}>
                                                <label>Original Assigned Slot</label>
                                                <input 
                                                    type="text" 
                                                    className={styles.input} 
                                                    disabled 
                                                    value={stencil.location_code} 
                                                />
                                            </div>
                                            <div className={styles.inputGroup}>
                                                <label>Stencil Condition</label>
                                                <select 
                                                    className={styles.select} 
                                                    value={condition} 
                                                    onChange={e => setCondition(e.target.value as any)}
                                                >
                                                    <option value="Normal">Normal</option>
                                                    <option value="Needs Cleaning">Needs Cleaning</option>
                                                    <option value="Damaged">Damaged</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Toggle for return relocation */}
                                        <div style={{ margin: '1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <input 
                                                type="checkbox" 
                                                id="relocateCheck"
                                                checked={isChangingLocation}
                                                onChange={e => {
                                                    setIsChangingLocation(e.target.checked);
                                                    if (e.target.checked) fetchEmptySlots();
                                                }}
                                            />
                                            <label htmlFor="relocateCheck" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
                                                Check in to a different empty slot (Relocate)
                                            </label>
                                        </div>

                                        {isChangingLocation && (
                                            <div className={styles.formGrid} style={{ backgroundColor: '#fff', padding: '1rem', borderRadius: '8px', border: '1px solid #fbcfe8', marginBottom: '1rem' }}>
                                                <div className={styles.inputGroup}>
                                                    <label>Select Empty Target Slot *</label>
                                                    <select 
                                                        className={styles.select}
                                                        value={targetLocationId}
                                                        onChange={e => setTargetLocationId(e.target.value)}
                                                        required
                                                    >
                                                        <option value="">-- Choose Slot --</option>
                                                        {emptySlots.map(s => (
                                                            <option key={s.id} value={s.id}>{s.code}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className={styles.inputGroup}>
                                                    <label>Relocation Reason *</label>
                                                    <input 
                                                        type="text" 
                                                        className={styles.input} 
                                                        value={relocateReason} 
                                                        onChange={e => setRelocateReason(e.target.value)} 
                                                        placeholder="Reason for slot relocation"
                                                        required
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        <div className={styles.inputGroup}>
                                            <label>Remarks</label>
                                            <input 
                                                type="text" 
                                                className={styles.input} 
                                                value={txRemarks} 
                                                onChange={e => setTxRemarks(e.target.value)} 
                                                placeholder="Remarks..."
                                            />
                                        </div>
                                        
                                        <button type="submit" className={`${styles.btnAction} ${styles.btnReturn}`}>
                                            Confirm Check-In
                                        </button>
                                    </form>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right side: Movement History Timeline */}
                    <div className={styles.card}>
                        <h3><Clock size={20} /> Movement Logs</h3>
                        {history.length === 0 ? (
                            <p style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.85rem' }}>No movement history found for this stencil.</p>
                        ) : (
                            <div className={styles.timeline}>
                                {history.map(item => (
                                    <div key={item.id} className={styles.timelineItem}>
                                        <span className={`${styles.timelineDot} ${getDotClass(item.action)}`}></span>
                                        <div className={styles.timelineContent}>
                                            <div className={styles.timelineHeader}>
                                                <span className={styles.timelineTitle}>
                                                    {item.action} {item.stencil_rack_number ? `(${item.stencil_rack_number})` : ''}
                                                </span>
                                                <span className={styles.timelineTime}>
                                                    {new Date(item.created_at).toLocaleString()}
                                                </span>
                                            </div>
                                            <span className={styles.timelineMeta}>
                                                Actor: {item.employee_name} ({item.employee_code}) • {item.department}
                                            </span>
                                            
                                            {item.action === 'RECEIVED' && (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: '0.25rem' }}>
                                                    {(item.work_order_number || item.work_order_id) && (
                                                        <span className={styles.timelineText} style={{ color: '#2563eb', fontWeight: 600 }}>
                                                            Work Order: {item.work_order_number || item.work_order_id} {item.work_order_side ? `(WO Side: ${item.work_order_side})` : ''}
                                                        </span>
                                                    )}
                                                    {item.side && (
                                                        <span className={styles.timelineText} style={{ color: '#0369a1', fontWeight: 500 }}>
                                                            Stencil Side: {item.side}
                                                        </span>
                                                    )}
                                                    <span className={styles.timelineText}>
                                                        Assigned SMT line/machine: {item.production_line || 'N/A'} / {item.machine || 'N/A'}
                                                    </span>
                                                </div>
                                            )}

                                            {item.action === 'RELOCATED' && (
                                                <span className={styles.timelineText} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                    Moved from {item.from_rack_name} (R{item.from_row}C{item.from_col}) <ArrowRightLeft size={12} /> {item.to_rack_name} (R{item.to_row}C{item.to_col})
                                                </span>
                                            )}

                                            {item.action === 'RETURNED' && (
                                                <span className={styles.timelineText}>
                                                    Slot: {item.location_code} • Condition: {item.condition}
                                                </span>
                                            )}

                                            {item.remarks && (
                                                <span className={styles.timelineText} style={{ fontStyle: 'italic' }}>
                                                    Remarks: "{item.remarks}"
                                                </span>
                                            )}

                                            {item.reason && (
                                                <span className={styles.timelineText} style={{ fontStyle: 'italic', color: '#b45309' }}>
                                                    Reason: "{item.reason}"
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StencilScan;
