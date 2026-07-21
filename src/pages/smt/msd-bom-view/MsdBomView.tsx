import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from './MsdBomView.module.css';
import { 
    ArrowLeft, RefreshCw, FileSpreadsheet, Search, Loader2, X, Eye
} from 'lucide-react';

interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
}

interface RecordDetails {
    id: string;
    work_order_id: string;
    work_order_number: string;
    product_name: string;
    product_description: string | null;
    quantity: number;
    remarks: string | null;
    status: 'ACTIVE' | 'CLOSED';
    created_by: string;
    created_at: string;
}

interface BomItem {
    id: string;
    msd_id: string;
    material_management_item_id: string | null;
    sl_no: string | null;
    vepl_part_no: string;
    description: string | null;
    manufacturer: string | null;
    mfr_part_no: string | null;
    qty_per_product: string | number | null;
    required_qty: string | number | null;
    issued_qty: string | number | null;
    msl_raw: string | null;
    msl_normalized: string;
    packing_condition: 'Sealed' | 'Open' | null;
    status: string;
    open_date: string | null;
    closed_date: string | null;
    package_thickness: string | number | null;
    thickness_category: string | null;
    bake_method: string | null;
    bake_time: string | number | null;
    floor_life_hours: number;
    timer_status: 'NOT_STARTED' | 'RUNNING' | 'FROZEN';
    is_expired: boolean;
    created_at: string;
    updated_at: string;
}

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

