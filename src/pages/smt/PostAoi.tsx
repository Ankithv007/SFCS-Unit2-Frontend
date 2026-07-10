import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSmtAuth } from '../../context/SmtAuthContext';
import styles from './PostAoi.module.css';
import { WorkOrderSelector } from '../../components/WorkOrderSelector';
import { apiFetch } from '../../utils/api';
import QRCode from 'qrcode';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';

// ─── Toaster ─────────────────────────────────────────────────────────────────
interface Toast { 
    id: number; 
    message: string; 
    type: 'success' | 'error' | 'info'; 
}

const Toaster: React.FC<{ toasts: Toast[]; onRemove: (id: number) => void }> = ({ toasts, onRemove }) => (
    <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 9999, display: 'flex', flexDirection: 'column-reverse', gap: '0.5rem' }}>
        {toasts.map(t => (
            <div key={t.id} onClick={() => onRemove(t.id)} style={{
                padding: '0.85rem 1.25rem', borderRadius: '0.6rem', cursor: 'pointer', minWidth: '320px',
                background: t.type === 'error' ? '#fee2e2' : t.type === 'success' ? '#dcfce7' : '#eff6ff',
                color: t.type === 'error' ? '#991b1b' : t.type === 'success' ? '#166534' : '#1e40af',
                border: `1px solid ${t.type === 'error' ? '#fca5a5' : t.type === 'success' ? '#86efac' : '#bfdbfe'}`,
                fontWeight: 600, fontSize: '0.9rem', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                animation: 'slideIn 0.2s ease', display: 'flex', alignItems: 'center', gap: '8px'
            }}>
                <span>{t.type === 'error' ? '❌' : t.type === 'success' ? '✅' : 'ℹ️'}</span>
                <span>{t.message}</span>
            </div>
        ))}
    </div>
);

// --- TS Typings ---
interface EligibleWorkOrder {
    work_order_id: string;
    work_order_number: string;
    po_id: string;
    product_name: string;
    product_description: string;
    work_order_quantity: number;
    panel_quantity: number;
    sides: string;
    line_id: string;
    work_order_remarks: string;
}


interface PostAoiSession {
    id: string;
    work_order_id: string;
    stencil_lifecycle_id: string;
    squeegee_number: string;
    solder_paste_barcode: string;
    side: string;
    status: string; // Pending, In Progress, Completed, Paused, Cancelled, Aborted
    created_by: string;
    created_by_name: string;
    created_at: string;
    updated_by?: string;
    updated_by_name?: string;
    updated_at?: string;
    duplicate_scan_count: number;
    product_name?: string;
    work_order_quantity?: number;
    stencil_name?: string;
    stencil_version?: string;
    remaining_life?: number;
}

interface ScanRecord {
    scan_id: string;
    barcode: string;
    result: 'PASS' | 'FAIL' | 'INVALID';
    remark: string | null;
    scanned_by: string;
    scanned_at: string;
    repair_time?: string | null;
    repair_remark?: string | null;
}

