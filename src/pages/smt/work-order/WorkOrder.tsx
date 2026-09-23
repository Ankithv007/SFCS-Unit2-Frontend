import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSmtAuth } from '../../../context/SmtAuthContext';
import { useAuth } from '../../../hooks/useAuth';
import styles from './WorkOrder.module.css';
import { apiFetch } from '../../../utils/api';
import SMTCountDetailsModal from '../../../components/SMTCountDetailsModal';

// ─── Toaster ─────────────────────────────────────────────────────────────────
interface Toast { id: number; message: string; type: 'success' | 'error' | 'info'; }

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

const DescriptionCell: React.FC<{ text: string }> = ({ text }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    if (!text) return <td>-</td>;

    const words = text.split(' ');
    const isLong = words.length > 20;

    const displayText = isLong && !isExpanded
        ? words.slice(0, 20).join(' ') + '...'
        : text;

    return (
        <td style={{ maxWidth: '200px', whiteSpace: 'normal', wordWrap: 'break-word', lineHeight: '1.5' }}>
            {displayText}
            {isLong && (
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: '#2563eb',
                        cursor: 'pointer',
                        padding: 0,
                        marginLeft: '5px',
                        fontSize: '0.85rem',
                        fontWeight: 'bold',
                        textDecoration: 'underline'
                    }}
                >
                    {isExpanded ? 'Read Less' : 'Read More'}
                </button>
            )}
        </td>
    );
};



const ALL_STAGES = ['PTH', 'VI', 'QA', 'Flashing', 'PCBA-FCT', 'Assembly', 'Unit Testing', 'QI', 'Packing'];

const formatSidesDisplay = (side: string | null | undefined): string => {
    if (!side) return '-';
    const s = side.trim();
    if (s === 'Top / Bottom' || s === 'TOP/BOTTOM' || s === 'TOP / BOTTOM' || s.toLowerCase() === 'top/bottom' || s.toLowerCase() === 'top / bottom') {
        return 'TOP and BOTTOM';
    }
    if (s.toUpperCase() === 'TOP') return 'TOP';
    if (s.toUpperCase() === 'BOTTOM') return 'BOTTOM';
    return side;
};

