import React, { useState, useEffect } from 'react';
import { useToast } from '../../../components/Toast';
import { apiFetch } from '../../../utils/api';
import type { DowntimeRecord, DashboardMetrics } from './smtDowntime.types';

export const useSmtDowntime = () => {
    const { showToast } = useToast();

    // Form State
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
    const [reasonCode, setReasonCode] = useState('');

    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    // Work Order states
    const [workOrderId, setWorkOrderId] = useState('');
    const [manualWorkOrder, setManualWorkOrder] = useState('');
    const [eligibleWos, setEligibleWos] = useState<any[]>([]);

    // Records Table State
    const [records, setRecords] = useState<DowntimeRecord[]>([]);
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('start_time');
    const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const [loading, setLoading] = useState(false);

    // Dashboard Metrics State
    const [metrics, setMetrics] = useState<DashboardMetrics>({
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

    // Modals State
    const [viewRecord, setViewRecord] = useState<DowntimeRecord | null>(null);
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Analytics & OEE State
    const [analyticsRecords, setAnalyticsRecords] = useState<DowntimeRecord[]>([]);
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [totalTimeAvailable, setTotalTimeAvailable] = useState<number | ''>('');
    const [totalProduction, setTotalProduction] = useState<number | ''>('');
    const [idealCycleTime, setIdealCycleTime] = useState<number | ''>('');
    const [scrapProduced, setScrapProduced] = useState<number | ''>('');

    // Duration calculation on start/end time change
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

    // Fetch Paginated Logs
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

    // Fetch Dashboard Summary Metrics
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

    // Fetch All Records for Client OEE
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

    // Fetch Pending Work Orders
    const fetchPendingWos = async () => {
        try {
            const res = await apiFetch('/api/smt/downtime-records/pending-wos');
            if (res.success) {
                setEligibleWos(res.data || []);
            }
        } catch (err) {
            console.error('Error fetching pending work orders:', err);
        }
    };

    useEffect(() => {
        fetchRecords();
    }, [page, search, sortBy, sortOrder]);

    useEffect(() => {
        fetchDashboardMetrics();
        fetchAnalyticsRecords();
        fetchPendingWos();
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
        setWorkOrderId('');
        setManualWorkOrder('');
        setEditingId(null);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!shift || !line || !machineName || !startTime || !endTime || !downtimeCategory || !reasonCode || !downtimeDescription || !actionTaken || !responsiblePerson) {
            showToast('Please fill all mandatory fields.', 'error');
            return;
        }

        const start = new Date(startTime);
        const end = new Date(endTime);
        if (end <= start) {
            showToast('End Time must be greater than Start Time.', 'error');
            return;
        }

        // Validate work order: either selected or manually typed, must be pending
        const resolvedWO = workOrderId || manualWorkOrder.trim();
        if (resolvedWO) {
            // Validate against list
            const matched = eligibleWos.find(w => w.id.toUpperCase() === resolvedWO.toUpperCase());
            if (!matched) {
                showToast(`Work Order ID "${resolvedWO}" is invalid or completed. Only Pending or In Progress Work Orders can be linked.`, 'error');
                return;
            }
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
                remarks,
                work_order_id: workOrderId || manualWorkOrder.trim() || null
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
        setStatus(record.status || 'Open');
        setRemarks(record.remarks || '');
        setWorkOrderId(record.work_order_id || '');
        setManualWorkOrder(record.work_order_id || '');

        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const confirmDelete = async () => {
        if (!deleteTargetId) return;
        setDeleting(true);
        try {
            const res = await apiFetch(`/api/smt/downtime-records/${deleteTargetId}`, {
                method: 'DELETE'
            });
            if (res.success) {
                showToast('Record deleted successfully.', 'success');
                setDeleteTargetId(null);
                fetchRecords();
                fetchDashboardMetrics();
                fetchAnalyticsRecords();
            }
        } catch (err: any) {
            console.error('Error deleting downtime record:', err);
            showToast(err.message || 'Failed to delete record.', 'error');
        } finally {
            setDeleting(false);
        }
    };

    // OEE Calculation Engine & Safeguards
    const timeAvailable = typeof totalTimeAvailable === 'number' && !isNaN(totalTimeAvailable) ? Math.max(0, totalTimeAvailable) : 0;
    const production = typeof totalProduction === 'number' && !isNaN(totalProduction) ? Math.max(0, totalProduction) : 0;
    const cycleTime = typeof idealCycleTime === 'number' && !isNaN(idealCycleTime) ? Math.max(0, idealCycleTime) : 0;
    const scrap = typeof scrapProduced === 'number' && !isNaN(scrapProduced) ? Math.max(0, scrapProduced) : 0;

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

    const plannedProductionTime = Math.max(0, timeAvailable - plannedDowntime);
    const operatingTime = Math.max(0, plannedProductionTime - unplannedDowntime);

    const availabilityRateDivisor = plannedProductionTime;
    const availabilityRate = availabilityRateDivisor > 0 
        ? (operatingTime / availabilityRateDivisor) * 100
        : 0;

    const actualRunRate = operatingTime > 0 ? (production / operatingTime) : 0;
    const performanceRate = cycleTime > 0 
        ? (actualRunRate / cycleTime) * 100
        : 0;

    const goodProduction = Math.max(0, production - scrap);
    const qualityRate = production > 0 
        ? (goodProduction / production) * 100
        : 0;

    const oee = (availabilityRate * performanceRate * qualityRate) / 10000;

    // MTTR & MTBF (Mean Time To Repair & Mean Time Between Failures)
    const unplannedCount = filteredForOee.filter(r => r.downtime_category === 'Unplanned').length;
    const totalFilteredCount = filteredForOee.length;
    const totalFilteredDowntime = plannedDowntime + unplannedDowntime;

    // MTTR = Average Duration per breakdown incident (Unplanned duration / Unplanned count, or Total Duration / Total Incidents)
    const mttr = unplannedCount > 0 
        ? unplannedDowntime / unplannedCount 
        : (totalFilteredCount > 0 ? totalFilteredDowntime / totalFilteredCount : 0);

    // MTBF = Operating Time / Unplanned Failures (or total operating time if no failures occurred)
    const mtbf = unplannedCount > 0 
        ? operatingTime / unplannedCount 
        : (operatingTime > 0 ? operatingTime : 0);


    // Dynamic Reason Code Breakdown & Daily Trend Aggregation
    const reasonMap: { [key: string]: number } = {};
    const dailyMap: { [key: string]: { planned: number; unplanned: number } } = {};

    filteredForOee.forEach(r => {
        // Reason Code extraction
        const match = (r.downtime_description || '').match(/^\[Reason Code: ([^\]]+)\]/);
        const reason = match ? match[1] : (r.downtime_category || 'Other');
        reasonMap[reason] = (reasonMap[reason] || 0) + (Number(r.duration) || 0);

        // Daily trend extraction
        if (r.start_time) {
            const dateKey = r.start_time.split('T')[0];
            if (!dailyMap[dateKey]) {
                dailyMap[dateKey] = { planned: 0, unplanned: 0 };
            }
            if (r.downtime_category === 'Planned') {
                dailyMap[dateKey].planned += Number(r.duration) || 0;
            } else {
                dailyMap[dateKey].unplanned += Number(r.duration) || 0;
            }
        }
    });

    const topReasonsCharts = Object.keys(reasonMap).map(key => ({
        name: key,
        value: parseFloat(reasonMap[key].toFixed(1))
    })).sort((a, b) => b.value - a.value);

    const dailyTrendCharts = Object.keys(dailyMap).sort().slice(-7).map(dateKey => ({
        date: dateKey,
        planned: parseFloat(dailyMap[dateKey].planned.toFixed(1)),
        unplanned: parseFloat(dailyMap[dateKey].unplanned.toFixed(1)),
        total: parseFloat((dailyMap[dateKey].planned + dailyMap[dateKey].unplanned).toFixed(1))
    }));

    return {
        formState: {
            shift, setShift,
            line, setLine,
            machineName, setMachineName,
            startTime, setStartTime,
            endTime, setEndTime,
            duration,
            downtimeCategory, setDowntimeCategory,
            reasonCode, setReasonCode,
            downtimeDescription, setDowntimeDescription,
            actionTaken, setActionTaken,
            responsiblePerson, setResponsiblePerson,
            status, setStatus,
            remarks, setRemarks,
            editingId, saving,
            workOrderId, setWorkOrderId,
            manualWorkOrder, setManualWorkOrder
        },
        handleClear,
        handleSave,
        handleEdit,

        records,
        search, setSearch,
        sortBy, sortOrder, handleSort,
        page, setPage,
        totalPages, totalRecords,
        loading,

        metrics: {
            ...metrics,
            summary: {
                ...metrics.summary,
                mttr: parseFloat(mttr.toFixed(1)),
                mtbf: parseFloat(mtbf.toFixed(1))
            },
            charts: {
                ...metrics.charts,
                reasons: topReasonsCharts,
                dailyTrend: dailyTrendCharts
            }
        },

        viewRecord, setViewRecord,
        deleteTargetId, setDeleteTargetId,
        deleting, confirmDelete,

        eligibleWos,
        oeeState: {
            fromDate, setFromDate,
            toDate, setToDate,
            totalTimeAvailable, setTotalTimeAvailable,
            totalProduction, setTotalProduction,
            idealCycleTime, setIdealCycleTime,
            scrapProduced, setScrapProduced,
            plannedDowntime,
            unplannedDowntime,
            plannedProductionTime,
            operatingTime,
            availabilityRate,
            performanceRate,
            qualityRate,
            oee,
            mttr,
            mtbf
        }
    };
};

