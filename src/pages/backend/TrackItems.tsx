import React, { useState, useRef, useEffect, useMemo } from 'react';
import { apiFetch } from '../../utils/api';
import styles from './TrackItems.module.css';
import {
    Search, Package, CheckCircle, AlertTriangle,
    Clock, Activity, Zap, ArrowDown, RotateCcw, ChevronRight,
    User, Calendar, FileText, Wrench, MapPin, TrendingUp, Download,
    Filter, Layers
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useAuth } from '../../hooks/useAuth';



interface ScanEntry {
    station: string;
    stage_order: number;
    status: string;
    scanned_by: string;
    scanned_at: string;
    remarks: string | null;
    resolution_remarks: string | null;
    failed_at: string | null;
    failed_remarks: string | null;
    repair_remark: string | null;
    repair_time: string | null;
}

interface TrackResult {
    barcode: string;
    unit_serial_number: string | null;
    searched_by: string;
    batch_number: string;
    wo_number: string;
    customer_name: string;
    model: string;
    quantity: number;
    has_smt?: boolean;
    has_backend?: boolean;
    current_stage: string;
    current_status: string;
    failed_stage: string | null;
    final_status_label: string;
    last_updated_at: string;
    failure_created_at: string | null;
    repair_completed_at: string | null;
    revalidated_passed_at: string | null;
    total_failures: number;
    total_reworks: number;
    total_debugs: number;
    scan_history: ScanEntry[];
    smt_scan_history?: any[];
    selected_stages?: any;
    sides?: string;
    is_double_sided?: boolean;
    is_bottom_only?: boolean;
    smt_statuses?: Record<string, string>;
    smt_top?: Record<string, string>;
    smt_bottom?: Record<string, string>;
    step_status_top?: Record<string, string>;
    step_status_bottom?: Record<string, string>;
    step_status?: Record<string, string>;
    active_route?: Array<{
        id: number;
        stage_code: string;
        stage_name: string;
        stage_order?: number;
    }>;
}


const PRODUCTION_PIPELINE = [
    { code: 'PTH', name: 'Pre-Soldering', label: 'PTH' },
    { code: 'VI', name: 'Visual Inspection', label: 'VI' },
    { code: 'QA', name: 'Quality Assurance', label: 'QA' },
    { code: 'FLASHING', name: 'Flashing', label: 'Flashing' },
    { code: 'PCBA_FCT', name: 'PCBA FCT', label: 'PCBA-FCT' },
    { code: 'ASSEMBLY', name: 'Assembly', label: 'Assembly' },
    { code: 'UNIT_TESTING', name: 'Unit Testing', label: 'Unit Testing' },
    { code: 'QI', name: 'Quality Inspection', label: 'QI' },
    { code: 'PACKING', name: 'Packing', label: 'Packing' }
];

const SMT_PIPELINE_STAGES = ['Serial Number', 'Printing', 'SPI', 'Pre AOI', 'Post AOI', 'Rework', 'SMT FG'];
const SMT_STAGES = ['Printing', 'SPI', 'Pre AOI', 'Post AOI', 'Rework', 'SMT FG'];

const getSmtStepStatus = (smtMap: Record<string, string> | undefined, stageName: string): string => {
    if (!smtMap) return 'PENDING';
    if (smtMap[stageName] && smtMap[stageName] !== '-') return smtMap[stageName];
    const norm = stageName.toUpperCase().replace(/[\s\-_]/g, '');
    for (const k of Object.keys(smtMap)) {
        if (k.toUpperCase().replace(/[\s\-_]/g, '') === norm && smtMap[k] && smtMap[k] !== '-') {
            return smtMap[k];
        }
    }
    return 'PENDING';
};

const fmt = (ts: string | null | undefined) =>
    ts ? new Date(ts).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' }) : '—';

const statusColor = (s: string): string => {
    const upper = (s || '').toUpperCase();
    if (upper === 'N/A' || upper === '-' || upper === 'NA' || upper === 'SKIPPED') return '#94a3b8';
    if (upper.includes('FAIL') || upper.includes('FAILED') || upper.includes('DEBUG')) return '#ef4444';
    if (upper.includes('REWORK')) return '#f59e0b';
    if (upper.includes('PENDING')) return '#d97706';
    if (upper.includes('PASS') || upper.includes('ACCEPTED') || upper.includes('COMPLETED')) return '#10b981';
    switch (upper) {
        case 'READY_FOR_RESCAN': return '#6366f1';
        case 'IN_PROGRESS': return '#3b82f6';
        default: return '#94a3b8';
    }
};

const statusBg = (s: string): string => {
    switch ((s || '').toUpperCase()) {
        case 'ACCEPTED': case 'PASS': return 'rgba(16,185,129,0.12)';
        case 'PENDING': return 'rgba(217,119,6,0.12)';
        case 'N/A': case 'NA': case 'SKIPPED': return 'rgba(148,163,184,0.12)';
        case 'REWORK': return 'rgba(245,158,11,0.12)';
        case 'DEBUG': case 'FAILED': case 'FAIL': return 'rgba(239,68,68,0.12)';
        case 'READY_FOR_RESCAN': return 'rgba(99,102,241,0.12)';
        case 'IN_PROGRESS': return 'rgba(59,130,246,0.12)';
        default: return 'rgba(148,163,184,0.12)';
    }
};

export const computeOverallStageStatus = (
    topStatus: string | null | undefined,
    bottomStatus: string | null | undefined
): string => {
    const normalize = (val: string | null | undefined) => {
        const s = (val || '').trim().toUpperCase();
        if (!s || s === '-' || s === 'NA' || s === 'N/A') return 'N/A';
        if (s === 'PASSED' || s === 'PASS') return 'PASS';
        if (s === 'FAILED' || s === 'FAIL' || s === 'REWORK' || s === 'DEBUG') return 'FAIL';
        if (s === 'PENDING') return 'PENDING';
        return s;
    };

    const top = normalize(topStatus);
    const bottom = normalize(bottomStatus);

    const topIsNA = top === 'N/A';
    const bottomIsNA = bottom === 'N/A';

    // If both sides are N/A, show overall N/A.
    if (topIsNA && bottomIsNA) {
        return 'N/A';
    }

    // If only one side is applicable and its status is PASS, show overall PASS.
    // If an applicable side is FAIL, show overall FAIL.
    // If an applicable side is PENDING and no failure exists, show overall PENDING.
    if (!topIsNA && bottomIsNA) {
        if (top === 'FAIL') return 'FAIL';
        if (top === 'PASS') return 'PASS';
        return 'PENDING';
    }

    if (topIsNA && !bottomIsNA) {
        if (bottom === 'FAIL') return 'FAIL';
        if (bottom === 'PASS') return 'PASS';
        return 'PENDING';
    }

    // Both sides are applicable:
    // If an applicable side is FAIL, show overall FAIL.
    if (top === 'FAIL' || bottom === 'FAIL') {
        return 'FAIL';
    }

    // If TOP = PASS and BOTTOM = PASS, show overall PASS.
    if (top === 'PASS' && bottom === 'PASS') {
        return 'PASS';
    }

    // If an applicable side is PENDING and no failure exists, show overall PENDING.
    return 'PENDING';
};

const normalizeStageId = (s: string) => (s || '').toUpperCase().replace(/[\s\-_]/g, '');

const isStageInRoute = (stage: { code: string; name: string; label: string }, trackData: any): boolean => {
    if (!trackData) return true;
    if (trackData.has_backend === false) return false;
    // 1. Authoritative: check backend-resolved active_route
    if (Array.isArray(trackData.active_route)) {
        const stageCodeNorm = normalizeStageId(stage.code);
        const stageNameNorm = normalizeStageId(stage.name);
        const stageLabelNorm = normalizeStageId(stage.label);

        return trackData.active_route.some((r: any) => {
            const rCodeNorm = normalizeStageId(r.stage_code);
            const rNameNorm = normalizeStageId(r.stage_name);
            return (
                rCodeNorm === stageCodeNorm ||
                rNameNorm === stageNameNorm ||
                rCodeNorm === stageLabelNorm ||
                rNameNorm === stageLabelNorm ||
                rCodeNorm === stageNameNorm ||
                rNameNorm === stageCodeNorm ||
                (stageCodeNorm === 'PTH' && (rCodeNorm === 'PRESOLDERING' || rNameNorm === 'PRESOLDERING')) ||
                (stageCodeNorm === 'QA' && (rCodeNorm === 'QUALITYASSURANCE' || rNameNorm === 'QUALITYASSURANCE')) ||
                (stageCodeNorm === 'VI' && (rCodeNorm === 'VISUALINSPECTION' || rNameNorm === 'VISUALINSPECTION')) ||
                (stageCodeNorm === 'QI' && (rCodeNorm === 'QUALITYINSPECTION' || rNameNorm === 'QUALITYINSPECTION')) ||
                (stageCodeNorm === 'PCBA_FCT' && (rCodeNorm === 'PCBAFCT' || rNameNorm === 'PCBAFCT')) ||
                (stageCodeNorm === 'UNIT_TESTING' && (rCodeNorm === 'UNITTESTING' || rNameNorm === 'UNITTESTING'))
            );
        });
    }

    // 2. Fallback: if active_route is undefined, inspect selected_stages
    if (trackData.selected_stages !== undefined) {
        // Legacy Work Order: NULL means default to all standard stages active
        if (trackData.selected_stages === null) {
            return true;
        }
        let list: any[] = [];
        if (Array.isArray(trackData.selected_stages)) {
            list = trackData.selected_stages;
        } else if (typeof trackData.selected_stages === 'string') {
            try {
                const parsed = JSON.parse(trackData.selected_stages);
                if (Array.isArray(parsed)) list = parsed;
            } catch {
                list = [];
            }
        }
        // If empty array [], it's an invalid configuration -> no stages active
        if (list.length === 0) {
            return false;
        }
        const stageCodeNorm = normalizeStageId(stage.code);
        const stageNameNorm = normalizeStageId(stage.name);
        const stageLabelNorm = normalizeStageId(stage.label);
        return list.some(item => {
            const itemStr = typeof item === 'string' ? item : (item?.stage_code || item?.stage_name || item?.stage_label || item?.code || item?.name || '');
            const itemNorm = normalizeStageId(itemStr);
            return (
                itemNorm === stageCodeNorm ||
                itemNorm === stageNameNorm ||
                itemNorm === stageLabelNorm ||
                (stageCodeNorm === 'PTH' && (itemNorm === 'PRESOLDERING' || itemNorm === 'PTH')) ||
                (stageCodeNorm === 'QA' && itemNorm === 'QUALITYASSURANCE') ||
                (stageCodeNorm === 'VI' && itemNorm === 'VISUALINSPECTION') ||
                (stageCodeNorm === 'QI' && itemNorm === 'QUALITYINSPECTION') ||
                (stageCodeNorm === 'PCBA_FCT' && itemNorm === 'PCBAFCT') ||
                (stageCodeNorm === 'UNIT_TESTING' && itemNorm === 'UNITTESTING')
            );
        });
    }

    // Default to true for legacy Work Orders where no stage route info exists
    return true;
};

