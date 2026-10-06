import React, { useState, useRef, useEffect, useMemo } from 'react';
import { apiFetch } from '../../../utils/api';
import styles from './SmtTrackItems.module.css';
import {
    Search, Package, AlertTriangle,
    Clock, Activity, Zap, ArrowDown, RotateCcw, ChevronRight,
    FileText, TrendingUp, Download, Cpu, MapPin, Filter, Eye, Layers
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../../components/Toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScanEntry {
    id: number;
    process_step: string;
    status: string;
    scanned_by: string;
    scanned_at: string;
    rework_reason: string | null;
    side: string | null;
}

interface SmtTrackResult {
    serial_number: string;
    serial_format: string;
    work_order_id: string;
    product_name: string;
    customer_name?: string;
    model_name?: string;
    quantity: number;
    line_id: string;
    sides: string;
    is_double_sided?: boolean;
    has_smt?: boolean;
    has_backend?: boolean;
    selected_stages?: any;
    current_stage: string;
    current_status: string;
    final_status_label: string;
    created_at: string;
    total_failures: number;
    total_reworks: number;
    total_passed: number;
    step_status_top?: Record<string, string>;
    step_status_bottom?: Record<string, string>;
    scan_history: ScanEntry[];
    backend_scan_history?: any[];
    backend_stages?: any[];
    combined_history?: any[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const isTopBottomWo = (sides: string | null | undefined): boolean => {
    if (!sides) return false;
    const s = sides.toLowerCase().trim();
    return s.includes('+') || s.includes('/') || s.includes('both') || (s.includes('top') && s.includes('bottom'));
};

const PROCESS_COLUMNS = ['Printing', 'SPI', 'Pre AOI', 'Post AOI', 'Rework', 'SMT FG', 'Status'];

const SMT_PIPELINE = ['Serial Number', 'Printing', 'SPI', 'Pre AOI', 'Post AOI', 'Rework', 'SMT FG'];

const BACKEND_PIPELINE = [
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

const STAGE_ROUTES: Record<string, string> = {
    'Serial Number': '/smt/serial-number',
    'Printing': '/smt/printing',
    'SPI': '/smt/spi',
    'Pre AOI': '/smt/pre-aoi',
    'Post AOI': '/smt/post-aoi',
    'Rework': '/smt/rework',
    'SMT FG': '/smt/smt-fg',
};

// ─── Backend Stage Helpers ─────────────────────────────────────────────────────

const normalizeStageId = (s: string) => (s || '').toUpperCase().replace(/[\s\-_]/g, '');

const isBackendStageSelected = (stage: { code: string; name: string; label: string }, selectedStages: any): boolean => {
    if (selectedStages === null || selectedStages === undefined) return true; // legacy: treat as all selected
    let list: any[] = [];
    if (Array.isArray(selectedStages)) {
        list = selectedStages;
    } else if (typeof selectedStages === 'string') {
        try { list = JSON.parse(selectedStages); } catch { list = []; }
    }
    if (list.length === 0) return false;
    const codeNorm = normalizeStageId(stage.code);
    const nameNorm = normalizeStageId(stage.name);
    const labelNorm = normalizeStageId(stage.label);
    return list.some((item: any) => {
        const s = typeof item === 'string' ? item : (item?.stage_code || item?.stage_name || '');
        const sNorm = normalizeStageId(s);
        return sNorm === codeNorm || sNorm === nameNorm || sNorm === labelNorm;
    });
};

const getProcessSelectionText = (d: any): string => {
    if (!d) return '—';
    const hasSmt = d.has_smt !== false;
    let hasBackend = d.has_backend === true;

    if (!hasBackend && d.selected_stages) {
        if (Array.isArray(d.selected_stages) && d.selected_stages.length > 0) {
            hasBackend = true;
        } else if (typeof d.selected_stages === 'string' && d.selected_stages.trim() !== '' && d.selected_stages !== '[]') {
            hasBackend = true;
        }
    }
    if (!hasBackend && d.backend_scan_history && d.backend_scan_history.length > 0) {
        hasBackend = true;
    }
    if (!hasBackend && d.backend_stages && d.backend_stages.some((s: any) => s.is_selected)) {
        hasBackend = true;
    }

    if (hasSmt && hasBackend) return 'SMT + Backend';
    if (hasSmt) return 'SMT';
    if (hasBackend) return 'Backend';
    return '—';
};

const normalizeStatus = (status: string): string => {
    switch ((status || '').toUpperCase()) {
        case 'ACCEPTED': return 'PASS';
        case 'PASS': return 'PASS';
        case 'FAILED': return 'FAIL';
        case 'FAIL': return 'FAIL';
        case 'REWORK': return 'REWORK';
        case 'RESOLVED': return 'RESOLVED';
        default: return (status || '').toUpperCase();
    }
};

const fmt = (ts: string | null | undefined) =>
    ts ? new Date(ts).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' }) : '—';

const statusColor = (s: string): string => {
    switch (s.toUpperCase()) {
        case 'PASS': return '#10b981';
        case 'REWORK': return '#f59e0b';
        case 'FAIL': return '#ef4444';
        default: return '#94a3b8';
    }
};

const statusBg = (s: string): string => {
    switch (s.toUpperCase()) {
        case 'PASS': return 'rgba(16,185,129,0.12)';
        case 'REWORK': return 'rgba(245,158,11,0.12)';
        case 'FAIL': return 'rgba(239,68,68,0.12)';
        default: return 'rgba(148,163,184,0.12)';
    }
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

const DualSideStatusBadge: React.FC<{
    topStatus?: string;
    bottomStatus?: string;
    small?: boolean;
    style?: React.CSSProperties;
    hideBottom?: boolean;
}> = ({ topStatus = 'PENDING', bottomStatus = 'PENDING', small = false, style, hideBottom = false }) => {
    const normTop = normalizeStatus(topStatus || 'PENDING');
    const normBottom = normalizeStatus(bottomStatus || 'PENDING');

    const renderSide = (label: 'TOP' | 'BOTTOM', status: string, isTop: boolean) => {
        const color = statusColor(status);
        const bg = statusBg(status);
        const isNa = status === '-' || status === 'NA';
        const displayStatus = isNa ? status : status.toUpperCase().replace(/_/g, ' ');

        return (
            <div
                style={{
                    background: bg,
                    padding: small ? '3px 8px' : '6px 12px',
                    borderBottom: isTop && !hideBottom ? '1px solid rgba(148, 163, 184, 0.25)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    justifyContent: 'center',
                    gap: '1px',
                }}
            >
                <div
                    style={{
                        fontSize: small ? '0.62rem' : '0.68rem',
                        fontWeight: 800,
                        letterSpacing: '0.05em',
                        color: '#475569',
                        lineHeight: 1.1,
                    }}
                >
                    {label}
                </div>
                <div
                    style={{
                        fontSize: small ? '0.68rem' : '0.75rem',
                        fontWeight: 700,
                        color: color,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        lineHeight: 1.2,
                    }}
                >
                    {!isNa && (
                        <span
                            style={{
                                width: small ? '5px' : '6px',
                                height: small ? '5px' : '6px',
                                borderRadius: '50%',
                                background: color,
                                display: 'inline-block',
                                flexShrink: 0,
                            }}
                        />
                    )}
                    <span>{displayStatus}</span>
                </div>
            </div>
        );
    };

    return (
        <div
            style={{
                display: 'inline-flex',
                flexDirection: 'column',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                overflow: 'hidden',
                background: '#ffffff',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                minWidth: small ? '84px' : '100px',
                textAlign: 'left',
                ...style,
            }}
        >
            {renderSide('TOP', normTop, true)}
            {!hideBottom && renderSide('BOTTOM', normBottom, false)}
        </div>
    );
};

const resolveDoubleSideStage = (
    stage: string,
    topStatus?: string,
    bottomStatus?: string,
    isPostAoiPassed?: boolean
) => {
    const isSmtFg = stage === 'SMT FG';
    const hideBottom = isSmtFg && (isPostAoiPassed || topStatus === 'PASS');
    const top = isSmtFg && (isPostAoiPassed || topStatus === 'PASS') && topStatus !== 'FAIL' ? 'PASS' : (topStatus || 'PENDING');
    return { top, bottom: bottomStatus || 'PENDING', hideBottom };
};

const StationIcon: React.FC<{ station: string }> = ({ station }) => {
    const s = station.toLowerCase();
    if (s === 'rework') return <RotateCcw size={16} />;
    if (s === 'printing') return <Cpu size={16} />;
    if (s === 'spi') return <Eye size={16} />;
    return <Zap size={16} />;
};

// ─── Component ────────────────────────────────────────────────────────────────

const SmtTrackItems: React.FC = () => {
    const [query, setQuery] = useState('');
    const [searchType, setSearchType] = useState<'serial' | 'wo'>('serial');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<SmtTrackResult | null>(null);
    const [woData, setWoData] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [appeared, setAppeared] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [selectedPipelineView, setSelectedPipelineView] = useState<'smt' | 'backend'>('smt');

    const navigate = useNavigate();
    const { showToast } = useToast();

    // Filter State
    const [filterDate, setFilterDate] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [showFilter, setShowFilter] = useState(false);
    const [workOrdersList, setWorkOrdersList] = useState<string[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [serialSearch, setSerialSearch] = useState('');
    const ITEMS_PER_PAGE = 50;

    const inputRef = useRef<HTMLInputElement>(null);
    const printRef = useRef<HTMLDivElement>(null);
    const searchRequestIdRef = useRef<number>(0);

    useEffect(() => {
        inputRef.current?.focus();

        const fetchWOs = async () => {
            try {
                const res = await apiFetch('/api/smt/work-orders');
                if (Array.isArray(res)) {
                    setWorkOrdersList(res.map((w: any) => w.id));
                }
            } catch (err) {
                console.error("Failed to load WOs", err);
            }
        };
        fetchWOs();
    }, []);

    const handleSearch = async (e?: React.FormEvent, directQuery?: string, directSearchType?: 'serial' | 'wo') => {
        if (e) e.preventDefault();
        const q = (directQuery ?? query).trim();
        const type = directSearchType ?? searchType;
        if (!q) return;

        const currentRequestId = ++searchRequestIdRef.current;

        setLoading(true); setError(null); setData(null); setAppeared(false);
        if (type !== 'wo') {
            setWoData(null);
            setCurrentPage(1);
        }
        try {
            if (type === 'wo') {
                const params = new URLSearchParams({
                    page: currentPage.toString(),
                    limit: ITEMS_PER_PAGE.toString(),
                    search: debouncedSerialSearch,
                    filterDate,
                    filterStatus
                });
                const result = await apiFetch(`/api/smt/track/wo/${encodeURIComponent(q)}?${params.toString()}`);
                if (currentRequestId === searchRequestIdRef.current) {
                    setWoData(result);
                }
            } else {
                const result: SmtTrackResult = await apiFetch(`/api/smt/track/${encodeURIComponent(q)}`);
                if (currentRequestId === searchRequestIdRef.current) {
                    setData(result);
                }
            }
            if (currentRequestId === searchRequestIdRef.current) {
                setTimeout(() => setAppeared(true), 50);
            }
        } catch (err: any) {
            if (currentRequestId === searchRequestIdRef.current) {
                setError(err.message || 'Item not found in system.');
            }
        } finally {
            if (currentRequestId === searchRequestIdRef.current) {
                setLoading(false);
            }
        }
    };

    const handleTrackSerial = (sn: string) => {
        setSearchType('serial');
        setQuery(sn);
        handleSearch(undefined, sn, 'serial');
    };

    const handleTrackWorkOrder = (wo: string) => {
        setSearchType('wo');
        setQuery(wo);
        handleSearch(undefined, wo, 'wo');
    };

    const handleDownloadPdf = async () => {
        const input = printRef.current;
        if (!input) return;

        try {
            setIsDownloading(true);

            const canvas = await html2canvas(input, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: "#ffffff"
            });

            const imgData = canvas.toDataURL("image/png");
            const pdf = new jsPDF("p", "mm", "a4");
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = pdfWidth;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
            heightLeft -= pdfHeight;

            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
                heightLeft -= pdfHeight;
            }

            const fileName = data ? `SMT_Traceability_${data.serial_number}.pdf` : `SMT_WorkOrder_${woData?.work_order_id}.pdf`;
            pdf.save(fileName);
        } catch (error) {
            console.error("PDF Download Failed:", error);
        } finally {
            setIsDownloading(false);
        }
    };

    const isDoubleSided = Boolean(data?.is_double_sided ?? isTopBottomWo(data?.sides));
    const isWoDoubleSided = Boolean(woData?.is_double_sided ?? isTopBottomWo(woData?.sides));

    const visitedStages = new Set(data?.scan_history.map(h => h.process_step) ?? []);

    const getStageStatus = (stageName: string): string => {
        const stpNorm = stageName.toUpperCase().replace(/[\s_]/g, '');
        const entries = (data?.scan_history || []).filter(h => {
            const hStep = (h.process_step || '').toUpperCase().replace(/[\s_]/g, '');
            return hStep === stpNorm;
        });
        if (!entries.length) {
            return stageName.toUpperCase() === 'REWORK' ? '-' : 'PENDING';
        }
        return normalizeStatus(entries[entries.length - 1].status);
    };

    const getStageStatusForSide = (stageName: string, side: 'Top' | 'Bottom'): string => {
        const sideKey = side.toLowerCase();
        const stpNorm = stageName.toUpperCase().replace(/[\s_]/g, '');

        // 1. Check if backend returned step_status_top or step_status_bottom
        if (sideKey === 'top' && data?.step_status_top?.[stageName]) {
            return normalizeStatus(data.step_status_top[stageName]);
        }
        if (sideKey === 'bottom' && data?.step_status_bottom?.[stageName]) {
            return normalizeStatus(data.step_status_bottom[stageName]);
        }

        // 2. Fall back to scan_history
        const entries = (data?.scan_history || []).filter(h => {
            const hStep = (h.process_step || '').toUpperCase().replace(/[\s_]/g, '');
            const hSide = (h.side || '').toUpperCase();
            return hStep === stpNorm && hSide === side.toUpperCase();
        });

        if (!entries.length) {
            return stageName.toUpperCase() === 'REWORK' ? '-' : 'PENDING';
        }
        return normalizeStatus(entries[entries.length - 1].status);
    };

    const isPostAoiPassed = useMemo(() => {
        if (!isDoubleSided) return false;
        return getStageStatusForSide('Post AOI', 'Top') === 'PASS' ||
            getStageStatusForSide('Post AOI', 'Bottom') === 'PASS' ||
            getStageStatus('Post AOI') === 'PASS';
    }, [data, isDoubleSided]);

    const overallStatusLabel = useMemo(() => {
        if (!data) return 'PENDING';

        const rawFinal = (data.final_status_label || '').toUpperCase();
        if (rawFinal === 'COMPLETED') return 'COMPLETED';
        if (rawFinal === 'FAILED') return 'FAILED';
        if (rawFinal === 'IN REWORK' || rawFinal === 'REWORK') return 'IN REWORK';

        if (isDoubleSided) {
            let topFg = getStageStatusForSide('SMT FG', 'Top');
            if (isPostAoiPassed && topFg !== 'FAIL') topFg = 'PASS';

            const activeCols = ['Printing', 'SPI', 'Pre AOI', 'Post AOI', 'Rework'];
            const anyFail = activeCols.some(c =>
                getStageStatusForSide(c, 'Top') === 'FAIL' || getStageStatusForSide(c, 'Bottom') === 'FAIL'
            ) || topFg === 'FAIL';
            const anyRework = activeCols.some(c =>
                getStageStatusForSide(c, 'Top') === 'REWORK' || getStageStatusForSide(c, 'Bottom') === 'REWORK'
            ) || topFg === 'REWORK';

            if (anyRework) return 'IN REWORK';
            if (anyFail) return 'FAILED';
            if (topFg === 'PASS') return 'COMPLETED';
            return 'IN PROGRESS';
        } else {
            const smtFg = getStageStatus('SMT FG');
            const activeCols = ['Printing', 'SPI', 'Pre AOI', 'Post AOI', 'Rework', 'SMT FG'];
            const anyFail = activeCols.some(c => getStageStatus(c) === 'FAIL');
            const anyRework = activeCols.some(c => getStageStatus(c) === 'REWORK');

            if (anyRework) return 'IN REWORK';
            if (anyFail) return 'FAILED';
            if (smtFg === 'PASS') return 'COMPLETED';
            return 'IN PROGRESS';
        }
    }, [data, isDoubleSided, isPostAoiPassed]);

    const overallCurrentStatus = useMemo(() => {
        if (overallStatusLabel === 'COMPLETED') return 'PASS';
        if (overallStatusLabel === 'FAILED') return 'FAIL';
        if (overallStatusLabel === 'IN REWORK') return 'REWORK';
        return 'PENDING';
    }, [overallStatusLabel]);

    const isCurrentStage = (stageName: string) => data?.current_stage === stageName;

    const [debouncedSerialSearch, setDebouncedSerialSearch] = useState('');

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSerialSearch(serialSearch);
            setCurrentPage(1);
        }, 300);
        return () => clearTimeout(handler);
    }, [serialSearch]);

    useEffect(() => {
        if (searchType === 'wo' && query) {
            handleSearch(undefined, query, 'wo');
        }
    }, [currentPage, debouncedSerialSearch, filterDate, filterStatus]);

    const totalPages = woData ? Math.ceil(woData.total_filtered / ITEMS_PER_PAGE) : 0;
    const currentSerials = woData?.serials || [];

    const [isExporting, setIsExporting] = useState(false);

    const handleDownloadExcel = async () => {
        const serialNo = data?.serial_number;
        const woId = woData?.work_order_id;
        if (!serialNo && !woId) return;
        setIsExporting(true);
        try {
            const endpoint = serialNo
                ? `/api/smt/track/export/serial/${encodeURIComponent(serialNo)}`
                : `/api/smt/track/export/wo/${encodeURIComponent(woId!)}`;
            const blob = await apiFetch(endpoint) as Blob;
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;

            const now = new Date();
            const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-');
            const fileName = serialNo
                ? `SMT_Serial_Traceability_${serialNo.replace(/[^a-zA-Z0-9_-]/g, '_')}_${timestamp}.xlsx`
                : `SMT_WorkOrder_Report_${woId!.replace(/[^a-zA-Z0-9_-]/g, '_')}_${timestamp}.xlsx`;

            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            showToast('Excel report downloaded successfully!', 'success');
        } catch (error: any) {
            console.error('Export error:', error);
            showToast(error.message || 'Failed to export Excel report', 'error');
        } finally {
            setIsExporting(false);
        }
    };

    const completedCount = woData?.completed_count || 0;
    const pendingCount = woData?.pending_count || 0;

    const combinedHistory = useMemo(() => {
        if (!data) return [];
        if (data.combined_history && Array.isArray(data.combined_history) && data.combined_history.length > 0) {
            return data.combined_history.map((h: any) => ({
                process_step: h.process_step,
                status: normalizeStatus(h.status),
                scanned_by: h.scanned_by || '-',
                scanned_at: h.scanned_at,
                remark: h.remark || h.rework_reason || null,
                source: h.source || 'SMT',
            }));
        }
        const smtRows = (data.scan_history || []).map((h: ScanEntry) => ({
            process_step: h.process_step,
            status: normalizeStatus(h.status),
            scanned_by: h.scanned_by,
            scanned_at: h.scanned_at,
            remark: h.rework_reason || null,
            source: 'SMT',
        }));
        const backendRows = (data.backend_scan_history || []).map((h: any) => ({
            process_step: h.station || h.stage_name || h.stage_code || '-',
            status: normalizeStatus(h.status),
            scanned_by: h.scanned_by || '-',
            scanned_at: h.scanned_at,
            remark: h.remarks || null,
            source: 'Backend',
        }));
        return [...smtRows, ...backendRows].sort(
            (a, b) => new Date(a.scanned_at).getTime() - new Date(b.scanned_at).getTime()
        );
    }, [data]);

    return (
        <div className={styles.page}>
            {/* ── Header ── */}
            <div className={styles.pageHeader}>
                <div className={styles.headerLeft}>
                    <div className={styles.headerIcon}><Activity size={28} /></div>
                    <div>
                        <h1 className={styles.headerTitle}>SMT Serial Traceability</h1>
                        <p className={styles.headerSub}>Complete SMT production lifecycle visibility</p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {(data || woData) && (
                        <>
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
                                {isDownloading ? 'Generating PDF...' : 'Download PDF'}
                            </button>
                            <button
                                type="button"
                                onClick={handleDownloadExcel}
                                disabled={isExporting}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    background: '#10b981', color: '#fff', border: 'none',
                                    padding: '8px 16px', borderRadius: '6px', fontWeight: 600,
                                    cursor: isExporting ? 'not-allowed' : 'pointer',
                                    opacity: isExporting ? 0.7 : 1,
                                    transition: 'all 0.2s'
                                }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                                    <polyline points="14 2 14 8 20 8" />
                                    <line x1="8" y1="13" x2="16" y2="13" />
                                    <line x1="8" y1="17" x2="16" y2="17" />
                                    <line x1="10" y1="9" x2="10" y2="9.01" />
                                </svg>
                                {isExporting ? 'Exporting Excel...' : 'Download Excel'}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* ── Search ── */}
            <div className={styles.searchPanel}>
                <form onSubmit={handleSearch} className={styles.searchForm}>
                    <div className={styles.searchInputWrap}>
                        <Search size={20} className={styles.searchLeadIcon} />
                        <select
                            value={searchType}
                            onChange={e => setSearchType(e.target.value as 'serial' | 'wo')}
                            style={{ padding: '0 8px', border: 'none', background: 'transparent', outline: 'none', color: '#64748b', fontWeight: 600, borderRight: '1px solid #cbd5e1' }}
                        >
                            <option value="serial">Serial Number</option>
                            <option value="wo">Work Order</option>
                        </select>
                        {searchType === 'wo' ? (
                            <select
                                className={styles.searchInput}
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                disabled={loading}
                                style={{ appearance: 'none', background: 'transparent', outline: 'none', paddingLeft: '8px' }}
                            >
                                <option value="" disabled>Select Work Order...</option>
                                {workOrdersList.map(wo => (
                                    <option key={wo} value={wo}>{wo}</option>
                                ))}
                            </select>
                        ) : (
                            <input
                                ref={inputRef}
                                type="text"
                                className={styles.searchInput}
                                placeholder="Scan or enter Serial Number..."
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                disabled={loading}
                                autoComplete="off"
                            />
                        )}
                    </div>
                    <button type="submit" className={styles.searchBtn} disabled={loading}>
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
                                    <div className={styles.summaryLabel}>Serial Number</div>
                                    <div className={styles.summaryValue}>{data.serial_number}</div>
                                </div>
                            </div>
                            <div className={styles.summaryCard}>
                                <div className={styles.summaryIcon} style={{ background: 'rgba(139,92,246,0.12)', color: '#8b5cf6' }}>
                                    <FileText size={22} />
                                </div>
                                <div>
                                    <div className={styles.summaryLabel}>Work Order</div>
                                    <div className={styles.summaryValue} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', minWidth: '150px' }}>
                                        {data.work_order_id}
                                        <button
                                            onClick={() => handleTrackWorkOrder(data.work_order_id)}
                                            title="Track this Work Order"
                                            style={{
                                                background: '#f8fafc', border: '1px solid #cbd5e1',
                                                borderRadius: '4px', cursor: 'pointer', padding: '4px',
                                                display: 'flex', alignItems: 'center', color: '#8b5cf6',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
                                            onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
                                        >
                                            <Search size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className={styles.summaryCard}>
                                <div className={styles.summaryIcon} style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
                                    <TrendingUp size={22} />
                                </div>
                                <div>
                                    <div className={styles.summaryLabel}>Product</div>
                                    <div className={styles.summaryValue}>{data.product_name}</div>
                                </div>
                            </div>
                            <div className={styles.summaryCard}>
                                <div className={styles.summaryIcon} style={{ background: 'rgba(244,114,182,0.12)', color: '#ec4899' }}>
                                    <Cpu size={22} />
                                </div>
                                <div>
                                    <div className={styles.summaryLabel}>Line ID</div>
                                    <div className={styles.summaryValue}>{data.line_id}</div>
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
                                            {getProcessSelectionText(data)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className={styles.summaryCard}>
                                <div className={styles.summaryIcon} style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
                                    <Zap size={22} />
                                </div>
                                <div>
                                    <div className={styles.summaryLabel}>Sides</div>
                                    <div className={styles.summaryValue}>{data.sides || '-'}</div>
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
                                <div className={styles.summaryIcon} style={{ background: statusBg(overallCurrentStatus), color: statusColor(overallCurrentStatus) }}>
                                    <Activity size={22} />
                                </div>
                                <div>
                                    <div className={styles.summaryLabel}>Status</div>
                                    <StatusBadge status={overallCurrentStatus} />
                                </div>
                            </div>
                        </div>

                        {/* ── Stats Row ── */}
                        <div className={styles.statsRow}>
                            <div className={styles.statPill} style={{ '--c': '#10b981' } as React.CSSProperties}>
                                <span className={styles.statNum}>{data.total_passed}</span>
                                <span className={styles.statLbl}>Total Stages Passed</span>
                            </div>
                            <div className={styles.statPill} style={{ '--c': '#f59e0b' } as React.CSSProperties}>
                                <span className={styles.statNum}>{data.total_reworks}</span>
                                <span className={styles.statLbl}>Rework Events</span>
                            </div>
                            <div className={styles.statPill} style={{ '--c': '#ef4444' } as React.CSSProperties}>
                                <span className={styles.statNum}>{data.total_failures}</span>
                                <span className={styles.statLbl}>Total Failures</span>
                            </div>
                            <div className={styles.finalStatus} style={{ background: statusBg(overallCurrentStatus), borderColor: `${statusColor(overallCurrentStatus)}44`, color: statusColor(overallCurrentStatus) }}>
                                <Zap size={16} />
                                {overallStatusLabel}
                            </div>
                        </div>

                        {/* ── SMT Process Status Overview (All Process Columns) ── */}
                        <div style={{
                            background: '#fff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '12px',
                            padding: '1.25rem',
                            marginBottom: '1.5rem',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '8px' }}>
                                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Activity size={18} /> SMT Process Status
                                </h3>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>
                                    Work Order PCB Side: <strong style={{ color: '#1e293b' }}>{data.sides || '-'}</strong>
                                    {isDoubleSided && (
                                        <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px', marginLeft: '8px', fontSize: '11px', fontWeight: 700 }}>
                                            Dual-Sided (Top + Bottom)
                                        </span>
                                    )}
                                </span>
                            </div>

                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                                    <thead>
                                        <tr style={{ background: '#1e3a8a', color: '#ffffff' }}>
                                            {PROCESS_COLUMNS.map(col => (
                                                <th key={col} style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 700, border: '1px solid #cbd5e1' }}>
                                                    {col}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr style={{ background: '#f8fafc' }}>
                                            {PROCESS_COLUMNS.map(col => {
                                                if (col === 'Status') {
                                                    const isCompleted = overallStatusLabel === 'COMPLETED';
                                                    const isFailed = overallStatusLabel === 'FAILED';
                                                    const isRework = overallStatusLabel === 'IN REWORK';
                                                    const bg = isCompleted ? '#dcfce7' : isFailed ? '#fee2e2' : isRework ? '#fef3c7' : '#f1f5f9';
                                                    const color = isCompleted ? '#166534' : isFailed ? '#991b1b' : isRework ? '#92400e' : '#475569';
                                                    const border = isCompleted ? '#86efac' : isFailed ? '#fca5a5' : isRework ? '#fde68a' : '#cbd5e1';
                                                    return (
                                                        <td key={col} style={{ padding: '12px 14px', border: '1px solid #cbd5e1', verticalAlign: 'middle' }}>
                                                            <span style={{
                                                                display: 'inline-block',
                                                                fontSize: '11px',
                                                                fontWeight: 800,
                                                                padding: '6px 14px',
                                                                borderRadius: '6px',
                                                                background: bg,
                                                                color: color,
                                                                border: `1px solid ${border}`,
                                                                letterSpacing: '0.04em'
                                                            }}>
                                                                {overallStatusLabel}
                                                            </span>
                                                        </td>
                                                    );
                                                }

                                                if (isDoubleSided) {
                                                    const { top, bottom, hideBottom } = resolveDoubleSideStage(
                                                        col,
                                                        getStageStatusForSide(col, 'Top'),
                                                        getStageStatusForSide(col, 'Bottom'),
                                                        isPostAoiPassed
                                                    );

                                                    return (
                                                        <td key={col} style={{ padding: '10px 12px', border: '1px solid #cbd5e1', verticalAlign: 'middle' }}>
                                                            <DualSideStatusBadge
                                                                topStatus={top}
                                                                bottomStatus={bottom}
                                                                hideBottom={hideBottom}
                                                            />
                                                        </td>
                                                    );
                                                }

                                                const status = getStageStatus(col);
                                                return (
                                                    <td key={col} style={{ padding: '12px 14px', border: '1px solid #cbd5e1', verticalAlign: 'middle' }}>
                                                        <StatusBadge status={status} />
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Solder Paste Preparation Details removed per Enhancement 2 */}

                        {/* ── Main two-column layout ── */}
                        <div className={styles.mainGrid}>

                            {/* LEFT: Pipeline Flow */}
                            <div className={styles.pipelinePanel}>
                                <div style={{ marginBottom: '1.25rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.75rem' }}>
                                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <ChevronRight size={18} /> Production Pipeline
                                    </h3>
                                    {(data.has_smt && data.has_backend) && (
                                        <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '8px', marginTop: '10px', border: '1px solid #e2e8f0' }}>
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
                                        </div>
                                    )}
                                </div>

                                {selectedPipelineView === 'backend' ? (
                                    <div className={styles.pipeline}>
                                        {BACKEND_PIPELINE.map((stage, idx) => {
                                            const isSelected = isBackendStageSelected(stage, data.selected_stages);
                                            const isLast = idx === BACKEND_PIPELINE.length - 1;

                                            if (!isSelected) {
                                                return (
                                                    <React.Fragment key={stage.code}>
                                                        <div className={styles.pipelineNode}>
                                                            <div className={styles.pipelineNodeDot} style={{ background: '#f1f5f9', border: '1px dashed #cbd5e1', boxShadow: 'none' }}>
                                                                <Zap size={16} style={{ color: '#94a3b8' }} />
                                                            </div>
                                                            <div className={styles.pipelineNodeLabel} style={{ color: '#94a3b8' }}>{stage.name}</div>
                                                            <span style={{ fontSize: '9px', background: 'rgba(148,163,184,0.12)', color: '#94a3b8', border: '1px solid #cbd5e133', padding: '2px 8px', borderRadius: '9999px', fontWeight: 700 }}>N/A</span>
                                                        </div>
                                                        {!isLast && <div className={styles.pipelineConnector}><ArrowDown size={14} /></div>}
                                                    </React.Fragment>
                                                );
                                            }

                                            const bHistory = data.backend_scan_history || [];
                                            const entries = bHistory.filter((h: any) => {
                                                const sc = normalizeStageId(h.stage_code || '');
                                                const st = normalizeStageId(h.station || '');
                                                const cn = normalizeStageId(stage.code);
                                                const nn = normalizeStageId(stage.name);
                                                const ln = normalizeStageId(stage.label);
                                                return sc === cn || st === cn || st === nn || st === ln;
                                            });
                                            const visited = entries.length > 0;
                                            const rawStatus = visited ? entries[entries.length - 1].status : '';
                                            const stStatus = visited ? normalizeStatus(rawStatus) : 'PENDING';
                                            const color = visited ? statusColor(stStatus) : '#cbd5e1';

                                            return (
                                                <React.Fragment key={stage.code}>
                                                    <div className={styles.pipelineNode}>
                                                        <div className={styles.pipelineNodeDot} style={{ background: visited ? color : '#f1f5f9', border: visited ? 'none' : '1px dashed #94a3b8', boxShadow: visited ? `0 0 0 4px ${color}22` : 'none' }}>
                                                            <Zap size={16} style={{ color: visited ? '#fff' : '#94a3b8' }} />
                                                        </div>
                                                        <div className={styles.pipelineNodeLabel} style={{ color: visited ? '#1e293b' : '#94a3b8' }}>
                                                            {stage.name}
                                                        </div>
                                                        {visited ? (
                                                            <StatusBadge status={stStatus} small />
                                                        ) : (
                                                            <span className={styles.pendingTag}>Pending</span>
                                                        )}
                                                        {entries.length > 1 && <span className={styles.rescannedTag}>×{entries.length} scans</span>}
                                                    </div>
                                                    {!isLast && <div className={styles.pipelineConnector}><ArrowDown size={14} /></div>}
                                                </React.Fragment>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    /* TOP/BOTTOM dual pipeline */
                                    (() => {
                                        if (isDoubleSided) {
                                            return (
                                                <div className={styles.pipeline}>
                                                    {/* Serial Number */}
                                                    <div className={styles.pipelineNode}>
                                                        <div className={styles.pipelineNodeDot} style={{ background: '#10b981', boxShadow: '0 0 0 4px rgba(16,185,129,0.2)' }}>
                                                            <StationIcon station="Serial Number" />
                                                        </div>
                                                        <div className={styles.pipelineNodeLabel} style={{ color: '#1e293b' }}>
                                                            Serial Number
                                                        </div>
                                                        <StatusBadge status="PASS" small />
                                                    </div>
                                                    <div className={styles.pipelineConnector}><ArrowDown size={14} /></div>

                                                    {/* Stages: Printing, SPI, Pre AOI, Post AOI, Rework, SMT FG */}
                                                    {['Printing', 'SPI', 'Pre AOI', 'Post AOI', 'Rework', 'SMT FG'].map((stage, idx, arr) => {
                                                        const { top: topSt, bottom: botSt, hideBottom } = resolveDoubleSideStage(
                                                            stage,
                                                            getStageStatusForSide(stage, 'Top'),
                                                            getStageStatusForSide(stage, 'Bottom'),
                                                            isPostAoiPassed
                                                        );
                                                        const hasFail = topSt === 'FAIL' || (!hideBottom && botSt === 'FAIL');
                                                        const hasRework = topSt === 'REWORK' || (!hideBottom && botSt === 'REWORK');
                                                        const hasPass = topSt === 'PASS' || (!hideBottom && botSt === 'PASS');
                                                        const nodeColor = hasFail ? '#ef4444' : hasRework ? '#f59e0b' : hasPass ? '#10b981' : '#cbd5e1';
                                                        const isCurrent = isCurrentStage(stage);
                                                        const isLast = idx === arr.length - 1;

                                                        return (
                                                            <React.Fragment key={stage}>
                                                                <div className={`${styles.pipelineNode} ${isCurrent ? styles.pipelineNodeActive : ''}`}>
                                                                    <div className={styles.pipelineNodeDot} style={{
                                                                        background: nodeColor,
                                                                        boxShadow: isCurrent ? `0 0 0 6px ${nodeColor}33, 0 0 20px ${nodeColor}44` : `0 0 0 4px ${nodeColor}22`
                                                                    }}>
                                                                        <StationIcon station={stage} />
                                                                    </div>
                                                                    <div className={styles.pipelineNodeLabel} style={{ color: (hasPass || hasFail || hasRework) ? '#1e293b' : '#94a3b8' }}>
                                                                        {stage}
                                                                        {isCurrent && <span className={styles.liveTag}>LIVE</span>}
                                                                    </div>
                                                                    <DualSideStatusBadge
                                                                        topStatus={topSt}
                                                                        bottomStatus={botSt}
                                                                        hideBottom={hideBottom}
                                                                        small
                                                                    />
                                                                </div>
                                                                {!isLast && <div className={styles.pipelineConnector}><ArrowDown size={14} /></div>}
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        }

                                        // Single-sided: existing behaviour unchanged
                                        return (
                                            <div className={styles.pipeline}>
                                                {SMT_PIPELINE.map((stage, idx) => {
                                                    const visited = visitedStages.has(stage);
                                                    const stStatus = visited ? getStageStatus(stage) : 'pending';
                                                    const isCurrent = isCurrentStage(stage);
                                                    const color = visited ? statusColor(stStatus) : '#cbd5e1';
                                                    const entries = data.scan_history.filter(h => h.process_step === stage);
                                                    const isLast = idx === SMT_PIPELINE.length - 1;
                                                    return (
                                                        <React.Fragment key={stage}>
                                                            <div className={`${styles.pipelineNode} ${isCurrent ? styles.pipelineNodeActive : ''}`}>
                                                                <div className={styles.pipelineNodeDot} style={{ background: color, boxShadow: isCurrent ? `0 0 0 6px ${color}33, 0 0 20px ${color}44` : `0 0 0 4px ${color}22` }}>
                                                                    <StationIcon station={stage} />
                                                                </div>
                                                                <div className={styles.pipelineNodeLabel} style={{ color: visited ? '#1e293b' : '#94a3b8' }}>
                                                                    {stage}{isCurrent && <span className={styles.liveTag}>LIVE</span>}
                                                                </div>
                                                                {visited ? (
                                                                    (isCurrent && stStatus.toUpperCase() === 'FAIL') ? (
                                                                        <button onClick={() => navigate(STAGE_ROUTES[stage])} title="Click to fix this failure" style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#ef4444', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase' }} onMouseEnter={e => e.currentTarget.style.background = '#fee2e2'} onMouseLeave={e => e.currentTarget.style.background = '#fef2f2'}>
                                                                            FAIL • Fix
                                                                        </button>
                                                                    ) : (
                                                                        <StatusBadge status={stStatus} small />
                                                                    )
                                                                ) : <span className={styles.pendingTag}>{stage === 'Rework' ? 'NA' : 'Pending'}</span>}
                                                                {entries.length > 1 && <span className={styles.rescannedTag}>×{entries.length} scans</span>}
                                                            </div>
                                                            {!isLast && <div className={styles.pipelineConnector}><ArrowDown size={14} /></div>}
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()
                                )}
                            </div>

                            {/* RIGHT: Scan History Table (SMT + Backend combined) */}
                            <div className={styles.historyPanel}>
                                <h3 className={styles.panelTitle}><Clock size={18} /> Scan History</h3>

                                <div className={styles.tableContainer}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                                        <thead>
                                            <tr style={{ background: '#1e3a8a', color: '#ffffff' }}>
                                                <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>#</th>
                                                <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>Source</th>
                                                <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>Process Step</th>
                                                <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>Status</th>
                                                <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>Scanned By</th>
                                                <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>Scanned At</th>
                                                <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>Remark</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {combinedHistory.length === 0 ? (
                                                <tr><td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>No records.</td></tr>
                                            ) : combinedHistory.map((row, idx) => (
                                                <tr key={idx} style={{ background: row.status === 'REWORK' ? 'rgba(245,158,11,0.05)' : row.status === 'FAIL' ? 'rgba(239,68,68,0.05)' : '#f9fafb' }}>
                                                    <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', fontWeight: 600 }}>{idx + 1}</td>
                                                    <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>
                                                        <span style={{ fontSize: '9px', background: row.source === 'SMT' ? 'rgba(59,130,246,0.12)' : 'rgba(16,185,129,0.12)', color: row.source === 'SMT' ? '#3b82f6' : '#10b981', border: `1px solid ${row.source === 'SMT' ? '#3b82f633' : '#10b98133'}`, padding: '2px 6px', borderRadius: '3px', fontWeight: 700 }}>{row.source}</span>
                                                    </td>
                                                    <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', fontWeight: 600 }}>{row.process_step}</td>
                                                    <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>
                                                        <span style={{ fontSize: '9px', background: statusBg(row.status), color: statusColor(row.status), border: `1px solid ${statusColor(row.status)}33`, padding: '2px 6px', borderRadius: '3px' }}>{row.status.toUpperCase()}</span>
                                                    </td>
                                                    <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>{row.scanned_by}</td>
                                                    <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', whiteSpace: 'nowrap' }}>{fmt(row.scanned_at)}</td>
                                                    <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', wordBreak: 'break-word' }}>{row.remark || '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
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
                            <div className={styles.summaryCard}>
                                <div className={styles.summaryIcon} style={{ background: 'rgba(244,114,182,0.12)', color: '#ec4899' }}><Cpu size={22} /></div>
                                <div>
                                    <div className={styles.summaryLabel}>Line ID</div>
                                    <div className={styles.summaryValue}>{woData.line_id}</div>
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
                                            {woData.has_smt && woData.has_backend ? 'SMT + Backend' : woData.has_smt ? 'SMT' : woData.has_backend ? 'Backend' : 'SMT'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className={styles.summaryCard}>
                                <div className={styles.summaryIcon} style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}><Zap size={22} /></div>
                                <div>
                                    <div className={styles.summaryLabel}>Sides</div>
                                    <div className={styles.summaryValue}>{woData.sides || '-'}</div>
                                </div>
                            </div>
                        </div>

                        {/* Solder Paste Preparation Details removed per Enhancement 2 */}

                        <div className={styles.historyPanel} style={{ marginTop: '20px' }}>
                            <h3 className={styles.panelTitle} style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Package size={18} /> Work Order Serials ({woData.total_filtered})
                                </span>
                                <span style={{ fontSize: '13px', color: '#166534', background: '#dcfce7', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                                    Completed: {completedCount}
                                </span>
                                <span style={{ fontSize: '13px', color: '#92400e', background: '#fef3c7', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                                    Pending: {pendingCount}
                                </span>
                                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', minWidth: '240px' }}>
                                    <input
                                        type="text"
                                        placeholder="Search Serial Number / Barcode..."
                                        value={serialSearch}
                                        onChange={(e) => setSerialSearch(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '6px 12px',
                                            fontSize: '12px',
                                            border: '1px solid #cbd5e1',
                                            borderRadius: '6px',
                                            outline: 'none'
                                        }}
                                    />
                                </div>
                            </h3>
                            <div className={styles.tableContainer}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', fontWeight: 600, position: 'relative' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    Serial Number Barcode
                                                    <button onClick={() => setShowFilter(!showFilter)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}>
                                                        <Filter size={14} color={(filterDate || filterStatus) ? '#3b82f6' : '#94a3b8'} />
                                                    </button>
                                                </div>
                                                {showFilter && (
                                                    <div style={{ position: 'absolute', top: '100%', left: '16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', zIndex: 50, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)', width: '200px' }}>
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
                                            {SMT_PIPELINE.map((step: any) => (
                                                <th key={step} style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', fontWeight: 600 }}>{step}</th>
                                            ))}
                                            <th style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', fontWeight: 600 }}>Status</th>
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
                                                {SMT_PIPELINE.map((step: any) => {
                                                    if (step === 'Serial Number') {
                                                        return (
                                                            <td key={step} style={{ padding: '12px 16px' }}>
                                                                <StatusBadge status={s.step_status && s.step_status[step] && s.step_status[step] !== '-' ? s.step_status[step] : 'PASS'} small />
                                                            </td>
                                                        );
                                                    }

                                                    if (isWoDoubleSided) {
                                                        const postAoiPass = s.step_status_top?.['Post AOI'] === 'PASS' || s.step_status_bottom?.['Post AOI'] === 'PASS';
                                                        const { top, bottom, hideBottom } = resolveDoubleSideStage(
                                                            step,
                                                            s.step_status_top?.[step],
                                                            s.step_status_bottom?.[step],
                                                            postAoiPass
                                                        );

                                                        return (
                                                            <td key={step} style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
                                                                <DualSideStatusBadge
                                                                    topStatus={top}
                                                                    bottomStatus={bottom}
                                                                    hideBottom={hideBottom}
                                                                    small
                                                                />
                                                            </td>
                                                        );
                                                    }

                                                    return (
                                                        <td key={step} style={{ padding: '12px 16px' }}>
                                                            {s.step_status && s.step_status[step] && s.step_status[step] !== '-' ? (
                                                                <StatusBadge status={s.step_status[step]} small />
                                                            ) : (
                                                                <span style={{ color: '#94a3b8' }}>-</span>
                                                            )}
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
                                                        fontWeight: 700
                                                    }}>
                                                        {s.final_status_label === 'Completed' ? 'COMPLETED' : 'PENDING'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {woData.total_filtered === 0 && (
                                    <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                                        No serial numbers match the selected filters.
                                    </div>
                                )}
                            </div>

                            {totalPages > 1 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', padding: '0 16px' }}>
                                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                                        Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, woData.total_filtered)} of {woData.total_filtered} entries
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

            {/* ── Print Content (Hidden) ── */}
            <div ref={printRef} style={{ position: 'absolute', left: '-10000px', top: 0, width: '794px', pointerEvents: 'none' }}>
                {data && (
                    <div style={{ padding: '20px', background: '#fff', fontFamily: 'Arial, sans-serif' }}>
                        <h1 style={{ marginBottom: '10px', color: '#1e293b', fontSize: '20px' }}>SMT Serial Traceability Report</h1>
                        <p style={{ color: '#64748b', marginBottom: '20px', fontSize: '12px' }}>Generated on {new Date().toLocaleString('en-IN')}</p>

                        {/* Metadata Box */}
                        <div style={{ marginBottom: '15px', padding: '12px 16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                            <p style={{ margin: 0 }}><strong>Serial Number:</strong> {data.serial_number}</p>
                            <p style={{ margin: 0 }}><strong>Work Order:</strong> {data.work_order_id}</p>
                            <p style={{ margin: 0 }}><strong>Product:</strong> {data.product_name}</p>
                            <p style={{ margin: 0 }}><strong>Customer:</strong> {data.customer_name || '-'}</p>
                            <p style={{ margin: 0 }}><strong>Model:</strong> {data.model_name || '-'}</p>
                            <p style={{ margin: 0 }}><strong>Line ID:</strong> {data.line_id || '-'}</p>
                            <p style={{ margin: 0 }}><strong>Process Selection:</strong> {getProcessSelectionText(data)}</p>
                            <p style={{ margin: 0 }}><strong>Sides:</strong> {data.sides || '-'}</p>
                            <p style={{ margin: 0 }}><strong>Current Stage:</strong> {data.current_stage}</p>
                            <p style={{ margin: 0 }}><strong>Overall Status:</strong> {data.final_status_label}</p>
                        </div>

                        {/* Summary Stats Cards */}
                        <div style={{ marginBottom: '15px', display: 'flex', gap: '12px' }}>
                            <div style={{ flex: 1, padding: '10px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', textAlign: 'center' }}>
                                <div style={{ fontSize: '18px', fontWeight: 800, color: '#166534' }}>{data.total_passed}</div>
                                <div style={{ fontSize: '10px', fontWeight: 600, color: '#15803d' }}>Total Stages Passed</div>
                            </div>
                            <div style={{ flex: 1, padding: '10px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '6px', textAlign: 'center' }}>
                                <div style={{ fontSize: '18px', fontWeight: 800, color: '#92400e' }}>{data.total_reworks}</div>
                                <div style={{ fontSize: '10px', fontWeight: 600, color: '#b45309' }}>Rework Events</div>
                            </div>
                            <div style={{ flex: 1, padding: '10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', textAlign: 'center' }}>
                                <div style={{ fontSize: '18px', fontWeight: 800, color: '#991b1b' }}>{data.total_failures}</div>
                                <div style={{ fontSize: '10px', fontWeight: 600, color: '#b91c1c' }}>Total Failures</div>
                            </div>
                        </div>

                        {/* SMT Process Status Overview Table */}
                        <div style={{ marginBottom: '15px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            <h3 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>SMT Process Status</h3>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'center' }}>
                                <thead>
                                    <tr style={{ background: '#1e3a8a', color: '#ffffff' }}>
                                        {PROCESS_COLUMNS.map(col => (
                                            <th key={col} style={{ padding: '6px', border: '1px solid #cbd5e1' }}>{col}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        {PROCESS_COLUMNS.map(col => {
                                            if (col === 'Status') {
                                                return (
                                                    <td key={col} style={{ padding: '6px', border: '1px solid #cbd5e1', fontWeight: 700, color: overallStatusLabel === 'COMPLETED' ? '#166534' : overallStatusLabel === 'FAILED' ? '#991b1b' : '#92400e' }}>
                                                        {overallStatusLabel}
                                                    </td>
                                                );
                                            }
                                            if (isDoubleSided) {
                                                const { top, bottom, hideBottom } = resolveDoubleSideStage(
                                                    col,
                                                    getStageStatusForSide(col, 'Top'),
                                                    getStageStatusForSide(col, 'Bottom'),
                                                    isPostAoiPassed
                                                );

                                                return (
                                                    <td key={col} style={{ padding: '6px', border: '1px solid #cbd5e1', fontSize: '10px' }}>
                                                        <div style={{ color: statusColor(top), fontWeight: 700 }}>TOP: {top}</div>
                                                        {!hideBottom && <div style={{ color: statusColor(bottom), fontWeight: 700, marginTop: '2px' }}>BOT: {bottom}</div>}
                                                    </td>
                                                );
                                            }
                                            const st = getStageStatus(col);
                                            return (
                                                <td key={col} style={{ padding: '6px', border: '1px solid #cbd5e1', fontWeight: 700, color: statusColor(st) }}>
                                                    {st}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Production Pipeline Status */}
                        {data.backend_stages && data.backend_stages.length > 0 && (
                            <div style={{ marginBottom: '15px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <h3 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>Backend Pipeline Status</h3>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {data.backend_stages.map((st: any, i: number) => (
                                        <span key={i} style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '4px', background: st.status === 'PASSED' ? '#dcfce7' : st.status === 'FAILED' ? '#fee2e2' : '#f1f5f9', color: st.status === 'PASSED' ? '#166534' : st.status === 'FAILED' ? '#991b1b' : '#64748b', fontWeight: 600, border: '1px solid #cbd5e1' }}>
                                            {st.name || st.code}: {st.status}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Combined Scan History Table */}
                        <h3 style={{ margin: '15px 0 8px 0', fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>Complete Scan History</h3>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ background: '#1e3a8a', color: '#ffffff' }}>
                                    <th style={{ padding: '6px 8px', border: '1px solid #cbd5e1' }}>#</th>
                                    <th style={{ padding: '6px 8px', border: '1px solid #cbd5e1' }}>Source</th>
                                    <th style={{ padding: '6px 8px', border: '1px solid #cbd5e1' }}>Process Step</th>
                                    <th style={{ padding: '6px 8px', border: '1px solid #cbd5e1' }}>Status</th>
                                    <th style={{ padding: '6px 8px', border: '1px solid #cbd5e1' }}>Scanned By</th>
                                    <th style={{ padding: '6px 8px', border: '1px solid #cbd5e1' }}>Scanned At</th>
                                    <th style={{ padding: '6px 8px', border: '1px solid #cbd5e1' }}>Remark</th>
                                </tr>
                            </thead>
                            <tbody>
                                {combinedHistory.map((row, idx) => (
                                    <tr key={idx}>
                                        <td style={{ padding: '6px 8px', border: '1px solid #cbd5e1', fontWeight: 600 }}>{idx + 1}</td>
                                        <td style={{ padding: '6px 8px', border: '1px solid #cbd5e1', fontWeight: 700, color: row.source === 'SMT' ? '#2563eb' : '#059669' }}>{row.source}</td>
                                        <td style={{ padding: '6px 8px', border: '1px solid #cbd5e1' }}><strong>{row.process_step}</strong></td>
                                        <td style={{ padding: '6px 8px', border: '1px solid #cbd5e1', fontWeight: 700, color: row.status === 'PASS' ? '#166534' : row.status === 'FAIL' ? '#991b1b' : '#334155' }}>{row.status}</td>
                                        <td style={{ padding: '6px 8px', border: '1px solid #cbd5e1' }}>{row.scanned_by}</td>
                                        <td style={{ padding: '6px 8px', border: '1px solid #cbd5e1' }}>{fmt(row.scanned_at)}</td>
                                        <td style={{ padding: '6px 8px', border: '1px solid #cbd5e1' }}>{row.remark || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {woData && (
                    <div style={{ padding: '20px', background: '#fff', fontFamily: 'Arial, sans-serif' }}>
                        <h1 style={{ marginBottom: '10px', color: '#1e293b' }}>SMT Work Order Report</h1>
                        <p style={{ color: '#64748b', marginBottom: '20px' }}>Generated on {new Date().toLocaleString('en-IN')}</p>

                        <div style={{ marginBottom: '20px', padding: '15px', background: '#f1f5f9', borderRadius: '8px' }}>
                            <p><strong>Work Order:</strong> {woData.work_order_id}</p>
                            <p><strong>Product:</strong> {woData.product_name}</p>
                            <p><strong>Line ID:</strong> {woData.line_id}</p>
                            <p><strong>Process Selection:</strong> {woData.has_smt && woData.has_backend ? 'SMT + Backend' : woData.has_smt ? 'SMT' : woData.has_backend ? 'Backend' : 'SMT'}</p>
                            <p><strong>Sides:</strong> {woData.sides || '-'}</p>
                            <p><strong>Serials:</strong> {woData.total_filtered} / {woData.quantity}</p>
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px', fontSize: '11px', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ background: '#1e3a8a', color: '#ffffff' }}>
                                    <th style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Serial Number Barcode</th>
                                    {SMT_PIPELINE.map(step => (
                                        <th key={step} style={{ padding: '6px', border: '1px solid #cbd5e1' }}>{step}</th>
                                    ))}
                                    <th style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentSerials.map((s: any, idx: number) => {
                                    const postAoiPassed = s.step_status_top?.['Post AOI'] === 'PASS' || s.step_status_bottom?.['Post AOI'] === 'PASS' || s.step_status?.['Post AOI'] === 'PASS';
                                    return (
                                        <tr key={idx}>
                                            <td style={{ padding: '6px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}>{s.serial_number}</td>
                                            {SMT_PIPELINE.map(step => (
                                                <td key={step} style={{ padding: '6px', border: '1px solid #cbd5e1', fontSize: '10px' }}>
                                                    {step === 'Serial Number' ? (
                                                        s.step_status && s.step_status[step] && s.step_status[step] !== '-' ? s.step_status[step] : 'PASS'
                                                    ) : isWoDoubleSided ? (
                                                        (() => {
                                                            const { top, bottom, hideBottom } = resolveDoubleSideStage(step, s.step_status_top?.[step], s.step_status_bottom?.[step], postAoiPassed);
                                                            return (
                                                                <div>
                                                                    <div style={{ color: statusColor(top), fontWeight: 700 }}>T: {top}</div>
                                                                    {!hideBottom && <div style={{ color: statusColor(bottom), fontWeight: 700 }}>B: {bottom}</div>}
                                                                </div>
                                                            );
                                                        })()
                                                    ) : (
                                                        s.step_status && s.step_status[step] && s.step_status[step] !== '-' ? s.step_status[step] : '-'
                                                    )}
                                                </td>
                                            ))}
                                            <td style={{ padding: '6px', border: '1px solid #cbd5e1', fontWeight: 'bold', color: s.final_status_label === 'Completed' ? '#166534' : '#92400e' }}>
                                                {s.final_status_label === 'Completed' ? 'COMPLETED' : 'PENDING'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SmtTrackItems;