const MsdBomView: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    // Toasts
    const [toasts, setToasts] = useState<Toast[]>([]);
    const toastId = useRef(0);
    const addToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        const id = toastId.current++;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    };

    // States
    const [recordDetails, setRecordDetails] = useState<RecordDetails | null>(null);
    const [bomItems, setBomItems] = useState<BomItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
    const [currentTime, setCurrentTime] = useState<Date>(new Date());
    const [updatingMasterStatus, setUpdatingMasterStatus] = useState(false);
    const [editingItem, setEditingItem] = useState<BomItem | null>(null);

    // Live ticking clock for exposure calculations
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 10000); // tick every 10 seconds
        return () => clearInterval(interval);
    }, []);

    // Load data from backend
    const loadData = async () => {
        if (!id) return;
        setIsLoading(true);
        try {
            const token = localStorage.getItem('auth_token') || '';
            
            // 1. Fetch record details
            const detailRes = await fetch(`/api/smt/msd-tracker/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!detailRes.ok) throw new Error('Failed to load MSD record details.');
            const detailData = await detailRes.json();
            if (detailData.success) {
                setRecordDetails(detailData.data);
            }

            // 2. Fetch BOM items
            const bomRes = await fetch(`/api/smt/msd-tracker/${id}/bom`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!bomRes.ok) throw new Error('Failed to load BOM items.');
            const bomData = await bomRes.json();
            if (bomData.success && Array.isArray(bomData.data)) {
                setBomItems(bomData.data);
            }

        } catch (err: any) {
            addToast(err.message || 'Error loading worksheet data.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [id]);

    // Handle Master Record Status Update (ACTIVE / CLOSED)
    const handleMasterStatusChange = async (nextStatus: 'ACTIVE' | 'CLOSED') => {
        if (!id || !recordDetails) return;
        setUpdatingMasterStatus(true);
        try {
            const token = localStorage.getItem('auth_token') || '';
            const response = await fetch(`/api/smt/msd-tracker/${id}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: nextStatus })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to update MSD status.');
            }

            setRecordDetails(prev => prev ? { ...prev, status: nextStatus } : null);
            addToast(`MSD Record marked as ${nextStatus} successfully.`, 'success');
        } catch (err: any) {
            addToast(err.message || 'Failed to update status.', 'error');
        } finally {
            setUpdatingMasterStatus(false);
        }
    };

    // Auto-save function for single BOM row
    const autoSaveRow = async (itemId: string, updatedFields: Partial<BomItem>) => {
        setSavingIds(prev => {
            const next = new Set(prev);
            next.add(itemId);
            return next;
        });

        try {
            const token = localStorage.getItem('auth_token') || '';
            const response = await fetch(`/api/smt/msd-tracker/bom-item/${itemId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updatedFields)
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Auto-save failed.');
            }

            if (data.success && data.data) {
                // Update local state with the returned calculated row from backend
                setBomItems(prev => prev.map(item => item.id === itemId ? data.data : item));
                addToast('Saved successfully.', 'success');
            }
        } catch (err: any) {
            addToast(err.message || 'Auto-save failed.', 'error');
            // Re-fetch to sync state on failure
            loadData();
        } finally {
            setSavingIds(prev => {
                const next = new Set(prev);
                next.delete(itemId);
                return next;
            });
        }
    };

    // Handlers for inline edits
    const handlePackingConditionChange = (itemId: string, val: string) => {
        const nextVal = val === '' ? null : val;
        // Reset dependent fields locally before save
        setBomItems(prev => prev.map(item => {
            if (item.id === itemId) {
                return {
                    ...item,
                    packing_condition: nextVal as any,
                    open_date: null,
                    closed_date: null,
                    package_thickness: nextVal === null ? null : item.package_thickness,
                    thickness_category: nextVal === null ? null : item.thickness_category,
                    bake_method: null,
                    bake_time: null,
                    status: 'Pending',
                    timer_status: 'NOT_STARTED',
                    is_expired: false
                };
            }
            return item;
        }));
        autoSaveRow(itemId, { packing_condition: nextVal as any });
    };

    const handleBakeMethodChange = (itemId: string, val: string) => {
        const nextVal = val === '' ? null : val;
        autoSaveRow(itemId, { bake_method: nextVal });
    };

    const handleThicknessBlur = (itemId: string, val: string) => {
        const item = bomItems.find(i => i.id === itemId);
        if (!item) return;

        const nextVal = val === '' ? null : Number(val);
        const prevVal = item.package_thickness !== null ? Number(item.package_thickness) : null;
        
        if (nextVal !== prevVal) {
            autoSaveRow(itemId, { package_thickness: val as any });
        }
    };

    const handleDateBlur = (itemId: string, field: 'open_date' | 'closed_date', val: string) => {
        const item = bomItems.find(i => i.id === itemId);
        if (!item) return;

        const nextVal = val ? new Date(val).toISOString() : null;
        const prevVal = item[field] ? new Date(item[field] as string).toISOString() : null;

        if (nextVal !== prevVal) {
            autoSaveRow(itemId, { [field]: nextVal });
        }
    };

    // Download Excel Report
    const handleDownloadExcel = async () => {
        if (!id || !recordDetails) return;
        try {
            const token = localStorage.getItem('auth_token') || '';
            const response = await fetch(`/api/smt/msd-tracker/${id}/export/excel`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Failed to export Excel report.');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `MSD_BOM_${recordDetails.work_order_number}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            addToast('Excel report downloaded successfully.', 'success');
        } catch (err: any) {
            addToast(err.message || 'Failed to download report.', 'error');
        }
    };

    // Helpers
    const formatDuration = (ms: number) => {
        if (ms < 0) return '00:00:00';
        const totalSecs = Math.floor(ms / 1000);
        const hours = Math.floor(totalSecs / 3600);
        const minutes = Math.floor((totalSecs % 3600) / 60);
        const seconds = totalSecs % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    const formatForDateTimeInput = (isoString: string | null) => {
        if (!isoString) return '';
        const d = new Date(isoString);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
    };

    // Compute exposure & status locally for active timer display
    const getCalculatedFields = (item: BomItem) => {
        const now = currentTime.getTime();
        let exposureTimeStr = '—';
        let pendingFloorTimeStr = '—';
        let statusStr = 'Pending';

        if (item.packing_condition === 'Sealed') {
            if (item.open_date) {
                const start = new Date(item.open_date).getTime();
                const end = item.closed_date ? new Date(item.closed_date).getTime() : now;
                const diffMs = end - start;

                exposureTimeStr = formatDuration(diffMs);
                const totalFloorLifeMs = (item.floor_life_hours || 168) * 3600000;
                const remainingMs = totalFloorLifeMs - diffMs;
                const remainingHrs = remainingMs / 3600000;

                if (remainingHrs <= 0) {
                    pendingFloorTimeStr = 'Expired';
                    statusStr = 'EXPIRED';
                } else {
                    pendingFloorTimeStr = formatDuration(remainingMs);
                    if (item.open_date !== null && item.closed_date !== null && item.package_thickness !== null) {
                        statusStr = 'OK';
                    } else {
                        statusStr = 'Pending';
                    }
                }
            } else {
                statusStr = 'Pending';
            }
        } else if (item.packing_condition === 'Open') {
            if (item.package_thickness !== null && item.package_thickness !== '' && item.bake_method) {
                statusStr = 'OK';
            } else {
                statusStr = 'Pending';
            }
        } else {
            statusStr = 'Pending';
        }

        return {
            exposureTimeStr,
            pendingFloorTimeStr,
            statusStr
        };
    };

    const getFloorTimeWarnStyle = (item: BomItem) => {
        if (item.packing_condition !== 'Sealed' || !item.open_date) {
            return {};
        }
        const now = currentTime.getTime();
        const start = new Date(item.open_date).getTime();
        const end = item.closed_date ? new Date(item.closed_date).getTime() : now;
        const diffMs = end - start;
        const totalFloorLifeMs = (item.floor_life_hours || 168) * 3600000;
        const remainingMs = totalFloorLifeMs - diffMs;
        const remainingHrs = remainingMs / 3600000;

        if (remainingHrs <= 0) {
            return { backgroundColor: '#ef4444', color: '#ffffff', border: '1px solid #dc2626' }; // Bright Red
        }
        if (remainingHrs < 1) {
            return { backgroundColor: '#7f1d1d', color: '#ffffff', border: '1px solid #7f1d1d' }; // Dark Red
        }
        if (remainingHrs >= 1 && remainingHrs < 5) {
            return { backgroundColor: '#fca5a5', color: '#991b1b', border: '1px solid #f87171' }; // Red
        }
        if (remainingHrs >= 5 && remainingHrs < 10) {
            return { backgroundColor: '#fed7aa', color: '#c2410c', border: '1px solid #fdba74' }; // Orange
        }
        if (remainingHrs >= 10 && remainingHrs <= 24) {
            return { backgroundColor: '#fef08a', color: '#854d0e', border: '1px solid #fde047' }; // Yellow
        }
        return {};
    };

    // Local client search filter
    const filteredItems = bomItems.filter(item => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return true;
        return (
            (item.vepl_part_no || '').toLowerCase().includes(query) ||
            (item.description || '').toLowerCase().includes(query) ||
            (item.manufacturer || '').toLowerCase().includes(query) ||
            (item.mfr_part_no || '').toLowerCase().includes(query)
        );
    });

    if (isLoading) {
        return (
            <div className={styles.loadingContainer}>
                <RefreshCw className={styles.spinnerMini} size={36} style={{ color: '#4f46e5' }} />
                <p>Loading MSD Component Worksheet...</p>
            </div>
        );
    }

    if (!recordDetails) {
        return (
            <div className={styles.loadingContainer}>
                <p>Error: MSD Record not found.</p>
                <button className={styles.btnSecondary} onClick={() => navigate('/smt/msd-tracker')}>
                    <ArrowLeft size={16} /> Back to dashboard
                </button>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <Toaster toasts={toasts} onRemove={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />

            {/* Header Area */}
            <div className={styles.header}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button className={styles.backBtn} onClick={() => navigate('/smt/msd-tracker')}>
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h2>Work With BOM Worksheet</h2>
                        <p>Work Order: <strong>{recordDetails.work_order_number}</strong> | Product: <strong>{recordDetails.product_name}</strong></p>
                    </div>
                </div>

                <div className={styles.actions}>
                    <button 
                        className={styles.btnSecondary} 
                        onClick={handleDownloadExcel}
                    >
                        <FileSpreadsheet size={16} /> Excel
                    </button>

                    <div className={styles.statusSelectWrapper}>
                        <label>Tracker Status:</label>
                        <select
                            value={recordDetails.status}
                            onChange={(e) => handleMasterStatusChange(e.target.value as any)}
                            className={styles.statusSelect}
                            disabled={updatingMasterStatus}
                        >
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="CLOSED">CLOSED</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Work Order No</span>
                    <span className={styles.summaryVal}>{recordDetails.work_order_number}</span>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Product Name</span>
                    <span className={styles.summaryVal}>{recordDetails.product_name}</span>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Batch Quantity</span>
                    <span className={styles.summaryVal}>{recordDetails.quantity}</span>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Total components (MSD)</span>
                    <span className={styles.summaryVal}>{bomItems.length}</span>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Exceeded / Expired</span>
                    <span className={styles.summaryVal}>
                        {bomItems.filter(item => getCalculatedFields(item).statusStr === 'EXPIRED').length} / {bomItems.length}
                    </span>
                </div>
            </div>

            {/* Table Card */}
            <div className={styles.card}>
                <div className={styles.tableHeaderArea}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Moisture Sensitive Device BOM Components</h3>
                    
                    <div className={styles.searchWrapper}>
                        <Search className={styles.searchIcon} size={16} />
                        <input 
                            className={styles.searchInput}
                            type="text" 
                            placeholder="Filter by part number / description / manufacturer..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className={styles.tableContainer}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th style={{ width: '60px', minWidth: '60px' }}>Sl No</th>
                                <th style={{ width: '130px', minWidth: '130px' }}>VEPL Part No</th>
                                <th style={{ width: '220px', minWidth: '220px' }}>Description</th>
                                <th style={{ width: '130px', minWidth: '130px' }}>Manufacturer</th>
                                <th style={{ width: '150px', minWidth: '150px' }}>Mfr. Part No</th>
                                <th style={{ width: '95px', minWidth: '95px' }}>Qty / Product</th>
                                <th style={{ width: '95px', minWidth: '95px' }}>Required Qty</th>
                                <th style={{ width: '95px', minWidth: '95px' }}>Issued Qty</th>
                                <th style={{ width: '70px', minWidth: '70px' }}>MSL</th>
                                <th style={{ width: '130px', minWidth: '130px' }}>Packing Condition</th>
                                <th style={{ width: '165px', minWidth: '165px' }}>Open Date & Time</th>
                                <th style={{ width: '165px', minWidth: '165px' }}>Closed Date & Time</th>
                                <th style={{ width: '130px', minWidth: '130px' }}>Package Body Thickness (mm)</th>
                                <th style={{ width: '120px', minWidth: '120px' }}>Thickness Category</th>
                                <th style={{ width: '130px', minWidth: '130px' }}>Bake Method</th>
                                <th style={{ width: '90px', minWidth: '90px' }}>Bake Time</th>
                                <th style={{ width: '110px', minWidth: '110px' }}>Exposure Time</th>
                                <th style={{ width: '110px', minWidth: '110px' }}>Pending Floor Time</th>
                                <th style={{ width: '100px', minWidth: '100px' }}>Status</th>
                                <th style={{ width: '100px', minWidth: '100px', textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredItems.map(item => {
                                const calc = getCalculatedFields(item);
                                const isSaving = savingIds.has(item.id);
                                
                                // Determine row styling
                                let rowClass = styles.rowNormal;
                                if (item.packing_condition === 'Sealed' && item.open_date && !item.closed_date) {
                                    rowClass = calc.statusStr === 'EXPIRED' ? styles.rowExpired : styles.rowRunning;
                                } else if (calc.statusStr === 'EXPIRED') {
                                    rowClass = styles.rowExpired;
                                }

                                return (
                                    <tr key={item.id} className={rowClass}>
                                        <td>{item.sl_no || '—'}</td>
                                        <td style={{ fontWeight: 600, color: '#0f172a' }}>{item.vepl_part_no}</td>
                                        <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.description || ''}>
                                            {item.description || '—'}
                                        </td>
                                        <td>{item.manufacturer || '—'}</td>
                                        <td>{item.mfr_part_no || '—'}</td>
                                        <td>{item.qty_per_product !== null ? Number(item.qty_per_product) : '—'}</td>
                                        <td>{item.required_qty !== null ? Number(item.required_qty) : '—'}</td>
                                        <td style={{ fontWeight: 600 }}>{item.issued_qty !== null ? Number(item.issued_qty) : '—'}</td>
                                        <td>
                                            <span style={{ fontWeight: 700, color: '#2563eb' }}>
                                                {item.msl_normalized}
                                            </span>
                                        </td>
                                        <td>
                                            <select
                                                className={styles.rowSelect}
                                                value={item.packing_condition || ''}
                                                onChange={(e) => handlePackingConditionChange(item.id, e.target.value)}
                                                disabled={isSaving}
                                            >
                                                <option value="">-- None --</option>
                                                <option value="Sealed">Sealed</option>
                                                <option value="Open">Open</option>
                                            </select>
                                        </td>
                                        <td>
                                            <input 
                                                className={styles.rowDateInput}
                                                type="datetime-local" 
                                                defaultValue={formatForDateTimeInput(item.open_date)}
                                                onBlur={(e) => handleDateBlur(item.id, 'open_date', e.target.value)}
                                                disabled={item.packing_condition !== 'Sealed' || isSaving}
                                            />
                                        </td>
                                        <td>
                                            <input 
                                                className={styles.rowDateInput}
                                                type="datetime-local" 
                                                defaultValue={formatForDateTimeInput(item.closed_date)}
                                                onBlur={(e) => handleDateBlur(item.id, 'closed_date', e.target.value)}
                                                disabled={item.packing_condition !== 'Sealed' || !item.open_date || isSaving}
                                            />
                                        </td>
                                        <td>
                                            <input 
                                                className={styles.rowInput}
                                                type="number" 
                                                step="0.01"
                                                min="0"
                                                max="4.5"
                                                defaultValue={item.package_thickness !== null ? String(item.package_thickness) : ''}
                                                onBlur={(e) => handleThicknessBlur(item.id, e.target.value)}
                                                placeholder="mm"
                                                disabled={!item.packing_condition || isSaving}
                                            />
                                        </td>
                                        <td>{item.thickness_category || '—'}</td>
                                        <td>
                                            <select
                                                className={styles.rowSelect}
                                                value={item.bake_method || ''}
                                                onChange={(e) => handleBakeMethodChange(item.id, e.target.value)}
                                                disabled={item.packing_condition !== 'Open' || isSaving}
                                            >
                                                <option value="">-- Select --</option>
                                                <option value="Bake @125°C">125°C</option>
                                                <option value="Bake @90°C ≤5% RH">90°C</option>
                                                <option value="Bake @40°C ≤5% RH">40°C</option>
                                            </select>
                                        </td>
                                        <td style={{ fontWeight: 600 }}>
                                            {item.bake_time !== null ? `${item.bake_time} hrs` : '—'}
                                        </td>
                                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                                            {calc.exposureTimeStr}
                                        </td>
                                        <td>
                                            {item.packing_condition === 'Sealed' && item.open_date ? (
                                                <span style={{
                                                    display: 'inline-block',
                                                    padding: '0.2rem 0.5rem',
                                                    borderRadius: '4px',
                                                    fontFamily: 'monospace',
                                                    fontWeight: 600,
                                                    ...getFloorTimeWarnStyle(item)
                                                }}>
                                                    {calc.pendingFloorTimeStr}
                                                </span>
                                            ) : '—'}
                                        </td>
                                        <td>
                                            {isSaving ? (
                                                <span className={styles.savingIndicator}>
                                                    <Loader2 className={styles.spinnerMini} size={14} /> Saving...
                                                </span>
                                            ) : (
                                                <span className={`${styles.statusBadge} ${
                                                    calc.statusStr === 'OK' ? styles.badgeOk : 
                                                    calc.statusStr === 'EXPIRED' ? styles.badgeExpired : 
                                                    styles.badgePending
                                                }`}>
                                                    {calc.statusStr}
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <button 
                                                className={styles.viewBtn} 
                                                onClick={() => setEditingItem(item)}
                                                title="View / Edit Component Details"
                                            >
                                                <Eye size={12} style={{ marginRight: '3px' }} /> Details
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredItems.length === 0 && (
                                <tr>
                                    <td colSpan={20} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                        No items match the filter criteria.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* View/Edit Details Dialog */}
            {editingItem && (() => {
                const currentDbItem = bomItems.find(i => i.id === editingItem.id) || editingItem;
                const calc = getCalculatedFields(currentDbItem);
                const isSaving = savingIds.has(currentDbItem.id);

                return (
                    <div className={styles.modalOverlay}>
                        <div className={styles.modalContent}>
                            <div className={styles.modalHeader}>
                                <h3>View/Edit Component Details</h3>
                                <button className={styles.closeModalBtn} onClick={() => setEditingItem(null)}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div className={styles.modalBody}>
                                {/* General Component Information (Read Only) */}
                                <div className={styles.detailsSection}>
                                    <h4 className={styles.sectionTitle}>General Component Information</h4>
                                    <div className={styles.detailsGrid}>
                                        <div className={styles.detailItem}>
                                            <span className={styles.detailLabel}>SL No</span>
                                            <span className={styles.detailValue}>{currentDbItem.sl_no || '—'}</span>
                                        </div>
                                        <div className={styles.detailItem}>
                                            <span className={styles.detailLabel}>VEPL Part No</span>
                                            <span className={styles.detailValue}>{currentDbItem.vepl_part_no}</span>
                                        </div>
                                        <div className={styles.detailItem} style={{ gridColumn: 'span 2' }}>
                                            <span className={styles.detailLabel}>Description</span>
                                            <span className={styles.detailValue}>{currentDbItem.description || '—'}</span>
                                        </div>
                                        <div className={styles.detailItem}>
                                            <span className={styles.detailLabel}>Manufacturer</span>
                                            <span className={styles.detailValue}>{currentDbItem.manufacturer || '—'}</span>
                                        </div>
                                        <div className={styles.detailItem}>
                                            <span className={styles.detailLabel}>Mfr. Part No</span>
                                            <span className={styles.detailValue}>{currentDbItem.mfr_part_no || '—'}</span>
                                        </div>
                                        <div className={styles.detailItem}>
                                            <span className={styles.detailLabel}>MSL Level</span>
                                            <span className={styles.detailValue} style={{ fontWeight: 700, color: '#2563eb' }}>{currentDbItem.msl_normalized}</span>
                                        </div>
                                        <div className={styles.detailItem}>
                                            <span className={styles.detailLabel}>Issued Qty</span>
                                            <span className={styles.detailValue}>{currentDbItem.issued_qty !== null ? Number(currentDbItem.issued_qty) : '—'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Configurations Section */}
                                <div className={styles.detailsSection}>
                                    <h4 className={styles.sectionTitle}>Moisture Sensitivity Configuration</h4>
                                    
                                    <div className={styles.formGrid2} style={{ marginBottom: '1.5rem' }}>
                                        <div className={styles.inputGroup}>
                                            <label>Packing Condition</label>
                                            <select
                                                className={styles.select}
                                                value={currentDbItem.packing_condition || ''}
                                                onChange={(e) => handlePackingConditionChange(currentDbItem.id, e.target.value)}
                                                disabled={isSaving}
                                            >
                                                <option value="">-- None --</option>
                                                <option value="Sealed">Sealed</option>
                                                <option value="Open">Open</option>
                                            </select>
                                        </div>
                                        <div className={styles.inputGroup}>
                                            <label>Status</label>
                                            <div style={{ marginTop: '0.25rem' }}>
                                                <span className={`${styles.statusBadge} ${
                                                    calc.statusStr === 'OK' ? styles.badgeOk : 
                                                    calc.statusStr === 'EXPIRED' ? styles.badgeExpired : 
                                                    styles.badgePending
                                                }`}>
                                                    {calc.statusStr}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Conditionally Render Form Fields based on Packing Condition */}
                                    {currentDbItem.packing_condition === 'Sealed' && (
                                        <div className={styles.formGrid3}>
                                            <div className={styles.inputGroup}>
                                                <label>Open Date & Time</label>
                                                <input
                                                    className={styles.input}
                                                    type="datetime-local"
                                                    defaultValue={formatForDateTimeInput(currentDbItem.open_date)}
                                                    onBlur={(e) => handleDateBlur(currentDbItem.id, 'open_date', e.target.value)}
                                                    disabled={isSaving}
                                                />
                                            </div>
                                            <div className={styles.inputGroup}>
                                                <label>Closed Date & Time</label>
                                                <input
                                                    className={styles.input}
                                                    type="datetime-local"
                                                    defaultValue={formatForDateTimeInput(currentDbItem.closed_date)}
                                                    disabled={!currentDbItem.open_date || isSaving}
                                                    onBlur={(e) => handleDateBlur(currentDbItem.id, 'closed_date', e.target.value)}
                                                />
                                            </div>
                                            <div className={styles.inputGroup}>
                                                <label>Package Body Thickness (mm)</label>
                                                <input
                                                    className={styles.input}
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max="4.5"
                                                    placeholder="Enter thickness in mm"
                                                    defaultValue={currentDbItem.package_thickness !== null ? String(currentDbItem.package_thickness) : ''}
                                                    onBlur={(e) => handleThicknessBlur(currentDbItem.id, e.target.value)}
                                                    disabled={isSaving}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {currentDbItem.packing_condition === 'Open' && (
                                        <div className={styles.formGrid2}>
                                            <div className={styles.formGrid3} style={{ gridColumn: 'span 2', gap: '1rem', width: '100%' }}>
                                                <div className={styles.inputGroup}>
                                                    <label>Package Body Thickness (mm)</label>
                                                    <input
                                                        className={styles.input}
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        max="4.5"
                                                        placeholder="Enter thickness"
                                                        defaultValue={currentDbItem.package_thickness !== null ? String(currentDbItem.package_thickness) : ''}
                                                        onBlur={(e) => handleThicknessBlur(currentDbItem.id, e.target.value)}
                                                        disabled={isSaving}
                                                    />
                                                </div>
                                                <div className={styles.inputGroup}>
                                                    <label>Thickness Category</label>
                                                    <input
                                                        className={styles.input}
                                                        type="text"
                                                        disabled
                                                        value={currentDbItem.thickness_category || '—'}
                                                    />
                                                </div>
                                                <div className={styles.inputGroup}>
                                                    <label>Bake Method</label>
                                                    <select
                                                        className={styles.select}
                                                        value={currentDbItem.bake_method || ''}
                                                        onChange={(e) => handleBakeMethodChange(currentDbItem.id, e.target.value)}
                                                        disabled={isSaving}
                                                    >
                                                        <option value="">-- Select --</option>
                                                        <option value="Bake @125°C">125°C</option>
                                                        <option value="Bake @90°C ≤5% RH">90°C</option>
                                                        <option value="Bake @40°C ≤5% RH">40°C</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div className={styles.inputGroup} style={{ gridColumn: 'span 2', marginTop: '0.5rem' }}>
                                                <label>Calculated Bake Time</label>
                                                <input
                                                    className={styles.input}
                                                    type="text"
                                                    disabled
                                                    value={currentDbItem.bake_time !== null ? `${currentDbItem.bake_time} hours` : '—'}
                                                    style={{ fontWeight: 600, color: '#0f172a', backgroundColor: '#f1f5f9' }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className={styles.modalFooter}>
                                <button className={`${styles.button} ${styles.btnSecondary}`} onClick={() => setEditingItem(null)}>
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default MsdBomView;
