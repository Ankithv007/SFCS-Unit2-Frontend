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

    // Analytics states
    const [analyticsRecords, setAnalyticsRecords] = useState<DowntimeRecord[]>([]);
    const [analysisType, setAnalysisType] = useState<string>('Day Wise');
    const [selectedDay, setSelectedDay] = useState<string>('');
    const [selectedWeek, setSelectedWeek] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState<string>('');
    const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

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
        setEditingId(null);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        // Frontend validations
        if (!shift || !line || !machineName || !startTime || !endTime || !downtimeCategory || !downtimeDescription || !actionTaken || !responsiblePerson || !status) {
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
                downtime_description: downtimeDescription,
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
        setDowntimeDescription(record.downtime_description);
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

    // Available unique options from records
    const availableDays = Array.from(new Set(analyticsRecords.map(r => r.start_time.split('T')[0])))
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    const availableWeeks = Array.from(new Set(analyticsRecords.map(r => {
        const date = new Date(r.start_time);
        const day = date.getDay();
        const diff = date.getDate() - day; // Sunday of that week
        const sunday = new Date(date.setDate(diff));
        sunday.setHours(0,0,0,0);
        return sunday.toISOString().split('T')[0];
    }))).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    const availableMonths = Array.from(new Set(analyticsRecords.map(r => {
        const date = new Date(r.start_time);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }))).sort((a, b) => new Date(b + '-01').getTime() - new Date(a + '-01').getTime());

    const getWeekRangeString = (sundayStr: string) => {
        const sunday = new Date(sundayStr);
        const saturday = new Date(sunday);
        saturday.setDate(saturday.getDate() + 6);
        const formatOptions: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
        return `Week of ${sunday.toLocaleDateString('en-IN', formatOptions)} (${sunday.toLocaleDateString('en-IN', formatOptions)} - ${saturday.toLocaleDateString('en-IN', formatOptions)})`;
    };

    const getMonthDisplayString = (yearMonthStr: string) => {
        const [year, month] = yearMonthStr.split('-');
        const d = new Date(Number(year), Number(month) - 1, 1);
        return d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    };

    const filteredAnalyticsRecords = analyticsRecords.filter(record => {
        if (analysisType === 'Day Wise') {
            if (!selectedDay) return false;
            return record.start_time.split('T')[0] === selectedDay;
        } else if (analysisType === 'Week Wise') {
            if (!selectedWeek) return false;
            const rDate = new Date(record.start_time);
            rDate.setHours(0,0,0,0);
            const wStart = new Date(selectedWeek);
            wEnd: {
                const wEnd = new Date(wStart);
                wEnd.setDate(wEnd.getDate() + 7);
                return rDate >= wStart && rDate < wEnd;
            }
        } else if (analysisType === 'Month Wise') {
            if (!selectedMonth) return false;
            const rDate = new Date(record.start_time);
            const yearStr = String(rDate.getFullYear());
            const monthStr = String(rDate.getMonth() + 1).padStart(2, '0');
            return `${yearStr}-${monthStr}` === selectedMonth;
        }
        return false;
    });

    const totalDurationFiltered = filteredAnalyticsRecords.reduce((sum, r) => sum + (Number(r.duration) || 0), 0);

    const categoriesList = [
        'Planned', 'Unplanned', 'Breakdown', 'Material Shortage', 
        'Power Failure', 'NPI Issues', 'Setup', 'Program Change', 'Quality Issue'
    ];

    const categoryData = categoriesList.map(cat => {
        const catRecords = filteredAnalyticsRecords.filter(r => r.downtime_category === cat);
        const duration = catRecords.reduce((sum, r) => sum + (Number(r.duration) || 0), 0);
        return {
            category: cat,
            duration,
            records: catRecords
        };
    });

    const categoryDataWithPercentage = categoryData.map(d => {
        const percentage = totalDurationFiltered > 0 ? (d.duration / totalDurationFiltered) * 100 : 0;
        return {
            ...d,
            percentage
        };
    });

    // Calculate visual percentages for SVG slices (so all categories are always visible, and small non-zero slices remain distinguishable)
    const minVisualPercent = 3.5; // 3.5% minimum slice size for all categories
    const totalMinSpace = categoriesList.length * minVisualPercent; // 9 * 3.5 = 31.5%
    const remainingSpace = 100 - totalMinSpace; // 68.5%
    
    const visualCategoryData = categoryDataWithPercentage.map(d => {
        let visualPercentage = minVisualPercent;
        if (totalDurationFiltered > 0) {
            visualPercentage += (d.percentage / 100) * remainingSpace;
        } else {
            // If everything is 0, distribute equally
            visualPercentage = 100 / categoriesList.length;
        }
        return {
            ...d,
            visualPercentage
        };
    });

    const colorsMap: Record<string, string> = {
        'Planned': '#3b82f6',
        'Unplanned': '#10b981',
        'Breakdown': '#ef4444',
        'Material Shortage': '#f59e0b',
        'Power Failure': '#8b5cf6',
        'NPI Issues': '#ec4899',
        'Setup': '#f97316',
        'Program Change': '#14b8a6',
    };

    const isPeriodSelected = 
        (analysisType === 'Day Wise' && !!selectedDay) ||
        (analysisType === 'Week Wise' && !!selectedWeek) ||
        (analysisType === 'Month Wise' && !!selectedMonth);

    return (
        <div className={styles.container}>
            <div className={styles.headerRow}>
                <div className={styles.headerContent}>
                    <h2>⚠️ Downtime Tracker</h2>
                    <p>Log, track and visualize SMT machine downtime incidents</p>
                </div>
            </div>

            {/* Dashboard Summary Cards */}
            <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Total Records</span>
                    <span className={styles.summaryValue}>{metrics.summary.total_records}</span>
                    <span className={styles.summarySub}>Log Count</span>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Total Duration</span>
                    <span className={styles.summaryValue}>{metrics.summary.total_duration.toFixed(1)}m</span>
                    <span className={styles.summarySub}>Total downtime minutes</span>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Average Downtime</span>
                    <span className={styles.summaryValue}>{metrics.summary.avg_duration.toFixed(1)}m</span>
                    <span className={styles.summarySub}>Per incident average</span>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Status Distribution</span>
                    <span className={styles.summaryValue} style={{ fontSize: '1.25rem', marginTop: '0.5rem' }}>
                        🟢 Closed: {metrics.summary.closed_issues} | 🔴 Open: {metrics.summary.open_issues}
                    </span>
                    <span className={styles.summarySub}>Active vs Solved Issues</span>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Most Affected Machine</span>
                    <span className={styles.summaryValue} style={{ fontSize: '1.25rem' }}>{metrics.summary.most_affected_machine}</span>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Most Frequent Category</span>
                    <span className={styles.summaryValue} style={{ fontSize: '1.25rem' }}>{metrics.summary.most_frequent_category}</span>
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
                                <option value="Breakdown">Breakdown</option>
                                <option value="Material Shortage">Material Shortage</option>
                                <option value="Power Failure">Power Failure</option>
                                <option value="NPI Issues">NPI Issues</option>
                                <option value="Setup">Setup</option>
                                <option value="Program Change">Program Change</option>
                                <option value="Quality Issue">Quality Issue</option>
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

                        <div className={styles.inputGroup}>
                            <label>Status <span>*</span></label>
                            <select value={status} onChange={(e) => setStatus(e.target.value)} className={styles.input} required>
                                <option value="Open">Open</option>
                                <option value="Closed">Closed</option>
                            </select>
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
                                    <th onClick={() => handleSort('status')} style={{ cursor: 'pointer' }}>Status {sortBy === 'status' ? (sortOrder === 'ASC' ? '▲' : '▼') : ''}</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {records.length === 0 ? (
                                    <tr>
                                        <td colSpan={11} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
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
                                            <td>
                                                <span className={`${styles.badge} ${record.status === 'Open' ? styles.badgeOpen : styles.badgeClosed}`}>
                                                    {record.status}
                                                </span>
                                            </td>
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
            <div className={styles.card}>
                <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>
                    📊 Downtime Category Analytics
                </h3>
                
                {/* Filters Section */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                    <div className={styles.inputGroup}>
                        <label style={{ fontWeight: 'bold' }}>Analysis Type</label>
                        <select
                            value={analysisType}
                            onChange={(e) => {
                                setAnalysisType(e.target.value);
                                setSelectedDay('');
                                setSelectedWeek('');
                                setSelectedMonth('');
                            }}
                            className={styles.input}
                        >
                            <option value="Day Wise">Day Wise</option>
                            <option value="Week Wise">Week Wise</option>
                            <option value="Month Wise">Month Wise</option>
                        </select>
                    </div>

                    {analysisType === 'Day Wise' && (
                        <div className={styles.inputGroup}>
                            <label style={{ fontWeight: 'bold' }}>Select Day</label>
                            <select
                                value={selectedDay}
                                onChange={(e) => setSelectedDay(e.target.value)}
                                className={styles.input}
                            >
                                <option value="">Select Day</option>
                                {availableDays.map(day => (
                                    <option key={day} value={day}>
                                        {new Date(day).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {analysisType === 'Week Wise' && (
                        <div className={styles.inputGroup}>
                            <label style={{ fontWeight: 'bold' }}>Select Week</label>
                            <select
                                value={selectedWeek}
                                onChange={(e) => setSelectedWeek(e.target.value)}
                                className={styles.input}
                            >
                                <option value="">Select Week</option>
                                {availableWeeks.map(week => (
                                    <option key={week} value={week}>
                                        {getWeekRangeString(week)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {analysisType === 'Month Wise' && (
                        <div className={styles.inputGroup}>
                            <label style={{ fontWeight: 'bold' }}>Select Month</label>
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className={styles.input}
                            >
                                <option value="">Select Month</option>
                                {availableMonths.map(month => (
                                    <option key={month} value={month}>
                                        {getMonthDisplayString(month)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {/* Pie Chart Display */}
                {isPeriodSelected && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem', width: '100%' }}>
                        <div style={{ width: '100%', maxWidth: '440px', aspectRatio: '1/1', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            <svg viewBox="-350 -350 700 700" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                                {(() => {
                                    let accumulatedPercent = 0;
                                    return visualCategoryData.map((data) => {
                                        const percent = data.visualPercentage / 100;
                                        const angleSpan = percent * 360;
                                        const startAngle = accumulatedPercent * 360 - 90;
                                        const endAngle = (accumulatedPercent + percent) * 360 - 90;
                                        accumulatedPercent += percent;

                                        const radStart = (startAngle * Math.PI) / 180;
                                        const radEnd = (endAngle * Math.PI) / 180;
                                        const radMid = ((startAngle + angleSpan / 2) * Math.PI) / 180;

                                        const R = 260;
                                        const x1 = R * Math.cos(radStart);
                                        const y1 = R * Math.sin(radStart);
                                        const x2 = R * Math.cos(radEnd);
                                        const y2 = R * Math.sin(radEnd);

                                        const largeArcFlag = angleSpan > 180 ? 1 : 0;
                                        const pathData = `M 0 0 L ${x1} ${y1} A ${R} ${R} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

                                        const sectorColor = colorsMap[data.category] || '#94a3b8';
                                        const isHovered = hoveredCategory === data.category;

                                        // Adjust label radius so 0% slices (which are very thin) project labels outward and don't overlap inside the center
                                        const R_text = data.percentage === 0 ? 190 : 130;
                                        const tx = R_text * Math.cos(radMid);
                                        const ty = R_text * Math.sin(radMid);

                                        let rotationAngle = startAngle + angleSpan / 2;
                                        if (rotationAngle > 90 && rotationAngle < 270) {
                                            rotationAngle += 180;
                                        }

                                        return (
                                            <g key={data.category}>
                                                <path
                                                    d={pathData}
                                                    fill={sectorColor}
                                                    stroke="#ffffff"
                                                    strokeWidth="2"
                                                    onMouseEnter={() => setHoveredCategory(data.category)}
                                                    onMouseLeave={() => setHoveredCategory(null)}
                                                    style={{
                                                        cursor: 'pointer',
                                                        transition: 'all 0.3s ease',
                                                        transform: isHovered 
                                                            ? `translate(${12 * Math.cos(radMid)}px, ${12 * Math.sin(radMid)}px) scale(1.03)` 
                                                            : 'scale(1)',
                                                        transformOrigin: '0px 0px',
                                                        opacity: isHovered ? 1 : 0.95
                                                    }}
                                                />
                                                <text
                                                    x={tx}
                                                    y={ty}
                                                    textAnchor="middle"
                                                    dominantBaseline="middle"
                                                    fill="#ffffff"
                                                    style={{
                                                        fontSize: '12px',
                                                        fontWeight: 'bold',
                                                        textShadow: '0px 1px 3px rgba(0,0,0,0.85)',
                                                        pointerEvents: 'none',
                                                        transition: 'all 0.3s ease',
                                                        transform: isHovered 
                                                            ? `translate(${12 * Math.cos(radMid)}px, ${12 * Math.sin(radMid)}px) rotate(${rotationAngle}deg)` 
                                                            : `rotate(${rotationAngle}deg)`,
                                                        transformOrigin: `${tx}px ${ty}px`
                                                    }}
                                                >
                                                    <tspan x={tx} dy="-0.3em">{data.category}</tspan>
                                                    <tspan x={tx} dy="1.2em">{data.percentage.toFixed(0)}%</tspan>
                                                </text>
                                            </g>
                                        );
                                    });
                                })()}
                                <circle cx="0" cy="0" r="15" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" />
                            </svg>
                        </div>

                        {/* Interactive Legend */}
                        <div style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            justifyContent: 'center',
                            gap: '1rem',
                            marginTop: '1rem',
                            padding: '1rem',
                            backgroundColor: '#f8fafc',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            width: '100%',
                            maxWidth: '600px'
                        }}>
                            {visualCategoryData.map(data => {
                                const color = colorsMap[data.category] || '#94a3b8';
                                const isHovered = hoveredCategory === data.category;
                                return (
                                    <div 
                                        key={data.category}
                                        onMouseEnter={() => setHoveredCategory(data.category)}
                                        onMouseLeave={() => setHoveredCategory(null)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            fontSize: '0.85rem',
                                            cursor: 'pointer',
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: '4px',
                                            backgroundColor: isHovered ? '#e2e8f0' : 'transparent',
                                            transition: 'all 0.2s ease',
                                            fontWeight: isHovered ? 'bold' : 'normal'
                                        }}
                                    >
                                        <span style={{
                                            display: 'inline-block',
                                            width: '10px',
                                            height: '10px',
                                            borderRadius: '50%',
                                            backgroundColor: color,
                                            border: '1px solid #ffffff'
                                        }}></span>
                                        <span>{data.category}: {data.percentage.toFixed(1)}% ({data.duration.toFixed(0)} Minutes)</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
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
                                    <span className={styles.fieldLabel}>Status</span>
                                    <span className={`${styles.badge} ${viewRecord.status === 'Open' ? styles.badgeOpen : styles.badgeClosed}`} style={{ width: 'fit-content', padding: '0.2rem 0.5rem' }}>
                                        {viewRecord.status}
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
        </div>
    );
};

export default SmtDowntimeTracker;
