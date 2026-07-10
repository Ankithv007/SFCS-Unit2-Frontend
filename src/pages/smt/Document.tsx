import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../utils/api';
import { useSmtAuth } from '../../context/SmtAuthContext';
import styles from './Document.module.css';
import { 
    Download, Eye, Trash2, UploadCloud, X, RefreshCw, Search
} from 'lucide-react';

interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
}

interface WorkOrder {
    work_order_number: string;
    po_number: string;
    product_name: string;
    product_description: string;
    quantity: number;
    warehouse_remarks: string;
}

interface QmsRecord {
    id: number;
    work_order_number: string;
    po_number: string | null;
    product_name: string | null;
    product_description: string | null;
    quantity: number | null;
    warehouse_remarks: string | null;
    qms_remarks: string | null;
    bom_file_path: string | null;
    pfc_file_path: string | null;
    xy_data_file_path: string | null;
    ecn_file_path: string | null;
    assembly_drawing_file_path: string | null;
    files_metadata: any;
    current_bom_revision: string;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    status: string;
    current_bom_revision_id?: number | null;
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

const Document: React.FC = () => {
    const { smtUser } = useSmtAuth();
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
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
    const [selectedWoNum, setSelectedWoNum] = useState('');
    const [woDetails, setWoDetails] = useState<WorkOrder | null>(null);
    const [qmsRemarks, setQmsRemarks] = useState('');

    // File Upload States
    const [uploadedFiles, setUploadedFiles] = useState<{ [key: string]: File | null }>({
        bom: null,
        pfc: null,
        xy: null,
        ecn: null,
        drawing: null
    });

    // Active QMS records
    const [qmsRecords, setQmsRecords] = useState<QmsRecord[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Details View Modal
    const [selectedQmsRecord, setSelectedQmsRecord] = useState<QmsRecord | null>(null);
    const [qmsHistoryList, setQmsHistoryList] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [fileUpdateTarget, setFileUpdateTarget] = useState<string | null>(null);
    const [fileUpdateFile, setFileUpdateFile] = useState<File | null>(null);
    const [fileUpdateRemarks, setFileUpdateRemarks] = useState('');
    const [isFileUpdating, setIsFileUpdating] = useState(false);

    // Preview modal
    const [previewModal, setPreviewModal] = useState<{ originalName: string; url: string; isCsv: boolean } | null>(null);
    const [csvPreviewData, setCsvPreviewData] = useState<string[][]>([]);

    useEffect(() => {
        fetchWorkOrders();
        fetchQmsRecords();
    }, []);

    const fetchWorkOrders = async () => {
        try {
            const res = await apiFetch('/api/smt/qms/work-orders');
            if (Array.isArray(res)) {
                setWorkOrders(res);
            }
        } catch (err) {
            addToast('Failed to load eligible Work Orders', 'error');
        }
    };

    const fetchQmsRecords = async () => {
        setIsLoading(true);
        try {
            const res = await apiFetch('/api/smt/qms/records');
            if (Array.isArray(res)) {
                setQmsRecords(res);
            }
        } catch (err) {
            addToast('Failed to load active Document Process records', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleWoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const woNum = e.target.value;
        setSelectedWoNum(woNum);
        const details = workOrders.find(w => w.work_order_number === woNum);
        setWoDetails(details || null);
    };

    const handleFileChange = (category: string, file: File | null) => {
        if (!file) {
            setUploadedFiles(prev => ({ ...prev, [category]: null }));
            return;
        }

        if (file.size > 50 * 1024 * 1024) {
            addToast('File size must not exceed 50MB.', 'error');
            return;
        }

        const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        const allowed = ['.pdf', '.xls', '.xlsx', '.csv', '.zip'];
        if (!allowed.includes(ext)) {
            addToast('Invalid file extension. Allowed: PDF, Excel, CSV, ZIP.', 'error');
            return;
        }

        setUploadedFiles(prev => ({ ...prev, [category]: file }));
    };

    const handleRemoveFile = (category: string) => {
        setUploadedFiles(prev => ({ ...prev, [category]: null }));
        const fileInput = document.getElementById(`file-${category}`) as HTMLInputElement;
        if (fileInput) fileInput.value = '';
    };

    const getFileIcon = (file: File) => {
        const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        if (ext === '.pdf') return 'PDF';
        if (ext === '.csv') return 'CSV';
        if (ext === '.xls' || ext === '.xlsx') return 'EXCEL';
        if (ext === '.zip') return 'ZIP';
        return 'FILE';
    };

    const getBadgeClass = (type: string) => {
        if (type === 'PDF') return styles.badgePdf;
        if (type === 'CSV') return styles.badgeCsv;
        if (type === 'EXCEL') return styles.badgeExcel;
        if (type === 'ZIP') return styles.badgeZip;
        return styles.badgeFile;
    };

    const handleLocalPreview = (file: File) => {
        const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        
        if (ext === '.csv') {
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target?.result as string;
                const rows = text.split('\n')
                    .map(line => line.split(',').map(cell => cell.trim().replace(/^"|"$/g, '')))
                    .filter(row => row.length > 0 && row.some(cell => cell !== ''));
                setCsvPreviewData(rows);
                setPreviewModal({ originalName: file.name, url: '', isCsv: true });
            };
            reader.onerror = () => {
                addToast('Failed to read CSV file locally', 'error');
            };
            reader.readAsText(file);
        } else if (ext === '.pdf') {
            const localUrl = URL.createObjectURL(file);
            setPreviewModal({ originalName: file.name, url: localUrl, isCsv: false });
        } else if (ext === '.xls' || ext === '.xlsx') {
            const localUrl = URL.createObjectURL(file);
            const link = document.createElement('a');
            link.href = localUrl;
            link.download = file.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            addToast('Excel file downloaded for local review.', 'info');
        } else if (ext === '.zip') {
            const localUrl = URL.createObjectURL(file);
            const link = document.createElement('a');
            link.href = localUrl;
            link.download = file.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            addToast('ZIP archive downloaded locally.', 'info');
        } else {
            addToast('Browser preview is only supported for PDF and CSV.', 'info');
        }
    };

    const handleCreateQms = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedWoNum) {
            addToast('Please select a Work Order.', 'error');
            return;
        }
        if (!uploadedFiles.bom) {
            addToast('BOM document is mandatory.', 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('work_order_number', selectedWoNum);
            formData.append('po_number', woDetails?.po_number || '');
            formData.append('product_name', woDetails?.product_name || '');
            formData.append('product_description', woDetails?.product_description || '');
            formData.append('quantity', woDetails?.quantity?.toString() || '');
            formData.append('warehouse_remarks', woDetails?.warehouse_remarks || '');
            formData.append('qms_remarks', qmsRemarks);
            formData.append('userName', smtUser?.name || 'Operator');

            if (uploadedFiles.bom) formData.append('bom', uploadedFiles.bom);
            if (uploadedFiles.pfc) formData.append('pfc', uploadedFiles.pfc);
            if (uploadedFiles.xy) formData.append('xy', uploadedFiles.xy);
            if (uploadedFiles.ecn) formData.append('ecn', uploadedFiles.ecn);
            if (uploadedFiles.drawing) formData.append('drawing', uploadedFiles.drawing);

            const token = localStorage.getItem('auth_token') || '';
            const response = await fetch('/api/smt/qms/create', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (response.status === 401) {
                addToast('Session expired. Please login again.', 'error');
                setIsSubmitting(false);
                return;
            }

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.message || result.error || 'Failed to create Document Process');
            }

            addToast('Document Process record and documents created successfully.', 'success');
            
            // Reset fields
            setSelectedWoNum('');
            setWoDetails(null);
            setQmsRemarks('');
            setUploadedFiles({ bom: null, pfc: null, xy: null, ecn: null, drawing: null });
            
            fetchWorkOrders(); // Refresh Work Order dropdown list automatically
            fetchQmsRecords();
        } catch (err: any) {
            addToast(err.message || 'Error occurred while saving.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    // View file handler with stream support
    const handleViewFile = async (qmsId: number, fileType: string, originalName: string) => {
        const ext = originalName.substring(originalName.lastIndexOf('.')).toLowerCase();
        const token = localStorage.getItem('auth_token') || '';
        const url = `/api/smt/qms/files/view/${qmsId}/${fileType}?token=${encodeURIComponent(token)}`;
        
        if (ext === '.csv') {
            try {
                addToast('Loading preview...', 'info');
                const res = await fetch(url);
                if (!res.ok) throw new Error();
                const text = await res.text();
                
                // Parse CSV rows
                const rows = text.split('\n')
                    .map(line => line.split(',').map(cell => cell.trim().replace(/^"|"$/g, '')))
                    .filter(row => row.length > 0 && row.some(cell => cell !== ''));
                
                setCsvPreviewData(rows);
                setPreviewModal({ originalName, url, isCsv: true });
            } catch {
                addToast('Failed to load CSV preview. Please download instead.', 'error');
            }
        } else if (ext === '.pdf') {
            setPreviewModal({ originalName, url, isCsv: false });
        } else {
            addToast('Browser preview is only supported for PDF and CSV. Please download to view locally.', 'info');
        }
    };

    // Soft Delete
    const handleDeleteQms = async (qmsId: number) => {
        const isSuperAdmin = smtUser?.role === 'Super Admin';
        if (!isSuperAdmin) {
            addToast("Only Super Admin is authorized to delete records.\nPlease contact your Super Admin if this record needs to be deleted.", "error");
            return;
        }
        if (!window.confirm('Are you sure you want to soft delete this Document Process record? This action will be logged in the audit trail.')) {
            return;
        }

        try {
            const token = localStorage.getItem('auth_token') || '';
            const response = await fetch(`/api/smt/qms/delete/${qmsId}`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ userName: smtUser?.name || 'Operator' })
            });

            const res = await response.json();
            if (!response.ok) throw new Error(res.error || 'Delete failed');

            addToast('Document Process record soft deleted.', 'success');
            fetchQmsRecords();
        } catch (err: any) {
            addToast(err.message, 'error');
        }
    };

    // View Details Modal Trigger
    const openDetailsModal = async (qms: QmsRecord) => {
        setSelectedQmsRecord(qms);
        setFileUpdateTarget(null);
        setFileUpdateFile(null);
        setFileUpdateRemarks('');
        fetchQmsHistory(qms.id);
    };

    // Fetch unified revision history logs
    const fetchQmsHistory = async (qmsId: number) => {
        setHistoryLoading(true);
        try {
            const data = await apiFetch(`/api/smt/qms/revisions/${qmsId}`);
            if (Array.isArray(data)) {
                setQmsHistoryList(data);
            }
        } catch {
            addToast('Failed to fetch document history logs.', 'error');
        } finally {
            setHistoryLoading(false);
        }
    };

    // File updates submit
    const handleFileReplacementSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedQmsRecord || !fileUpdateTarget || !fileUpdateFile) return;