const PostAoi: React.FC = () => {
    const { smtUser } = useSmtAuth();

    const formatTimestamp = (dStr: string | null | undefined) => {
        if (!dStr) return '—';
        return new Date(dStr).toLocaleString('en-IN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    };

    // Session Management State
    const [eligibleWos, setEligibleWos] = useState<EligibleWorkOrder[]>([]);
    const [selectedWoId, setSelectedWoId] = useState('');
    const [autoPopulatedDetails, setAutoPopulatedDetails] = useState<any | null>(null);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [detailsError, setDetailsError] = useState('');

    // UI View State
    const [activeSession, setActiveSession] = useState<PostAoiSession | null>(null);
    const [activeSessionsList, setActiveSessionsList] = useState<PostAoiSession[]>([]);
    const [completedSessionsList, setCompletedSessionsList] = useState<PostAoiSession[]>([]);
    const [sessionsLoading, setSessionsLoading] = useState(false);

    // Pagination & Search States for Active Sessions
    const [activePage, setActivePage] = useState(1);
    const [activeLimit, setActiveLimit] = useState(5);
    const [activeSearch, setActiveSearch] = useState('');
    const [activeTotal, setActiveTotal] = useState(0);

    // Pagination & Search States for Completed Sessions
    const [completedPage, setCompletedPage] = useState(1);
    const [completedLimit, setCompletedLimit] = useState(5);
    const [completedSearch, setCompletedSearch] = useState('');
    const [completedTotal, setCompletedTotal] = useState(0);

    // Active Scan Dashboard State
    const [stats, setStats] = useState<{
        workOrderQuantity: number;
        processedQuantity: number;
        passed: number;
        failed: number;
        pending: number;
        invalid: number;
        duplicate: number;
        scans: ScanRecord[];
    }>({
        workOrderQuantity: 0,
        processedQuantity: 0,
        passed: 0,
        failed: 0,
        pending: 0,
        invalid: 0,
        duplicate: 0,
        scans: []
    });
    const [scanBarcodeVal, setScanBarcodeVal] = useState('');
    const [isScanning, setIsScanning] = useState(false);

    // Dialogs / Modals State
    const [abortRemark, setAbortRemark] = useState('');
    const [showAbortModal, setShowAbortModal] = useState(false);
    const [failRemark, setFailRemark] = useState('');
    const [selectedScanToFail, setSelectedScanToFail] = useState<ScanRecord | null>(null);
    const [selectedScanToRepair, setSelectedScanToRepair] = useState<{ barcode: string } | null>(null);
    const [repairRemark, setRepairRemark] = useState('');
    const [editingScanId, setEditingScanId] = useState<string | null>(null);
    const [editingBarcodeText, setEditingBarcodeText] = useState('');
    const [selectedQrBarcode, setSelectedQrBarcode] = useState<string | null>(null);
    const [singleQrDataUrl, setSingleQrDataUrl] = useState<string | null>(null);
    const [isZipping, setIsZipping] = useState(false);
    const [viewingRemarkText, setViewingRemarkText] = useState<string | null>(null);
    const [viewingRemarkTitle, setViewingRemarkTitle] = useState<string>('');

    // Focus Lock Ref
    const scanInputRef = useRef<HTMLInputElement>(null);

    // Toaster
    const [toasts, setToasts] = useState<Toast[]>([]);
    const toastId = useRef(0);
    const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
        const id = ++toastId.current;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
    }, []);
    const removeToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

    // Role helpers
    const isSuperAdmin = smtUser?.role === 'Super Admin';

    // ─── Initial Load ────────────────────────────────────────────────────────
    useEffect(() => {
        fetchEligibleWorkOrders();
        fetchActiveSessions(1, activeLimit, '');
        fetchCompletedSessions(1, completedLimit, '');
    }, []);

    // Determine if any modal/dialog is currently active
    const isModalOpen = showAbortModal || !!selectedScanToFail || !!selectedScanToRepair || !!editingScanId || !!selectedQrBarcode || !!viewingRemarkText;

    // Keep scanner input focused if scanning is active and no dialog is open
    useEffect(() => {
        if (activeSession && activeSession.status === 'In Progress' && !isModalOpen) {
            const focusInput = () => {
                if (scanInputRef.current && document.activeElement !== scanInputRef.current) {
                    scanInputRef.current.focus();
                }
            };
            focusInput();
            const interval = setInterval(focusInput, 1500);
            return () => clearInterval(interval);
        }
    }, [activeSession, isModalOpen]);

    // When a modal closes, restore focus to the scanner input
    const wasModalOpen = useRef(false);
    useEffect(() => {
        if (wasModalOpen.current && !isModalOpen) {
            setTimeout(() => {
                scanInputRef.current?.focus();
            }, 100);
        }
        wasModalOpen.current = isModalOpen;
    }, [isModalOpen]);

    const renderRemarkCell = (remark: string | null | undefined, type: 'Failure' | 'Repair') => {
        if (!remark) return '—';
        const preview = remark.slice(0, 5) + '...';
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                <span title={remark} style={{ fontFamily: 'monospace' }}>{preview}</span>
                <button
                    type="button"
                    className={styles.secondaryButton}
                    style={{
                        padding: '2px 8px',
                        fontSize: '0.75rem',
                        color: type === 'Failure' ? '#b91c1c' : '#166534',
                        borderColor: type === 'Failure' ? '#fca5a5' : '#86efac',
                        backgroundColor: type === 'Failure' ? '#fee2e2' : '#dcfce7',
                        cursor: 'pointer',
                        fontWeight: 600,
                        borderRadius: '4px',
                        lineHeight: '1.2'
                    }}
                    onClick={() => {
                        setViewingRemarkText(remark);
                        setViewingRemarkTitle(type === 'Failure' ? 'Failure Remark' : 'Repair Remark');
                    }}
                >
                    View
                </button>
            </div>
        );
    };

    // Re-load stats for active session
    useEffect(() => {
        if (activeSession) {
            fetchSessionStats(activeSession.id);
        }
    }, [activeSession]);

    // Generate Single QR canvas data url
    useEffect(() => {
        if (selectedQrBarcode) {
            QRCode.toDataURL(selectedQrBarcode.replace(/-/g, "").toUpperCase(), {
                width: 250,
                margin: 2,
                errorCorrectionLevel: 'M'
            })
            .then(url => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 250;
                    canvas.height = 295;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(img, 0, 0);
                        ctx.font = 'bold 15px monospace';
                        ctx.fillStyle = '#000000';
                        ctx.textAlign = 'center';
                        ctx.fillText(selectedQrBarcode, canvas.width / 2, 275);
                        setSingleQrDataUrl(canvas.toDataURL('image/png'));
                    }
                };
                img.src = url;
            })
            .catch(err => {
                console.error('QR code generation error:', err);
                setSingleQrDataUrl(null);
            });
        } else {
            setSingleQrDataUrl(null);
        }
    }, [selectedQrBarcode]);

    // Fetch Eligible Work Orders
    const fetchEligibleWorkOrders = async () => {
        try {
            const data = await apiFetch('/api/smt/post-aoi/eligible-wos');
            setEligibleWos(data || []);
        } catch (err: any) {
            console.error('Error fetching eligible work orders:', err);
            addToast('Failed to load eligible work orders.', 'error');
        }
    };

    // Fetch combined auto-populated details
    const fetchAutoPopulateDetails = async (woId: string, currentSide?: string) => {
        setDetailsLoading(true);
        setDetailsError('');
        try {
            let url = `/api/smt/post-aoi/auto-populate-details/${encodeURIComponent(woId)}`;
            if (currentSide) {
                url += `?side=${encodeURIComponent(currentSide)}`;
            }
            const data = await apiFetch(url);
            setAutoPopulatedDetails(data);
        } catch (err: any) {
            console.error('Error fetching auto-populate details:', err);
            setAutoPopulatedDetails(null);
            setDetailsError(err.message || 'Failed to load details for this Work Order.');
            addToast(err.message || 'Failed to load details for this Work Order.', 'error');
        } finally {
            setDetailsLoading(false);
        }
    };

    // Load auto-populate details when selected Work Order changes
    useEffect(() => {
        if (selectedWoId) {
            fetchAutoPopulateDetails(selectedWoId);
        } else {
            setAutoPopulatedDetails(null);
            setDetailsError('');
        }
    }, [selectedWoId]);

    // Also fetch auto-populate details when activeSession changes
    useEffect(() => {
        if (activeSession) {
            fetchAutoPopulateDetails(activeSession.work_order_id, activeSession.side);
        } else {
            if (selectedWoId) {
                fetchAutoPopulateDetails(selectedWoId);
            } else {
                setAutoPopulatedDetails(null);
                setDetailsError('');
            }
        }
    }, [activeSession]);

    const fetchActiveSessions = async (pageVal = activePage, limitVal = activeLimit, searchVal = activeSearch) => {
        setSessionsLoading(true);
        try {
            const query = `status=InProgress&page=${pageVal}&limit=${limitVal}&search=${encodeURIComponent(searchVal)}`;
            const res = await apiFetch(`/api/smt/post-aoi/sessions?${query}`);
            if (res) {
                setActiveSessionsList(res.data || []);
                setActiveTotal(res.pagination?.total || 0);
            }
        } catch (err: any) {
            console.error('Error loading active post-aoi sessions:', err);
        } finally {
            setSessionsLoading(false);
        }
    };

    const fetchCompletedSessions = async (pageVal = completedPage, limitVal = completedLimit, searchVal = completedSearch) => {
        setSessionsLoading(true);
        try {
            const query = `status=Completed&page=${pageVal}&limit=${limitVal}&search=${encodeURIComponent(searchVal)}`;
            const res = await apiFetch(`/api/smt/post-aoi/sessions?${query}`);
            if (res) {
                setCompletedSessionsList(res.data || []);
                setCompletedTotal(res.pagination?.total || 0);
            }
        } catch (err: any) {
            console.error('Error loading completed post-aoi sessions:', err);
        } finally {
            setSessionsLoading(false);
        }
    };

    // Fetch lists of post-aoi sessions (unified delegator)
    const fetchSessionsLists = () => {
        fetchActiveSessions(activePage, activeLimit, activeSearch);
        fetchCompletedSessions(completedPage, completedLimit, completedSearch);
    };

    const handleActiveSearchSubmit = () => {
        setActivePage(1);
        fetchActiveSessions(1, activeLimit, activeSearch);
    };

    const handleActiveClear = () => {
        setActiveSearch('');
        setActivePage(1);
        fetchActiveSessions(1, activeLimit, '');
    };

    const handleCompletedSearchSubmit = () => {
        setCompletedPage(1);
        fetchCompletedSessions(1, completedLimit, completedSearch);
    };

    const handleCompletedClear = () => {
        setCompletedSearch('');
        setCompletedPage(1);
        fetchCompletedSessions(1, completedLimit, '');
    };

    // Fetch Session statistics and scan records
    const fetchSessionStats = async (sessionId: string) => {
        try {
            const data = await apiFetch(`/api/smt/post-aoi/sessions/${sessionId}/stats`);
            if (data) {
                setStats(data);
                
                // If backend flags the session as completed, update status locally to Completed
                if (data.isCompleted && activeSession?.status !== 'Completed') {
                    addToast('Post AOI Session completed successfully.', 'success');
                    setActiveSession(prev => prev ? { ...prev, status: 'Completed' } : null);
                    fetchSessionsLists();
                }
            }
        } catch (err: any) {
            console.error('Error loading session stats:', err);
        }
    };

    // ─── Setup Session Submit ────────────────────────────────────────────────
    const handleStartSession = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedWoId) {
            addToast('Please select a Work Order first.', 'error');
            return;
        }
        if (!autoPopulatedDetails) {
            addToast('Cannot start session without Auto-Populated Details. Please ensure all SMT Printing and Stencil parameters are completed first.', 'error');
            return;
        }

        const wo = eligibleWos.find(w => w.work_order_id === selectedWoId);
        if (wo) {
            const woSides = (wo.sides || '').trim().toLowerCase();
            const isDoubleSided = woSides === 'top / bottom' || woSides.includes('/');
            if (isDoubleSided && autoPopulatedDetails.side.toLowerCase() === 'top') {
                try {
                    const checkRes = await apiFetch(`/api/smt/post-aoi/work-orders/${encodeURIComponent(selectedWoId)}/check-bottom`);
                    if (!checkRes || !checkRes.completed) {
                        addToast('Bottom Post AOI must be completed before starting Top Post AOI for this Work Order.', 'error');
                        return;
                    }
                } catch (err) {
                    console.error('Failed to verify bottom side completion status:', err);
                    addToast('Failed to verify bottom side completion status.', 'error');
                    return;
                }
            }
        }

        try {
            const payload = {
                work_order_id: selectedWoId,
                stencil_lifecycle_id: autoPopulatedDetails.stencilLifecycleId,
                squeegee_number: autoPopulatedDetails.squeegeeNumber,
                solder_paste_barcode: autoPopulatedDetails.solderPasteBarcode,
                side: autoPopulatedDetails.side
            };

            const session = await apiFetch('/api/smt/post-aoi/sessions', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            if (session) {
                addToast('Post AOI Session created successfully.', 'success');
                setActiveSession(session);
                resetSetupForm();
                fetchSessionsLists();
            }
        } catch (err: any) {
            console.error('Session creation failed:', err);
            addToast(err.message || 'Failed to start post-aoi session.', 'error');
        }
    };

    const resetSetupForm = () => {
        setSelectedWoId('');
        setAutoPopulatedDetails(null);
    };

    // ─── Actions inside Scanning View ────────────────────────────────────────

    // Handle Barcode Scanned
    const handleBarcodeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const code = scanBarcodeVal.trim();
        if (!code || !activeSession || isScanning) return;

        setIsScanning(true);
        setScanBarcodeVal('');
        try {
            const res = await apiFetch(`/api/smt/post-aoi/sessions/${activeSession.id}/scan`, {
                method: 'POST',
                body: JSON.stringify({ barcode: code })
            });

            if (res) {
                if (res.needsRepairRemark) {
                    setSelectedScanToRepair({ barcode: code });
                    setRepairRemark('');
                } else if (res.isValid) {
                    if (res.isRepair) {
                        addToast(`Barcode "${code}" successfully repaired: PASS.`, 'success');
                    } else {
                        addToast(`Barcode "${code}" registered: PASS.`, 'success');
                    }
                    fetchSessionStats(activeSession.id);
                } else {
                    addToast(`Invalid Serial Number. This Serial Number does not belong to the selected Work Order.`, 'error');
                    fetchSessionStats(activeSession.id);
                }
            }
        } catch (err: any) {
            console.error('Scan error:', err);
            if (err.status === 409) {
                addToast(err.message || `This barcode has already been scanned in this Post AOI Session.`, 'error');
                fetchSessionStats(activeSession.id);
            } else {
                addToast(err.message || 'Scan validation failed.', 'error');
            }
        } finally {
            setIsScanning(false);
            scanInputRef.current?.focus();
        }
    };

    const submitRepairRow = async () => {
        if (!selectedScanToRepair || !activeSession) return;
        if (!repairRemark.trim()) {
            addToast('Repair remark is mandatory.', 'error');
            return;
        }

        try {
            const res = await apiFetch(`/api/smt/post-aoi/sessions/${activeSession.id}/scan`, {
                method: 'POST',
                body: JSON.stringify({ barcode: selectedScanToRepair.barcode, repairRemark: repairRemark.trim() })
            });

            if (res) {
                addToast(`Record updated: PASS (Repaired).`, 'success');
                setSelectedScanToRepair(null);
                fetchSessionStats(activeSession.id);
            }
        } catch (err: any) {
            addToast(err.message || 'Failed to repair record.', 'error');
        }
    };

    // Transition Status (Pause / Resume / Cancel / Abort)
    const handleStatusTransition = async (newStatus: string, remark?: string) => {
        if (!activeSession) return;
        try {
            const res = await apiFetch(`/api/smt/post-aoi/sessions/${activeSession.id}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status: newStatus, remark })
            });
            if (res) {
                addToast(`Session status updated to ${newStatus}.`, 'success');
                setActiveSession({ ...activeSession, status: newStatus });
                fetchSessionsLists();
                if (newStatus === 'Cancelled' || newStatus === 'Aborted') {
                    setActiveSession(null);
                }
            }
        } catch (err: any) {
            addToast(err.message || 'Failed to update session status.', 'error');
        }
    };

    // Handle Aborting Session Modal Submit
    const submitAbortSession = () => {
        if (!abortRemark.trim()) {
            addToast('Remark is mandatory to abort a session.', 'error');
            return;
        }
        handleStatusTransition('Aborted', abortRemark.trim());
        setShowAbortModal(false);
        setAbortRemark('');
    };

    // Manual FAIL trigger
    const triggerFailRow = (scan: ScanRecord) => {
        setSelectedScanToFail(scan);
        setFailRemark('');
    };

    const submitFailRow = async () => {
        if (!selectedScanToFail || !activeSession) return;
        if (!failRemark.trim()) {
            addToast('Failure remark is mandatory.', 'error');
            return;
        }

        try {
            const res = await apiFetch(`/api/smt/post-aoi/sessions/${activeSession.id}/scan/${selectedScanToFail.scan_id}/fail`, {
                method: 'POST',
                body: JSON.stringify({ remark: failRemark.trim() })
            });

            if (res) {
                addToast(`Record updated: FAIL (routed to Rework).`, 'success');
                setSelectedScanToFail(null);
                fetchSessionStats(activeSession.id);
            }
        } catch (err: any) {
            addToast(err.message || 'Failed to transition record to FAIL.', 'error');
        }
    };

    // Inline edit row
    const startInlineEdit = (scan: ScanRecord) => {
        setEditingScanId(scan.scan_id);
        setEditingBarcodeText(scan.barcode);
    };

    const submitInlineEdit = async (scanId: string) => {
        if (!activeSession || !editingBarcodeText.trim()) return;
        try {
            const res = await apiFetch(`/api/smt/post-aoi/sessions/${activeSession.id}/scan/${scanId}`, {
                method: 'PUT',
                body: JSON.stringify({ newBarcode: editingBarcodeText.trim() })
            });
            if (res) {
                addToast('Scanned barcode updated successfully.', 'success');
                setEditingScanId(null);
                fetchSessionStats(activeSession.id);
            }
        } catch (err: any) {
            addToast(err.message || 'Failed to edit scanned barcode.', 'error');
        }
    };

    // Delete session (Super Admin only)
    const handleDeleteSession = async (sessionId: string, woId: string) => {
        if (!isSuperAdmin) {
            addToast("Only Super Admin is authorized to delete records.\nPlease contact your Super Admin if this record needs to be deleted.", 'error');
            return;
        }
        if (!window.confirm(`Are you sure you want to delete the Post AOI Session for Work Order ${woId}? This action will soft-delete the session.`)) {
            return;
        }
        try {
            const res = await apiFetch(`/api/smt/post-aoi/sessions/${sessionId}`, {
                method: 'DELETE'
            });
            if (res) {
                addToast('Post AOI Session deleted successfully.', 'success');
                fetchSessionsLists();
                if (activeSession?.id === sessionId) {
                    setActiveSession(null);
                }
            }
        } catch (err: any) {
            addToast(err.message || 'Failed to delete session.', 'error');
        }
    };

    // ─── Export & QR Code Download ───────────────────────────────────────────

    // Client-side CSV download
    const handleExportCSV = () => {
        if (!activeSession) return;
        try {
            const headers = ['Barcode Number', 'Result', 'Failure Remarks', 'Scanned By', 'Scanned At'];
            const rows = stats.scans.map(scan => [
                scan.barcode,
                scan.result,
                scan.remark || '',
                scan.scanned_by,
                new Date(scan.scanned_at).toLocaleString()
            ]);

            const csvContent = [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `Post_AOI_Scan_Logs_${activeSession.work_order_id}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            addToast('CSV exported successfully.', 'success');
        } catch (err) {
            addToast('CSV export failed.', 'error');
        }
    };

    // Excel Report
    const handleExportExcel = async (customSessionId?: string, customWorkOrderId?: string) => {
        const sessionId = customSessionId || activeSession?.id;
        const workOrderId = customWorkOrderId || activeSession?.work_order_id;
        if (!sessionId) return;
        try {
            addToast('Preparing Excel report…', 'info');
            const token = localStorage.getItem('auth_token') || localStorage.getItem('smt_token') || sessionStorage.getItem('smt_token') || '';
            const response = await fetch(`/api/smt/post-aoi/sessions/${sessionId}/export/excel`, {
                headers: { Authorization: `Bearer ${token}`, 'X-User-Name': smtUser?.name || '' }
            });
            if (!response.ok) throw new Error('Export failed');
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Post_AOI_Report_${workOrderId}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            addToast('Excel report downloaded successfully.', 'success');
        } catch (err) {
            console.error('Excel export error:', err);
            addToast('Excel export failed.', 'error');
        }
    };

    // PDF Report
    const handleExportFullPDF = async (customSessionId?: string, customWorkOrderId?: string) => {
        const sessionId = customSessionId || activeSession?.id;
        const workOrderId = customWorkOrderId || activeSession?.work_order_id;
        if (!sessionId) return;
        try {
            addToast('Generating PDF report…', 'info');
            const token = localStorage.getItem('auth_token') || localStorage.getItem('smt_token') || sessionStorage.getItem('smt_token') || '';
            const res = await fetch(`/api/smt/post-aoi/sessions/${sessionId}/export/pdf-data`, {
                headers: { Authorization: `Bearer ${token}`, 'X-User-Name': smtUser?.name || '' }
            });
            if (!res.ok) throw new Error('Failed to fetch PDF data');
            const data = await res.json();

            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const PW = 210; // A4 width mm
            const ML = 14;  // left margin
            const MR = 14;  // right margin
            const CW = PW - ML - MR; // content width
            let y = 0;

            const fmt = (d: string | null | undefined) =>
                d ? new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true }) : '—';
            const fmtDate = (d: string | null | undefined) =>
                d ? new Date(d).toLocaleDateString('en-IN') : '—';
            const val = (v: any) => (v !== null && v !== undefined && v !== '') ? String(v) : '—';

            const addPageNum = () => {
                const total = (doc as any).internal.getNumberOfPages();
                for (let i = 1; i <= total; i++) {
                    doc.setPage(i);
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(8);
                    doc.setTextColor(148, 163, 184);
                    doc.text(`Page ${i} of ${total}   |   SMT Post AOI Report   |   ${smtUser?.name || 'Operator'}`, ML, 292);
                }
            };

            const checkPageBreak = (needed: number) => {
                if (y + needed > 280) {
                    doc.addPage();
                    y = 15;
                }
            };

            // ── TITLE BANNER ──────────────────────────────────────────────────
            doc.setFillColor(30, 58, 95);  // navy
            doc.rect(0, 0, PW, 28, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(18);
            doc.setTextColor(255, 255, 255);
            doc.text('SMT POST AOI SESSION REPORT', PW / 2, 13, { align: 'center' });
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(203, 213, 225);
            doc.text(`Stage: SMT Post AOI  |  Generated: ${fmt(data.generatedAt)}  |  By: ${data.generatedBy}`, PW / 2, 22, { align: 'center' });
            y = 36;

            const sectionHeader = (title: string, r: number, g: number, b: number) => {
                checkPageBreak(14);
                doc.setFillColor(r, g, b);
                doc.rect(ML, y, CW, 8, 'F');
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.setTextColor(255, 255, 255);
                doc.text(title, ML + 3, y + 5.5);
                y += 10;
            };

            const kvRow = (label: string, value: string, shade: boolean) => {
                checkPageBreak(8);
                const labelW = 65;
                if (shade) {
                    doc.setFillColor(241, 245, 249);
                    doc.rect(ML, y, CW, 7, 'F');
                }
                doc.setDrawColor(209, 213, 219);
                doc.rect(ML, y, CW, 7);
                doc.rect(ML, y, labelW, 7);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9);
                doc.setTextColor(30, 41, 59);
                doc.text(label, ML + 2, y + 5);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(51, 65, 85);
                doc.text(value, ML + labelW + 2, y + 5);
                y += 7;
            };

            // ── SECTION 1: Work Order Details ─────────────────────────────────
            sectionHeader('  1.  WORK ORDER DETAILS', 37, 99, 235);
            const wo = data.workOrder;
            [
                ['Work Order Number', val(wo.number)],
                ['PO Number', val(wo.poNumber)],
                ['Product Name', val(wo.productName)],
                ['Product Description', val(wo.productDescription)],
                ['Work Order Quantity', val(wo.quantity)],
                ['Panel Quantity', val(wo.panelQuantity)],
                ['Number of Sides', val(wo.sides)],
                ['Line ID', val(wo.lineId)],
                ['Remarks', val(wo.remarks)]
            ].forEach(([l, v], i) => kvRow(l, v, i % 2 === 0));

            y += 5;

            // ── SECTION 2: Stencil Details ────────────────────────────────────
            sectionHeader('  2.  STENCIL DETAILS', 15, 118, 110);
            const st = data.stencil;
            [
                ['Stencil / Model Name', val(st.name)],
                ['Job Number', val(st.jobNumber)],
                ['Revision', val(st.revision)],
                ['Thickness (mils)', val(st.thickness)],
                ['Manufacturing Date', fmtDate(st.manufacturingDate)],
                ['Side', val(st.side)],
                ['Current Life Cycle Count', val(st.currentLifeCycleCount)],
                ['Remaining Life Count', val(st.remainingLifeCount)]
            ].forEach(([l, v], i) => kvRow(l, v, i % 2 === 0));

            y += 5;

            // ── SECTION 3: Session Details ────────────────────────────────────
            sectionHeader('  3.  POST AOI SESSION DETAILS', 67, 56, 202);
            const sess = data.session;
            [
                ['Squeegee Number', val(sess.squeegeeNumber)],
                ['Solder Paste Barcode', val(sess.solderPasteBarcode)],
                ['PCB Side', val(sess.pcbSide)],
                ['Post AOI Started By', val(sess.startedBy)],
                ['Post AOI Started Date & Time', fmt(sess.startedAt)],
                ['Post AOI Status', val(sess.status)]
            ].forEach(([l, v], i) => kvRow(l, v, i % 2 === 0));

            y += 5;

            // ── SECTION 4: Production Summary ─────────────────────────────────
            sectionHeader('  4.  PRODUCTION SUMMARY', 124, 58, 237);
            const prod = data.production;
            [
                ['Work Order Quantity', val(prod.quantity)],
                ['Passed Quantity', val(prod.passed)],
                ['Failed Quantity', val(prod.failed)],
                ['Pending Quantity', val(prod.pending)],
                ['Invalid Scan Quantity', val(prod.invalid)],
                ['Duplicate Scan Quantity', val(prod.duplicate)]
            ].forEach(([l, v], i) => kvRow(l, v, i % 2 === 0));

            y += 5;

            // ── SECTION 5: Scan History Table ─────────────────────────────────
            sectionHeader('  5.  SCAN HISTORY', 21, 128, 61);

            checkPageBreak(12);
            const cols = [
                { label: 'Barcode', x: ML, w: 32 },
                { label: 'Scanned By', x: ML + 32, w: 20 },
                { label: 'Date & Time', x: ML + 52, w: 30 },
                { label: 'Status', x: ML + 82, w: 15 },
                { label: 'Failure Remark', x: ML + 97, w: 28 },
                { label: 'Repair Time', x: ML + 125, w: 29 },
                { label: 'Repair Remark', x: ML + 154, w: 28 }
            ];
            doc.setFillColor(31, 78, 121);
            doc.rect(ML, y, CW, 8, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(255, 255, 255);
            cols.forEach(c => doc.text(c.label, c.x + 1, y + 5.5));
            y += 8;

            if (data.scans.length === 0) {
                checkPageBreak(10);
                doc.setFont('helvetica', 'italic');
                doc.setFontSize(9);
                doc.setTextColor(148, 163, 184);
                doc.text('No scan records found for this session.', PW / 2, y + 6, { align: 'center' });
                y += 10;
            } else {
                data.scans.forEach((scan: any, idx: number) => {
                    checkPageBreak(8);
                    if (idx % 2 === 0) {
                        doc.setFillColor(255, 255, 255);
                    } else {
                        doc.setFillColor(248, 250, 252);
                    }
                    doc.rect(ML, y, CW, 7, 'F');
                    doc.setDrawColor(209, 213, 219);
                    doc.rect(ML, y, CW, 7);
                    cols.forEach(c => {
                        doc.line(c.x, y, c.x, y + 7);
                    });

                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(7);
                    doc.setTextColor(30, 41, 59);
                    
                    doc.text(val(scan.barcode), cols[0].x + 1, y + 5);
                    doc.text(val(scan.scanned_by), cols[1].x + 1, y + 5);
                    doc.text(fmt(scan.scanned_at), cols[2].x + 1, y + 5);

                    if (scan.result === 'PASS') doc.setTextColor(22, 101, 52);
                    else if (scan.result === 'FAIL') doc.setTextColor(153, 27, 27);
                    else doc.setTextColor(146, 64, 14);
                    doc.setFont('helvetica', 'bold');
                    doc.text(val(scan.result), cols[3].x + 1, y + 5);

                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(30, 41, 59);
                    
                    const remark = val(scan.remark);
                    const truncRemark = remark.length > 20 ? remark.slice(0, 18) + '…' : remark;
                    doc.text(truncRemark, cols[4].x + 1, y + 5);

                    doc.text(fmt(scan.repair_time), cols[5].x + 1, y + 5);

                    const repRem = val(scan.repair_remark);
                    const truncRep = repRem.length > 20 ? repRem.slice(0, 18) + '…' : repRem;
                    doc.text(truncRep, cols[6].x + 1, y + 5);

                    y += 7;
                });
            }

            addPageNum();
            doc.save(`Post_AOI_Report_${data.workOrder.number || workOrderId || 'report'}.pdf`);
            addToast('PDF report downloaded successfully.', 'success');
        } catch (err) {
            console.error('PDF generation error:', err);
            addToast('PDF report generation failed.', 'error');
        }
    };

    // Helper: generate Canvas helper for QR ZIP compilation
    const generateQRCanvasDataUrl = (barcode: string): Promise<string> => {
        return new Promise((resolve, reject) => {
            QRCode.toDataURL(barcode.replace(/-/g, "").toUpperCase(), {
                width: 250,
                margin: 2,
                errorCorrectionLevel: 'M'
            })
            .then(url => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 250;
                    canvas.height = 295;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(img, 0, 0);
                        ctx.font = 'bold 15px monospace';
                        ctx.fillStyle = '#000000';
                        ctx.textAlign = 'center';
                        ctx.fillText(barcode, canvas.width / 2, 275);
                        resolve(canvas.toDataURL('image/png'));
                    } else {
                        reject(new Error('Canvas context failed'));
                    }
                };
                img.onerror = reject;
                img.src = url;
            })
            .catch(reject);
        });
    };

    // Bulk QR Code Images ZIP download
    const handleDownloadAllQRPNG = async () => {
        const validScans = stats.scans.filter(s => s.result === 'PASS' || s.result === 'FAIL');
        if (validScans.length === 0) {
            addToast('No valid barcodes scanned in this session yet.', 'info');
            return;
        }

        setIsZipping(true);
        addToast('Compiling ZIP of QR codes. Please wait...', 'info');

        try {
            const zip = new JSZip();
            const folder = zip.folder("qr_codes");

            for (const scan of validScans) {
                const dataUrl = await generateQRCanvasDataUrl(scan.barcode);
                const base64Data = dataUrl.replace(/^data:image\/(png|jpg);base64,/, "");
                folder?.file(`${scan.barcode}.png`, base64Data, { base64: true });
            }

            const content = await zip.generateAsync({ type: "blob" });
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `QR_Codes_Session_${activeSession?.work_order_id}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            addToast('QR Code images ZIP downloaded successfully.', 'success');
        } catch (err) {
            console.error('ZIP packaging failed:', err);
            addToast('Failed to compile ZIP archive.', 'error');
        } finally {
            setIsZipping(false);
        }
    };

    // Bulk QR Code Labels PDF download
    const handleDownloadAllQRPDF = async () => {
        const validScans = stats.scans.filter(s => s.result === 'PASS' || s.result === 'FAIL');
        if (validScans.length === 0) {
            addToast('No valid barcodes scanned in this session yet.', 'info');
            return;
        }

        addToast('Compiling QR Labels PDF. Please wait...', 'info');

        try {
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: [80, 95]
            });

            for (let i = 0; i < validScans.length; i++) {
                if (i > 0) {
                    doc.addPage();
                }
                const scan = validScans[i];
                const qrUrl = await generateQRCanvasDataUrl(scan.barcode);
                doc.addImage(qrUrl, 'PNG', 5, 5, 70, 82.6);
            }

            doc.save(`QR_Labels_Session_${activeSession?.work_order_id}.pdf`);
            addToast('QR Labels PDF downloaded successfully.', 'success');
        } catch (err) {
            console.error('PDF compilation failed:', err);
            addToast('Failed to compile QR Labels PDF.', 'error');
        }
    };

    // Single QR Code downloads
    const downloadSinglePNG = () => {
        if (singleQrDataUrl && selectedQrBarcode) {
            const a = document.createElement('a');
            a.href = singleQrDataUrl;
            a.download = `${selectedQrBarcode}.png`;
            a.click();
        }
    };

    const downloadSinglePDF = () => {
        if (singleQrDataUrl && selectedQrBarcode) {
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: [80, 95]
            });
            doc.addImage(singleQrDataUrl, 'PNG', 5, 5, 70, 82.6);
            doc.save(`${selectedQrBarcode}.pdf`);
        }
    };

    const getStatusBadge = (status: string) => {
        const lower = status.toLowerCase();
        let bg = '#f3f4f6';
        let color = '#374151';

        if (lower === 'in progress') {
            bg = '#dbeafe'; color = '#1e40af';
        } else if (lower === 'paused') {
            bg = '#fef3c7'; color = '#92400e';
        } else if (lower === 'completed') {
            bg = '#dcfce7'; color = '#166534';
        } else if (lower === 'cancelled') {
            bg = '#f3f4f6'; color = '#4b5563';
        } else if (lower === 'aborted') {
            bg = '#fee2e2'; color = '#991b1b';
        }

        return (
            <span style={{
                padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.8rem',
                fontWeight: 700, backgroundColor: bg, color
            }}>
                {status}
            </span>
        );
    };

    const getScanResultBadge = (result: string) => {
        const lower = result.toLowerCase();
        let bg = '#e2e8f0';
        let color = '#475569';

        if (lower === 'pass') {
            bg = '#dcfce7'; color = '#15803d';
        } else if (lower === 'fail') {
            bg = '#fee2e2'; color = '#b91c1c';
        } else if (lower === 'invalid') {
            bg = '#fef3c7'; color = '#b45309';
        }

        return (
            <span style={{
                padding: '0.2rem 0.6rem', borderRadius: '0.25rem', fontSize: '0.8rem',
                fontWeight: 700, backgroundColor: bg, color
            }}>
                {result}
            </span>
        );
    };

    const renderUnifiedInfoPanel = (details: any) => {
        if (!details) return null;
        return (
            <div className={styles.infoPanel}>
                <div className={styles.infoPanelTitle}>
                    <span>📋</span> Unified Production & Stencil Information Panel
                </div>
                <div className={styles.infoPanelGrid}>
                    {/* Work Order Info */}
                    <div className={styles.infoSection}>
                        <h4>Work Order Information</h4>
                        <div className={styles.infoGrid}>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>Work Order ID</span>
                                <span className={styles.infoValue}>{details.workOrderId}</span>
                            </div>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>PO ID</span>
                                <span className={styles.infoValue}>{details.poId || '—'}</span>
                            </div>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>Product Name</span>
                                <span className={styles.infoValue}>{details.productName || '—'}</span>
                            </div>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>Product Description</span>
                                <span className={styles.infoValue}>{details.productDescription || '—'}</span>
                            </div>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>Number of Sides</span>
                                <span className={styles.infoValue}>{details.numberOfSides || '—'}</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                <div className={styles.infoItem}>
                                    <span className={styles.infoLabel}>WO Qty</span>
                                    <span className={styles.infoValue}>{details.workOrderQuantity}</span>
                                </div>
                                <div className={styles.infoItem}>
                                    <span className={styles.infoLabel}>Panel Qty</span>
                                    <span className={styles.infoValue}>{details.panelQuantity}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Stencil Info */}
                    <div className={styles.infoSection}>
                        <h4>Stencil Information</h4>
                        <div className={styles.infoGrid}>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>Stencil / Model Name</span>
                                <span className={styles.infoValue}>{details.stencilName}</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                <div className={styles.infoItem}>
                                    <span className={styles.infoLabel}>Job Number</span>
                                    <span className={styles.infoValue}>{details.jobNumber || '—'}</span>
                                </div>
                                <div className={styles.infoItem}>
                                    <span className={styles.infoLabel}>Revision</span>
                                    <span className={styles.infoValue}>{details.revision || '—'}</span>
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                <div className={styles.infoItem}>
                                    <span className={styles.infoLabel}>Thickness</span>
                                    <span className={styles.infoValue}>{details.thickness || '—'}</span>
                                </div>
                                <div className={styles.infoItem}>
                                    <span className={styles.infoLabel}>Side</span>
                                    <span className={styles.infoValue}>{details.side}</span>
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                <div className={styles.infoItem}>
                                    <span className={styles.infoLabel}>Mfg Date</span>
                                    <span className={styles.infoValue} style={{ fontSize: '0.8rem' }}>
                                        {details.manufacturingDate ? new Date(details.manufacturingDate).toLocaleDateString() : '—'}
                                    </span>
                                </div>
                                <div className={styles.infoItem}>
                                    <span className={styles.infoLabel}>Status</span>
                                    <span className={`${styles.infoValue} ${details.lifeCycleStatus === 'Active' || details.lifeCycleStatus === 'Available' ? styles.statusActive : styles.statusInactive}`}>
                                        {details.lifeCycleStatus || '—'}
                                    </span>
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', borderTop: '1px dashed #e2e8f0', paddingTop: '0.5rem' }}>
                                <div className={styles.infoItem}>
                                    <span className={styles.infoLabel}>Used Cycles</span>
                                    <span className={styles.infoValue}>{details.currentLifeCycleCount}</span>
                                </div>
                                <div className={styles.infoItem}>
                                    <span className={styles.infoLabel}>Remaining</span>
                                    <span className={styles.infoValue} style={{ color: details.remainingLifeCycleCount < 500 ? '#dc2626' : 'inherit' }}>
                                        {details.remainingLifeCycleCount}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Printing Info */}
                    <div className={styles.infoSection}>
                        <h4>Printing Information</h4>
                        <div className={styles.infoGrid}>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>Squeegee Number</span>
                                <span className={styles.infoValue}>{details.squeegeeNumber}</span>
                            </div>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>Solder Paste Barcode</span>
                                <span className={styles.infoValue} style={{ wordBreak: 'break-all' }}>{details.solderPasteBarcode}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className={styles.container}>
            <Toaster toasts={toasts} onRemove={removeToast} />
            
            <div className={styles.header}>
                <h2>🔍 SMT Post AOI Process</h2>
                <p>Enforce serial number tracking, stencil life verification, and inspections at the Post AOI stage.</p>
            </div>

            {!activeSession ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
                    {/* Work Order Selector Card */}
                    <div className={styles.card} style={{ marginBottom: '0' }}>
                        <h3>Select Work Order</h3>
                        <div className={styles.inputGroup} style={{ maxWidth: '480px' }}>
                            <WorkOrderSelector
                                options={eligibleWos}
                                value={selectedWoId}
                                onChange={setSelectedWoId}
                                placeholder="-- Select Eligible Work Order --"
                                valueKey="work_order_id"
                                labelKey="work_order_id"
                                productNameKey="product_name"
                                quantityKey="work_order_quantity"
                                required
                            />
                        </div>
                    </div>

                    {/* Unified Information Panel */}
                    {detailsLoading ? (
                        <div className={styles.card} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                            <div style={{ display: 'inline-block', width: '2rem', height: '2rem', border: '3px solid #cbd5e1', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '0.5rem' }}></div>
                            <p style={{ margin: '0' }}>Loading SMT production, stencil, and printing parameters...</p>
                        </div>
                    ) : autoPopulatedDetails ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {renderUnifiedInfoPanel(autoPopulatedDetails)}
                            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                                <button onClick={handleStartSession} className={styles.button} style={{ padding: '0.8rem 3rem', fontSize: '1.05rem' }}>
                                    Start Post AOI Session
                                </button>
                            </div>
                        </div>
                    ) : detailsError ? (
                        <div className={styles.card} style={{ padding: '2rem', textAlign: 'center', color: '#dc2626', borderColor: '#fca5a5', backgroundColor: '#fef2f2' }}>
                            <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>⚠️</span>
                            {detailsError}
                        </div>
                    ) : selectedWoId ? (
                        <div className={styles.card} style={{ padding: '2rem', textAlign: 'center', color: '#dc2626', borderColor: '#fca5a5', backgroundColor: '#fef2f2' }}>
                            <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>⚠️</span>
                            Failed to load auto-populated details for this Work Order. Make sure SMT Printing setup exists and eligible barcodes are available.
                        </div>
                    ) : (
                        <div className={styles.card} style={{ padding: '3rem', textAlign: 'center', color: '#64748b', border: '1px dashed #cbd5e1' }}>
                            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.75rem' }}>📋</span>
                            Select an eligible Work Order to load linked Stencil and SMT Printing parameters.
                        </div>
                    )}

                    {/* Active Sessions Panel */}
                    <div className={styles.card}>
                        <h3>Active Post AOI Sessions</h3>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1, maxWidth: '400px' }}>
                                <input
                                    type="text"
                                    className={styles.input}
                                    placeholder="Search by WO, Product, PO ID..."
                                    value={activeSearch}
                                    onChange={e => setActiveSearch(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleActiveSearchSubmit(); }}
                                    style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                                />
                                <button
                                    className={styles.button}
                                    onClick={handleActiveSearchSubmit}
                                    style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                                >
                                    Search
                                </button>
                                {activeSearch && (
                                    <button
                                        className={styles.secondaryButton}
                                        onClick={handleActiveClear}
                                        style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.85rem', color: '#64748b' }}>
                                <span>Show</span>
                                <select
                                    className={styles.select}
                                    value={activeLimit}
                                    onChange={e => {
                                        const newLimit = parseInt(e.target.value);
                                        setActiveLimit(newLimit);
                                        setActivePage(1);
                                        fetchActiveSessions(1, newLimit, activeSearch);
                                    }}
                                    style={{ padding: '0.35rem 1.5rem 0.35rem 0.75rem', width: 'auto', fontSize: '0.85rem' }}
                                >
                                    <option value={5}>5</option>
                                    <option value={10}>10</option>
                                    <option value={20}>20</option>
                                    <option value={50}>50</option>
                                </select>
                                <span>entries</span>
                            </div>
                        </div>

                        {sessionsLoading ? (
                            <div style={{ textAlign: 'center', padding: '1rem' }}>Loading sessions...</div>
                        ) : (
                            <>
                                <div className={styles.tableContainer}>
                                    <table className={styles.table}>
                                        <thead>
                                            <tr>
                                                <th>WO Number</th>
                                                <th>Product Name</th>
                                                <th>Target Qty</th>
                                                <th>Stencil Name</th>
                                                <th>Squeegee No</th>
                                                <th>Solder Paste</th>
                                                <th>Side</th>
                                                <th>Status</th>
                                                <th>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {activeSessionsList.map(session => (
                                                <tr key={session.id}>
                                                    <td style={{ fontWeight: 600, color: '#4f46e5' }}>{session.work_order_id}</td>
                                                    <td>{session.product_name || '-'}</td>
                                                    <td>{session.work_order_quantity || '-'}</td>
                                                    <td>{session.stencil_name || '-'}</td>
                                                    <td>{session.squeegee_number}</td>
                                                    <td style={{ fontSize: '0.85rem', color: '#64748b' }}>{session.solder_paste_barcode}</td>
                                                    <td>{session.side}</td>
                                                    <td>{getStatusBadge(session.status)}</td>
                                                    <td style={{ display: 'flex', gap: '8px' }}>
                                                        <button
                                                            className={styles.secondaryButton}
                                                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', backgroundColor: '#eef2ff', color: '#4338ca', borderColor: '#c7d2fe' }}
                                                            onClick={() => setActiveSession(session)}
                                                        >
                                                            View Details / Resume
                                                        </button>
                                                        <button
                                                            className={styles.secondaryButton}
                                                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', color: '#b91c1c', borderColor: '#fca5a5' }}
                                                            onClick={() => handleDeleteSession(session.id, session.work_order_id)}
                                                        >
                                                            Delete
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {activeSessionsList.length === 0 && (
                                                <tr>
                                                    <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                                        No active Post AOI sessions found. Set up a session to begin.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                        Showing {Math.min((activePage - 1) * activeLimit + 1, activeTotal)} to {Math.min(activePage * activeLimit, activeTotal)} of {activeTotal} entries
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <button
                                            className={styles.secondaryButton}
                                            disabled={activePage === 1}
                                            onClick={() => {
                                                const p = activePage - 1;
                                                setActivePage(p);
                                                fetchActiveSessions(p, activeLimit, activeSearch);
                                            }}
                                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
                                        >
                                            Previous
                                        </button>
                                        <span style={{ display: 'flex', alignItems: 'center', padding: '0 0.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                                            Page {activePage} of {Math.ceil(activeTotal / activeLimit) || 1}
                                        </span>
                                        <button
                                            className={styles.secondaryButton}
                                            disabled={activePage >= Math.ceil(activeTotal / activeLimit)}
                                            onClick={() => {
                                                const p = activePage + 1;
                                                setActivePage(p);
                                                fetchActiveSessions(p, activeLimit, activeSearch);
                                            }}
                                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Completed Sessions Panel */}
                    <div className={styles.card}>
                        <h3>Completed Post AOI Sessions History</h3>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1, maxWidth: '400px' }}>
                                <input
                                    type="text"
                                    className={styles.input}
                                    placeholder="Search by WO, Product, PO ID..."
                                    value={completedSearch}
                                    onChange={e => setCompletedSearch(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleCompletedSearchSubmit(); }}
                                    style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                                />
                                <button
                                    className={styles.button}
                                    onClick={handleCompletedSearchSubmit}
                                    style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                                >
                                    Search
                                </button>
                                {completedSearch && (
                                    <button
                                        className={styles.secondaryButton}
                                        onClick={handleCompletedClear}
                                        style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.85rem', color: '#64748b' }}>
                                <span>Show</span>
                                <select
                                    className={styles.select}
                                    value={completedLimit}
                                    onChange={e => {
                                        const newLimit = parseInt(e.target.value);
                                        setCompletedLimit(newLimit);
                                        setCompletedPage(1);
                                        fetchCompletedSessions(1, newLimit, completedSearch);
                                    }}
                                    style={{ padding: '0.35rem 1.5rem 0.35rem 0.75rem', width: 'auto', fontSize: '0.85rem' }}
                                >
                                    <option value={5}>5</option>
                                    <option value={10}>10</option>
                                    <option value={20}>20</option>
                                    <option value={50}>50</option>
                                </select>
                                <span>entries</span>
                            </div>
                        </div>

                        {sessionsLoading ? (
                            <div style={{ textAlign: 'center', padding: '1rem' }}>Loading sessions...</div>
                        ) : (
                            <>
                                <div className={styles.tableContainer}>
                                    <table className={styles.table}>
                                        <thead>
                                            <tr>
                                                <th>WO Number</th>
                                                <th>Product Name</th>
                                                <th>Target Qty</th>
                                                <th>Stencil Name</th>
                                                <th>Squeegee No</th>
                                                <th>Solder Paste</th>
                                                <th>Side</th>
                                                <th>Status</th>
                                                <th>Closed At</th>
                                                <th>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {completedSessionsList.map(session => (
                                                <tr key={session.id}>
                                                    <td style={{ fontWeight: 600, color: '#334155' }}>{session.work_order_id}</td>
                                                    <td>{session.product_name || '-'}</td>
                                                    <td>{session.work_order_quantity || '-'}</td>
                                                    <td>{session.stencil_name || '-'}</td>
                                                    <td>{session.squeegee_number}</td>
                                                    <td style={{ fontSize: '0.85rem', color: '#64748b' }}>{session.solder_paste_barcode}</td>
                                                    <td>{session.side}</td>
                                                    <td>{getStatusBadge(session.status)}</td>
                                                    <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                                        {session.updated_at ? new Date(session.updated_at).toLocaleString() : new Date(session.created_at).toLocaleString()}
                                                    </td>
                                                    <td style={{ display: 'flex', gap: '8px' }}>
                                                        <button
                                                            className={styles.secondaryButton}
                                                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                                                            onClick={() => setActiveSession(session)}
                                                        >
                                                            View Details
                                                        </button>
                                                        <button
                                                            className={styles.secondaryButton}
                                                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                            onClick={() => handleExportExcel(session.id, session.work_order_id)}
                                                        >
                                                            Excel 📊
                                                        </button>
                                                        <button
                                                            className={styles.secondaryButton}
                                                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                            onClick={() => handleExportFullPDF(session.id, session.work_order_id)}
                                                        >
                                                            PDF 📄
                                                        </button>
                                                        <button
                                                            className={styles.secondaryButton}
                                                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', color: '#b91c1c', borderColor: '#fca5a5' }}
                                                            onClick={() => handleDeleteSession(session.id, session.work_order_id)}
                                                        >
                                                            Delete
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {completedSessionsList.length === 0 && (
                                                <tr>
                                                    <td colSpan={10} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                                        No historical Post AOI sessions found.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                        Showing {Math.min((completedPage - 1) * completedLimit + 1, completedTotal)} to {Math.min(completedPage * completedLimit, completedTotal)} of {completedTotal} entries
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <button
                                            className={styles.secondaryButton}
                                            disabled={completedPage === 1}
                                            onClick={() => {
                                                const p = completedPage - 1;
                                                setCompletedPage(p);
                                                fetchCompletedSessions(p, completedLimit, completedSearch);
                                            }}
                                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
                                        >
                                            Previous
                                        </button>
                                        <span style={{ display: 'flex', alignItems: 'center', padding: '0 0.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                                            Page {completedPage} of {Math.ceil(completedTotal / completedLimit) || 1}
                                        </span>
                                        <button
                                            className={styles.secondaryButton}
                                            disabled={completedPage >= Math.ceil(completedTotal / completedLimit)}
                                            onClick={() => {
                                                const p = completedPage + 1;
                                                setCompletedPage(p);
                                                fetchCompletedSessions(p, completedLimit, completedSearch);
                                            }}
                                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            ) : (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
                        <button className={styles.detailBackButton} onClick={() => { setActiveSession(null); fetchSessionsLists(); }}>
                            ← Back to Session Setup
                        </button>
                    </div>

                    {/* Unified Information Panel */}
                    {autoPopulatedDetails ? (
                        renderUnifiedInfoPanel(autoPopulatedDetails)
                    ) : (
                        <div className={styles.card} style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b' }}>
                            Loading session parameters...
                        </div>
                    )}

                    {/* Stats Dashboard Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                        <div className={styles.card} style={{ margin: 0, padding: '1.25rem', borderLeft: '5px solid #2563eb', textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>WO Quantity</p>
                            <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.8rem', color: '#1e293b' }}>{stats.workOrderQuantity}</h2>
                        </div>
                        <div className={styles.card} style={{ margin: 0, padding: '1.25rem', borderLeft: '5px solid #6366f1', textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>Processed</p>
                            <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.8rem', color: '#1e293b' }}>{stats.processedQuantity}</h2>
                        </div>
                        <div className={styles.card} style={{ margin: 0, padding: '1.25rem', borderLeft: '5px solid #16a34a', textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>Passed</p>
                            <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.8rem', color: '#15803d' }}>{stats.passed}</h2>
                        </div>
                        <div className={styles.card} style={{ margin: 0, padding: '1.25rem', borderLeft: '5px solid #dc2626', textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>Failed</p>
                            <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.8rem', color: '#b91c1c' }}>{stats.failed}</h2>
                        </div>
                        <div className={styles.card} style={{ margin: 0, padding: '1.25rem', borderLeft: '5px solid #64748b', textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>Pending</p>
                            <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.8rem', color: '#475569' }}>{stats.pending}</h2>
                        </div>
                        <div className={styles.card} style={{ margin: 0, padding: '1.25rem', borderLeft: '5px solid #d97706', textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>Invalid</p>
                            <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.8rem', color: '#b45309' }}>{stats.invalid}</h2>
                        </div>
                        <div className={styles.card} style={{ margin: 0, padding: '1.25rem', borderLeft: '5px solid #ea580c', textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>Duplicate</p>
                            <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.8rem', color: '#c2410c' }}>{stats.duplicate}</h2>
                        </div>
                    </div>

                    {/* Barcode Scanner Input */}
                    {activeSession.status !== 'Completed' ? (
                        <div className={styles.detailScanCard}>
                            <form onSubmit={handleBarcodeSubmit} className={styles.detailScanForm}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h4 style={{ margin: 0, color: '#1e293b', fontSize: '1.05rem', fontWeight: 700 }}>
                                        High-Speed Production Scanner Input
                                    </h4>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#16a34a', fontWeight: 600 }}>
                                        <span className={styles.blinkingDot} style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16a34a', display: 'inline-block' }}></span>
                                        Scanner Focus Locked
                                    </div>
                                </div>
                                <div className={styles.detailScanRow}>
                                    <input
                                        ref={scanInputRef}
                                        type="text"
                                        className={styles.detailScanInput}
                                        placeholder="Scan PCB Barcode / Serial Number..."
                                        value={scanBarcodeVal}
                                        onChange={e => setScanBarcodeVal(e.target.value)}
                                        disabled={isScanning || isModalOpen}
                                        autoFocus={!isModalOpen}
                                    />
                                    <button type="submit" className={styles.detailScanButton} disabled={isScanning || isModalOpen}>
                                        {isScanning ? 'Validating...' : 'Submit'}
                                    </button>
                                </div>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                                    💡 Place your cursor in the input box or scan directly. Valid barcodes will automatically record a <strong>PASS</strong> status. Duplicate scans will trigger alerts without interrupting high-speed scanner flow.
                                </p>
                            </form>
                        </div>
                    ) : (
                        <div className={styles.detailScanCard} style={{ background: '#f0fdf4', border: '1px dashed #16a34a', textAlign: 'center', padding: '1.5rem' }}>
                            <span style={{ fontSize: '1.5rem', marginRight: '6px' }}>✅</span>
                            <strong>This session has been completed and is read-only.</strong> Scanning is disabled.
                        </div>
                    )}

                    {/* Scanned Serial List Table */}
                    <div className={styles.detailItemsSection}>
                        <div className={styles.detailItemsHeader}>
                            <h3>Scanned PCB Inspection Logs ({stats.scans.length} rows)</h3>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, marginRight: 2 }}>Reports:</span>
                                <button
                                    className={styles.secondaryButton}
                                    style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem', background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.4rem 0.8rem', fontWeight: 600, cursor: 'pointer' }}
                                    onClick={() => handleExportExcel()}
                                    title="Download full Excel production report"
                                >
                                    📊 Excel Report
                                </button>
                                <button
                                    className={styles.secondaryButton}
                                    style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem', background: 'linear-gradient(135deg,#7c3aed,#4338ca)', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.4rem 0.8rem', fontWeight: 600, cursor: 'pointer' }}
                                    onClick={() => handleExportFullPDF()}
                                    title="Download full PDF production report"
                                >
                                    📄 PDF Report
                                </button>
                                <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, marginLeft: 6, marginRight: 2 }}>Raw:</span>
                                <button className={styles.secondaryButton} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }} onClick={handleExportCSV} title="Download CSV scan log">
                                    CSV 📄
                                </button>
                                <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, marginLeft: 6, marginRight: 2 }}>QR:</span>
                                <button className={styles.secondaryButton} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }} onClick={handleDownloadAllQRPDF} title="Download all QR labels as PDF">
                                    All QR Labels (PDF) 🏷️
                                </button>
                                <button className={styles.secondaryButton} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }} onClick={handleDownloadAllQRPNG} disabled={isZipping} title="Download all QR images as ZIP">
                                    {isZipping ? 'Compiling ZIP...' : 'All QR Images (ZIP) 📦'}
                                </button>
                            </div>
                        </div>

                        <div className={styles.detailTableContainer}>
                            <table className={styles.table} style={{ marginTop: 0 }}>
                                <thead>
                                    <tr>
                                        <th>Barcode</th>
                                        <th>Scanned By</th>
                                        <th>Date & Time</th>
                                        <th>Status</th>
                                        <th>Failure Remark</th>
                                        <th>Repair Time</th>
                                        <th>Repair Remark</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.scans.map(scan => (
                                        <tr key={scan.scan_id} className={scan.result === 'FAIL' ? styles.detailPendingRow : ''}>
                                            <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1rem', letterSpacing: '0.5px' }}>
                                                {editingScanId === scan.scan_id ? (
                                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                        <input
                                                            type="text"
                                                            className={styles.input}
                                                            style={{ padding: '0.35rem 0.5rem', width: '220px', fontSize: '0.9rem' }}
                                                            value={editingBarcodeText}
                                                            onChange={e => setEditingBarcodeText(e.target.value)}
                                                            onKeyDown={e => {
                                                                 if (e.key === 'Enter') submitInlineEdit(scan.scan_id);
                                                                 if (e.key === 'Escape') setEditingScanId(null);
                                                            }}
                                                            autoFocus
                                                        />
                                                        <button
                                                            className={styles.secondaryButton}
                                                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', backgroundColor: '#dcfce7', color: '#15803d', borderColor: '#86efac' }}
                                                            onClick={() => submitInlineEdit(scan.scan_id)}
                                                        >
                                                            Save
                                                        </button>
                                                        <button
                                                            className={styles.secondaryButton}
                                                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', backgroundColor: '#fee2e2', color: '#b91c1c', borderColor: '#fca5a5' }}
                                                            onClick={() => setEditingScanId(null)}
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span>{scan.barcode}</span>
                                                )}
                                            </td>
                                            <td>{scan.scanned_by}</td>
                                            <td style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                                {formatTimestamp(scan.scanned_at)}
                                            </td>
                                            <td>{getScanResultBadge(scan.result)}</td>
                                            <td style={{ color: scan.remark ? '#b91c1c' : '#64748b', fontWeight: scan.remark ? 600 : 'normal' }}>
                                                {renderRemarkCell(scan.remark, 'Failure')}
                                            </td>
                                            <td style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                                {formatTimestamp(scan.repair_time)}
                                            </td>
                                            <td style={{ color: scan.repair_remark ? '#166534' : '#64748b', fontWeight: scan.repair_remark ? 600 : 'normal' }}>
                                                {renderRemarkCell(scan.repair_remark, 'Repair')}
                                            </td>
                                            <td style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                {activeSession.status !== 'Completed' && scan.result !== 'INVALID' && (
                                                    <button
                                                        className={styles.secondaryButton}
                                                        title="Edit barcode"
                                                        style={{ padding: '0.3rem 0.45rem', fontSize: '1rem', lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 'auto', borderRadius: '6px' }}
                                                        onClick={() => startInlineEdit(scan)}
                                                    >
                                                        ✏️
                                                    </button>
                                                )}
                                                {activeSession.status !== 'Completed' && scan.result === 'PASS' && (
                                                    <button
                                                        className={styles.secondaryButton}
                                                        title="Mark as Failed"
                                                        style={{ padding: '0.3rem 0.45rem', fontSize: '1rem', lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 'auto', borderRadius: '6px', color: '#dc2626', borderColor: '#fca5a5' }}
                                                        onClick={() => triggerFailRow(scan)}
                                                    >
                                                        ❌
                                                    </button>
                                                )}
                                                {scan.result !== 'INVALID' && (
                                                    <button
                                                        className={styles.secondaryButton}
                                                        title="View QR code"
                                                        style={{ padding: '0.3rem 0.45rem', fontSize: '1rem', lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 'auto', borderRadius: '6px' }}
                                                        onClick={() => setSelectedQrBarcode(scan.barcode)}
                                                    >
                                                        🔳
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {stats.scans.length === 0 && (
                                        <tr>
                                            <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                                                No PCBs scanned in this session yet. Scan barcodes above to record inspections.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── MODAL 1: ABORT SESSION REMARK DIALOG ───────────────────────── */}
            {showAbortModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className={styles.card} style={{ width: '450px', padding: '1.75rem', margin: 0, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)' }}>
                        <h3 style={{ borderBottom: 'none', padding: 0, marginBottom: '1rem' }}>🚨 Abort Post AOI Session</h3>
                        <p style={{ fontSize: '0.9rem', color: '#4b5563', marginBottom: '1.25rem' }}>
                            Aborting a session is a critical operational event. Please specify the mandatory failure remark.
                        </p>
                        <div className={styles.inputGroup} style={{ marginBottom: '1.5rem' }}>
                            <label>Abort Reason / Failure Remark *</label>
                            <textarea
                                className={styles.input}
                                style={{ minHeight: '90px', fontFamily: 'inherit', resize: 'vertical' }}
                                placeholder="Enter failure details..."
                                value={abortRemark}
                                onChange={e => setAbortRemark(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button
                                className={styles.secondaryButton}
                                onClick={() => { setShowAbortModal(false); setAbortRemark(''); }}
                            >
                                Cancel
                            </button>
                            <button
                                className={styles.button}
                                style={{ backgroundColor: '#dc2626', backgroundImage: 'none' }}
                                onClick={submitAbortSession}
                            >
                                Abort Session
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── MODAL 2: FAIL SCAN ROW REMARK DIALOG ───────────────────────── */}
            {selectedScanToFail && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className={styles.card} style={{ width: '450px', padding: '1.75rem', margin: 0, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)' }}>
                        <h3 style={{ borderBottom: 'none', padding: 0, marginBottom: '1rem' }}>⚠️ Report Defective PCB (FAIL)</h3>
                        <p style={{ fontSize: '0.9rem', color: '#4b5563', marginBottom: '1.25rem' }}>
                            You are changing the inspection status of barcode <strong>{selectedScanToFail.barcode}</strong> from <strong>PASS</strong> to <strong>FAIL</strong>. Please input the mandatory failure remark.
                        </p>
                        <div className={styles.inputGroup} style={{ marginBottom: '1.5rem' }}>
                            <label>Failure Reason / Defect Remarks *</label>
                            <textarea
                                className={styles.input}
                                style={{ minHeight: '90px', fontFamily: 'inherit', resize: 'vertical' }}
                                placeholder="E.g. solder bridging, smudge defect, insufficient coverage..."
                                value={failRemark}
                                onChange={e => setFailRemark(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button
                                className={styles.secondaryButton}
                                onClick={() => setSelectedScanToFail(null)}
                            >
                                Cancel
                            </button>
                            <button
                                className={styles.button}
                                style={{ backgroundColor: '#dc2626', backgroundImage: 'none' }}
                                onClick={submitFailRow}
                            >
                                Mark as FAIL
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── MODAL 2b: REPAIR SCAN ROW REMARK DIALOG ───────────────────────── */}
            {selectedScanToRepair && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className={styles.card} style={{ width: '450px', padding: '1.75rem', margin: 0, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)' }}>
                        <h3 style={{ borderBottom: 'none', padding: 0, marginBottom: '1rem' }}>🔧 Repair Process (FAIL → PASS)</h3>
                        <p style={{ fontSize: '0.9rem', color: '#4b5563', marginBottom: '1.25rem' }}>
                            Barcode <strong>{selectedScanToRepair.barcode}</strong> has a <strong>FAIL</strong> status. Please enter the mandatory Repair Remark to change its status to <strong>PASS</strong>.
                        </p>
                        <div className={styles.inputGroup} style={{ marginBottom: '1.5rem' }}>
                            <label>Repair Details / Actions Taken *</label>
                            <textarea
                                className={styles.input}
                                style={{ minHeight: '90px', fontFamily: 'inherit', resize: 'vertical' }}
                                placeholder="E.g. cleaned pads, reflowed joints, solder paste reapplied..."
                                value={repairRemark}
                                onChange={e => setRepairRemark(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button
                                className={styles.secondaryButton}
                                onClick={() => setSelectedScanToRepair(null)}
                            >
                                Cancel
                            </button>
                            <button
                                className={styles.button}
                                style={{ backgroundColor: '#166534', backgroundImage: 'none' }}
                                onClick={submitRepairRow}
                            >
                                Complete Repair
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── MODAL 3: SINGLE QR CODE PREVIEW MODAL ──────────────────────── */}
            {selectedQrBarcode && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className={styles.card} style={{ width: '380px', padding: '1.75rem', margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                        <h3 style={{ borderBottom: 'none', padding: 0, marginBottom: '1.5rem', width: '100%', textAlign: 'center' }}>
                            PCB Barcode QR Code
                        </h3>
                        
                        {singleQrDataUrl ? (
                            <div style={{ border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1rem', background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <img src={singleQrDataUrl} alt="QR Code Label" style={{ width: '200px', height: '236px', display: 'block' }} />
                            </div>
                        ) : (
                            <div style={{ height: '236px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                                Generating QR Canvas...
                            </div>
                        )}

                        <p style={{ margin: '1rem 0 1.5rem', fontSize: '0.85rem', color: '#64748b', textAlign: 'center' }}>
                            Barcode ID: <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>{selectedQrBarcode}</strong>
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', width: '100%', marginBottom: '1rem' }}>
                            <button className={styles.secondaryButton} style={{ fontSize: '0.85rem' }} onClick={downloadSinglePNG}>
                                PNG Image 📥
                            </button>
                            <button className={styles.secondaryButton} style={{ fontSize: '0.85rem' }} onClick={downloadSinglePDF}>
                                PDF Label 📥
                            </button>
                        </div>
                        
                        <button
                            className={styles.button}
                            style={{ width: '100%', backgroundColor: '#64748b', backgroundImage: 'none' }}
                            onClick={() => setSelectedQrBarcode(null)}
                        >
                            Close Preview
                        </button>
                    </div>
                </div>
            )}

            {/* ─── MODAL: VIEW FULL REMARK DIALOG ───────────────────────── */}
            {viewingRemarkText && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className={styles.card} style={{ width: '450px', padding: '1.75rem', margin: 0, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)' }}>
                        <h3 style={{ borderBottom: 'none', padding: 0, marginBottom: '1rem', color: viewingRemarkTitle.includes('Failure') ? '#b91c1c' : '#166534' }}>
                            {viewingRemarkTitle}
                        </h3>
                        <div style={{
                            backgroundColor: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '0.5rem',
                            padding: '1rem',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            fontSize: '0.95rem',
                            color: '#1e293b',
                            lineHeight: '1.5',
                            marginBottom: '1.5rem'
                        }}>
                            {viewingRemarkText}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                className={styles.secondaryButton}
                                style={{ padding: '0.5rem 1.25rem', fontWeight: 600, minWidth: '80px' }}
                                onClick={() => { setViewingRemarkText(null); setViewingRemarkTitle(''); }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes slideIn {
                    from { transform: translateY(1rem); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .blinkingDot {
                    animation: blink 1.2s infinite;
                }
                @keyframes blink {
                    0% { opacity: 0.3; }
                    50% { opacity: 1; }
                    100% { opacity: 0.3; }
                }
            `}</style>
        </div>
    );
};

export default PostAoi;
