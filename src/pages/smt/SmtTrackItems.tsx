import React, { useState, useRef, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import styles from './SmtTrackItems.module.css';
import {
    Search, Package, AlertTriangle,
    Clock, Activity, Zap, ArrowDown, RotateCcw, ChevronRight,
    FileText, TrendingUp, Download, Cpu, MapPin
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScanEntry {
    id: number;
    process_step: string;
    status: string;
    scanned_by: string;
    scanned_at: string;
    rework_reason: string | null;
}

interface SmtTrackResult {
    serial_number: string;
    serial_format: string;
    work_order_id: string;
    product_name: string;
    quantity: number;
    line_id: string;
    current_stage: string;
    current_status: string;
    final_status_label: string;
    created_at: string;
    total_failures: number;
    total_reworks: number;
    total_passed: number;
    scan_history: ScanEntry[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SMT_PIPELINE = ['Serial Number', 'PCB Generation', 'Printing', 'SPI', 'Pre AOI', 'Post AOI', 'Rework', 'SMT FG'];

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

const StationIcon: React.FC<{ station: string }> = ({ station }) => {
    const s = station.toLowerCase();
    if (s === 'rework') return <RotateCcw size={16} />;
    if (s === 'printing') return <Cpu size={16} />;
    return <Zap size={16} />;
};

// ─── Component ────────────────────────────────────────────────────────────────

const SmtTrackItems: React.FC = () => {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<SmtTrackResult | null>(null);
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
            const result: SmtTrackResult = await apiFetch(`/api/smt/track/${encodeURIComponent(q)}`);
            setData(result);
            setTimeout(() => setAppeared(true), 50);
        } catch (err: any) {
            setError(err.message || 'Serial Number not found in system.');
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

            pdf.save(`SMT_Traceability_Report_${data?.serial_number || 'record'}.pdf`);
        } catch (error) {
            console.error("PDF Download Failed:", error);
        } finally {
            setIsDownloading(false);
        }
    };

    const visitedStages = new Set(data?.scan_history.map(h => h.process_step) ?? []);

    const getStageStatus = (stageName: string): string => {
        const entries = data?.scan_history.filter(h => h.process_step === stageName) ?? [];
        if (!entries.length) return 'pending';
        const last = entries[entries.length - 1];
        return last.status;
    };

    const isCurrentStage = (stageName: string) => data?.current_stage === stageName;

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
                            placeholder="Scan or enter Serial Number…"
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
                                <div className={styles.summaryValue}>{data.work_order_id}</div>
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
                        <div className={styles.statPill} style={{ '--c': '#10b981' } as React.CSSProperties}>
                            <span className={styles.statNum}>{data.total_passed}</span>
                            <span className={styles.statLbl}>Total Passed</span>
                        </div>
                        <div className={styles.statPill} style={{ '--c': '#f59e0b' } as React.CSSProperties}>
                            <span className={styles.statNum}>{data.total_reworks}</span>
                            <span className={styles.statLbl}>Rework Events</span>
                        </div>
                        <div className={styles.statPill} style={{ '--c': '#ef4444' } as React.CSSProperties}>
                            <span className={styles.statNum}>{data.total_failures}</span>
                            <span className={styles.statLbl}>Total Failures</span>
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
                            <h3 className={styles.panelTitle}><ChevronRight size={18} /> SMT Production Pipeline</h3>

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
                                                <div className={styles.pipelineNodeDot} style={{
                                                    background: color,
                                                    boxShadow: isCurrent ? `0 0 0 6px ${color}33, 0 0 20px ${color}44` : `0 0 0 4px ${color}22`,
                                                }}>
                                                    <StationIcon station={stage} />
                                                </div>
                                                <div className={styles.pipelineNodeLabel} style={{ color: visited ? '#1e293b' : '#94a3b8' }}>
                                                    {stage}
                                                    {isCurrent && <span className={styles.liveTag}>LIVE</span>}
                                                </div>
                                                {visited ? <StatusBadge status={stStatus} small /> : <span className={styles.pendingTag}>Pending</span>}
                                                {entries.length > 1 && (
                                                    <span className={styles.rescannedTag}>×{entries.length} scans</span>
                                                )}
                                            </div>

                                            {!isLast && <div className={styles.pipelineConnector}><ArrowDown size={14} /></div>}
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        </div>

                        {/* RIGHT: Scan History Table */}
                        <div className={styles.historyPanel}>
                            <h3 className={styles.panelTitle}><Clock size={18} /> Scan History</h3>

                            <div className={styles.tableContainer}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                                    <thead>
                                        <tr style={{ background: '#1e3a8a', color: '#ffffff' }}>
                                            <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>#</th>
                                            <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>Process Step</th>
                                            <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>Status</th>
                                            <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>Scanned By</th>
                                            <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>Scanned At</th>
                                            <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>Rework Reason</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.scan_history.length === 0 ? (
                                            <tr><td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>No records.</td></tr>
                                        ) : data.scan_history.map((row, idx) => (
                                            <tr key={idx} style={{ background: row.status === 'REWORK' ? 'rgba(245,158,11,0.05)' : row.status === 'FAIL' ? 'rgba(239,68,68,0.05)' : '#f9fafb' }}>
                                                <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', fontWeight: 600 }}>{idx + 1}</td>
                                                <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', fontWeight: 600 }}>{row.process_step}</td>
                                                <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>
                                                    <span style={{
                                                        fontSize: '9px',
                                                        background: statusBg(row.status),
                                                        color: statusColor(row.status),
                                                        border: `1px solid ${statusColor(row.status)}33`,
                                                        padding: '2px 6px',
                                                        borderRadius: '3px',
                                                    }}>
                                                        {row.status.toUpperCase()}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>{row.scanned_by}</td>
                                                <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', whiteSpace: 'nowrap' }}>{fmt(row.scanned_at)}</td>
                                                <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', wordBreak: 'break-word' }}>
                                                    {row.rework_reason || '—'}
                                                </td>
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

            {/* ── Print Content (Hidden) ── */}
            <div ref={printRef} style={{ position: 'absolute', left: '-10000px', top: 0, width: '794px', pointerEvents: 'none' }}>
                {data && (
                    <div style={{ padding: '20px', background: '#fff', fontFamily: 'Arial, sans-serif' }}>
                        <h1 style={{ marginBottom: '10px', color: '#1e293b' }}>SMT Serial Traceability Report</h1>
                        <p style={{ color: '#64748b', marginBottom: '20px' }}>Generated on {new Date().toLocaleString('en-IN')}</p>
                        
                        <div style={{ marginBottom: '20px', padding: '15px', background: '#f1f5f9', borderRadius: '8px' }}>
                            <p><strong>Serial Number:</strong> {data.serial_number}</p>
                            <p><strong>Work Order:</strong> {data.work_order_id}</p>
                            <p><strong>Product:</strong> {data.product_name}</p>
                            <p><strong>Status:</strong> {data.final_status_label}</p>
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
                            <thead>
                                <tr style={{ background: '#1e3a8a', color: '#ffffff' }}>
                                    <th style={{ padding: '8px', border: '1px solid #cbd5e1' }}>#</th>
                                    <th style={{ padding: '8px', border: '1px solid #cbd5e1' }}>Process</th>
                                    <th style={{ padding: '8px', border: '1px solid #cbd5e1' }}>Status</th>
                                    <th style={{ padding: '8px', border: '1px solid #cbd5e1' }}>Operator</th>
                                    <th style={{ padding: '8px', border: '1px solid #cbd5e1' }}>Timestamp</th>
                                    <th style={{ padding: '8px', border: '1px solid #cbd5e1' }}>Remark</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.scan_history.map((row, idx) => (
                                    <tr key={idx}>
                                        <td style={{ padding: '8px', border: '1px solid #cbd5e1' }}>{idx + 1}</td>
                                        <td style={{ padding: '8px', border: '1px solid #cbd5e1' }}><strong>{row.process_step}</strong></td>
                                        <td style={{ padding: '8px', border: '1px solid #cbd5e1' }}>{row.status}</td>
                                        <td style={{ padding: '8px', border: '1px solid #cbd5e1' }}>{row.scanned_by}</td>
                                        <td style={{ padding: '8px', border: '1px solid #cbd5e1' }}>{fmt(row.scanned_at)}</td>
                                        <td style={{ padding: '8px', border: '1px solid #cbd5e1' }}>{row.rework_reason || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SmtTrackItems;
