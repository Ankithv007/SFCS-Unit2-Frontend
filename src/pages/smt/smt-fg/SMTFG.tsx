import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSmtAuth } from '../../../context/SmtAuthContext';
import { useAuth } from '../../../hooks/useAuth';
import styles from './SMTFG.module.css';
import { WorkOrderSelector } from '../../../components/WorkOrderSelector';
import { BarcodeSearch } from '../../../components/BarcodeSearch';
import { apiFetch } from '../../../utils/api';
import QRCode from 'qrcode';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import { usePreviousStagePassed } from '../../../hooks/usePreviousStagePassed';
import { PreviousStagePassedModal } from '../../../components/PreviousStagePassedModal';

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

interface FgSession {
    id: string;
    work_order_id: string;
    stencil_lifecycle_id: string;
    squeegee_front_number: string;
    squeegee_rear_number: string;
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
    result: 'PASS';
    remark: string | null;
    scanned_by: string;
    scanned_at: string;
}

const SMTFG: React.FC = () => {
    const navigate = useNavigate();
    const { smtUser } = useSmtAuth();
    const { user } = useAuth();
    const isSuperAdmin = smtUser?.role === 'Super Admin' || user?.role === 'Super Admin';

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
    const [activeSession, setActiveSession] = useState<FgSession | null>(null);
    const [activeSessionsList, setActiveSessionsList] = useState<FgSession[]>([]);
    const [completedSessionsList, setCompletedSessionsList] = useState<FgSession[]>([]);
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
        passed: number;
        failed: number;
        pending: number;
        scans: ScanRecord[];
    }>({
        workOrderQuantity: 0,
        passed: 0,
        failed: 0,
        pending: 0,
        scans: []
    });
    const [scanBarcodeVal, setScanBarcodeVal] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [scansSearchQuery, setScansSearchQuery] = useState('');
    const [isSearchFocused, setIsSearchFocused] = useState(false);

    const processedScans = React.useMemo(() => {
        const query = scansSearchQuery.trim().toLowerCase();
        if (!query) return stats.scans;

        const matches: typeof stats.scans = [];
        const nonMatches: typeof stats.scans = [];

        stats.scans.forEach(scan => {
            const barcodeMatch = scan.barcode && scan.barcode.toLowerCase().includes(query);
            const serialMatch = (scan as any).serial_number && String((scan as any).serial_number).toLowerCase().includes(query);
            if (barcodeMatch || serialMatch) {
                matches.push(scan);
            } else {
                nonMatches.push(scan);
            }
        });

        return [...matches, ...nonMatches];
    }, [stats.scans, scansSearchQuery]);

    // Dialogs / Modals State
    const [selectedQrBarcode, setSelectedQrBarcode] = useState<string | null>(null);
    const [singleQrDataUrl, setSingleQrDataUrl] = useState<string | null>(null);
    const [isZipping, setIsZipping] = useState(false);
    const [showPrevStageModal, setShowPrevStageModal] = useState(false);

    // Pending at Current Stage Hook
    const {
        units: prevStageUnits,
        count: prevStageCount,
        previousStage: resolvedPrevStage,
        loading: prevStageLoading,
        refetch: refetchPrevStage
    } = usePreviousStagePassed({
        workOrderId: activeSession?.work_order_id,
        side: activeSession?.side,
        stage: 'SMT-FG',
        sessionId: activeSession?.id,
        enabled: !!activeSession
    });

    // Focus Lock Ref
    const scanInputRef = useRef<HTMLInputElement>(null);

    // Toasts System
    const [toasts, setToasts] = useState<Toast[]>([]);
    const toastIdRef = useRef(0);

    const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
        const id = ++toastIdRef.current;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    }, []);

    const removeToast = (id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    // Load Eligible Work Orders
    const loadEligibleWos = async () => {
        try {
            const data = await apiFetch('/api/smt/smt-fg/eligible-wos');
            setEligibleWos(data || []);
        } catch (err: any) {
            console.error(err);
            addToast(err.message || 'Failed to load eligible work orders.', 'error');
        }
    };

    // Fetch combined auto-populated details
    const fetchAutoPopulateDetails = async (woId: string, currentSide?: string) => {
        setDetailsLoading(true);
        setDetailsError('');
        try {
            let url = `/api/smt/smt-fg/auto-populate-details/${encodeURIComponent(woId)}`;
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

    // Dropdown Change Handler
    const handleWoChange = (woId: string) => {
        setSelectedWoId(woId);
    };

    // Fetch Session Statistics & Scan Log
    const fetchSessionStats = async (sessionId: string) => {
        try {
            const data = await apiFetch(`/api/smt/smt-fg/sessions/${sessionId}/stats`);
            if (data) {
                setStats({
                    workOrderQuantity: data.workOrderQuantity || 0,
                    passed: data.passed || 0,
                    failed: data.failed || 0,
                    pending: data.pending || 0,
                    scans: data.scans || []
                });

                // If backend flags the session as completed, update status locally to Completed
                if (data.isCompleted && activeSession?.status !== 'Completed') {
                    addToast('SMT FG Session completed successfully.', 'success');
                    setActiveSession(prev => prev ? { ...prev, status: 'Completed' } : null);
                    fetchSessionsLists();
                }
            }
        } catch (err: any) {
            console.error(err);
            addToast('Failed to refresh session statistics.', 'error');
        } finally {
            refetchPrevStage();
        }
    };

    const fetchActiveSessions = async (pageVal = activePage, limitVal = activeLimit, searchVal = activeSearch) => {
        setSessionsLoading(true);
        try {
            const query = `status=InProgress&page=${pageVal}&limit=${limitVal}&search=${encodeURIComponent(searchVal)}`;
            const res = await apiFetch(`/api/smt/smt-fg/sessions?${query}`);
            if (res) {
                setActiveSessionsList(res.data || []);
                setActiveTotal(res.pagination?.total || 0);
            }
        } catch (err: any) {
            console.error('Error loading active SMT FG sessions:', err);
        } finally {
            setSessionsLoading(false);
        }
    };

    const fetchCompletedSessions = async (pageVal = completedPage, limitVal = completedLimit, searchVal = completedSearch) => {
        setSessionsLoading(true);
        try {
            const query = `status=Completed&page=${pageVal}&limit=${limitVal}&search=${encodeURIComponent(searchVal)}`;
            const res = await apiFetch(`/api/smt/smt-fg/sessions?${query}`);
            if (res) {
                setCompletedSessionsList(res.data || []);
                setCompletedTotal(res.pagination?.total || 0);
            }
        } catch (err: any) {
            console.error('Error loading completed SMT FG sessions:', err);
        } finally {
            setSessionsLoading(false);
        }
    };

    // Fetch list of Active & Completed SMT FG Sessions (unified delegator)
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

    useEffect(() => {
        loadEligibleWos();
        fetchActiveSessions(1, activeLimit, '');
        fetchCompletedSessions(1, completedLimit, '');
    }, []);

    // Keep scanner input focus locked
    useEffect(() => {
        if (activeSession && activeSession.status === 'In Progress' && !isSearchFocused) {
            const interval = setInterval(() => {
                if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
                    scanInputRef.current?.focus();
                }
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [activeSession, isSearchFocused]);

    // Handle Start SMT FG Session
    const handleStartSession = async () => {
        if (!selectedWoId) {
            addToast('Please select a Work Order first.', 'error');
            return;
        }
        if (!autoPopulatedDetails) {
            addToast('Please ensure auto-populated details are loaded.', 'error');
            return;
        }

        try {
            // Confirm Double-Sided Bottom Completion logic via API
            const isDoubleSided = autoPopulatedDetails.numberOfSides?.toLowerCase() === 'top / bottom' || autoPopulatedDetails.numberOfSides?.includes('/');
            if (isDoubleSided && autoPopulatedDetails.side.toLowerCase() === 'top') {
                const checkRes = await apiFetch(`/api/smt/smt-fg/work-orders/${encodeURIComponent(selectedWoId)}/check-bottom`);
                if (!checkRes.completed) {
                    addToast('Operational Lock: Top side is locked. Please ensure the Bottom side Post AOI inspections are fully completed first.', 'error');
                    return;
                }
            }

            const session = await apiFetch('/api/smt/smt-fg/sessions', {
                method: 'POST',
                body: JSON.stringify({
                    work_order_id: selectedWoId,
                    stencil_lifecycle_id: autoPopulatedDetails.stencilLifecycleId,
                    squeegee_front_number: autoPopulatedDetails.squeegeeFrontNumber,
                    squeegee_rear_number: autoPopulatedDetails.squeegeeRearNumber,
                    solder_paste_barcode: autoPopulatedDetails.solderPasteBarcode,
                    side: autoPopulatedDetails.side
                })
            });

            addToast(`SMT FG Session started successfully for Work Order ${selectedWoId} (${autoPopulatedDetails.side} side).`, 'success');
            setActiveSession(session);
            setSelectedWoId('');
            setAutoPopulatedDetails(null);
            fetchSessionStats(session.id);
            fetchSessionsLists();
        } catch (err: any) {
            console.error(err);
            addToast(err.message || 'Failed to start SMT FG Session.', 'error');
        }
    };

    // Resume an existing session
    const handleResumeSession = async (session: FgSession) => {
        try {
            setActiveSession(session);
            fetchSessionStats(session.id);
            addToast(`Session resumed successfully.`, 'info');
            fetchSessionsLists();
        } catch (err: any) {
            console.error(err);
            addToast(err.message || 'Failed to resume session.', 'error');
        }
    };

    // High Speed Barcode Scan Submit
    const handleBarcodeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeSession || !scanBarcodeVal.trim()) return;

        const barcode = scanBarcodeVal.trim().toUpperCase();
        setScanBarcodeVal('');
        setIsScanning(true);

        try {
            const res = await apiFetch(`/api/smt/smt-fg/sessions/${activeSession.id}/scan`, {
                method: 'POST',
                body: JSON.stringify({ barcode })
            });

            addToast(res.message || `Barcode ${barcode} recorded successfully.`, 'success');
            await fetchSessionStats(activeSession.id);
        } catch (err: any) {
            console.error(err);
            addToast(err.message || 'Failed to register barcode scan.', 'error');
        } finally {
            setIsScanning(false);
            scanInputRef.current?.focus();
        }
    };

    // Delete Session
    const handleDeleteSession = async (sessionId: string) => {
        if (!isSuperAdmin) {
            addToast("Only Super Admin is authorized to delete records.\nPlease contact your Super Admin if this record needs to be deleted.", 'error');
            return;
        }
        if (window.confirm('Warning: Deleting a session is permanent. Are you sure you want to proceed?')) {
            try {
                await apiFetch(`/api/smt/smt-fg/sessions/${sessionId}`, { method: 'DELETE' });
                addToast('Session deleted successfully.', 'success');
                if (activeSession?.id === sessionId) {
                    setActiveSession(null);
                }
                loadEligibleWos();
                fetchSessionsLists();
            } catch (err: any) {
                console.error(err);
                addToast(err.message || 'Failed to delete session.', 'error');
            }
        }
    };

    // EXPORT & REPORTING UTILITIES
    const handleExportExcel = async (sessionId?: string) => {
        const id = sessionId || activeSession?.id;
        if (!id) return;
        try {
            const response = await fetch(`/api/smt/smt-fg/sessions/${id}/export/excel`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || 'Failed to download Excel report');
            }
            const blob = await response.blob();
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `SMT_FG_Session_Report_${id}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            addToast('Excel production report downloaded successfully.', 'success');
        } catch (err: any) {
            console.error(err);
            addToast(err.message || 'Failed to export Excel report.', 'error');
        }
    };

    const handleExportFullPDF = async (sessionId?: string) => {
        const id = sessionId || activeSession?.id;
        if (!id) return;
        try {
            const res = await fetch(`/api/smt/smt-fg/sessions/${id}/export/pdf-data`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.message || 'Failed to fetch PDF report metadata');
            }
            const reportData = await res.json();
            generatePdfReport(reportData);
        } catch (err: any) {
            console.error(err);
            addToast(err.message || 'Failed to export PDF report.', 'error');
        }
    };

    const generatePdfReport = (data: any) => {
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const PRIMARY_NAVY = [30, 58, 95];
        const SECONDARY_BLUE = [37, 99, 235];
        const BG_LIGHT = [248, 250, 252];
        const TEXT_DARK = [30, 41, 59];
        const TEXT_MUTED = [100, 116, 139];

        // Draw header background band
        doc.setFillColor(PRIMARY_NAVY[0], PRIMARY_NAVY[1], PRIMARY_NAVY[2]);
        doc.rect(0, 0, 210, 32, 'F');

        // Document Title
        doc.setTextColor(255, 255, 255);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(18);
        doc.text('SMT Finished Goods (FG) Release Report', 15, 14);

        // Subtitle
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(203, 213, 225);
        doc.text(`Stage: Finished Goods Inspection & Release  |  Date: ${new Date().toLocaleString('en-IN')}`, 15, 20);
        doc.text(`Generated By: ${smtUser?.name || 'SFCS System'}`, 15, 25);

        // Section header function
        let currentY = 40;
        const addSectionHeader = (title: string) => {
            doc.setFillColor(BG_LIGHT[0], BG_LIGHT[1], BG_LIGHT[2]);
            doc.rect(15, currentY, 180, 8, 'F');
            doc.setDrawColor(226, 232, 240);
            doc.line(15, currentY, 195, currentY);
            doc.line(15, currentY + 8, 195, currentY + 8);
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(SECONDARY_BLUE[0], SECONDARY_BLUE[1], SECONDARY_BLUE[2]);
            doc.text(title, 18, currentY + 5.5);
            currentY += 12;
        };

        const addKVRow = (key: string, value: string) => {
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
            doc.text(key, 20, currentY);
            doc.setFont('Helvetica', 'normal');
            doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
            doc.text(value || '—', 75, currentY);
            currentY += 6;
        };

        // Section 1: Work Order Details
        addSectionHeader('1. WORK ORDER DETAILS');
        addKVRow('Work Order Number:', data.work_order_id);
        addKVRow('PO Number:', data.po_id);
        addKVRow('Product Name / Model:', data.product_name);
        addKVRow('Product Description:', data.product_description);
        addKVRow('Total Quantity:', data.work_order_quantity?.toString());
        addKVRow('Sides Config:', data.work_order_sides);
        addKVRow('SMT Line ID:', data.line_id);
        addKVRow('Remarks:', data.work_order_remarks);

        currentY += 4;

        // Section 2: Stencil Details
        addSectionHeader('2. STENCIL PARAMETERS');
        addKVRow('Stencil / Model Name:', data.stencil_name);
        addKVRow('Job Number:', data.job_number);
        addKVRow('Revision:', data.revision);
        addKVRow('Side:', data.stencil_side);
        addKVRow('Total Lifespan Count:', data.qty_life_cycle?.toString());
        addKVRow('Current Life Cycles used:', data.current_used_life_cycle?.toString());
        addKVRow('Remaining Life Cycles:', data.balance_life_cycle?.toString());

        currentY += 4;

        // Section 3: Session Details
        addSectionHeader('3. SMT FG SESSION & INSPECTION PARAMETERS');
        addKVRow('Squeegee Front Number:', data.squeegee_front_number);
        addKVRow('Squeegee Rear Number:', data.squeegee_rear_number);
        addKVRow('Solder Paste Barcode:', data.solder_paste_barcode);
        addKVRow('PCB Side:', data.side);
        addKVRow('SMT FG Released By:', data.created_by_name);
        addKVRow('SMT FG Started Date & Time:', formatTimestamp(data.created_at));
        addKVRow('Session Status:', data.status);

        currentY += 4;

        // Section 4: Production Summary
        addSectionHeader('4. PRODUCTION SUMMARY');
        addKVRow('Work Order Quantity:', (data.work_order_quantity ?? data.production?.quantity ?? 0).toString());
        addKVRow('Passed Quantity:', (data.passed ?? data.production?.passed ?? 0).toString());
        addKVRow('Failed Quantity:', (data.failed ?? data.production?.failed ?? 0).toString());
        addKVRow('Pending Quantity:', (data.pending ?? data.production?.pending ?? 0).toString());

        // Page Break for Scan Logs Table
        doc.addPage();
        currentY = 20;

        doc.setFillColor(PRIMARY_NAVY[0], PRIMARY_NAVY[1], PRIMARY_NAVY[2]);
        doc.rect(0, 0, 210, 16, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('SMT Finished Goods (FG) Scan History Log', 15, 10.5);

        currentY = 28;
        doc.setFillColor(BG_LIGHT[0], BG_LIGHT[1], BG_LIGHT[2]);
        doc.rect(15, currentY, 180, 8, 'F');
        doc.setDrawColor(203, 213, 225);
        doc.rect(15, currentY, 180, 8, 'S');
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
        doc.text('Barcode / Serial Number', 18, currentY + 5.5);
        doc.text('Scanned By', 80, currentY + 5.5);
        doc.text('Date & Time', 125, currentY + 5.5);
        doc.text('Status', 175, currentY + 5.5);

        currentY += 8;

        const scans = data.scans || [];
        scans.forEach((scan: any) => {
            if (currentY > 275) {
                doc.addPage();
                currentY = 20;
                doc.setFillColor(BG_LIGHT[0], BG_LIGHT[1], BG_LIGHT[2]);
                doc.rect(15, currentY, 180, 8, 'F');
                doc.setDrawColor(203, 213, 225);
                doc.rect(15, currentY, 180, 8, 'S');
                doc.setFont('Helvetica', 'bold');
                doc.setFontSize(8);
                doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
                doc.text('Barcode / Serial Number', 18, currentY + 5.5);
                doc.text('Scanned By', 80, currentY + 5.5);
                doc.text('Date & Time', 125, currentY + 5.5);
                doc.text('Status', 175, currentY + 5.5);
                currentY += 8;
            }

            doc.setFont('Helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
            doc.text(scan.barcode, 18, currentY + 4.5);
            doc.text(scan.scanned_by, 80, currentY + 4.5);
            doc.text(formatTimestamp(scan.scanned_at), 125, currentY + 4.5);
            
            const isPass = scan.result === 'PASS';
            if (isPass) {
                doc.setTextColor(22, 163, 74); // green
            } else {
                doc.setTextColor(220, 38, 38); // red
            }
            doc.setFont('Helvetica', 'bold');
            doc.text(scan.result, 175, currentY + 4.5);

            // Row underline
            doc.setDrawColor(241, 245, 249);
            doc.line(15, currentY + 7, 195, currentY + 7);

            currentY += 7.5;
        });

        doc.save(`SMT_FG_PDF_Report_${data.id}.pdf`);
        addToast('PDF production report downloaded successfully.', 'success');
    };

    const handleExportCSV = () => {
        if (stats.scans.length === 0) {
            addToast('No scan log data available to export.', 'info');
            return;
        }
        let csv = 'Barcode,Scanned By,Date & Time,Result\n';
        stats.scans.forEach(scan => {
            csv += `"${scan.barcode}","${scan.scanned_by}","${formatTimestamp(scan.scanned_at)}","${scan.result}"\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `SMT_FG_Scan_Log_${activeSession?.id}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        addToast('CSV file downloaded successfully.', 'success');
    };

    // Download QR Code helpers
    useEffect(() => {
        if (selectedQrBarcode) {
            QRCode.toDataURL(selectedQrBarcode, { width: 300, margin: 2 })
                .then(url => setSingleQrDataUrl(url))
                .catch(err => console.error(err));
        } else {
            setSingleQrDataUrl(null);
        }
    }, [selectedQrBarcode]);

    const handleDownloadAllQRPDF = async () => {
        if (stats.scans.length === 0) {
            addToast('No scanned barcodes found in this session.', 'error');
            return;
        }

        try {
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [60, 40] }); // standard PCB label size
            for (let i = 0; i < stats.scans.length; i++) {
                const scan = stats.scans[i];
                if (scan.result !== 'PASS') continue;

                if (i > 0) pdf.addPage([60, 40]);

                // Generate QR image
                const qrUrl = await QRCode.toDataURL(scan.barcode, { margin: 1, width: 150 });
                pdf.addImage(qrUrl, 'PNG', 17, 3, 26, 26);

                pdf.setFont('Helvetica', 'bold');
                pdf.setFontSize(7.5);
                pdf.text(scan.barcode, 30, 32.5, { align: 'center' });

                pdf.setFont('Helvetica', 'normal');
                pdf.setFontSize(5);
                pdf.text(`WO: ${activeSession?.work_order_id}`, 30, 36.5, { align: 'center' });
            }
            pdf.save(`SMT_FG_QR_Labels_${activeSession?.id}.pdf`);
            addToast('All QR Labels PDF generated successfully.', 'success');
        } catch (err) {
            console.error(err);
            addToast('Failed to compile QR label PDF.', 'error');
        }
    };

    const handleDownloadAllQRPNG = async () => {
        if (stats.scans.length === 0) {
            addToast('No scanned barcodes found in this session.', 'error');
            return;
        }

        setIsZipping(true);
        try {
            const zip = new JSZip();
            for (const scan of stats.scans) {
                if (scan.result !== 'PASS') continue;
                const qrUrl = await QRCode.toDataURL(scan.barcode, { margin: 1, width: 300 });
                const base64Data = qrUrl.split(',')[1];
                zip.file(`${scan.barcode}.png`, base64Data, { base64: true });
            }
            const content = await zip.generateAsync({ type: 'blob' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = `SMT_FG_QR_Images_${activeSession?.id}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            addToast('All QR Code images compiled into ZIP successfully.', 'success');
        } catch (err) {
            console.error(err);
            addToast('Failed to bundle QR code images.', 'error');
        } finally {
            setIsZipping(false);
        }
    };

    const getScanResultBadge = (result: string) => {
        switch (result) {
            case 'PASS':
                return <span className={styles.detailPassedBadge}>PASS</span>;
            default:
                return <span className={styles.detailPendingBadge}>{result}</span>;
        }
    };

    // Unified horizontal panel renderer
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
                                <span className={styles.infoLabel}>Squeegee Front Number</span>
                                <span className={styles.infoValue}>{details.squeegeeFrontNumber}</span>
                            </div>
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>Squeegee Rear Number</span>
                                <span className={styles.infoValue}>{details.squeegeeRearNumber}</span>
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

    const isModalOpen = !!selectedQrBarcode || showPrevStageModal;

    return (
        <div className={styles.container}>
            <Toaster toasts={toasts} onRemove={removeToast} />
            
            <div className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2>🏭 SMT Finished Goods (FG) Process</h2>
                    <p>Enforce serial number tracking, stencil life verification, and final Finished Goods inspection & release.</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        className={styles.secondaryButton}
                        onClick={() => navigate('/smt/workorder-history', { state: { areaId: 'SMT' } })}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <span>📊</span> View History
                    </button>
                </div>
            </div>

            {!activeSession ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
                    {/* Work Order Selector Card */}
                    <div className={styles.card} style={{ margin: 0 }}>
                        <h3>Select Work Order to Start Session</h3>
                        <div className={styles.inputGroup} style={{ maxWidth: '450px', marginBottom: '1.5rem' }}>
                            <label>Work Order</label>
                            <WorkOrderSelector
                                options={eligibleWos}
                                value={selectedWoId}
                                onChange={handleWoChange}
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
                                    Start SMT FG Session
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
                            Failed to load auto-populated details for this Work Order. Make sure SMT Post AOI setup exists and eligible barcodes are available.
                        </div>
                    ) : null}

                    {/* Active Sessions Panel */}
                    <div className={styles.card} style={{ margin: 0 }}>
                        <h3 style={{ marginBottom: '1rem' }}>Active SMT FG Sessions</h3>
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
                            <p style={{ color: '#64748b' }}>Retrieving session registries...</p>
                        ) : activeSessionsList.length === 0 ? (
                            <p style={{ color: '#64748b', fontStyle: 'italic', margin: 0 }}>No active SMT FG sessions found. Set up a session to begin.</p>
                        ) : (
                            <>
                                <div className={styles.tableContainer}>
                                    <table className={styles.table} style={{ marginTop: 0 }}>
                                        <thead>
                                            <tr>
                                                <th>WO Number</th>
                                                <th>Product Name</th>
                                                <th>Target Qty</th>
                                                <th>Stencil Name</th>
                                                <th>Sqg. Front No.</th><th>Sqg. Rear No.</th>
                                                <th>Solder Paste</th>
                                                <th>Side</th>
                                                <th>Created By</th>
                                                <th>Status</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {activeSessionsList.map(s => (
                                                <tr key={s.id}>
                                                    <td style={{ fontWeight: 600, color: '#4f46e5' }}>{s.work_order_id}</td>
                                                    <td>{s.product_name || '-'}</td>
                                                    <td>{s.work_order_quantity || '-'}</td>
                                                    <td>{s.stencil_name || '-'}</td>
                                                    <td>{s.squeegee_front_number || '-'}</td><td>{s.squeegee_rear_number || '-'}</td>
                                                    <td style={{ wordBreak: 'break-all', maxWidth: '150px' }}>{s.solder_paste_barcode || '-'}</td>
                                                    <td>
                                                        <span className={styles.infoValue} style={{ color: '#4f46e5' }}>{s.side}</span>
                                                    </td>
                                                    <td>{s.created_by_name}</td>
                                                    <td>
                                                        <span className={styles.statusBlue}>
                                                            {s.status}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', gap: '6px' }}>
                                                            <button className={styles.secondaryButton} style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }} onClick={() => handleResumeSession(s)}>
                                                                Resume
                                                            </button>
                                                            {isSuperAdmin && (
                                                                <button className={styles.deleteTextButton} onClick={() => handleDeleteSession(s.id)}>
                                                                    Delete
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
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
                    <div className={styles.card} style={{ margin: 0 }}>
                        <h3 style={{ marginBottom: '1rem' }}>Completed SMT FG Sessions History</h3>
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
                            <p style={{ color: '#64748b' }}>Retrieving logs...</p>
                        ) : completedSessionsList.length === 0 ? (
                            <p style={{ color: '#64748b', fontStyle: 'italic', margin: 0 }}>No finished sessions recorded.</p>
                        ) : (
                            <>
                                <div className={styles.tableContainer}>
                                    <table className={styles.table} style={{ marginTop: 0 }}>
                                        <thead>
                                            <tr>
                                                <th>WO Number</th>
                                                <th>Product Name</th>
                                                <th>Target Qty</th>
                                                <th>Stencil Name</th>
                                                <th>Side</th>
                                                <th>Created By</th>
                                                <th>Status</th>
                                                <th>Date & Time</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {completedSessionsList.map(s => (
                                                <tr key={s.id}>
                                                    <td style={{ fontWeight: 600, color: '#334155' }}>{s.work_order_id}</td>
                                                    <td>{s.product_name || '-'}</td>
                                                    <td>{s.work_order_quantity || '-'}</td>
                                                    <td>{s.stencil_name || '-'}</td>
                                                    <td>{s.side}</td>
                                                    <td>{s.created_by_name}</td>
                                                    <td>
                                                        <span className={s.status === 'Completed' ? styles.statusGreen : styles.statusRed}>
                                                            {s.status}
                                                        </span>
                                                    </td>
                                                    <td style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                                        {formatTimestamp(s.created_at)}
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', gap: '6px' }}>
                                                            <button className={styles.secondaryButton} style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }} onClick={() => handleResumeSession(s)}>
                                                                View Log
                                                            </button>
                                                            <button
                                                                className={styles.secondaryButton}
                                                                style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem', color: '#1e3a5f', borderColor: '#2563eb' }}
                                                                onClick={() => handleExportExcel(s.id)}
                                                            >
                                                                Excel
                                                            </button>
                                                            <button
                                                                className={styles.secondaryButton}
                                                                style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem', color: '#7c3aed', borderColor: '#4338ca' }}
                                                                onClick={() => handleExportFullPDF(s.id)}
                                                            >
                                                                PDF
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
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
                        <button className={styles.detailBackButton} onClick={() => { setActiveSession(null); loadEligibleWos(); fetchSessionsLists(); }}>
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

                    {/* Stats Dashboard */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
                        <div className={styles.card} style={{ margin: 0, padding: '1.25rem', borderLeft: '5px solid #6366f1', textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>WO Quantity</p>
                            <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.8rem', color: '#1e1b4b' }}>{stats.workOrderQuantity}</h2>
                        </div>
                        <div
                            className={styles.card}
                            onClick={() => setShowPrevStageModal(true)}
                            title="Click to view Pending at Current Stage units"
                            style={{
                                margin: 0,
                                padding: '1.25rem',
                                borderLeft: '5px solid #0284c7',
                                textAlign: 'center',
                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                background: '#f0f9ff'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: '#0369a1', fontWeight: 700 }}>Pending at Current Stage</p>
                                <span style={{ fontSize: '0.75rem', color: '#0284c7' }}>🔍</span>
                            </div>
                            <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.8rem', color: '#0369a1' }}>
                                {prevStageLoading && prevStageCount === 0 ? '...' : prevStageCount}
                            </h2>
                        </div>
                        <div className={styles.card} style={{ margin: 0, padding: '1.25rem', borderLeft: '5px solid #10b981', textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>Passed</p>
                            <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.8rem', color: '#047857' }}>{stats.passed}</h2>
                        </div>
                        <div className={styles.card} style={{ margin: 0, padding: '1.25rem', borderLeft: '5px solid #f59e0b', textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>Pending</p>
                            <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.8rem', color: '#b45309' }}>{stats.pending}</h2>
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
                        <div className={styles.searchHeader}>
                            <div className={styles.detailItemsHeader}>
                                <h3>Scanned PCB FG Inspection Logs ({stats.scans.length} rows)</h3>
                            </div>
                            <div className={styles.searchContainer}>
                                <BarcodeSearch value={scansSearchQuery} onChange={setScansSearchQuery} onFocus={() => setIsSearchFocused(true)} onBlur={() => setIsSearchFocused(false)} />
                                
                                {/* Exports & Download Bar */}
                                <div className={styles.searchReports}>
                                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, marginRight: 2 }}>Reports:</span>
                                    <button
                                        className={styles.secondaryButton}
                                        style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem', background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.4rem 0.8rem', fontWeight: 600, cursor: 'pointer' }}
                                        onClick={() => handleExportExcel()}
                                        title="Download Excel Finished Goods report"
                                    >
                                        📊 Excel Report
                                    </button>
                                    <button
                                        className={styles.secondaryButton}
                                        style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem', background: 'linear-gradient(135deg,#7c3aed,#4338ca)', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.4rem 0.8rem', fontWeight: 600, cursor: 'pointer' }}
                                        onClick={() => handleExportFullPDF()}
                                        title="Download PDF Finished Goods report"
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
                        </div>

                        <div className={styles.detailTableContainer}>
                            <table className={styles.table} style={{ marginTop: 0 }}>
                                <thead>
                                    <tr>
                                        <th>Barcode</th>
                                        <th>Scanned By</th>
                                        <th>Date & Time</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {scansSearchQuery.trim() && processedScans.filter(scan => {
                                        const barcodeMatch = scan.barcode && scan.barcode.toLowerCase().includes(scansSearchQuery.trim().toLowerCase());
                                        const serialMatch = (scan as any).serial_number && String((scan as any).serial_number).toLowerCase().includes(scansSearchQuery.trim().toLowerCase());
                                        return barcodeMatch || serialMatch;
                                    }).length === 0 ? (
                                        <tr>
                                            <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: '#dc2626', fontWeight: 600 }}>
                                                No matching Serial Number or Barcode found.
                                            </td>
                                        </tr>
                                    ) : (
                                        processedScans.map(scan => {
                                            const isMatch = scansSearchQuery.trim() && (
                                                (scan.barcode && scan.barcode.toLowerCase().includes(scansSearchQuery.trim().toLowerCase())) ||
                                                ((scan as any).serial_number && String((scan as any).serial_number).toLowerCase().includes(scansSearchQuery.trim().toLowerCase()))
                                            );
                                            return (
                                                <tr key={scan.scan_id} className={isMatch ? styles.searchMatchRow : ''}>
                                                    <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1rem', letterSpacing: '0.5px' }}>
                                                        {scan.barcode}
                                                    </td>
                                                    <td>{scan.scanned_by}</td>
                                                    <td style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                                        {formatTimestamp(scan.scanned_at)}
                                                    </td>
                                                    <td>{getScanResultBadge(scan.result)}</td>
                                                    <td>
                                                        <button
                                                            className={styles.secondaryButton}
                                                            title="View QR code"
                                                            style={{ padding: '0.3rem 0.45rem', fontSize: '1rem', lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 'auto', borderRadius: '6px' }}
                                                            onClick={() => setSelectedQrBarcode(scan.barcode)}
                                                        >
                                                            🔳
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                    {stats.scans.length === 0 && (
                                        <tr>
                                            <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                                                No PCBs scanned in this Finished Goods session yet. Scan barcodes above.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}



            {/* ─── MODAL 2: SINGLE QR CODE VIEW ───────────────────────────────── */}
            {selectedQrBarcode && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className={styles.card} style={{ width: '380px', padding: '2rem', margin: 0, textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)' }}>
                        <h3 style={{ borderBottom: 'none', padding: 0, marginBottom: '1rem' }}>🔳 QR Code Reference</h3>
                        <p style={{ fontSize: '0.9rem', color: '#475569', marginBottom: '1.5rem', fontFamily: 'monospace', fontWeight: 'bold' }}>
                            {selectedQrBarcode}
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            {singleQrDataUrl ? (
                                <img src={singleQrDataUrl} alt="QR Code Label" style={{ width: '200px', height: '200px' }} />
                            ) : (
                                <div style={{ width: '200px', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Generating QR...</div>
                            )}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                            <button className={styles.secondaryButton} onClick={() => setSelectedQrBarcode(null)}>
                                Close
                            </button>
                            {singleQrDataUrl && (
                                <a
                                    href={singleQrDataUrl}
                                    download={`QR_${selectedQrBarcode}.png`}
                                    className={styles.button}
                                    style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                    Download Image 📥
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showPrevStageModal && (
                <PreviousStagePassedModal
                    isOpen={showPrevStageModal}
                    onClose={() => setShowPrevStageModal(false)}
                    currentStage="SMT-FG"
                    previousStage={resolvedPrevStage || 'Post-AOI'}
                    workOrderId={activeSession?.work_order_id || ''}
                    side={activeSession?.side || ''}
                    count={prevStageCount}
                    units={prevStageUnits}
                    loading={prevStageLoading}
                />
            )}
        </div>
    );
};

export default SMTFG;
