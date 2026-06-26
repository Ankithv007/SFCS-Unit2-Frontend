import React, { useState, useEffect } from 'react';
import styles from './BakingTrackingRecord.module.css';
import { useSmtAuth } from '../../context/SmtAuthContext';
import { useToast } from '../../components/Toast';
import { apiFetch } from '../../utils/api';

interface BakingRecord {
    id: string;
    model_name: string;
    msl_level: string;
    baking_temperature: string;
    components?: {
        vepl_part_number: string;
        manufacturer_part_number: string;
        reel_qty: number;
        component_thickness: string;
    }[];
    baking_in_time: string;
    baking_out_time: string | null;
    baking_duration: string | null;
    approved_by_qa: string | null;
    status: 'Pending Baking' | 'Completed Baking';
    
    created_by: string;
    created_by_name: string;
    created_at: string;
    
    updated_by: string | null;
    updated_by_name: string | null;
    updated_at: string;
    
    stopped_by: string | null;
    stopped_by_name: string | null;
    stopped_at: string | null;
    
    remarks: string | null;
}

const BakingTrackingRecord: React.FC = () => {
    const { smtUser, smtLogout } = useSmtAuth();
    const { showToast } = useToast();

    // 1. Create Form State
    const [modelName, setModelName] = useState('');
    const [mslLevel, setMslLevel] = useState('');
    const [bakingTemperature, setBakingTemperature] = useState('');
    const [remarks, setRemarks] = useState('');
    const [components, setComponents] = useState([
        { vepl_part_number: '', manufacturer_part_number: '', reel_qty: '', component_thickness: '' }
    ]);
    const [creating, setCreating] = useState(false);

    const handleComponentChange = (index: number, field: string, value: string) => {
        const updated = [...components];
        updated[index] = { ...updated[index], [field]: value };
        setComponents(updated);
    };

    const addComponent = () => {
        setComponents([...components, { vepl_part_number: '', manufacturer_part_number: '', reel_qty: '', component_thickness: '' }]);
    };

    const removeComponent = (index: number) => {
        if (components.length > 1) {
            setComponents(components.filter((_, i) => i !== index));
        }
    };

    // 2. Pending Records State
    const [pendingRecords, setPendingRecords] = useState<BakingRecord[]>([]);
    const [pendingSearch, setPendingSearch] = useState('');
    const [pendingSearchText, setPendingSearchText] = useState('');
    const [pendingSortBy, setPendingSortBy] = useState('baking_in_time');
    const [pendingSortOrder, setPendingSortOrder] = useState<'ASC' | 'DESC'>('DESC');
    const [pendingPage, setPendingPage] = useState(1);
    const [pendingTotalPages, setPendingTotalPages] = useState(1);
    const [pendingTotal, setPendingTotal] = useState(0);
    const [pendingLoading, setPendingLoading] = useState(false);

    // 3. Completed Records State
    const [completedRecords, setCompletedRecords] = useState<BakingRecord[]>([]);
    const [completedSearch, setCompletedSearch] = useState('');
    const [completedSearchText, setCompletedSearchText] = useState('');
    const [completedSortBy, setCompletedSortBy] = useState('baking_out_time');
    const [completedSortOrder, setCompletedSortOrder] = useState<'ASC' | 'DESC'>('DESC');
    const [completedPage, setCompletedPage] = useState(1);
    const [completedTotalPages, setCompletedTotalPages] = useState(1);
    const [completedTotal, setCompletedTotal] = useState(0);
    const [completedLoading, setCompletedLoading] = useState(false);

    // 4. Modals State
    const [viewRecord, setViewRecord] = useState<BakingRecord | null>(null);
    const [stopRecordId, setStopRecordId] = useState<string | null>(null);
    const [approvedByQa, setApprovedByQa] = useState('');
    const [stopRemarks, setStopRemarks] = useState('');
    const [stopping, setStopping] = useState(false);

    const isSuperAdmin = smtUser?.role === 'Super Admin';

    // Format timestamps with second precision in IST 12-hour format
    const formatTimestamp = (dateStr: string | null) => {
        if (!dateStr) return 'Not Available Yet';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return 'Not Available Yet';
        try {
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: 'Asia/Kolkata',
                year: 'numeric',
                month: 'short',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });
            const parts = formatter.formatToParts(d);
            let day = '';
            let monthStr = '';
            let year = '';
            let hour = '';
            let minute = '';
            let second = '';
            let dayPeriod = '';

            parts.forEach(part => {
                if (part.type === 'day') day = part.value;
                else if (part.type === 'month') monthStr = part.value;
                else if (part.type === 'year') year = part.value;
                else if (part.type === 'hour') hour = part.value;
                else if (part.type === 'minute') minute = part.value;
                else if (part.type === 'second') second = part.value;
                else if (part.type === 'dayPeriod') dayPeriod = part.value;
            });

            dayPeriod = dayPeriod.toUpperCase();
            return `${day}-${monthStr}-${year} ${hour}:${minute}:${second} ${dayPeriod} IST`;
        } catch (e) {
            return d.toLocaleString();
        }
    };

    // Calculate total baking time between two dates in hours, minutes, seconds format
    const calculateTotalBakingTime = (inTime: string, outTime: string | null) => {
        if (!outTime) return 'Not Available Yet';
        const start = new Date(inTime);
        const end = new Date(outTime);
        const diffMs = end.getTime() - start.getTime();
        if (isNaN(diffMs) || diffMs < 0) return 'Not Available Yet';

        const totalSeconds = Math.floor(diffMs / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        const pad = (num: number) => String(num).padStart(2, '0');
        return `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
    };

    // Format username to remove email domains and capitalize
    const formatUserName = (name: string | null) => {
        if (!name) return 'Not Available Yet';
        if (name.includes('@')) {
            const username = name.split('@')[0];
            return username.charAt(0).toUpperCase() + username.slice(1);
        }
        return name;
    };

    // Fetch Pending Records
    const fetchPendingRecords = async () => {
        setPendingLoading(true);
        try {
            const queryParams = new URLSearchParams({
                page: String(pendingPage),
                limit: '10',
                search: pendingSearchText,
                status: 'Pending Baking',
                sortBy: pendingSortBy,
                sortOrder: pendingSortOrder
            });
            const res = await apiFetch(`/api/smt/baking-tracking/records?${queryParams.toString()}`);
            setPendingRecords(res.data);
            setPendingTotalPages(res.pagination.pages);
            setPendingTotal(res.pagination.total);
        } catch (err: any) {
            console.error('Failed to fetch pending records:', err);
            showToast('Failed to load pending baking records.', 'error');
        } finally {
            setPendingLoading(false);
        }
    };

    // Fetch Completed Records
    const fetchCompletedRecords = async () => {
        setCompletedLoading(true);
        try {
            const queryParams = new URLSearchParams({
                page: String(completedPage),
                limit: '10',
                search: completedSearchText,
                status: 'Completed Baking',
                sortBy: completedSortBy,
                sortOrder: completedSortOrder
            });
            const res = await apiFetch(`/api/smt/baking-tracking/records?${queryParams.toString()}`);
            setCompletedRecords(res.data);
            setCompletedTotalPages(res.pagination.pages);
            setCompletedTotal(res.pagination.total);
        } catch (err: any) {
            console.error('Failed to fetch completed records:', err);
            showToast('Failed to load completed baking records.', 'error');
        } finally {
            setCompletedLoading(false);
        }
    };

    // Trigger loads
    useEffect(() => {
        fetchPendingRecords();
    }, [pendingPage, pendingSortBy, pendingSortOrder, pendingSearchText]);

    useEffect(() => {
        fetchCompletedRecords();
    }, [completedPage, completedSortBy, completedSortOrder, completedSearchText]);

    // Handle Create Submission
    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!modelName.trim() || !mslLevel.trim() || !bakingTemperature.trim()) {
            showToast('Please fill all mandatory fields.', 'error');
            return;
        }

        for (const comp of components) {
            if (!comp.vepl_part_number.trim() || !comp.manufacturer_part_number.trim() || !comp.reel_qty.trim() || !comp.component_thickness.trim()) {
                showToast('All fields in each component are mandatory.', 'error');
                return;
            }
            const qty = parseInt(comp.reel_qty, 10);
            if (isNaN(qty) || qty <= 0) {
                showToast('Reel Quantity must be greater than zero for all components.', 'error');
                return;
            }
        }

        setCreating(true);
        try {
            await apiFetch('/api/smt/baking-tracking/create', {
                method: 'POST',
                headers: {
                    'X-User-Name': encodeURIComponent(smtUser?.name || '')
                },
                body: JSON.stringify({
                    model_name: modelName,
                    msl_level: mslLevel,
                    baking_temperature: bakingTemperature,
                    remarks: remarks || null,
                    components
                })
            });

            showToast('Baking Tracking Record Created Successfully.', 'success');
            
            // Clear inputs
            setModelName('');
            setMslLevel('');
            setBakingTemperature('');
            setRemarks('');
            setComponents([{ vepl_part_number: '', manufacturer_part_number: '', reel_qty: '', component_thickness: '' }]);

            // Reload Pending Table
            setPendingPage(1);
            fetchPendingRecords();
        } catch (err: any) {
            console.error('Failed to create baking record:', err);
            showToast(err.message || 'Failed to create record.', 'error');
        } finally {
            setCreating(false);
        }
    };

    // Handle Stop Submission
    const handleStopSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!stopRecordId) return;
        if (!approvedByQa.trim()) {
            showToast('Approved By QA is mandatory to stop baking.', 'error');
            return;
        }

        setStopping(true);
        try {
            await apiFetch(`/api/smt/baking-tracking/stop/${stopRecordId}`, {
                method: 'POST',
                headers: {
                    'X-User-Name': encodeURIComponent(smtUser?.name || '')
                },
                body: JSON.stringify({
                    approved_by_qa: approvedByQa,
                    remarks: stopRemarks || null
                })
            });

            showToast('Baking process stopped successfully.', 'success');
            setStopRecordId(null);
            setApprovedByQa('');
            setStopRemarks('');

            // Reload both tables
            fetchPendingRecords();
            fetchCompletedRecords();
        } catch (err: any) {
            console.error('Failed to stop baking record:', err);
            showToast(err.message || 'Failed to stop baking process.', 'error');
        } finally {
            setStopping(false);
        }
    };

    // Handle Delete (Super Admin only)
    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this Baking Tracking Record? This is permanent.')) {
            return;
        }

        try {
            await apiFetch(`/api/smt/baking-tracking/records/${id}`, {
                method: 'DELETE',
                headers: {
                    'X-User-Name': encodeURIComponent(smtUser?.name || '')
                }
            });

            showToast('Baking tracking record deleted successfully.', 'success');
            fetchCompletedRecords();
            fetchPendingRecords();
        } catch (err: any) {
            console.error('Failed to delete baking record:', err);
            showToast(err.message || 'Failed to delete record.', 'error');
        }
    };

    // Sorting Helper
    const handlePendingSort = (column: string) => {
        if (pendingSortBy === column) {
            setPendingSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC');
        } else {
            setPendingSortBy(column);
            setPendingSortOrder('ASC');
        }
        setPendingPage(1);
    };

    const handleCompletedSort = (column: string) => {
        if (completedSortBy === column) {
            setCompletedSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC');
        } else {
            setCompletedSortBy(column);
            setCompletedSortOrder('ASC');
        }
        setCompletedPage(1);
    };

    // Handle Searches
    const handlePendingSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setPendingSearchText(pendingSearch.trim());
        setPendingPage(1);
    };

    const handleCompletedSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setCompletedSearchText(completedSearch.trim());
        setCompletedPage(1);
    };

    // Fetch full record for View Details
    const handleViewDetails = async (id: string) => {
        try {
            const res = await apiFetch(`/api/smt/baking-tracking/records/${id}`);
            setViewRecord(res);
        } catch (err: any) {
            console.error('Failed to fetch record details:', err);
            showToast('Failed to load record details.', 'error');
        }
    };

    // Check if record update exists
    const hasBeenUpdated = (rec: BakingRecord) => {
        // If updated_at is equal to created_at and no updated_by is set, it means never updated
        if (!rec.updated_by) return false;
        return new Date(rec.updated_at).getTime() !== new Date(rec.created_at).getTime();
    };

    return (
        <div className={styles.container}>
            {/* Header row */}
            <div className={styles.headerRow}>
                <div className={styles.headerContent}>
                    <h2> Baking Tracking Record</h2>
                    <p>Track components sent for baking, manage oven dwell times, and verify QA approval.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ fontSize: '0.9rem', color: '#64748b', background: '#e2e8f0', padding: '0.4rem 0.8rem', borderRadius: '6px', fontWeight: 'bold' }}>
                        Operator: {smtUser?.name || 'Guest'} ({smtUser?.role || 'Guest'})
                    </span>
                    <button
                        onClick={() => { if (window.confirm('Are you sure you want to logout?')) smtLogout(); }}
                        className={styles.secondaryButton}
                        style={{ borderColor: '#ef4444', color: '#ef4444', padding: '0.5rem 1rem' }}
                    >
                        Logout SMT
                    </button>
                </div>
            </div>

            {/* Section 1: Create Baking Tracking Record */}
            <div className={styles.card}>
                <h3>Create Baking Tracking Record</h3>
                <form onSubmit={handleCreate}>
                    <div className={styles.formGrid}>
                        <div className={styles.inputGroup}>
                            <label>Model Name <span>*</span></label>
                            <input
                                type="text"
                                className={styles.input}
                                placeholder="Enter Model Name"
                                value={modelName}
                                onChange={(e) => setModelName(e.target.value)}
                                required
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label>MSL Level <span>*</span></label>
                            <input
                                type="text"
                                className={styles.input}
                                placeholder="Enter MSL Level"
                                value={mslLevel}
                                onChange={(e) => setMslLevel(e.target.value)}
                                required
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label>Baking Temperature <span>*</span></label>
                            <input
                                type="text"
                                className={styles.input}
                                placeholder="Enter Baking Temperature (°C)"
                                value={bakingTemperature}
                                onChange={(e) => setBakingTemperature(e.target.value)}
                                required
                            />
                        </div>

                        {/* Components Section */}
                        <div style={{ gridColumn: '1 / -1', width: '100%', marginBottom: '0.5rem' }}>
                            <h4 style={{ marginBottom: '0.5rem', color: '#1e293b', fontSize: '0.95rem' }}>Components</h4>
                            {/* Column Headers - shown once */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 140px', gap: '0.5rem', padding: '0.4rem 0.75rem', background: '#f8fafc', borderRadius: '6px 6px 0 0', border: '1px solid #e2e8f0', borderBottom: 'none' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>VEPL Part Number *</span>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>Manufacturer Part No *</span>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>Reel Qty *</span>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>Thickness *</span>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>Actions</span>
                            </div>
                            {/* Component Rows */}
                            {components.map((comp, index) => (
                                <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 140px', gap: '0.5rem', padding: '0.4rem 0.75rem', border: '1px solid #e2e8f0', borderTop: index === 0 ? '1px solid #e2e8f0' : 'none', background: '#fff', alignItems: 'center' }}>
                                    <input
                                        type="text"
                                        className={styles.input}
                                        placeholder="VEPL Part Number"
                                        value={comp.vepl_part_number}
                                        onChange={(e) => handleComponentChange(index, 'vepl_part_number', e.target.value)}
                                        required
                                        style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box', margin: 0, borderRadius: '4px' }}
                                    />
                                    <input
                                        type="text"
                                        className={styles.input}
                                        placeholder="Manufacturer Part No"
                                        value={comp.manufacturer_part_number}
                                        onChange={(e) => handleComponentChange(index, 'manufacturer_part_number', e.target.value)}
                                        required
                                        style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box', margin: 0, borderRadius: '4px' }}
                                    />
                                    <input
                                        type="number"
                                        className={styles.input}
                                        placeholder="Reel Qty"
                                        value={comp.reel_qty}
                                        onChange={(e) => handleComponentChange(index, 'reel_qty', e.target.value)}
                                        required
                                        style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box', margin: 0, borderRadius: '4px' }}
                                    />
                                    <input
                                        type="text"
                                        className={styles.input}
                                        placeholder="Thickness"
                                        value={comp.component_thickness}
                                        onChange={(e) => handleComponentChange(index, 'component_thickness', e.target.value)}
                                        required
                                        style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box', margin: 0, borderRadius: '4px' }}
                                    />
                                    <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                                        <button
                                            type="button"
                                            onClick={addComponent}
                                            style={{ background: '#e0f2fe', color: '#0284c7', border: '1px solid #bae6fd', borderRadius: '4px', padding: '0.25rem 0.5rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                        >
                                            + Add
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => removeComponent(index)}
                                            disabled={components.length === 1}
                                            style={{ background: components.length === 1 ? '#f1f5f9' : '#fee2e2', color: components.length === 1 ? '#94a3b8' : '#ef4444', border: '1px solid', borderColor: components.length === 1 ? '#e2e8f0' : '#fecaca', borderRadius: '4px', padding: '0.25rem 0.5rem', fontSize: '0.75rem', fontWeight: 600, cursor: components.length === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center' }}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className={styles.inputGroup} style={{ gridColumn: '1 / -1' }}>
                            <label>Remarks</label>
                            <input
                                type="text"
                                className={styles.input}
                                placeholder="Enter remarks (optional)"
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                        <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={() => {
                                setModelName('');
                                setMslLevel('');
                                setBakingTemperature('');
                                setRemarks('');
                                setComponents([{ vepl_part_number: '', manufacturer_part_number: '', reel_qty: '', component_thickness: '' }]);
                            }}
                            disabled={creating}
                        >
                            Reset
                        </button>
                        <button
                            type="submit"
                            className={styles.button}
                            disabled={creating}
                        >
                            {creating ? 'Creating...' : 'Create Baking Tracking Record'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Section 2: Pending Baking Track Record */}
            <div className={styles.card}>
                <div className={styles.tableHeader}>
                    <h3>Pending Baking Track Record</h3>
                    <form onSubmit={handlePendingSearchSubmit} className={styles.searchBar}>
                        <input
                            type="text"
                            className={styles.input}
                            placeholder="Search pending..."
                            value={pendingSearch}
                            onChange={(e) => setPendingSearch(e.target.value)}
                        />
                        <button type="submit" className={styles.button} style={{ padding: '0.5rem 1.25rem' }}>
                            Search
                        </button>
                    </form>
                </div>

                <div className={styles.tableContainer}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th onClick={() => handlePendingSort('model_name')} className={styles.sortable}>
                                    Model Name {pendingSortBy === 'model_name' ? (pendingSortOrder === 'ASC' ? '▲' : '▼') : ''}
                                </th>
                                <th onClick={() => handlePendingSort('msl_level')} className={styles.sortable}>
                                    MSL Level {pendingSortBy === 'msl_level' ? (pendingSortOrder === 'ASC' ? '▲' : '▼') : ''}
                                </th>
                                <th onClick={() => handlePendingSort('baking_temperature')} className={styles.sortable}>
                                    Temp {pendingSortBy === 'baking_temperature' ? (pendingSortOrder === 'ASC' ? '▲' : '▼') : ''}
                                </th>
                                <th onClick={() => handlePendingSort('baking_in_time')} className={styles.sortable}>
                                    Baking In Time {pendingSortBy === 'baking_in_time' ? (pendingSortOrder === 'ASC' ? '▲' : '▼') : ''}
                                </th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pendingLoading ? (
                                <tr>
                                    <td colSpan={9} style={{ textAlign: 'center', padding: '2rem' }}>
                                        Loading pending records...
                                    </td>
                                </tr>
                            ) : pendingRecords.length === 0 ? (
                                <tr>
                                    <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                                        No pending baking records found.
                                    </td>
                                </tr>
                            ) : (
                                pendingRecords.map((rec) => (
                                    <tr key={rec.id}>
                                        <td style={{ fontWeight: 600 }}>{rec.model_name}</td>
                                        <td>{rec.msl_level}</td>
                                        <td>{rec.baking_temperature}</td>
                                        <td>{formatTimestamp(rec.baking_in_time)}</td>
                                        <td>
                                            <div className={styles.actionCell}>
                                                <button
                                                    onClick={() => handleViewDetails(rec.id)}
                                                    className={styles.viewButton}
                                                >
                                                    View
                                                </button>
                                                <button
                                                    onClick={() => setStopRecordId(rec.id)}
                                                    className={styles.stopButton}
                                                >
                                                    Stop
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className={styles.paginationWrapper}>
                    <span>
                        Showing Page <strong>{pendingPage}</strong> of <strong>{pendingTotalPages}</strong> ({pendingTotal} records)
                    </span>
                    <div className={styles.paginationButtons}>
                        <button
                            className={styles.secondaryButton}
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                            disabled={pendingPage === 1}
                            onClick={() => setPendingPage(prev => Math.max(1, prev - 1))}
                        >
                            Previous
                        </button>
                        <button
                            className={styles.secondaryButton}
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                            disabled={pendingPage === pendingTotalPages}
                            onClick={() => setPendingPage(prev => Math.min(pendingTotalPages, prev + 1))}
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {/* Section 3: Completed Baking Track Record */}
            <div className={styles.card}>
                <div className={styles.tableHeader}>
                    <h3>Completed Baking Track Record</h3>
                    <form onSubmit={handleCompletedSearchSubmit} className={styles.searchBar}>
                        <input
                            type="text"
                            className={styles.input}
                            placeholder="Search completed..."
                            value={completedSearch}
                            onChange={(e) => setCompletedSearch(e.target.value)}
                        />
                        <button type="submit" className={styles.button} style={{ padding: '0.5rem 1.25rem' }}>
                            Search
                        </button>
                    </form>
                </div>

                <div className={styles.tableContainer}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th onClick={() => handleCompletedSort('model_name')} className={styles.sortable}>
                                    Model Name {completedSortBy === 'model_name' ? (completedSortOrder === 'ASC' ? '▲' : '▼') : ''}
                                </th>
                                <th onClick={() => handleCompletedSort('msl_level')} className={styles.sortable}>
                                    MSL Level {completedSortBy === 'msl_level' ? (completedSortOrder === 'ASC' ? '▲' : '▼') : ''}
                                </th>
                                <th onClick={() => handleCompletedSort('baking_temperature')} className={styles.sortable}>
                                    Temp {completedSortBy === 'baking_temperature' ? (completedSortOrder === 'ASC' ? '▲' : '▼') : ''}
                                </th>
                                <th onClick={() => handleCompletedSort('baking_in_time')} className={styles.sortable}>
                                    Baking In Time {completedSortBy === 'baking_in_time' ? (completedSortOrder === 'ASC' ? '▲' : '▼') : ''}
                                </th>
                                <th onClick={() => handleCompletedSort('baking_out_time')} className={styles.sortable}>
                                    Baking Out Time {completedSortBy === 'baking_out_time' ? (completedSortOrder === 'ASC' ? '▲' : '▼') : ''}
                                </th>
                                <th>Total Baking Time</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {completedLoading ? (
                                <tr>
                                    <td colSpan={11} style={{ textAlign: 'center', padding: '2rem' }}>
                                        Loading completed records...
                                    </td>
                                </tr>
                            ) : completedRecords.length === 0 ? (
                                <tr>
                                    <td colSpan={11} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                                        No completed baking records found.
                                    </td>
                                </tr>
                            ) : (
                                completedRecords.map((rec) => (
                                    <tr key={rec.id}>
                                        <td style={{ fontWeight: 600 }}>{rec.model_name}</td>
                                        <td>{rec.msl_level}</td>
                                        <td>{rec.baking_temperature}</td>
                                        <td>{formatTimestamp(rec.baking_in_time)}</td>
                                        <td>{formatTimestamp(rec.baking_out_time)}</td>
                                        <td>{calculateTotalBakingTime(rec.baking_in_time, rec.baking_out_time)}</td>
                                        <td>
                                            <div className={styles.actionCell}>
                                                <button
                                                    onClick={() => handleViewDetails(rec.id)}
                                                    className={styles.viewButton}
                                                >
                                                    View
                                                </button>
                                                {isSuperAdmin && (
                                                    <button
                                                        onClick={() => handleDelete(rec.id)}
                                                        className={styles.deleteButton}
                                                    >
                                                        Delete
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className={styles.paginationWrapper}>
                    <span>
                        Showing Page <strong>{completedPage}</strong> of <strong>{completedTotalPages}</strong> ({completedTotal} records)
                    </span>
                    <div className={styles.paginationButtons}>
                        <button
                            className={styles.secondaryButton}
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                            disabled={completedPage === 1}
                            onClick={() => setCompletedPage(prev => Math.max(1, prev - 1))}
                        >
                            Previous
                        </button>
                        <button
                            className={styles.secondaryButton}
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                            disabled={completedPage === completedTotalPages}
                            onClick={() => setCompletedPage(prev => Math.min(completedTotalPages, prev + 1))}
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {/* View Details Dialog Modal */}
            {viewRecord && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalHeader}>
                            <h3>🔍 Baking Tracking Record Details</h3>
                            <button className={styles.modalClose} onClick={() => setViewRecord(null)}>×</button>
                        </div>
                        <div className={styles.modalBody}>
                            {/* Section 1: Baking Information */}
                            <div>
                                <h4 className={styles.modalSectionTitle}>Baking Information</h4>
                                <div className={styles.modalGrid}>
                                    <div className={styles.modalField}>
                                        <span className={styles.modalLabel}>Model Name</span>
                                        <span className={styles.modalValue}>{viewRecord.model_name}</span>
                                    </div>
                                    <div className={styles.modalField}>
                                        <span className={styles.modalLabel}>MSL Level</span>
                                        <span className={styles.modalValue}>{viewRecord.msl_level}</span>
                                    </div>
                                    <div className={styles.modalField}>
                                        <span className={styles.modalLabel}>Baking Temperature</span>
                                        <span className={styles.modalValue}>{viewRecord.baking_temperature}</span>
                                    </div>
                                    <div className={styles.modalField}>
                                        <span className={styles.modalLabel}>Baking In Time</span>
                                        <span className={styles.modalValue}>{formatTimestamp(viewRecord.baking_in_time)}</span>
                                    </div>
                                    <div className={styles.modalField}>
                                        <span className={styles.modalLabel}>Baking Out Time</span>
                                        <span className={styles.modalValue}>{formatTimestamp(viewRecord.baking_out_time)}</span>
                                    </div>
                                    <div className={styles.modalField}>
                                        <span className={styles.modalLabel}>Baking Duration</span>
                                        <span className={styles.modalValue}>
                                            {viewRecord.status === 'Completed Baking' ? calculateTotalBakingTime(viewRecord.baking_in_time, viewRecord.baking_out_time) : 'Not Available Yet'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Section 1B: Components Table */}
                            {viewRecord.components && viewRecord.components.length > 0 && (
                                <div style={{ marginTop: '1.5rem' }}>
                                    <h4 className={styles.modalSectionTitle}>Components</h4>
                                    <table className={styles.table} style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                                        <thead style={{ background: '#f8fafc' }}>
                                            <tr>
                                                <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>S.No</th>
                                                <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>VEPL Part Number</th>
                                                <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Manufacturer Part Number</th>
                                                <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Reel Qty</th>
                                                <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Component Thickness</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {viewRecord.components.map((comp, i) => (
                                                <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                    <td style={{ padding: '0.5rem' }}>{i + 1}</td>
                                                    <td style={{ padding: '0.5rem' }}>{comp.vepl_part_number}</td>
                                                    <td style={{ padding: '0.5rem' }}>{comp.manufacturer_part_number || '—'}</td>
                                                    <td style={{ padding: '0.5rem' }}>{comp.reel_qty}</td>
                                                    <td style={{ padding: '0.5rem' }}>{comp.component_thickness || '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Section 2: QA Information */}
                            <div>
                                <h4 className={styles.modalSectionTitle}>QA Information</h4>
                                <div className={styles.modalGrid} style={{ gridTemplateColumns: '1fr' }}>
                                    <div className={styles.modalField}>
                                        <span className={styles.modalLabel}>Approved By QA</span>
                                        <span className={styles.modalValue}>{viewRecord.approved_by_qa || 'Not Available Yet'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: Audit Log */}
                            <div>
                                <h4 className={styles.modalSectionTitle}>Audit Log</h4>
                                <div className={styles.modalGrid}>
                                    <div className={styles.modalField}>
                                        <span className={styles.modalLabel}>Created By</span>
                                        <span className={styles.modalValue}>{formatUserName(viewRecord.created_by_name || viewRecord.created_by)}</span>
                                    </div>
                                    <div className={styles.modalField}>
                                        <span className={styles.modalLabel}>Created Date & Time</span>
                                        <span className={styles.modalValue}>{formatTimestamp(viewRecord.created_at)}</span>
                                    </div>

                                    <div className={styles.modalField}>
                                        <span className={styles.modalLabel}>Updated By</span>
                                        <span className={styles.modalValue}>
                                            {hasBeenUpdated(viewRecord) ? formatUserName(viewRecord.updated_by_name || viewRecord.updated_by) : 'Not Available Yet'}
                                        </span>
                                    </div>
                                    <div className={styles.modalField}>
                                        <span className={styles.modalLabel}>Updated Date & Time</span>
                                        <span className={styles.modalValue}>
                                            {hasBeenUpdated(viewRecord) ? formatTimestamp(viewRecord.updated_at) : 'Not Available Yet'}
                                        </span>
                                    </div>

                                    <div className={styles.modalField}>
                                        <span className={styles.modalLabel}>Stopped By</span>
                                        <span className={styles.modalValue}>
                                            {formatUserName(viewRecord.stopped_by_name || viewRecord.stopped_by)}
                                        </span>
                                    </div>
                                    <div className={styles.modalField}>
                                        <span className={styles.modalLabel}>Stopped Date & Time</span>
                                        <span className={styles.modalValue}>{formatTimestamp(viewRecord.stopped_at)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Remarks info if exists */}
                            {viewRecord.remarks && (
                                <div style={{ marginTop: '0.5rem' }}>
                                    <span className={styles.modalLabel}>Remarks</span>
                                    <div className={styles.modalValue} style={{ marginTop: '0.25rem', whiteSpace: 'pre-wrap' }}>
                                        {viewRecord.remarks}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className={styles.modalFooter}>
                            <button className={styles.secondaryButton} onClick={() => setViewRecord(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Stop Confirmation Dialog Modal */}
            {stopRecordId && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent} style={{ maxWidth: '500px' }}>
                        <div className={styles.modalHeader}>
                            <h3>⏱️ Stop Baking process</h3>
                            <button className={styles.modalClose} onClick={() => { setStopRecordId(null); setApprovedByQa(''); setStopRemarks(''); }}>×</button>
                        </div>
                        <form onSubmit={handleStopSubmit}>
                            <div className={styles.modalBody}>
                                <div className={styles.confirmationMsg}>
                                    <p><strong>Are you sure you want to stop this Baking Tracking Record?</strong></p>
                                    <p>This action will:</p>
                                    <ul>
                                        <li>Capture the Baking Out Time.</li>
                                        <li>Calculate the Baking Duration.</li>
                                        <li>Record the QA approval.</li>
                                        <li>Move the record to the Completed Baking Track Record.</li>
                                    </ul>
                                </div>

                                <div className={styles.inputGroup}>
                                    <label>Approved By QA <span>*</span></label>
                                    <input
                                        type="text"
                                        className={styles.input}
                                        placeholder="Enter QA Person Name"
                                        value={approvedByQa}
                                        onChange={(e) => setApprovedByQa(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className={styles.inputGroup}>
                                    <label>Remarks (Optional)</label>
                                    <input
                                        type="text"
                                        className={styles.input}
                                        placeholder="Enter optional stop remarks"
                                        value={stopRemarks}
                                        onChange={(e) => setStopRemarks(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className={styles.modalFooter} style={{ justifyContent: 'flex-end', gap: '1rem' }}>
                                <button
                                    type="button"
                                    className={styles.secondaryButton}
                                    onClick={() => { setStopRecordId(null); setApprovedByQa(''); setStopRemarks(''); }}
                                    disabled={stopping}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className={styles.button}
                                    style={{ background: '#ef4444' }}
                                    disabled={stopping}
                                >
                                    {stopping ? 'Stopping...' : 'Stop Baking'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BakingTrackingRecord;
