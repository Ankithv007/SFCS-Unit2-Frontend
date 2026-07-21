import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './MsdTracker.module.css';
import { WorkOrderSelector } from '../../../components/WorkOrderSelector';
import { 
    Search, RefreshCw, Eye, X, FileSpreadsheet, PlusCircle
} from 'lucide-react';

interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
}

interface EligibleWO {
    work_order_id: string;
    product_name: string;
    product_description: string;
    quantity: number;
    material_management_id: string;
    qms_id: number;
    bom_file_path: string;
}

interface MsdRecord {
    id: string;
    work_order_id: string;
    work_order_number: string;
    product_name: string;
    product_description: string | null;
    quantity: number;
    remarks: string | null;
    status: 'ACTIVE' | 'CLOSED';
    created_by: string | null;
    updated_by: string | null;
    created_at: string;
    updated_at: string;
}

interface AuditLog {
    timestamp: string;
    user: string;
    action: string;
    details: string;
    type: 'Audit Log' | 'BOM History';
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

const MsdTracker: React.FC = () => {
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
    const [records, setRecords] = useState<MsdRecord[]>([]);
    const [eligibleWos, setEligibleWos] = useState<EligibleWO[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form inputs
    const [selectedWoId, setSelectedWoId] = useState('');
    const [selectedWoDetails, setSelectedWoDetails] = useState<EligibleWO | null>(null);
    const [remarks, setRemarks] = useState('');

    // Search & Filter
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    // Detail Modal states
    const [detailRecord, setDetailRecord] = useState<MsdRecord | null>(null);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [isLoadingAudit, setIsLoadingAudit] = useState(false);

    // Fetch active MSD records
    const fetchRecords = async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('auth_token') || '';
            const response = await fetch(`/api/smt/msd-tracker?search=${encodeURIComponent(search)}&status=${statusFilter}&limit=100`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch MSD records.');
            }

            const data = await response.json();
            if (data.success && Array.isArray(data.data)) {
                setRecords(data.data);
            }
        } catch (err: any) {
            addToast(err.message || 'Failed to load records.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch eligible work orders
    const fetchEligibleWorkOrders = async () => {
        try {
            const token = localStorage.getItem('auth_token') || '';
            const response = await fetch('/api/smt/msd-tracker/eligible-work-orders', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch eligible work orders.');
            }

            const data = await response.json();
            if (data.success && Array.isArray(data.data)) {
                setEligibleWos(data.data);
            }
        } catch (err: any) {
            addToast('Could not load eligible work orders.', 'error');
        }
    };

    useEffect(() => {
        fetchRecords();
        fetchEligibleWorkOrders();
    }, [statusFilter]);

    // Handle Work Order selection change
    const handleWoChange = (val: string) => {
        setSelectedWoId(val);
        const match = eligibleWos.find(w => w.work_order_id === val);
        setSelectedWoDetails(match || null);
    };

    // Create MSD Record
    const handleCreateMsd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedWoId) return;

        setIsSubmitting(true);
        try {
            const token = localStorage.getItem('auth_token') || '';
            const response = await fetch('/api/smt/msd-tracker', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    work_order_id: selectedWoId,
                    remarks: remarks
                })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to create MSD Record.');
            }

            addToast('MSD Record created successfully!', 'success');
            setSelectedWoId('');
            setSelectedWoDetails(null);
            setRemarks('');
            fetchEligibleWorkOrders();
            fetchRecords();
        } catch (err: any) {
            addToast(err.message || 'Error creating record.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Open detailed view modal
    const handleViewDetail = async (record: MsdRecord) => {
        setDetailRecord(record);
        setIsLoadingAudit(true);
        setAuditLogs([]);
        try {
            const token = localStorage.getItem('auth_token') || '';
            const response = await fetch(`/api/smt/msd-tracker/${record.id}/audit`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load audit logs.');
            }

            const data = await response.json();
            if (data.success && Array.isArray(data.data)) {
                setAuditLogs(data.data);
            }
        } catch (err: any) {
            addToast('Failed to load audit trail for this record.', 'error');
        } finally {
            setIsLoadingAudit(false);
        }
    };

    // Download Excel Report
    const handleDownloadExcel = async (recordId: string, woNum: string) => {
        try {
            const token = localStorage.getItem('auth_token') || '';
            const response = await fetch(`/api/smt/msd-tracker/${recordId}/export/excel`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to export Excel report.');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `MSD_BOM_${woNum}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            addToast('Excel downloaded successfully.', 'success');
        } catch (err: any) {
            addToast(err.message || 'Failed to download report.', 'error');
        }
    };

    // Helper to format date strings for display
    const formatDate = (isoString: string) => {
        if (!isoString) return '—';
        const d = new Date(isoString);
        return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    };

    // Apply search filter client-side if needed, or query backend
    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        fetchRecords();
    };

    return (
        <div className={styles.container}>
            <Toaster toasts={toasts} onRemove={(id) => setToasts(p => p.filter(t => t.id !== id))} />

            <div className={styles.header}>
                <h2>MSD Tracker</h2>
                <p>Track floor life exposure, body thickness, package condition, and bake history for Moisture Sensitive Devices.</p>
            </div>

            {/* Create Card */}
            <div className={styles.card}>
                <h3>Initialize SMT MSD Tracker</h3>
                <form onSubmit={handleCreateMsd}>
                    <div className={styles.formGrid2}>
                        <div className={styles.inputGroup}>
                            <label>Work Order *</label>
                            <WorkOrderSelector
                                options={eligibleWos}
                                value={selectedWoId}
                                onChange={handleWoChange}
                                placeholder="-- Select Eligible Work Order --"
                                valueKey="work_order_id"
                                labelKey="work_order_id"
                                productNameKey="product_name"
                                quantityKey="quantity"
                                required
                            />
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Remarks</label>
                            <input 
                                className={styles.input} 
                                type="text" 
                                placeholder="Optional initialization notes..."
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                            />
                        </div>
                    </div>

                    {selectedWoDetails && (
                        <div className={styles.detailsSection} style={{ marginTop: '1rem', marginBottom: '1rem' }}>
                            <h4 className={styles.sectionTitle}>Work Order Details</h4>
                            <div className={styles.detailsGrid}>
                                <div className={styles.detailItem}>
                                    <span className={styles.detailLabel}>Product Name</span>
                                    <span className={styles.detailValue}>{selectedWoDetails.product_name}</span>
                                </div>
                                <div className={styles.detailItem}>
                                    <span className={styles.detailLabel}>Quantity</span>
                                    <span className={styles.detailValue}>{selectedWoDetails.quantity}</span>
                                </div>
                                <div className={styles.detailItem} style={{ gridColumn: 'span 2' }}>
                                    <span className={styles.detailLabel}>Description</span>
                                    <span className={styles.detailValue}>{selectedWoDetails.product_description || '—'}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className={styles.formFooter}>
                        <button 
                            type="submit" 
                            className={`${styles.button} ${styles.btnPrimary}`} 
                            disabled={isSubmitting || !selectedWoId}
                        >
                            {isSubmitting ? (
                                <><RefreshCw className="animate-spin" size={16} /> Creating...</>
                            ) : (
                                <><PlusCircle size={16} /> Create MSD Tracker</>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            {/* List Table Card */}
            <div className={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <h3 style={{ margin: 0, border: 'none', padding: 0 }}>MSD Tracking Batches</h3>
                    
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <div className={styles.inputGroup} style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
                            <label style={{ whiteSpace: 'nowrap', marginBottom: 0 }}>Status:</label>
                            <select 
                                className={styles.select} 
                                style={{ width: '120px', padding: '0.35rem 0.5rem' }}
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <option value="">All</option>
                                <option value="ACTIVE">ACTIVE</option>
                                <option value="CLOSED">CLOSED</option>
                            </select>
                        </div>

                        <form onSubmit={handleSearchSubmit} className={styles.searchBar}>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <Search size={16} style={{ position: 'absolute', left: '0.75rem', color: '#94a3b8' }} />
                                <input 
                                    className={styles.input} 
                                    style={{ paddingLeft: '2.5rem', width: '280px', padding: '0.35rem 0.75rem 0.35rem 2.5rem' }} 
                                    type="text" 
                                    placeholder="Search Work Order / Product..." 
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                            <button type="submit" className={`${styles.button} ${styles.btnSecondary}`} style={{ padding: '0.35rem 0.75rem' }}>
                                <RefreshCw size={15} />
                            </button>
                        </form>
                    </div>
                </div>

                <div className={styles.tableContainer}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Work Order Number</th>
                                <th>Product Name</th>
                                <th>Quantity</th>
                                <th>Created By</th>
                                <th>Date Initialized</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '3rem' }}>
                                        <RefreshCw className="animate-spin" size={24} style={{ color: '#4f46e5' }} />
                                    </td>
                                </tr>
                            ) : records.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                                        No MSD Tracker records found.
                                    </td>
                                </tr>
                            ) : records.map(rec => (
                                <tr key={rec.id}>
                                    <td style={{ fontWeight: 600, color: '#0f172a' }}>{rec.work_order_number}</td>
                                    <td>{rec.product_name}</td>
                                    <td>{rec.quantity}</td>
                                    <td>{rec.created_by || '—'}</td>
                                    <td>{formatDate(rec.created_at)}</td>
                                    <td>
                                        <span className={`${styles.statusBadge} ${rec.status === 'ACTIVE' ? styles.statusActive : styles.statusClosed}`}>
                                            {rec.status}
                                        </span>
                                    </td>
                                    <td>
                                        <button 
                                            className={styles.viewBtn} 
                                            onClick={() => handleViewDetail(rec)}
                                            title="View Audit Timeline"
                                        >
                                            <Eye size={14} style={{ marginRight: '5px' }} />
                                            View Details
                                        </button>
                                        <button
                                            className={styles.viewBtn}
                                            onClick={() => navigate(`/smt/msd-tracker/bom-view/${rec.id}`)}
                                            title="Work with BOM Worksheet"
                                            style={{ marginLeft: '8px' }}
                                        >
                                            <Eye size={14} style={{ marginRight: '5px' }} />
                                            Work With BOM
                                        </button>
                                        <button
                                            className={styles.viewBtn}
                                            onClick={() => handleDownloadExcel(rec.id, rec.work_order_number)}
                                            title="Download Excel BOM Report"
                                            style={{ marginLeft: '8px' }}
                                        >
                                            <FileSpreadsheet size={14} style={{ marginRight: '5px' }} />
                                            Excel
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* View Details Modal */}
            {detailRecord && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalHeader}>
                            <h3>MSD Tracking Details — {detailRecord.work_order_number}</h3>
                            <button className={styles.closeModalBtn} onClick={() => setDetailRecord(null)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.detailsSection}>
                                <h4 className={styles.sectionTitle}>General Information</h4>
                                <div className={styles.detailsGrid}>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Work Order No</span>
                                        <span className={styles.detailValue}>{detailRecord.work_order_number}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Product Name</span>
                                        <span className={styles.detailValue}>{detailRecord.product_name}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Batch Quantity</span>
                                        <span className={styles.detailValue}>{detailRecord.quantity}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Status</span>
                                        <span className={styles.detailValue} style={{ fontWeight: 700 }}>{detailRecord.status}</span>
                                    </div>
                                    <div className={styles.detailItem} style={{ gridColumn: 'span 2' }}>
                                        <span className={styles.detailLabel}>Remarks</span>
                                        <span className={styles.detailValue}>{detailRecord.remarks || '—'}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Created By</span>
                                        <span className={styles.detailValue}>{detailRecord.created_by || '—'}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Initialized At</span>
                                        <span className={styles.detailValue}>{formatDate(detailRecord.created_at)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.detailsSection}>
                                <h4 className={styles.sectionTitle}>Activity & History Audit Trail</h4>
                                {isLoadingAudit ? (
                                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                                        <RefreshCw className={styles.spinnerMini} size={24} style={{ color: '#4f46e5', margin: '0 auto' }} />
                                    </div>
                                ) : auditLogs.length === 0 ? (
                                    <p style={{ color: '#64748b', fontSize: '0.85rem', fontStyle: 'italic', margin: 0 }}>
                                        No modifications logged yet.
                                    </p>
                                ) : (
                                    <div className={styles.auditTableContainer}>
                                        <table className={styles.auditTable}>
                                            <thead>
                                                <tr>
                                                    <th>Timestamp</th>
                                                    <th>Operator</th>
                                                    <th>Type</th>
                                                    <th>Action</th>
                                                    <th>Details</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {auditLogs.map((log, index) => (
                                                    <tr key={index}>
                                                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{formatDate(log.timestamp)}</td>
                                                        <td style={{ fontWeight: 600, fontSize: '0.85rem' }}>{log.user}</td>
                                                        <td>
                                                            <span className={`${styles.typeBadge} ${
                                                                log.type === 'Audit Log' ? styles.badgeAudit : styles.badgeBomHistory
                                                            }`}>
                                                                {log.type}
                                                            </span>
                                                        </td>
                                                        <td style={{ fontSize: '0.85rem', fontWeight: 500 }}>{log.action}</td>
                                                        <td style={{ fontSize: '0.85rem', color: '#475569' }}>{log.details}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MsdTracker;