export const WorkOrder: React.FC = () => {
    const { smtUser, smtLogout } = useSmtAuth();
    const { user } = useAuth();
    const navigate = useNavigate();
    const userRole = (user?.role || smtUser?.role || '').trim().toLowerCase();
    const canAccessPoDocument = userRole === 'super admin' || userRole === 'admin' || 
                                (smtUser?.role || '').trim().toLowerCase() === 'super admin' || 
                                (smtUser?.role || '').trim().toLowerCase() === 'admin' || 
                                smtUser?.userId === 'ADMIN';
    const isSuperAdmin = userRole === 'super admin' || (smtUser?.role || '').trim().toLowerCase() === 'super admin' || smtUser?.userId === 'ADMIN';
    const [workOrderId, setWorkOrderId] = useState('');
    const [poId, setPoId] = useState('');
    const [remark, setRemark] = useState('');
    const [remarkModal, setRemarkModal] = useState<{ workOrderId: string; remark: string } | null>(null);
    const [lineId, setLineId] = useState('SMT-1');
    const [productName, setProductName] = useState('');
    const [productDescription, setProductDescription] = useState('');
    const [quantity, setQuantity] = useState('');
    const [pcbPerPanel, setPcbPerPanel] = useState('');
    const [panelQuantity, setPanelQuantity] = useState('');
    const [sides, setSides] = useState('');
    const [priority, setPriority] = useState('medium');
    const [selectedStages, setSelectedStages] = useState<string[]>(ALL_STAGES);
    const [customerName, setCustomerName] = useState('');
    const [modelName, setModelName] = useState('');
    const [hasSmt, setHasSmt] = useState<boolean>(true);
    const [hasBackend, setHasBackend] = useState<boolean>(true);
    const [error, setError] = useState('');
    const [editingWorkOrderId, setEditingWorkOrderId] = useState<string | null>(null);
    const [viewDetailWo, setViewDetailWo] = useState<any | null>(null);

    const getCurrentUserName = (): string => {
        try {
            if (user?.name && user.name.trim()) return user.name.trim();
            if (smtUser?.name && smtUser.name.trim()) return smtUser.name.trim();

            const storedUserData = localStorage.getItem('user_data');
            if (storedUserData) {
                const parsed = JSON.parse(storedUserData);
                if (parsed?.name && String(parsed.name).trim()) return String(parsed.name).trim();
                if (parsed?.username && String(parsed.username).trim()) return String(parsed.username).trim();
            }

            const smtStored = localStorage.getItem('smtUser');
            if (smtStored) {
                const parsed = JSON.parse(smtStored);
                if (parsed?.name && String(parsed.name).trim()) return String(parsed.name).trim();
                if (parsed?.userId && String(parsed.userId).trim()) return String(parsed.userId).trim();
            }

            const headerName = localStorage.getItem('X-User-Name');
            if (headerName && headerName.trim()) return headerName.trim();

            const token = localStorage.getItem('auth_token');
            if (token) {
                const parts = token.split('.');
                if (parts.length >= 2) {
                    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
                    const decoded = JSON.parse(atob(base64));
                    if (decoded?.name && String(decoded.name).trim()) return String(decoded.name).trim();
                    if (decoded?.username && String(decoded.username).trim()) return String(decoded.username).trim();
                    if (decoded?.email && String(decoded.email).trim()) return String(decoded.email).trim();
                }
            }
        } catch {
            // ignore
        }
        return '';
    };

    const currentUserName = getCurrentUserName();
    const [createdBy, setCreatedBy] = useState(currentUserName);

    useEffect(() => {
        if (!editingWorkOrderId && currentUserName) {
            setCreatedBy(currentUserName);
        }
    }, [currentUserName, editingWorkOrderId]);

    const handleToggleAllStages = () => {
        if (selectedStages.length === ALL_STAGES.length) {
            setSelectedStages([]);
        } else {
            setSelectedStages([...ALL_STAGES]);
        }
    };

    const handleStageToggle = (stage: string) => {
        if (selectedStages.includes(stage)) {
            setSelectedStages(selectedStages.filter(s => s !== stage));
        } else {
            setSelectedStages([...selectedStages, stage]);
        }
    };

    const [workOrders, setWorkOrders] = useState<any[]>([]);
    const [selectedCount, setSelectedCount] = useState<{
        workOrderId: string;
        stage: string;
        type: string;
        label: string;
    } | null>(null);

    // Toast state
    const [toasts, setToasts] = useState<Toast[]>([]);
    const toastId = useRef(0);

    // Search and Pagination states
    const [searchQuery, setSearchQuery] = useState('');
    const [activeSearch, setActiveSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);
    const [totalRecords, setTotalRecords] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    
    // Loading states
    const [isLoading, setIsLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // File Upload state
    const [selectedFile, setSelectedFile] = useState<{
        name: string;
        type: string;
        size: number;
        data: string; // Base64 encoding
    } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // File Preview states
    const [previewWoId, setPreviewWoId] = useState<string | null>(null);
    const [previewData, setPreviewData] = useState<any | null>(null);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);

    const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
        const id = ++toastId.current;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    }, []);

    const removeToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

    useEffect(() => {
        fetchWorkOrders(currentPage, pageSize, activeSearch);
    }, [currentPage, pageSize, activeSearch]);

    // Auto-calculate Panel Quantity
    useEffect(() => {
        const qty = parseInt(quantity);
        const ppp = parseInt(pcbPerPanel);

        if (!isNaN(qty) && !isNaN(ppp) && ppp > 0) {
            setPanelQuantity(Math.ceil(qty / ppp).toString());
        } else {
            setPanelQuantity('');
        }
    }, [quantity, pcbPerPanel]);

    const fetchWorkOrders = async (page = 1, limit = 15, search = '') => {
        setIsLoading(true);
        try {
            const queryParams = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString()
            });
            if (search) {
                queryParams.append('search', search);
            }
            const responseData = await apiFetch(`/api/smt/work-orders?${queryParams.toString()}`);
            if (responseData.success) {
                const safeData = Array.isArray(responseData.data) 
                    ? responseData.data.filter((wo: any) => wo.has_smt !== false && wo.hasSmt !== false) 
                    : [];
                setWorkOrders(safeData.map((wo: any) => ({
                    work_order_id: wo.id || wo.work_order_id,
                    product_name: wo.product_name,
                    product_description: wo.product_description,
                    quantity: wo.quantity,
                    panel_quantity: wo.panel_quantity,
                    sides: wo.sides,
                    line_id: wo.line_id,
                    priority: wo.priority,
                    created_by: wo.created_by,
                    created_at: wo.created_at,
                    po_document_name: wo.po_document_name,
                    po_document_path: wo.po_document_path,
                    po_document_type: wo.po_document_type,
                    po_id: wo.po_id,
                    remark: wo.remark,
                    solder_paste_status: wo.solder_paste_status,
                    customer_name: wo.customer_name || wo.customerName || '',
                    model_name: wo.model_name || wo.modelName || wo.model || '',
                    has_smt: wo.has_smt !== false && wo.hasSmt !== false,
                    has_backend: wo.has_backend !== false && wo.hasBackend !== false,
                    selected_stages: wo.selected_stages || wo.selectedStages || ALL_STAGES
                })));
                setTotalRecords(responseData.total || 0);
                setTotalPages(responseData.totalPages || 0);
            } else {
                addToast(responseData.message || "Failed to load work orders", "error");
            }
        } catch (err: any) {
            console.error("Failed to fetch work orders:", err);
            addToast(err.message || "Failed to fetch work orders due to network issue", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSearch = () => {
        setActiveSearch(searchQuery);
        setCurrentPage(1); // Reset to page 1 on new search
    };

    const handleClearSearch = () => {
        setSearchQuery('');
        setActiveSearch('');
        setCurrentPage(1);
    };

    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        processFile(file);
    };

    const processFile = (file: File) => {
        const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        
        // Allowed Extensions Check
        const allowedExtensions = ['.pdf', '.xls', '.xlsx'];
        if (!allowedExtensions.includes(ext)) {
            addToast("Only PDF (.pdf) and Excel (.xls, .xlsx) files are allowed.", "error");
            return;
        }

        // Hardened Security Extensions Check
        const dangerousExtensions = ['.exe', '.bat', '.sh', '.js', '.php', '.py', '.msi'];
        if (dangerousExtensions.includes(ext)) {
            addToast("Blocked: Dangerous file extension detected.", "error");
            return;
        }

        // MIME Type Check
        const allowedMimes = [
            'application/pdf',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];
        if (!allowedMimes.includes(file.type)) {
            addToast("Invalid file type structure. Please upload PDF or Excel.", "error");
            return;
        }

        // File Size Limit check (5MB)
        if (file.size > 5 * 1024 * 1024) {
            addToast("File size exceeds the maximum limit of 5MB.", "error");
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            setSelectedFile({
                name: file.name,
                type: file.type,
                size: file.size,
                data: event.target?.result as string
            });
            addToast("Document attached successfully.", "success");
        };
        reader.onerror = () => {
            addToast("Failed to read the file.", "error");
        };
        reader.readAsDataURL(file);
    };

     const handleRemoveFile = (e: React.MouseEvent) => {
         e.stopPropagation();
         setSelectedFile(null);
         if (fileInputRef.current) {
             fileInputRef.current.value = '';
         }
     };

     const handleOpenLocalPreview = (e: React.MouseEvent) => {
         e.stopPropagation();
         if (!selectedFile) return;
         setPreviewWoId('__local__');
         if (selectedFile.type === 'application/pdf') {
             setPreviewData({
                 type: 'pdf',
                 url: selectedFile.data,
                 name: selectedFile.name
             });
         } else {
             setPreviewData({
                 type: 'local_excel',
                 name: selectedFile.name
             });
         }
     };

     const handleDownloadLocalFile = () => {
         if (!selectedFile) return;
         const a = document.createElement('a');
         a.href = selectedFile.data;
         a.download = selectedFile.name;
         document.body.appendChild(a);
         a.click();
         document.body.removeChild(a);
     };

    const handleCancelEdit = () => {
        setEditingWorkOrderId(null);
        setWorkOrderId('');
        setPoId('');
        setRemark('');
        setProductName('');
        setProductDescription('');
        setQuantity('');
        setPcbPerPanel('');
        setPanelQuantity('');
        setSides('');
        setPriority('medium');
        setSelectedStages(ALL_STAGES);
        setCustomerName('');
        setModelName('');
        setHasSmt(true);
        setHasBackend(true);
        setCreatedBy(currentUserName);
        setSelectedFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        setError('');
    };

    const handleEditClick = (wo: any) => {
        setEditingWorkOrderId(wo.work_order_id);
        setWorkOrderId(wo.work_order_id);
        setCreatedBy(wo.created_by || '');
        setPoId(wo.po_id);
        setRemark(wo.remark || '');
        setLineId(wo.line_id);
        setPriority(wo.priority);
        setProductName(wo.product_name);
        setProductDescription(wo.product_description);
        setQuantity(wo.quantity.toString());
        setCustomerName(wo.customer_name || wo.customerName || '');
        setModelName(wo.model_name || wo.modelName || wo.model || '');
        setHasSmt(wo.has_smt !== false && wo.hasSmt !== false);
        setHasBackend(wo.has_backend !== false && wo.hasBackend !== false);
        setSelectedStages(
            Array.isArray(wo.selected_stages) 
                ? wo.selected_stages 
                : Array.isArray(wo.selectedStages)
                ? wo.selectedStages
                : ALL_STAGES
        );
        
        const computedPpp = wo.panel_quantity > 0 ? Math.round(wo.quantity / wo.panel_quantity) : 1;
        setPcbPerPanel(computedPpp.toString());
        setPanelQuantity(wo.panel_quantity.toString());
        setSides(wo.sides || '');
        
        if (wo.po_document_name) {
            setSelectedFile({
                name: wo.po_document_name,
                type: wo.po_document_type || '',
                size: 0,
                data: '' // Keep as blank to represent "existing file, unmodified"
            });
        } else {
            setSelectedFile(null);
        }
        
        setError('');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCreateWorkOrder = async () => {
        // Validation & Normalization
        const finalWorkOrderId = workOrderId.trim().toUpperCase();
        if (!finalWorkOrderId) {
            setError('Work Order ID is required.');
            return;
        }
        if (finalWorkOrderId.length < 3 || finalWorkOrderId.length > 50) {
            setError('Work Order ID must be between 3 and 50 characters.');
            return;
        }
        if (!/^[A-Z0-9\-_]+$/.test(finalWorkOrderId)) {
            setError('Work Order ID can only contain letters, numbers, hyphens (-), and underscores (_).');
            return;
        }

        const finalPoId = poId.trim();
        if (!finalPoId) {
            setError('PO ID is required.');
            return;
        }
        if (!/^[a-zA-Z0-9\-_]+$/.test(finalPoId)) {
            setError('PO ID can only contain letters, numbers, hyphens (-), and underscores (_).');
            return;
        }

        const finalCreatedBy = editingWorkOrderId ? createdBy : (currentUserName || createdBy);
        if (!productName || !productDescription || !quantity || !finalCreatedBy) {
            setError('All fields are required.');
            return;
        }
        if (hasSmt && !panelQuantity) {
            setError('Panel Quantity is required when SMT is enabled.');
            return;
        }
        if (parseInt(quantity) <= 0 || (hasSmt && parseInt(panelQuantity) <= 0)) {
            setError('Quantities must be greater than 0.');
            return;
        }

        if (!customerName.trim()) {
            setError('Customer Name is required.');
            return;
        }

        if (!modelName.trim()) {
            setError('Model Name is required.');
            return;
        }

        if (!hasSmt && !hasBackend) {
            setError('Please select at least one process: SMT or Backend.');
            return;
        }

        if (hasSmt && !sides) {
            setError('Sides is required when SMT is enabled.');
            return;
        }

        if (hasBackend && selectedStages.length === 0) {
            setError('At least one backend production stage must be selected when Backend is enabled.');
            return;
        }

        setError('');
        setIsCreating(true);

        const activeBackendStages = hasBackend ? selectedStages : [];

        const payload: any = {
            work_order_id: finalWorkOrderId,
            po_id: finalPoId,
            remark: remark,
            area_id: 'SMT',
            line_id: hasSmt ? lineId : 'N/A',
            product_name: productName,
            product_description: productDescription,
            quantity: parseInt(quantity),
            panel_quantity: hasSmt && panelQuantity ? parseInt(panelQuantity) : parseInt(quantity),
            sides: hasSmt ? sides : 'N/A',
            priority: priority,
            created_by: finalCreatedBy,
            customer_name: customerName.trim(),
            customerName: customerName.trim(),
            model_name: modelName.trim(),
            modelName: modelName.trim(),
            model: modelName.trim(),
            has_smt: Boolean(hasSmt),
            hasSmt: Boolean(hasSmt),
            has_backend: Boolean(hasBackend),
            hasBackend: Boolean(hasBackend),
            selected_stages: activeBackendStages,
            selectedStages: activeBackendStages
        };

        if (selectedFile) {
            if (selectedFile.data) {
                payload.po_document = selectedFile;
            } else {
                payload.po_document = undefined;
            }
        } else {
            payload.po_document = null;
        }

        try {
            const url = editingWorkOrderId 
                ? `/api/smt/work-orders/${editingWorkOrderId}` 
                : '/api/smt/work-orders';
            const method = editingWorkOrderId ? 'PUT' : 'POST';

            const data = await apiFetch(url, {
                method: method,
                body: JSON.stringify(payload)
            });

            if (data.success) {
                addToast(editingWorkOrderId ? "Work Order updated successfully." : "Work Order created successfully.", "success");
                
                // Clear Form
                handleCancelEdit();

                // Reset search and return to page 1
                setSearchQuery('');
                setActiveSearch('');
                setCurrentPage(1);
                fetchWorkOrders(1, pageSize, '');
            } else {
                setError(`Failed to ${editingWorkOrderId ? 'update' : 'create'} Work Order: ${data.message || 'Unknown error'}`);
            }
        } catch (err: any) {
            console.error("API error:", err);
            setError(err.message || 'Error connecting to backend API.');
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteWorkOrder = async (id: string) => {
        if (!isSuperAdmin) {
            addToast("Only Super Admin is authorized to delete records.\nPlease contact your Super Admin if this record needs to be deleted.", "error");
            return;
        }
        if (!window.confirm(`Are you sure you want to delete Work Order ${id}? This will also delete all associated serial numbers, inspections, and PO document files.`)) {
            return;
        }

        setDeletingId(id);
        try {
            const res = await apiFetch(`/api/smt/work-orders/${id}`, {
                method: 'DELETE'
            });

            addToast(res.message || "Work Order deleted successfully.", "success");
            fetchWorkOrders(currentPage, pageSize, activeSearch);
        } catch (err: any) {
            console.error("Delete error:", err);
            if (err.message === 'Work order not found') {
                fetchWorkOrders(currentPage, pageSize, activeSearch);
            } else {
                alert(`Failed to delete: ${err.message || 'Unknown error'}`);
            }
        } finally {
            setDeletingId(null);
        }
    };

    const handleOpenPreview = async (id: string) => {
        if (!canAccessPoDocument) {
            addToast("Access Denied: Only Super Admin and Admin can access PO documents.", "error");
            return;
        }
        setPreviewWoId(id);
        setIsPreviewLoading(true);
        setPreviewData(null);
        try {
            const data = await apiFetch(`/api/smt/work-orders/${id}/preview-po`);
            if (data.success) {
                setPreviewData(data);
            } else {
                addToast(data.message || "Failed to load document preview.", "error");
                setPreviewWoId(null);
            }
        } catch (err: any) {
            console.error("Preview error:", err);
            addToast(err.message || "Failed to fetch preview details.", "error");
            setPreviewWoId(null);
        } finally {
            setIsPreviewLoading(false);
        }
    };

    const handleClosePreview = () => {
        setPreviewWoId(null);
        setPreviewData(null);
    };

    const handleDownloadPo = async (id: string, fileName: string) => {
        if (!canAccessPoDocument) {
            addToast("Access Denied: Only Super Admin and Admin can access PO documents.", "error");
            return;
        }
        try {
            addToast("Starting download...", "info");
            const responseData = await apiFetch(`/api/smt/work-orders/${id}/download-po`);
            const blob = responseData instanceof Blob ? responseData : new Blob([responseData]);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = fileName || 'po_document';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            addToast("File downloaded successfully.", "success");
        } catch (err: any) {
            addToast(err.message || "Failed to download file.", "error");
        }
    };

    const handleViewClick = async (wo: any) => {
        setViewDetailWo(wo);
        try {
            const targetId = wo.work_order_id || wo.id;
            if (targetId) {
                const res = await apiFetch(`/api/smt/work-orders/${targetId}`);
                if (res && res.success && res.data) {
                    setViewDetailWo((prev: any) => ({
                        ...prev,
                        ...res.data,
                        work_order_id: res.data.id || res.data.work_order_id || prev?.work_order_id
                    }));
                }
            }
        } catch (e) {
            // Keep existing wo data
        }
    };

    return (
        <>
            <Toaster toasts={toasts} onRemove={removeToast} />
            <div className={styles.container}>
                <div className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2>📝 Work Order</h2>
                        <p>Manage SMT Work Orders.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            className={styles.secondaryButton}
                            onClick={() => navigate('/smt/workorder-history', { state: { areaId: 'SMT' } })}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                            <span>📊</span> View History
                        </button>
                        <button
                            onClick={() => {
                                if (window.confirm("Are you sure you want to logout from SMT?")) {
                                    smtLogout();
                                }
                            }}
                            className={styles.secondaryButton}
                            style={{ borderColor: '#ef4444', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                            <span>🔒</span> Logout SMT
                        </button>
                    </div>
                </div>

                <div className={styles.card}>
                    <h3>{editingWorkOrderId ? `Edit Work Order: ${editingWorkOrderId}` : 'Create New Work Order'}</h3>

                    {error && <div style={{ color: 'var(--error-color)', marginBottom: '1rem', fontWeight: 'bold' }}>{error}</div>}

                    <div className={styles.formGrid} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                        {/* --- ROW 1 --- */}
                        <div className={styles.inputGroup} style={{ gridColumn: 'span 2' }}>
                            <label>Work Order ID *</label>
                            <input
                                type="text"
                                value={workOrderId}
                                onChange={(e) => setWorkOrderId(e.target.value)}
                                placeholder="e.g. WO2026060200016"
                                className={styles.input}
                                style={{ height: '42px', boxSizing: 'border-box', ...(editingWorkOrderId ? { backgroundColor: '#e9ecef', color: '#6c757d', cursor: 'not-allowed' } : {}) }}
                                spellCheck={false}
                                autoComplete="off"
                                autoCorrect="off"
                                autoCapitalize="none"
                                disabled={!!editingWorkOrderId}
                            />
                        </div>

                        <div className={styles.inputGroup} style={{ gridColumn: 'span 2' }}>
                            <label>PO ID *</label>
                            <input
                                type="text"
                                value={poId}
                                onChange={(e) => setPoId(e.target.value)}
                                placeholder="e.g. PO-2026-1001"
                                className={styles.input}
                                style={{ height: '42px', boxSizing: 'border-box' }}
                                spellCheck={false}
                                autoComplete="off"
                                autoCorrect="off"
                                autoCapitalize="none"
                            />
                        </div>

                        {/* --- ROW 2 --- */}
                        <div className={styles.inputGroup}>
                            <label>Area ID</label>
                            <input
                                type="text"
                                value="SMT"
                                disabled
                                style={{ height: '42px', boxSizing: 'border-box', backgroundColor: '#e9ecef', color: '#6c757d', fontWeight: 'bold' }}
                                className={styles.input}
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label>Line ID {hasSmt ? '*' : '(Disabled)'}</label>
                            <select
                                value={lineId}
                                onChange={(e) => setLineId(e.target.value)}
                                className={styles.select}
                                style={{
                                    height: '42px',
                                    boxSizing: 'border-box',
                                    backgroundColor: hasSmt ? '#ffffff' : '#f3f4f6',
                                    color: hasSmt ? 'inherit' : '#9ca3af',
                                    cursor: hasSmt ? 'pointer' : 'not-allowed'
                                }}
                                disabled={!hasSmt}
                            >
                                <option value="SMT-1">SMT-1</option>
                                <option value="SMT-2">SMT-2</option>
                                <option value="SMT-3">SMT-3</option>
                            </select>
                        </div>

                        <div className={styles.inputGroup}>
                            <label>Priority *</label>
                            <select
                                value={priority}
                                onChange={(e) => setPriority(e.target.value)}
                                className={styles.select}
                                style={{ height: '42px', boxSizing: 'border-box' }}
                            >
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                            </select>
                        </div>

                        <div className={styles.inputGroup}>
                            <label>Created By *</label>
                            <input
                                type="text"
                                value={createdBy}
                                placeholder="Logged in user"
                                className={styles.input}
                                style={{
                                    height: '42px',
                                    boxSizing: 'border-box',
                                    backgroundColor: '#f3f4f6',
                                    color: '#6b7280',
                                    cursor: 'not-allowed',
                                    fontWeight: 'bold'
                                }}
                                readOnly
                            />
                        </div>

                        {/* --- ROW 3 --- */}
                        <div className={styles.inputGroup} style={{ gridColumn: 'span 2' }}>
                            <label>Product Name *</label>
                            <input
                                type="text"
                                value={productName}
                                onChange={(e) => setProductName(e.target.value)}
                                placeholder="e.g. Sensor Board v2"
                                className={styles.input}
                                style={{ boxSizing: 'border-box' }}
                            />
                        </div>

                        <div className={styles.inputGroup} style={{ gridColumn: 'span 2' }}>
                            <label>Product Description *</label>
                            <textarea
                                value={productDescription}
                                onChange={(e) => setProductDescription(e.target.value)}
                                placeholder="Enter product description"
                                className={styles.input}
                                style={{ boxSizing: 'border-box', minHeight: '80px', resize: 'vertical' }}
                            />
                        </div>

                        {/* --- ROW 3B: CUSTOMER & MODEL DETAILS --- */}
                        <div className={styles.inputGroup} style={{ gridColumn: 'span 2' }}>
                            <label>Customer Name *</label>
                            <input
                                type="text"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                placeholder="e.g. Acme Corp / Customer Name"
                                className={styles.input}
                                style={{ height: '42px', boxSizing: 'border-box' }}
                            />
                        </div>

                        <div className={styles.inputGroup} style={{ gridColumn: 'span 2' }}>
                            <label>Model Name *</label>
                            <input
                                type="text"
                                value={modelName}
                                onChange={(e) => setModelName(e.target.value)}
                                placeholder="e.g. SENSOR-V2-REV3"
                                className={styles.input}
                                style={{ height: '42px', boxSizing: 'border-box' }}
                            />
                        </div>

                        {/* --- ROW 4 --- */}
                        <div className={styles.inputGroup}>
                            <label>Quantity *</label>
                            <input
                                type="number"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                placeholder="e.g. 1000"
                                min="1"
                                className={styles.input}
                                style={{ boxSizing: 'border-box' }}
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label>PCB per Panel {hasSmt ? '*' : '(Disabled)'}</label>
                            <input
                                type="number"
                                value={pcbPerPanel}
                                onChange={(e) => setPcbPerPanel(e.target.value)}
                                placeholder={hasSmt ? "e.g. 2" : "N/A"}
                                min="1"
                                className={styles.input}
                                style={{
                                    boxSizing: 'border-box',
                                    backgroundColor: hasSmt ? '#ffffff' : '#f3f4f6',
                                    color: hasSmt ? 'inherit' : '#9ca3af',
                                    cursor: hasSmt ? 'text' : 'not-allowed'
                                }}
                                disabled={!hasSmt}
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label>Panel Quantity (Auto)</label>
                            <input
                                type="number"
                                value={panelQuantity}
                                readOnly
                                placeholder={hasSmt ? "Calculated Automatically" : "N/A"}
                                className={styles.input}
                                style={{
                                    boxSizing: 'border-box',
                                    backgroundColor: '#f3f4f6',
                                    color: '#6b7280',
                                    cursor: 'not-allowed',
                                    fontWeight: 'bold'
                                }}
                                disabled={!hasSmt}
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label>Sides {hasSmt ? '*' : '(Disabled)'}</label>
                            <select
                                value={sides}
                                onChange={(e) => setSides(e.target.value)}
                                className={styles.select}
                                style={{
                                    height: '42px',
                                    boxSizing: 'border-box',
                                    backgroundColor: hasSmt ? '#ffffff' : '#f3f4f6',
                                    color: hasSmt ? 'inherit' : '#9ca3af',
                                    cursor: hasSmt ? 'pointer' : 'not-allowed'
                                }}
                                disabled={!hasSmt}
                            >
                                <option value="">Select Sides</option>
                                <option value="Top">TOP</option>
                                <option value="Bottom">BOTTOM</option>
                                <option value="Top / Bottom">TOP and BOTTOM</option>
                                {sides === 'TOP' && <option value="TOP" style={{ display: 'none' }}>TOP</option>}
                                {sides === 'BOTTOM' && <option value="BOTTOM" style={{ display: 'none' }}>BOTTOM</option>}
                                {sides === 'TOP/BOTTOM' && <option value="TOP/BOTTOM" style={{ display: 'none' }}>TOP and BOTTOM</option>}
                            </select>
                        </div>

                        {/* --- ROW 5: PO Document & Remark Side-by-Side --- */}
                        <div style={{
                            gridColumn: 'span 4',
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                            gap: '1.25rem',
                            marginTop: '0.5rem',
                            alignItems: 'stretch'
                        }}>
                            {/* Left Column: Upload PO Document */}
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <label style={{ fontSize: '0.95rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>
                                    Upload PO Document
                                </label>
                                <div 
                                    className={`${styles.uploadZone} ${selectedFile ? styles.uploadZoneActive : ''}`}
                                    onClick={() => fileInputRef.current?.click()}
                                    style={{ 
                                        flex: 1, 
                                        display: 'flex', 
                                        flexDirection: 'column', 
                                        justifyContent: 'center', 
                                        padding: '0.5rem', 
                                        minHeight: '80px',
                                        boxSizing: 'border-box'
                                    }}
                                >
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        accept=".pdf,.xls,.xlsx"
                                        style={{ display: 'none' }}
                                    />
                                    <span className={styles.uploadIcon} style={{ fontSize: '1.1rem', marginBottom: '2px' }}>📤</span>
                                    <span className={styles.uploadText} style={{ fontSize: '0.75rem' }}>
                                        <strong>Drop PDF or Excel file here (Max 5 MB)</strong>
                                    </span>
                                    <span className={styles.uploadSubtext} style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                        PDF / Excel • 5MB max
                                    </span>
                                </div>
                                {selectedFile && (
                                    <div className={styles.fileDisplay} style={{ marginTop: '0.5rem', boxSizing: 'border-box' }}>
                                        <div className={styles.fileInfo}>
                                            {selectedFile.type === 'application/pdf' ? (
                                                <span className={`${styles.fileTypeIcon} ${styles.pdfColor}`} style={{ fontSize: '0.75rem', padding: '1px 4px' }}>📕 PDF</span>
                                            ) : (
                                                <span className={`${styles.fileTypeIcon} ${styles.excelColor}`} style={{ fontSize: '0.75rem', padding: '1px 4px' }}>📗 Excel</span>
                                            )}
                                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                                <span className={styles.fileName} style={{ fontSize: '0.75rem', fontWeight: 600, maxWidth: '150px' }} title={selectedFile.name}>{selectedFile.name}</span>
                                                <span className={styles.fileSize} style={{ fontSize: '0.65rem' }}>
                                                    {(selectedFile.size / 1024).toFixed(1)} KB
                                                </span>
                                            </div>
                                        </div>
                                        <div className={styles.fileActions}>
                                            <button 
                                                type="button" 
                                                className={styles.secondaryButton}
                                                style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '3px' }}
                                                onClick={handleOpenLocalPreview}
                                            >
                                                👁️ View
                                            </button>
                                            <button 
                                                type="button" 
                                                className={styles.secondaryButton}
                                                style={{ borderColor: '#ef4444', color: '#ef4444', padding: '0.15rem 0.4rem', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '3px' }}
                                                onClick={handleRemoveFile}
                                            >
                                                ❌ Remove
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Right Column: Remark */}
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <label style={{ fontSize: '0.95rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>
                                    Remark
                                </label>
                                <textarea
                                    value={remark}
                                    onChange={(e) => setRemark(e.target.value)}
                                    placeholder="Enter work order remarks"
                                    className={styles.input}
                                    style={{ 
                                        boxSizing: 'border-box', 
                                        flex: 1, 
                                        minHeight: '80px', 
                                        resize: 'vertical',
                                        fontSize: '0.875rem',
                                        padding: '0.5rem'
                                    }}
                                />
                            </div>
                        </div>

                        {/* --- PROCESS ROUTING / STAGE SELECTION CARD --- */}
                        <div style={{
                            gridColumn: 'span 4',
                            marginTop: '1.25rem',
                            backgroundColor: '#ffffff',
                            borderRadius: '0.75rem',
                            border: '1px solid #e2e8f0',
                            padding: '1.25rem',
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                            boxSizing: 'border-box'
                        }}>
                            {/* Card Header */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '0.75rem',
                                flexWrap: 'wrap',
                                gap: '0.75rem'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <span style={{ fontSize: '1.2rem' }}>🔀</span>
                                    <div>
                                        <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#1e293b' }}>
                                            Backend Process Routing / Stage Selection
                                        </h4>
                                        <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>
                                            Select the quality check and production stages required for this Work Order. Process steps execute strictly in ascending order.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleToggleAllStages}
                                    disabled={!hasBackend}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.35rem',
                                        padding: '0.35rem 0.75rem',
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        color: hasBackend ? '#dc2626' : '#94a3b8',
                                        backgroundColor: hasBackend ? '#fef2f2' : '#f1f5f9',
                                        border: `1px solid ${hasBackend ? '#fca5a5' : '#cbd5e1'}`,
                                        borderRadius: '0.375rem',
                                        cursor: hasBackend ? 'pointer' : 'not-allowed',
                                        opacity: hasBackend ? 1 : 0.6,
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    <span style={{ fontSize: '0.85rem' }}>❌</span>
                                    {selectedStages.length === ALL_STAGES.length ? 'Deselect All' : 'Select All'}
                                </button>
                            </div>

                            {/* Stage Pills / Chips (Strictly Horizontal Flow with Lockout Support) */}
                            <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '0.75rem',
                                marginTop: '0.75rem',
                                alignItems: 'center',
                                opacity: hasBackend ? 1 : 0.45,
                                pointerEvents: hasBackend ? 'auto' : 'none',
                                filter: hasBackend ? 'none' : 'grayscale(100%)',
                                transition: 'all 0.2s ease'
                            }}>
                                {ALL_STAGES.map(stage => {
                                    const isSelected = hasBackend && selectedStages.includes(stage);
                                    return (
                                        <label
                                            key={stage}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                padding: '0.5rem 0.85rem',
                                                borderRadius: '0.5rem',
                                                fontSize: '0.875rem',
                                                fontWeight: 600,
                                                cursor: hasBackend ? 'pointer' : 'not-allowed',
                                                userSelect: 'none',
                                                transition: 'all 0.15s ease-in-out',
                                                backgroundColor: isSelected ? '#eff6ff' : '#f8fafc',
                                                color: isSelected ? '#1d4ed8' : '#475569',
                                                border: isSelected ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                                                boxShadow: isSelected ? '0 1px 2px rgba(37, 99, 235, 0.12)' : 'none'
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                disabled={!hasBackend}
                                                onChange={() => handleStageToggle(stage)}
                                                style={{
                                                    width: '16px',
                                                    height: '16px',
                                                    accentColor: '#2563eb',
                                                    cursor: hasBackend ? 'pointer' : 'not-allowed'
                                                }}
                                            />
                                            <span>{stage}</span>
                                        </label>
                                    );
                                })}
                            </div>

                            {/* Visual Configured Process Route */}
                            {hasBackend ? (
                                selectedStages.length > 0 ? (
                                    <div style={{
                                        marginTop: '0.85rem',
                                        padding: '0.65rem 0.9rem',
                                        background: '#f0fdf4',
                                        borderRadius: '0.5rem',
                                        border: '1px solid #bbf7d0',
                                        fontSize: '0.85rem'
                                    }}>
                                        <div style={{ fontWeight: 700, color: '#166534', marginBottom: '0.35rem' }}>
                                            Configured Process Route ({ALL_STAGES.filter(s => selectedStages.includes(s)).length} stages active):
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem' }}>
                                            {ALL_STAGES.filter(s => selectedStages.includes(s)).map((st, idx, arr) => (
                                                <React.Fragment key={st}>
                                                    <span style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '0.25rem',
                                                        padding: '2px 8px',
                                                        borderRadius: '4px',
                                                        backgroundColor: '#dcfce7',
                                                        color: '#166534',
                                                        fontWeight: 600,
                                                        fontSize: '0.8rem',
                                                        border: '1px solid #86efac'
                                                    }}>
                                                        <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>{idx + 1}.</span> {st}
                                                    </span>
                                                    {idx < arr.length - 1 && (
                                                        <span style={{ color: '#22c55e', fontWeight: 'bold', fontSize: '0.9rem' }}>→</span>
                                                    )}
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{
                                        marginTop: '0.85rem',
                                        padding: '0.65rem 0.9rem',
                                        background: '#fef2f2',
                                        borderRadius: '0.5rem',
                                        border: '1px solid #fecaca',
                                        fontSize: '0.85rem',
                                        color: '#b91c1c',
                                        fontWeight: 600
                                    }}>
                                        ⚠️ At least one stage must be selected for Backend Process Routing.
                                    </div>
                                )
                            ) : (
                                <div style={{
                                    marginTop: '0.85rem',
                                    padding: '0.65rem 0.9rem',
                                    background: '#f8fafc',
                                    borderRadius: '0.5rem',
                                    border: '1px solid #e2e8f0',
                                    fontSize: '0.85rem',
                                    color: '#64748b',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem'
                                }}>
                                    🔒 Backend process disabled for this Work Order.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* --- PROCESS SELECTION BAR (MOVED TO BOTTOM) --- */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1.25rem',
                        marginTop: '1.5rem',
                        marginBottom: '0.5rem',
                        padding: '0.85rem 1.25rem',
                        backgroundColor: '#f8fafc',
                        borderRadius: '0.5rem',
                        border: '1px solid #e2e8f0',
                        flexWrap: 'wrap'
                    }}>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>
                            Process Selection *:
                        </span>
                        <label style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            cursor: 'pointer',
                            fontWeight: 700,
                            fontSize: '0.95rem',
                            color: hasSmt ? '#1d4ed8' : '#64748b',
                            backgroundColor: hasSmt ? '#eff6ff' : '#ffffff',
                            padding: '0.35rem 0.75rem',
                            borderRadius: '0.375rem',
                            border: `1.5px solid ${hasSmt ? '#2563eb' : '#cbd5e1'}`,
                            transition: 'all 0.15s ease'
                        }}>
                            <input
                                type="checkbox"
                                id="hasSmtProcessCheckbox"
                                checked={hasSmt}
                                onChange={(e) => setHasSmt(e.target.checked)}
                                style={{ width: '18px', height: '18px', accentColor: '#2563eb', cursor: 'pointer' }}
                            />
                            <span>⚡ SMT</span>
                        </label>
                        <label style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            cursor: 'pointer',
                            fontWeight: 700,
                            fontSize: '0.95rem',
                            color: hasBackend ? '#1d4ed8' : '#64748b',
                            backgroundColor: hasBackend ? '#eff6ff' : '#ffffff',
                            padding: '0.35rem 0.75rem',
                            borderRadius: '0.375rem',
                            border: `1.5px solid ${hasBackend ? '#2563eb' : '#cbd5e1'}`,
                            transition: 'all 0.15s ease'
                        }}>
                            <input
                                type="checkbox"
                                id="hasBackendProcessCheckbox"
                                checked={hasBackend}
                                onChange={(e) => setHasBackend(e.target.checked)}
                                style={{ width: '18px', height: '18px', accentColor: '#2563eb', cursor: 'pointer' }}
                            />
                            <span>🔀 Backend</span>
                        </label>
                        {!hasSmt && (
                            <span style={{ fontSize: '0.85rem', color: '#b45309', backgroundColor: '#fef3c7', padding: '3px 8px', borderRadius: '4px', border: '1px solid #fde68a', fontWeight: 600 }}>
                                ⚠️ SMT process disabled for this Work Order.
                            </span>
                        )}
                        {!hasBackend && (
                            <span style={{ fontSize: '0.85rem', color: '#b45309', backgroundColor: '#fef3c7', padding: '3px 8px', borderRadius: '4px', border: '1px solid #fde68a', fontWeight: 600 }}>
                                ⚠️ Backend process disabled for this Work Order.
                            </span>
                        )}
                    </div>

                    <div className={styles.actions} style={{ marginTop: '1.25rem', display: 'flex', gap: '10px' }}>
                        <button 
                            className={`${styles.button} ${isCreating ? styles.buttonWithSpinner : ''}`} 
                            onClick={handleCreateWorkOrder}
                            disabled={isCreating}
                        >
                            {isCreating ? (
                                <>
                                    <span className={styles.spinner}></span> Saving...
                                </>
                            ) : (
                                editingWorkOrderId ? 'Save Changes' : 'Create Work Order'
                            )}
                        </button>
                        {editingWorkOrderId && (
                            <button
                                className={styles.secondaryButton}
                                onClick={handleCancelEdit}
                                disabled={isCreating}
                                style={{ height: '42px' }}
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                </div>

                <div className={styles.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                        <h3>Created Work Orders</h3>
                        
                        {/* Search Bar section */}
                        <div className={styles.searchBar}>
                            <div className={styles.searchWrapper}>
                                <span className={styles.searchIcon}>🔍</span>
                                <input
                                    type="text"
                                    placeholder="Search by Work Order ID..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleSearch();
                                        }
                                    }}
                                    className={styles.searchInput}
                                    disabled={isLoading}
                                />
                            </div>
                            <button className={styles.searchBtn} onClick={handleSearch} disabled={isLoading}>
                                Search
                            </button>
                            {(activeSearch || searchQuery) && (
                                <button className={styles.clearBtn} onClick={handleClearSearch} disabled={isLoading}>
                                    Clear
                                </button>
                            )}
                        </div>
                    </div>

                    {isLoading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4rem 0', gap: '1rem' }}>
                            <div className={styles.darkSpinner}></div>
                            <div style={{ color: '#64748b', fontSize: '0.95rem' }}>Loading work orders...</div>
                        </div>
                    ) : (
                        <>
                            <div className={styles.tableContainer}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>WORK ORDER ID</th>
                                            <th>PO ID</th>
                                            <th>PRODUCT NAME</th>
                                            <th>PRODUCT DESCRIPTION</th>
                                            <th>SIDES</th>
                                            <th>QUANTITY</th>
                                            <th>PANEL QTY</th>
                                            {canAccessPoDocument && <th style={{ textAlign: 'center' }}>PO DOCUMENT</th>}
                                            <th>ACTION</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {workOrders.map((wo, index) => (
                                            <tr key={index}>
                                                <td style={{ fontWeight: 600 }}>{wo.work_order_id}</td>
                                                <td style={{ fontWeight: 500, color: '#374151' }}>{wo.po_id || '-'}</td>
                                                <td>{wo.product_name}</td>
                                                <DescriptionCell text={wo.product_description} />
                                                <td style={{ fontWeight: 500, color: '#475569' }}>{formatSidesDisplay(wo.sides)}</td>
                                                <td 
                                                    className="smt-clickable-count smt-total" 
                                                    onClick={() => setSelectedCount({
                                                        workOrderId: wo.work_order_id,
                                                        stage: 'Work Order',
                                                        type: 'total',
                                                        label: 'Total Quantity'
                                                    })}
                                                >
                                                    {wo.quantity}
                                                </td>
                                                <td 
                                                    className="smt-clickable-count smt-panel-count" 
                                                    onClick={() => setSelectedCount({
                                                        workOrderId: wo.work_order_id,
                                                        stage: 'Work Order',
                                                        type: 'total',
                                                        label: 'Panel Quantity'
                                                    })}
                                                >
                                                    {wo.panel_quantity}
                                                </td>
                                                 {canAccessPoDocument && (
                                                     <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                                         {(wo.po_document_path || wo.po_document_name) ? (
                                                             <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flexWrap: 'nowrap' }}>
                                                                 {(wo.po_document_type === 'application/pdf' || wo.po_document_name?.toLowerCase().endsWith('.pdf')) ? (
                                                                     <span style={{ fontSize: '1.2rem', cursor: 'default' }} title="PDF Document">📕</span>
                                                                 ) : (
                                                                     <span style={{ fontSize: '1.2rem', cursor: 'default' }} title="Excel Spreadsheet">📗</span>
                                                                 )}
                                                                 <button
                                                                     className={styles.compactIconBtn}
                                                                     title="View PO Document"
                                                                     onClick={() => handleOpenPreview(wo.work_order_id || wo.id)}
                                                                 >
                                                                     👁️
                                                                 </button>
                                                                 <button
                                                                     className={styles.compactIconBtn}
                                                                     title="Download PO Document"
                                                                     onClick={() => handleDownloadPo(wo.work_order_id || wo.id, wo.po_document_name)}
                                                                 >
                                                                     📥
                                                                 </button>
                                                             </div>
                                                         ) : (
                                                             <span style={{ color: '#94a3b8' }}>-</span>
                                                         )}
                                                     </td>
                                                 )}
                                                <td>
                                                    <div style={{ display: 'flex', gap: '6px' }}>
                                                        <button
                                                            onClick={() => handleViewClick(wo)}
                                                            className={styles.secondaryButton}
                                                            style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', border: '1px solid #4b5563', color: '#4b5563' }}
                                                        >
                                                            👁️ View
                                                        </button>
                                                        <button
                                                            onClick={() => handleEditClick(wo)}
                                                            className={styles.secondaryButton}
                                                            style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', borderColor: '#4f46e5', color: '#4f46e5' }}
                                                        >
                                                            ✏️ Edit
                                                        </button>

                                                        {isSuperAdmin && (
                                                            <button
                                                                onClick={() => handleDeleteWorkOrder(wo.work_order_id)}
                                                                className={styles.deleteButton}
                                                                disabled={deletingId === wo.work_order_id}
                                                                style={{ opacity: deletingId === wo.work_order_id ? 0.5 : 1, padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                                                            >
                                                                {deletingId === wo.work_order_id ? '...' : '🗑️'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Empty states handling */}
                            {workOrders.length === 0 && (
                                <div className={styles.emptyState}>
                                    <span style={{ fontSize: '2.5rem' }}>🔍</span>
                                    <h4 className={styles.emptyStateTitle}>
                                        {activeSearch ? 'No matching Work Orders found' : 'No Work Orders Found'}
                                    </h4>
                                    <p style={{ margin: 0, fontSize: '0.9rem' }}>
                                        {activeSearch ? 'Try revising your search term or clearing the filter.' : 'Create a new work order to get started.'}
                                    </p>
                                </div>
                            )}

                            {/* Pagination controls layout */}
                            {totalPages > 0 && (
                                <div className={styles.paginationSection}>
                                    <div className={styles.paginationInfo}>
                                        Showing {workOrders.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to {Math.min(currentPage * pageSize, totalRecords)} of {totalRecords} records
                                    </div>
                                    <div className={styles.paginationControls}>
                                        <select
                                            value={pageSize}
                                            onChange={(e) => {
                                                setPageSize(parseInt(e.target.value));
                                                setCurrentPage(1);
                                            }}
                                            className={styles.pageSizeSelect}
                                            disabled={isLoading}
                                        >
                                            <option value={15}>15 per page</option>
                                            <option value={25}>25 per page</option>
                                            <option value={50}>50 per page</option>
                                        </select>
                                        <button
                                            onClick={() => handlePageChange(1)}
                                            disabled={currentPage === 1 || isLoading}
                                            className={styles.pageBtn}
                                        >
                                            «
                                        </button>
                                        <button
                                            onClick={() => handlePageChange(currentPage - 1)}
                                            disabled={currentPage === 1 || isLoading}
                                            className={styles.pageBtn}
                                        >
                                            ‹
                                        </button>
                                        
                                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                                            .filter(p => Math.abs(p - currentPage) < 2 || p === 1 || p === totalPages)
                                            .map((p, i, arr) => {
                                                const showEllipsis = i > 0 && p - arr[i - 1] > 1;
                                                return (
                                                    <React.Fragment key={p}>
                                                        {showEllipsis && <span style={{ padding: '0 0.25rem', color: '#94a3b8' }}>...</span>}
                                                        <button
                                                            onClick={() => handlePageChange(p)}
                                                            className={`${styles.pageBtn} ${currentPage === p ? styles.activePage : ''}`}
                                                            disabled={isLoading}
                                                        >
                                                            {p}
                                                        </button>
                                                    </React.Fragment>
                                                );
                                            })
                                        }
                                        
                                        <button
                                            onClick={() => handlePageChange(currentPage + 1)}
                                            disabled={currentPage === totalPages || totalPages === 0 || isLoading}
                                            className={styles.pageBtn}
                                        >
                                            ›
                                        </button>
                                        <button
                                            onClick={() => handlePageChange(totalPages)}
                                            disabled={currentPage === totalPages || totalPages === 0 || isLoading}
                                            className={styles.pageBtn}
                                        >
                                            »
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Document Preview Modal */}
            {previewWoId && (
                <div className={styles.modalOverlay} onClick={handleClosePreview}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h4 className={styles.modalTitle}>
                                📄 PO Document Preview - {previewData?.name || 'Loading...'}
                            </h4>
                            <button className={styles.modalCloseBtn} onClick={handleClosePreview}>
                                ❌
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            {isPreviewLoading ? (
                                <div className={styles.loadingContainer}>
                                    <div className={styles.darkSpinner}></div>
                                    <div className={styles.loadingText}>Generating preview, please wait...</div>
                                </div>
                            ) : previewData?.type === 'pdf' ? (
                                <iframe
                                    src={previewData.url}
                                    title="PDF Preview"
                                    className={styles.pdfIframe}
                                />
                            ) : previewData?.type === 'excel' ? (
                                <div className={styles.excelPreviewContainer}>
                                    <table className={styles.excelTable}>
                                        <thead>
                                            <tr>
                                                {previewData.columns?.map((col: string, idx: number) => (
                                                    <th key={idx}>{col || `Col ${idx + 1}`}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {previewData.rows?.map((row: any[], rowIdx: number) => (
                                                <tr key={rowIdx}>
                                                    {row.map((cell: any, cellIdx: number) => (
                                                        <td key={cellIdx}>{cell}</td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : previewData?.type === 'legacy_excel' || previewData?.type === 'local_excel' ? (
                                <div className={styles.legacyExcelContainer}>
                                    <span style={{ fontSize: '3rem' }}>📊</span>
                                    <p className={styles.legacyExcelText}>
                                        {previewData?.type === 'local_excel' ? (
                                            <>Excel spreadsheet preview grid will be generated after the Work Order is created. You can download the attached draft file to review locally.</>
                                        ) : (
                                            <>Direct browser preview is not supported for legacy <strong>.xls</strong> Excel format. Please download the file directly to view it on your local device.</>
                                        )}
                                    </p>
                                    <button
                                        className={styles.button}
                                        onClick={() => {
                                            if (previewData?.type === 'local_excel') {
                                                handleDownloadLocalFile();
                                            } else {
                                                handleDownloadPo(previewWoId!, previewData.name);
                                            }
                                        }}
                                    >
                                        Download File
                                    </button>
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '2rem', color: '#ef4444' }}>
                                    Failed to load preview.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Full Remark Modal */}
            {remarkModal && (
                <div className={styles.modalOverlay} onClick={() => setRemarkModal(null)}>
                    <div className={styles.modalContent} style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h4 className={styles.modalTitle}>
                                📝 Remark - {remarkModal.workOrderId}
                            </h4>
                            <button className={styles.modalCloseBtn} onClick={() => setRemarkModal(null)}>
                                ❌
                            </button>
                        </div>
                        <div className={styles.modalBody} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#374151', fontSize: '0.95rem', lineHeight: '1.5', minHeight: 'auto' }}>
                            {remarkModal.remark}
                        </div>
                    </div>
                </div>
            )}

            {selectedCount && (
                <SMTCountDetailsModal
                    workOrderId={selectedCount.workOrderId}
                    stage={selectedCount.stage}
                    type={selectedCount.type}
                    label={selectedCount.label}
                    onClose={() => setSelectedCount(null)}
                />
            )}

            {/* View Details Dialog */}
            {viewDetailWo && (
                <div className={styles.modalOverlay} onClick={() => setViewDetailWo(null)}>
                    <div className={styles.modalContent} style={{ maxWidth: '850px', width: '90%', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h4 className={styles.modalTitle}>
                                🔍 Work Order Details - {viewDetailWo.work_order_id}
                            </h4>
                            <button className={styles.modalCloseBtn} onClick={() => setViewDetailWo(null)}>
                                ❌
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.detailGrid}>
                                
                                {/* Work Order Information */}
                                <div className={`${styles.detailCard} ${styles.detailCardFullWidth}`}>
                                    <div className={styles.detailCardHeader}>
                                        📋 Work Order Information
                                    </div>
                                    <div className={styles.detailItemGrid}>
                                        <div className={styles.detailItem}>
                                            <span className={styles.detailLabel}>Work Order ID</span>
                                            <span className={styles.detailValue} style={{ fontWeight: 600 }}>{viewDetailWo.work_order_id}</span>
                                        </div>
                                        <div className={styles.detailItem}>
                                            <span className={styles.detailLabel}>PO ID</span>
                                            <span className={styles.detailValue}>{viewDetailWo.po_id || '-'}</span>
                                        </div>
                                        <div className={styles.detailItem}>
                                            <span className={styles.detailLabel}>Product Name</span>
                                            <span className={styles.detailValue}>{viewDetailWo.product_name}</span>
                                        </div>
                                        <div className={styles.detailItem}>
                                            <span className={styles.detailLabel}>Number of Sides</span>
                                            <span className={styles.detailValue}>{formatSidesDisplay(viewDetailWo.sides)}</span>
                                        </div>
                                        <div className={styles.detailItem}>
                                            <span className={styles.detailLabel}>Quantity</span>
                                            <span className={styles.detailValue}>{viewDetailWo.quantity} units</span>
                                        </div>
                                        <div className={styles.detailItem}>
                                            <span className={styles.detailLabel}>Customer Name</span>
                                            <span className={styles.detailValue} style={{ fontWeight: 600 }}>{viewDetailWo.customer_name || '-'}</span>
                                        </div>
                                        <div className={styles.detailItem}>
                                            <span className={styles.detailLabel}>Model Name</span>
                                            <span className={styles.detailValue} style={{ fontWeight: 600 }}>{viewDetailWo.model_name || '-'}</span>
                                        </div>
                                        <div className={styles.detailItem}>
                                            <span className={styles.detailLabel}>SMT Process</span>
                                            <span className={styles.detailValue} style={{
                                                fontWeight: 700,
                                                color: viewDetailWo.has_smt !== false && viewDetailWo.hasSmt !== false ? '#166534' : '#991b1b',
                                                backgroundColor: viewDetailWo.has_smt !== false && viewDetailWo.hasSmt !== false ? '#dcfce7' : '#fee2e2',
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                fontSize: '0.8rem'
                                            }}>
                                                {viewDetailWo.has_smt !== false && viewDetailWo.hasSmt !== false ? '⚡ Enabled' : '🚫 Disabled'}
                                            </span>
                                        </div>
                                        <div className={styles.detailItem}>
                                            <span className={styles.detailLabel}>Backend Process</span>
                                            <span className={styles.detailValue} style={{
                                                fontWeight: 700,
                                                color: viewDetailWo.has_backend !== false && viewDetailWo.hasBackend !== false ? '#1d4ed8' : '#991b1b',
                                                backgroundColor: viewDetailWo.has_backend !== false && viewDetailWo.hasBackend !== false ? '#eff6ff' : '#fee2e2',
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                fontSize: '0.8rem'
                                            }}>
                                                {viewDetailWo.has_backend !== false && viewDetailWo.hasBackend !== false ? '🔀 Enabled' : '🚫 Disabled'}
                                            </span>
                                        </div>
                                        <div className={`${styles.detailItem} ${styles.detailItemFullWidth}`} style={{ marginTop: '0.5rem' }}>
                                            <span className={styles.detailLabel}>Configured Process Route</span>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem', marginTop: '0.35rem' }}>
                                                {ALL_STAGES.filter(s => (Array.isArray(viewDetailWo.selected_stages) ? viewDetailWo.selected_stages : ALL_STAGES).includes(s)).map((st: string, idx: number, arr: any[]) => (
                                                    <React.Fragment key={st}>
                                                        <span style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '0.25rem',
                                                            padding: '3px 9px',
                                                            borderRadius: '5px',
                                                            fontSize: '0.8rem',
                                                            fontWeight: 600,
                                                            backgroundColor: '#eff6ff',
                                                            color: '#1d4ed8',
                                                            border: '1px solid #bfdbfe'
                                                        }}>
                                                            <span style={{ opacity: 0.75 }}>{idx + 1}.</span> {st}
                                                        </span>
                                                        {idx < arr.length - 1 && (
                                                            <span style={{ color: '#3b82f6', fontWeight: 'bold', fontSize: '0.85rem' }}>→</span>
                                                        )}
                                                    </React.Fragment>
                                                ))}
                                            </div>
                                        </div>
                                        <div className={`${styles.detailItem} ${styles.detailItemFullWidth}`} style={{ marginTop: '0.5rem' }}>
                                            <span className={styles.detailLabel}>Product Description</span>
                                            <span className={styles.detailValue} style={{ whiteSpace: 'pre-wrap' }}>
                                                {viewDetailWo.product_description || '-'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Production Information */}
                                <div className={styles.detailCard}>
                                    <div className={styles.detailCardHeader}>
                                        ⚙️ Production Information
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        <div className={styles.detailItem}>
                                            <span className={styles.detailLabel}>Line ID</span>
                                            <span className={styles.detailValue}>{viewDetailWo.line_id}</span>
                                        </div>
                                        <div className={styles.detailItem}>
                                            <span className={styles.detailLabel}>Priority</span>
                                            <div>
                                                <span style={{
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 'bold',
                                                    backgroundColor: viewDetailWo.priority === 'high' ? '#fee2e2' : viewDetailWo.priority === 'medium' ? '#fef3c7' : '#e0e7ff',
                                                    color: viewDetailWo.priority === 'high' ? '#991b1b' : viewDetailWo.priority === 'medium' ? '#92400e' : '#3730a3'
                                                }}>
                                                    {(viewDetailWo.priority || 'MEDIUM').toUpperCase()}
                                                </span>
                                            </div>
                                        </div>
                                        <div className={styles.detailItem}>
                                            <span className={styles.detailLabel}>Current Solder Paste Status</span>
                                            <span className={styles.detailValue}>
                                                <span style={{
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 'bold',
                                                    backgroundColor: viewDetailWo.solder_paste_status === 'Completed' ? '#d1fae5' : viewDetailWo.solder_paste_status === 'In Progress' ? '#dbeafe' : '#f3f4f6',
                                                    color: viewDetailWo.solder_paste_status === 'Completed' ? '#065f46' : viewDetailWo.solder_paste_status === 'In Progress' ? '#1e40af' : '#374151'
                                                }}>
                                                    {viewDetailWo.solder_paste_status || 'Pending'}
                                                </span>
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Document Information */}
                                {canAccessPoDocument && (
                                    <div className={styles.detailCard}>
                                        <div className={styles.detailCardHeader}>
                                            📁 Document Information
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            <div className={styles.detailItem}>
                                                <span className={styles.detailLabel}>PO Document</span>
                                                <span className={styles.detailValue} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    {(viewDetailWo.po_document_path || viewDetailWo.po_document_name) ? (
                                                        <>
                                                            {(viewDetailWo.po_document_type === 'application/pdf' || viewDetailWo.po_document_name?.toLowerCase().endsWith('.pdf')) ? '📕' : '📗'}
                                                            <span style={{ fontSize: '0.9rem', color: '#1e293b', fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '200px' }} title={viewDetailWo.po_document_name}>
                                                                {viewDetailWo.po_document_name}
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <span style={{ color: '#9ca3af' }}>No PO document uploaded</span>
                                                    )}
                                                </span>
                                            </div>
                                            {(viewDetailWo.po_document_path || viewDetailWo.po_document_name) && (
                                                <div style={{ display: 'flex', gap: '8px', marginTop: '0.25rem' }}>
                                                    <button
                                                        className={styles.secondaryButton}
                                                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                        onClick={() => handleOpenPreview(viewDetailWo.work_order_id || viewDetailWo.id)}
                                                    >
                                                        👁️ View Preview
                                                    </button>
                                                    <button
                                                        className={styles.secondaryButton}
                                                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                        onClick={() => handleDownloadPo(viewDetailWo.work_order_id || viewDetailWo.id, viewDetailWo.po_document_name)}
                                                    >
                                                        📥 Download
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Audit Information */}
                                <div className={`${styles.detailCard} ${styles.detailCardFullWidth}`}>
                                    <div className={styles.detailCardHeader}>
                                        🛡️ Audit Information
                                    </div>
                                    <div className={styles.detailItemGrid}>
                                        <div className={styles.detailItem}>
                                            <span className={styles.detailLabel}>Created By</span>
                                            <span className={styles.detailValue}>{viewDetailWo.created_by || 'System'}</span>
                                        </div>
                                        <div className={styles.detailItem}>
                                            <span className={styles.detailLabel}>Date Created</span>
                                            <span className={styles.detailValue}>
                                                {new Date(viewDetailWo.created_at).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className={styles.detailItem}>
                                            <span className={styles.detailLabel}>Last Updated By</span>
                                            <span className={styles.detailValue} style={{ color: '#9ca3af' }}>N/A</span>
                                        </div>
                                        <div className={styles.detailItem}>
                                            <span className={styles.detailLabel}>Last Updated Date</span>
                                            <span className={styles.detailValue} style={{ color: '#9ca3af' }}>N/A</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Additional Information */}
                                <div className={`${styles.detailCard} ${styles.detailCardFullWidth}`}>
                                    <div className={styles.detailCardHeader}>
                                        📝 Additional Information
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Remarks</span>
                                        <div style={{
                                            marginTop: '6px',
                                            color: '#374151',
                                            whiteSpace: 'pre-wrap',
                                            backgroundColor: '#f1f5f9',
                                            padding: '0.75rem',
                                            borderRadius: '6px',
                                            border: '1px solid #e2e8f0',
                                            fontSize: '0.9rem',
                                            lineHeight: '1.5',
                                            wordBreak: 'break-word'
                                        }}>
                                            {viewDetailWo.remark || <span style={{ color: '#9ca3af' }}>No remarks</span>}
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <button
                                className={styles.secondaryButton}
                                onClick={() => window.print()}
                                style={{ padding: '0.5rem 1rem' }}
                            >
                                🖨️ Print Details
                            </button>
                            <button
                                className={styles.button}
                                onClick={() => setViewDetailWo(null)}
                                style={{ minWidth: '100px', padding: '0.5rem 1.5rem' }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
