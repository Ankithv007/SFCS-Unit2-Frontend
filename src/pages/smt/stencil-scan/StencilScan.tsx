import React, { useState, useEffect, useRef } from 'react';
import styles from './StencilScan.module.css';
import { useToast } from '../../../components/Toast';
import { apiFetch } from '../../../utils/api';
import { 
    Barcode, ScanLine, Clock, User, ClipboardList, Info, ArrowRightLeft, CheckCircle2, RotateCcw
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
    } | null;
}

interface MovementHistory {
    id: string;
    stencil_rack_number: string | null;
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
}

const StencilScan: React.FC = () => {
    const { showToast } = useToast();
    const barcodeInputRef = useRef<HTMLInputElement>(null);

    // Scan state
    const [scannedJobNumber, setScannedJobNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const [stencil, setStencil] = useState<StencilDetails | null>(null);
    const [history, setHistory] = useState<MovementHistory[]>([]);

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

    useEffect(() => {
        focusInput();
    }, []);

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
                setMachine('');
                setProductionLine('');
                setTxRemarks('');
                setRelocateReason('');
                setCondition('Normal');

                showToast('Stencil barcode scanned successfully.', 'success');
            }
        } catch (err: any) {
            showToast(err.message || 'Stencil record not found in active racks.', 'error');
            setScannedJobNumber('');
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

        setLoading(true);
        try {
            const res = await apiFetch('/api/smt/stencil-rack/scan/receive', {
                method: 'POST',
                body: JSON.stringify({
                    job_number: stencil.stencil_rack_number || stencil.job_number,
                    machine: machine.trim(),
                    production_line: productionLine.trim(),
                    remarks: txRemarks.trim()
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
            }
        } catch (err: any) {
            showToast(err.message || 'Receive transaction failed.', 'error');
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
            case 'ASSIGNED': return styles.dotAssigned;
            case 'RECEIVED': return styles.dotReceived;
            case 'RETURNED': return styles.dotReturned;
            case 'RELOCATED': return styles.dotRelocated;
            default: return '';
        }
    };

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.headerRow}>
                <h2><ScanLine size={24} /> Stencil Scan Workflow</h2>
                <p>Operator checkpoint for scan-based stencil check-out (Receive) and check-in (Return).</p>
            </div>

            {/* Scan section */}
            <form className={styles.scanSection} onSubmit={handleScanSubmit}>
                <h3><Barcode size={20} /> Scan Stencil Identifier (Rack # / Job #)</h3>
                <div className={styles.scanInputWrapper}>
                    <input 
                        type="text" 
                        ref={barcodeInputRef}
                        className={styles.scanInput}
                        value={scannedJobNumber}
                        onChange={e => setScannedJobNumber(e.target.value)}
                        placeholder="Scan Stencil Rack Number or Job Number..."
                        disabled={loading}
                        autoFocus
                    />
                    <ScanLine className={styles.scanIcon} size={24} />
                </div>
                <p className={styles.scanPrompt}>Scan physical barcode to fetch location and verify status.</p>
            </form>

            {/* Detail display */}
            {loading && !stencil ? (
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                    <p style={{ color: '#64748b', fontWeight: 600 }}>Loading stencil details...</p>
                </div>
            ) : !stencil ? (
                <div className={styles.emptyState}>
                    <Info size={48} strokeWidth={1.5} />
                    <h3>No Stencil Scanned</h3>
                    <p>Scan a job barcode above to retrieve coordinates and initialize checkout/return.</p>
                </div>
            ) : (
                <div className={styles.infoGrid}>
                    {/* Left side: Information and Actions */}
                    <div>
                        {/* Stencil Information Card */}
                        <div className={styles.card}>
                            <h3><ClipboardList size={20} /> Stencil Status</h3>
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
                                    <span className={styles.dataValue}>{stencil.side || 'N/A'}</span>
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
                                        <User size={16} /> Active Holder Information
                                    </h4>
                                    <div className={styles.dataGrid} style={{ gap: '0.75rem' }}>
                                        <div className={styles.dataItem}>
                                            <span className={styles.dataLabel}>Operator</span>
                                            <span className={styles.dataValue} style={{ fontSize: '0.9rem' }}>
                                                {stencil.holder.employee_name} ({stencil.holder.employee_code})
                                            </span>
                                        </div>
                                        <div className={styles.dataItem}>
                                            <span className={styles.dataLabel}>Department / Role</span>
                                            <span className={styles.dataValue} style={{ fontSize: '0.9rem' }}>
                                                {stencil.holder.department} / {stencil.holder.role}
                                            </span>
                                        </div>
                                        <div className={styles.dataItem}>
                                            <span className={styles.dataLabel}>Received At</span>
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
                                        <button type="submit" className={`${styles.btnAction} ${styles.btnReceive}`}>
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
                                                <span className={styles.timelineText}>
                                                    Assigned SMT line/machine: {item.production_line || 'N/A'} / {item.machine || 'N/A'}
                                                </span>
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
