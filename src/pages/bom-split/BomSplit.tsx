import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../../utils/api';
import styles from './BomSplit.module.css';
import { 
    Upload, Play, RefreshCw, Download, 
    FileSpreadsheet, Eye, User, Calendar, 
    Clock, ArrowLeft, ArrowRight, Search, FileText, AlertCircle, CheckCircle2,
    Trash2, X
} from 'lucide-react';

interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
}

export const BomSplit: React.FC = () => {
    // Toast Notifications
    const [toasts, setToasts] = useState<Toast[]>([]);
    const toastId = useRef(0);
    const addToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        const id = toastId.current++;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    };


    // Current View: 'list' (Landing/History Archive) | 'detail' (Dedicated Dashboard)
    const [activeView, setActiveView] = useState<'list' | 'detail'>('list');
    const [activeBomId, setActiveBomId] = useState<number | null>(null);
    const [bomDetails, setBomDetails] = useState<any | null>(null);
    const [editorItems, setEditorItems] = useState<any[]>([]);
    const [editorStats, setEditorStats] = useState<any | null>(null);
    const [detailLoading, setDetailLoading] = useState<boolean>(false);

    // Initial Upload Modal
    const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadLoading, setUploadLoading] = useState<boolean>(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [uploadDragActive, setUploadDragActive] = useState<boolean>(false);
    const initialFileInputRef = useRef<HTMLInputElement>(null);

    // Re-upload Modal
    const [isReuploadModalOpen, setIsReuploadModalOpen] = useState<boolean>(false);
    const [reuploadFile, setReuploadFile] = useState<File | null>(null);
    const [reuploadRemarks, setReuploadRemarks] = useState<string>('');
    const [reuploadLoading, setReuploadLoading] = useState<boolean>(false);
    const [reuploadError, setReuploadError] = useState<string | null>(null);
    const [reuploadDragActive, setReuploadDragActive] = useState<boolean>(false);
    const reuploadFileInputRef = useRef<HTMLInputElement>(null);

    // Parse Again Modal
    const [isParseAgainModalOpen, setIsParseAgainModalOpen] = useState<boolean>(false);
    const [parseAgainRemarks, setParseAgainRemarks] = useState<string>('');
    const [parseAgainLoading, setParseAgainLoading] = useState<boolean>(false);

    // Delete BOM Modal
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
    const [deleteLoading, setDeleteLoading] = useState<boolean>(false);

    // Work With BOM Local Filters
    const [editorSearchQuery, setEditorSearchQuery] = useState<string>('');
    const [editorStatusFilter, setEditorStatusFilter] = useState<'All' | 'Completed' | 'Pending'>('All');

    // Inline Editing state
    const [editingCell, setEditingCell] = useState<{ itemId: number; field: 'qty' | 'ref'; value: string } | null>(null);
    const [savingCellId, setSavingCellId] = useState<number | null>(null);

    // History Archive Landing Page State
    const [historyRecords, setHistoryRecords] = useState<any[]>([]);
    const [historyTotal, setHistoryTotal] = useState<number>(0);
    const [historyPage, setHistoryPage] = useState<number>(1);
    const [historyLimit] = useState<number>(10);
    const [historyLoading, setHistoryLoading] = useState<boolean>(false);

    // History Filters
    const [filterFileName, setFilterFileName] = useState<string>('');
    const [filterVersion, setFilterVersion] = useState<string>('');
    const [filterUploadedBy, setFilterUploadedBy] = useState<string>('');
    const [filterDate, setFilterDate] = useState<string>('');
    const [filterStatus, setFilterStatus] = useState<string>('');

    // Audit Logs State (inside Detail View)
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [auditTotal, setAuditTotal] = useState<number>(0);
    const [auditPage, setAuditPage] = useState<number>(1);
    const [auditLimit] = useState<number>(10);
    const [auditSearch, setAuditSearch] = useState<string>('');
    const [localAuditSearch, setLocalAuditSearch] = useState<string>('');
    const [auditSortBy, setAuditSortBy] = useState<string>('id');
    const [auditSortOrder, setAuditSortOrder] = useState<'ASC' | 'DESC'>('DESC');
    const [auditLogsLoading, setAuditLogsLoading] = useState<boolean>(false);

    // Load history when landing list view is open
    useEffect(() => {
        if (activeView === 'list') {
            fetchHistoryList();
        }
    }, [activeView, historyPage]);

    // Load detailed BOM view when active ID is set
    useEffect(() => {
        if (activeBomId) {
            fetchBomDetail(activeBomId);
        }
    }, [activeBomId]);

    // Load Audit Logs when details view variables change
    useEffect(() => {
        if (activeBomId && activeView === 'detail') {
            fetchAuditLogs(activeBomId);
        }
    }, [activeBomId, activeView, auditPage, auditSearch, auditSortBy, auditSortOrder]);

    // Fetch list of upload history
    const fetchHistoryList = async (pageOverride?: number, resetFilters?: boolean) => {
        setHistoryLoading(true);
        try {
            const targetPage = pageOverride !== undefined ? pageOverride : historyPage;
            const queryParams = new URLSearchParams({
                page: targetPage.toString(),
                limit: historyLimit.toString(),
                fileName: resetFilters ? '' : filterFileName,
                version: resetFilters ? '' : filterVersion,
                uploadedBy: resetFilters ? '' : filterUploadedBy,
                uploadDate: resetFilters ? '' : filterDate,
                parseStatus: resetFilters ? '' : filterStatus
            });
            const data = await apiFetch(`/api/smt/bom-split/history?${queryParams.toString()}`);
            if (data && data.success) {
                setHistoryRecords(data.records ?? []);
                setHistoryTotal(data.totalItems ?? 0);
            }
        } catch (err: any) {
            addToast('Failed to fetch BOM history list.', 'error');
        } finally {
            setHistoryLoading(false);
        }
    };

    // Clear filters in landing list
    const handleClearFilters = () => {
        setFilterFileName('');
        setFilterVersion('');
        setFilterUploadedBy('');
        setFilterDate('');
        setFilterStatus('');
        setHistoryPage(1);
        setTimeout(() => {
            fetchHistoryList();
        }, 50);
    };

    // Load detailed BOM data
    const fetchBomDetail = async (id: number) => {
        setDetailLoading(true);
        try {
            const data = await apiFetch(`/api/smt/bom-split/detail/${id}`);
            if (data && data.success) {
                setBomDetails(data.bom ?? null);
                setEditorItems(data.items ?? []);
                setEditorStats(data.stats ?? null);
            } else {
                throw new Error(data?.error || 'Failed to fetch BOM details.');
            }
        } catch (err: any) {
            addToast(err.message || 'Error loading BOM detail.', 'error');
            setActiveView('list');
        } finally {
            setDetailLoading(false);
        }
    };

    // Fetch Audit Logs paginated and sorted
    const fetchAuditLogs = async (id: number) => {
        setAuditLogsLoading(true);
        try {
            const queryParams = new URLSearchParams({
                bomHistoryId: id.toString(),
                page: auditPage.toString(),
                limit: auditLimit.toString(),
                search: auditSearch,
                sortBy: auditSortBy,
                sortOrder: auditSortOrder
            });
            const data = await apiFetch(`/api/smt/bom-split/audit-logs?${queryParams.toString()}`);
            if (data && data.success) {
                setAuditLogs(data.logs ?? []);
                setAuditTotal(data.totalItems ?? 0);
            }
        } catch (err: any) {
            console.error('Audit logs fetch error:', err);
        } finally {
            setAuditLogsLoading(false);
        }
    };

    const handleAuditSort = (column: string) => {
        if (auditSortBy === column) {
            setAuditSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC');
        } else {
            setAuditSortBy(column);
            setAuditSortOrder('DESC');
        }
        setAuditPage(1);
    };

    // Handle initial file selection/drag
    const handleFileDrag = (e: React.DragEvent, type: 'upload' | 'reupload') => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            if (type === 'upload') setUploadDragActive(true);
            else setReuploadDragActive(true);
        } else if (e.type === "dragleave") {
            if (type === 'upload') setUploadDragActive(false);
            else setReuploadDragActive(false);
        }
    };

    const handleFileDrop = (e: React.DragEvent, type: 'upload' | 'reupload') => {
        e.preventDefault();
        e.stopPropagation();
        if (type === 'upload') {
            setUploadDragActive(false);
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                validateAndSetFile(e.dataTransfer.files[0], 'upload');
            }
        } else {
            setReuploadDragActive(false);
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                validateAndSetFile(e.dataTransfer.files[0], 'reupload');
            }
        }
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'upload' | 'reupload') => {
        if (e.target.files && e.target.files[0]) {
            validateAndSetFile(e.target.files[0], type);
        }
    };

    const validateAndSetFile = (file: File, type: 'upload' | 'reupload') => {
        const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        if (ext !== '.xlsx' && ext !== '.xls') {
            addToast('Only Excel workbooks (.xlsx, .xls) are allowed.', 'error');
            return;
        }
        if (file.size > 50 * 1024 * 1024) {
            addToast('File size must not exceed 50MB.', 'error');
            return;
        }
        if (type === 'upload') {
            setUploadFile(file);
            setUploadError(null);
        } else {
            setReuploadFile(file);
            setReuploadError(null);
        }
    };

    // Actions
    const handleInitialUploadSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!uploadFile) return;
        setUploadLoading(true);
        setUploadError(null);

        const formData = new FormData();
        formData.append('file', uploadFile);

        try {
            const res = await apiFetch('/api/smt/bom-split/parse', {
                method: 'POST',
                body: formData
            });

            if (res && res.success) {
                addToast('Workbook parsed and transformed successfully!', 'success');
                setIsUploadModalOpen(false);
                setUploadFile(null);
                
                // Immediately refresh BOM history data and reset state variables to direct user to list
                setHistoryPage(1);
                setFilterFileName('');
                setFilterVersion('');
                setFilterUploadedBy('');
                setFilterDate('');
                setFilterStatus('');
                
                setActiveBomId(null);
                setActiveView('list');
                
                await fetchHistoryList(1, true);
            } else {
                throw new Error(res?.error || 'Failed to parse workbook.');
            }
        } catch (err: any) {
            setUploadError(err.message || 'An error occurred during parse.');
            addToast(err.message || 'Parsing failed.', 'error');
        } finally {
            setUploadLoading(false);
        }
    };

    const handleReuploadSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reuploadFile || !activeBomId) return;
        setReuploadLoading(true);
        setReuploadError(null);

        const formData = new FormData();
        formData.append('file', reuploadFile);
        formData.append('reupload', 'true');
        formData.append('existingId', activeBomId.toString());
        formData.append('remarks', reuploadRemarks || 'Re-uploading new file version.');

        try {
            const res = await apiFetch('/api/smt/bom-split/parse', {
                method: 'POST',
                body: formData
            });

            if (res && res.success) {
                addToast('Workbook re-uploaded successfully!', 'success');
                setIsReuploadModalOpen(false);
                setReuploadFile(null);
                setReuploadRemarks('');
                await fetchBomDetail(activeBomId);
                await fetchAuditLogs(activeBomId);
            } else {
                throw new Error(res?.error || 'Failed to re-upload.');
            }
        } catch (err: any) {
            setReuploadError(err.message || 'An error occurred during re-upload.');
            addToast(err.message || 'Re-upload failed.', 'error');
        } finally {
            setReuploadLoading(false);
        }
    };

    const handleParseAgainSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeBomId) return;
        setParseAgainLoading(true);

        try {
            const res = await apiFetch(`/api/smt/bom-split/parse-again/${activeBomId}`, {
                method: 'POST',
                body: JSON.stringify({
                    remarks: parseAgainRemarks || 'Parsed original BOM workbook again.'
                })
            });

            if (res && res.success) {
                addToast('Original workbook parsed again successfully!', 'success');
                setIsParseAgainModalOpen(false);
                setParseAgainRemarks('');
                await fetchBomDetail(activeBomId);
                await fetchAuditLogs(activeBomId);
            } else {
                throw new Error(res?.error || 'Failed to re-parse original file.');
            }
        } catch (err: any) {
            addToast(err.message || 'Parse Again failed.', 'error');
        } finally {
            setParseAgainLoading(false);
        }
    };

    const handleDeleteSubmit = async () => {
        if (!activeBomId) return;
        setDeleteLoading(true);

        try {
            const res = await apiFetch(`/api/smt/bom-split/history/${activeBomId}`, {
                method: 'DELETE'
            });

            if (res && res.success) {
                addToast('BOM split session deleted successfully.', 'success');
                setIsDeleteModalOpen(false);
                setActiveBomId(null);
                setActiveView('list');
                fetchHistoryList();
            } else {
                throw new Error(res?.error || 'Failed to delete BOM split history.');
            }
        } catch (err: any) {
            addToast(err.message || 'Failed to delete BOM.', 'error');
        } finally {
            setDeleteLoading(false);
        }
    };

    // Save inline edit (Qty or Ref)
    const handleSaveInlineEdit = async (itemId: number, field: 'qty' | 'ref', value: string) => {
        setSavingCellId(itemId);
        try {
            const res = await apiFetch(`/api/smt/bom-split/items/${itemId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    [field]: value
                })
            });
            if (res && res.success) {
                addToast('Component updated successfully.', 'success');
                if (activeBomId) {
                    await fetchBomDetail(activeBomId);
                    await fetchAuditLogs(activeBomId);
                }
                setEditingCell(null);
            } else {
                throw new Error(res?.error || 'Failed to save edits.');
            }
        } catch (err: any) {
            addToast(err.message || 'Failed to save cell edit.', 'error');
        } finally {
            setSavingCellId(null);
        }
    };

    // Download Handler
    const handleDownloadFile = async (type: 'original' | 'processed') => {
        if (!activeBomId || !bomDetails) return;
        try {
            addToast('Downloading workbook...', 'info');
            const blob = await apiFetch(`/api/smt/bom-split/download/${activeBomId}/${type}`);
            const url = window.URL.createObjectURL(blob as Blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = type === 'original' 
                ? (bomDetails.original_file_name || 'BOM_Original.xlsx')
                : `BOM_Split_V${bomDetails.version || '1.0'}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            addToast('Download complete.', 'success');
        } catch (err: any) {
            addToast('Failed to download file.', 'error');
        }
    };

    // Dynamic Employee formatter
    const formatEmployee = (name: string | null | undefined, code: string | null | undefined): string => {
        const cleanName = name && name.toString().trim() !== '' && name.toString().toLowerCase() !== 'null' && name.toString().toLowerCase() !== 'undefined' ? name.toString().trim() : null;
        const cleanCode = code && code.toString().trim() !== '' && code.toString().toLowerCase() !== 'null' && code.toString().toLowerCase() !== 'undefined' ? code.toString().trim() : null;

        if (cleanName && cleanCode) {
            return `${cleanName} (${cleanCode})`;
        }
        if (cleanName) {
            return cleanName;
        }
        if (cleanCode) {
            return cleanCode;
        }
        return 'Unknown';
    };

    const getRowSpan = (rows: any[], rowIndex: number, colIndex: number, headers: string[]) => {
        const header = headers[colIndex]?.toLowerCase().trim();
        const isSlNo = colIndex === 0;
        const isCpn = header === 'customer part number' || header === 'customer part no' || header === 'cpn';
        const isDesc = header === 'description' || header === 'desc';
        const isQty = header === 'qty';
        const isRef = header === 'ref';

        if (!isSlNo && !isCpn && !isDesc && !isQty && !isRef) {
            return 1;
        }

        const currentRecord = rows[rowIndex];
        if (!currentRecord) return 1;

        const currentSlNo = currentRecord.slNo;

        if (rowIndex > 0) {
            const prevRecord = rows[rowIndex - 1];
            if (prevRecord) {
                const prevSlNo = prevRecord.slNo;

                if (prevSlNo === currentSlNo) {
                    if (isDesc) {
                        const groupRows = rows.filter(r => r.slNo === currentSlNo);
                        const firstDesc = groupRows[0]?.description;
                        const allDescIdentical = groupRows.every(r => r.description === firstDesc);
                        if (allDescIdentical) {
                            return 0; // Merged
                        }
                    } else if (isQty || isRef) {
                        return 0; // Merged
                    } else {
                        const currentValue = isSlNo ? currentRecord.slNo : currentRecord.cpn;
                        const prevValue = isSlNo ? prevRecord.slNo : prevRecord.cpn;
                        if (prevValue === currentValue) {
                            return 0; // Merged
                        }
                    }
                }
            }
        }

        let span = 1;
        for (let i = rowIndex + 1; i < rows.length; i++) {
            const nextRecord = rows[i];
            if (!nextRecord) break;

            const nextSlNo = nextRecord.slNo;

            if (nextSlNo === currentSlNo) {
                if (isDesc) {
                    const groupRows = rows.filter(r => r.slNo === currentSlNo);
                    const firstDesc = groupRows[0]?.description;
                    const allDescIdentical = groupRows.every(r => r.description === firstDesc);
                    if (allDescIdentical) {
                        span++;
                    } else {
                        break;
                    }
                } else if (isQty || isRef) {
                    span++;
                } else {
                    const currentValue = isSlNo ? currentRecord.slNo : currentRecord.cpn;
                    const nextValue = isSlNo ? nextRecord.slNo : nextRecord.cpn;
                    if (nextValue === currentValue) {
                        span++;
                    } else {
                        break;
                    }
                }
            } else {
                break;
            }
        }

        return span;
    };

    // Safely format bytes
    const formatBytes = (bytes: number | null | undefined) => {
        if (bytes === undefined || bytes === null || isNaN(bytes)) return '0 B';
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Setup presentation Sl No & filters for editor
    const itemsWithSlNo = React.useMemo(() => {
        let currentSlNo = 0;
        let prevCpn = '';
        return (editorItems ?? []).map(item => {
            if (item.cpn !== prevCpn) {
                currentSlNo++;
                prevCpn = item.cpn;
            }
            return {
                ...item,
                slNo: currentSlNo
            };
        });
    }, [editorItems]);

    const filteredEditorItems = React.useMemo(() => {
        return itemsWithSlNo.filter(item => {
            const matchesSearch = 
                (item.cpn ?? '').toLowerCase().includes(editorSearchQuery.toLowerCase()) ||
                (item.description ?? '').toLowerCase().includes(editorSearchQuery.toLowerCase()) ||
                (item.mfr ?? '').toLowerCase().includes(editorSearchQuery.toLowerCase()) ||
                (item.mfr_part_no ?? '').toLowerCase().includes(editorSearchQuery.toLowerCase());
                
            const matchesStatus = 
                editorStatusFilter === 'All' ||
                (editorStatusFilter === 'Completed' && item.status === 'Completed') ||
                (editorStatusFilter === 'Pending' && item.status === 'Pending');
                
            return matchesSearch && matchesStatus;
        });
    }, [itemsWithSlNo, editorSearchQuery, editorStatusFilter]);

    const renderAuditLogsTable = () => {
        return (
            <div className={styles.card} style={{ marginTop: '2rem' }}>
                <h4 className={styles.sectionTitle}>Audit History</h4>
                
                {/* Search control */}
                <form 
                    onSubmit={(e) => {
                        e.preventDefault();
                        setAuditSearch(localAuditSearch);
                        setAuditPage(1);
                    }}
                    style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', maxWidth: '400px' }}
                >
                    <input
                        type="text"
                        className={styles.filterInput}
                        placeholder="Search audit remarks..."
                        value={localAuditSearch}
                        onChange={(e) => setLocalAuditSearch(e.target.value)}
                    />
                    <button type="submit" className={`${styles.button} ${styles.btnPrimary}`}>
                        <Search size={14} /> Search
                    </button>
                    {auditSearch && (
                        <button 
                            type="button" 
                            className={`${styles.button} ${styles.btnSecondary}`}
                            onClick={() => {
                                setLocalAuditSearch('');
                                setAuditSearch('');
                                setAuditPage(1);
                            }}
                        >
                            Clear
                        </button>
                    )}
                </form>

                <div className={styles.tableWrapper}>
                    <table className={styles.previewTable}>
                        <thead>
                            <tr>
                                <th onClick={() => handleAuditSort('version')} style={{ cursor: 'pointer' }}>
                                    Version {auditSortBy === 'version' ? (auditSortOrder === 'ASC' ? '▲' : '▼') : ''}
                                </th>
                                <th onClick={() => handleAuditSort('action')} style={{ cursor: 'pointer' }}>
                                    Action {auditSortBy === 'action' ? (auditSortOrder === 'ASC' ? '▲' : '▼') : ''}
                                </th>
                                <th onClick={() => handleAuditSort('employee_name')} style={{ cursor: 'pointer' }}>
                                    Employee {auditSortBy === 'employee_name' ? (auditSortOrder === 'ASC' ? '▲' : '▼') : ''}
                                </th>
                                <th onClick={() => handleAuditSort('created_at')} style={{ cursor: 'pointer' }}>
                                    Date & Time {auditSortBy === 'created_at' ? (auditSortOrder === 'ASC' ? '▲' : '▼') : ''}
                                </th>
                                <th onClick={() => handleAuditSort('status')} style={{ cursor: 'pointer' }}>
                                    Status {auditSortBy === 'status' ? (auditSortOrder === 'ASC' ? '▲' : '▼') : ''}
                                </th>
                                <th onClick={() => handleAuditSort('remarks')} style={{ cursor: 'pointer' }}>
                                    Remarks {auditSortBy === 'remarks' ? (auditSortOrder === 'ASC' ? '▲' : '▼') : ''}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {auditLogsLoading ? (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>
                                        <Spinner /> Loading audit records...
                                    </td>
                                </tr>
                            ) : (auditLogs?.length ?? 0) === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                        No audit entries found.
                                    </td>
                                </tr>
                            ) : (
                                auditLogs.map(log => (
                                    <tr key={log.id}>
                                        <td style={{ fontWeight: 600 }}>V{log.version}</td>
                                        <td style={{ fontWeight: 700 }}>{log.action}</td>
                                        <td>{formatEmployee(log.employee_name, log.employee_code)}</td>
                                        <td>{new Date(log.created_at).toLocaleString()}</td>
                                        <td>
                                            <span className={log.status === 'SUCCESS' ? styles.statusCompleted : styles.statusPending}>
                                                {log.status}
                                            </span>
                                        </td>
                                        <td style={{ fontStyle: 'italic', maxWidth: '300px', wordBreak: 'break-word' }}>
                                            {log.remarks}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Audit pagination */}
                {auditTotal > auditLimit && (
                    <div className={styles.pagination}>
                        <span>
                            Showing {(auditPage - 1) * auditLimit + 1} to {Math.min(auditPage * auditLimit, auditTotal)} of {auditTotal} audit entries
                        </span>
                        <div className={styles.paginationButtons}>
                            <button 
                                className={styles.miniBtn}
                                disabled={auditPage === 1}
                                onClick={() => setAuditPage(p => Math.max(1, p - 1))}
                            >
                                <ArrowLeft size={12} /> Previous
                            </button>
                            <button 
                                className={styles.miniBtn}
                                disabled={auditPage * auditLimit >= auditTotal}
                                onClick={() => setAuditPage(p => p + 1)}
                            >
                                Next <ArrowRight size={12} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // Spinner
    const Spinner: React.FC = () => (
        <svg className={styles.spinner} width="18" height="18" viewBox="0 0 50 50">
            <circle className={styles.spinnerCircle} cx="25" cy="25" r="20" fill="none" strokeWidth="5"></circle>
        </svg>
    );

    return (
        <div className={styles.container}>
            {/* Toaster element */}
            <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 9999, display: 'flex', flexDirection: 'column-reverse', gap: '0.5rem' }}>
                {toasts?.map(t => (
                    <div key={t.id} style={{
                        padding: '0.85rem 1.25rem', borderRadius: '0.6rem', minWidth: '280px',
                        background: t.type === 'error' ? '#fee2e2' : t.type === 'success' ? '#dcfce7' : '#fffbeb',
                        color: t.type === 'error' ? '#991b1b' : t.type === 'success' ? '#166534' : '#92400e',
                        border: `1px solid ${t.type === 'error' ? '#fca5a5' : t.type === 'success' ? '#86efac' : '#fde68a'}`,
                        fontWeight: 600, fontSize: '0.9rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    }}>
                        {t.type === 'error' ? '❌ ' : t.type === 'success' ? '✅ ' : 'ℹ️ '}{t.message}
                    </div>
                ))}
            </div>

            {activeView === 'list' ? (
                /* LANDING VIEW: BOM History List */
                <>
                    <div className={styles.header}>
                        <div className={styles.headerTitle}>
                            <h2>BOM Split Module</h2>
                            <p>Split, clean, group, and vertically merge Customer Part Number BOM workbooks</p>
                        </div>
                    </div>

                    <div className={styles.card}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                            <h3 style={{ margin: 0, border: 'none', padding: 0 }}>BOM Upload History & Archive</h3>
                            <button className={`${styles.button} ${styles.btnPrimary}`} onClick={() => setIsUploadModalOpen(true)}>
                                <Upload size={16} /> Upload New BOM
                            </button>
                        </div>

                        {/* Filter controls row */}
                        <div className={styles.filtersRow}>
                            <div className={styles.filterGroup}>
                                <label>File Name</label>
                                <input 
                                    className={styles.filterInput}
                                    type="text"
                                    placeholder="Search by file..."
                                    value={filterFileName}
                                    onChange={(e) => setFilterFileName(e.target.value)}
                                />
                            </div>
                            <div className={styles.filterGroup}>
                                <label>BOM Version</label>
                                <input 
                                    className={styles.filterInput}
                                    type="text"
                                    placeholder="e.g. 1.0"
                                    value={filterVersion}
                                    onChange={(e) => setFilterVersion(e.target.value)}
                                />
                            </div>
                            <div className={styles.filterGroup}>
                                <label>Uploaded By</label>
                                <input 
                                    className={styles.filterInput}
                                    type="text"
                                    placeholder="Employee name/code..."
                                    value={filterUploadedBy}
                                    onChange={(e) => setFilterUploadedBy(e.target.value)}
                                />
                            </div>
                            <div className={styles.filterGroup}>
                                <label>Upload Date</label>
                                <input 
                                    className={styles.filterInput}
                                    type="date"
                                    value={filterDate}
                                    onChange={(e) => setFilterDate(e.target.value)}
                                />
                            </div>
                            <div className={styles.filterGroup}>
                                <label>Parse Status</label>
                                <select 
                                    className={styles.filterSelect}
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                >
                                    <option value="">All Statuses</option>
                                    <option value="SUCCESS">SUCCESS</option>
                                    <option value="FAILED">FAILED</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button 
                                    className={`${styles.button} ${styles.btnPrimary}`}
                                    onClick={() => { setHistoryPage(1); fetchHistoryList(); }}
                                >
                                    <Search size={16} /> Search
                                </button>
                                <button 
                                    className={`${styles.button} ${styles.btnSecondary}`}
                                    onClick={handleClearFilters}
                                >
                                    Clear
                                </button>
                            </div>
                        </div>

                        {/* History grid list */}
                        {historyLoading ? (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                                <Spinner /> <span style={{ marginLeft: '0.5rem', fontWeight: 600 }}>Loading History Archive...</span>
                            </div>
                        ) : (
                            <>
                                <div className={styles.tableWrapper}>
                                    <table className={styles.historyTable}>
                                        <thead>
                                            <tr>
                                                <th>ID</th>
                                                <th>File Name</th>
                                                <th>Version</th>
                                                <th>Date & Time</th>
                                                <th>Original Size</th>
                                                <th>Uploaded By</th>
                                                <th>Status</th>
                                                <th>Rows</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(historyRecords?.length ?? 0) === 0 ? (
                                                <tr>
                                                    <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                                        No BOM history records found.
                                                    </td>
                                                </tr>
                                            ) : (
                                                historyRecords.map(rec => (
                                                    <tr key={rec.id}>
                                                        <td>{rec.id?.toString().padStart(6, '0')}</td>
                                                        <td style={{ fontWeight: 600, color: '#0f172a' }}>{rec.original_file_name}</td>
                                                        <td>
                                                            <span style={{ backgroundColor: '#eff6ff', color: '#2563eb', padding: '0.2rem 0.5rem', borderRadius: '0.25rem', fontWeight: 600, fontSize: '0.8rem', border: '1px solid #bfdbfe' }}>
                                                                V{rec.version}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', color: '#334155' }}>
                                                                    <Calendar size={12} /> {rec.uploaded_date ? new Date(rec.uploaded_date).toLocaleDateString() : (rec.upload_date ? new Date(rec.upload_date).toLocaleDateString() : '—')}
                                                                </span>
                                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
                                                                    <Clock size={12} /> {rec.uploaded_time || rec.upload_time || '—'}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td>{formatBytes(rec.file_size)}</td>
                                                        <td>
                                                            <span style={{ fontWeight: 600, color: '#334155', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                                                <User size={12} /> {formatEmployee(rec.uploaded_by_name, rec.uploaded_by_code)}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <span className={rec.parse_status === 'SUCCESS' ? styles.statusSuccess : styles.statusFailed}>
                                                                {rec.parse_status}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            {rec.parse_status === 'SUCCESS' ? (
                                                                <span style={{ fontSize: '0.85rem', color: '#334155' }}>
                                                                    {rec.processed_rows} / {rec.original_rows}
                                                                </span>
                                                            ) : '-'}
                                                        </td>
                                                        <td>
                                                            <button 
                                                                className={styles.viewBtn}
                                                                onClick={() => {
                                                                    setActiveBomId(rec.id);
                                                                    setActiveView('detail');
                                                                }}
                                                            >
                                                                <Eye size={14} style={{ marginRight: '6px' }} /> View
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination controls */}
                                {historyTotal > historyLimit && (
                                    <div className={styles.pagination}>
                                        <span>
                                            Showing {(historyPage - 1) * historyLimit + 1} to {Math.min(historyPage * historyLimit, historyTotal)} of {historyTotal} records
                                        </span>
                                        <div className={styles.paginationButtons}>
                                            <button 
                                                className={styles.miniBtn}
                                                disabled={historyPage === 1}
                                                onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                                            >
                                                <ArrowLeft size={14} /> Previous
                                            </button>
                                            <button 
                                                className={styles.miniBtn}
                                                disabled={historyPage * historyLimit >= historyTotal}
                                                onClick={() => setHistoryPage(p => p + 1)}
                                            >
                                                Next <ArrowRight size={14} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </>
            ) : (
                /* DETAILED VIEW: BOM Split Dashboard */
                <>
                    <div className={styles.header}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <button 
                                className={`${styles.button} ${styles.btnSecondary}`} 
                                onClick={() => {
                                    setActiveView('list');
                                    setActiveBomId(null);
                                    setBomDetails(null);
                                    setEditorItems([]);
                                }}
                            >
                                <ArrowLeft size={16} /> Back to Archive
                            </button>
                            <div className={styles.headerTitle}>
                                <h2>BOM Management Dashboard</h2>
                                <p style={{ fontSize: '0.85rem' }}>Detail analysis, editing, and compliance tracking</p>
                            </div>
                        </div>
                    </div>

                    {detailLoading || !bomDetails ? (
                        <div className={styles.card} style={{ display: 'flex', justifyContent: 'center', padding: '5rem', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                            <Spinner />
                            <span style={{ fontWeight: 600, color: '#475569' }}>Retrieving BOM details and components...</span>
                        </div>
                    ) : (
                        <>
                            {/* Section 1: BOM Info Card */}
                            <div className={styles.detailsSection}>
                                <h4 className={styles.sectionTitle}>BOM Information</h4>
                                <div className={styles.detailsGrid}>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Model Name</span>
                                        <span className={styles.detailValue} style={{ fontWeight: 700 }}>
                                            {bomDetails.original_file_name ? bomDetails.original_file_name.substring(0, bomDetails.original_file_name.lastIndexOf('.')) : '—'}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>BOM Version</span>
                                        <span className={styles.detailValue}>
                                            <span style={{ backgroundColor: '#eff6ff', color: '#2563eb', padding: '0.15rem 0.4rem', borderRadius: '0.25rem', fontWeight: 600, fontSize: '0.8rem', border: '1px solid #bfdbfe' }}>
                                                V{bomDetails.version}
                                            </span>
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Uploaded By</span>
                                        <span className={styles.detailValue}>
                                            {formatEmployee(bomDetails.uploaded_by_name, bomDetails.uploaded_by_code)}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Upload Date & Time</span>
                                        <span className={styles.detailValue}>
                                            {bomDetails.uploaded_date ? new Date(bomDetails.uploaded_date).toLocaleDateString() : (bomDetails.upload_date ? new Date(bomDetails.upload_date).toLocaleDateString() : '—')} @ {bomDetails.uploaded_time || bomDetails.upload_time || '—'}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Workbook Status</span>
                                        <span className={styles.detailValue}>
                                            <span className={styles.statusSuccess}>{bomDetails.workbook_status || 'Valid'}</span>
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Parse Status</span>
                                        <span className={styles.detailValue}>
                                            <span className={bomDetails.parse_status === 'SUCCESS' ? styles.statusSuccess : styles.statusFailed}>
                                                {bomDetails.parse_status}
                                            </span>
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Original Rows</span>
                                        <span className={styles.detailValue}>{bomDetails.original_rows ?? '—'}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Transform Duration</span>
                                        <span className={styles.detailValue}>{bomDetails.processing_duration ? `${bomDetails.processing_duration} ms` : '—'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Section 2 & 3: File Management */}
                            <div className={styles.filesList}>
                                <div className={styles.fileRow}>
                                    <div className={styles.fileInfo}>
                                        <span className={styles.fileTypeBadge} style={{ backgroundColor: '#ecfdf5', color: '#059669', borderColor: '#a7f3d0' }}>Processed</span>
                                        <div className={styles.fileNameContainer}>
                                            <span className={styles.fileName}>
                                                {bomDetails.original_file_name ? `BOM_Split_V${bomDetails.version}.xlsx` : 'BOM_Processed.xlsx'}
                                            </span>
                                            <span className={styles.fileMetaText}>
                                                Compressed: {formatBytes(bomDetails.compressed_file_size)} | Ready for manufacturing download
                                            </span>
                                        </div>
                                    </div>
                                    <div className={styles.fileActions}>
                                        <button 
                                            className={`${styles.button} ${styles.btnPrimary} ${styles.btnSmall}`} 
                                            onClick={() => handleDownloadFile('processed')}
                                        >
                                            <Download size={14} /> Download Processed
                                        </button>
                                    </div>
                                </div>

                                <div className={styles.fileRow}>
                                    <div className={styles.fileInfo}>
                                        <span className={styles.fileTypeBadge}>Original</span>
                                        <div className={styles.fileNameContainer}>
                                            <span className={styles.fileName}>{bomDetails.original_file_name || 'Original_BOM.xlsx'}</span>
                                            <span className={styles.fileMetaText}>
                                                Original Size: {formatBytes(bomDetails.file_size)} | Raw manufacturing template
                                            </span>
                                        </div>
                                    </div>
                                    <div className={styles.fileActions}>
                                        <button 
                                            className={`${styles.button} ${styles.btnSecondary} ${styles.btnSmall}`} 
                                            onClick={() => handleDownloadFile('original')}
                                        >
                                            <Download size={14} /> Download Original
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons Panel */}
                            <div className={styles.card} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                <span style={{ fontWeight: 600, color: '#475569', fontSize: '0.9rem', marginRight: 'auto' }}>Actions:</span>
                                <button className={`${styles.button} ${styles.btnPrimary}`} onClick={() => setIsReuploadModalOpen(true)}>
                                    <Upload size={16} /> Re-upload BOM
                                </button>
                                <button className={`${styles.button} ${styles.btnSecondary}`} onClick={() => setIsParseAgainModalOpen(true)}>
                                    <RefreshCw size={16} /> Parse Again
                                </button>
                                <button 
                                    className={`${styles.button} ${styles.btnDanger}`} 
                                    onClick={() => setIsDeleteModalOpen(true)}
                                >
                                    <Trash2 size={16} /> Delete BOM
                                </button>
                            </div>

                            {/* Section 4: Work With BOM Editor */}
                            <div className={styles.card} style={{ marginTop: '2rem' }}>
                                <h3>Work With BOM - Components Editor</h3>

                                {/* Statistics cards inside Section 4 */}
                                {editorStats && (
                                    <div className={styles.statsGrid} style={{ marginBottom: '1.5rem', gridTemplateColumns: 'repeat(5, 1fr)' }}>
                                        <div className={styles.statCard}>
                                            <div className={styles.statIcon} style={{ color: '#6366f1', backgroundColor: '#e0e7ff' }}>
                                                <Upload size={20} />
                                            </div>
                                            <div className={styles.statInfo}>
                                                <span className={styles.statLabel}>Uploaded Rows</span>
                                                <span className={styles.statValue}>{bomDetails?.original_rows ?? 0}</span>
                                            </div>
                                        </div>

                                        <div className={styles.statCard}>
                                            <div className={styles.statIcon} style={{ color: '#3b82f6', backgroundColor: '#eff6ff' }}>
                                                <FileText size={20} />
                                            </div>
                                            <div className={styles.statInfo}>
                                                <span className={styles.statLabel}>Parsed Components</span>
                                                <span className={styles.statValue}>{editorStats.totalComponents ?? 0}</span>
                                            </div>
                                        </div>

                                        <div className={styles.statCard}>
                                            <div className={styles.statIcon} style={{ color: '#10b981', backgroundColor: '#ecfdf5' }}>
                                                <CheckCircle2 size={20} />
                                            </div>
                                            <div className={styles.statInfo}>
                                                <span className={styles.statLabel}>Completed</span>
                                                <span className={styles.statValue}>{editorStats.completedComponents ?? 0}</span>
                                            </div>
                                        </div>

                                        <div className={styles.statCard}>
                                            <div className={styles.statIcon} style={{ color: '#f59e0b', backgroundColor: '#fffbeb' }}>
                                                <AlertCircle size={20} />
                                            </div>
                                            <div className={styles.statInfo}>
                                                <span className={styles.statLabel}>Pending</span>
                                                <span className={styles.statValue}>{editorStats.pendingComponents ?? 0}</span>
                                            </div>
                                        </div>

                                        <div className={styles.statCard} style={{ flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: '0.25rem' }}>
                                            <span className={styles.statLabel}>Completion Percentage</span>
                                            <span className={styles.statValue}>
                                                {editorStats.completionPercentage !== undefined && editorStats.completionPercentage !== null
                                                    ? Number(editorStats.completionPercentage).toFixed(2)
                                                    : '0.00'}%
                                            </span>
                                            <div className={styles.progressBarContainer} style={{ width: '100%', marginTop: '0.25rem' }}>
                                                <div 
                                                    className={styles.progressBar} 
                                                    style={{ width: `${editorStats.completionPercentage ?? 0}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Search and Status Filter Row */}
                                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                                    <div style={{ flex: '1', minWidth: '260px', position: 'relative', display: 'flex', alignItems: 'center' }}>
                                        <Search size={16} style={{ position: 'absolute', left: '0.75rem', color: '#94a3b8' }} />
                                        <input
                                            type="text"
                                            className={styles.filterInput}
                                            style={{ paddingLeft: '2.5rem' }}
                                            placeholder="Search CPN, Description, Manufacturer..."
                                            value={editorSearchQuery}
                                            onChange={(e) => setEditorSearchQuery(e.target.value)}
                                        />
                                    </div>

                                    <div style={{ width: '200px' }}>
                                        <select
                                            className={styles.filterSelect}
                                            value={editorStatusFilter}
                                            onChange={(e) => setEditorStatusFilter(e.target.value as any)}
                                        >
                                            <option value="All">All Components</option>
                                            <option value="Completed">Completed Only</option>
                                            <option value="Pending">Pending Only</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Component List Table */}
                                <div className={styles.tableWrapper}>
                                    <table className={styles.previewTable}>
                                        <thead>
                                            <tr>
                                                <th>Sl No</th>
                                                <th>Customer Part Number</th>
                                                <th>Description</th>
                                                <th>Manufacturer</th>
                                                <th>Manufacturer Part Number</th>
                                                <th>Qty</th>
                                                <th>Ref</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(filteredEditorItems?.length ?? 0) === 0 ? (
                                                <tr>
                                                    <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                                                        No components match the selected search/filters.
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredEditorItems.map((item, rowIndex) => {
                                                    const isOddGroup = item.slNo % 2 !== 0;
                                                    const stripeClass = isOddGroup ? styles.groupOdd : styles.groupEven;
                                                    const headers = ['Sl No', 'Customer Part Number', 'Description', 'Manufacturer', 'Manufacturer Part Number', 'Qty', 'Ref', 'Status'];

                                                    return (
                                                        <tr key={item.id} className={stripeClass}>
                                                            {headers.map((_h, colIndex) => {
                                                                const cellSpan = getRowSpan(filteredEditorItems, rowIndex, colIndex, headers);
                                                                if (cellSpan === 0) return null; // Merged

                                                                // Sl No
                                                                if (colIndex === 0) {
                                                                    return (
                                                                        <td key={colIndex} rowSpan={cellSpan} className={cellSpan > 1 ? styles.mergedCell : ''}>
                                                                            {item.slNo}
                                                                        </td>
                                                                    );
                                                                }
                                                                // CPN
                                                                if (colIndex === 1) {
                                                                    return (
                                                                        <td key={colIndex} rowSpan={cellSpan} className={cellSpan > 1 ? styles.mergedCell : ''} style={{ fontWeight: 600 }}>
                                                                            {item.cpn}
                                                                        </td>
                                                                    );
                                                                }
                                                                // Description
                                                                if (colIndex === 2) {
                                                                    return (
                                                                        <td key={colIndex} rowSpan={cellSpan} className={cellSpan > 1 ? styles.mergedCell : ''} style={{ fontSize: '0.85rem' }}>
                                                                            {item.description}
                                                                        </td>
                                                                    );
                                                                }
                                                                // Manufacturer
                                                                if (colIndex === 3) {
                                                                    return <td key={colIndex}>{item.mfr}</td>;
                                                                }
                                                                // MPN
                                                                if (colIndex === 4) {
                                                                    return <td key={colIndex}>{item.mfr_part_no}</td>;
                                                                }
                                                                // Qty (Editable)
                                                                if (colIndex === 5) {
                                                                    const isEditing = editingCell?.itemId === item.id && editingCell?.field === 'qty';
                                                                    const isSaving = savingCellId === item.id;

                                                                    return (
                                                                        <td key={colIndex} rowSpan={cellSpan} className={cellSpan > 1 ? styles.mergedCell : ''} style={{ width: '120px', position: 'relative' }}>
                                                                            {isEditing ? (
                                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                                                                    <input 
                                                                                        type="text" 
                                                                                        className={styles.editInput}
                                                                                        value={editingCell?.value ?? ''}
                                                                                        disabled={isSaving}
                                                                                        autoFocus
                                                                                        onChange={(e) => setEditingCell(prev => prev ? { ...prev, value: e.target.value } : null)}
                                                                                        onKeyDown={(e) => {
                                                                                            if (e.key === 'Enter') handleSaveInlineEdit(item.id, 'qty', editingCell?.value ?? '');
                                                                                            if (e.key === 'Escape') setEditingCell(null);
                                                                                        }}
                                                                                    />
                                                                                    <div className={styles.cellActions}>
                                                                                        <button 
                                                                                            className={styles.saveBtn} 
                                                                                            disabled={isSaving}
                                                                                            onClick={() => handleSaveInlineEdit(item.id, 'qty', editingCell?.value ?? '')}
                                                                                        >
                                                                                            {isSaving ? '...' : 'Save'}
                                                                                        </button>
                                                                                        <button className={styles.cancelBtn} onClick={() => setEditingCell(null)}>Cancel</button>
                                                                                    </div>
                                                                                </div>
                                                                            ) : (
                                                                                <span 
                                                                                    className={styles.cellText} 
                                                                                    title="Click to edit Qty"
                                                                                    onClick={() => setEditingCell({ itemId: item.id, field: 'qty', value: item.qty })}
                                                                                >
                                                                                    {item.qty || <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>[Empty]</span>}
                                                                                </span>
                                                                            )}
                                                                        </td>
                                                                    );
                                                                }
                                                                // Ref (Editable)
                                                                if (colIndex === 6) {
                                                                    const isEditing = editingCell?.itemId === item.id && editingCell?.field === 'ref';
                                                                    const isSaving = savingCellId === item.id;

                                                                    return (
                                                                        <td key={colIndex} rowSpan={cellSpan} className={cellSpan > 1 ? styles.mergedCell : ''} style={{ minWidth: '150px', position: 'relative' }}>
                                                                            {isEditing ? (
                                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                                                                    <input 
                                                                                        type="text" 
                                                                                        className={styles.editInput}
                                                                                        value={editingCell?.value ?? ''}
                                                                                        disabled={isSaving}
                                                                                        autoFocus
                                                                                        onChange={(e) => setEditingCell(prev => prev ? { ...prev, value: e.target.value } : null)}
                                                                                        onKeyDown={(e) => {
                                                                                            if (e.key === 'Enter') handleSaveInlineEdit(item.id, 'ref', editingCell?.value ?? '');
                                                                                            if (e.key === 'Escape') setEditingCell(null);
                                                                                        }}
                                                                                    />
                                                                                    <div className={styles.cellActions}>
                                                                                        <button 
                                                                                            className={styles.saveBtn} 
                                                                                            disabled={isSaving}
                                                                                            onClick={() => handleSaveInlineEdit(item.id, 'ref', editingCell?.value ?? '')}
                                                                                        >
                                                                                            {isSaving ? '...' : 'Save'}
                                                                                        </button>
                                                                                        <button className={styles.cancelBtn} onClick={() => setEditingCell(null)}>Cancel</button>
                                                                                    </div>
                                                                                </div>
                                                                            ) : (
                                                                                <span 
                                                                                    className={styles.cellText} 
                                                                                    title="Click to edit Ref"
                                                                                    onClick={() => setEditingCell({ itemId: item.id, field: 'ref', value: item.ref })}
                                                                                >
                                                                                    {item.ref || <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>[Empty]</span>}
                                                                                </span>
                                                                            )}
                                                                        </td>
                                                                    );
                                                                }
                                                                // Status badge
                                                                if (colIndex === 7) {
                                                                    return (
                                                                        <td key={colIndex}>
                                                                            <span className={`${styles.statusBadge} ${
                                                                                item.status === 'Completed' ? styles.statusCompleted : styles.statusPending
                                                                            }`}>
                                                                                {item.status}
                                                                            </span>
                                                                        </td>
                                                                    );
                                                                }
                                                                return null;
                                                            })}
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Section 5: Audit Log Table */}
                            {renderAuditLogsTable()}
                        </>
                    )}
                </>
            )}

            {/* MODAL: Initial Upload */}
            {isUploadModalOpen && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent} style={{ maxWidth: '600px' }}>
                        <div className={styles.modalHeader}>
                            <h3>Upload Manufacturing BOM</h3>
                            <button className={styles.closeBtn} onClick={() => { setIsUploadModalOpen(false); setUploadFile(null); setUploadError(null); }}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleInitialUploadSubmit}>
                            <div className={styles.modalBody}>
                                {uploadError && (
                                    <div className={`${styles.alertMessage} ${styles.alertError}`} style={{ marginBottom: '1rem' }}>
                                        <AlertCircle size={16} />
                                        <span>{uploadError}</span>
                                    </div>
                                )}

                                {uploadLoading ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 1.5rem', gap: '1.25rem' }}>
                                        <Spinner />
                                        <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '1rem' }}>Parsing BOM... Please wait.</span>
                                        <span style={{ color: '#64748b', fontSize: '0.85rem', textAlign: 'center' }}>
                                            The system is processing, validating, and structuring components into the history archive.
                                        </span>
                                    </div>
                                ) : !uploadFile ? (
                                    <div 
                                        className={`${styles.uploadArea} ${uploadDragActive ? styles.uploadAreaActive : ''}`}
                                        onDragEnter={(e) => handleFileDrag(e, 'upload')}
                                        onDragOver={(e) => handleFileDrag(e, 'upload')}
                                        onDragLeave={(e) => handleFileDrag(e, 'upload')}
                                        onDrop={(e) => handleFileDrop(e, 'upload')}
                                        onClick={() => initialFileInputRef.current?.click()}
                                        style={{ margin: '1rem 0', padding: '2rem 1rem' }}
                                    >
                                        <input 
                                            ref={initialFileInputRef}
                                            type="file" 
                                            accept=".xlsx,.xls" 
                                            style={{ display: 'none' }}
                                            onChange={(e) => handleFileInputChange(e, 'upload')}
                                        />
                                        <Upload size={32} className={styles.uploadIcon} />
                                        <span className={styles.uploadTitle} style={{ fontSize: '0.9rem' }}>Drag & drop original BOM workbook here</span>
                                        <span className={styles.uploadSub}>Supports Excel (.xlsx, .xls) up to 50MB</span>
                                    </div>
                                ) : (
                                    <div className={styles.fileSelectedContainer} style={{ margin: '1rem 0' }}>
                                        <div className={styles.fileMainInfo}>
                                            <div className={styles.fileIconWrapper}>
                                                <FileSpreadsheet size={20} />
                                            </div>
                                            <div className={styles.fileDetails}>
                                                <span className={styles.fileNameText} title={uploadFile.name}>{uploadFile.name}</span>
                                                <span className={styles.fileSizeText}>{formatBytes(uploadFile.size)}</span>
                                            </div>
                                        </div>
                                        <button 
                                            type="button"
                                            className={`${styles.button} ${styles.btnDanger} ${styles.btnSmall}`} 
                                            onClick={() => setUploadFile(null)}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                <button 
                                    type="button" 
                                    className={`${styles.button} ${styles.btnSecondary}`} 
                                    onClick={() => { setIsUploadModalOpen(false); setUploadFile(null); setUploadError(null); }}
                                    disabled={uploadLoading}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className={`${styles.button} ${styles.btnPrimary}`}
                                    disabled={!uploadFile || uploadLoading}
                                >
                                    {uploadLoading ? <><Spinner /> Uploading...</> : <><Play size={16} /> Parse BOM</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: Re-upload BOM */}
            {isReuploadModalOpen && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent} style={{ maxWidth: '600px' }}>
                        <div className={styles.modalHeader}>
                            <h3>Re-upload BOM Workbook (Increment Version)</h3>
                            <button className={styles.closeBtn} onClick={() => { setIsReuploadModalOpen(false); setReuploadFile(null); setReuploadRemarks(''); setReuploadError(null); }}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleReuploadSubmit}>
                            <div className={styles.modalBody}>
                                {reuploadError && (
                                    <div className={`${styles.alertMessage} ${styles.alertError}`} style={{ marginBottom: '1rem' }}>
                                        <AlertCircle size={16} />
                                        <span>{reuploadError}</span>
                                    </div>
                                )}

                                {!reuploadFile ? (
                                    <div 
                                        className={`${styles.uploadArea} ${reuploadDragActive ? styles.uploadAreaActive : ''}`}
                                        onDragEnter={(e) => handleFileDrag(e, 'reupload')}
                                        onDragOver={(e) => handleFileDrag(e, 'reupload')}
                                        onDragLeave={(e) => handleFileDrag(e, 'reupload')}
                                        onDrop={(e) => handleFileDrop(e, 'reupload')}
                                        onClick={() => reuploadFileInputRef.current?.click()}
                                        style={{ margin: '1rem 0', padding: '2rem 1rem' }}
                                    >
                                        <input 
                                            ref={reuploadFileInputRef}
                                            type="file" 
                                            accept=".xlsx,.xls" 
                                            style={{ display: 'none' }}
                                            onChange={(e) => handleFileInputChange(e, 'reupload')}
                                        />
                                        <Upload size={32} className={styles.uploadIcon} />
                                        <span className={styles.uploadTitle} style={{ fontSize: '0.9rem' }}>Drag & drop new BOM workbook here</span>
                                        <span className={styles.uploadSub}>Supports Excel (.xlsx, .xls) up to 50MB</span>
                                    </div>
                                ) : (
                                    <div className={styles.fileSelectedContainer} style={{ margin: '1rem 0' }}>
                                        <div className={styles.fileMainInfo}>
                                            <div className={styles.fileIconWrapper}>
                                                <FileSpreadsheet size={20} />
                                            </div>
                                            <div className={styles.fileDetails}>
                                                <span className={styles.fileNameText} title={reuploadFile.name}>{reuploadFile.name}</span>
                                                <span className={styles.fileSizeText}>{formatBytes(reuploadFile.size)}</span>
                                            </div>
                                        </div>
                                        <button 
                                            type="button"
                                            className={`${styles.button} ${styles.btnDanger} ${styles.btnSmall}`} 
                                            onClick={() => setReuploadFile(null)}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                )}

                                <div className={styles.inputGroup} style={{ marginTop: '1rem' }}>
                                    <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#475569' }}>Change Remarks *</label>
                                    <textarea
                                        className={styles.filterInput}
                                        style={{ minHeight: '60px', height: '70px', marginTop: '0.25rem', resize: 'vertical' }}
                                        placeholder="Reason for re-uploading (e.g. ECN updates, corrected component quantities)..."
                                        required
                                        value={reuploadRemarks}
                                        onChange={(e) => setReuploadRemarks(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                <button 
                                    type="button" 
                                    className={`${styles.button} ${styles.btnSecondary}`} 
                                    onClick={() => { setIsReuploadModalOpen(false); setReuploadFile(null); setReuploadRemarks(''); setReuploadError(null); }}
                                    disabled={reuploadLoading}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className={`${styles.button} ${styles.btnPrimary}`}
                                    disabled={!reuploadFile || !reuploadRemarks || reuploadLoading}
                                >
                                    {reuploadLoading ? <><Spinner /> Uploading...</> : <><Play size={16} /> Re-upload & Parse</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: Parse Again */}
            {isParseAgainModalOpen && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent} style={{ maxWidth: '500px' }}>
                        <div className={styles.modalHeader}>
                            <h3>Parse Original BOM Workbook Again</h3>
                            <button className={styles.closeBtn} onClick={() => { setIsParseAgainModalOpen(false); setParseAgainRemarks(''); }}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleParseAgainSubmit}>
                            <div className={styles.modalBody}>
                                <p style={{ fontSize: '0.9rem', color: '#475569', margin: '0 0 1rem 0', lineHeight: '1.4' }}>
                                    Are you sure you want to run the original parser again on the raw original workbook? 
                                    <strong> Warning: This will overwrite any custom inline edits (Qty, Ref) you've made on this BOM.</strong>
                                </p>
                                <div className={styles.inputGroup}>
                                    <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#475569' }}>Remarks</label>
                                    <textarea
                                        className={styles.filterInput}
                                        style={{ minHeight: '60px', height: '70px', marginTop: '0.25rem', resize: 'vertical' }}
                                        placeholder="Optional re-parsing notes or reasons..."
                                        value={parseAgainRemarks}
                                        onChange={(e) => setParseAgainRemarks(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                <button 
                                    type="button" 
                                    className={`${styles.button} ${styles.btnSecondary}`} 
                                    onClick={() => { setIsParseAgainModalOpen(false); setParseAgainRemarks(''); }}
                                    disabled={parseAgainLoading}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className={`${styles.button} ${styles.btnPrimary}`}
                                    disabled={parseAgainLoading}
                                >
                                    {parseAgainLoading ? <><Spinner /> Parsing...</> : <><RefreshCw size={16} /> Re-parse BOM</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: Delete BOM Confirmation */}
            {isDeleteModalOpen && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent} style={{ maxWidth: '450px' }}>
                        <div className={styles.modalHeader}>
                            <h3 style={{ color: '#b91c1c' }}>Confirm Permanent Deletion</h3>
                            <button className={styles.closeBtn} onClick={() => setIsDeleteModalOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            <p style={{ fontSize: '0.95rem', color: '#1e293b', margin: 0, lineHeight: '1.5' }}>
                                Are you sure you want to permanently delete this BOM session and all associated files? 
                                <br /><br />
                                <strong style={{ color: '#b91c1c' }}>This action cannot be undone and requires privileged access permissions.</strong>
                            </p>
                        </div>
                        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                            <button 
                                type="button" 
                                className={`${styles.button} ${styles.btnSecondary}`} 
                                onClick={() => setIsDeleteModalOpen(false)}
                                disabled={deleteLoading}
                            >
                                Cancel
                            </button>
                            <button 
                                type="button" 
                                className={`${styles.button} ${styles.btnDanger}`}
                                disabled={deleteLoading}
                                onClick={handleDeleteSubmit}
                            >
                                {deleteLoading ? <><Spinner /> Deleting...</> : <><Trash2 size={16} /> Permanently Delete</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
