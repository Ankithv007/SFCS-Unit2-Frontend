import React, { useState, useRef, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import styles from './TrackItems.module.css';
import {
    Search, Package, CheckCircle, AlertTriangle,
    Clock, Activity, Zap, ArrowDown, RotateCcw, ChevronRight,
    User, Calendar, FileText, Wrench, MapPin, TrendingUp
} from 'lucide-react';

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

const PRODUCTION_PIPELINE = ['PTH', 'VI', 'QA', 'Flashing', 'PCBA-FCT', 'Assembly', 'Unit Testing', 'QI', 'Packing'];

const fmt = (ts: string | null | undefined) =>
    ts ? new Date(ts).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' }) : '—';

const statusColor = (s: string): string => {
    switch (s.toUpperCase()) {
        case 'ACCEPTED': case 'PASS': return '#10b981';
        case 'REWORK': return '#f59e0b';
        case 'DEBUG': return '#ef4444';
        case 'READY_FOR_RESCAN': return '#6366f1';
        default: return '#94a3b8';
    }
};

const statusBg = (s: string): string => {
    switch (s.toUpperCase()) {
        case 'ACCEPTED': case 'PASS': return 'rgba(16,185,129,0.12)';
        case 'REWORK': return 'rgba(245,158,11,0.12)';
        case 'DEBUG': return 'rgba(239,68,68,0.12)';
        case 'READY_FOR_RESCAN': return 'rgba(99,102,241,0.12)';
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
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<TrackResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [appeared, setAppeared] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

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

    // Compute which pipeline stages were visited
    const visitedStages = new Set(data?.scan_history.map(h => h.station) ?? []);

    const getStageStatus = (stageName: string): string => {
        const entries = data?.scan_history.filter(h => h.station === stageName) ?? [];
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
                        <h1 className={styles.headerTitle}>Barcode Traceability</h1>
                        <p className={styles.headerSub}>Complete production lifecycle visibility</p>
                    </div>
                </div>
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
                <div className={`${styles.resultsWrap} ${appeared ? styles.revealed : ''}`}>

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
                                    const visited = visitedStages.has(stage);
                                    const stStatus = visited ? getStageStatus(stage) : 'pending';
                                    const isCurrent = isCurrentStage(stage);
                                    const color = visited ? statusColor(stStatus) : '#cbd5e1';
                                    const entries = data.scan_history.filter(h => h.station === stage);
                                    const isLast = idx === PRODUCTION_PIPELINE.length - 1;

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

                                            {/* Repair branch nodes */}
                                            {entries.some(e => e.status === 'REWORK') && (
                                                <div className={styles.repairBranch}>
                                                    <div className={styles.branchLine} />
                                                    <div className={styles.branchNode} style={{ background: 'rgba(245,158,11,0.08)', borderColor: '#f59e0b44' }}>
                                                        <RotateCcw size={12} style={{ color: '#f59e0b' }} />
                                                        <span style={{ color: '#f59e0b', fontWeight: 700 }}>REWORK</span>
                                                        <span style={{ color: '#64748b', fontSize: '0.7rem' }}>repair queue</span>
                                                    </div>
                                                </div>
                                            )}
                                            {entries.some(e => e.status === 'DEBUG') && (
                                                <div className={styles.repairBranch}>
                                                    <div className={styles.branchLine} />
                                                    <div className={styles.branchNode} style={{ background: 'rgba(239,68,68,0.08)', borderColor: '#ef444444' }}>
                                                        <Wrench size={12} style={{ color: '#ef4444' }} />
                                                        <span style={{ color: '#ef4444', fontWeight: 700 }}>DEBUG</span>
                                                        <span style={{ color: '#64748b', fontSize: '0.7rem' }}>repair queue</span>
                                                    </div>
                                                </div>
                                            )}

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
            )}
        </div>
    );
};

export default TrackItems;
