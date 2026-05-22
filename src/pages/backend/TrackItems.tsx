import React, { useState, useRef, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import styles from './TrackItems.module.css';
import {
    Search, Package, CheckCircle, AlertTriangle,
    Clock, Activity, Zap, ArrowDown, RotateCcw, ChevronRight,
    User, Calendar, FileText, Wrench, MapPin, TrendingUp, Download
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useAuth } from '../../hooks/useAuth';

// ─── Types ────────────────────────────────────────────────────────────────────

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
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const fmt = (ts: string | null | undefined) =>
    ts ? new Date(ts).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' }) : '—';

const statusColor = (s: string): string => {
    switch (s.toUpperCase()) {
        case 'ACCEPTED': case 'PASS': return '#10b981';
        case 'REWORK': return '#f59e0b';
        case 'DEBUG': return '#ef4444';
        case 'READY_FOR_RESCAN': return '#6366f1';
        case 'IN_PROGRESS': return '#3b82f6';
        default: return '#94a3b8';
    }
};

const statusBg = (s: string): string => {
    switch (s.toUpperCase()) {
        case 'ACCEPTED': case 'PASS': return 'rgba(16,185,129,0.12)';
        case 'REWORK': return 'rgba(245,158,11,0.12)';
        case 'DEBUG': return 'rgba(239,68,68,0.12)';
        case 'READY_FOR_RESCAN': return 'rgba(99,102,241,0.12)';
        case 'IN_PROGRESS': return 'rgba(59,130,246,0.12)';
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
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<TrackResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [appeared, setAppeared] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => { inputRef.current?.focus(); }, []);

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const q = query.trim();
        if (!q) return;
        setLoading(true); setError(null); setData(null); setAppeared(false);
        try {
            const result = await apiFetch(`/api/backend/track/${encodeURIComponent(q)}`);
            setData(result);
            setTimeout(() => setAppeared(true), 50);
        } catch (err: any) {
            setError(err.message || 'Barcode not found in system.');
        } finally {
            setLoading(false);
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

            const canvas = await html2canvas(input, {
                scale: 2, // High-quality resolution
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

            pdf.save(`Traceability_Report_${data?.barcode || 'record'}.pdf`);
        } catch (error) {
            console.error("PDF Download Failed:", error);
        } finally {
            setIsDownloading(false);
        }
    };

    const getStageStatus = (stage: { code: string; name: string; label: string }): string => {
        if (!data) return 'pending';

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
            if (currentStatus === 'ACCEPTED') {
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
                {data && (
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
                )}
            </div>

            {/* ── Search ── */}
            <div className={styles.searchPanel}>
                <form onSubmit={handleSearch} className={styles.searchForm}>
                    <div className={styles.searchInputWrap}>
                        <Search className={styles.searchLeadIcon} size={20} />
                        <input
                            ref={inputRef}
                            className={styles.searchInput}
                            placeholder="Scan or enter PCB Barcode or Unit Serial Number…"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                        />
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
                                <div className={styles.summaryValue}>{data.wo_number}</div>
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
                            <h3 className={styles.panelTitle}><ChevronRight size={18} /> Production Pipeline</h3>

                            <div className={styles.pipeline}>
                                {/* Warehouse node */}
                                <div className={styles.pipelineNode}>
                                    <div className={styles.pipelineNodeDot} style={{ background: '#3b82f6', boxShadow: '0 0 0 4px rgba(59,130,246,0.2)' }}>
                                        <Package size={14} />
                                    </div>
                                    <div className={styles.pipelineNodeLabel}>Warehouse</div>
                                    <StatusBadge status="ACCEPTED" small />
                                </div>
                                <div className={styles.pipelineConnector}><ArrowDown size={14} /></div>

                                 {PRODUCTION_PIPELINE.map((stage, idx) => {
                                     const stStatus = getStageStatus(stage);
                                     const isCurrent = stStatus === 'IN_PROGRESS';
                                     const visited = stStatus !== 'pending';
                                     const color = statusColor(stStatus);
                                     const entries = data.scan_history.filter(h => 
                                         h.station === stage.name || 
                                         h.station === stage.code || 
                                         h.station === stage.label
                                     );
                                     const isLast = idx === PRODUCTION_PIPELINE.length - 1;

                                     return (
                                         <React.Fragment key={stage.code}>
                                             <div className={`${styles.pipelineNode} ${isCurrent ? styles.pipelineNodeActive : ''}`}>
                                                 <div className={styles.pipelineNodeDot} style={{
                                                     background: color,
                                                     boxShadow: isCurrent ? `0 0 0 6px ${color}33, 0 0 20px ${color}44` : `0 0 0 4px ${color}22`,
                                                 }}>
                                                     <StationIcon station={stage.code} />
                                                 </div>
                                                 <div className={styles.pipelineNodeLabel} style={{ color: visited ? '#1e293b' : '#94a3b8' }}>
                                                     {stage.label}
                                                     {isCurrent && <span className={styles.liveTag}>LIVE</span>}
                                                 </div>
                                                 {visited ? <StatusBadge status={stStatus} small /> : <span className={styles.pendingTag}>Pending</span>}
                                                 {entries.length > 1 && (
                                                     <span className={styles.rescannedTag}>×{entries.length} scans</span>
                                                 )}
                                             </div>

                                             {/* Repair branch nodes */}
                                             {entries.some(e => e.status === 'REWORK') && (() => {
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

                                             {entries.some(e => e.status === 'DEBUG') && (() => {
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

                                                        {entry.repair_time && (
                                                            <div className={`${styles.timelineDetail} ${styles.repairDetail}`}>
                                                                <Clock size={12} style={{ color: '#10b981' }} />
                                                                <span><strong>Repaired At:</strong> {fmt(entry.repair_time)}</span>
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
                        <h3 className={styles.panelTitle}><Activity size={18} /> Full Audit Log</h3>
                        <div className={styles.tableWrap}>
                            <table className={styles.auditTable}>
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Stage</th>
                                        <th>Action</th>
                                        <th>Operator</th>
                                        <th>Date & Time</th>
                                        <th>Failure Remark</th>
                                        <th>Repair Note</th>
                                        <th>Repaired At</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.scan_history.length === 0 ? (
                                        <tr><td colSpan={8} className={styles.emptyRow}>No records.</td></tr>
                                    ) : data.scan_history.map((row, idx) => (
                                        <tr key={idx} className={row.station === 'Rework' || row.station === 'Debug' ? styles.repairRow : ''}>
                                            <td className={styles.auditIdx}>{idx + 1}</td>
                                            <td><strong>{row.station}</strong></td>
                                            <td><StatusBadge status={row.status} small /></td>
                                            <td>{row.scanned_by}</td>
                                            <td className={styles.auditTime}>{fmt(row.scanned_at)}</td>
                                            <td className={styles.remarkCell}>{row.remarks || row.failed_remarks || '—'}</td>
                                            <td className={styles.remarkCell}>{row.repair_remark || '—'}</td>
                                            <td className={styles.auditTime}>{row.repair_time ? fmt(row.repair_time) : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Dedicated Hidden Printable PDF Section */}
                    <div 
                        ref={printRef} 
                        id="hidden-pdf-report" 
                        style={{ 
                            position: 'absolute', 
                            left: '-9999px', 
                            top: '-9999px', 
                            width: '800px', 
                            background: '#ffffff', 
                            padding: '40px', 
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
                                    PCB BARCODE TRACEABILITY AUDIT REPORT
                                </p>
                            </div>
                            <div style={{ textAlign: 'right', fontSize: '10px', color: '#64748b' }}>
                                <div>Report Date: {new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}</div>
                                <div>Generated By: {user?.name || 'Operator'}</div>
                            </div>
                        </div>

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
                            {data.unit_serial_number && (
                                <div style={{ gridColumn: 'span 2' }}>
                                    <span style={{ color: '#64748b', fontWeight: 600, display: 'inline-block', width: '120px' }}>Unit Serial Number</span>
                                    <span style={{ color: '#16a34a', fontWeight: 700 }}>: {data.unit_serial_number}</span>
                                </div>
                            )}
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
                                    <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1', width: '80px' }}>Stage</th>
                                    <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1', width: '80px' }}>Action</th>
                                    <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1', width: '90px' }}>Operator</th>
                                    <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1', width: '120px' }}>Date & Time</th>
                                    <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>Remarks / Failure</th>
                                    <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>Repair Note</th>
                                    <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1', width: '120px' }}>Repaired At</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.scan_history.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} style={{ padding: '12px', textAlign: 'center', color: '#64748b', border: '1px solid #cbd5e1' }}>
                                            No scan events recorded yet.
                                        </td>
                                    </tr>
                                ) : (
                                    data.scan_history.map((row, idx) => {
                                        const isRepair = row.station === 'Rework' || row.station === 'Debug';
                                        return (
                                            <tr 
                                                key={idx} 
                                                style={{ 
                                                    background: isRepair ? '#fffbeb' : idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                                                    color: '#1e293b'
                                                }}
                                            >
                                                <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', fontWeight: 600, textAlign: 'center' }}>{idx + 1}</td>
                                                <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', fontWeight: 700 }}>{row.station}</td>
                                                <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>
                                                    <span style={{
                                                        display: 'inline-block',
                                                        padding: '2px 6px',
                                                        borderRadius: '4px',
                                                        fontWeight: 700,
                                                        fontSize: '9px',
                                                        background: statusBg(row.status),
                                                        color: statusColor(row.status),
                                                        border: `1px solid ${statusColor(row.status)}33`
                                                    }}>
                                                        {row.status.toUpperCase()}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>{row.scanned_by}</td>
                                                <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', whiteSpace: 'nowrap' }}>{fmt(row.scanned_at)}</td>
                                                <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', wordBreak: 'break-word' }}>
                                                    {row.remarks || row.failed_remarks || '—'}
                                                </td>
                                                <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', wordBreak: 'break-word' }}>
                                                    {row.repair_remark || '—'}
                                                </td>
                                                <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', whiteSpace: 'nowrap' }}>
                                                    {row.repair_time ? fmt(row.repair_time) : '—'}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>

                        {/* PDF Footer Page Note */}
                        <div style={{ marginTop: '30px', borderTop: '1px solid #e2e8f0', paddingTop: '10px', textAlign: 'center', fontSize: '9px', color: '#94a3b8' }}>
                            This report is an official computer-generated audit log from the Velankani Software Manufacturing Execution System (MES).
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default TrackItems;