const StatusBadge: React.FC<{ status: string; small?: boolean }> = ({ status, small }) => (
    <span className={styles.badge} style={{
        background: statusBg(status),
        color: statusColor(status),
        border: `1px solid ${statusColor(status)}33`,
        fontSize: small ? '0.65rem' : '0.75rem',
        padding: small ? '2px 8px' : '4px 12px',
    }}>
        {status.toUpperCase().replace(/_/g, ' ')}
    </span>
);

const StationIcon: React.FC<{ station: string }> = ({ station }) => {
    const s = station.toLowerCase();
    if (s === 'rework') return <RotateCcw size={16} />;
    if (s === 'debug') return <Wrench size={16} />;
    if (s === 'packing') return <Package size={16} />;
    return <Zap size={16} />;
};

// ─── Component ────────────────────────────────────────────────────────────────

const TrackItems: React.FC = () => {
    const { user } = useAuth();
    const [searchType, setSearchType] = useState<'serial' | 'wo'>('serial');
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<TrackResult | null>(null);
    const [woData, setWoData] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [appeared, setAppeared] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isDownloadingExcel, setIsDownloadingExcel] = useState(false);
    const [selectedPipelineView, setSelectedPipelineView] = useState<'backend' | 'smt'>('backend');

    // Filter State
    const [filterDate, setFilterDate] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [showFilter, setShowFilter] = useState(false);
    const [workOrdersList, setWorkOrdersList] = useState<string[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 50;

    const inputRef = useRef<HTMLInputElement>(null);
    const printRef = useRef<HTMLDivElement>(null);

    const backendSerialChunks = useMemo(() => {
        if (!woData || !woData.serials) return [];
        const list = woData.serials;
        if (list.length === 0) return [[]];
        const firstPageSize = 18;
        const otherPageSize = 24;
        const chunks: any[][] = [];
        if (list.length <= firstPageSize) {
            chunks.push(list);
        } else {
            chunks.push(list.slice(0, firstPageSize));
            let idx = firstPageSize;
            while (idx < list.length) {
                chunks.push(list.slice(idx, idx + otherPageSize));
                idx += otherPageSize;
            }
        }
        return chunks;
    }, [woData]);

    useEffect(() => {
        inputRef.current?.focus();

        const fetchWOs = async () => {
            try {
                const res = await apiFetch('/api/backend/work-order?all=true');
                const list = Array.isArray(res) ? res : (res?.data && Array.isArray(res.data) ? res.data : []);
                setWorkOrdersList(list.map((w: any) => w.wo_number || w.id));
            } catch (err) {
                console.error("Failed to load WOs", err);
            }
        };
        fetchWOs();
    }, []);

    // Silent Background Polling for Live Real-Time Updates
    useEffect(() => {
        if (!query || query.trim() === '') return;
        const intervalId = setInterval(async () => {
            try {
                const q = query.trim();
                if (!q) return;
                if (searchType === 'wo') {
                    const result = await apiFetch(`/api/backend/track/wo/${encodeURIComponent(q)}`);
                    setWoData(result);
                } else if (searchType === 'serial') {
                    const result = await apiFetch(`/api/backend/track/${encodeURIComponent(q)}`);
                    setData(result);
                }
            } catch (pollErr) {
                // Ignore silent polling failures
            }
        }, 5000);

        return () => clearInterval(intervalId);
    }, [query, searchType]);

    const handleSearch = async (e?: React.FormEvent, directQuery?: string, directSearchType?: 'serial' | 'wo') => {
        if (e) e.preventDefault();
        const q = (directQuery ?? query).trim();
        const type = directSearchType ?? searchType;
        if (!q) return;
        setLoading(true); setError(null); setData(null); setWoData(null); setAppeared(false); setCurrentPage(1);
        try {
            if (type === 'wo') {
                const result = await apiFetch(`/api/backend/track/wo/${encodeURIComponent(q)}`);
                setWoData(result);
            } else {
                const result = await apiFetch(`/api/backend/track/${encodeURIComponent(q)}`);
                setData(result);
            }
            setTimeout(() => setAppeared(true), 50);
        } catch (err: any) {
            setError(err.message || 'Item not found in system.');
        } finally {
            setLoading(false);
        }
    };

    const handleTrackSerial = (sn: string) => {
        setSearchType('serial');
        setQuery(sn);
        handleSearch(undefined, sn, 'serial');
    };

    const handleDownloadExcel = async () => {
        if (!data && (!woData || !woData.work_order_id)) return;
        try {
            setIsDownloadingExcel(true);
            const token = localStorage.getItem('token') || '';
            let url = '';
            let filename = '';
            if (woData && woData.work_order_id) {
                url = `/api/backend/track/wo/${encodeURIComponent(woData.work_order_id)}/export/excel`;
                filename = `Backend_WorkOrder_Report_${woData.work_order_id}.xlsx`;
            } else if (data && data.barcode) {
                url = `/api/backend/track/${encodeURIComponent(data.barcode)}/export/excel`;
                filename = `Backend_Serial_Traceability_${data.barcode}.xlsx`;
            }
            if (!url) return;

            const response = await fetch(url, {
                headers: {
                    'Authorization': token ? `Bearer ${token}` : ''
                }
            });
            if (!response.ok) {
                const errJson = await response.json().catch(() => ({}));
                throw new Error(errJson.error || 'Failed to generate Excel report');
            }
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            const contentDisposition = response.headers.get('Content-Disposition');
            if (contentDisposition) {
                const match = contentDisposition.match(/filename="?([^"]+)"?/);
                if (match && match[1]) filename = match[1];
            }
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(downloadUrl);
        } catch (err: any) {
            console.error("Excel download failed:", err);
            alert("Failed to download Excel report: " + err.message);
        } finally {
            setIsDownloadingExcel(false);
        }
    };



    const handleDownloadPdf = async () => {
        try {
            const input = printRef.current;

            if (!input) {
                console.error("Track content not found");
                return;
            }

            setIsDownloading(true);

            const pageBlocks = input.querySelectorAll<HTMLElement>('.pdf-page-block');

            if (pageBlocks.length > 0) {
                const pdf = new jsPDF("l", "mm", "a4");
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();

                for (let i = 0; i < pageBlocks.length; i++) {
                    if (i > 0) pdf.addPage();
                    const pageCanvas = await html2canvas(pageBlocks[i], {
                        scale: 2,
                        useCORS: true,
                        logging: false,
                        backgroundColor: "#ffffff"
                    });
                    const imgData = pageCanvas.toDataURL("image/png");
                    const imgHeight = (pageCanvas.height * pdfWidth) / pageCanvas.width;
                    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, Math.min(pdfHeight, imgHeight));
                }

                const fileName = data ? `Backend_Traceability_${data.barcode}.pdf` : `Backend_WorkOrder_${woData?.work_order_id}.pdf`;
                pdf.save(fileName);
            } else {
                const canvas = await html2canvas(input, {
                    scale: 2, // High-quality resolution
                    useCORS: true,
                    logging: false,
                    backgroundColor: "#ffffff"
                });

                const imgData = canvas.toDataURL("image/png");
                const isWoReport = !!woData;
                const pdf = new jsPDF(isWoReport ? "l" : "p", "mm", "a4");
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();
                const imgWidth = pdfWidth;
                const imgHeight = (canvas.height * imgWidth) / canvas.width;

                let heightLeft = imgHeight;
                let position = 0;

                // Page 1
                pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
                heightLeft -= pdfHeight;

                // Multi-page splitting logic
                while (heightLeft > 0) {
                    position = heightLeft - imgHeight;
                    pdf.addPage();
                    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
                    heightLeft -= pdfHeight;
                }

                const fileName = data ? `Backend_Traceability_${data.barcode}.pdf` : `Backend_WorkOrder_${woData?.work_order_id}.pdf`;
                pdf.save(fileName);
            }
        } catch (error) {
            console.error("PDF Download Failed:", error);
        } finally {
            setIsDownloading(false);
        }
    };

    const getStageStatus = (stage: { code: string; name: string; label: string }): string => {
        if (!data) return 'pending';

        // Check whether stage is in the Work Order's active route
        if (!isStageInRoute(stage, data)) {
            return 'SKIPPED';
        }

        // 1. Get all scan history entries for this stage
        const entries = data.scan_history.filter(h =>
            h.station === stage.name ||
            h.station === stage.code ||
            h.station === stage.label
        );

        const currentStageName = data.current_stage;
        const currentStatus = data.current_status?.toUpperCase();
        const isCurrent = currentStageName === stage.name || currentStageName === stage.code || currentStageName === stage.label;

        // 2. Check if the stage has successfully completed in the scan history
        const hasPassed = entries.some(e => e.status === 'ACCEPTED' || e.status === 'PASS');

        // 3. If the unit is currently in REWORK / DEBUG / FAILED
        if (currentStatus === 'REWORK' || currentStatus === 'DEBUG' || currentStatus === 'FAILED') {
            const failedStageName = data.failed_stage;
            const isFailedStage = failedStageName === stage.name || failedStageName === stage.code || failedStageName === stage.label;

            if (isFailedStage) {
                return currentStatus; // REWORK, DEBUG, or FAILED
            }
            if (hasPassed) {
                return 'ACCEPTED';
            }
            const stageIndex = PRODUCTION_PIPELINE.findIndex(s => s.code === stage.code);
            const failedStageIndex = PRODUCTION_PIPELINE.findIndex(s => s.code === failedStageName || s.name === failedStageName || s.label === failedStageName);
            if (stageIndex !== -1 && failedStageIndex !== -1 && stageIndex < failedStageIndex) {
                return 'ACCEPTED';
            }
            return 'pending';
        }

        // 4. If unit is currently in Rework or Debug queues (as current_stage)
        if (currentStageName === 'Rework' || currentStageName === 'Debug') {
            const failedStageName = data.failed_stage;
            const isFailedStage = failedStageName === stage.name || failedStageName === stage.code || failedStageName === stage.label;

            if (isFailedStage) {
                return currentStageName === 'Rework' ? 'REWORK' : 'DEBUG';
            }
            if (hasPassed) {
                return 'ACCEPTED';
            }
            const stageIndex = PRODUCTION_PIPELINE.findIndex(s => s.code === stage.code);
            const failedStageIndex = PRODUCTION_PIPELINE.findIndex(s => s.code === failedStageName || s.name === failedStageName || s.label === failedStageName);
            if (stageIndex !== -1 && failedStageIndex !== -1 && stageIndex < failedStageIndex) {
                return 'ACCEPTED';
            }
            return 'pending';
        }

        // 5. Normal workflow
        if (hasPassed) {
            if (isCurrent && currentStatus === 'PENDING') {
                return 'IN_PROGRESS';
            }
            return 'ACCEPTED';
        }

        if (isCurrent) {
            if (currentStatus === 'ACCEPTED' || currentStatus === 'COMPLETED') {
                return 'ACCEPTED';
            }
            return 'IN_PROGRESS';
        }

        const currentOrder = PRODUCTION_PIPELINE.findIndex(s => s.code === currentStageName || s.name === currentStageName || s.label === currentStageName);
        const stageIndex = PRODUCTION_PIPELINE.findIndex(s => s.code === stage.code);

        if (currentOrder !== -1 && stageIndex !== -1) {
            if (stageIndex < currentOrder) {
                return 'ACCEPTED';
            }
        }

        return 'pending';
    };

    const filteredSerials = (woData?.serials.filter((s: any) => {
        let matches = true;
        if (filterDate) {
            const sDate = s.created_at ? new Date(s.created_at).toISOString().split('T')[0] : '';
            if (sDate !== filterDate) matches = false;
        }
        if (filterStatus) {
            const finalStatus = s.final_status_label === 'Completed' ? 'COMPLETED' : 'PENDING';
            if (finalStatus !== filterStatus) matches = false;
        }
        return matches;
    }) || []).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    useEffect(() => {
        setCurrentPage(1);
    }, [filterDate, filterStatus]);

    const totalPages = Math.ceil(filteredSerials.length / ITEMS_PER_PAGE);
    const currentSerials = filteredSerials.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const completedCount = filteredSerials.filter((s: any) => s.final_status_label === 'Completed').length;
    const pendingCount = filteredSerials.length - completedCount;

    return (
        <div className={styles.page}>
            {/* ── Header ── */}
            <div className={styles.pageHeader}>
                <div className={styles.headerLeft}>
                    <div className={styles.headerIcon}><Activity size={28} /></div>
                    <div>
                        <h1 className={styles.headerTitle}>Barcode Traceability</h1>
                        <p className={styles.headerSub}>Complete production lifecycle visibility</p>
                    </div>
                </div>
                {(data || woData) && (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <button
                            type="button"
                            onClick={handleDownloadPdf}
                            disabled={isDownloading}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                background: '#3b82f6', color: '#fff', border: 'none',
                                padding: '8px 16px', borderRadius: '6px', fontWeight: 600,
                                cursor: isDownloading ? 'not-allowed' : 'pointer',
                                opacity: isDownloading ? 0.7 : 1,
                                transition: 'all 0.2s'
                            }}
                        >
                            <Download size={18} />
                            {isDownloading ? 'Generating PDF...' : 'PDF Report'}
                        </button>
                        <button
                            type="button"
                            onClick={handleDownloadExcel}
                            disabled={isDownloadingExcel}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                background: '#10b981', color: '#fff', border: 'none',
                                padding: '8px 16px', borderRadius: '6px', fontWeight: 600,
                                cursor: isDownloadingExcel ? 'not-allowed' : 'pointer',
                                opacity: isDownloadingExcel ? 0.7 : 1,
                                transition: 'all 0.2s'
                            }}
                        >
                            <Download size={18} />
                            {isDownloadingExcel ? 'Generating Excel...' : 'Excel Report'}
                        </button>
                    </div>
                )}
            </div>

            {/* ── Search ── */}
            <div className={styles.searchPanel}>
                <form onSubmit={handleSearch} className={styles.searchForm}>
                    <div className={styles.searchInputWrap} style={{ display: 'flex', gap: '0', padding: '0', border: 'none', background: 'transparent' }}>
                        <select
                            value={searchType}
                            onChange={(e) => setSearchType(e.target.value as 'serial' | 'wo')}
                            style={{
                                padding: '12px 16px',
                                border: '2px solid #e2e8f0',
                                borderRight: 'none',
                                borderRadius: '12px 0 0 12px',
                                background: '#f8fafc',
                                color: '#475569',
                                fontWeight: 600,
                                fontSize: '14px',
                                outline: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <option value="serial">Barcode / Serial Number</option>
                            <option value="wo">Work Order</option>
                        </select>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <Search className={styles.searchLeadIcon} size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            {searchType === 'serial' ? (
                                <input
                                    ref={inputRef}
                                    style={{
                                        width: '100%',
                                        padding: '16px 16px 16px 48px',
                                        border: '2px solid #e2e8f0',
                                        borderRadius: '0 12px 12px 0',
                                        fontSize: '15px',
                                        outline: 'none',
                                        color: '#1e293b'
                                    }}
                                    placeholder="Scan or enter Barcode or Serial Number…"
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                />
                            ) : (
                                <select
                                    style={{
                                        width: '100%',
                                        padding: '16px 16px 16px 48px',
                                        border: '2px solid #e2e8f0',
                                        borderRadius: '0 12px 12px 0',
                                        fontSize: '15px',
                                        outline: 'none',
                                        color: '#1e293b',
                                        appearance: 'none',
                                        background: '#fff'
                                    }}
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                >
                                    <option value="">-- Select Work Order --</option>
                                    {workOrdersList.map(wo => (
                                        <option key={wo} value={wo}>{wo}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>
                    <button type="submit" className={styles.searchBtn} disabled={loading || (searchType === 'wo' && !query)}>
                        {loading ? (
                            <span className={styles.spinner} />
                        ) : (
                            <><Search size={16} /> Track</>
                        )}
                    </button>
                </form>
            </div>

            {/* ── Error ── */}
            {error && (
                <div className={styles.errorBox}>
                    <AlertTriangle size={18} />
                    <span>{error}</span>
                </div>
            )}

            {/* ── Results ── */}
            {data && (
                <>
                    <div className={`${styles.resultsWrap} ${appeared ? styles.revealed : ''}`} style={{ padding: '20px', background: '#fff', borderRadius: '12px' }}>

                        {/* ── Summary Cards Row ── */}
                        <div className={styles.summaryRow}>
                            <div className={styles.summaryCard}>
                                <div className={styles.summaryIcon} style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>
                                    <Package size={22} />
                                </div>
                                <div>
                                    <div className={styles.summaryLabel}>PCB Barcode</div>
                                    <div className={styles.summaryValue}>{data.barcode}</div>
                                </div>
                            </div>
                            {data.unit_serial_number && (
                                <div className={styles.summaryCard}>
                                    <div className={styles.summaryIcon} style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>
                                        <Package size={22} />
                                    </div>
                                    <div>
                                        <div className={styles.summaryLabel}>Unit Serial No</div>
                                        <div className={styles.summaryValue} style={{ color: '#22c55e' }}>{data.unit_serial_number}</div>
                                    </div>
                                </div>
                            )}
                            <div className={styles.summaryCard}>
                                <div className={styles.summaryIcon} style={{ background: 'rgba(139,92,246,0.12)', color: '#8b5cf6' }}>
                                    <FileText size={22} />
                                </div>
                                <div>
                                    <div className={styles.summaryLabel}>Work Order</div>
                                    <div className={styles.summaryValue} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {data.wo_number}
                                        {data.wo_number && data.wo_number !== '-' && (
                                            <button
                                                onClick={() => {
                                                    setSearchType('wo');
                                                    setQuery(data.wo_number);
                                                    handleSearch(undefined, data.wo_number, 'wo');
                                                }}
                                                title="Track this Work Order"
                                                style={{
                                                    background: '#f8fafc', border: '1px solid #cbd5e1',
                                                    borderRadius: '4px', cursor: 'pointer', padding: '4px',
                                                    display: 'flex', alignItems: 'center', color: '#3b82f6',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
                                                onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
                                            >
                                                <Search size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className={styles.summaryCard}>
                                <div className={styles.summaryIcon} style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
                                    <TrendingUp size={22} />
                                </div>
                                <div>
                                    <div className={styles.summaryLabel}>Model</div>
                                    <div className={styles.summaryValue}>{data.model}</div>
                                </div>
                            </div>
                            <div className={styles.summaryCard}>
                                <div className={styles.summaryIcon} style={{ background: statusBg(data.current_status), color: statusColor(data.current_status) }}>
                                    <MapPin size={22} />
                                </div>
                                <div>
                                    <div className={styles.summaryLabel}>Current Stage</div>
                                    <div className={styles.summaryValue}>{data.current_stage}</div>
                                </div>
                            </div>
                            <div className={styles.summaryCard}>
                                <div className={styles.summaryIcon} style={{ background: statusBg(data.current_status), color: statusColor(data.current_status) }}>
                                    <Activity size={22} />
                                </div>
                                <div>
                                    <div className={styles.summaryLabel}>Status</div>
                                    <StatusBadge status={data.current_status} />
                                </div>
                            </div>
                            <div className={styles.summaryCard}>
                                <div className={styles.summaryIcon} style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}>
                                    <Layers size={22} />
                                </div>
                                <div>
                                    <div className={styles.summaryLabel}>Process Selection</div>
                                    <div className={styles.summaryValue}>
                                        <span style={{
                                            background: 'rgba(99,102,241,0.12)',
                                            color: '#6366f1',
                                            border: '1px solid rgba(99,102,241,0.3)',
                                            borderRadius: '9999px',
                                            padding: '2px 10px',
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            letterSpacing: '0.03em',
                                            display: 'inline-block'
                                        }}>
                                            {data.has_smt && data.has_backend ? 'SMT + Backend' : data.has_smt ? 'SMT' : 'Backend'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── Stats Row ── */}
                        <div className={styles.statsRow}>
                            <div className={styles.statPill} style={{ '--c': '#ef4444' } as React.CSSProperties}>
                                <span className={styles.statNum}>{data.total_failures}</span>
                                <span className={styles.statLbl}>Total Failures</span>
                            </div>
                            <div className={styles.statPill} style={{ '--c': '#f59e0b' } as React.CSSProperties}>
                                <span className={styles.statNum}>{data.total_reworks}</span>
                                <span className={styles.statLbl}>Rework Repairs</span>
                            </div>
                            <div className={styles.statPill} style={{ '--c': '#ef4444' } as React.CSSProperties}>
                                <span className={styles.statNum}>{data.total_debugs}</span>
                                <span className={styles.statLbl}>Debug Repairs</span>
                            </div>
                            <div className={styles.finalStatus} style={{ background: statusBg(data.current_status), borderColor: `${statusColor(data.current_status)}44`, color: statusColor(data.current_status) }}>
                                <Zap size={16} />
                                {data.final_status_label}
                            </div>
                        </div>

                        {/* ── Main two-column layout ── */}
                        <div className={styles.mainGrid}>

                            {/* LEFT: Pipeline Flow */}
                            <div className={styles.pipelinePanel}>
                                <div style={{ marginBottom: '1.25rem', borderBottom: '2px solid #f1f5f9', paddingBottom: '0.875rem' }}>
                                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                        <ChevronRight size={18} /> Production Pipeline
                                    </h3>
                                    {(data.has_smt && data.has_backend) && (
                                        <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '8px', marginTop: '10px', border: '1px solid #e2e8f0' }}>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedPipelineView('backend')}
                                                style={{
                                                    flex: 1,
                                                    padding: '6px 10px',
                                                    fontSize: '11px',
                                                    fontWeight: 700,
                                                    borderRadius: '6px',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    background: selectedPipelineView === 'backend' ? '#3b82f6' : 'transparent',
                                                    color: selectedPipelineView === 'backend' ? '#ffffff' : '#64748b',
                                                    boxShadow: selectedPipelineView === 'backend' ? '0 1px 3px rgba(59,130,246,0.3)' : 'none',
                                                    transition: 'all 0.2s',
                                                    textAlign: 'center'
                                                }}
                                            >
                                                Backend Pipeline
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedPipelineView('smt')}
                                                style={{
                                                    flex: 1,
                                                    padding: '6px 10px',
                                                    fontSize: '11px',
                                                    fontWeight: 700,
                                                    borderRadius: '6px',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    background: selectedPipelineView === 'smt' ? '#3b82f6' : 'transparent',
                                                    color: selectedPipelineView === 'smt' ? '#ffffff' : '#64748b',
                                                    boxShadow: selectedPipelineView === 'smt' ? '0 1px 3px rgba(59,130,246,0.3)' : 'none',
                                                    transition: 'all 0.2s',
                                                    textAlign: 'center'
                                                }}
                                            >
                                                SMT Pipeline
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {selectedPipelineView === 'smt' ? (
                                    <div className={styles.pipeline}>
                                        {SMT_PIPELINE_STAGES.map((stage, idx) => {
                                            const smtHistory = data.smt_scan_history || [];
                                            const entries = smtHistory.filter((h: any) => h.process_step === stage);
                                            const resolvedStatus = data.smt_statuses?.[stage];
                                            const visited = entries.length > 0 || (resolvedStatus && resolvedStatus !== 'PENDING' && resolvedStatus !== 'N/A');
                                            const stStatus = visited ? (entries.length > 0 ? entries[entries.length - 1].status : resolvedStatus || 'pending') : (resolvedStatus || 'pending');
                                            const color = visited ? statusColor(stStatus) : '#cbd5e1';
                                            const isLast = idx === SMT_PIPELINE_STAGES.length - 1;

                                            return (
                                                <React.Fragment key={stage}>
                                                    <div className={styles.pipelineNode}>
                                                        <div className={styles.pipelineNodeDot} style={{ background: color, boxShadow: `0 0 0 4px ${color}22` }}>
                                                            <Zap size={16} />
                                                        </div>
                                                        <div className={styles.pipelineNodeLabel} style={{ color: visited ? '#1e293b' : '#94a3b8' }}>
                                                            {stage}
                                                        </div>
                                                        {visited ? (
                                                            <StatusBadge status={stStatus} small />
                                                        ) : (
                                                            <span className={styles.pendingTag}>{stage === 'Rework' ? 'NA' : 'Pending'}</span>
                                                        )}
                                                        {entries.length > 1 && <span className={styles.rescannedTag}>×{entries.length} scans</span>}
                                                    </div>
                                                    {!isLast && <div className={styles.pipelineConnector}><ArrowDown size={14} /></div>}
                                                </React.Fragment>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className={styles.pipeline}>
                                        {/* Work Order node */}
                                        <div className={styles.pipelineNode}>
                                            <div className={styles.pipelineNodeDot} style={{ background: '#3b82f6', boxShadow: '0 0 0 4px rgba(59,130,246,0.2)' }}>
                                                <Package size={14} />
                                            </div>
                                            <div className={styles.pipelineNodeLabel}>Work Order</div>
                                            <StatusBadge status="ACCEPTED" small />
                                        </div>
                                        <div className={styles.pipelineConnector}><ArrowDown size={14} /></div>

                                        {PRODUCTION_PIPELINE.map((stage, idx) => {
                                            const stStatus = getStageStatus(stage);
                                            const isSkipped = stStatus === 'SKIPPED';
                                            const isCurrent = !isSkipped && stStatus === 'IN_PROGRESS';
                                            const visited = !isSkipped && stStatus !== 'pending';
                                            const color = statusColor(stStatus);
                                            const entries = data.scan_history.filter(h =>
                                                h.station === stage.name ||
                                                h.station === stage.code ||
                                                h.station === stage.label
                                            );
                                            const isLast = idx === PRODUCTION_PIPELINE.length - 1;

                                            return (
                                                <React.Fragment key={stage.code}>
                                                    <div className={`${styles.pipelineNode} ${isCurrent ? styles.pipelineNodeActive : ''} ${isSkipped ? styles.pipelineNodeSkipped : ''}`}>
                                                        <div className={styles.pipelineNodeDot} style={{
                                                            background: isSkipped ? '#f1f5f9' : color,
                                                            color: isSkipped ? '#94a3b8' : '#ffffff',
                                                            border: isSkipped ? '1px dashed #cbd5e1' : 'none',
                                                            boxShadow: isCurrent
                                                                ? `0 0 0 6px ${color}33, 0 0 20px ${color}44`
                                                                : (isSkipped ? 'none' : `0 0 0 4px ${color}22`),
                                                        }}>
                                                            <StationIcon station={stage.code} />
                                                        </div>
                                                        <div className={styles.pipelineNodeLabel} style={{ color: isSkipped ? '#94a3b8' : (visited ? '#1e293b' : '#94a3b8') }}>
                                                            {stage.label}
                                                            {isCurrent && <span className={styles.liveTag}>LIVE</span>}
                                                        </div>
                                                        {isSkipped ? (
                                                            <span style={{ fontSize: '9px', background: 'rgba(148,163,184,0.12)', color: '#94a3b8', border: '1px solid #cbd5e133', padding: '2px 8px', borderRadius: '9999px', fontWeight: 700 }}>N/A</span>
                                                        ) : visited ? (
                                                            <StatusBadge status={stStatus} small />
                                                        ) : (
                                                            <span className={styles.pendingTag}>Pending</span>
                                                        )}
                                                        {entries.length > 1 && !isSkipped && (
                                                            <span className={styles.rescannedTag}>×{entries.length} scans</span>
                                                        )}
                                                    </div>

                                                    {/* Repair branch nodes */}
                                                    {!isSkipped && entries.some(e => e.status === 'REWORK') && (() => {
                                                        const isActive = data.current_stage === 'Rework';
                                                        return (
                                                            <div className={styles.repairBranch}>
                                                                <div className={styles.branchLine} />
                                                                <div className={styles.branchNode} style={{
                                                                    background: isActive ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.08)',
                                                                    borderColor: isActive ? '#f59e0b' : '#10b98144'
                                                                }}>
                                                                    <RotateCcw size={12} style={{ color: isActive ? '#f59e0b' : '#10b981' }} />
                                                                    <span style={{ color: isActive ? '#f59e0b' : '#10b981', fontWeight: 700 }}>
                                                                        {isActive ? 'REWORK (ACTIVE)' : 'REWORK (PASSED)'}
                                                                    </span>
                                                                    <span style={{ color: '#64748b', fontSize: '0.7rem' }}>
                                                                        {isActive ? 'in repair queue' : 'repaired'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}

                                                    {!isSkipped && entries.some(e => e.status === 'DEBUG') && (() => {
                                                        const isActive = data.current_stage === 'Debug';
                                                        return (
                                                            <div className={styles.repairBranch}>
                                                                <div className={styles.branchLine} />
                                                                <div className={styles.branchNode} style={{
                                                                    background: isActive ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.08)',
                                                                    borderColor: isActive ? '#ef4444' : '#10b98144'
                                                                }}>
                                                                    <Wrench size={12} style={{ color: isActive ? '#ef4444' : '#10b981' }} />
                                                                    <span style={{ color: isActive ? '#ef4444' : '#10b981', fontWeight: 700 }}>
                                                                        {isActive ? 'DEBUG (ACTIVE)' : 'DEBUG (PASSED)'}
                                                                    </span>
                                                                    <span style={{ color: '#64748b', fontSize: '0.7rem' }}>
                                                                        {isActive ? 'in debug queue' : 'repaired'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}

                                                    {!isLast && <div className={styles.pipelineConnector}><ArrowDown size={14} /></div>}
                                                </React.Fragment>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Lifecycle Timestamps */}
                                <div className={styles.lifecycleBox}>
                                    <h4 className={styles.lifecycleTitle}>Repair Lifecycle Timestamps</h4>
                                    <div className={styles.lifecycleGrid}>
                                        <div className={styles.lifecycleItem}>
                                            <AlertTriangle size={14} style={{ color: '#ef4444' }} />
                                            <div>
                                                <div className={styles.lifecycleLabel}>Failure Detected</div>
                                                <div className={styles.lifecycleVal}>{fmt(data.failure_created_at)}</div>
                                            </div>
                                        </div>
                                        <div className={styles.lifecycleItem}>
                                            <Wrench size={14} style={{ color: '#f59e0b' }} />
                                            <div>
                                                <div className={styles.lifecycleLabel}>Repair Completed</div>
                                                <div className={styles.lifecycleVal}>{fmt(data.repair_completed_at)}</div>
                                            </div>
                                        </div>
                                        <div className={styles.lifecycleItem}>
                                            <CheckCircle size={14} style={{ color: '#10b981' }} />
                                            <div>
                                                <div className={styles.lifecycleLabel}>Revalidated & Passed</div>
                                                <div className={styles.lifecycleVal}>{fmt(data.revalidated_passed_at)}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT: Timeline */}
                            <div className={styles.timelinePanel}>
                                <h3 className={styles.panelTitle}><Clock size={18} /> Full Event Timeline</h3>

                                {data.scan_history.length === 0 ? (
                                    <div className={styles.emptyTimeline}>
                                        <Clock size={40} />
                                        <p>No scan events recorded yet.</p>
                                    </div>
                                ) : (
                                    <div className={styles.timeline}>
                                        {data.scan_history.map((entry, idx) => {
                                            const isRepair = entry.station === 'Rework' || entry.station === 'Debug';
                                            const color = statusColor(entry.status);
                                            return (
                                                <div
                                                    key={idx}
                                                    className={`${styles.timelineItem} ${isRepair ? styles.timelineRepair : ''}`}
                                                    style={{ '--c': color } as React.CSSProperties}
                                                >
                                                    <div className={styles.timelineDot} style={{ background: color, boxShadow: `0 0 0 4px ${color}22` }}>
                                                        <StationIcon station={entry.station} />
                                                    </div>

                                                    <div className={styles.timelineCard}>
                                                        <div className={styles.timelineCardHeader}>
                                                            <div className={styles.timelineCardTitle}>
                                                                <span className={styles.timelineStation}>{entry.station}</span>
                                                                <StatusBadge status={entry.status} small />
                                                            </div>
                                                            <div className={styles.timelineCardTime}>
                                                                <Calendar size={12} />
                                                                {fmt(entry.scanned_at)}
                                                            </div>
                                                        </div>

                                                        <div className={styles.timelineCardBody}>
                                                            <div className={styles.timelineDetail}>
                                                                <User size={12} />
                                                                <span><strong>Operator:</strong> {entry.scanned_by}</span>
                                                            </div>

                                                            {entry.remarks && (
                                                                <div className={styles.timelineDetail}>
                                                                    <FileText size={12} />
                                                                    <span><strong>Failure Remark:</strong> {entry.remarks}</span>
                                                                </div>
                                                            )}

                                                            {entry.failed_remarks && entry.failed_remarks !== '-' && (
                                                                <div className={styles.timelineDetail}>
                                                                    <AlertTriangle size={12} style={{ color: '#ef4444' }} />
                                                                    <span><strong>Original Failure:</strong> {entry.failed_remarks}</span>
                                                                </div>
                                                            )}

                                                            {entry.repair_remark && (
                                                                <div className={`${styles.timelineDetail} ${styles.repairDetail}`}>
                                                                    <Wrench size={12} style={{ color: '#10b981' }} />
                                                                    <span><strong>Repair Note:</strong> {entry.repair_remark}</span>
                                                                </div>
                                                            )}



                                                            {entry.resolution_remarks && entry.resolution_remarks !== 'Fixed' && (
                                                                <div className={styles.timelineDetail}>
                                                                    <CheckCircle size={12} style={{ color: '#10b981' }} />
                                                                    <span><strong>Resolution:</strong> {entry.resolution_remarks}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── Audit Table ── */}
                        <div className={styles.auditPanel}>
                            <h3 className={styles.panelTitle}><Activity size={18} /> Full Audit Log (SMT + Backend)</h3>
                            <div className={styles.tableWrap}>
                                {(() => {
                                    const backendRows = (data.scan_history || []).map((row: ScanEntry) => ({
                                        station: row.station,
                                        status: row.status,
                                        scanned_by: row.scanned_by,
                                        scanned_at: row.scanned_at,
                                        remarks: row.remarks,
                                        repair_remark: row.repair_remark,
                                        source: 'Backend',
                                    }));
                                    const smtRows = (data.smt_scan_history || []).map((h: any) => ({
                                        station: h.process_step || '-',
                                        status: h.status || '-',
                                        scanned_by: h.scanned_by || '-',
                                        scanned_at: h.scanned_at,
                                        remarks: h.rework_reason || null,
                                        repair_remark: null,
                                        source: 'SMT',
                                    }));
                                    const combined = [...smtRows, ...backendRows].sort(
                                        (a, b) => new Date(a.scanned_at).getTime() - new Date(b.scanned_at).getTime()
                                    );
                                    return (
                                        <table className={styles.auditTable}>
                                            <thead>
                                                <tr>
                                                    <th>#</th>
                                                    <th>Source</th>
                                                    <th>Stage</th>
                                                    <th>Action</th>
                                                    <th>Operator</th>
                                                    <th>Date &amp; Time</th>
                                                    <th>Failure Remark</th>
                                                    <th>Repair Note</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {combined.length === 0 ? (
                                                    <tr><td colSpan={8} className={styles.emptyRow}>No records.</td></tr>
                                                ) : combined.map((row, idx) => (
                                                    <tr key={idx} className={row.station === 'Rework' || row.station === 'Debug' ? styles.repairRow : ''}>
                                                        <td className={styles.auditIdx}>{idx + 1}</td>
                                                        <td><span style={{ fontSize: '9px', background: row.source === 'SMT' ? 'rgba(59,130,246,0.12)' : 'rgba(16,185,129,0.12)', color: row.source === 'SMT' ? '#3b82f6' : '#10b981', border: `1px solid ${row.source === 'SMT' ? '#3b82f633' : '#10b98133'}`, padding: '2px 6px', borderRadius: '3px', fontWeight: 700 }}>{row.source}</span></td>
                                                        <td><strong>{row.station}</strong></td>
                                                        <td><StatusBadge status={row.status} small /></td>
                                                        <td>{row.scanned_by}</td>
                                                        <td className={styles.auditTime}>{fmt(row.scanned_at)}</td>
                                                        <td className={styles.remarkCell}>{row.remarks || '—'}</td>
                                                        <td className={styles.remarkCell}>{row.repair_remark || '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* ── WO Results ── */}
            {woData && (
                <>
                    <div className={`${styles.resultsWrap} ${appeared ? styles.revealed : ''}`} style={{ padding: '20px', background: '#fff', borderRadius: '12px' }}>

                        {/* Summary for WO */}
                        <div className={styles.summaryRow}>
                            <div className={styles.summaryCard}>
                                <div className={styles.summaryIcon} style={{ background: 'rgba(139,92,246,0.12)', color: '#8b5cf6' }}>
                                    <FileText size={22} />
                                </div>
                                <div>
                                    <div className={styles.summaryLabel}>Work Order</div>
                                    <div className={styles.summaryValue}>{woData.work_order_id}</div>
                                </div>
                            </div>
                            <div className={styles.summaryCard}>
                                <div className={styles.summaryIcon} style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
                                    <TrendingUp size={22} />
                                </div>
                                <div>
                                    <div className={styles.summaryLabel}>Product</div>
                                    <div className={styles.summaryValue}>{woData.product_name}</div>
                                </div>
                            </div>
                            <div className={styles.summaryCard}>
                                <div className={styles.summaryIcon} style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>
                                    <Package size={22} />
                                </div>
                                <div>
                                    <div className={styles.summaryLabel}>Total Serials</div>
                                    <div className={styles.summaryValue}>{woData.total_serials} / {woData.quantity}</div>
                                </div>
                            </div>
                        </div>

                        <div className={styles.historyPanel} style={{ marginTop: '20px' }}>
                            <h3 className={styles.panelTitle} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Package size={18} /> Work Order Serials ({filteredSerials.length})
                                </span>
                                <span style={{ fontSize: '13px', color: '#166534', background: '#dcfce7', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                                    Completed: {completedCount}
                                </span>
                                <span style={{ fontSize: '13px', color: '#92400e', background: '#fef3c7', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                                    Pending: {pendingCount}
                                </span>
                                <button
                                    type="button"
                                    onClick={handleDownloadExcel}
                                    disabled={isDownloadingExcel}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        background: '#16a34a', color: '#ffffff', border: 'none',
                                        padding: '6px 14px', borderRadius: '6px', fontWeight: 600,
                                        fontSize: '12px', cursor: isDownloadingExcel ? 'not-allowed' : 'pointer',
                                        opacity: isDownloadingExcel ? 0.7 : 1, transition: 'all 0.2s',
                                        marginLeft: 'auto'
                                    }}
                                >
                                    <Download size={14} />
                                    {isDownloadingExcel ? 'Exporting...' : 'Export Excel'}
                                </button>
                            </h3>
                            <div className={styles.tableContainer}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                                    <thead style={{ background: '#1e293b', color: '#ffffff' }}>
                                        <tr>
                                            <th style={{ padding: '12px 16px', fontWeight: 600, position: 'relative' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    Serial Number Barcode
                                                    <button onClick={() => setShowFilter(!showFilter)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}>
                                                        <Filter size={14} color={(filterDate || filterStatus) ? '#60a5fa' : '#cbd5e1'} />
                                                    </button>
                                                </div>
                                                {showFilter && (
                                                    <div style={{ position: 'absolute', top: '100%', left: '16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', zIndex: 50, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)', width: '200px', color: '#1e293b' }}>
                                                        <div style={{ marginBottom: '8px' }}>
                                                            <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Date</label>
                                                            <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} style={{ width: '100%', padding: '4px', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
                                                        </div>
                                                        <div style={{ marginBottom: '12px' }}>
                                                            <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Status</label>
                                                            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ width: '100%', padding: '4px', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
                                                                <option value="">All</option>
                                                                <option value="COMPLETED">Completed</option>
                                                                <option value="PENDING">Pending</option>
                                                            </select>
                                                        </div>
                                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                                            <button onClick={() => { setFilterDate(''); setFilterStatus(''); }} style={{ background: 'transparent', border: 'none', fontSize: '11px', color: '#ef4444', cursor: 'pointer' }}>Clear</button>
                                                            <button onClick={() => setShowFilter(false)} style={{ background: '#f1f5f9', border: 'none', fontSize: '11px', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>Close</button>
                                                        </div>
                                                    </div>
                                                )}
                                            </th>
                                            {PRODUCTION_PIPELINE.map((step: any) => (
                                                <th key={step.code} style={{ padding: '12px 16px', fontWeight: 600 }}>{step.label}</th>
                                            ))}
                                            <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {currentSerials.map((s: any, idx: number) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.2s' }}>
                                                <td style={{ padding: '12px 16px', fontWeight: 600, color: '#334155' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                                        {s.serial_number}
                                                        <button
                                                            onClick={() => handleTrackSerial(s.serial_number)}
                                                            title="Track this Serial Number"
                                                            style={{
                                                                background: '#f8fafc', border: '1px solid #cbd5e1',
                                                                borderRadius: '4px', cursor: 'pointer', padding: '4px',
                                                                display: 'flex', alignItems: 'center', color: '#3b82f6',
                                                                transition: 'all 0.2s'
                                                            }}
                                                            onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
                                                            onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
                                                        >
                                                            <Search size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                                {PRODUCTION_PIPELINE.map((step: any) => {
                                                    const inRoute = isStageInRoute(step, (s.active_route || s.selected_stages) ? s : woData);
                                                    let stStatus = 'Pending';
                                                    if (!inRoute) {
                                                        stStatus = 'N/A';
                                                    } else {
                                                        stStatus = s.step_status ? (s.step_status[step.code] || s.step_status[step.name] || s.step_status[step.label] || 'Pending') : 'Pending';
                                                    }
                                                    return (
                                                        <td key={step.code} style={{ padding: '12px 16px' }}>
                                                            <StatusBadge status={stStatus} small />
                                                        </td>
                                                    );
                                                })}
                                                <td style={{ padding: '12px 16px' }}>
                                                    <span style={{
                                                        fontSize: '10px',
                                                        background: s.final_status_label === 'Completed' ? '#dcfce7' : '#fef3c7',
                                                        border: `1px solid ${s.final_status_label === 'Completed' ? '#86efac' : '#fde68a'}`,
                                                        padding: '4px 8px',
                                                        borderRadius: '4px',
                                                        color: s.final_status_label === 'Completed' ? '#166534' : '#92400e',
                                                        fontWeight: 600
                                                    }}>
                                                        {s.final_status_label === 'Completed' ? 'COMPLETED' : 'PENDING'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {filteredSerials.length === 0 && (
                                    <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                                        No serial numbers match the selected filters.
                                    </div>
                                )}
                            </div>

                            {totalPages > 1 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', padding: '0 16px' }}>
                                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                                        Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredSerials.length)} of {filteredSerials.length} entries
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                            disabled={currentPage === 1}
                                            style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #cbd5e1', background: currentPage === 1 ? '#f8fafc' : '#fff', color: currentPage === 1 ? '#94a3b8' : '#334155', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 600 }}
                                        >
                                            Previous
                                        </button>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px', fontSize: '12px', fontWeight: 600, color: '#334155', background: '#f1f5f9', borderRadius: '4px' }}>
                                            Page {currentPage} of {totalPages}
                                        </div>
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                            disabled={currentPage === totalPages}
                                            style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #cbd5e1', background: currentPage === totalPages ? '#f8fafc' : '#fff', color: currentPage === totalPages ? '#94a3b8' : '#334155', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 600 }}
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                    </div>
                </>
            )}

            {/* Dedicated Hidden Printable PDF Section */}
            {(data || woData) && (
                <div
                    ref={printRef}
                    id="hidden-pdf-report"
                    style={{
                        position: 'absolute',
                        left: '-9999px',
                        top: '-9999px',
                        width: woData ? '1400px' : '1150px',
                        background: '#ffffff',
                        padding: woData ? '0px' : '40px',
                        color: '#1e293b',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        boxSizing: 'border-box'
                    }}
                >
                    {/* PDF Header Logo / Title */}
                    <div style={{ borderBottom: '2px solid #3b82f6', paddingBottom: '15px', marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '20px', color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Velankani Software MES
                            </h2>
                            <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                                {data ? 'PCB BARCODE TRACEABILITY AUDIT REPORT' : 'WORK ORDER TRACEABILITY REPORT'}
                            </p>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '10px', color: '#64748b' }}>
                            <div>Report Date: {new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}</div>
                            <div>Generated By: {user?.name || 'Operator'}</div>
                        </div>
                    </div>

                    {data && (
                        <>
                            {/* PDF Metadata Grid (PCB Barcode, Work Order, Model, Current Stage) */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '12px 24px',
                                marginBottom: '30px',
                                background: '#f8fafc',
                                padding: '16px',
                                borderRadius: '8px',
                                border: '1px solid #e2e8f0',
                                fontSize: '12px'
                            }}>
                                <div>
                                    <span style={{ color: '#64748b', fontWeight: 600, display: 'inline-block', width: '120px' }}>PCB Barcode</span>
                                    <span style={{ color: '#0f172a', fontWeight: 700 }}>: {data.barcode}</span>
                                </div>
                                <div>
                                    <span style={{ color: '#64748b', fontWeight: 600, display: 'inline-block', width: '120px' }}>Work Order</span>
                                    <span style={{ color: '#0f172a', fontWeight: 700 }}>: {data.wo_number}</span>
                                </div>
                                <div>
                                    <span style={{ color: '#64748b', fontWeight: 600, display: 'inline-block', width: '120px' }}>Model</span>
                                    <span style={{ color: '#0f172a', fontWeight: 700 }}>: {data.model}</span>
                                </div>
                                <div>
                                    <span style={{ color: '#64748b', fontWeight: 600, display: 'inline-block', width: '120px' }}>Current Stage</span>
                                    <span style={{ color: '#0f172a', fontWeight: 700 }}>: {data.current_stage}</span>
                                </div>
                                <div>
                                    <span style={{ color: '#64748b', fontWeight: 600, display: 'inline-block', width: '120px' }}>Current Status</span>
                                    <span style={{ color: '#0f172a', fontWeight: 700 }}>: {(data.current_status || 'PENDING').toUpperCase()}</span>
                                </div>
                                {data.unit_serial_number && (
                                    <div style={{ gridColumn: 'span 2' }}>
                                        <span style={{ color: '#64748b', fontWeight: 600, display: 'inline-block', width: '120px' }}>Unit Serial Number</span>
                                        <span style={{ color: '#16a34a', fontWeight: 700 }}>: {data.unit_serial_number}</span>
                                    </div>
                                )}
                            </div>

                            {/* SMT Stage Traceability Summary */}
                            {data.has_smt !== false && (
                                <div style={{ marginBottom: '24px' }}>
                                    <h3 style={{ fontSize: '14px', color: '#0f172a', margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        SMT Stage Traceability Summary
                                    </h3>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                                        <thead>
                                            <tr style={{ background: '#0f766e', color: '#ffffff' }}>
                                                <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>SMT Stage</th>
                                                <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1', textAlign: 'center' }}>TOP Side Status</th>
                                                <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1', textAlign: 'center' }}>BOTTOM Side Status</th>
                                                <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1', textAlign: 'center' }}>Overall Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {SMT_STAGES.map((stage: string, sIdx: number) => {
                                                const isSmtFg = stage === 'SMT FG';
                                                const isRework = stage === 'Rework';
                                                let topStatus = data.smt_top?.[stage] || data.step_status_top?.[stage];
                                                let btmStatus = isSmtFg ? 'N/A' : (data.smt_bottom?.[stage] || data.step_status_bottom?.[stage]);

                                                if (data.has_smt === false) {
                                                    topStatus = 'N/A';
                                                    btmStatus = 'N/A';
                                                } else if (data.is_double_sided) {
                                                    if (!topStatus || topStatus === '-') topStatus = isRework ? 'N/A' : 'PENDING';
                                                    if (!btmStatus || btmStatus === '-') btmStatus = (isSmtFg || isRework) ? 'N/A' : 'PENDING';
                                                } else {
                                                    const isBottomOnly = data.is_bottom_only || String(data.sides || '').trim().toLowerCase().includes('bottom');
                                                    const rawVal = data.smt_statuses?.[stage] || data.step_status?.[stage];
                                                    if (isSmtFg) {
                                                        topStatus = rawVal && rawVal !== '-' ? rawVal : 'PENDING';
                                                        btmStatus = 'N/A';
                                                    } else if (isRework) {
                                                        if (isBottomOnly) {
                                                            topStatus = 'N/A';
                                                            btmStatus = rawVal && rawVal !== '-' && rawVal !== 'PENDING' ? rawVal : 'N/A';
                                                        } else {
                                                            topStatus = rawVal && rawVal !== '-' && rawVal !== 'PENDING' ? rawVal : 'N/A';
                                                            btmStatus = 'N/A';
                                                        }
                                                    } else if (isBottomOnly) {
                                                        topStatus = 'N/A';
                                                        btmStatus = rawVal && rawVal !== '-' ? rawVal : 'PENDING';
                                                    } else {
                                                        topStatus = rawVal && rawVal !== '-' ? rawVal : 'PENDING';
                                                        btmStatus = 'N/A';
                                                    }
                                                }
                                                const overallStatus = computeOverallStageStatus(topStatus, btmStatus);
                                                return (
                                                    <tr key={stage} style={{ background: sIdx % 2 === 0 ? '#ffffff' : '#f8fafc', color: '#1e293b' }}>
                                                        <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', fontWeight: 700 }}>{stage}</td>
                                                        <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                                                            <span style={{ fontWeight: 700, color: statusColor(topStatus) }}>{topStatus}</span>
                                                        </td>
                                                        <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                                                            <span style={{ fontWeight: 700, color: statusColor(btmStatus) }}>{btmStatus}</span>
                                                        </td>
                                                        <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                                                            <span style={{ fontWeight: 700, color: statusColor(overallStatus) }}>{overallStatus}</span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Backend Stage Traceability Summary */}
                            <div style={{ marginBottom: '24px' }}>
                                <h3 style={{ fontSize: '14px', color: '#0f172a', margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Backend Stage Traceability Summary
                                </h3>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                                    <thead>
                                        <tr style={{ background: '#1e3a8a', color: '#ffffff' }}>
                                            <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>Backend Stage</th>
                                            <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1', textAlign: 'center' }}>Applicability</th>
                                            <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1', textAlign: 'center' }}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {PRODUCTION_PIPELINE.map((stage, pIdx) => {
                                            const inRoute = isStageInRoute(stage, data);
                                            let bStatus = 'PENDING';
                                            if (!inRoute) {
                                                bStatus = 'N/A';
                                            } else {
                                                const cNorm = normalizeStageId(stage.code);
                                                const nNorm = normalizeStageId(stage.name);
                                                const lNorm = normalizeStageId(stage.label);
                                                const hist = (data.scan_history || []).filter((h: any) => {
                                                    const sNorm = normalizeStageId(h.station || '');
                                                    return sNorm === cNorm || sNorm === nNorm || sNorm === lNorm ||
                                                        (cNorm === 'PTH' && sNorm === 'PRESOLDERING') ||
                                                        (cNorm === 'QA' && sNorm === 'QUALITYASSURANCE') ||
                                                        (cNorm === 'VI' && sNorm === 'VISUALINSPECTION') ||
                                                        (cNorm === 'QI' && sNorm === 'QUALITYINSPECTION') ||
                                                        (cNorm === 'PCBA_FCT' && sNorm === 'PCBAFCT') ||
                                                        (cNorm === 'UNIT_TESTING' && sNorm === 'UNITTESTING');
                                                });
                                                if (hist.length > 0) {
                                                    const last = hist[hist.length - 1];
                                                    const rawSt = (last.status || '').toUpperCase();
                                                    bStatus = (rawSt === 'ACCEPTED' || rawSt === 'PASS') ? 'PASS' : (rawSt === 'FAIL' || rawSt === 'FAILED') ? 'FAIL' : (rawSt === 'REWORK' || rawSt === 'DEBUG') ? 'REWORK' : rawSt;
                                                } else {
                                                    bStatus = 'PENDING';
                                                }
                                            }
                                            return (
                                                <tr key={stage.code} style={{ background: pIdx % 2 === 0 ? '#ffffff' : '#f8fafc', color: '#1e293b' }}>
                                                    <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', fontWeight: 700 }}>{stage.name} ({stage.label})</td>
                                                    <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 600, color: inRoute ? '#0f766e' : '#94a3b8' }}>{inRoute ? 'APPLICABLE' : 'N/A'}</td>
                                                    <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                                                        <span style={{ fontWeight: 700, color: statusColor(bStatus) }}>{bStatus}</span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Table Title */}
                            <h3 style={{ fontSize: '14px', color: '#0f172a', margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Traceability Scan History (Audit Log)
                            </h3>

                            {/* Audit Log Table */}
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ background: '#1e3a8a', color: '#ffffff' }}>
                                        <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1', width: '30px' }}>#</th>
                                        <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1', width: '60px' }}>Source</th>
                                        <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1', width: '80px' }}>Stage</th>
                                        <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1', width: '80px' }}>Action</th>
                                        <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1', width: '90px' }}>Operator</th>
                                        <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1', width: '120px' }}>Date &amp; Time</th>
                                        <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>Remarks / Failure</th>
                                        <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>Repair Note</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(() => {
                                        const backendRows = (data.scan_history || []).map((row: ScanEntry) => ({
                                            station: row.station,
                                            status: row.status,
                                            scanned_by: row.scanned_by,
                                            scanned_at: row.scanned_at,
                                            remarks: row.remarks || row.failed_remarks || null,
                                            repair_remark: row.repair_remark || null,
                                            source: 'Backend',
                                        }));
                                        const smtRows = (data.smt_scan_history || []).map((h: any) => ({
                                            station: h.process_step || '-',
                                            status: h.status || '-',
                                            scanned_by: h.scanned_by || '-',
                                            scanned_at: h.scanned_at,
                                            remarks: h.rework_reason || null,
                                            repair_remark: null,
                                            source: 'SMT',
                                        }));
                                        const combined = [...smtRows, ...backendRows].sort(
                                            (a, b) => new Date(a.scanned_at).getTime() - new Date(b.scanned_at).getTime()
                                        );
                                        return combined.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} style={{ padding: '12px', textAlign: 'center', color: '#64748b', border: '1px solid #cbd5e1' }}>No scan events recorded yet.</td>
                                            </tr>
                                        ) : combined.map((row, idx) => {
                                            const isRepair = row.station === 'Rework' || row.station === 'Debug';
                                            return (
                                                <tr key={idx} style={{ background: isRepair ? '#fffbeb' : idx % 2 === 0 ? '#ffffff' : '#f8fafc', color: '#1e293b' }}>
                                                    <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', fontWeight: 600, textAlign: 'center' }}>{idx + 1}</td>
                                                    <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', fontWeight: 700, color: row.source === 'SMT' ? '#3b82f6' : '#10b981' }}>{row.source}</td>
                                                    <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', fontWeight: 700 }}>{row.station}</td>
                                                    <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>
                                                        <span style={{ display: 'inline-block', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, fontSize: '9px', background: statusBg(row.status), color: statusColor(row.status), border: `1px solid ${statusColor(row.status)}33` }}>{row.status.toUpperCase()}</span>
                                                    </td>
                                                    <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>{row.scanned_by}</td>
                                                    <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', whiteSpace: 'nowrap' }}>{fmt(row.scanned_at)}</td>
                                                    <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', wordBreak: 'break-word' }}>{row.remarks || '—'}</td>
                                                    <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', wordBreak: 'break-word' }}>{row.repair_remark || '—'}</td>
                                                </tr>
                                            );
                                        });
                                    })()}
                                </tbody>
                            </table>
                        </>
                    )}

                    {woData && (
                        <div>
                            {backendSerialChunks.map((chunk: any[], pageIdx: number) => {
                                const isFirstPage = pageIdx === 0;
                                const totalSerialsCount = woData.total_serials || (woData.serials && woData.serials.length) || 0;
                                return (
                                    <div
                                        key={pageIdx}
                                        className="pdf-page-block"
                                        style={{
                                            width: '1400px',
                                            height: '990px',
                                            maxHeight: '990px',
                                            boxSizing: 'border-box',
                                            padding: '24px 30px',
                                            background: '#ffffff',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'space-between',
                                            fontFamily: 'system-ui, -apple-system, sans-serif',
                                            color: '#1e293b',
                                            overflow: 'hidden'
                                        }}
                                    >
                                        <div>
                                            {/* Header */}
                                            {isFirstPage ? (
                                                <>
                                                    <div style={{ borderBottom: '2px solid #3b82f6', paddingBottom: '12px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div>
                                                            <h2 style={{ margin: 0, fontSize: '18px', color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                                Velankani Software MES
                                                            </h2>
                                                            <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                                                                BACKEND WORK ORDER TRACEABILITY AUDIT REPORT
                                                            </p>
                                                        </div>
                                                        <div style={{ textAlign: 'right', fontSize: '10px', color: '#64748b' }}>
                                                            <div>Report Date: {new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}</div>
                                                            <div>Generated By: {user?.name || 'Operator'}</div>
                                                        </div>
                                                    </div>

                                                    {/* Metadata Grid */}
                                                    <div style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: 'repeat(4, 1fr)',
                                                        gap: '8px 16px',
                                                        marginBottom: '16px',
                                                        background: '#f8fafc',
                                                        padding: '12px 16px',
                                                        borderRadius: '8px',
                                                        border: '1px solid #e2e8f0',
                                                        fontSize: '11px'
                                                    }}>
                                                        <div>
                                                            <span style={{ color: '#64748b', fontWeight: 600 }}>Work Order: </span>
                                                            <span style={{ color: '#0f172a', fontWeight: 700 }}>{woData.work_order_id}</span>
                                                        </div>
                                                        <div>
                                                            <span style={{ color: '#64748b', fontWeight: 600 }}>Customer: </span>
                                                            <span style={{ color: '#0f172a', fontWeight: 700 }}>{woData.customer_name || '-'}</span>
                                                        </div>
                                                        <div>
                                                            <span style={{ color: '#64748b', fontWeight: 600 }}>Model: </span>
                                                            <span style={{ color: '#0f172a', fontWeight: 700 }}>{woData.model || '-'}</span>
                                                        </div>
                                                        <div>
                                                            <span style={{ color: '#64748b', fontWeight: 600 }}>Product: </span>
                                                            <span style={{ color: '#0f172a', fontWeight: 700 }}>{woData.product_name || '-'}</span>
                                                        </div>
                                                        <div>
                                                            <span style={{ color: '#64748b', fontWeight: 600 }}>Line ID: </span>
                                                            <span style={{ color: '#0f172a', fontWeight: 700 }}>{woData.line_id || '-'}</span>
                                                        </div>
                                                        <div>
                                                            <span style={{ color: '#64748b', fontWeight: 600 }}>Sides: </span>
                                                            <span style={{ color: '#0f172a', fontWeight: 700 }}>{woData.sides || '-'}</span>
                                                        </div>
                                                        <div>
                                                            <span style={{ color: '#64748b', fontWeight: 600 }}>Process: </span>
                                                            <span style={{ color: '#0f172a', fontWeight: 700 }}>{woData.has_smt && woData.has_backend ? 'SMT + Backend' : woData.has_smt ? 'SMT' : 'Backend'}</span>
                                                        </div>
                                                        <div>
                                                            <span style={{ color: '#64748b', fontWeight: 600 }}>Total Serials: </span>
                                                            <span style={{ color: '#0f172a', fontWeight: 700 }}>{totalSerialsCount} / {woData.quantity}</span>
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <div style={{ borderBottom: '2px solid #3b82f6', paddingBottom: '8px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e3a8a' }}>
                                                            BACKEND WORK ORDER TRACEABILITY REPORT — {woData.work_order_id}
                                                        </span>
                                                    </div>
                                                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>
                                                        Page {pageIdx + 1} of {backendSerialChunks.length}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Table */}
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8.5px', textAlign: 'left', tableLayout: 'auto' }}>
                                                <thead>
                                                    <tr style={{ background: '#1e3a8a', color: '#ffffff' }}>
                                                        <th style={{ padding: '5px 4px', border: '1px solid #cbd5e1', width: '30px', textAlign: 'center' }}>#</th>
                                                        <th style={{ padding: '5px 6px', border: '1px solid #cbd5e1', width: '130px' }}>Serial Number</th>
                                                        <th style={{ padding: '5px 6px', border: '1px solid #cbd5e1', width: '110px' }}>Unit Serial</th>
                                                        <th style={{ padding: '5px 6px', border: '1px solid #cbd5e1', width: '85px' }}>Current Stage</th>
                                                        {woData.has_smt !== false && (
                                                            SMT_STAGES.map((step: string) => (
                                                                <th key={step} style={{ padding: '5px 4px', border: '1px solid #cbd5e1', background: '#1e4db7', textAlign: 'center' }}>{`SMT: ${step}`}</th>
                                                            ))
                                                        )}
                                                        {PRODUCTION_PIPELINE.map((step: any) => (
                                                            <th key={step.code} style={{ padding: '5px 4px', border: '1px solid #cbd5e1', textAlign: 'center' }}>{step.label}</th>
                                                        ))}
                                                        <th style={{ padding: '5px 6px', border: '1px solid #cbd5e1', width: '70px', textAlign: 'center' }}>Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {chunk.map((s: any, idxInChunk: number) => {
                                                        const globalIdx = isFirstPage ? idxInChunk : 18 + (pageIdx - 1) * 24 + idxInChunk;
                                                        return (
                                                            <tr key={globalIdx} style={{ background: globalIdx % 2 === 0 ? '#ffffff' : '#f8fafc', color: '#1e293b' }}>
                                                                <td style={{ padding: '4px 3px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 600 }}>{globalIdx + 1}</td>
                                                                <td style={{ padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 700 }}>{s.serial_number}</td>
                                                                <td style={{ padding: '4px 6px', border: '1px solid #cbd5e1', color: s.unit_serial_number ? '#166534' : '#64748b', fontWeight: s.unit_serial_number ? 700 : 400 }}>{s.unit_serial_number || '—'}</td>
                                                                <td style={{ padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 600 }}>{s.current_stage || 'Pending'}</td>
                                                                {woData.has_smt !== false && (
                                                                    SMT_STAGES.map((step: string) => {
                                                                        const isSmtFg = step === 'SMT FG';
                                                                        const isRework = step === 'Rework';
                                                                        let topVal = getSmtStepStatus(s.smt_step_status_top || s.smt_top || s.step_status_top, step);
                                                                        let btmVal = isSmtFg ? 'N/A' : getSmtStepStatus(s.smt_step_status_bottom || s.smt_bottom || s.step_status_bottom, step);

                                                                        let cellText = '';
                                                                        if (woData.is_double_sided) {
                                                                            if (!topVal || topVal === '-' || topVal === 'PENDING') topVal = isRework ? 'N/A' : 'PENDING';
                                                                            if (!btmVal || btmVal === '-' || btmVal === 'PENDING') btmVal = (isSmtFg || isRework) ? 'N/A' : 'PENDING';

                                                                            if (isRework && (topVal === 'N/A' || topVal === '-') && (btmVal === 'N/A' || btmVal === '-')) {
                                                                                cellText = 'N/A';
                                                                            } else if (isSmtFg) {
                                                                                cellText = `TOP: ${topVal}, BOTTOM: N/A`;
                                                                            } else {
                                                                                cellText = `TOP: ${topVal}, BOTTOM: ${btmVal}`;
                                                                            }
                                                                        } else {
                                                                            const isBottomOnly = woData.is_bottom_only || String(woData.sides || '').trim().toLowerCase().includes('bottom');
                                                                            let stVal = s.smt_statuses?.[step] || s.step_status?.[step] || (isBottomOnly ? btmVal : topVal);
                                                                            if (isRework && (!stVal || stVal === '-' || stVal === 'PENDING')) stVal = 'N/A';
                                                                            if (!stVal || stVal === '-') stVal = 'PENDING';

                                                                            if (isBottomOnly) {
                                                                                if (isRework && (stVal === 'N/A' || stVal === '-')) cellText = 'N/A';
                                                                                else cellText = `BOTTOM: ${stVal}`;
                                                                            } else {
                                                                                if (isRework && (stVal === 'N/A' || stVal === '-')) cellText = 'N/A';
                                                                                else cellText = `TOP: ${stVal}`;
                                                                            }
                                                                        }

                                                                        return (
                                                                            <td key={step} style={{ padding: '4px 3px', border: '1px solid #cbd5e1', fontSize: '8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                                                <span style={{ color: statusColor(cellText), fontWeight: 700 }}>
                                                                                    {cellText}
                                                                                </span>
                                                                            </td>
                                                                        );
                                                                    })
                                                                )}
                                                                {PRODUCTION_PIPELINE.map((step: any) => {
                                                                    const inRoute = isStageInRoute(step, woData);
                                                                    let val = 'PENDING';
                                                                    if (!inRoute) {
                                                                        val = 'N/A';
                                                                    } else {
                                                                        val = s.step_status ? (s.step_status[step.code] || s.step_status[step.name] || s.step_status[step.label] || 'PENDING') : 'PENDING';
                                                                        val = String(val).toUpperCase();
                                                                    }
                                                                    return (
                                                                        <td key={step.code} style={{ padding: '4px 3px', border: '1px solid #cbd5e1', fontSize: '8px', textAlign: 'center' }}>
                                                                            <span style={{ color: statusColor(val), fontWeight: 700 }}>
                                                                                {val}
                                                                            </span>
                                                                        </td>
                                                                    );
                                                                })}
                                                                <td style={{ padding: '4px 4px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 700, color: s.final_status_label === 'Completed' ? '#16a34a' : '#d97706' }}>
                                                                    {s.final_status_label === 'Completed' ? 'COMPLETED' : 'PENDING'}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Page Footer */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #cbd5e1', paddingTop: '6px', fontSize: '8.5px', color: '#64748b' }}>
                                            <span>This report is an official computer-generated audit log from the Velankani Software MES.</span>
                                            <span style={{ fontWeight: 700 }}>Page {pageIdx + 1} of {backendSerialChunks.length}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default TrackItems;
