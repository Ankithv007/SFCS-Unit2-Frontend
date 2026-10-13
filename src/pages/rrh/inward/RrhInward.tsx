import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSmtAuth } from '../../../context/SmtAuthContext';
import { useAuth } from '../../../hooks/useAuth';
import styles from './Inward.module.css';
import { WorkOrderSelector } from '../../../components/WorkOrderSelector';
import { BarcodeSearch } from '../../../components/BarcodeSearch';
import { apiFetch } from '../../../utils/api';
import QRCode from 'qrcode';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import SMTCountDetailsModal from '../../../components/SMTCountDetailsModal';

// ─── Toaster Notification System ─────────────────────────────────────────────
interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
}

const Toaster: React.FC<{ toasts: Toast[]; onRemove: (id: number) => void }> = ({ toasts, onRemove }) => (
    <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 9999, display: 'flex', flexDirection: 'column-reverse', gap: '0.5rem' }}>
        {toasts.map(t => {
            const bg = t.type === 'error' ? '#fee2e2' : t.type === 'success' ? '#dcfce7' : t.type === 'warning' ? '#fef3c7' : '#eff6ff';
            const color = t.type === 'error' ? '#991b1b' : t.type === 'success' ? '#166534' : t.type === 'warning' ? '#92400e' : '#1e40af';
            const border = t.type === 'error' ? '#fca5a5' : t.type === 'success' ? '#86efac' : t.type === 'warning' ? '#fcd34d' : '#bfdbfe';
            const icon = t.type === 'error' ? '❌' : t.type === 'success' ? '✅' : t.type === 'warning' ? '⚠️' : 'ℹ️';

            return (
                <div key={t.id} onClick={() => onRemove(t.id)} style={{
                    padding: '0.85rem 1.25rem', borderRadius: '0.6rem', cursor: 'pointer', minWidth: '320px',
                    background: bg, color, border: `1px solid ${border}`,
                    fontWeight: 600, fontSize: '0.9rem', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    animation: 'slideIn 0.2s ease', display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                    <span>{icon}</span>
                    <span>{t.message}</span>
                </div>
            );
        })}
    </div>
);

// ─── TS Typings ──────────────────────────────────────────────────────────────
interface EligibleWorkOrder {
    id?: number | string;
    work_order_id: string;
    work_order_number?: string;
    work_order_date?: string;
    date?: string;
    lot_quantity?: number;
    status?: string;
    created_at?: string;
    created_by?: string;
    total_excel_rows?: number;
    excel_filename?: string;
}

interface InwardSession {
    id: string;
    work_order_id: string;
    status: string; // In Progress, Completed, Paused, Cancelled, Aborted
    created_by: string;
    created_by_name: string;
    created_at: string;
    updated_by?: string;
    updated_by_name?: string;
    updated_at?: string;
    duplicate_scan_count: number;
    lot_quantity?: number;
    lot_number?: string | null;
    excel_filename?: string;
    work_order_db_id?: number;
}

interface ScanRecord {
    scan_id: string | number;
    barcode: string;
    physical_serial_number?: string;
    original_serial_number?: string;
    corrected_serial_number?: string | null;
    physical_tpn?: string | null;
    band_serial_no?: string | null;
    matched_inventory_id?: number | null;
    result: 'PASS' | 'INVALID' | 'FAIL' | 'EDITED PASS';
    status?: string;
    remark: string | null;
    scanned_by: string;
    scanned_at: string;
    repair_time?: string | null;
    repair_remark?: string | null;
    repaired_by?: string | null;
    sl_no?: string | null;
    lot?: string | null;
    master_remark?: string | null;
    master_failure_description?: string | null;
}

interface RemainingMasterRecord {
    id: number;
    sl_no: string | null;
    physical_tpn: string | null;
    band_serial_no: string | null;
    tejas_dc_no: string | null;
    tejas_obd_no: string | null;
    lot: string | null;
    remarks: string | null;
    failure_description: string | null;
    pr_no?: string | null;
    invoice_rma_no?: string | null;
    global_row_number?: number | null;
}

interface SessionStats {
    workOrderQuantity: number;
    lotQuantity: number;
    passed: number;
    failed: number;
    invalid: number;
    pending: number;
    editedPass: number;
    duplicate: number;
    yield: string | number;
    yieldPercent?: string;
    scans: ScanRecord[];
    isCompleted?: boolean;
    status?: string;
}

const Inward: React.FC = () => {
    const { smtUser } = useSmtAuth();
    const { user } = useAuth();

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

    const formatWoDateTime = (rawDateTime?: string | null) => {
        if (!rawDateTime) return '—';
        try {
            const cleanStr = typeof rawDateTime === 'string' && rawDateTime.includes(' ') && !rawDateTime.includes('T')
                ? rawDateTime.replace(' ', 'T')
                : rawDateTime;
            const d = new Date(cleanStr);
            if (!isNaN(d.getTime())) {
                return d.toLocaleString('en-IN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true
                });
            }
        } catch {}
        return String(rawDateTime);
    };

    // ─── State Management ────────────────────────────────────────────────────
    const [eligibleWos, setEligibleWos] = useState<EligibleWorkOrder[]>([]);
    const [selectedWoId, setSelectedWoId] = useState('');
    const [selectedWoDetails, setSelectedWoDetails] = useState<{
        workOrderNumber: string;
        dateTime: string | null;
        lotQuantity: number;
    } | null>(null);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [detailsError, setDetailsError] = useState('');

    // Session states
    const [activeSession, setActiveSession] = useState<InwardSession | null>(null);
    const [activeSessionsList, setActiveSessionsList] = useState<InwardSession[]>([]);
    const [completedSessionsList, setCompletedSessionsList] = useState<InwardSession[]>([]);
    const [sessionsLoading, setSessionsLoading] = useState(false);

    // Active session pagination & search
    const [activePage, setActivePage] = useState(1);
    const [activeLimit, setActiveLimit] = useState(5);
    const [activeSearch, setActiveSearch] = useState('');
    const [activeTotal, setActiveTotal] = useState(0);

    // Completed session pagination & search
    const [completedPage, setCompletedPage] = useState(1);
    const [completedLimit, setCompletedLimit] = useState(5);
    const [completedSearch, setCompletedSearch] = useState('');
    const [completedTotal, setCompletedTotal] = useState(0);

    // Filter out active or completed work orders from the dropdown
    const availableWorkOrders = useMemo(() => {
        const activeWoIds = new Set(activeSessionsList.map((s: any) => String(s.work_order_id || '').trim().toUpperCase()));
        const completedWoIds = new Set(completedSessionsList.map((s: any) => String(s.work_order_id || '').trim().toUpperCase()));
        return eligibleWos.filter((w: any) => {
            const woId = String(w.work_order_id || '').trim().toUpperCase();
            if (activeWoIds.has(woId)) return false;
            if (completedWoIds.has(woId)) return false;
            return true;
        });
    }, [eligibleWos, activeSessionsList, completedSessionsList]);

    // Session Statistics
    const [stats, setStats] = useState<SessionStats>({
        workOrderQuantity: 0,
        lotQuantity: 0,
        passed: 0,
        failed: 0,
        invalid: 0,
        pending: 0,
        editedPass: 0,
        duplicate: 0,
        yield: '0.00',
        scans: []
    });

    // Scanner state
    const [scanBarcodeVal, setScanBarcodeVal] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [scansSearchQuery, setScansSearchQuery] = useState('');
    const [isSearchFocused, setIsSearchFocused] = useState(false);

    // Remaining Master Data List State
    const [remainingMasterData, setRemainingMasterData] = useState<RemainingMasterRecord[]>([]);
    const [remainingTotal, setRemainingTotal] = useState(0);
    const [remainingPage, setRemainingPage] = useState(1);
    const [remainingLimit, setRemainingLimit] = useState(10);
    const [remainingSearch, setRemainingSearch] = useState('');
    const [remainingLoading, setRemainingLoading] = useState(false);

    // Modals state
    const [abortRemark, setAbortRemark] = useState('');
    const [showAbortModal, setShowAbortModal] = useState(false);
    const [showFailedModal, setShowFailedModal] = useState(false);

    // Assign Modal state (for manual assignments)
    const [assigningMasterRecord, setAssigningMasterRecord] = useState<RemainingMasterRecord | null>(null);
    const [assignPhysicalSerial, setAssignPhysicalSerial] = useState('');
    const [assignRemarkText, setAssignRemarkText] = useState('');
    const [isAssigningSubmitting, setIsAssigningSubmitting] = useState(false);

    // QR Preview & Remarks Viewer Modal state
    const [selectedQrBarcode, setSelectedQrBarcode] = useState<string | null>(null);
    const [singleQrDataUrl, setSingleQrDataUrl] = useState<string | null>(null);
    const [isZipping, setIsZipping] = useState(false);
    const [viewingRemarkText, setViewingRemarkText] = useState<string | null>(null);
    const [viewingRemarkTitle, setViewingRemarkTitle] = useState<string>('');
    const [isExportingExcel, setIsExportingExcel] = useState(false);
    const [isExportingRemaining, setIsExportingRemaining] = useState(false);

    // Scanner focus lock ref
    const scanInputRef = useRef<HTMLInputElement>(null);

    // Toaster state
    const [toasts, setToasts] = useState<Toast[]>([]);
    const toastId = useRef(0);
    const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
        const id = ++toastId.current;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
    }, []);
    const removeToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

    const isSuperAdmin = smtUser?.role === 'Super Admin' || user?.role === 'Super Admin';
    const isModalOpen = showAbortModal || !!assigningMasterRecord || !!selectedQrBarcode || !!viewingRemarkText || showFailedModal;

    // Filtered Scans List for search
    const processedScans = React.useMemo(() => {
        const query = scansSearchQuery.trim().toLowerCase();
        if (!query) return stats.scans;

        const matches: ScanRecord[] = [];
        const nonMatches: ScanRecord[] = [];

        stats.scans.forEach(scan => {
            const serial = (scan.physical_serial_number || scan.barcode || '').toLowerCase();
            const orig = (scan.original_serial_number || '').toLowerCase();
            const tpn = (scan.physical_tpn || '').toLowerCase();
            const band = (scan.band_serial_no || '').toLowerCase();
            const scannedBy = (scan.scanned_by || '').toLowerCase();
            const remark = (scan.remark || '').toLowerCase();
            const repairRem = (scan.repair_remark || '').toLowerCase();

            if (
                serial.includes(query) ||
                orig.includes(query) ||
                tpn.includes(query) ||
                band.includes(query) ||
                scannedBy.includes(query) ||
                remark.includes(query) ||
                repairRem.includes(query)
            ) {
                matches.push(scan);
            } else {
                nonMatches.push(scan);
            }
        });

        return [...matches, ...nonMatches];
    }, [stats.scans, scansSearchQuery]);

    // ─── Initial Data Loading ────────────────────────────────────────────────
    useEffect(() => {
        fetchEligibleWorkOrders();
        fetchActiveSessions(1, activeLimit, '');
        fetchCompletedSessions(1, completedLimit, '');
    }, []);

    // Initial scanner focus when session becomes active
    useEffect(() => {
        if (activeSession && activeSession.status === 'In Progress' && !isModalOpen && !isSearchFocused) {
            if (scanInputRef.current && document.activeElement === document.body) {
                scanInputRef.current.focus({ preventScroll: true });
            }
        }
    }, [activeSession?.id]);

    const wasModalOpen = useRef(false);
    useEffect(() => {
        if (wasModalOpen.current && !isModalOpen && !isSearchFocused) {
            setTimeout(() => {
                scanInputRef.current?.focus({ preventScroll: true });
            }, 100);
        }
        wasModalOpen.current = isModalOpen;
    }, [isModalOpen, isSearchFocused]);

    // Single QR code generation
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

    // ─── Fetching Methods ────────────────────────────────────────────────────

    // 1. Fetch Eligible Work Orders (Excluding active or completed in Inward)
    const fetchEligibleWorkOrders = async () => {
        try {
            const response = await apiFetch('/api/rrh/inward/eligible-work-orders');
            setEligibleWos(response?.data || []);
        } catch (err: any) {
            console.error('Error fetching eligible work orders:', err);
            addToast('Failed to load eligible work orders.', 'error');
        }
    };

    // 2. Fetch Selected Work Order Details
    const handleWorkOrderSelect = (woId: string) => {
        setSelectedWoId(woId);
        if (!woId) {
            setSelectedWoDetails(null);
            setDetailsError('');
            return;
        }

        setDetailsLoading(true);
        setDetailsError('');

        const localWo = eligibleWos.find((w: any) => w.work_order_id === woId || w.id?.toString() === woId);
        if (localWo) {
            setSelectedWoDetails({
                workOrderNumber: localWo.work_order_id,
                dateTime: localWo.work_order_date || localWo.date || localWo.created_at || null,
                lotQuantity: Number(localWo.lot_quantity) || 0
            });
            setDetailsLoading(false);
        } else {
            // Fetch directly from server
            apiFetch(`/api/rrh/work-orders/${encodeURIComponent(woId)}`)
                .then(res => {
                    const data = res?.data;
                    if (data) {
                        setSelectedWoDetails({
                            workOrderNumber: data.work_order_id,
                            dateTime: data.work_order_date || data.date || data.created_at || null,
                            lotQuantity: Number(data.lot_quantity) || 0
                        });
                    } else {
                        throw new Error('Work Order details not found.');
                    }
                })
                .catch(err => {
                    console.error('Error fetching work order details:', err);
                    setDetailsError(err.message || 'Failed to load details for this Work Order.');
                    addToast(err.message || 'Failed to load details for this Work Order.', 'error');
                    setSelectedWoDetails(null);
                })
                .finally(() => {
                    setDetailsLoading(false);
                });
        }
    };

    // 3. Fetch Active Sessions
    const fetchActiveSessions = async (pageVal = activePage, limitVal = activeLimit, searchVal = activeSearch) => {
        setSessionsLoading(true);
        try {
            const query = `status=InProgress&page=${pageVal}&limit=${limitVal}&search=${encodeURIComponent(searchVal)}`;
            const res = await apiFetch(`/api/rrh/inward/sessions?${query}`);
            if (res) {
                setActiveSessionsList(res.data || []);
                setActiveTotal(res.pagination?.total || 0);
            }
        } catch (err: any) {
            console.error('Error loading active INWARD sessions:', err);
        } finally {
            setSessionsLoading(false);
        }
    };

    // 4. Fetch Completed Sessions
    const fetchCompletedSessions = async (pageVal = completedPage, limitVal = completedLimit, searchVal = completedSearch) => {
        setSessionsLoading(true);
        try {
            const query = `status=Completed&page=${pageVal}&limit=${limitVal}&search=${encodeURIComponent(searchVal)}`;
            const res = await apiFetch(`/api/rrh/inward/sessions?${query}`);
            if (res) {
                setCompletedSessionsList(res.data || []);
                setCompletedTotal(res.pagination?.total || 0);
            }
        } catch (err: any) {
            console.error('Error loading completed INWARD sessions:', err);
        } finally {
            setSessionsLoading(false);
        }
    };

    const fetchSessionsLists = () => {
        fetchActiveSessions(activePage, activeLimit, activeSearch);
        fetchCompletedSessions(completedPage, completedLimit, completedSearch);
        fetchEligibleWorkOrders();
    };

    // 5. Fetch Session Statistics and Scanned Products
    const fetchSessionStats = async (sessionId: string) => {
        try {
            const data = await apiFetch(`/api/rrh/inward/sessions/${sessionId}/stats`);
            if (data) {
                setStats({
                    ...data,
                    lotQuantity: data.lotQuantity ?? data.workOrderQuantity ?? 0
                });

                if (data.isCompleted && activeSession?.status !== 'Completed') {
                    addToast('INWARD Session completed successfully. Required Lot Quantity reached.', 'success');
                    setActiveSession(prev => prev ? { ...prev, status: 'Completed' } : null);
                    fetchSessionsLists();
                }
            }
        } catch (err: any) {
            console.error('Error loading session stats:', err);
        }
    };

    // 6. Fetch Remaining Master Data (Live Temporary Session View)
    const fetchRemainingMasterData = async (
        sessionId: string,
        pageVal = remainingPage,
        limitVal = remainingLimit,
        searchVal = remainingSearch
    ) => {
        setRemainingLoading(true);
        try {
            const query = `page=${pageVal}&limit=${limitVal}&search=${encodeURIComponent(searchVal)}`;
            const res = await apiFetch(`/api/rrh/inward/sessions/${sessionId}/remaining-master-data?${query}`);
            if (res && res.success) {
                setRemainingMasterData(res.data || []);
                setRemainingTotal(res.total || 0);
            }
        } catch (err: any) {
            console.error('Error loading remaining master data:', err);
        } finally {
            setRemainingLoading(false);
        }
    };

    // Load active session stats and remaining master data when active session changes
    useEffect(() => {
        if (activeSession) {
            fetchSessionStats(activeSession.id);
            fetchRemainingMasterData(activeSession.id, 1, remainingLimit, '');
            // Update selectedWoDetails for the active session view
            handleWorkOrderSelect(activeSession.work_order_id);
        }
    }, [activeSession]);

    // ─── Actions inside Initial View ─────────────────────────────────────────

    const handleStartSession = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedWoId) {
            addToast('Please select an eligible Work Order first.', 'error');
            return;
        }

        try {
            const payload = {
                work_order_id: selectedWoId
            };

            const session = await apiFetch('/api/rrh/inward/sessions', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            if (session) {
                addToast('INWARD Session created successfully.', 'success');
                setActiveSession(session);
                fetchSessionsLists();
            }
        } catch (err: any) {
            console.error('Session creation failed:', err);
            addToast(err.message || 'Failed to start INWARD session.', 'error');
        }
    };

    // ─── Scanner Handling ────────────────────────────────────────────────────

    const handleBarcodeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const code = scanBarcodeVal.trim();
        if (!code || !activeSession || isScanning) return;

        setIsScanning(true);
        setScanBarcodeVal('');

        try {
            const res = await apiFetch(`/api/rrh/inward/sessions/${activeSession.id}/scan`, {
                method: 'POST',
                body: JSON.stringify({ barcode: code })
            });

            if (res) {
                if (res.isValid) {
                    addToast(`Physical Serial Number "${code}" registered: PASS.`, 'success');
                } else {
                    addToast(res.message || `Invalid Serial Number "${code}". Does not belong to the selected Work Order.`, 'error');
                }
                // Refresh statistics, scanned items, and live remaining master list
                fetchSessionStats(activeSession.id);
                fetchRemainingMasterData(activeSession.id, remainingPage, remainingLimit, remainingSearch);
            }
        } catch (err: any) {
            console.error('Scan error:', err);
            if (err.status === 409) {
                addToast(err.message || `Duplicate: Serial Number "${code}" has already passed in this INWARD Session.`, 'warning');
                fetchSessionStats(activeSession.id);
            } else {
                addToast(err.message || 'Scan validation failed.', 'error');
            }
        } finally {
            setIsScanning(false);
            scanInputRef.current?.focus({ preventScroll: true });
        }
    };

    // ─── Manual Assignment Flow for Remaining Master Data ──────────

    const openAssignModal = (masterRecord: RemainingMasterRecord) => {
        setAssigningMasterRecord(masterRecord);
        setAssignPhysicalSerial('');
        setAssignRemarkText('');
    };

    const submitAssignModal = async () => {
        if (!assigningMasterRecord || !activeSession) return;
        const physicalSerial = assignPhysicalSerial.trim();
        const remark = assignRemarkText.trim();

        if (!physicalSerial) {
            addToast('Physical Serial Number is required.', 'error');
            return;
        }
        if (!remark) {
            addToast('Assignment remark is mandatory.', 'error');
            return;
        }

        setIsAssigningSubmitting(true);
        try {
            const res = await apiFetch(`/api/rrh/inward/sessions/${activeSession.id}/assign`, {
                method: 'POST',
                body: JSON.stringify({
                    inventoryId: assigningMasterRecord.id,
                    physicalSerialNumber: physicalSerial,
                    remark
                })
            });

            if (res && res.success) {
                addToast(res.message || `Serial Number "${physicalSerial}" manually assigned.`, 'success');
                setAssigningMasterRecord(null);
                setAssignPhysicalSerial('');
                setAssignRemarkText('');
                // Live refresh all three views
                fetchSessionStats(activeSession.id);
                fetchRemainingMasterData(activeSession.id, remainingPage, remainingLimit, remainingSearch);
            } else {
                addToast(res.message || 'Assignment failed.', 'error');
            }
        } catch (err: any) {
            console.error('Assign error:', err);
            addToast(err.message || 'Failed to submit manual assignment.', 'error');
        } finally {
            setIsAssigningSubmitting(false);
        }
    };

    // ─── Status Transitions (Pause / Resume / Abort) ──────────────────────────

    const handleStatusTransition = async (newStatus: string, remark?: string) => {
        if (!activeSession) return;
        try {
            const res = await apiFetch(`/api/rrh/inward/sessions/${activeSession.id}/status`, {
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

    const submitAbortSession = () => {
        if (!abortRemark.trim()) {
            addToast('Remark is mandatory to abort a session.', 'error');
            return;
        }
        handleStatusTransition('Aborted', abortRemark.trim());
        setShowAbortModal(false);
        setAbortRemark('');
    };

    // Delete session (Super Admin only)
    const handleDeleteSession = async (sessionId: string, woId: string) => {
        if (!isSuperAdmin) {
            addToast("Only Super Admin is authorized to delete records.", 'error');
            return;
        }
        if (!window.confirm(`Are you sure you want to delete the INWARD Session for Work Order ${woId}? This action will soft-delete the session.`)) {
            return;
        }
        try {
            const res = await apiFetch(`/api/rrh/inward/sessions/${sessionId}`, {
                method: 'DELETE'
            });
            if (res) {
                addToast('INWARD Session deleted successfully.', 'success');
                fetchSessionsLists();
                if (activeSession?.id === sessionId) {
                    setActiveSession(null);
                }
            }
        } catch (err: any) {
            addToast(err.message || 'Failed to delete session.', 'error');
        }
    };

    // ─── Export & Report Handlers ────────────────────────────────────────────

    const triggerDownload = (blob: Blob, filename: string) => {
        const url = window.URL.createObjectURL(blob);
        const a = Object.assign(document.createElement('a'), { href: url, download: filename });
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const handleExportExcel = async () => {
        if (!activeSession) return;
        try {
            setIsExportingExcel(true);
            addToast('Generating RRH INWARD Excel report...', 'info');
            const token = localStorage.getItem('auth_token');
            const res = await fetch(`/api/rrh/inward/sessions/${activeSession.id}/export/excel`, {
                headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
            });
            if (!res.ok) throw new Error('Failed to export scanned products logs to Excel.');
            const blob = await res.blob();
            triggerDownload(blob, `RRH_INWARD_Scan_Logs_${activeSession.work_order_id}.xlsx`);
            addToast('Excel report downloaded successfully.', 'success');
        } catch (err: any) {
            console.error('Excel export error:', err);
            addToast(err.message || 'Excel export failed.', 'error');
        } finally {
            setIsExportingExcel(false);
        }
    };

    const handleExportRemainingExcel = async () => {
        if (!activeSession) return;
        try {
            setIsExportingRemaining(true);
            addToast('Generating Remaining Master Data Excel report...', 'info');
            const token = localStorage.getItem('auth_token');
            const query = remainingSearch ? `?search=${encodeURIComponent(remainingSearch)}` : '';
            const res = await fetch(`/api/rrh/inward/sessions/${activeSession.id}/remaining-master-data/export/excel${query}`, {
                headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
            });
            if (!res.ok) throw new Error('Failed to export remaining master data.');
            const blob = await res.blob();
            triggerDownload(blob, `RRH_Remaining_Master_Data_${activeSession.work_order_id}.xlsx`);
            addToast('Remaining Master Data Excel downloaded successfully.', 'success');
        } catch (err: any) {
            console.error('Export remaining error:', err);
            addToast(err.message || 'Failed to export remaining master data.', 'error');
        } finally {
            setIsExportingRemaining(false);
        }
    };

    const handleDownloadSessionFile = async (session: InwardSession) => {
        try {
            addToast(`Downloading Master Excel file for ${session.work_order_id}...`, 'info');
            const token = localStorage.getItem('auth_token');
            const res = await fetch(`/api/rrh/work-orders/${encodeURIComponent(session.work_order_id)}/download`, {
                headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
            });
            if (!res.ok) throw new Error('Master Excel file not found on server or could not be downloaded.');
            const blob = await res.blob();
            triggerDownload(blob, session.excel_filename || `${session.work_order_id}.xlsx`);
            addToast('Master Excel file downloaded successfully.', 'success');
        } catch (err: any) {
            console.error('File download error:', err);
            addToast(err.message || 'Failed to download Master Excel file.', 'error');
        }
    };

    const handleExportFullPDF = async () => {
        if (!activeSession) return;
        try {
            addToast('Generating RRH INWARD PDF report…', 'info');
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const PW = 210;
            const ML = 14;
            const CW = PW - ML - 14;
            let y = 0;

            const addPageNum = () => {
                const total = (doc as any).internal.getNumberOfPages();
                for (let i = 1; i <= total; i++) {
                    doc.setPage(i);
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(8);
                    doc.setTextColor(148, 163, 184);
                    doc.text(`Page ${i} of ${total}   |   RRH INWARD Report   |   ${user?.name || smtUser?.name || 'Operator'}`, ML, 292);
                }
            };

            const checkPageBreak = (needed: number) => {
                if (y + needed > 280) {
                    doc.addPage();
                    y = 15;
                }
            };

            // Banner
            doc.setFillColor(30, 58, 95);
            doc.rect(0, 0, PW, 28, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(18);
            doc.setTextColor(255, 255, 255);
            doc.text('RRH INWARD SESSION REPORT', PW / 2, 13, { align: 'center' });
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(203, 213, 225);
            doc.text(`Stage: RRH INWARD  |  Generated: ${new Date().toLocaleString()}  |  WO: ${activeSession.work_order_id}`, PW / 2, 22, { align: 'center' });
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

            // Section 1: Work Order Details
            sectionHeader('  1.  WORK ORDER DETAILS', 37, 99, 235);
            [
                ['Work Order Number', activeSession.work_order_id],
                ['Date & Time', formatWoDateTime(selectedWoDetails?.dateTime || activeSession.created_at)],
                ['Lot Quantity', String(stats.lotQuantity || selectedWoDetails?.lotQuantity || 0)],
                ['Session Status', activeSession.status]
            ].forEach(([l, v], i) => kvRow(l, v, i % 2 === 0));

            y += 5;

            // Section 2: Production Summary
            sectionHeader('  2.  INWARD PRODUCTION SUMMARY', 15, 118, 110);
            [
                ['Lot Quantity', String(stats.lotQuantity)],
                ['Passed Quantity', String(stats.passed)],
                ['Yield (%)', `${stats.yield}%`],
                ['Invalid Scan Quantity', String(stats.invalid)],
                ['Pending Quantity', String(stats.pending)],
                ['Duplicate Scan Quantity', String(stats.duplicate)]
            ].forEach(([l, v], i) => kvRow(l, v, i % 2 === 0));

            y += 5;

            // Section 3: Scanned Products History
            sectionHeader('  3.  SCANNED PRODUCTS LOGS', 21, 128, 61);
            checkPageBreak(12);
            const cols = [
                { label: '#', x: ML, w: 8 },
                { label: 'Scanned By', x: ML + 8, w: 22 },
                { label: 'Date & Time', x: ML + 30, w: 26 },
                { label: 'Physical TPN', x: ML + 56, w: 26 },
                { label: 'Band Serial No', x: ML + 82, w: 26 },
                { label: 'Physical Serial No', x: ML + 108, w: 28 },
                { label: 'Status', x: ML + 136, w: 18 },
                { label: 'Remark', x: ML + 154, w: 28 }
            ];

            doc.setFillColor(31, 78, 121);
            doc.rect(ML, y, CW, 8, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(255, 255, 255);
            cols.forEach(c => doc.text(c.label, c.x + 1, y + 5.5));
            y += 8;

            stats.scans.forEach((scan, idx) => {
                checkPageBreak(8);
                if (idx % 2 === 0) doc.setFillColor(255, 255, 255);
                else doc.setFillColor(248, 250, 252);
                doc.rect(ML, y, CW, 7, 'F');
                doc.setDrawColor(209, 213, 219);
                doc.rect(ML, y, CW, 7);

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7.5);
                doc.setTextColor(15, 23, 42);

                doc.text(String(scan.sl_no || '-'), cols[0].x + 1, y + 5);
                doc.text((scan.scanned_by || '—').slice(0, 14), cols[1].x + 1, y + 5);
                doc.text(formatTimestamp(scan.scanned_at).slice(0, 16), cols[2].x + 1, y + 5);
                doc.text((scan.physical_tpn || '—').slice(0, 16), cols[3].x + 1, y + 5);
                doc.text((scan.band_serial_no || '—').slice(0, 16), cols[4].x + 1, y + 5);
                doc.text((scan.physical_serial_number || scan.barcode || '—').slice(0, 16), cols[5].x + 1, y + 5);

                const stUpper = String(scan.result || scan.status || '').toUpperCase();
                if (stUpper === 'PASS' || stUpper === 'EDITED PASS') {
                    doc.setTextColor(22, 163, 74);
                    doc.setFont('helvetica', 'bold');
                } else {
                    doc.setTextColor(220, 38, 38);
                    doc.setFont('helvetica', 'bold');
                }
                doc.text(stUpper, cols[6].x + 1, y + 5);

                doc.setFont('helvetica', 'normal');
                doc.setTextColor(71, 85, 105);
                const rem = scan.repair_remark || scan.remark || scan.master_remark || '—';
                doc.text(rem.slice(0, 20), cols[7].x + 1, y + 5);

                y += 7;
            });

            addPageNum();
            doc.save(`RRH_INWARD_Report_${activeSession.work_order_id}.pdf`);
            addToast('PDF report downloaded successfully.', 'success');
        } catch (err) {
            console.error('PDF export error:', err);
            addToast('PDF export failed.', 'error');
        }
    };

    // Download Single QR Code (PNG)
    const downloadSinglePNG = () => {
        if (!singleQrDataUrl || !selectedQrBarcode) return;
        const link = document.createElement('a');
        link.download = `${selectedQrBarcode.replace(/-/g, "").toUpperCase()}_QR.png`;
        link.href = singleQrDataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        addToast('QR Code image downloaded.', 'success');
    };

    // Download Single QR Code (PDF)
    const downloadSinglePDF = () => {
        if (!singleQrDataUrl || !selectedQrBarcode) return;
        try {
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [60, 60] });
            pdf.addImage(singleQrDataUrl, 'PNG', 5, 5, 50, 50);
            pdf.save(`${selectedQrBarcode.replace(/-/g, "").toUpperCase()}_QR.pdf`);
            addToast('QR Label PDF downloaded.', 'success');
        } catch (err) {
            addToast('Failed to create PDF label.', 'error');
        }
    };

    // Download All QR Codes (Batch PDF)
    const handleDownloadAllQRPDF = async () => {
        if (!activeSession || stats.scans.length === 0) return;
        try {
            addToast('Generating batch QR PDF labels...', 'info');
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const scans = stats.scans;

            const margin = 10;
            const itemWidth = 35;
            const itemHeight = 42;
            const cols = 5;
            const rows = 6;
            const perPage = cols * rows;

            for (let i = 0; i < scans.length; i++) {
                if (i > 0 && i % perPage === 0) {
                    pdf.addPage();
                }

                const pageIndex = i % perPage;
                const col = pageIndex % cols;
                const row = Math.floor(pageIndex / cols);

                const x = margin + col * (itemWidth + 4);
                const y = margin + row * (itemHeight + 4);

                const rawVal = scans[i].physical_serial_number || scans[i].barcode;
                const url = await QRCode.toDataURL(rawVal.replace(/-/g, "").toUpperCase(), { margin: 1 });
                pdf.addImage(url, 'PNG', x + 2.5, y, 30, 30);
                pdf.setFontSize(7);
                pdf.setFont('monospace', 'bold');
                pdf.text(rawVal, x + itemWidth / 2, y + 35, { align: 'center' });
            }

            pdf.save(`RRH_INWARD_Batch_QRs_${activeSession.work_order_id}.pdf`);
            addToast('All QR Codes downloaded as PDF.', 'success');
        } catch (err) {
            console.error('Batch QR PDF error:', err);
            addToast('Failed to generate Batch QR PDF.', 'error');
        }
    };

    // Download All QR Codes (Batch ZIP of PNGs)
    const handleDownloadAllQRPNG = async () => {
        if (!activeSession || stats.scans.length === 0 || isZipping) return;
        setIsZipping(true);
        addToast('Compiling ZIP archive of QR images...', 'info');
        try {
            const zip = new JSZip();
            const folder = zip.folder(`QRs_${activeSession.work_order_id}`);

            for (const scan of stats.scans) {
                const rawVal = scan.physical_serial_number || scan.barcode;
                const qrUrl = await QRCode.toDataURL(rawVal.replace(/-/g, "").toUpperCase(), { width: 250, margin: 2 });
                const base64Data = qrUrl.replace(/^data:image\/png;base64,/, "");
                folder?.file(`${rawVal.replace(/-/g, "").toUpperCase()}.png`, base64Data, { base64: true });
            }

            const content = await zip.generateAsync({ type: 'blob' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = `RRH_INWARD_QRs_${activeSession.work_order_id}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            addToast('Batch QR Archive downloaded.', 'success');
        } catch (err) {
            console.error('ZIP generation error:', err);
            addToast('Failed to compile ZIP archive.', 'error');
        } finally {
            setIsZipping(false);
        }
    };

    // ─── UI Render Components ────────────────────────────────────────────────

    const getStatusBadge = (status: string) => {
        const lower = status.toLowerCase();
        let className = styles.statusYellow;
        if (lower === 'completed' || lower === 'pass' || lower === 'active') className = styles.statusGreen;
        if (lower === 'cancelled' || lower === 'aborted' || lower === 'fail') className = styles.statusRed;
        if (lower === 'in progress' || lower === 'inprogress') className = styles.statusBlue;

        return (
            <span className={className} style={{ fontWeight: 700 }}>
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

    const renderRemarkCell = (remark: string | null | undefined, title: string) => {
        if (!remark) return '—';
        const words = remark.trim().split(/\s+/);
        const exceedsWordLimit = words.length > 5 || remark.length > 25;
        const preview = exceedsWordLimit ? words.slice(0, 5).join(' ') + '...' : remark;
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                <span title={remark}>{preview}</span>
                {exceedsWordLimit && (
                    <button
                        type="button"
                        className={styles.secondaryButton}
                        style={{
                            padding: '2px 6px',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            fontWeight: 600,
                            borderRadius: '4px',
                            lineHeight: '1.2'
                        }}
                        onClick={() => {
                            setViewingRemarkText(remark);
                            setViewingRemarkTitle(title);
                        }}
                    >
                        View
                    </button>
                )}
            </div>
        );
    };

    return (
        <div className={styles.container}>
            <Toaster toasts={toasts} onRemove={removeToast} />

            <div className={styles.header}>
                <h2>RRH INWARD</h2>
                <p>High-speed serial verification against Work Order master data</p>
            </div>

            {!activeSession ? (
                /* ─── INITIAL RRH INWARD SETUP VIEW ────────────────────────── */
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
                    {/* Work Order Selector Card */}
                    <div className={styles.card} style={{ marginBottom: '0' }}>
                        <h3>Select Work Order</h3>
                        <div className={styles.inputGroup} style={{ maxWidth: '480px' }}>
                            <WorkOrderSelector
                                options={availableWorkOrders}
                                value={selectedWoId}
                                onChange={handleWorkOrderSelect}
                                placeholder="-- Select Eligible RRH Work Order --"
                                valueKey="work_order_id"
                                labelKey="work_order_id"
                                quantityKey="lot_quantity"
                                required
                            />
                        </div>
                    </div>

                    {/* Selected Work Order Details Panel */}
                    {detailsLoading ? (
                        <div className={styles.card} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                            <div style={{ display: 'inline-block', width: '2rem', height: '2rem', border: '3px solid #cbd5e1', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '0.5rem' }}></div>
                            <p style={{ margin: '0' }}>Loading Work Order details...</p>
                        </div>
                    ) : selectedWoDetails ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div className={styles.infoPanel}>
                                <div className={styles.infoPanelTitle}>
                                    Work Order Information
                                </div>
                                <div className={styles.infoPanelGrid}>
                                    <div className={styles.infoSection} style={{ gridColumn: '1 / -1' }}>
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                                            gap: '1.5rem',
                                            alignItems: 'center'
                                        }}>
                                            <div className={styles.infoItem}>
                                                <span className={styles.infoLabel}>Work Order Number</span>
                                                <span className={styles.infoValue} style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>
                                                    {selectedWoDetails.workOrderNumber}
                                                </span>
                                            </div>
                                            <div className={styles.infoItem}>
                                                <span className={styles.infoLabel}>Work Order Date & Time</span>
                                                <span className={styles.infoValue} style={{ fontSize: '1.05rem' }}>
                                                    {formatWoDateTime(selectedWoDetails.dateTime)}
                                                </span>
                                            </div>
                                            <div className={styles.infoItem}>
                                                <span className={styles.infoLabel}>Lot Quantity</span>
                                                <span className={styles.infoValue} style={{ fontSize: '1.25rem', fontWeight: 800, color: '#2563eb' }}>
                                                    {selectedWoDetails.lotQuantity}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                                <button
                                    onClick={handleStartSession}
                                    className={styles.button}
                                    style={{ padding: '0.85rem 3rem', fontSize: '1.05rem', fontWeight: 700, letterSpacing: '0.5px' }}
                                >
                                    Start INWARD Session
                                </button>
                            </div>
                        </div>
                    ) : detailsError ? (
                        <div className={styles.card} style={{ padding: '2rem', textAlign: 'center', color: '#dc2626', borderColor: '#fca5a5', backgroundColor: '#fef2f2' }}>
                            <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>⚠️</span>
                            {detailsError}
                        </div>
                    ) : (
                        <div className={styles.card} style={{ padding: '3rem', textAlign: 'center', color: '#64748b', border: '1px dashed #cbd5e1' }}>
                            Please select an eligible RRH Work Order to view Lot Quantity and start an INWARD session.
                        </div>
                    )}

                    {/* Active Sessions Panel */}
                    <div className={styles.card}>
                        <h3>Active INWARD Sessions</h3>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1, maxWidth: '400px' }}>
                                <input
                                    type="text"
                                    className={styles.input}
                                    placeholder="Search active sessions by WO ID..."
                                    value={activeSearch}
                                    onChange={e => setActiveSearch(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { setActivePage(1); fetchActiveSessions(1, activeLimit, activeSearch); } }}
                                    style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                                />
                                <button
                                    className={styles.button}
                                    onClick={() => { setActivePage(1); fetchActiveSessions(1, activeLimit, activeSearch); }}
                                    style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                                >
                                    Search
                                </button>
                                {activeSearch && (
                                    <button
                                        className={styles.secondaryButton}
                                        onClick={() => { setActiveSearch(''); setActivePage(1); fetchActiveSessions(1, activeLimit, ''); }}
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
                                </select>
                                <span>entries</span>
                            </div>
                        </div>

                        {sessionsLoading ? (
                            <div style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>Loading sessions...</div>
                        ) : (
                            <>
                                <div className={styles.tableContainer}>
                                    <table className={styles.table}>
                                        <thead>
                                            <tr>
                                                <th>Work Order Number</th>
                                                <th>Lot Number</th>
                                                <th>Started By</th>
                                                <th>Started At</th>
                                                <th>Status</th>
                                                <th>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {activeSessionsList.map(session => (
                                                <tr key={session.id}>
                                                    <td style={{ fontWeight: 700, color: '#4f46e5' }}>{session.work_order_id}</td>
                                                    <td style={{ fontWeight: 600, color: '#0f766e', fontFamily: 'monospace' }}>{session.lot_number || '—'}</td>
                                                    <td>{session.created_by_name || session.created_by || '—'}</td>
                                                    <td style={{ fontSize: '0.85rem', color: '#64748b' }}>{formatTimestamp(session.created_at)}</td>
                                                    <td>{getStatusBadge(session.status)}</td>
                                                    <td style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                        <button
                                                            className={styles.secondaryButton}
                                                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', backgroundColor: '#eef2ff', color: '#4338ca', borderColor: '#c7d2fe', fontWeight: 600 }}
                                                            onClick={() => setActiveSession(session)}
                                                        >
                                                            View Details / Resume
                                                        </button>
                                                        <button
                                                            className={styles.secondaryButton}
                                                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', backgroundColor: '#f0fdf4', color: '#15803d', borderColor: '#bbf7d0', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                                            onClick={() => handleDownloadSessionFile(session)}
                                                            title="Download Master Excel File"
                                                        >
                                                            📥 Download File
                                                        </button>
                                                        {isSuperAdmin && (
                                                            <button
                                                                className={styles.secondaryButton}
                                                                style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', color: '#b91c1c', borderColor: '#fca5a5' }}
                                                                onClick={() => handleDeleteSession(session.id, session.work_order_id)}
                                                            >
                                                                Delete
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                            {activeSessionsList.length === 0 && (
                                                <tr>
                                                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                                        No active INWARD sessions found. Select a Work Order above to begin.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', fontSize: '0.85rem', color: '#64748b' }}>
                                    <span>Showing {activeSessionsList.length} of {activeTotal} sessions</span>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <button
                                            className={styles.secondaryButton}
                                            disabled={activePage === 1}
                                            onClick={() => {
                                                const p = activePage - 1;
                                                setActivePage(p);
                                                fetchActiveSessions(p, activeLimit, activeSearch);
                                            }}
                                        >
                                            Previous
                                        </button>
                                        <span style={{ padding: '0.35rem 0.5rem' }}>Page {activePage}</span>
                                        <button
                                            className={styles.secondaryButton}
                                            disabled={activePage * activeLimit >= activeTotal}
                                            onClick={() => {
                                                const p = activePage + 1;
                                                setActivePage(p);
                                                fetchActiveSessions(p, activeLimit, activeSearch);
                                            }}
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
                        <h3>Completed INWARD Sessions History</h3>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1, maxWidth: '400px' }}>
                                <input
                                    type="text"
                                    className={styles.input}
                                    placeholder="Search completed sessions..."
                                    value={completedSearch}
                                    onChange={e => setCompletedSearch(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { setCompletedPage(1); fetchCompletedSessions(1, completedLimit, completedSearch); } }}
                                    style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                                />
                                <button
                                    className={styles.button}
                                    onClick={() => { setCompletedPage(1); fetchCompletedSessions(1, completedLimit, completedSearch); }}
                                    style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                                >
                                    Search
                                </button>
                                {completedSearch && (
                                    <button
                                        className={styles.secondaryButton}
                                        onClick={() => { setCompletedSearch(''); setCompletedPage(1); fetchCompletedSessions(1, completedLimit, ''); }}
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
                                </select>
                                <span>entries</span>
                            </div>
                        </div>

                        <div className={styles.tableContainer}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Work Order Number</th>
                                        <th>Lot Number</th>
                                        <th>Started By</th>
                                        <th>Completed At</th>
                                        <th>Status</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {completedSessionsList.map(session => (
                                        <tr key={session.id}>
                                            <td style={{ fontWeight: 600, color: '#334155' }}>{session.work_order_id}</td>
                                            <td style={{ fontWeight: 600, color: '#0f766e', fontFamily: 'monospace' }}>{session.lot_number || '—'}</td>
                                            <td>{session.created_by_name || session.created_by || '—'}</td>
                                            <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                                {formatTimestamp(session.updated_at || session.created_at)}
                                            </td>
                                            <td>{getStatusBadge(session.status)}</td>
                                            <td style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                <button
                                                    className={styles.secondaryButton}
                                                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                                                    onClick={() => setActiveSession(session)}
                                                >
                                                    View Details
                                                </button>
                                                <button
                                                    className={styles.secondaryButton}
                                                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', backgroundColor: '#f0fdf4', color: '#15803d', borderColor: '#bbf7d0', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                                    onClick={() => handleDownloadSessionFile(session)}
                                                    title="Download Master Excel File"
                                                >
                                                    📥 Download File
                                                </button>
                                                {isSuperAdmin && (
                                                    <button
                                                        className={styles.secondaryButton}
                                                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', color: '#b91c1c', borderColor: '#fca5a5' }}
                                                        onClick={() => handleDeleteSession(session.id, session.work_order_id)}
                                                    >
                                                        Delete
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {completedSessionsList.length === 0 && (
                                        <tr>
                                            <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                                No completed INWARD sessions found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', fontSize: '0.85rem', color: '#64748b' }}>
                            <span>Showing {completedSessionsList.length} of {completedTotal} sessions</span>
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                    className={styles.secondaryButton}
                                    disabled={completedPage === 1}
                                    onClick={() => {
                                        const p = completedPage - 1;
                                        setCompletedPage(p);
                                        fetchCompletedSessions(p, completedLimit, completedSearch);
                                    }}
                                >
                                    Previous
                                </button>
                                <span style={{ padding: '0.35rem 0.5rem' }}>Page {completedPage}</span>
                                <button
                                    className={styles.secondaryButton}
                                    disabled={completedPage * completedLimit >= completedTotal}
                                    onClick={() => {
                                        const p = completedPage + 1;
                                        setCompletedPage(p);
                                        fetchCompletedSessions(p, completedLimit, completedSearch);
                                    }}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* ─── ACTIVE INWARD SCANNER DASHBOARD ───────────────────────── */
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
                        <button
                            className={styles.detailBackButton}
                            onClick={() => { setActiveSession(null); fetchSessionsLists(); }}
                        >
                            ← Back to Session Setup
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                            <button
                                className={styles.secondaryButton}
                                style={{ padding: '0.45rem 1rem', fontSize: '0.85rem', backgroundColor: '#f0fdf4', color: '#15803d', borderColor: '#bbf7d0', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                onClick={() => handleDownloadSessionFile(activeSession)}
                                title="Download original Master Excel file for this session"
                            >
                                📥 Download Master File
                            </button>
                            <span style={{ fontSize: '1rem', fontWeight: 600, color: '#334155' }}>
                                Work Order: <strong style={{ color: '#2563eb' }}>{activeSession.work_order_id}</strong>
                            </span>
                            {getStatusBadge(activeSession.status)}
                        </div>
                    </div>

                    {/* Work Order Info Banner */}
                    <div className={styles.card} style={{ marginBottom: '1.5rem', padding: '1rem 1.5rem', background: '#f8fafc', borderLeft: '4px solid #3b82f6' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'center' }}>
                            <div>
                                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, display: 'block' }}>Work Order Number</span>
                                <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>{activeSession.work_order_id}</span>
                            </div>
                            {activeSession.lot_number && (
                                <div>
                                    <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, display: 'block' }}>Lot Number</span>
                                    <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f766e', fontFamily: 'monospace' }}>{activeSession.lot_number}</span>
                                </div>
                            )}
                            <div>
                                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, display: 'block' }}>Date & Time</span>
                                <span style={{ fontSize: '0.95rem', color: '#334155' }}>{formatWoDateTime(selectedWoDetails?.dateTime || activeSession.created_at)}</span>
                            </div>
                            <div>
                                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, display: 'block' }}>Lot Quantity</span>
                                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#2563eb' }}>{stats.lotQuantity}</span>
                            </div>
                        </div>
                    </div>

                    {/* ─── TOP STATISTICS CARDS ───────────────────────────── */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                        {/* 1. Lot Quantity */}
                        <div className={styles.card} style={{ margin: 0, padding: '1.25rem', borderLeft: '5px solid #2563eb', textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>Lot Quantity</p>
                            <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.8rem', color: '#1e293b', fontWeight: 800 }}>{stats.lotQuantity}</h2>
                        </div>
                        {/* 2. Passed */}
                        <div className={styles.card} style={{ margin: 0, padding: '1.25rem', borderLeft: '5px solid #16a34a', textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>Passed</p>
                            <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.8rem', color: '#15803d', fontWeight: 800 }}>{stats.passed}</h2>
                        </div>
                        {/* 3. Pending */}
                        <div className={styles.card} style={{ margin: 0, padding: '1.25rem', borderLeft: '5px solid #f59e0b', textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>Pending</p>
                            <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.8rem', color: '#b45309', fontWeight: 800 }}>{stats.pending}</h2>
                        </div>
                        {/* 4. Edited Pass */}
                        <div className={styles.card} style={{ margin: 0, padding: '1.25rem', borderLeft: '5px solid #8b5cf6', textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>Edited Pass</p>
                            <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.8rem', color: '#6d28d9', fontWeight: 800 }}>{stats.editedPass}</h2>
                        </div>
                        {/* 5. Yield (%) */}
                        <div className={styles.card} style={{ margin: 0, padding: '1.25rem', borderLeft: '5px solid #0d9488', textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>Yield (%)</p>
                            <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.8rem', color: '#0f766e', fontWeight: 800 }}>
                                {stats.yield}%
                            </h2>
                        </div>
                    </div>

                    {/* ─── HIGH-SPEED SCANNER SECTION ──────────────────────── */}
                    {activeSession.status !== 'Completed' ? (
                        <div className={styles.detailScanCard}>
                            <form onSubmit={handleBarcodeSubmit} className={styles.detailScanForm}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h4 style={{ margin: 0, color: '#1e293b', fontSize: '1.05rem', fontWeight: 700 }}>
                                        High-Speed Production Scanner Input
                                    </h4>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#16a34a', fontWeight: 600 }}>
                                        <span className={styles.blinkingDot} style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16a34a', display: 'inline-block' }}></span>
                                        Scanner Ready
                                    </div>
                                </div>
                                <div className={styles.detailScanRow}>
                                    <input
                                        ref={scanInputRef}
                                        type="text"
                                        className={styles.detailScanInput}
                                        placeholder="Scan Physical Serial Number..."
                                        value={scanBarcodeVal}
                                        onChange={e => setScanBarcodeVal(e.target.value)}
                                        disabled={isScanning || isModalOpen}
                                        autoFocus={!isModalOpen}
                                    />
                                    <button type="submit" className={styles.detailScanButton} disabled={isScanning || isModalOpen}>
                                        {isScanning ? 'Validating...' : 'Submit Scan'}
                                    </button>
                                </div>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                                    💡 Scan Physical Serial Number directly. Exact matches against Work Order master data record <strong>PASS</strong> and deduct from remaining master data. Non-matches record <strong>INVALID</strong> and allow one-click audit repair.
                                </p>
                            </form>
                        </div>
                    ) : (
                        <div className={styles.detailScanCard} style={{ background: '#f0fdf4', border: '1px dashed #16a34a', textAlign: 'center', padding: '1.5rem' }}>
                            <span style={{ fontSize: '1.5rem', marginRight: '6px' }}>✅</span>
                            <strong style={{ color: '#15803d' }}>This INWARD session has been completed and is read-only.</strong> All required Lot Quantity has been verified.
                        </div>
                    )}

                    {/* ─── SCANNED SERIAL PRODUCTS TABLE ───────────────────── */}
                    <div className={styles.detailItemsSection} style={{ marginBottom: '2rem' }}>
                        <div className={styles.searchHeader}>
                            <div className={styles.detailItemsHeader}>
                                <h3>Scanned Products Logs ({stats.scans.length} rows)</h3>
                            </div>
                            <div className={styles.searchContainer}>
                                <BarcodeSearch
                                    value={scansSearchQuery}
                                    onChange={setScansSearchQuery}
                                    onFocus={() => setIsSearchFocused(true)}
                                    onBlur={() => setIsSearchFocused(false)}
                                />

                                {/* Export Reports Bar */}
                                <div className={styles.searchReports}>
                                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, marginRight: 2 }}>Reports:</span>
                                    <button
                                        className={styles.secondaryButton}
                                        style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem', background: 'linear-gradient(135deg,#7c3aed,#4338ca)', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.4rem 0.8rem', fontWeight: 600, cursor: 'pointer' }}
                                        onClick={handleExportFullPDF}
                                        title="Download PDF production report"
                                    >
                                        📄 PDF Report
                                    </button>
                                    <button
                                        className={styles.secondaryButton}
                                        style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.4rem 0.8rem', fontWeight: 600, cursor: 'pointer' }}
                                        onClick={handleExportExcel}
                                        disabled={isExportingExcel || stats.scans.length === 0}
                                        title="Download Excel scan log (.xlsx)"
                                    >
                                        📊 {isExportingExcel ? 'Exporting...' : 'Excel Report'}
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
                        </div>

                        <div className={styles.detailTableContainer}>
                            <table className={styles.table} style={{ marginTop: 0 }}>
                                <thead>
                                    <tr>
                                        <th style={{ width: '45px' }}>S.No.</th>
                                        <th>Scanned By</th>
                                        <th>Date & Time</th>
                                        <th>Physical TPN</th>
                                        <th>Band Serial Number</th>
                                        <th>Physical Serial Number</th>
                                        <th>Status</th>
                                        <th>Remark</th>
                                        <th>Edited By</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {processedScans.map((scan, idx) => {
                                        const isCorrected = scan.result === 'EDITED PASS';
                                        const displaySerial = scan.physical_serial_number || scan.barcode;

                                        return (
                                            <tr key={scan.scan_id || idx} style={{ background: scan.result === 'INVALID' ? '#fffbeb' : undefined }}>
                                                <td style={{ textAlign: 'center', fontWeight: 600, color: '#64748b' }}>
                                                    {scan.sl_no || '-'}
                                                </td>
                                                <td>{scan.scanned_by}</td>
                                                <td style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                                    {formatTimestamp(scan.scanned_at)}
                                                </td>
                                                <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                                                    {scan.physical_tpn || '—'}
                                                </td>
                                                <td style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0f766e' }}>
                                                    {scan.band_serial_no || '—'}
                                                </td>
                                                <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.95rem' }}>
                                                    <span style={{ color: (scan.result === 'PASS' || scan.result === 'EDITED PASS') ? '#15803d' : '#b45309' }}>
                                                        {displaySerial}
                                                    </span>
                                                    {isCorrected && (
                                                        <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>
                                                            Assigned manually
                                                        </span>
                                                    )}
                                                </td>
                                                <td>{getScanResultBadge(scan.result)}</td>
                                                <td style={{ fontSize: '0.85rem' }}>
                                                    {isCorrected ? (
                                                        <div style={{ color: '#166534', fontWeight: 600 }}>
                                                            {renderRemarkCell(scan.repair_remark, 'Remark')}
                                                        </div>
                                                    ) : scan.result === 'PASS' ? (
                                                        <div style={{ color: '#64748b' }}>
                                                            {renderRemarkCell(scan.master_remark, 'Work Order Remark')}
                                                        </div>
                                                    ) : scan.remark ? (
                                                        <div style={{ color: '#b91c1c' }}>
                                                            {renderRemarkCell(scan.remark, 'Failure Remark')}
                                                        </div>
                                                    ) : (
                                                        '—'
                                                    )}
                                                </td>
                                                <td style={{ fontSize: '0.85rem', fontWeight: 500, color: '#475569' }}>
                                                    {isCorrected && scan.repaired_by ? scan.repaired_by : '—'}
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                        {/* QR Code preview for PASS records */}
                                                        {(scan.result === 'PASS' || scan.result === 'EDITED PASS') && (
                                                            <button
                                                                className={styles.secondaryButton}
                                                                title="View QR Code"
                                                                style={{ padding: '0.3rem 0.45rem', fontSize: '1rem', lineHeight: 1, borderRadius: '6px' }}
                                                                onClick={() => setSelectedQrBarcode(displaySerial)}
                                                            >
                                                                🔳
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {stats.scans.length === 0 && (
                                        <tr>
                                            <td colSpan={10} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                                                No Physical Serial Numbers scanned in this session yet. Use the scanner above to begin.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* ─── LIVE REMAINING MASTER DATA TABLE ────────────────── */}
                    <div className={styles.card} style={{ marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
                            <div>
                                <h3 style={{ margin: 0, paddingBottom: 0, borderBottom: 'none' }}>
                                    Remaining Master Data ({remainingTotal} items remaining)
                                </h3>
                                <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                                    Live session view: Master records available to be scanned. Successfully passed units are deducted immediately without deleting database records.
                                </p>
                            </div>

                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.85rem', color: '#64748b' }}>
                                    <span>Show</span>
                                    <select
                                        className={styles.select}
                                        value={remainingLimit}
                                        onChange={e => {
                                            const lim = parseInt(e.target.value);
                                            setRemainingLimit(lim);
                                            setRemainingPage(1);
                                            fetchRemainingMasterData(activeSession.id, 1, lim, remainingSearch);
                                        }}
                                        style={{ padding: '0.35rem 1.5rem 0.35rem 0.75rem', width: 'auto', fontSize: '0.85rem' }}
                                    >
                                        <option value={10}>10</option>
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                    </select>
                                </div>
                                <input
                                    type="text"
                                    className={styles.input}
                                    placeholder="Search remaining master serials..."
                                    value={remainingSearch}
                                    onChange={e => setRemainingSearch(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            setRemainingPage(1);
                                            fetchRemainingMasterData(activeSession.id, 1, remainingLimit, remainingSearch);
                                        }
                                    }}
                                    style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', width: '220px' }}
                                />
                                <button
                                    className={styles.button}
                                    style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                                    onClick={() => {
                                        setRemainingPage(1);
                                        fetchRemainingMasterData(activeSession.id, 1, remainingLimit, remainingSearch);
                                    }}
                                >
                                    Filter
                                </button>
                                {remainingSearch && (
                                    <button
                                        className={styles.secondaryButton}
                                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                                        onClick={() => {
                                            setRemainingSearch('');
                                            setRemainingPage(1);
                                            fetchRemainingMasterData(activeSession.id, 1, remainingLimit, '');
                                        }}
                                    >
                                        Clear
                                    </button>
                                )}
                                <button
                                    className={styles.secondaryButton}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        fontSize: '0.85rem',
                                        background: '#0284c7',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '6px',
                                        padding: '0.4rem 0.8rem',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                    onClick={handleExportRemainingExcel}
                                    disabled={remainingTotal === 0 || isExportingRemaining}
                                    title="Download remaining unscanned master data as Excel (.xlsx)"
                                >
                                    📥 {isExportingRemaining ? 'Exporting...' : 'Export Unscanned (Excel)'}
                                </button>
                            </div>
                        </div>

                        {remainingLoading ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                                Loading remaining master data...
                            </div>
                        ) : remainingTotal === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2.5rem', background: '#f0fdf4', borderRadius: '8px', border: '1px dashed #16a34a', color: '#166534', fontWeight: 600 }}>
                                🎉 All master data records for this Work Order have been successfully inwarded for this session!
                            </div>
                        ) : (
                            <>
                                <div className={styles.tableContainer}>
                                    <table className={styles.table}>
                                        <thead>
                                            <tr>
                                                <th style={{ width: '50px' }}>S.No.</th>
                                                <th>Physical TPN</th>
                                                <th>Band Serial Number</th>
                                                <th>Tejas DC No</th>
                                                <th>Tejas OBD No</th>
                                                <th>Lot</th>
                                                <th>Remarks</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {remainingMasterData.map((item, idx) => (
                                                <tr key={item.id}>
                                                    <td style={{ textAlign: 'center', color: '#64748b' }}>
                                                        {item.global_row_number ?? ((remainingPage - 1) * remainingLimit + idx + 1)}
                                                    </td>
                                                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                                                        {item.physical_tpn || '—'}
                                                    </td>
                                                    <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f766e' }}>
                                                        {item.band_serial_no || '—'}
                                                    </td>
                                                    <td>{item.tejas_dc_no || '—'}</td>
                                                    <td>{item.tejas_obd_no || '—'}</td>
                                                    <td>{item.lot || '—'}</td>
                                                    <td style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                                        {renderRemarkCell(item.remarks, 'Master Data Remark')}
                                                    </td>
                                                    <td>
                                                        <button
                                                            className={styles.button}
                                                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', backgroundImage: 'none', backgroundColor: '#0ea5e9' }}
                                                            onClick={() => openAssignModal(item)}
                                                            disabled={activeSession.status === 'Completed'}
                                                        >
                                                            Assign Unit
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                        Showing {Math.min((remainingPage - 1) * remainingLimit + 1, remainingTotal)} to {Math.min(remainingPage * remainingLimit, remainingTotal)} of {remainingTotal} items
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <button
                                            className={styles.secondaryButton}
                                            disabled={remainingPage === 1}
                                            onClick={() => {
                                                const p = remainingPage - 1;
                                                setRemainingPage(p);
                                                fetchRemainingMasterData(activeSession.id, p, remainingLimit, remainingSearch);
                                            }}
                                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
                                        >
                                            Previous
                                        </button>
                                        <span style={{ display: 'flex', alignItems: 'center', padding: '0 0.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                                            Page {remainingPage} of {Math.ceil(remainingTotal / remainingLimit) || 1}
                                        </span>
                                        <button
                                            className={styles.secondaryButton}
                                            disabled={remainingPage >= Math.ceil(remainingTotal / remainingLimit)}
                                            onClick={() => {
                                                const p = remainingPage + 1;
                                                setRemainingPage(p);
                                                fetchRemainingMasterData(activeSession.id, p, remainingLimit, remainingSearch);
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
            )}

            {/* ─── MODAL: ASSIGN UNIT MANUALLY ── */}
            {assigningMasterRecord && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className={styles.card} style={{ width: '480px', padding: '1.75rem', margin: 0, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)' }}>
                        <h3 style={{ borderBottom: 'none', padding: 0, marginBottom: '1rem', color: '#0ea5e9' }}>
                            🔗 Assign Physical Unit
                        </h3>
                        <p style={{ fontSize: '0.9rem', color: '#4b5563', marginBottom: '1.25rem', lineHeight: '1.4' }}>
                            Assign a physical serial number to the remaining master data record. This will consume the master record and log it as an <strong>EDITED PASS</strong>.
                        </p>

                        <div className={styles.inputGroup} style={{ marginBottom: '1rem' }}>
                            <label style={{ fontSize: '0.85rem', color: '#64748b' }}>Target Master Record (Band Serial)</label>
                            <input
                                type="text"
                                className={styles.input}
                                value={assigningMasterRecord.band_serial_no || ''}
                                disabled
                                style={{ backgroundColor: '#f1f5f9', color: '#475569', fontWeight: 600, fontFamily: 'monospace' }}
                            />
                        </div>

                        <div className={styles.inputGroup} style={{ marginBottom: '1rem' }}>
                            <label>Physical Serial Number *</label>
                            <input
                                type="text"
                                className={styles.input}
                                placeholder="Scan or enter physical serial number..."
                                value={assignPhysicalSerial}
                                onChange={e => setAssignPhysicalSerial(e.target.value)}
                                style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1rem' }}
                                autoFocus
                            />
                        </div>

                        <div className={styles.inputGroup} style={{ marginBottom: '1.5rem' }}>
                            <label>Assignment Remark / Reason *</label>
                            <textarea
                                className={styles.input}
                                style={{ minHeight: '80px', fontFamily: 'inherit', resize: 'vertical' }}
                                placeholder="E.g. Unit printed with slightly different format..."
                                value={assignRemarkText}
                                onChange={e => setAssignRemarkText(e.target.value)}
                                required
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button
                                className={styles.secondaryButton}
                                onClick={() => setAssigningMasterRecord(null)}
                                disabled={isAssigningSubmitting}
                            >
                                Cancel
                            </button>
                            <button
                                className={styles.button}
                                style={{ backgroundColor: '#0ea5e9', backgroundImage: 'none', fontWeight: 700 }}
                                onClick={submitAssignModal}
                                disabled={isAssigningSubmitting}
                            >
                                {isAssigningSubmitting ? 'Assigning...' : 'Submit Assignment'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── MODAL: ABORT SESSION REMARK DIALOG ───────────────────────── */}
            {showAbortModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className={styles.card} style={{ width: '450px', padding: '1.75rem', margin: 0, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)' }}>
                        <h3 style={{ borderBottom: 'none', padding: 0, marginBottom: '1rem', color: '#dc2626' }}>
                            🚨 Abort INWARD Session
                        </h3>
                        <p style={{ fontSize: '0.9rem', color: '#4b5563', marginBottom: '1.25rem' }}>
                            Aborting a session is a critical operational event. Please specify the mandatory abort remark.
                        </p>
                        <div className={styles.inputGroup} style={{ marginBottom: '1.5rem' }}>
                            <label>Abort Reason / Remark *</label>
                            <textarea
                                className={styles.input}
                                style={{ minHeight: '90px', fontFamily: 'inherit', resize: 'vertical' }}
                                placeholder="Enter reason for aborting session..."
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

            {/* ─── MODAL: SINGLE QR CODE PREVIEW MODAL ──────────────────────── */}
            {selectedQrBarcode && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className={styles.card} style={{ width: '380px', padding: '1.75rem', margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                        <h3 style={{ borderBottom: 'none', padding: 0, marginBottom: '1.5rem', width: '100%', textAlign: 'center' }}>
                            Physical Serial QR Code
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
                            Serial: <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>{selectedQrBarcode}</strong>
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
                        <h3 style={{ borderBottom: 'none', padding: 0, marginBottom: '1rem' }}>
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

            {showFailedModal && activeSession && (
                <SMTCountDetailsModal
                    workOrderId={activeSession.work_order_id}
                    stage="INWARD"
                    type="FAILED"
                    label="INWARD Failed Units"
                    onClose={() => setShowFailedModal(false)}
                />
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
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export const RrhInward = Inward;
export default Inward;
