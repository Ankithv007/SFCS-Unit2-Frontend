import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './MaterialReturn.module.css';
import { 
    Search, RefreshCw, Eye, X, FileSpreadsheet, ClipboardList
} from 'lucide-react';

interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
}

interface EligibleWO {
    material_management_id: string;
    qms_id: number;
    work_order_id: string;
    work_order_number: string;
    po_number: string;
    product_name: string;
    product_description: string;
    quantity: number;
    current_bom_revision: string | null;
}

interface MaterialReturnRecord {
    id: string;
    material_management_id: string;
    work_order_id: string;
    qms_id: number;
    work_order_number: string;
    po_number: string | null;
    product_name: string | null;
    product_description: string | null;
    quantity: number;
    current_bom_revision: string | null;
    status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CLOSED';
    remarks: string | null;
    created_by: string | null;
    updated_by: string | null;
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

const MaterialReturn: React.FC = () => {
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
    const [records, setRecords] = useState<MaterialReturnRecord[]>([]);
    const [eligibleWos, setEligibleWos] = useState<EligibleWO[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form selection
    const [selectedWoId, setSelectedWoId] = useState('');
    const [selectedWoDetails, setSelectedWoDetails] = useState<EligibleWO | null>(null);
    const [masterRemarks, setMasterRemarks] = useState('');

    // Search query
    const [search, setSearch] = useState('');

    // Detail modal view
    const [detailRecord, setDetailRecord] = useState<any | null>(null);

    // Fetch active material return records
    const fetchRecords = async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('auth_token') || '';
            const response = await fetch('/api/smt/material-return/records', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch return records');
            }

            const data = await response.json();
            if (Array.isArray(data)) {
                setRecords(data);
            }
        } catch (err: any) {
            addToast(err.message || 'Failed to load return records.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch eligible work orders
    const fetchEligibleWorkOrders = async () => {
        try {
            const token = localStorage.getItem('auth_token') || '';
            const response = await fetch('/api/smt/material-return/eligible-wos', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch eligible work orders');
            }

            const data = await response.json();
            if (Array.isArray(data)) {
                setEligibleWos(data);
            }
        } catch (err: any) {
            addToast('Could not load eligible work orders.', 'error');
        }
    };

    useEffect(() => {
        fetchRecords();
        fetchEligibleWorkOrders();
    }, []);

    // Handle Work Order change
    const handleWoChange = (woId: string) => {
        setSelectedWoId(woId);
        const details = eligibleWos.find(w => w.work_order_id === woId) || null;
        setSelectedWoDetails(details);
    };

    // Create Material Return record
    const handleCreateRecord = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedWoId || !selectedWoDetails) {
            addToast('Please select a valid Work Order.', 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            const token = localStorage.getItem('auth_token') || '';
            const response = await fetch('/api/smt/material-return/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    work_order_id: selectedWoDetails.work_order_id,
                    qms_id: selectedWoDetails.qms_id,
                    material_management_id: selectedWoDetails.material_management_id,
                    remarks: masterRemarks
                })
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Failed to create record.');
            }

            addToast(result.message || 'Record created successfully.', 'success');
            
            // Reset fields
            setSelectedWoId('');
            setSelectedWoDetails(null);
            setMasterRemarks('');

            // Navigate to BOM workspace directly
            if (result.record && result.record.id) {
                navigate(`/smt/material-management/return/bom-view/${result.record.id}`);
            } else {
                fetchRecords();
                fetchEligibleWorkOrders();
            }
        } catch (err: any) {
            addToast(err.message || 'Error creating record.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDownloadExcel = async (id: string, workOrderNumber: string) => {
        try {
            const token = localStorage.getItem('auth_token') || '';
            const response = await fetch(`/api/smt/material-return/records/${id}/export/excel`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to download Excel report.');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Material_Return_Report_${workOrderNumber}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            addToast('Excel report downloaded successfully.', 'success');
        } catch (err: any) {
            addToast(err.message || 'Failed to download report.', 'error');
        }
    };

    // View details modal
    const handleViewDetail = async (id: string) => {
        try {
            const token = localStorage.getItem('auth_token') || '';
            const response = await fetch(`/api/smt/material-return/records/${id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load record details');
            }

            const data = await response.json();
            setDetailRecord(data);
        } catch (err: any) {
            addToast('Error loading details.', 'error');
        }
    };

    // Document URL generators
    const getDocumentUrl = (qmsId: number, fileType: string, action: 'view' | 'download') => {
        const token = localStorage.getItem('auth_token') || '';
        return `/api/smt/qms/files/${action}/${qmsId}/${fileType}?token=${encodeURIComponent(token)}`;
    };

    const getPoUrl = (workOrderNumber: string, action: 'view' | 'download') => {
        const token = localStorage.getItem('auth_token') || '';
        const endpoint = action === 'view' ? 'view-po-file' : 'download-po';
        return `/api/smt/work-orders/${workOrderNumber}/${endpoint}?token=${encodeURIComponent(token)}`;
    };

    const formatDateTime = (dateStr: string) => {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr);
        return date.toLocaleString();
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'DRAFT': return styles.statusDraft;
            case 'ACTIVE': return styles.statusActive;
            case 'COMPLETED': return styles.statusCompleted;
            case 'CLOSED': return styles.statusClosed;
            default: return '';
        }
    };

    // Local filter search
    const filteredRecords = records.filter(rec => 
        rec.work_order_number.toLowerCase().includes(search.toLowerCase()) ||
        (rec.po_number && rec.po_number.toLowerCase().includes(search.toLowerCase())) ||
        (rec.product_name && rec.product_name.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <div className={styles.container}>
            <Toaster toasts={toasts} onRemove={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />

            {/* Page Header */}
            <div className={styles.header}>
                <h2>Material Return</h2>
                <p>Track, manage, and process material returns for completed or closed SMT work orders.</p>
            </div>

            {/* Creation Card */}
            <div className={styles.card}>
                <h3>Create Material Return Record</h3>
                <form onSubmit={handleCreateRecord}>
                    <div className={styles.formGrid4}>
                        <div className={styles.inputGroup}>
                            <label>Work Order Number *</label>
                            <select 
                                className={styles.select} 
                                value={selectedWoId} 
                                onChange={(e) => handleWoChange(e.target.value)}
                            >
                                <option value="">Select Work Order...</option>
                                {eligibleWos.map(wo => (
                                    <option key={wo.work_order_id} value={wo.work_order_id}>
                                        {wo.work_order_number} ({wo.current_bom_revision})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className={styles.inputGroup}>
                            <label>PO Number</label>
                            <input className={styles.input} type="text" readOnly value={selectedWoDetails?.po_number || '—'} />
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Product Name</label>
                            <input className={styles.input} type="text" readOnly value={selectedWoDetails?.product_name || '—'} />
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Quantity</label>
                            <input className={styles.input} type="text" readOnly value={selectedWoDetails?.quantity || '—'} />
                        </div>
                    </div>

                    <div className={styles.formGrid2}>
                        <div className={styles.inputGroup}>
                            <label>Product Description</label>
                            <textarea className={styles.textareaCompact} readOnly value={selectedWoDetails?.product_description || '—'} />
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Material Return Remarks</label>
                            <textarea 
                                className={styles.textareaCompact} 
                                placeholder="Enter return remarks or notes..."
                                value={masterRemarks}
                                onChange={(e) => setMasterRemarks(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className={styles.formFooter}>
                        <button 
                            type="submit" 
                            className={`${styles.button} ${styles.btnPrimary}`}
                            disabled={isSubmitting || !selectedWoId}
                        >
                            {isSubmitting ? 'Creating...' : 'Create Material Return'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Records List Card */}
            <div className={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0, border: 'none', padding: 0 }}>Material Return Records</h3>
                    <div className={styles.searchBar}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <Search size={16} style={{ position: 'absolute', left: '0.75rem', color: '#94a3b8' }} />
                            <input 
                                type="text" 
                                className={styles.input} 
                                placeholder="Search by WO, PO, Product..." 
                                style={{ paddingLeft: '2.25rem', width: '260px' }}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <button onClick={() => { fetchRecords(); fetchEligibleWorkOrders(); }} className={`${styles.button} ${styles.btnSecondary}`} title="Refresh data">
                            <RefreshCw size={16} />
                        </button>
                    </div>
                </div>

                <div className={styles.tableContainer}>
                    {isLoading ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
                            <RefreshCw size={24} className={styles.spinner} style={{ marginRight: '0.5rem' }} /> Loading records...
                        </div>
                    ) : filteredRecords.length === 0 ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                            No material return records found.
                        </div>
                    ) : (
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Work Order Number</th>
                                    <th>PO Number</th>
                                    <th>Product Name</th>
                                    <th>Quantity</th>
                                    <th>Current BOM Revision</th>
                                    <th>Status</th>
                                    <th>Remarks</th>
                                    <th style={{ textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRecords.map(rec => (
                                    <tr key={rec.id}>
                                        <td style={{ fontWeight: 600, color: '#0f172a' }}>{rec.work_order_number}</td>
                                        <td>{rec.po_number || '—'}</td>
                                        <td>{rec.product_name || '—'}</td>
                                        <td>{rec.quantity}</td>
                                        <td>
                                            <span className={styles.revTag}>
                                                Rev {rec.current_bom_revision || '1.1'}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`${styles.statusBadge} ${getStatusStyle(rec.status)}`}>
                                                {rec.status}
                                            </span>
                                        </td>
                                        <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {rec.remarks || '—'}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                                                <button 
                                                    className={styles.viewBtn} 
                                                    onClick={() => handleViewDetail(rec.id)}
                                                    title="View Details"
                                                >
                                                    <Eye size={14} style={{ marginRight: '0.25rem' }} /> View
                                                </button>
                                                <button 
                                                    className={`${styles.button} ${styles.btnSecondary}`}
                                                    style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}
                                                    onClick={() => navigate(`/smt/material-management/return/bom-view/${rec.id}`)}
                                                    title="Work with BOM"
                                                >
                                                    <ClipboardList size={14} style={{ marginRight: '0.25rem' }} /> Work with BOM
                                                </button>
                                                <button 
                                                    className={`${styles.button} ${styles.btnSecondary}`}
                                                    style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}
                                                    onClick={() => handleDownloadExcel(rec.id, rec.work_order_number)}
                                                    title="Export Excel"
                                                >
                                                    <FileSpreadsheet size={14} style={{ marginRight: '0.25rem' }} /> Excel
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* View Details Modal */}
            {detailRecord && (
                <div className={styles.modalOverlay} onClick={() => setDetailRecord(null)}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3>Material Return Details — {detailRecord.work_order_number}</h3>
                            <button className={styles.closeModalBtn} onClick={() => setDetailRecord(null)}><X size={20} /></button>
                        </div>
                        <div className={styles.modalBody}>
                            {/* Return Summary Card */}
                            <div className={styles.detailsSection} style={{ borderLeft: '4px solid #4f46e5', backgroundColor: '#eef2ff' }}>
                                <h4 style={{ margin: '0 0 0.75rem 0', color: '#312e81', fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Material Return Summary
                                </h4>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Total Components</span>
                                        <span className={styles.detailValue} style={{ fontSize: '1.25rem', color: '#1e1b4b' }}>
                                            {detailRecord.total_components}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Total Issued Qty</span>
                                        <span className={styles.detailValue} style={{ fontSize: '1.25rem', color: '#1e1b4b' }}>
                                            {Number(detailRecord.total_issued_qty).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Total Return Qty</span>
                                        <span className={styles.detailValue} style={{ fontSize: '1.25rem', color: '#166534' }}>
                                            {Number(detailRecord.total_return_qty).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Total Delta Qty</span>
                                        <span className={styles.detailValue} style={{ fontSize: '1.25rem', color: '#1e3a8a' }}>
                                            {Number(detailRecord.total_delta_qty).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Snapshot Information */}
                            <div className={styles.detailsSection}>
                                <h4 className={styles.sectionTitle}>Snapshot Information</h4>
                                <div className={styles.detailsGrid}>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Work Order Number</span>
                                        <span className={styles.detailValue}>{detailRecord.work_order_number}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>PO Number</span>
                                        <span className={styles.detailValue}>{detailRecord.po_number || '—'}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Product Name</span>
                                        <span className={styles.detailValue}>{detailRecord.product_name || '—'}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Quantity</span>
                                        <span className={styles.detailValue}>{detailRecord.quantity}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Current BOM Revision</span>
                                        <span className={styles.detailValue}>
                                            <span className={styles.revTag}>
                                                Rev {detailRecord.current_bom_revision || '1.1'}
                                            </span>
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Status</span>
                                        <span className={styles.detailValue}>
                                            <span className={`${styles.statusBadge} ${getStatusStyle(detailRecord.status)}`}>
                                                {detailRecord.status}
                                            </span>
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Created By</span>
                                        <span className={styles.detailValue}>{detailRecord.created_by || '—'}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Updated At</span>
                                        <span className={styles.detailValue}>{formatDateTime(detailRecord.updated_at)}</span>
                                    </div>
                                </div>

                                <div className={styles.detailItem} style={{ marginTop: '1rem' }}>
                                    <span className={styles.detailLabel}>Return Remarks</span>
                                    <span className={styles.detailValue} style={{ fontWeight: 'normal', whiteSpace: 'pre-wrap' }}>
                                        {detailRecord.remarks || 'No remarks entered.'}
                                    </span>
                                </div>
                            </div>

                            {/* Associated Documents */}
                            <div className={styles.compactDocsSection}>
                                <span className={styles.compactDocsLabel}>Associated Documents</span>
                                <div className={styles.compactDocsGrid}>
                                    {/* BOM File */}
                                    <div className={styles.compactDocCol}>
                                        <span className={styles.compactDocHeader}>BOM Document</span>
                                        {detailRecord.bom_file_path ? (
                                            <div className={styles.compactDocActions}>
                                                <a href={getDocumentUrl(detailRecord.qms_id, 'bom', 'view')} target="_blank" rel="noreferrer" className={`${styles.compactDocBtn} ${styles.compactDocBtnView}`}>
                                                    View
                                                </a>
                                                <a href={getDocumentUrl(detailRecord.qms_id, 'bom', 'download')} className={`${styles.compactDocBtn} ${styles.compactDocBtnDownload}`}>
                                                    Download
                                                </a>
                                            </div>
                                        ) : (
                                            <span className={styles.compactDocMissing}>Not Uploaded</span>
                                        )}
                                    </div>

                                    {/* ECN File */}
                                    <div className={styles.compactDocCol}>
                                        <span className={styles.compactDocHeader}>ECN Document</span>
                                        {detailRecord.ecn_file_path ? (
                                            <div className={styles.compactDocActions}>
                                                <a href={getDocumentUrl(detailRecord.qms_id, 'ecn', 'view')} target="_blank" rel="noreferrer" className={`${styles.compactDocBtn} ${styles.compactDocBtnView}`}>
                                                    View
                                                </a>
                                                <a href={getDocumentUrl(detailRecord.qms_id, 'ecn', 'download')} className={`${styles.compactDocBtn} ${styles.compactDocBtnDownload}`}>
                                                    Download
                                                </a>
                                            </div>
                                        ) : (
                                            <span className={styles.compactDocMissing}>Not Uploaded</span>
                                        )}
                                    </div>

                                    {/* PO File */}
                                    <div className={styles.compactDocCol}>
                                        <span className={styles.compactDocHeader}>PO Document</span>
                                        {detailRecord.po_document_path ? (
                                            <div className={styles.compactDocActions}>
                                                <a href={getPoUrl(detailRecord.work_order_number, 'view')} target="_blank" rel="noreferrer" className={`${styles.compactDocBtn} ${styles.compactDocBtnView}`}>
                                                    View
                                                </a>
                                                <a href={getPoUrl(detailRecord.work_order_number, 'download')} className={`${styles.compactDocBtn} ${styles.compactDocBtnDownload}`}>
                                                    Download
                                                </a>
                                            </div>
                                        ) : (
                                            <span className={styles.compactDocMissing}>Not Uploaded</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <button className={`${styles.button} ${styles.btnSecondary}`} onClick={() => setDetailRecord(null)}>
                                Close
                            </button>
                            <button 
                                className={`${styles.button} ${styles.btnPrimary}`} 
                                onClick={() => {
                                    const id = detailRecord.id;
                                    setDetailRecord(null);
                                    navigate(`/smt/material-management/return/bom-view/${id}`);
                                }}
                            >
                                <ClipboardList size={14} style={{ marginRight: '0.25rem' }} /> Work with BOM
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MaterialReturn;
