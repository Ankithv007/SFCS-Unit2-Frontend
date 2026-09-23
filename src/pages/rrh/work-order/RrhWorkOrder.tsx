import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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

// Helper functions for formatting
const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
};

const formatDateTime = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
};

const formatBytes = (bytes: number | null | undefined, decimals = 2) => {
    if (bytes == null || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export interface ParsedCell {
    columnNumber?: number;
    c?: number;
    columnLetter?: string;
    rawValue?: string | null;
    displayValue?: string | null;
    v?: string | null;
    dataType?: string;
    t?: string;
    isMerged?: boolean;
    mergeType?: 'MASTER' | 'SLAVE' | 'NONE';
    rowSpan?: number;
    colSpan?: number;
}

export interface ParsedRow {
    rowNumber: number;
    rowType: 'HEADER' | 'SUB_HEADER' | 'DATA' | 'BLANK';
    cells: ParsedCell[];
}

export interface ParsedMerge {
    rangeReference: string;
    startRow: number;
    startColumn: number;
    endRow: number;
    endColumn: number;
    rowSpan?: number;
    colSpan?: number;
}

export interface ParsedSheet {
    sheetName: string;
    totalRows: number;
    totalColumns: number;
    fileHash?: string;
    fileSize?: number;
    merges: ParsedMerge[];
    rows: ParsedRow[];
}

interface ExcelPreviewData {
    fileName: string;
    originalName: string;
    totalRows: number;
    totalColumns: number;
    fileHash?: string;
    fileSize?: number;
    data: ParsedSheet;
}

export interface RrhWorkOrderDetailExtended extends RrhWorkOrderDetail {
    excel_structure?: ParsedSheet;
}

const getColLetter = (colIndex: number): string => {
    let temp, letter = '';
    while (colIndex > 0) {
        temp = (colIndex - 1) % 26;
        letter = String.fromCharCode(temp + 65) + letter;
        colIndex = Math.floor((colIndex - temp - 1) / 26);
    }
    return letter;
};

// Exact Spreadsheet Excel Preview Component
const ExcelDataTable: React.FC<{
    sheetData: ParsedSheet;
    emptyMessage?: string;
    maxDisplayRows?: number;
}> = ({ sheetData, emptyMessage = 'No rows to display.', maxDisplayRows }) => {
    if (!sheetData || !sheetData.rows || sheetData.rows.length === 0) {
        return <div className={styles.emptyNotice}>{emptyMessage}</div>;
    }

    const { totalColumns, rows } = sheetData;

    // Separate Header Rows (Row 1 and Row 2) from Data Rows (Row 3+)
    const headerRows = rows.filter(r => r.rowType === 'HEADER' || r.rowType === 'SUB_HEADER' || r.rowNumber <= 2);
    const dataRows = rows.filter(r => r.rowType !== 'HEADER' && r.rowType !== 'SUB_HEADER' && r.rowNumber > 2);
    const displayedDataRows = maxDisplayRows ? dataRows.slice(0, maxDisplayRows) : dataRows;

    return (
        <div style={{ overflowX: 'auto', maxWidth: '100%', maxHeight: '600px', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
            <table className={styles.previewTable} style={{ whiteSpace: 'nowrap', borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                    {/* Top Spreadsheet Coordinate Bar (#, A, B, C, ... AF) */}
                    <tr style={{ background: '#f1f5f9' }}>
                        <th style={{ width: '45px', position: 'sticky', top: 0, left: 0, zIndex: 4, background: '#e2e8f0', borderRight: '2px solid #cbd5e1', borderBottom: '2px solid #cbd5e1', textAlign: 'center', fontSize: '0.75rem', color: '#64748b' }}>
                            #
                        </th>
                        {Array.from({ length: totalColumns }).map((_, i) => (
                            <th key={`coord-${i}`} style={{ position: 'sticky', top: 0, zIndex: 3, background: '#f1f5f9', padding: '4px 8px', borderRight: '1px solid #cbd5e1', borderBottom: '2px solid #cbd5e1', textAlign: 'center', fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>
                                {getColLetter(i + 1)}
                            </th>
                        ))}
                    </tr>

                    {/* Exact Excel Row 1 & Row 2 Headers */}
                    {headerRows.map((row) => (
                        <tr key={`hdr-row-${row.rowNumber}`} style={{ background: row.rowNumber === 1 ? '#e0e7ff' : '#f8fafc' }}>
                            <th style={{ width: '45px', position: 'sticky', left: 0, zIndex: 2, background: row.rowNumber === 1 ? '#c7d2fe' : '#e2e8f0', borderRight: '2px solid #cbd5e1', borderBottom: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 700, fontSize: '0.8rem', color: '#374151' }}>
                                {row.rowNumber}
                            </th>
                            {row.cells.map((cell) => {
                                if (cell.mergeType === 'SLAVE') {
                                    return null; // Skip cells covered by master merge
                                }

                                const isMaster = cell.mergeType === 'MASTER';
                                const rowSpan = isMaster && cell.rowSpan ? cell.rowSpan : 1;
                                const colSpan = isMaster && cell.colSpan ? cell.colSpan : 1;
                                const val = String(cell.displayValue ?? cell.v ?? cell.rawValue ?? '');

                                return (
                                    <th
                                        key={`hdr-cell-${row.rowNumber}-${cell.columnNumber ?? cell.c}`}
                                        rowSpan={rowSpan}
                                        colSpan={colSpan}
                                        title={val}
                                        style={{
                                            padding: row.rowNumber === 1 ? '8px 12px' : '6px 10px',
                                            border: '1px solid #cbd5e1',
                                            textAlign: colSpan > 1 || isMaster ? 'center' : 'left',
                                            verticalAlign: 'middle',
                                            fontWeight: 700,
                                            fontSize: row.rowNumber === 1 ? '0.85rem' : '0.75rem',
                                            color: row.rowNumber === 1 ? '#1e1b4b' : '#334155',
                                            background: row.rowNumber === 1 ? '#e0e7ff' : '#f8fafc',
                                            textTransform: row.rowNumber === 1 ? 'uppercase' : 'none'
                                        }}
                                    >
                                        {val}
                                    </th>
                                );
                            })}
                        </tr>
                    ))}
                </thead>
                <tbody>
                    {displayedDataRows.length === 0 ? (
                        <tr>
                            <td colSpan={totalColumns + 1} className={styles.emptyNotice}>
                                {emptyMessage}
                            </td>
                        </tr>
                    ) : (
                        displayedDataRows.map((row) => (
                            <tr key={`data-row-${row.rowNumber}`} style={{ background: row.rowNumber % 2 === 0 ? '#f8fafc' : '#ffffff' }}>
                                <td style={{ width: '45px', fontWeight: 600, color: '#64748b', position: 'sticky', left: 0, background: row.rowNumber % 2 === 0 ? '#f1f5f9' : '#ffffff', zIndex: 1, borderRight: '2px solid #cbd5e1', borderBottom: '1px solid #e2e8f0', textAlign: 'center', fontSize: '0.8rem' }}>
                                    {row.rowNumber}
                                </td>
                                {row.cells.map((cell) => {
                                    if (cell.mergeType === 'SLAVE') {
                                        return null;
                                    }

                                    const isMaster = cell.mergeType === 'MASTER';
                                    const rowSpan = isMaster && cell.rowSpan ? cell.rowSpan : 1;
                                    const colSpan = isMaster && cell.colSpan ? cell.colSpan : 1;
                                    const val = String(cell.displayValue ?? cell.v ?? cell.rawValue ?? '');

                                    return (
                                        <td
                                            key={`cell-${row.rowNumber}-${cell.columnNumber ?? cell.c}`}
                                            rowSpan={rowSpan}
                                            colSpan={colSpan}
                                            title={val}
                                            style={{
                                                padding: '6px 10px',
                                                border: '1px solid #e2e8f0',
                                                textAlign: colSpan > 1 ? 'center' : 'left',
                                                verticalAlign: 'top',
                                                fontSize: '0.85rem'
                                            }}
                                        >
                                            {val}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
};

export const RrhWorkOrder: React.FC = () => {
    const navigate = useNavigate();
    const { user, permissions = [] } = useAuth();
    const { showToast } = useToast();

    const isSuperAdmin = user?.role === 'Super Admin';
    const canDelete = isSuperAdmin || permissions.some(p => p.permission_key === 'rrh_work_order' && p.can_delete);

    // Form states
    const [workOrderId, setWorkOrderId] = useState('');
    const [workOrderDate, setWorkOrderDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [lotQuantity, setLotQuantity] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [tempFileName, setTempFileName] = useState<string | null>(null);
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
                setTempFileName(result.fileName);
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
            setTempFileName(null);
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

        if (file.size > 100 * 1024 * 1024) {
            const errorMsg = 'File size exceeds 100MB limit.';
            setFormError(errorMsg);
            showToast(errorMsg, 'error');
            return;
        }

        setSelectedFile(file);
        parseExcel(file);
    };

    const handleClearFile = async () => {
        if (tempFileName) {
            try {
                await apiFetch(`/api/rrh/work-orders/temp-file/${encodeURIComponent(tempFileName)}`, { method: 'DELETE' });
            } catch (e) {
                console.warn('Failed to delete temp file:', e);
            }
        }
        setSelectedFile(null);
        setExcelPreview(null);
        setTempFileName(null);
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

        if (!selectedFile && !tempFileName) {
            setFormError('Please select and upload an Excel file.');
            return;
        }

        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('work_order_id', woIdTrimmed);
            formData.append('work_order_date', workOrderDate);
            formData.append('lot_quantity', qtyNum.toString());

            if (tempFileName) {
                formData.append('temp_filename', tempFileName);
            }
            if (selectedFile) {
                formData.append('original_filename', selectedFile.name);
                formData.append('file', selectedFile);
            }

            const result = await apiFetch('/api/rrh/work-orders', {
                method: 'POST',
                body: formData
            });

            if (result.success) {
                showToast(result.message || `RRH Work Order "${woIdTrimmed}" saved successfully!`, 'success');
                setSelectedFile(null);
                setExcelPreview(null);
                setTempFileName(null);
                setWorkOrderId('');
                setWorkOrderDate(new Date().toISOString().split('T')[0]);
                setLotQuantity('');
                setFormError('');
                if (fileInputRef.current) fileInputRef.current.value = '';
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
                fetchWorkOrders();
            } else {
                throw new Error(res.error || 'Failed to delete RRH Work Order.');
            }
        } catch (err: any) {
            showToast(err.message || 'Failed to delete RRH Work Order.', 'error');
        }
    };

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
                            Create and manage Remote Radio Head (RRH) Work Orders and exact Excel master datasets independently.
                        </p>
                    </div>
                </div>
            </div>

            {/* Creation Form Card */}
            <div className={styles.card}>
                <div className={styles.cardHeader}>
                    <h2 className={styles.cardTitle}>
                        <FileSpreadsheet size={20} color="#4f46e5" />
                        Create or Replace RRH Work Order
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
                                    Supports Microsoft Excel (.xlsx, .xls) up to 100MB
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
                                            {isParsingExcel && ' • Parsing exact preview...'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className={styles.removeFileBtn}
                                    onClick={handleClearFile}
                                    title="Remove file and cleanup temp storage"
                                >
                                    <X size={16} /> Remove File
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Live Exact Preview Card */}
                    {excelPreview && !isParsingExcel && (
                        <div className={styles.previewBox}>
                            <div className={styles.previewStats}>
                                <div className={styles.statItem}>
                                    <FileText size={16} color="#6366f1" />
                                    <span>File:</span>
                                    <span className={styles.statValue}>{excelPreview.originalName || excelPreview.fileName}</span>
                                </div>
                                <div className={styles.statItem}>
                                    <Layers size={16} color="#059669" />
                                    <span>Sheet:</span>
                                    <span className={styles.statValue}>"{excelPreview.data.sheetName}"</span>
                                </div>
                                <div className={styles.statItem}>
                                    <Layers size={16} color="#059669" />
                                    <span>Columns:</span>
                                    <span className={styles.statValue}>{excelPreview.totalColumns}</span>
                                </div>
                                <div className={styles.statItem}>
                                    <CheckCircle2 size={16} color="#0284c7" />
                                    <span>Total Rows:</span>
                                    <span className={styles.statValue}>{excelPreview.totalRows}</span>
                                </div>
                                <div className={styles.statItem} style={{ marginLeft: 'auto', color: '#64748b', fontSize: '0.8rem' }}>
                                    (Exact Excel Preview • Row 1 & Row 2 Preserved)
                                </div>
                            </div>

                            <div className={styles.previewTableWrapper} style={{ maxHeight: '450px' }}>
                                <ExcelDataTable sheetData={excelPreview.data} maxDisplayRows={150} />
                            </div>
                            {excelPreview.data.rows.length > 152 && (
                                <div style={{ padding: '6px 12px', background: '#f8fafc', fontSize: '0.8rem', color: '#64748b', borderTop: '1px solid #e2e8f0', textAlign: 'center' }}>
                                    Showing preview of first 150 rows. All {excelPreview.totalRows} rows will be fully saved upon creation.
                                </div>
                            )}
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
                            disabled={isSubmitting || isParsingExcel || !workOrderId.trim() || !lotQuantity || (!selectedFile && !tempFileName)}
                        >
                            {isSubmitting ? (
                                <>
                                    <span className={styles.spinner} />
                                    Saving Work Order & Master Data...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 size={18} />
                                    Save / Replace Work Order
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

            {/* Created RRH Work Orders Directory */}
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
                                                    onClick={() => navigate(`/rrh/work-order/master-view/${wo.id}`)}
                                                    title="View Full-Page Master Excel Data"
                                                >
                                                    <Eye size={14} /> View
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


        </div>
    );
};
