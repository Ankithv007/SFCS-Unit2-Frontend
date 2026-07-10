import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './MaterialManagement.module.css';
import { WorkOrderSelector } from '../../components/WorkOrderSelector';
import { 
    Search, RefreshCw, Eye, X, FileSpreadsheet
} from 'lucide-react';

interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
}

interface EligibleWO {
    qms_id: number;
    id: string;
    work_order_number: string;
    po_number: string;
    product_name: string;
    product_description: string;
    quantity: number;
    po_document_name: string | null;
    po_document_path: string | null;
    po_document_type: string | null;
    bom_file_path: string | null;
    ecn_file_path: string | null;
    assembly_drawing_file_path: string | null;
    files_metadata: any;
    bom_revision_id: number | null;
    bom_revision_number: string | null;
}

interface MaterialManagementRecord {
    id: string;
    work_order_id: string;
    qms_id: number;
    work_order_number: string;
    po_number: string | null;
    product_name: string | null;
    product_description: string | null;
    quantity: number;
    production_quantity: number;
    bom_revision_id: number | null;
    bom_revision_number: string | null;
    status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CLOSED';
    remarks: string | null;
    bom_file_path?: string | null;
    ecn_file_path?: string | null;
    po_document_name?: string | null;
    po_document_path?: string | null;
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

const MaterialManagement: React.FC = () => {
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
    const [records, setRecords] = useState<MaterialManagementRecord[]>([]);
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

    // Fetch active material management records
    const fetchRecords = async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('auth_token') || '';
            const response = await fetch('/api/smt/material-management/records', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch records');
            }

            const data = await response.json();
            if (Array.isArray(data)) {
                setRecords(data);
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
            const response = await fetch('/api/smt/material-management/eligible-wos', {
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
        const details = eligibleWos.find(w => w.id === woId) || null;
        setSelectedWoDetails(details);
    };

    // Create Material Management record
    const handleCreateRecord = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedWoId || !selectedWoDetails) {
            addToast('Please select a valid Work Order.', 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            const token = localStorage.getItem('auth_token') || '';
            const response = await fetch('/api/smt/material-management/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    work_order_id: selectedWoDetails.id,
                    qms_id: selectedWoDetails.qms_id,
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

            // Reload records & dropdown
            fetchRecords();
            fetchEligibleWorkOrders();
        } catch (err: any) {
            addToast(err.message || 'Error creating record.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDownloadExcel = async (id: string, workOrderNumber: string) => {
        try {
            const token = localStorage.getItem('auth_token') || '';
            const response = await fetch(`/api/smt/material-management/records/${id}/export/excel`, {
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
            a.download = `Material_Report_${workOrderNumber}.xlsx`;
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
            const response = await fetch(`/api/smt/material-management/records/${id}`, {
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
                <h2>Material Management</h2>
                <p>Create and view material issuance plans for approved SMT work orders.</p>
            </div>

            {/* Creation Card */}
            <div className={styles.card}>
                <h3>Create Material Management Record</h3>
                <form onSubmit={handleCreateRecord}>
                    <div className={styles.formGrid4}>
                        <div className={styles.inputGroup}>
                            <label>Work Order Number *</label>
                            <WorkOrderSelector
                                options={eligibleWos}
                                value={selectedWoId}
                                onChange={handleWoChange}
                                placeholder="Select Work Order..."
                                valueKey="id"
                                labelKey="work_order_number"
                                productNameKey="product_name"
                                quantityKey="quantity"
                                required
                            />
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
                            <label>Material Management Remarks</label>
                            <textarea 
                                className={styles.textareaCompact} 
                                placeholder="Enter master-level remarks, material notes, or issuance instructions..."
                                value={masterRemarks}
                                onChange={(e) => setMasterRemarks(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Associated Documents Compact Section */}
                    <div className={styles.compactDocsSection}>
                        <label className={styles.compactDocsLabel}>Associated Documents</label>
                        <div className={styles.compactDocsGrid}>
                            {/* BOM File Column */}
                            <div className={styles.compactDocCol}>
                                <span className={styles.compactDocHeader}>BOM File</span>
                                {selectedWoDetails?.bom_file_path ? (
                                    <div className={styles.compactDocActions}>
                                        <button 
                                            type="button" 
                                            className={`${styles.compactDocBtn} ${styles.compactDocBtnView}`}
                                            onClick={() => window.open(getDocumentUrl(selectedWoDetails.qms_id, 'bom', 'view'), '_blank')}
                                        >
                                            View
                                        </button>
                                        <a 
                                            href={getDocumentUrl(selectedWoDetails.qms_id, 'bom', 'download')}
                                            className={`${styles.compactDocBtn} ${styles.compactDocBtnDownload}`}
                                            download
                                        >
                                            Download
                                        </a>
                                    </div>
                                ) : (
                                    <span className={styles.compactDocMissing}>Not uploaded</span>
                                )}
                            </div>

                            {/* ECN File Column */}
                            <div className={styles.compactDocCol}>
                                <span className={styles.compactDocHeader}>ECN File</span>
                                {selectedWoDetails?.ecn_file_path ? (
                                    <div className={styles.compactDocActions}>
                                        <button 
                                            type="button" 
                                            className={`${styles.compactDocBtn} ${styles.compactDocBtnView}`}
                                            onClick={() => window.open(getDocumentUrl(selectedWoDetails.qms_id, 'ecn', 'view'), '_blank')}
                                        >
                                            View
                                        </button>
                                        <a 
                                            href={getDocumentUrl(selectedWoDetails.qms_id, 'ecn', 'download')}
                                            className={`${styles.compactDocBtn} ${styles.compactDocBtnDownload}`}
                                            download
                                        >
                                            Download
                                        </a>
                                    </div>
                                ) : (
                                    <span className={styles.compactDocMissing}>Not uploaded</span>
                                )}
                            </div>

                            {/* PO Document Column */}
                            <div className={styles.compactDocCol}>
                                <span className={styles.compactDocHeader}>PO Document</span>
                                {selectedWoDetails?.po_document_path ? (
                                    <div className={styles.compactDocActions}>
                                        <button 
                                            type="button" 
                                            className={`${styles.compactDocBtn} ${styles.compactDocBtnView}`}
                                            onClick={() => window.open(getPoUrl(selectedWoDetails.work_order_number, 'view'), '_blank')}
                                        >
                                            View
                                        </button>
                                        <a 
                                            href={getPoUrl(selectedWoDetails.work_order_number, 'download')}
                                            className={`${styles.compactDocBtn} ${styles.compactDocBtnDownload}`}
                                            download
                                        >
                                            Download
                                        </a>
                                    </div>
                                ) : (
                                    <span className={styles.compactDocMissing}>Not uploaded</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className={styles.formFooter}>
                        <button type="submit" className={`${styles.button} ${styles.btnPrimary}`} disabled={isSubmitting || !selectedWoId}>
                            {isSubmitting ? <><RefreshCw className="animate-spin" size={16} /> Creating...</> : 'Create Material Management'}
                        </button>
                    </div>
                </form>
            </div>

            {/* List Table Card */}
            <div className={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <h3 style={{ margin: 0, border: 'none', padding: 0 }}>Material Management Records</h3>
                    <div className={styles.searchBar}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <Search size={16} style={{ position: 'absolute', left: '0.75rem', color: '#94a3b8' }} />
                            <input 
                                className={styles.input} 
                                style={{ paddingLeft: '2.5rem', width: '300px' }} 
                                type="text" 
                                placeholder="Search Work Order / PO / Product..." 
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <button className={`${styles.button} ${styles.btnSecondary}`} onClick={fetchRecords}>
                            <RefreshCw size={16} />
                        </button>
                    </div>
                </div>

                <div className={styles.tableContainer}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Work Order Number</th>
                                <th>PO Number</th>
                                <th>Product Name</th>
                                <th>Quantity</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '3rem' }}>
                                        <RefreshCw className="animate-spin" size={24} style={{ color: '#4f46e5' }} />
                                    </td>
                                </tr>
                            ) : filteredRecords.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                                        No Material Management records found.
                                    </td>
                                </tr>
                            ) : filteredRecords.map(rec => (
                                <tr key={rec.id}>
                                    <td style={{ fontWeight: 600, color: '#0f172a' }}>{rec.work_order_number}</td>
                                    <td>{rec.po_number || '—'}</td>
                                    <td>{rec.product_name || '—'}</td>
                                    <td>{rec.production_quantity || '—'}</td>
                                    <td>
                                        <span className={`${styles.statusBadge} ${getStatusStyle(rec.status)}`}>
                                            {rec.status}
                                        </span>
                                    </td>
                                    <td>
                                        <button 
                                            className={styles.viewBtn} 
                                            onClick={() => handleViewDetail(rec.id)}
                                            title="View Details"
                                        >
                                            <Eye size={15} style={{ marginRight: '6px' }} />
                                            View
                                        </button>
                                        <button
                                            className={styles.viewBtn}
                                            onClick={() => navigate(`/smt/material-management/bom-view/${rec.id}`)}
                                            title="Work with BOM"
                                            style={{ marginLeft: '8px' }}
                                        >
                                            <Eye size={15} style={{ marginRight: '6px' }} />
                                            Work With BOM
                                        </button>
                                        <button
                                            className={styles.viewBtn}
                                            onClick={() => handleDownloadExcel(rec.id, rec.work_order_number)}
                                            title="Download Excel"
                                            style={{ marginLeft: '8px' }}
                                        >
                                            <FileSpreadsheet size={15} style={{ marginRight: '6px' }} />
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
                    <div className={styles.modalContent} style={{ maxWidth: '950px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div className={styles.modalHeader}>
                            <h3>Material Management Details — {detailRecord.work_order_number}</h3>
                            <button className={styles.closeModalBtn} onClick={() => setDetailRecord(null)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            {/* Section 1: Snapshot Details */}
                            <div className={styles.detailsSection}>
                                <h4 className={styles.sectionTitle}>Snapshot Details</h4>
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
                                        <span className={styles.detailLabel}>Current BOM Revision</span>
                                        <div style={{ marginTop: '0.25rem' }}>
                                            <span className={styles.revTag}>Rev {detailRecord.bom_revision_number || '—'}</span>
                                        </div>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Original WO Qty</span>
                                        <span className={styles.detailValue}>{detailRecord.quantity}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Production Quantity</span>
                                        <span className={styles.detailValue}>{detailRecord.production_quantity}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Status</span>
                                        <div style={{ marginTop: '0.25rem' }}>
                                            <span className={`${styles.statusBadge} ${getStatusStyle(detailRecord.status)}`}>
                                                {detailRecord.status}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Audit Logs */}
                            <div className={styles.detailsSection}>
                                <h4 className={styles.sectionTitle}>Audit Info</h4>
                                <div className={styles.detailsGrid}>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Created By</span>
                                        <span className={styles.detailValue}>{detailRecord.created_by || '—'}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Created Date</span>
                                        <span className={styles.detailValue}>{formatDateTime(detailRecord.created_at)}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Updated By</span>
                                        <span className={styles.detailValue}>{detailRecord.updated_by || '—'}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Updated Date</span>
                                        <span className={styles.detailValue}>{formatDateTime(detailRecord.updated_at)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: Product Description & Remarks */}
                            <div className={styles.detailsSection}>
                                <h4 className={styles.sectionTitle}>Description & Remarks</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                                    <div>
                                        <span className={styles.detailLabel} style={{ display: 'block', marginBottom: '0.25rem' }}>Product Description</span>
                                        <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '0.375rem', padding: '0.75rem', fontSize: '0.9rem', color: '#1e293b', whiteSpace: 'pre-wrap', minHeight: '80px' }}>
                                            {detailRecord.product_description || 'No description provided.'}
                                        </div>
                                    </div>
                                    <div>
                                        <span className={styles.detailLabel} style={{ display: 'block', marginBottom: '0.25rem' }}>Material Management Remarks</span>
                                        <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '0.375rem', padding: '0.75rem', fontSize: '0.9rem', color: '#1e293b', whiteSpace: 'pre-wrap', minHeight: '80px' }}>
                                            {detailRecord.remarks || 'No remarks provided.'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section 4: Associated Documents */}
                            <div className={styles.detailsSection}>
                                <h4 className={styles.sectionTitle}>Associated Documents</h4>
                                <div className={styles.compactDocsGrid}>
                                    {/* BOM File Column */}
                                    <div className={styles.compactDocCol}>
                                        <span className={styles.compactDocHeader}>BOM File</span>
                                        {detailRecord.bom_file_path ? (
                                            <div className={styles.compactDocActions}>
                                                <button 
                                                    type="button" 
                                                    className={`${styles.compactDocBtn} ${styles.compactDocBtnView}`}
                                                    onClick={() => window.open(getDocumentUrl(detailRecord.qms_id, 'bom', 'view'), '_blank')}
                                                >
                                                    View
                                                </button>
                                                <a 
                                                    href={getDocumentUrl(detailRecord.qms_id, 'bom', 'download')}
                                                    className={`${styles.compactDocBtn} ${styles.compactDocBtnDownload}`}
                                                    download
                                                >
                                                    Download
                                                </a>
                                            </div>
                                        ) : (
                                            <span className={styles.compactDocMissing}>Not uploaded</span>
                                        )}
                                    </div>

                                    {/* ECN File Column */}
                                    <div className={styles.compactDocCol}>
                                        <span className={styles.compactDocHeader}>ECN File</span>
                                        {detailRecord.ecn_file_path ? (
                                            <div className={styles.compactDocActions}>
                                                <button 
                                                    type="button" 
                                                    className={`${styles.compactDocBtn} ${styles.compactDocBtnView}`}
                                                    onClick={() => window.open(getDocumentUrl(detailRecord.qms_id, 'ecn', 'view'), '_blank')}
                                                >
                                                    View
                                                </button>
                                                <a 
                                                    href={getDocumentUrl(detailRecord.qms_id, 'ecn', 'download')}
                                                    className={`${styles.compactDocBtn} ${styles.compactDocBtnDownload}`}
                                                    download
                                                >
                                                    Download
                                                </a>
                                            </div>
                                        ) : (
                                            <span className={styles.compactDocMissing}>Not uploaded</span>
                                        )}
                                    </div>

                                    {/* PO Document Column */}
                                    <div className={styles.compactDocCol}>
                                        <span className={styles.compactDocHeader}>PO Document</span>
                                        {detailRecord.po_document_path ? (
                                            <div className={styles.compactDocActions}>
                                                <button 
                                                    type="button" 
                                                    className={`${styles.compactDocBtn} ${styles.compactDocBtnView}`}
                                                    onClick={() => window.open(getPoUrl(detailRecord.work_order_number, 'view'), '_blank')}
                                                >
                                                    View
                                                </button>
                                                <a 
                                                    href={getPoUrl(detailRecord.work_order_number, 'download')}
                                                    className={`${styles.compactDocBtn} ${styles.compactDocBtnDownload}`}
                                                    download
                                                >
                                                    Download
                                                </a>
                                            </div>
                                        ) : (
                                            <span className={styles.compactDocMissing}>Not uploaded</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className={styles.modalFooter} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <button 
                                className={`${styles.button} ${styles.btnPrimary}`} 
                                onClick={() => handleDownloadExcel(detailRecord.id, detailRecord.work_order_number)}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#16a34a', borderColor: '#16a34a' }}
                            >
                                <FileSpreadsheet size={16} /> Download Excel
                            </button>
                            <button className={`${styles.button} ${styles.btnSecondary}`} onClick={() => setDetailRecord(null)}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MaterialManagement;
