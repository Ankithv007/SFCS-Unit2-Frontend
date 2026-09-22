import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    Radio,
    UploadCloud,
    FileSpreadsheet,
    Eye,
    Download,
    Trash2,
    Search,
    RefreshCw,
    X,
    CheckCircle2,
    AlertCircle,
    Calendar,
    Layers,
    FileText
} from 'lucide-react';
import styles from './RrhWorkOrder.module.css';
import { apiFetch } from '../../../utils/api';
import { useToast } from '../../../components/Toast';
import { useAuth } from '../../../hooks/useAuth';
import type { RrhWorkOrderRecord, RrhWorkOrderDetail } from '../types';

interface ExcelPreviewData {
    fileName: string;
    fileSize: number;
    totalRows: number;
    totalColumns: number;
    columns: string[];
    previewRows: Record<string, any>[];
}

// Concise helpers
const formatBytes = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${['B', 'KB', 'MB', 'GB'][i]}`;
};

const formatDate = (d: string) => d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '-';
const formatDateTime = (d: string) => d ? new Date(d).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

// Shared Excel Data Table Component
const ExcelDataTable: React.FC<{
    columns: string[];
    rows: Record<string, any>[];
    emptyMessage?: string;
}> = ({ columns, rows, emptyMessage = 'No rows to display.' }) => (
    <table className={styles.previewTable}>
        <thead>
            <tr>
                <th style={{ width: '45px' }}>#</th>
                {columns.map((col, idx) => (
                    <th key={idx}>{col}</th>
                ))}
            </tr>
        </thead>
        <tbody>
            {rows.length === 0 ? (
                <tr>
                    <td colSpan={columns.length + 1} className={styles.emptyNotice}>
                        {emptyMessage}
                    </td>
                </tr>
            ) : (
                rows.map((row, rIdx) => (
                    <tr key={rIdx}>
                        <td style={{ fontWeight: 600, color: '#94a3b8' }}>{rIdx + 1}</td>
                        {columns.map((col, cIdx) => (
                            <td key={cIdx} title={String(row[col] ?? '')}>
                                {String(row[col] ?? '')}
                            </td>
                        ))}
                    </tr>
                ))
            )}
        </tbody>
    </table>
);

export const RrhWorkOrder: React.FC = () => {
    const { user, permissions = [] } = useAuth();
    const { showToast } = useToast();

    const isSuperAdmin = user?.role === 'Super Admin';
    const canDelete = isSuperAdmin || permissions.some(p => p.permission_key === 'rrh_work_order' && p.can_delete);

    // Form states
    const [workOrderId, setWorkOrderId] = useState('');
    const [workOrderDate, setWorkOrderDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [lotQuantity, setLotQuantity] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isParsingExcel, setIsParsingExcel] = useState(false);
    const [excelPreview, setExcelPreview] = useState<ExcelPreviewData | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState('');
    const [isDragOver, setIsDragOver] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Table & filter states
    const [workOrders, setWorkOrders] = useState<RrhWorkOrderRecord[]>([]);
    const [isLoadingList, setIsLoadingList] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(15);
    const [totalRecords, setTotalRecords] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    // Detail Modal states
    const [selectedDetail, setSelectedDetail] = useState<RrhWorkOrderDetail | null>(null);
    const [loadingDetailId, setLoadingDetailId] = useState<number | null>(null);
    const [modalExcelFilter, setModalExcelFilter] = useState('');

    // Parse Excel via API
    const parseExcel = async (file: File) => {
        setIsParsingExcel(true);
        setFormError('');
        try {
            const formData = new FormData();
            formData.append('file', file);

            const result = await apiFetch('/api/rrh/work-orders/parse-excel', {
                method: 'POST',
                body: formData
            });

            if (result.success) {
                setExcelPreview(result);
                showToast(`Excel parsed: ${result.totalRows} rows and ${result.totalColumns} columns detected.`, 'info');
            } else {
                throw new Error(result.error || 'Failed to parse Excel file.');
            }
        } catch (err: any) {
            console.error('Excel parse error:', err);
            const msg = err.message || 'Error parsing Excel file.';
            setFormError(msg);
            showToast(msg, 'error');
            setSelectedFile(null);
            setExcelPreview(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        } finally {
            setIsParsingExcel(false);
        }
    };

    // File selection handler
    const handleFileChange = (file: File | null) => {
        if (!file) return;

        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext !== 'xlsx' && ext !== 'xls') {
            const errorMsg = 'Please select a valid Excel workbook (.xlsx or .xls).';
            setFormError(errorMsg);
            showToast(errorMsg, 'error');
            return;
        }

        if (file.size > 50 * 1024 * 1024) {
            const errorMsg = 'File size exceeds 50MB limit.';
            setFormError(errorMsg);
            showToast(errorMsg, 'error');
            return;
        }

        setSelectedFile(file);
        parseExcel(file);
    };

    const handleClearFile = () => {
        setSelectedFile(null);
        setExcelPreview(null);
        setFormError('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleResetForm = () => {
        setWorkOrderId('');
        setWorkOrderDate(new Date().toISOString().split('T')[0]);
        setLotQuantity('');
        handleClearFile();
        setFormError('');
    };

    // Fetch RRH Work Orders
    const fetchWorkOrders = useCallback(async () => {
        setIsLoadingList(true);
        try {
            const params = new URLSearchParams();
            if (searchQuery.trim()) params.append('search', searchQuery.trim());
            if (dateFilter.trim()) params.append('date', dateFilter.trim());
            params.append('page', page.toString());
            params.append('limit', limit.toString());

            const response = await apiFetch(`/api/rrh/work-orders?${params.toString()}`);
            if (response.success) {
                setWorkOrders(response.data || []);
                setTotalRecords(response.total || 0);
                setTotalPages(response.totalPages || 1);
            }
        } catch (err: any) {
            console.error('Error fetching RRH work orders:', err);
            showToast(err.message || 'Failed to fetch RRH work orders.', 'error');
        } finally {
            setIsLoadingList(false);
        }
    }, [searchQuery, dateFilter, page, limit, showToast]);

    useEffect(() => {
        fetchWorkOrders();
    }, [fetchWorkOrders]);

    // Handle Form Submit
    const handleCreateWorkOrder = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');

        const woIdTrimmed = workOrderId.trim();
        if (!woIdTrimmed) {
            setFormError('Work Order ID is required.');
            return;
        }

        const qtyNum = parseInt(lotQuantity, 10);
        if (isNaN(qtyNum) || qtyNum <= 0) {
            setFormError('Lot Quantity must be a positive integer greater than 0.');
            return;
        }

        if (!selectedFile) {
            setFormError('Please select and upload an Excel file.');
            return;
        }

        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('work_order_id', woIdTrimmed);
            formData.append('work_order_date', workOrderDate);
            formData.append('lot_quantity', qtyNum.toString());
            formData.append('file', selectedFile);

            const result = await apiFetch('/api/rrh/work-orders', {
                method: 'POST',
                body: formData
            });

            if (result.success) {
                showToast(`RRH Work Order "${woIdTrimmed}" created successfully!`, 'success');
                handleResetForm();
                fetchWorkOrders();
            } else {
                throw new Error(result.error || 'Failed to create RRH Work Order.');
            }
        } catch (err: any) {
            console.error('Creation error:', err);
            const msg = err.message || 'Failed to create RRH Work Order.';
            setFormError(msg);
            showToast(msg, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    // View Detail Modal
    const handleViewDetail = async (id: number) => {
        setLoadingDetailId(id);
        try {
            const res = await apiFetch(`/api/rrh/work-orders/${id}`);
            if (res.success && res.data) {
                setSelectedDetail(res.data);
                setModalExcelFilter('');
            } else {
                throw new Error(res.error || 'Failed to fetch Work Order details.');
            }
        } catch (err: any) {
            showToast(err.message || 'Failed to fetch details.', 'error');
        } finally {
            setLoadingDetailId(null);
        }
    };

    // Download Original Excel
    const handleDownloadExcel = async (id: number, filename: string) => {
        try {
            const blob = await apiFetch(`/api/rrh/work-orders/${id}/download`);
            const url = window.URL.createObjectURL(blob);
            Object.assign(document.createElement('a'), { href: url, download: filename || 'RRH_Work_Order.xlsx' }).click();
            window.URL.revokeObjectURL(url);
            showToast('Download started.', 'success');
        } catch (err: any) {
            showToast(err.message || 'Failed to download file.', 'error');
        }
    };

    // Delete Work Order
    const handleDeleteWorkOrder = async (id: number, woId: string) => {
        if (!window.confirm(`Are you sure you want to delete RRH Work Order "${woId}"?\nThis action will delete the Work Order record and its stored Excel file permanently.`)) return;

        try {
            const res = await apiFetch(`/api/rrh/work-orders/${id}`, { method: 'DELETE' });
            if (res.success) {
                showToast(`RRH Work Order "${woId}" deleted successfully.`, 'success');
                if (selectedDetail?.id === id) setSelectedDetail(null);
                fetchWorkOrders();
            } else {
                throw new Error(res.error || 'Failed to delete RRH Work Order.');
            }
        } catch (err: any) {
            showToast(err.message || 'Failed to delete RRH Work Order.', 'error');
        }
    };

    // Filter modal excel rows
    const filteredModalRows = useMemo(() => {
        if (!selectedDetail?.excel_data) return [];
        if (!modalExcelFilter.trim()) return selectedDetail.excel_data;

        const term = modalExcelFilter.toLowerCase().trim();
        return selectedDetail.excel_data.filter(row =>
            Object.values(row).some(val => String(val ?? '').toLowerCase().includes(term))
        );
    }, [selectedDetail, modalExcelFilter]);

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.headerTitleRow}>
                    <div className={styles.headerIcon}>
                        <Radio size={24} />
                    </div>
                    <div>
                        <h1 className={styles.headerTitle}>RRH Work Order Management</h1>
                        <p className={styles.headerSubtitle}>
                            Create and manage Remote Radio Head (RRH) Work Orders and associated Excel datasets independently.
                        </p>
                    </div>
                </div>
            </div>

            {/* Creation Form Card */}
            <div className={styles.card}>
                <div className={styles.cardHeader}>
                    <h2 className={styles.cardTitle}>
                        <FileSpreadsheet size={20} color="#4f46e5" />
                        Create RRH Work Order
                    </h2>
                </div>

                <form onSubmit={handleCreateWorkOrder}>
                    <div className={styles.formGrid}>
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>
                                Work Order ID <span className={styles.required}>*</span>
                            </label>
                            <input
                                type="text"
                                className={styles.input}
                                placeholder="e.g. 069, RRH-069, RRH-WO-2026-001"
                                value={workOrderId}
                                onChange={e => setWorkOrderId(e.target.value)}
                                required
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label className={styles.label}>
                                Work Order Date <span className={styles.required}>*</span>
                            </label>
                            <input
                                type="date"
                                className={styles.input}
                                value={workOrderDate}
                                onChange={e => setWorkOrderDate(e.target.value)}
                                required
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label className={styles.label}>
                                Lot Quantity <span className={styles.required}>*</span>
                            </label>
                            <input
                                type="number"
                                min="1"
                                className={styles.input}
                                placeholder="e.g. 500"
                                value={lotQuantity}
                                onChange={e => setLotQuantity(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    {/* Excel Upload Area */}
                    <div className={styles.uploadSection}>
                        <label className={styles.label}>
                            Excel Dataset File (.xlsx, .xls) <span className={styles.required}>*</span>
                        </label>

                        {!selectedFile ? (
                            <div
                                className={`${styles.dropzone} ${isDragOver ? styles.dropzoneActive : ''}`}
                                onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                                onDragLeave={() => setIsDragOver(false)}
                                onDrop={e => {
                                    e.preventDefault();
                                    setIsDragOver(false);
                                    if (e.dataTransfer.files?.[0]) handleFileChange(e.dataTransfer.files[0]);
                                }}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    accept=".xlsx, .xls"
                                    style={{ display: 'none' }}
                                    onChange={e => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                                />
                                <div className={styles.dropzoneIcon}>
                                    <UploadCloud size={36} />
                                </div>
                                <p className={styles.dropzoneText}>
                                    <strong>Click to browse</strong> or drag and drop your Excel workbook here
                                </p>
                                <p className={styles.dropzoneHint}>
                                    Supports Microsoft Excel (.xlsx, .xls) up to 50MB
                                </p>
                            </div>
                        ) : (
                            <div className={styles.fileActiveCard}>
                                <div className={styles.fileActiveDetails}>
                                    <FileSpreadsheet size={28} className={styles.fileActiveIcon} />
                                    <div>
                                        <p className={styles.fileActiveName}>{selectedFile.name}</p>
                                        <p className={styles.fileActiveMeta}>
                                            Size: {formatBytes(selectedFile.size)}
                                            {isParsingExcel && ' • Parsing preview...'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className={styles.removeFileBtn}
                                    onClick={handleClearFile}
                                    title="Remove file"
                                >
                                    <X size={16} /> Remove File
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Live Preview Card */}
                    {excelPreview && !isParsingExcel && (
                        <div className={styles.previewBox}>
                            <div className={styles.previewStats}>
                                <div className={styles.statItem}>
                                    <FileText size={16} color="#6366f1" />
                                    <span>File:</span>
                                    <span className={styles.statValue}>{excelPreview.fileName}</span>
                                </div>
                                <div className={styles.statItem}>
                                    <Layers size={16} color="#059669" />
                                    <span>Total Columns:</span>
                                    <span className={styles.statValue}>{excelPreview.totalColumns}</span>
                                </div>
                                <div className={styles.statItem}>
                                    <CheckCircle2 size={16} color="#0284c7" />
                                    <span>Total Rows:</span>
                                    <span className={styles.statValue}>{excelPreview.totalRows}</span>
                                </div>
                                <div className={styles.statItem} style={{ marginLeft: 'auto', color: '#64748b', fontSize: '0.8rem' }}>
                                    (Showing first {excelPreview.previewRows.length} rows preview)
                                </div>
                            </div>

                            <div className={styles.previewTableWrapper}>
                                <ExcelDataTable columns={excelPreview.columns} rows={excelPreview.previewRows} />
                            </div>
                        </div>
                    )}

                    {/* Form Error Banner */}
                    {formError && (
                        <div className={styles.formErrorBanner}>
                            <AlertCircle size={18} />
                            <span>{formError}</span>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className={styles.formActions}>
                        <button
                            type="submit"
                            className={styles.btnPrimary}
                            disabled={isSubmitting || isParsingExcel || !workOrderId.trim() || !lotQuantity || !selectedFile}
                        >
                            {isSubmitting ? (
                                <>
                                    <span className={styles.spinner} />
                                    Creating Work Order...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 size={18} />
                                    Create Work Order
                                </>
                            )}
                        </button>
                        <button
                            type="button"
                            className={styles.btnSecondary}
                            onClick={handleResetForm}
                            disabled={isSubmitting}
                        >
                            Clear / Reset
                        </button>
                    </div>
                </form>
            </div>

            {/* Created RRH Work Orders Section */}
            <div className={styles.card}>
                <div className={styles.cardHeader}>
                    <h2 className={styles.cardTitle}>
                        <Layers size={20} color="#4f46e5" />
                        RRH Work Orders Directory
                    </h2>
                </div>

                {/* Filter and Search Bar */}
                <div className={styles.filterBar}>
                    <div className={styles.filterInputs}>
                        <div className={styles.searchInputWrapper}>
                            <Search size={16} className={styles.searchIcon} />
                            <input
                                type="text"
                                className={styles.searchInput}
                                placeholder="Search by RRH Work Order ID..."
                                value={searchQuery}
                                onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                            />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Calendar size={16} color="#6b7280" />
                            <input
                                type="date"
                                className={styles.dateFilterInput}
                                value={dateFilter}
                                onChange={e => { setDateFilter(e.target.value); setPage(1); }}
                            />
                        </div>

                        {(searchQuery || dateFilter) && (
                            <button
                                type="button"
                                className={styles.btnResetFilters}
                                onClick={() => { setSearchQuery(''); setDateFilter(''); setPage(1); }}
                            >
                                Reset Filters
                            </button>
                        )}
                    </div>

                    <button
                        type="button"
                        className={styles.btnSecondary}
                        style={{ padding: '0.55rem 1rem', fontSize: '0.85rem' }}
                        onClick={() => fetchWorkOrders()}
                        title="Refresh list"
                    >
                        <RefreshCw size={15} className={isLoadingList ? styles.spinner : ''} />
                    </button>
                </div>

                {/* Data Table */}
                <div className={styles.tableContainer}>
                    <table className={styles.dataTable}>
                        <thead>
                            <tr>
                                <th>WORK ORDER ID</th>
                                <th>DATE</th>
                                <th>LOT QUANTITY</th>
                                <th>EXCEL FILE</th>
                                <th>EXCEL ROWS COUNT</th>
                                <th>CREATED BY</th>
                                <th>CREATED AT</th>
                                <th style={{ textAlign: 'center' }}>ACTION</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoadingList ? (
                                <tr>
                                    <td colSpan={8} className={styles.emptyNotice}>
                                        <span className={styles.spinner} style={{ borderColor: '#4f46e5', borderTopColor: 'transparent', marginRight: '0.5rem' }} />
                                        Loading RRH Work Orders...
                                    </td>
                                </tr>
                            ) : workOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className={styles.emptyNotice}>
                                        No RRH Work Orders found. Create your first RRH Work Order using the form above.
                                    </td>
                                </tr>
                            ) : (
                                workOrders.map(wo => (
                                    <tr key={wo.id}>
                                        <td><span className={styles.woIdBadge}>{wo.work_order_id}</span></td>
                                        <td>{formatDate(wo.work_order_date)}</td>
                                        <td><span className={styles.qtyBadge}>{wo.lot_quantity.toLocaleString()}</span></td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }} title={wo.excel_filename}>
                                                <FileSpreadsheet size={15} color="#059669" />
                                                <span style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {wo.excel_filename || 'Excel File'}
                                                </span>
                                            </div>
                                        </td>
                                        <td><span className={styles.rowsBadge}>{wo.total_excel_rows?.toLocaleString() || 0} rows</span></td>
                                        <td><span style={{ color: '#475569', fontWeight: 500 }}>{wo.created_by || 'System'}</span></td>
                                        <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{formatDateTime(wo.created_at)}</td>
                                        <td>
                                            <div className={styles.actionGroup} style={{ justifyContent: 'center' }}>
                                                <button
                                                    type="button"
                                                    className={`${styles.actionBtn} ${styles.actionBtnView}`}
                                                    onClick={() => handleViewDetail(wo.id)}
                                                    disabled={loadingDetailId === wo.id}
                                                    title="View Details & Full Dataset"
                                                >
                                                    {loadingDetailId === wo.id ? (
                                                        <span className={styles.spinner} style={{ width: '12px', height: '12px', borderWidth: '1.5px' }} />
                                                    ) : (
                                                        <Eye size={14} />
                                                    )} View
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`${styles.actionBtn} ${styles.actionBtnDownload}`}
                                                    onClick={() => handleDownloadExcel(wo.id, wo.excel_filename)}
                                                    title="Download Original Excel"
                                                >
                                                    <Download size={14} /> Download
                                                </button>
                                                {canDelete && (
                                                    <button
                                                        type="button"
                                                        className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                                                        onClick={() => handleDeleteWorkOrder(wo.id, wo.work_order_id)}
                                                        title="Delete Work Order"
                                                    >
                                                        <Trash2 size={14} /> Delete
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className={styles.paginationBar}>
                    <div className={styles.pageSizeSelector}>
                        <span>Show</span>
                        <select
                            className={styles.pageSizeSelect}
                            value={limit}
                            onChange={e => { setLimit(Number(e.target.value)); setPage(1); }}
                        >
                            <option value={15}>15</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                        </select>
                        <span>records per page</span>
                    </div>

                    <div className={styles.paginationInfo}>
                        Showing {totalRecords > 0 ? (page - 1) * limit + 1 : 0} to{' '}
                        {Math.min(page * limit, totalRecords)} of {totalRecords} records
                    </div>

                    <div className={styles.paginationNav}>
                        <button
                            type="button"
                            className={styles.pageBtn}
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page <= 1 || isLoadingList}
                        >
                            Previous
                        </button>
                        <span style={{ margin: '0 0.5rem', fontWeight: 600, fontSize: '0.875rem' }}>
                            Page {page} of {totalPages}
                        </span>
                        <button
                            type="button"
                            className={styles.pageBtn}
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages || isLoadingList}
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {/* Work Order Detail Modal */}
            {selectedDetail && (
                <div
                    className={styles.modalOverlay}
                    onClick={e => { if (e.target === e.currentTarget) setSelectedDetail(null); }}
                >
                    <div className={styles.modalDialog}>
                        <div className={styles.modalHeader}>
                            <h3 className={styles.modalTitle}>
                                <Radio size={20} color="#4f46e5" />
                                RRH Work Order Detail: {selectedDetail.work_order_id}
                            </h3>
                            <button
                                type="button"
                                className={styles.closeBtn}
                                onClick={() => setSelectedDetail(null)}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className={styles.modalBody}>
                            {/* Section 1: RRH Work Order Details */}
                            <div className={styles.modalSection}>
                                <h4 className={styles.sectionHeader}>
                                    Section 1 — Work Order Overview
                                </h4>
                                <div className={styles.detailsGrid}>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Work Order ID</span>
                                        <span className={styles.detailValue} style={{ color: '#4f46e5' }}>
                                            {selectedDetail.work_order_id}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Date</span>
                                        <span className={styles.detailValue}>
                                            {formatDate(selectedDetail.work_order_date)}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Lot Quantity</span>
                                        <span className={styles.detailValue}>
                                            {selectedDetail.lot_quantity.toLocaleString()}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Created By</span>
                                        <span className={styles.detailValue}>
                                            {selectedDetail.created_by || 'System'}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Created At</span>
                                        <span className={styles.detailValue}>
                                            {formatDateTime(selectedDetail.created_at)}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Excel File Name</span>
                                        <span className={styles.detailValue}>
                                            {selectedDetail.excel_filename}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>File Size</span>
                                        <span className={styles.detailValue}>
                                            {formatBytes(selectedDetail.excel_file_size)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Excel Data */}
                            <div className={styles.modalSection}>
                                <div className={styles.sectionHeader}>
                                    <span>Section 2 — Excel Data ({selectedDetail.total_excel_rows} rows, {selectedDetail.excel_columns?.length || 0} columns)</span>
                                    <button
                                        type="button"
                                        className={styles.btnPrimary}
                                        style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
                                        onClick={() => handleDownloadExcel(selectedDetail.id, selectedDetail.excel_filename)}
                                    >
                                        <Download size={15} /> Download Original Excel
                                    </button>
                                </div>

                                <div className={styles.excelControls}>
                                    <div className={styles.searchInputWrapper} style={{ maxWidth: '360px' }}>
                                        <Search size={16} className={styles.searchIcon} />
                                        <input
                                            type="text"
                                            className={styles.searchInput}
                                            placeholder="Search across all Excel cells..."
                                            value={modalExcelFilter}
                                            onChange={e => setModalExcelFilter(e.target.value)}
                                        />
                                    </div>
                                    <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                        Showing {filteredModalRows.length} of {selectedDetail.total_excel_rows} rows
                                    </span>
                                </div>

                                <div className={styles.modalTableContainer}>
                                    <ExcelDataTable
                                        columns={selectedDetail.excel_columns || []}
                                        rows={filteredModalRows}
                                        emptyMessage="No rows match your search filter."
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