        if (!fileUpdateRemarks || !fileUpdateRemarks.trim()) {
            addToast('Remarks/comments are mandatory for every update.', 'error');
            return;
        }

        const MAX_SIZE = 50 * 1024 * 1024;
        if (fileUpdateFile.size > MAX_SIZE) {
            addToast('File size must not exceed 50MB.', 'error');
            return;
        }

        const allowedExtensions = ['.pdf', '.xls', '.xlsx', '.csv', '.zip'];
        const ext = fileUpdateFile.name.substring(fileUpdateFile.name.lastIndexOf('.')).toLowerCase();
        if (!allowedExtensions.includes(ext)) {
            addToast('Invalid file type. Only PDF, Excel, CSV, and ZIP files are permitted.', 'error');
            return;
        }

        if (!window.confirm("Are you sure you want to replace this file?\nThe previous file version will be physically deleted from server storage.")) {
            return;
        }

        setIsFileUpdating(true);
        try {
            const formData = new FormData();
            formData.append('file', fileUpdateFile);
            formData.append('fileType', fileUpdateTarget);
            formData.append('remarks', fileUpdateRemarks);
            formData.append('userName', smtUser?.name || 'Operator');

            const token = localStorage.getItem('auth_token') || '';
            const endpoint = fileUpdateTarget === 'bom' 
                ? `/api/smt/qms/bom-revision/${selectedQmsRecord.id}` 
                : `/api/smt/qms/update-file/${selectedQmsRecord.id}`;

            console.log("Submitting FormData to endpoint:", endpoint);
            console.log(formData);
            for (let pair of formData.entries()) {
                console.log(pair[0] + ':', pair[1]);
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (response.status === 401) {
                addToast('Session expired. Please login again.', 'error');
                setIsFileUpdating(false);
                return;
            }

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Failed to replace file');

            addToast('Document replaced and previous file physically deleted.', 'success');
            
            // Re-fetch everything
            await fetchQmsRecords();
            await fetchQmsHistory(selectedQmsRecord.id);

            // Update local details record to show changes
            const updatedRecRes = await fetch(`/api/smt/qms/records`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (updatedRecRes.ok) {
                const recs = await updatedRecRes.json();
                const updatedItem = recs.find((r: any) => r.id === selectedQmsRecord.id);
                if (updatedItem) {
                    setSelectedQmsRecord(updatedItem);
                }
            }

            // Reset inputs
            setFileUpdateTarget(null);
            setFileUpdateFile(null);
            setFileUpdateRemarks('');
        } catch (err: any) {
            addToast(err.message || 'Failed to replace file.', 'error');
        } finally {
            setIsFileUpdating(false);
        }
    };

    // Filtered records
    const filteredRecords = qmsRecords.filter(rec => 
        rec.work_order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (rec.po_number && rec.po_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (rec.product_name && rec.product_name.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const formatBytes = (bytes: number) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <h2>Document Process</h2>
                <p>Enterprise Document Process Handling & Audit Integrity Compliance</p>
            </div>

            {/* Creation Card */}
            <div className={styles.card}>
                <h3>Create New Document Process Record</h3>
                <form onSubmit={handleCreateQms}>
                    <div className={styles.formGrid4}>
                        <div className={styles.inputGroup}>
                            <label>Work Order Number *</label>
                            <select 
                                className={styles.select} 
                                value={selectedWoNum} 
                                onChange={handleWoChange}
                            >
                                <option value="">Select Work Order...</option>
                                {workOrders.map(wo => (
                                    <option key={wo.work_order_number} value={wo.work_order_number}>
                                        {wo.work_order_number}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className={styles.inputGroup}>
                            <label>PO Number</label>
                            <input className={styles.input} type="text" readOnly value={woDetails?.po_number || ''} />
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Product Name</label>
                            <input className={styles.input} type="text" readOnly value={woDetails?.product_name || ''} />
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Quantity</label>
                            <input className={styles.input} type="text" readOnly value={woDetails?.quantity || ''} />
                        </div>
                    </div>

                    <div className={styles.formGrid2}>
                        <div className={styles.inputGroup}>
                            <label>Product Description</label>
                            <textarea className={styles.textarea} readOnly value={woDetails?.product_description || ''} />
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Warehouse Remarks</label>
                            <textarea className={styles.textarea} readOnly value={woDetails?.warehouse_remarks || ''} />
                        </div>
                    </div>

                    <div className={styles.formGrid1}>
                        <div className={styles.inputGroup}>
                            <label>Document Process Remarks</label>
                            <textarea 
                                className={styles.textarea} 
                                placeholder="Enter additional operator notes, special manufacturing instructions, Document Process comments, or upload explanations..."
                                value={qmsRemarks}
                                onChange={(e) => setQmsRemarks(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Drag-and-drop / select File categories */}
                    <div className={styles.uploadSection}>
                        <label style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '1.25rem' }}>
                            Upload Documents (Max 50MB each; PDF, Excel, CSV, ZIP)
                        </label>
                        <div className={styles.uploadGrid}>
                            {['bom', 'pfc', 'xy', 'ecn', 'drawing'].map(category => {
                                const currentFile = uploadedFiles[category];
                                const catLabel = category === 'bom' ? 'BOM *' : category === 'xy' ? 'XY DATA' : category === 'drawing' ? 'Assembly Drawing' : category.toUpperCase();
                                
                                return currentFile ? (
                                    <div key={category} className={styles.uploadCard}>
                                        <div className={styles.uploadCardInfo}>
                                            <span className={`${styles.fileBadge} ${getBadgeClass(getFileIcon(currentFile))}`}>
                                                {getFileIcon(currentFile)}
                                            </span>
                                            <span className={styles.fileName} title={currentFile.name}>
                                                {currentFile.name}
                                            </span>
                                        </div>
                                        <div className={styles.fileSize}>
                                            {formatBytes(currentFile.size)}
                                        </div>
                                        <div className={styles.uploadCardActions}>
                                            <button 
                                                type="button" 
                                                className={`${styles.button} ${styles.btnSecondary} ${styles.cardActionBtn}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleLocalPreview(currentFile);
                                                }}
                                            >
                                                View
                                            </button>
                                            <button 
                                                type="button" 
                                                className={`${styles.button} ${styles.btnSecondary} ${styles.cardActionBtn} ${styles.cardActionBtnRemove}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRemoveFile(category);
                                                }}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                        <input 
                                            id={`file-${category}`}
                                            type="file"
                                            style={{ display: 'none' }}
                                            onChange={(e) => handleFileChange(category, e.target.files?.[0] || null)}
                                        />
                                    </div>
                                ) : (
                                    <div 
                                        key={category} 
                                        className={styles.dropzone}
                                        onClick={() => document.getElementById(`file-${category}`)?.click()}
                                    >
                                        <input 
                                            id={`file-${category}`}
                                            type="file"
                                            style={{ display: 'none' }}
                                            onChange={(e) => handleFileChange(category, e.target.files?.[0] || null)}
                                        />
                                        <UploadCloud className={styles.dropzoneIcon} size={32} />
                                        <span className={styles.dropzoneText}>{catLabel}</span>
                                        <span className={styles.dropzoneExt}>PDF, Excel, CSV, ZIP</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className={styles.submitSection}>
                        <button type="submit" className={`${styles.button} ${styles.btnPrimary}`} disabled={isSubmitting || !selectedWoNum}>
                            {isSubmitting ? <><RefreshCw className="animate-spin" size={16} /> Creating Document Process...</> : 'Create Document Process'}
                        </button>
                    </div>
                </form>
            </div>

            {/* List Table Card */}
            <div className={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <h3 style={{ margin: 0, border: 'none', padding: 0 }}>Active Document Process Records</h3>
                    <div className={styles.searchBar}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <Search size={16} style={{ position: 'absolute', left: '0.75rem', color: '#94a3b8' }} />
                            <input 
                                className={styles.input} 
                                style={{ paddingLeft: '2.5rem', width: '300px' }} 
                                type="text" 
                                placeholder="Search Work Order / PO / Product..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <button className={`${styles.button} ${styles.btnSecondary}`} onClick={fetchQmsRecords}>
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
                                        No Document Process records found.
                                    </td>
                                </tr>
                            ) : filteredRecords.map(rec => {
                                return (
                                    <tr key={rec.id}>
                                        <td style={{ fontWeight: 600, color: '#0f172a' }}>{rec.work_order_number}</td>
                                        <td>{rec.po_number || '—'}</td>
                                        <td>{rec.product_name || '—'}</td>
                                        <td>{rec.quantity || '—'}</td>
                                        <td>
                                            <span className={`${styles.statusBadge} ${
                                                rec.status === 'Completed' ? styles.statusCompleted : styles.statusActive
                                            }`}>
                                                {rec.status || 'Active'}
                                            </span>
                                        </td>
                                        <td>
                                            <button 
                                                className={styles.viewBtn} 
                                                onClick={() => openDetailsModal(rec)}
                                                title="View Document Process Details"
                                            >
                                                <Eye size={15} style={{ marginRight: '6px' }} />
                                                View
                                            </button>
                                            {rec.current_bom_revision_id && (
                                                <button
                                                    className={styles.viewBtn}
                                                    onClick={() => navigate(`/smt/qms/bom-view/${rec.current_bom_revision_id}`)}
                                                    title="View BOM Components"
                                                    style={{ marginLeft: '8px' }}
                                                >
                                                    <Eye size={15} style={{ marginRight: '6px' }} />
                                                    View BOM
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* View Details Modal */}
            {selectedQmsRecord && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent} style={{ maxWidth: '950px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div className={styles.modalHeader}>
                            <h3>Document Process Record Details — {selectedQmsRecord.work_order_number}</h3>
                            <button className={styles.closeModalBtn} onClick={() => setSelectedQmsRecord(null)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            
                            {/* Section 1: QMS Details */}
                            <div className={styles.detailsSection}>
                                <h4 className={styles.sectionTitle}>Document Process Details</h4>
                                <div className={styles.detailsGrid}>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Work Order Number</span>
                                        <span className={styles.detailValue}>{selectedQmsRecord.work_order_number}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>PO Number</span>
                                        <span className={styles.detailValue}>{selectedQmsRecord.po_number || '—'}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Product Name</span>
                                        <span className={styles.detailValue}>{selectedQmsRecord.product_name || '—'}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Quantity</span>
                                        <span className={styles.detailValue}>{selectedQmsRecord.quantity || '—'}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Created By</span>
                                        <span className={styles.detailValue}>{selectedQmsRecord.created_by || 'System'}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Created Date</span>
                                        <span className={styles.detailValue}>
                                            {selectedQmsRecord.created_at ? new Date(selectedQmsRecord.created_at).toLocaleString() : '—'}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem} style={{ gridColumn: 'span 2' }}>
                                        <span className={styles.detailLabel}>Product Description</span>
                                        <span className={styles.detailValue}>{selectedQmsRecord.product_description || '—'}</span>
                                    </div>
                                    <div className={styles.detailItem} style={{ gridColumn: 'span 2' }}>
                                        <span className={styles.detailLabel}>Warehouse Remarks</span>
                                        <span className={styles.detailValue}>{selectedQmsRecord.warehouse_remarks || '—'}</span>
                                    </div>
                                    <div className={styles.detailItem} style={{ gridColumn: 'span 2' }}>
                                        <span className={styles.detailLabel}>Document Process Remarks</span>
                                        <span className={styles.detailValue}>{selectedQmsRecord.qms_remarks || '—'}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Last Updated By</span>
                                        <span className={styles.detailValue}>
                                            {(() => {
                                                const meta = selectedQmsRecord.files_metadata || {};
                                                let latestUser = selectedQmsRecord.created_by || 'System';
                                                let latestTime = selectedQmsRecord.created_at;
                                                Object.keys(meta).forEach(k => {
                                                    if (meta[k]?.uploadedAt && (!latestTime || new Date(meta[k].uploadedAt) > new Date(latestTime))) {
                                                        latestTime = meta[k].uploadedAt;
                                                        latestUser = meta[k].uploadedBy;
                                                    }
                                                });
                                                return latestUser;
                                            })()}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Last Updated At</span>
                                        <span className={styles.detailValue}>
                                            {(() => {
                                                let latestTime = selectedQmsRecord.created_at;
                                                const meta = selectedQmsRecord.files_metadata || {};
                                                Object.keys(meta).forEach(k => {
                                                    if (meta[k]?.uploadedAt && (!latestTime || new Date(meta[k].uploadedAt) > new Date(latestTime))) {
                                                        latestTime = meta[k].uploadedAt;
                                                    }
                                                });
                                                return latestTime ? new Date(latestTime).toLocaleString() : '—';
                                            })()}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Current Files */}
                            <div className={styles.detailsSection} style={{ marginTop: '2rem' }}>
                                <h4 className={styles.sectionTitle}>Current Files</h4>
                                <div className={styles.filesList}>
                                    {['bom', 'pfc', 'xy', 'ecn', 'drawing'].map(key => {
                                        const meta = selectedQmsRecord.files_metadata || {};
                                        const fileMeta = meta[key];
                                        const hasFile = !!fileMeta;
                                        const fileTypeLabel = key === 'xy' ? 'XY Data' : key === 'drawing' ? 'Drawing' : key.toUpperCase();
                                        const isTarget = fileUpdateTarget === key;
                                        const token = localStorage.getItem('auth_token') || '';

                                        return (
                                            <div key={key} className={styles.fileRow}>
                                                <div className={styles.fileInfo}>
                                                    <span className={styles.fileTypeBadge}>{fileTypeLabel}</span>
                                                    {hasFile ? (
                                                        <div className={styles.fileNameContainer}>
                                                            <span className={styles.fileName}>{fileMeta.originalName}</span>
                                                            <span className={styles.fileMetaText}>
                                                                Current Revision: Rev {fileMeta.revision || '1'} | Uploaded by: {fileMeta.uploadedBy || '—'} on {new Date(fileMeta.uploadedAt).toLocaleString()}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className={styles.noFileUploaded}>No file uploaded</span>
                                                    )}
                                                </div>
                                                
                                                <div className={styles.fileActions}>
                                                    {hasFile && (
                                                        <>
                                                            <button 
                                                                className={`${styles.button} ${styles.btnSecondary} ${styles.btnSmall}`} 
                                                                onClick={() => handleViewFile(selectedQmsRecord.id, key, fileMeta.originalName)}
                                                            >
                                                                 <Eye size={14} /> View File
                                                            </button>
                                                            {key === 'bom' && selectedQmsRecord.current_bom_revision_id && (
                                                                <button 
                                                                    className={`${styles.button} ${styles.btnSecondary} ${styles.btnSmall}`} 
                                                                    onClick={() => navigate(`/smt/qms/bom-view/${selectedQmsRecord.current_bom_revision_id}`)}
                                                                >
                                                                    <Eye size={14} /> View BOM Data
                                                                </button>
                                                            )}
                                                            <a 
                                                                href={`/api/smt/qms/files/download/${selectedQmsRecord.id}/${key}?token=${encodeURIComponent(token)}`} 
                                                                className={`${styles.button} ${styles.btnSecondary} ${styles.btnSmall} ${styles.btnLink}`}
                                                                download
                                                            >
                                                                <Download size={14} /> Download
                                                            </a>
                                                        </>
                                                    )}
                                                    <button 
                                                        className={`${styles.button} ${styles.btnPrimary} ${styles.btnSmall}`}
                                                        onClick={() => {
                                                            setFileUpdateTarget(isTarget ? null : key);
                                                            setFileUpdateFile(null);
                                                            setFileUpdateRemarks('');
                                                        }}
                                                    >
                                                        <UploadCloud size={14} /> Replace File
                                                    </button>
                                                </div>

                                                {/* Inline Replace Form */}
                                                {isTarget && (
                                                    <form onSubmit={handleFileReplacementSubmit} className={styles.inlineReplaceForm}>
                                                        <h5>Upload New {fileTypeLabel} Document</h5>
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                                            <div className={styles.inputGroup}>
                                                                <label className={styles.inputLabel}>Choose File (PDF, Excel, CSV, ZIP | Max 50MB) <span style={{ color: '#ef4444' }}>*</span></label>
                                                                <input 
                                                                    type="file" 
                                                                    onChange={(e) => setFileUpdateFile(e.target.files?.[0] || null)}
                                                                    required
                                                                    accept=".pdf,.xls,.xlsx,.csv,.zip"
                                                                />
                                                            </div>
                                                            <div className={styles.inputGroup}>
                                                                <label className={styles.inputLabel}>Remarks / Reason for Update <span style={{ color: '#ef4444' }}>*</span></label>
                                                                <textarea 
                                                                    rows={2} 
                                                                    value={fileUpdateRemarks} 
                                                                    onChange={(e) => setFileUpdateRemarks(e.target.value)}
                                                                    placeholder="Enter comments for this document update..."
                                                                    required
                                                                    className={styles.textarea}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                                            <button 
                                                                type="button" 
                                                                className={`${styles.button} ${styles.btnSecondary}`}
                                                                onClick={() => setFileUpdateTarget(null)}
                                                            >
                                                                Cancel
                                                            </button>
                                                            <button 
                                                                type="submit" 
                                                                className={`${styles.button} ${styles.btnPrimary}`}
                                                                disabled={isFileUpdating || !fileUpdateFile || !fileUpdateRemarks.trim()}
                                                            >
                                                                {isFileUpdating ? 'Uploading...' : 'Confirm Upload'}
                                                            </button>
                                                        </div>
                                                    </form>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Section 3: Change History */}
                            <div className={styles.detailsSection} style={{ marginTop: '2rem' }}>
                                <h4 className={styles.sectionTitle}>Change History</h4>
                                {historyLoading ? (
                                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                                        <RefreshCw className="animate-spin" size={20} style={{ color: '#4f46e5' }} />
                                        <span style={{ marginLeft: '8px', color: '#64748b' }}>Loading logs...</span>
                                    </div>
                                ) : qmsHistoryList.length === 0 ? (
                                    <div className={styles.emptyHistory}>No update history available</div>
                                ) : (
                                    <div className={styles.tableContainer} style={{ maxHeight: '250px', overflowY: 'auto' }}>
                                        <table className={styles.table} style={{ fontSize: '0.85rem' }}>
                                            <thead>
                                                <tr>
                                                    <th>File Type</th>
                                                    <th>Previous Rev</th>
                                                    <th>New Rev</th>
                                                    <th>Updated By</th>
                                                    <th>Updated Date & Time</th>
                                                    <th>Remarks</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {qmsHistoryList.map(log => (
                                                    <tr key={log.id}>
                                                        <td style={{ fontWeight: 600, textTransform: 'uppercase' }}>
                                                            {log.file_type === 'xy' ? 'XY Data' : log.file_type}
                                                        </td>
                                                        <td>{log.previous_revision ? `Rev ${log.previous_revision}` : '—'}</td>
                                                        <td>
                                                            {log.file_type === 'bom' && log.bom_revision_id ? (
                                                                <span 
                                                                    className={`${styles.historyNewRevBadge}`} 
                                                                    onClick={() => navigate(`/smt/qms/bom-view/${log.bom_revision_id}`)}
                                                                    style={{ cursor: 'pointer', textDecoration: 'underline' }}
                                                                    title="Click to view BOM items for this revision"
                                                                >
                                                                    Rev {log.new_revision}
                                                                </span>
                                                            ) : (
                                                                <span className={styles.historyNewRevBadge}>Rev {log.new_revision}</span>
                                                            )}
                                                        </td>
                                                        <td>{log.uploaded_by}</td>
                                                        <td>{new Date(log.uploaded_at).toLocaleString()}</td>
                                                        <td style={{ fontStyle: 'italic', color: '#475569' }}>{log.remarks}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                            
                            {/* Delete record at bottom if Admin */}
                            <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem' }}>
                                <button 
                                    className={`${styles.button} ${styles.btnDanger}`} 
                                    onClick={async () => {
                                        if (selectedQmsRecord) {
                                            await handleDeleteQms(selectedQmsRecord.id);
                                            setSelectedQmsRecord(null);
                                        }
                                    }}
                                >
                                    <Trash2 size={16} style={{ marginRight: '6px' }} />
                                    Soft Delete Record
                                </button>
                            </div>

                        </div>
                    </div>
                </div>
            )}

            {/* Document Preview Modal */}
            {previewModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent} style={{ maxWidth: '900px', width: '95%' }}>
                        <div className={styles.modalHeader}>
                            <h3>Preview: {previewModal.originalName}</h3>
                            <button className={styles.closeModalBtn} onClick={() => setPreviewModal(null)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            {previewModal.isCsv ? (
                                <div className={styles.csvTableContainer}>
                                    <table className={styles.table} style={{ fontSize: '0.8rem' }}>
                                        <tbody>
                                            {csvPreviewData.map((row, rIdx) => (
                                                <tr key={rIdx}>
                                                    {row.map((cell, cIdx) => (
                                                        <td 
                                                            key={cIdx} 
                                                            style={{ 
                                                                padding: '0.5rem', 
                                                                fontWeight: rIdx === 0 ? '600' : 'normal',
                                                                backgroundColor: rIdx === 0 ? '#f1f5f9' : 'transparent' 
                                                            }}
                                                        >
                                                            {cell}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <iframe 
                                    className={styles.previewIframe} 
                                    src={previewModal.url} 
                                    title={previewModal.originalName}
                                />
                            )}
                        </div>
                        <div className={styles.modalFooter}>
                            <button className={`${styles.button} ${styles.btnSecondary}`} onClick={() => setPreviewModal(null)}>
                                Close Preview
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <Toaster toasts={toasts} onRemove={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />
        </div>
    );
};

export default Document;
