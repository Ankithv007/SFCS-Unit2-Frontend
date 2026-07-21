import React, { useState, useEffect } from 'react';
import styles from './SmtDowntimeTracker.module.css';
import { useToast } from '../../components/Toast';
import { apiFetch } from '../../utils/api';

// Interface matching the database record
interface DowntimeRecord {
    id?: string;
    shift: string;
    line: string;
    machine_name: string;
    start_time: string;
    end_time: string;
    duration?: number;
    downtime_category: string;
    downtime_description: string;
    action_taken: string;
    responsible_person: string;
    status: string;
    remarks?: string;
    created_by?: string;
    created_by_name?: string;
    created_at?: string;
    updated_by?: string;
    updated_by_name?: string;
    updated_at?: string;
    work_order_number?: string;
}





const SmtDowntimeTracker: React.FC = () => {
    const { showToast } = useToast();

    // Form states
    const [shift, setShift] = useState('');
    const [line, setLine] = useState('');
    const [machineName, setMachineName] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [duration, setDuration] = useState(0);
    const [downtimeCategory, setDowntimeCategory] = useState('');
    const [downtimeDescription, setDowntimeDescription] = useState('');
    const [actionTaken, setActionTaken] = useState('');
    const [responsiblePerson, setResponsiblePerson] = useState('');
    const [status, setStatus] = useState('Open');
    const [remarks, setRemarks] = useState('');

    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    // Records table states
    const [records, setRecords] = useState<DowntimeRecord[]>([]);
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('start_time');
    const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const [loading, setLoading] = useState(false);

    // Dashboard metrics state
    const [metrics, setMetrics] = useState<any>({
        summary: {
            total_records: 0,
            total_duration: 0,
            avg_duration: 0,
            open_issues: 0,
            closed_issues: 0,
            most_affected_machine: 'N/A',
            most_frequent_category: 'N/A'
        },
        charts: {
            category: [],
            machine: [],
            shift: [],
            status: []
        }
    });

    // View Modal state
    const [viewRecord, setViewRecord] = useState<DowntimeRecord | null>(null);
    if (metrics === null) {
        console.log(metrics);
    }

    // Analytics states
    const [analyticsRecords, setAnalyticsRecords] = useState<DowntimeRecord[]>([]);
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [totalTimeAvailable, setTotalTimeAvailable] = useState<number | ''>('');
    const [totalProduction, setTotalProduction] = useState<number | ''>('');
    const [idealCycleTime, setIdealCycleTime] = useState<number | ''>('');
    const [scrapProduced, setScrapProduced] = useState<number | ''>('');
    const [reasonCode, setReasonCode] = useState('');
    const [activeTooltip, setActiveTooltip] = useState<{ visible: boolean; text: string; x: number; y: number }>({ visible: false, text: '', x: 0, y: 0 });
    const [hoveredSlice, setHoveredSlice] = useState<{ chart: string; index: number } | null>(null);

    const fetchAnalyticsRecords = async () => {
        try {
            const res = await apiFetch('/api/smt/downtime-records?page=1&limit=10000');
            if (res.success) {
                setAnalyticsRecords(res.data);
            }
        } catch (err) {
            console.error('Error fetching analytics records:', err);
        }
    };

    // Calculate duration automatically whenever startTime or endTime changes
    useEffect(() => {
        if (startTime && endTime) {
            const start = new Date(startTime);
            const end = new Date(endTime);
            if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                const diffMinutes = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60));
                setDuration(parseFloat(diffMinutes.toFixed(2)));
            } else {
                setDuration(0);
            }
        } else {
            setDuration(0);
        }
    }, [startTime, endTime]);

    // Direct fetch handlers (matching SmtTrackItems pattern)
    const fetchRecords = async () => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams({
                page: String(page),
                limit: '10',
                ...(search ? { search } : {}),
                ...(sortBy ? { sortBy } : {}),
                ...(sortOrder ? { sortOrder } : {})
            });
            const res = await apiFetch(`/api/smt/downtime-records?${queryParams.toString()}`);
            if (res.success) {
                setRecords(res.data);
                setTotalPages(res.pagination.pages);
                setTotalRecords(res.pagination.total);
            }
        } catch (err: any) {
            console.error('Error loading downtime records:', err);
            showToast('Failed to load downtime records.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchDashboardMetrics = async () => {
        try {
            const res = await apiFetch('/api/smt/downtime-records/dashboard');
            if (res.success) {
                setMetrics(res.data);
            }
        } catch (err) {
            console.error('Error loading dashboard metrics:', err);
        }
    };

    useEffect(() => {
        fetchRecords();
    }, [page, search, sortBy, sortOrder]);

    useEffect(() => {
        fetchDashboardMetrics();
        fetchAnalyticsRecords();
    }, []);

    const handleSort = (field: string) => {
        if (sortBy === field) {
            setSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC');
        } else {
            setSortBy(field);
            setSortOrder('DESC');
        }
        setPage(1);
    };

    const handleClear = () => {
        setShift('');
        setLine('');
        setMachineName('');
        setStartTime('');
        setEndTime('');
        setDuration(0);
        setDowntimeCategory('');
        setDowntimeDescription('');
        setActionTaken('');
        setResponsiblePerson('');
        setStatus('Open');
        setRemarks('');
        setReasonCode('');
        setEditingId(null);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        // Frontend validations
        if (!shift || !line || !machineName || !startTime || !endTime || !downtimeCategory || !reasonCode || !downtimeDescription || !actionTaken || !responsiblePerson || !status) {
            showToast('Please fill all mandatory fields.', 'error');
            return;
        }

        const start = new Date(startTime);
        const end = new Date(endTime);
        if (end <= start) {
            showToast('End Time must be greater than Start Time.', 'error');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                shift,
                line,
                machine_name: machineName,
                start_time: startTime,
                end_time: endTime,
                downtime_category: downtimeCategory,
                downtime_description: `[Reason Code: ${reasonCode}] ${downtimeDescription}`,
                action_taken: actionTaken,
                responsible_person: responsiblePerson,
                status,
                remarks
            };

            if (editingId) {
                const res = await apiFetch(`/api/smt/downtime-records/${editingId}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
                if (res.success) {
                    showToast('Downtime record updated successfully.', 'success');
                    handleClear();
                    fetchRecords();
                    fetchDashboardMetrics();
                    fetchAnalyticsRecords();
                }
            } else {
                const res = await apiFetch('/api/smt/downtime-records', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                if (res.success) {
                    showToast('Downtime record created successfully.', 'success');
                    handleClear();
                    fetchRecords();
                    fetchDashboardMetrics();
                    fetchAnalyticsRecords();
                }
            }
        } catch (err: any) {
            console.error('Error saving downtime record:', err);
            showToast(err.message || 'Failed to save downtime record.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (record: DowntimeRecord) => {
        if (!record.id) return;
        setEditingId(record.id);
        setShift(record.shift);
        setLine(record.line);
        setMachineName(record.machine_name);

        const formatDateForInput = (isoString?: string) => {
            if (!isoString) return '';
            const d = new Date(isoString);
            const pad = (n: number) => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        };

        setStartTime(formatDateForInput(record.start_time));
        setEndTime(formatDateForInput(record.end_time));
        setDowntimeCategory(record.downtime_category);
        
        const match = (record.downtime_description || '').match(/^\[Reason Code: ([^\]]+)\]\s*(.*)$/);
        if (match) {
            setReasonCode(match[1]);
            setDowntimeDescription(match[2]);
        } else {
            setReasonCode('');
            setDowntimeDescription(record.downtime_description || '');
        }

        setActionTaken(record.action_taken);
        setResponsiblePerson(record.responsible_person);
        setStatus(record.status);
        setRemarks(record.remarks || '');

        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id?: string) => {
        if (!id) return;
        if (!window.confirm('Are you sure you want to delete this record?')) return;

        try {
            const res = await apiFetch(`/api/smt/downtime-records/${id}`, {
                method: 'DELETE'
            });
            if (res.success) {
                showToast('Record deleted successfully.', 'success');
                fetchRecords();
                fetchDashboardMetrics();
                fetchAnalyticsRecords();
            }
        } catch (err: any) {
            console.error('Error deleting downtime record:', err);
            showToast(err.message || 'Failed to delete record.', 'error');
        }
    };

    const formatDateTime = (isoString?: string) => {
        if (!isoString) return '—';
        const d = new Date(isoString);
        return d.toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };


    const timeAvailable = typeof totalTimeAvailable === 'number' ? totalTimeAvailable : 0;
    const production = typeof totalProduction === 'number' ? totalProduction : 0;
    const cycleTime = typeof idealCycleTime === 'number' ? idealCycleTime : 0;
    const scrap = typeof scrapProduced === 'number' ? scrapProduced : 0;

    // Filter downtime logs based on date range for OEE
    const filteredForOee = analyticsRecords.filter(record => {
        if (!record.start_time) return false;
        const recordDate = new Date(record.start_time).getTime();
        const start = fromDate ? new Date(fromDate + 'T00:00:00').getTime() : null;
        const end = toDate ? new Date(toDate + 'T23:59:59').getTime() : null;
        if (start && recordDate < start) return false;
        if (end && recordDate > end) return false;
        return true;
    });

    const plannedDowntime = filteredForOee
        .filter(r => r.downtime_category === 'Planned')
        .reduce((sum, r) => sum + (Number(r.duration) || 0), 0);

    const unplannedDowntime = filteredForOee
        .filter(r => r.downtime_category === 'Unplanned')
        .reduce((sum, r) => sum + (Number(r.duration) || 0), 0);

    const operatingTime = Math.max(0, timeAvailable - plannedDowntime - unplannedDowntime);

    const availabilityRateDivisor = timeAvailable - plannedDowntime;
    const availabilityRate = availabilityRateDivisor > 0 
        ? (operatingTime / availabilityRateDivisor) * 100 
        : 0;

    const actualRunRate = operatingTime > 0 ? (production / operatingTime) : 0;
    const performanceRate = cycleTime > 0 
        ? (actualRunRate / cycleTime) * 100 
        : 0;

    const qualityRate = production > 0 
        ? ((production - scrap) / production) * 100 
        : 0;

    const oee = (availabilityRate * performanceRate * qualityRate) / 10000;

    const aLoss = 100 - availabilityRate;
    const pLoss = 100 - performanceRate;
    const qLoss = 100 - qualityRate;

    const renderSimplePieChart = (value: number, color: string, lossColor: string, label: string) => {
        const actualRate = value;
        const actualLoss = 100 - value;

        const val = Math.min(100, Math.max(0, value));
        const loss = 100 - val;

        const slices = [
            { label: 'Rate', value: val, actualValue: actualRate, color: color },
            { label: 'Loss', value: loss, actualValue: actualLoss, color: lossColor }
        ];

        const totalSlicesValue = slices.reduce((sum, s) => sum + s.value, 0) || 1;
        const nonZeroSlices = slices.filter(s => s.value > 0).length;
        const minVis = 10; 
        const remainingVis = 100 - (nonZeroSlices * minVis);

        const visualSlices = slices.map(s => {
            if (s.value === 0) return { ...s, visPercent: 0 };
            return { ...s, visPercent: minVis + ((s.value / totalSlicesValue) * remainingVis) };
        });

        let accumulatedPercent = 0;
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', width: '100%', maxWidth: '240px' }}>
                <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', color: '#334155' }}>{label}</h4>
                <div style={{ width: '220px', height: '220px', position: 'relative' }}>
                    <svg viewBox="-150 -150 300 300" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                        {visualSlices.map((slice, index) => {
                            const percent = slice.visPercent / 100;
                            if (percent === 0) return null;
                            const angleSpan = percent * 360;
                            const startAngle = accumulatedPercent * 360 - 90;
                            const endAngle = (accumulatedPercent + percent) * 360 - 90;
                            accumulatedPercent += percent;

                            const radStart = (startAngle * Math.PI) / 180;
                            const radEnd = (endAngle * Math.PI) / 180;
                            const midAngle = startAngle + (angleSpan / 2);
                            const radMid = (midAngle * Math.PI) / 180;

                            const R = 100;
                            const x1 = R * Math.cos(radStart);
                            const y1 = R * Math.sin(radStart);
                            const x2 = R * Math.cos(radEnd);
                            const y2 = R * Math.sin(radEnd);

                            const isHovered = hoveredSlice?.chart === label && hoveredSlice?.index === index;
                            const explodeDist = isHovered ? 12 : 0;
                            const explodeX = explodeDist * Math.cos(radMid);
                            const explodeY = explodeDist * Math.sin(radMid);

                            const isSmall = slice.value < 18;
                            const textR = isSmall ? 122 : 62;
                            const tx = textR * Math.cos(radMid);
                            const ty = textR * Math.sin(radMid);

                            const lx1 = 60 * Math.cos(radMid);
                            const ly1 = 60 * Math.sin(radMid);
                            const lx2 = 115 * Math.cos(radMid);
                            const ly2 = 115 * Math.sin(radMid);

                            let textAnchor: "inherit" | "end" | "start" | "middle" | undefined = "middle";
                            const cosAngle = Math.cos(radMid);
                            if (isSmall) {
                                if (cosAngle > 0.1) textAnchor = "start";
                                else if (cosAngle < -0.1) textAnchor = "end";
                            }

                            const largeArc = angleSpan > 180 ? 1 : 0;
                            const pathData = percent === 1
                                ? `M 0 0 h 0 A ${R} ${R} 0 1 1 0 -${R} Z`
                                : `M 0 0 L ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2} Z`;

                            return (
                                <g key={index} style={{ transform: `translate(${explodeX}px, ${explodeY}px)`, transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                                    <path 
                                        d={pathData} 
                                        fill={slice.color} 
                                        stroke="#ffffff" 
                                        strokeWidth="2" 
                                        style={{ cursor: 'pointer' }}
                                        onMouseEnter={(e) => {
                                            setHoveredSlice({ chart: label, index });
                                            setActiveTooltip({ visible: true, text: `${label} ${slice.label}: ${slice.actualValue.toFixed(2)}%`, x: e.clientX, y: e.clientY });
                                        }}
                                        onMouseMove={(e) => setActiveTooltip(prev => ({ ...prev, x: e.clientX, y: e.clientY }))}
                                        onMouseLeave={() => {
                                            setHoveredSlice(null);
                                            setActiveTooltip(prev => ({ ...prev, visible: false }));
                                        }}
                                        onClick={() => {
                                            setHoveredSlice({ chart: label, index });
                                        }}
                                    />
                                    {isSmall && (
                                        <line x1={lx1} y1={ly1} x2={lx2} y2={ly2} stroke="#475569" strokeWidth="1.5" strokeDasharray="3,3" />
                                    )}
                                    <g style={{ pointerEvents: 'none' }}>
                                        <text 
                                            x={tx} 
                                            y={ty - 4} 
                                            textAnchor={textAnchor} 
                                            fill={isSmall ? '#1e293b' : '#ffffff'} 
                                            style={{ fontSize: '10px', fontWeight: '800', textShadow: isSmall ? 'none' : '0 1px 3px rgba(0,0,0,0.8)' }}
                                        >
                                            {slice.label}
                                        </text>
                                        <text 
                                            x={tx} 
                                            y={ty + 8} 
                                            textAnchor={textAnchor} 
                                            fill={isSmall ? '#1e293b' : '#ffffff'} 
                                            style={{ fontSize: '10px', fontWeight: '800', textShadow: isSmall ? 'none' : '0 1px 3px rgba(0,0,0,0.8)' }}
                                        >
                                            {slice.actualValue.toFixed(2)}%
                                        </text>
                                    </g>
                                </g>
                            );
                        })}
                    </svg>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '100%', padding: '0.5rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.8rem' }}>
                    {slices.map((slice, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#475569', fontWeight: 500 }}>
                                <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: slice.color }} />
                                {slice.label}:
                            </span>
                            <span style={{ fontWeight: 'bold', color: '#1e293b' }}>{slice.actualValue.toFixed(2)}%</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderOeePieChart = (oeeVal: number, aLossVal: number, pLossVal: number, qLossVal: number) => {
        const slices = [
            { label: 'OEE', value: Math.max(0, oeeVal), actualValue: oeeVal, color: '#10b981' },
            { label: 'Avail Loss', value: Math.max(0, aLossVal), actualValue: aLossVal, color: '#ef4444' },
            { label: 'Perf Loss', value: Math.max(0, pLossVal), actualValue: pLossVal, color: '#f59e0b' },
            { label: 'Qual Loss', value: Math.max(0, qLossVal), actualValue: qLossVal, color: '#3b82f6' }
        ];

        const totalSlicesValue = slices.reduce((sum, s) => sum + s.value, 0) || 1;
        const nonZeroSlices = slices.filter(s => s.value > 0).length;
        const minVis = 10; 
        const remainingVis = 100 - (nonZeroSlices * minVis);

        const visualSlices = slices.map(s => {
            if (s.value === 0) return { ...s, visPercent: 0 };
            return { ...s, visPercent: minVis + ((s.value / totalSlicesValue) * remainingVis) };
        });

        let accumulatedPercent = 0;
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', width: '100%', maxWidth: '240px' }}>
                <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', color: '#334155' }}>Overall OEE Chart</h4>
                <div style={{ width: '220px', height: '220px', position: 'relative' }}>
                    <svg viewBox="-150 -150 300 300" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                        {visualSlices.map((slice, index) => {
                            const percent = slice.visPercent / 100;
                            if (percent === 0) return null;
                            const angleSpan = percent * 360;
                            const startAngle = accumulatedPercent * 360 - 90;
                            const endAngle = (accumulatedPercent + percent) * 360 - 90;
                            accumulatedPercent += percent;

                            const radStart = (startAngle * Math.PI) / 180;
                            const radEnd = (endAngle * Math.PI) / 180;
                            const midAngle = startAngle + (angleSpan / 2);
                            const radMid = (midAngle * Math.PI) / 180;

                            const R = 100;
                            const x1 = R * Math.cos(radStart);
                            const y1 = R * Math.sin(radStart);
                            const x2 = R * Math.cos(radEnd);
                            const y2 = R * Math.sin(radEnd);

                            const isHovered = hoveredSlice?.chart === 'OEE' && hoveredSlice?.index === index;
                            const explodeDist = isHovered ? 12 : 0;
                            const explodeX = explodeDist * Math.cos(radMid);
                            const explodeY = explodeDist * Math.sin(radMid);

                            const isSmall = slice.value < 18;
                            const textR = isSmall ? 122 : 62;
                            const tx = textR * Math.cos(radMid);
                            const ty = textR * Math.sin(radMid);

                            const lx1 = 60 * Math.cos(radMid);
                            const ly1 = 60 * Math.sin(radMid);
                            const lx2 = 115 * Math.cos(radMid);
                            const ly2 = 115 * Math.sin(radMid);

                            let textAnchor: "inherit" | "end" | "start" | "middle" | undefined = "middle";
                            const cosAngle = Math.cos(radMid);
                            if (isSmall) {
                                if (cosAngle > 0.1) textAnchor = "start";
                                else if (cosAngle < -0.1) textAnchor = "end";
                            }

                            const largeArc = angleSpan > 180 ? 1 : 0;
                            const pathData = percent === 1
                                ? `M 0 0 h 0 A ${R} ${R} 0 1 1 0 -${R} Z`
                                : `M 0 0 L ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2} Z`;

                            return (
                                <g key={index} style={{ transform: `translate(${explodeX}px, ${explodeY}px)`, transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                                    <path 
                                        d={pathData} 
                                        fill={slice.color} 
                                        stroke="#ffffff" 
                                        strokeWidth="2" 
                                        style={{ cursor: 'pointer' }}
                                        onMouseEnter={(e) => {
                                            setHoveredSlice({ chart: 'OEE', index });
                                            setActiveTooltip({ visible: true, text: `${slice.label}: ${slice.actualValue.toFixed(2)}%`, x: e.clientX, y: e.clientY });
                                        }}
                                        onMouseMove={(e) => setActiveTooltip(prev => ({ ...prev, x: e.clientX, y: e.clientY }))}
                                        onMouseLeave={() => {
                                            setHoveredSlice(null);
                                            setActiveTooltip(prev => ({ ...prev, visible: false }));
                                        }}
                                        onClick={() => {
                                            setHoveredSlice({ chart: 'OEE', index });
                                        }}
                                    />
                                    {isSmall && (
                                        <line x1={lx1} y1={ly1} x2={lx2} y2={ly2} stroke="#475569" strokeWidth="1.5" strokeDasharray="3,3" />
                                    )}
                                    <g style={{ pointerEvents: 'none' }}>
                                        <text 
                                            x={tx} 
                                            y={ty - 4} 
                                            textAnchor={textAnchor} 
                                            fill={isSmall ? '#1e293b' : '#ffffff'} 
                                            style={{ fontSize: '10px', fontWeight: '800', textShadow: isSmall ? 'none' : '0 1px 3px rgba(0,0,0,0.8)' }}
                                        >
                                            {slice.label}
                                        </text>
                                        <text 
                                            x={tx} 
                                            y={ty + 8} 
                                            textAnchor={textAnchor} 
                                            fill={isSmall ? '#1e293b' : '#ffffff'} 
                                            style={{ fontSize: '10px', fontWeight: '800', textShadow: isSmall ? 'none' : '0 1px 3px rgba(0,0,0,0.8)' }}
                                        >
                                            {slice.actualValue.toFixed(2)}%
                                        </text>
                                    </g>
                                </g>
                            );
                        })}
                    </svg>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '100%', padding: '0.5rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.8rem' }}>
                    {slices.map((slice, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#475569', fontWeight: 500 }}>
                                <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: slice.color }} />
                                {slice.label}:
                            </span>
                            <span style={{ fontWeight: 'bold', color: '#1e293b' }}>{slice.actualValue.toFixed(2)}%</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className={styles.container}>
            <div className={styles.headerRow}>
                <div className={styles.headerContent}>
                    <h2>⚠️ Downtime Tracker</h2>
                    <p>Log, track and visualize SMT machine downtime incidents</p>
                </div>
            </div>



            {/* Entry Form */}
            <div className={styles.card}>
                <h3>{editingId ? 'Edit Downtime Record' : 'Log New Downtime Incident'}</h3>
                <form onSubmit={handleSave}>
                    <div className={styles.formGrid}>
                        <div className={styles.inputGroup}>
                            <label>Shift <span>*</span></label>
                            <select value={shift} onChange={(e) => setShift(e.target.value)} className={styles.input} required>
                                <option value="">Select Shift</option>
                                <option value="Shift A">Shift A</option>
                                <option value="Shift B">Shift B</option>
                                <option value="Shift C">Shift C</option>
                                <option value="General Shift">General Shift</option>
                            </select>
                        </div>

                        <div className={styles.inputGroup}>
                            <label>Line <span>*</span></label>
                            <select value={line} onChange={(e) => setLine(e.target.value)} className={styles.input} required>
                                <option value="">Select Line</option>
                                <option value="Line 1">Line 1</option>
                                <option value="Line 2">Line 2</option>
                                <option value="Line 3">Line 3</option>
                            </select>
                        </div>

                        <div className={styles.inputGroup}>
                            <label>Machine Name <span>*</span></label>
                            <select value={machineName} onChange={(e) => setMachineName(e.target.value)} className={styles.input} required>
                                <option value="">Select Machine</option>
                                <option value="Laser Marker">Laser Marker</option>
                                <option value="Printer">Printer</option>
                                <option value="SPI">SPI</option>
                                <option value="Pick & Place">Pick & Place</option>
                                <option value="AOI">AOI</option>
                                <option value="Reflow">Reflow</option>
                            </select>
                        </div>

                        <div className={styles.inputGroup}>
                            <label>Start Time <span>*</span></label>
                            <input
                                type="datetime-local"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                                className={styles.input}
                                required
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label>End Time <span>*</span></label>
                            <input
                                type="datetime-local"
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                                className={styles.input}
                                required
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label>Duration (Minutes)</label>
                            <input
                                type="number"
                                value={duration}
                                className={styles.input}
                                disabled
                                readOnly
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label>Downtime Category <span>*</span></label>
                            <select value={downtimeCategory} onChange={(e) => setDowntimeCategory(e.target.value)} className={styles.input} required>
                                <option value="">Select Category</option>
                                <option value="Planned">Planned</option>
                                <option value="Unplanned">Unplanned</option>
                            </select>
                        </div>

                        <div className={styles.inputGroup}>
                            <label>Reason Code <span>*</span></label>
                            <select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)} className={styles.input} required>
                                <option value="">Select Reason Code</option>
                                <option value="Quality Issue">Quality Issue</option>
                                <option value="NPI Issue">NPI Issue</option>
                                <option value="Setup">Setup</option>
                                <option value="Program Change">Program Change</option>
                                <option value="Power Failure">Power Failure</option>
                                <option value="Material Shortage">Material Shortage</option>
                                <option value="Breakdown">Breakdown</option>
                            </select>
                        </div>

                        <div className={styles.inputGroup}>
                            <label>Responsible Person <span>*</span></label>
                            <input
                                type="text"
                                value={responsiblePerson}
                                onChange={(e) => setResponsiblePerson(e.target.value)}
                                className={styles.input}
                                placeholder="Enter Name"
                                required
                            />
                        </div>

                        <div className={`${styles.inputGroup} ${styles.formGridFull}`}>
                            <label>Downtime Description <span>*</span></label>
                            <textarea
                                value={downtimeDescription}
                                onChange={(e) => setDowntimeDescription(e.target.value)}
                                className={styles.input}
                                rows={3}
                                placeholder="Detail what triggered the downtime..."
                                required
                            />
                        </div>

                        <div className={`${styles.inputGroup} ${styles.formGridFull}`}>
                            <label>Action Taken <span>*</span></label>
                            <textarea
                                value={actionTaken}
                                onChange={(e) => setActionTaken(e.target.value)}
                                className={styles.input}
                                rows={3}
                                placeholder="Enter details of correction action..."
                                required
                            />
                        </div>

                        <div className={`${styles.inputGroup} ${styles.formGridFull}`}>
                            <label>Remarks</label>
                            <textarea
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                className={styles.input}
                                rows={2}
                                placeholder="Additional notes or references..."
                            />
                        </div>
                    </div>

                    <div className={styles.buttonRow}>
                        <button type="button" onClick={handleClear} className={styles.secondaryButton} disabled={saving}>
                            Clear
                        </button>
                        <button type="submit" className={styles.button} disabled={saving}>
                            {saving ? 'Saving...' : editingId ? 'Update Record' : 'Save Record'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Records List Table */}
            <div className={styles.card}>
                <div className={styles.tableHeader}>
                    <h3>Downtime Logs</h3>
                    <div className={styles.searchBar}>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            className={styles.input}
                            placeholder="Search logs (Shift, Line, Machine, Category, Operator)..."
                        />
                    </div>
                </div>

                <div className={styles.tableContainer}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>Loading records...</div>
                    ) : (
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Sl No</th>
                                    <th onClick={() => handleSort('shift')} style={{ cursor: 'pointer' }}>Shift {sortBy === 'shift' ? (sortOrder === 'ASC' ? '▲' : '▼') : ''}</th>
                                    <th onClick={() => handleSort('line')} style={{ cursor: 'pointer' }}>Line {sortBy === 'line' ? (sortOrder === 'ASC' ? '▲' : '▼') : ''}</th>
                                    <th onClick={() => handleSort('machine_name')} style={{ cursor: 'pointer' }}>Machine {sortBy === 'machine_name' ? (sortOrder === 'ASC' ? '▲' : '▼') : ''}</th>
                                    <th onClick={() => handleSort('downtime_category')} style={{ cursor: 'pointer' }}>Category {sortBy === 'downtime_category' ? (sortOrder === 'ASC' ? '▲' : '▼') : ''}</th>
                                    <th onClick={() => handleSort('start_time')} style={{ cursor: 'pointer' }}>Start Time {sortBy === 'start_time' ? (sortOrder === 'ASC' ? '▲' : '▼') : ''}</th>
                                    <th onClick={() => handleSort('end_time')} style={{ cursor: 'pointer' }}>End Time {sortBy === 'end_time' ? (sortOrder === 'ASC' ? '▲' : '▼') : ''}</th>
                                    <th onClick={() => handleSort('duration')} style={{ cursor: 'pointer' }}>Duration {sortBy === 'duration' ? (sortOrder === 'ASC' ? '▲' : '▼') : ''}</th>
                                    <th onClick={() => handleSort('responsible_person')} style={{ cursor: 'pointer' }}>Responsible {sortBy === 'responsible_person' ? (sortOrder === 'ASC' ? '▲' : '▼') : ''}</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {records.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                                            No downtime logs match the search query.
                                        </td>
                                    </tr>
                                ) : (
                                    records.map((record, index) => (
                                        <tr key={record.id}>
                                            <td>{(page - 1) * 10 + index + 1}</td>
                                            <td>{record.shift}</td>
                                            <td>{record.line}</td>
                                            <td>{record.machine_name}</td>
                                            <td>{record.downtime_category}</td>
                                            <td>{formatDateTime(record.start_time)}</td>
                                            <td>{formatDateTime(record.end_time)}</td>
                                            <td style={{ fontWeight: 600 }}>{Number(record.duration).toFixed(1)} mins</td>
                                            <td>{record.responsible_person}</td>
                                            <td className={styles.actionCell}>
                                                <button onClick={() => setViewRecord(record)} className={styles.viewBtn}>View</button>
                                                <button onClick={() => handleEdit(record)} className={styles.editBtn}>Edit</button>
                                                <button onClick={() => handleDelete(record.id)} className={styles.deleteBtn}>Delete</button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className={styles.paginationRow}>
                        <span className={styles.paginationInfo}>
                            Showing page {page} of {totalPages} (Total {totalRecords} records)
                        </span>
                        <div className={styles.paginationButtons}>
                            <button
                                onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                                disabled={page === 1}
                                className={styles.paginationBtn}
                            >
                                Previous
                            </button>
                            {Array.from({ length: totalPages }).map((_, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setPage(idx + 1)}
                                    className={`${styles.paginationBtn} ${page === idx + 1 ? styles.activePage : ''}`}
                                >
                                    {idx + 1}
                                </button>
                            ))}
                            <button
                                onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={page === totalPages}
                                className={styles.paginationBtn}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Downtime Category Analytics Section */}
            {/* OEE Analytics Section */}
            <div className={styles.card}>
                <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>
                    📊 OEE Analytics Dashboard
                </h3>

                {/* Date Filters Section */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                    <div className={styles.inputGroup}>
                        <label style={{ fontWeight: 'bold' }}>From Date</label>
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            className={styles.input}
                        />
                    </div>
                    <div className={styles.inputGroup}>
                        <label style={{ fontWeight: 'bold' }}>To Date</label>
                        <input
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            className={styles.input}
                        />
                    </div>
                </div>

                {/* Overall OEE Large Summary Card */}
                <div style={{
                    backgroundColor: 'var(--primary-light, #f0fdf4)',
                    border: '1px solid #bbf7d0',
                    borderRadius: '8px',
                    padding: '1.5rem',
                    textAlign: 'center',
                    marginBottom: '1.5rem'
                }}>
                    <span style={{ fontSize: '0.9rem', color: '#15803d', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Overall OEE</span>
                    <h2 style={{ fontSize: '3rem', margin: '0.5rem 0 0 0', color: '#166534', fontWeight: '800' }}>
                        {oee.toFixed(2)}%
                    </h2>
                </div>

                {/* Grid of 3 Calculation Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                    {/* Availability Card */}
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem', backgroundColor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <h4 style={{ margin: '0 0 1rem 0', color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>Section 1 - Availability</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div className={styles.inputGroup}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Total Time Available (Mins)</label>
                                <input
                                    type="number"
                                    value={totalTimeAvailable}
                                    onChange={(e) => setTotalTimeAvailable(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                                    className={styles.input}
                                    placeholder="Enter Minutes"
                                    style={{ height: '36px' }}
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Planned Downtime (Mins)</label>
                                <input type="text" value={plannedDowntime > 0 ? `${plannedDowntime.toFixed(2)} mins` : '0.00 mins'} readOnly disabled className={styles.input} style={{ height: '36px', backgroundColor: '#f8fafc' }} />
                            </div>
                            <div className={styles.inputGroup}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Unplanned Downtime (Mins)</label>
                                <input type="text" value={unplannedDowntime > 0 ? `${unplannedDowntime.toFixed(2)} mins` : '0.00 mins'} readOnly disabled className={styles.input} style={{ height: '36px', backgroundColor: '#f8fafc' }} />
                            </div>
                            <div className={styles.inputGroup}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Operating Time (Mins)</label>
                                <input type="text" value={operatingTime > 0 ? `${operatingTime.toFixed(2)} mins` : '0.00 mins'} readOnly disabled className={styles.input} style={{ height: '36px', backgroundColor: '#f8fafc' }} />
                            </div>
                            <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#475569' }}>Availability Rate:</span>
                                <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#3b82f6' }}>{availabilityRate.toFixed(2)}%</span>
                            </div>
                        </div>
                    </div>

                    {/* Performance Card */}
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem', backgroundColor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <h4 style={{ margin: '0 0 1rem 0', color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>Section 2 - Performance</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div className={styles.inputGroup}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Total Production (Pieces)</label>
                                <input
                                    type="number"
                                    value={totalProduction}
                                    onChange={(e) => setTotalProduction(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                                    className={styles.input}
                                    placeholder="Enter Pieces"
                                    style={{ height: '36px' }}
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Ideal Run/Cycle Time (Pcs/Min)</label>
                                <input
                                    type="number"
                                    value={idealCycleTime}
                                    onChange={(e) => setIdealCycleTime(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                                    className={styles.input}
                                    placeholder="Enter Pieces/Min"
                                    style={{ height: '36px' }}
                                />
                            </div>
                            <div style={{ marginTop: '5.2rem', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#475569' }}>Performance Rate:</span>
                                <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#f59e0b' }}>{performanceRate.toFixed(2)}%</span>
                            </div>
                        </div>
                    </div>

                    {/* Quality Card */}
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem', backgroundColor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <h4 style={{ margin: '0 0 1rem 0', color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>Section 3 - Quality</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div className={styles.inputGroup}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Reject / Scrap Produced (Pieces)</label>
                                <input
                                    type="number"
                                    value={scrapProduced}
                                    onChange={(e) => setScrapProduced(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                                    className={styles.input}
                                    placeholder="Enter Pieces"
                                    style={{ height: '36px' }}
                                />
                            </div>
                            <div style={{ marginTop: '9rem', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#475569' }}>Quality Rate:</span>
                                <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#10b981' }}>{qualityRate.toFixed(2)}%</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Pie Charts Visual Grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '2rem',
                    justifyItems: 'center',
                    paddingTop: '1.5rem',
                    borderTop: '1px solid #f1f5f9'
                }}>
                    {renderOeePieChart(oee, aLoss, pLoss, qLoss)}
                    {renderSimplePieChart(availabilityRate, '#3b82f6', '#ef4444', 'Availability')}
                    {renderSimplePieChart(performanceRate, '#f59e0b', '#b91c1c', 'Performance')}
                    {renderSimplePieChart(qualityRate, '#10b981', '#7c3aed', 'Quality')}
                </div>
            </div>

            {/* View Record Details Modal */}
            {viewRecord && (
                <div className={styles.modalOverlay} onClick={() => setViewRecord(null)}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '750px', width: '95%' }}>
                        <div className={styles.modalHeader}>
                            <h3>📋 Downtime Record Details</h3>
                            <button className={styles.closeBtn} onClick={() => setViewRecord(null)}>×</button>
                        </div>
                        <div className={styles.modalBody} style={{ padding: '1.5rem' }}>
                            <div className={styles.modalGrid} style={{ gap: '1.25rem' }}>
                                <div className={styles.modalField}>
                                    <span className={styles.fieldLabel}>Shift</span>
                                    <span className={styles.fieldValue} style={{ fontWeight: 600 }}>{viewRecord.shift}</span>
                                </div>
                                <div className={styles.modalField}>
                                    <span className={styles.fieldLabel}>Line</span>
                                    <span className={styles.fieldValue} style={{ fontWeight: 600 }}>{viewRecord.line}</span>
                                </div>
                                <div className={styles.modalField}>
                                    <span className={styles.fieldLabel}>Machine Name</span>
                                    <span className={styles.fieldValue} style={{ fontWeight: 600 }}>{viewRecord.machine_name}</span>
                                </div>
                                <div className={styles.modalField}>
                                    <span className={styles.fieldLabel}>Downtime Category</span>
                                    <span className={styles.fieldValue} style={{ fontWeight: 600 }}>{viewRecord.downtime_category}</span>
                                </div>
                                <div className={styles.modalField}>
                                    <span className={styles.fieldLabel}>Start Time</span>
                                    <span className={styles.fieldValue}>{formatDateTime(viewRecord.start_time)}</span>
                                </div>
                                <div className={styles.modalField}>
                                    <span className={styles.fieldLabel}>End Time</span>
                                    <span className={styles.fieldValue}>{formatDateTime(viewRecord.end_time)}</span>
                                </div>
                                <div className={styles.modalField}>
                                    <span className={styles.fieldLabel}>Duration</span>
                                    <span className={styles.fieldValue} style={{ color: 'var(--primary-color)', fontWeight: 700 }}>
                                        {Number(viewRecord.duration).toFixed(1)} minutes
                                    </span>
                                </div>

                                <div className={styles.modalField}>
                                    <span className={styles.fieldLabel}>Responsible Person</span>
                                    <span className={styles.fieldValue}>{viewRecord.responsible_person}</span>
                                </div>
                                <div className={styles.modalField}>
                                    <span className={styles.fieldLabel}>Logged By</span>
                                    <span className={styles.fieldValue}>{viewRecord.created_by_name || 'System'}</span>
                                </div>
                                <div className={`${styles.modalField} ${styles.modalFullWidth}`} style={{ backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <span className={styles.fieldLabel}>Downtime Description</span>
                                    <span className={styles.fieldValue} style={{ whiteSpace: 'pre-wrap' }}>{viewRecord.downtime_description}</span>
                                </div>
                                <div className={`${styles.modalField} ${styles.modalFullWidth}`} style={{ backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <span className={styles.fieldLabel}>Action Taken</span>
                                    <span className={styles.fieldValue} style={{ whiteSpace: 'pre-wrap' }}>{viewRecord.action_taken}</span>
                                </div>
                                <div className={`${styles.modalField} ${styles.modalFullWidth}`}>
                                    <span className={styles.fieldLabel}>Remarks</span>
                                    <span className={styles.fieldValue} style={{ whiteSpace: 'pre-wrap' }}>{viewRecord.remarks || 'No remarks recorded'}</span>
                                </div>
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <button onClick={() => setViewRecord(null)} className={styles.secondaryButton}>Close</button>
                        </div>
                    </div>
                </div>
            )}
            {activeTooltip.visible && (
                <div style={{
                    position: 'fixed',
                    left: activeTooltip.x + 12 + 'px',
                    top: activeTooltip.y + 12 + 'px',
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    color: '#ffffff',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    pointerEvents: 'none',
                    zIndex: 9999,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    transition: 'left 0.05s ease, top 0.05s ease'
                }}>
                    {activeTooltip.text}
                </div>
            )}
        </div>
    );
};

export default SmtDowntimeTracker;
