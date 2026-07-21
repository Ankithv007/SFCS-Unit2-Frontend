import React, { useState, useEffect } from 'react';
import styles from './StencilMasterRecord.module.css';
import { useSmtAuth } from '../../../context/SmtAuthContext';
import { useToast } from '../../../components/Toast';
import { apiFetch } from '../../../utils/api';

interface StencilRecord {
    id: string;
    stencil_name: string;
    job_number: string;
    revision: string;
    thickness_mills: string;
    manufacturing_date: string;
    side: 'TOP' | 'BOTTOM' | 'TOP / BOTTOM';
    storage_location: string | null;
    status: 'ACTIVE' | 'INACTIVE' | 'SCRAPPED';
    remarks: string | null;
    created_by_name: string;
    created_at: string;
}

interface PaginationInfo {
    total: number;
    page: number;
    limit: number;
    pages: number;
}

const StencilMasterRecord: React.FC = () => {
    const { smtUser, smtLogout } = useSmtAuth();
    const { showToast } = useToast();

    // Form States
    const [jobNumber, setJobNumber] = useState('');
    const [stencilName, setStencilName] = useState('');
    const [revision, setRevision] = useState('');
    const [thicknessMills, setThicknessMills] = useState('');
    const [manufacturingDate, setManufacturingDate] = useState('');
    const [side, setSide] = useState('');
    const [storageLocation, setStorageLocation] = useState('');
    const [remarks, setRemarks] = useState('');

    // Table Records and Pagination State
    const [records, setRecords] = useState<StencilRecord[]>([]);
    const [pagination, setPagination] = useState<PaginationInfo>({
        total: 0,
        page: 1,
        limit: 10,
        pages: 1
    });

    // Filtering, Sorting, and Pagination Controls
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [sortBy, setSortBy] = useState('stencil_name');
    const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [loading, setLoading] = useState(false);

    // Modal State
    const [viewRecord, setViewRecord] = useState<StencilRecord | null>(null);
    const [editRecord, setEditRecord] = useState<StencilRecord | null>(null);

    // Edit Form States
    const [editJobNumber, setEditJobNumber] = useState('');
    const [editRevision, setEditRevision] = useState('');
    const [editMfgDate, setEditMfgDate] = useState('');
    const [editStorage, setEditStorage] = useState('');
    const [editRemarks, setEditRemarks] = useState('');
    const [editStatus, setEditStatus] = useState<'ACTIVE' | 'INACTIVE' | 'SCRAPPED'>('ACTIVE');

    useEffect(() => {
        if (editRecord) {
            setEditJobNumber(editRecord.job_number);
            setEditRevision(editRecord.revision);
            setEditMfgDate(editRecord.manufacturing_date ? editRecord.manufacturing_date.split('T')[0] : '');
            setEditStorage(editRecord.storage_location || '');
            setEditRemarks(editRecord.remarks || '');
            setEditStatus(editRecord.status);
        }
    }, [editRecord]);

    const handleUpdateStencil = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editRecord) return;

        if (!editJobNumber.trim() || !editRevision.trim() || !editMfgDate) {
            showToast('Please fill all mandatory fields.', 'error');
            return;
        }

        const todayStr = new Date().toISOString().split('T')[0];
        if (editMfgDate > todayStr) {
            showToast('Manufacturing Date cannot be a future date.', 'error');
            return;
        }

        try {
            const payload = {
                job_number: editJobNumber,
                revision: editRevision,
                manufacturing_date: editMfgDate,
                storage_location: editStorage || null,
                remarks: editRemarks || null,
                status: editStatus
            };

            await apiFetch(`/api/smt/stencil-management/${editRecord.id}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });

            showToast('Stencil Record Updated Successfully.', 'success');
            setEditRecord(null);
            fetchRecords();
        } catch (err: any) {
            console.error('Update failed:', err);
            showToast(err.message || 'Failed to update stencil record.', 'error');
        }
    };

    // Debounce search query
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            setCurrentPage(1);
        }, 400);

        return () => clearTimeout(handler);
    }, [searchQuery]);

    // Fetch records from backend
    const fetchRecords = async () => {
        setLoading(true);
        try {
            const url = new URL('/api/smt/stencil-management/records', window.location.origin);
            url.searchParams.set('page', currentPage.toString());
            url.searchParams.set('limit', pageSize.toString());
            url.searchParams.set('search', debouncedSearch);
            url.searchParams.set('sortBy', sortBy);
            url.searchParams.set('sortOrder', sortOrder);

            const result = await apiFetch(url.toString());
            setRecords(result.data);
            setPagination(result.pagination);
        } catch (err: any) {
            console.error('Error fetching stencil records:', err);
            showToast(err.message || 'Failed to fetch stencil records.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRecords();
    }, [currentPage, pageSize, debouncedSearch, sortBy, sortOrder]);

    // Form Submission
    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();

        // 1. Validate mandatory fields
        if (!jobNumber.trim() || !stencilName.trim() || !revision.trim() ||
            !thicknessMills.trim() || !manufacturingDate || !side) {
            showToast('Please fill all mandatory fields.', 'error');
            return;
        }

        // 2. Validate Manufacturing Date not in future
        const todayStr = new Date().toISOString().split('T')[0];
        if (manufacturingDate > todayStr) {
            showToast('Manufacturing Date cannot be a future date.', 'error');
            return;
        }

        try {
            const payload = {
                stencil_name: stencilName,
                job_number: jobNumber,
                revision: revision,
                thickness_mills: thicknessMills,
                manufacturing_date: manufacturingDate,
                side: side,
                storage_location: storageLocation || null,
                remarks: remarks || null
            };

            await apiFetch('/api/smt/stencil-management/create', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            showToast('Stencil Record Created Successfully.', 'success');

            // Reset Form fields
            setJobNumber('');
            setStencilName('');
            setRevision('');
            setThicknessMills('');
            setManufacturingDate('');
            setSide('');
            setStorageLocation('');
            setRemarks('');

            fetchRecords();
        } catch (err: any) {
            console.error('Registration failed:', err);
            showToast(err.message || 'Failed to create stencil record.', 'error');
        }
    };

    // Sort Handler
    const handleSort = (column: string) => {
        if (sortBy === column) {
            setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
        } else {
            setSortBy(column);
            setSortOrder('ASC');
        }
        setCurrentPage(1);
    };

    // Excel Export
    const handleExportExcel = async () => {
        try {
            const blob = await apiFetch('/api/smt/stencil-management/export') as Blob;
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'SMT_Stencil_Master_Report.xlsx');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            showToast('Stencil report exported successfully.', 'success');
        } catch (err: any) {
            console.error('Excel export failed:', err);
            showToast(err.message || 'Failed to export Excel report.', 'error');
        }
    };

    const getShift = () => {
        const hour = new Date().getHours();
        if (hour >= 23 || hour < 7) return 'C (11PM - 07AM)';
        if (hour >= 15 && hour < 23) return 'B (03PM - 11PM)';
        if (hour >= 8 && hour < 17) return 'G (08AM - 05PM)';
        if (hour >= 6 && hour < 15) return 'A (06AM - 03PM)';
        return 'N/A';
    };

    return (
        <div className={styles.container}>
            {/* Header row */}
            <div className={styles.headerRow}>
                <div className={styles.headerContent}>
                    <h2> Stencil Master Record</h2>
                    <p>Register and maintain all stencil master logs. Shift: <strong>{getShift()}</strong></p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ fontSize: '0.9rem', color: '#64748b', background: '#e2e8f0', padding: '0.4rem 0.8rem', borderRadius: '6px', fontWeight: 'bold' }}>
                        Operator: {smtUser?.name || 'Guest'} ({smtUser?.role || 'Guest'})
                    </span>
                    <button
                        onClick={() => { if (window.confirm('Are you sure you want to logout from SMT?')) smtLogout(); }}
                        className={styles.secondaryButton}
                        style={{ borderColor: '#ef4444', color: '#ef4444', padding: '0.5rem 1rem' }}
                    >
                        Logout SMT
                    </button>
                </div>
            </div>

            {/* Registration Card */}
            <div className={styles.card}>
                <h3>Manual Stencil Registration</h3>
                <form onSubmit={handleRegister}>
                    <div className={styles.formGrid}>
                        <div className={styles.inputGroup}>
                            <label>Job Number <span>*</span></label>
                            <input
                                type="text"
                                className={styles.input}
                                placeholder="Enter Job Number"
                                value={jobNumber}
                                onChange={(e) => setJobNumber(e.target.value)}
                                required
                            />
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Stencil / Model Name <span>*</span></label>
                            <input
                                type="text"
                                className={styles.input}
                                placeholder="Enter Stencil / Model Name"
                                value={stencilName}
                                onChange={(e) => setStencilName(e.target.value)}
                                required
                            />
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Revision <span>*</span></label>
                            <input
                                type="text"
                                className={styles.input}
                                placeholder="Enter Revision (e.g. 1.0)"
                                value={revision}
                                onChange={(e) => setRevision(e.target.value)}
                                required
                            />
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Thickness <span>*</span></label>
                            <input
                                type="text"
                                className={styles.input}
                                placeholder="Enter Thickness"
                                value={thicknessMills}
                                onChange={(e) => setThicknessMills(e.target.value)}
                                required
                            />
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Manufacturing Date <span>*</span></label>
                            <input
                                type="date"
                                className={styles.input}
                                value={manufacturingDate}
                                onChange={(e) => setManufacturingDate(e.target.value)}
                                required
                            />
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Sides <span>*</span></label>
                            <select
                                className={styles.select}
                                value={side}
                                onChange={(e) => setSide(e.target.value)}
                                required
                            >
                                <option value="">Select Side</option>
                                <option value="TOP">TOP</option>
                                <option value="BOTTOM">BOTTOM</option>
                                <option value="TOP / BOTTOM">TOP / BOTTOM</option>
                            </select>
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Storage Location</label>
                            <input
                                type="text"
                                className={styles.input}
                                placeholder="e.g. Rack A-01"
                                value={storageLocation}
                                onChange={(e) => setStorageLocation(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className={styles.inputGroup} style={{ marginTop: '1rem', marginBottom: '1.5rem' }}>
                        <label>Remarks</label>
                        <textarea
                            className={styles.textarea}
                            placeholder="Remarks (Optional, e.g. Reserved for Pilot Production)"
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            rows={3}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                        <button type="submit" className={styles.button}>
                            Create Stencil Master Record
                        </button>
                    </div>
                </form>
            </div>

            {/* Completed Master Records Section */}
            <div className={styles.card}>
                <div className={styles.tableHeader}>
                    <h3 style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: 0 }}>
                        Completed Master Records
                    </h3>
                    <button className={styles.secondaryButton} onClick={handleExportExcel}>
                        📥 Export Excel Report
                    </button>
                </div>

                {/* Filter and PageSize controls */}
                <div className={styles.searchForm}>
                    <div className={styles.searchBar}>
                        <input
                            type="text"
                            className={styles.input}
                            placeholder="Search by Stencil / Model Name, Revision..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ backgroundColor: 'white' }}
                        />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.9rem', color: '#64748b' }}>Show</span>
                        <select
                            value={pageSize}
                            onChange={(e) => {
                                setPageSize(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className={styles.select}
                            style={{ width: '80px', padding: '0.35rem 0.75rem', height: '38px', backgroundColor: 'white' }}
                        >
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                        <span style={{ fontSize: '0.9rem', color: '#64748b' }}>entries</span>
                    </div>
                </div>

                {/* Table Container */}
                <div className={styles.tableContainer}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th onClick={() => handleSort('stencil_name')} className={styles.sortable}>
                                    Stencil / Model Name {sortBy === 'stencil_name' && (sortOrder === 'ASC' ? '▲' : '▼')}
                                </th>
                                <th onClick={() => handleSort('job_number')} className={styles.sortable}>
                                    Job Number {sortBy === 'job_number' && (sortOrder === 'ASC' ? '▲' : '▼')}
                                </th>
                                <th onClick={() => handleSort('revision')} className={styles.sortable}>
                                    Revision {sortBy === 'revision' && (sortOrder === 'ASC' ? '▲' : '▼')}
                                </th>
                                <th>Thickness</th>
                                <th onClick={() => handleSort('manufacturing_date')} className={styles.sortable} style={{ textAlign: 'center' }}>
                                    Manufacturing Date {sortBy === 'manufacturing_date' && (sortOrder === 'ASC' ? '▲' : '▼')}
                                </th>
                                <th style={{ textAlign: 'center' }}>Sides</th>
                                <th style={{ textAlign: 'center' }}>Status</th>
                                <th style={{ textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                                        Loading records...
                                    </td>
                                </tr>
                            ) : records.length === 0 ? (
                                <tr>
                                    <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                        No stencil records found.
                                    </td>
                                </tr>
                            ) : (
                                records.map((rec) => (
                                    <tr key={rec.id}>
                                        <td style={{ fontWeight: 'bold' }}>{rec.stencil_name}</td>
                                        <td>{rec.job_number}</td>
                                        <td>{rec.revision}</td>
                                        <td>{rec.thickness_mills}</td>
                                        <td style={{ textAlign: 'center' }}>{rec.manufacturing_date ? new Date(rec.manufacturing_date).toISOString().split('T')[0] : '-'}</td>
                                        <td style={{ fontWeight: 'bold', textAlign: 'center' }}>{rec.side}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span className={`${styles.statusBadge} ${rec.status === 'ACTIVE' ? styles.statusActive :
                                                    rec.status === 'INACTIVE' ? styles.statusInactive :
                                                        styles.statusScrapped
                                                }`}>
                                                {rec.status}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <div className={styles.actionCell} style={{ justifyContent: 'center' }}>
                                                <button
                                                    className={styles.viewButton}
                                                    onClick={() => setViewRecord(rec)}
                                                    style={{ marginRight: '0.25rem' }}
                                                >
                                                    View
                                                </button>
                                                {['Super Admin', 'Admin', 'Manager'].includes(smtUser?.role || '') && (
                                                    <button
                                                        className={styles.editButton}
                                                        onClick={() => setEditRecord(rec)}
                                                    >
                                                        Edit
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
                {records.length > 0 && (
                    <div className={styles.paginationWrapper}>
                        <div>
                            Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, pagination.total)} of {pagination.total} records
                        </div>
                        <div className={styles.paginationButtons}>
                            <button
                                className={styles.secondaryButton}
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                            >
                                Previous
                            </button>
                            <button
                                className={styles.secondaryButton}
                                disabled={currentPage >= pagination.pages}
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, pagination.pages))}
                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* View Details Modal */}
            {viewRecord && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalHeader}>
                            <h3>🔍 Stencil Details</h3>
                            <button className={styles.modalClose} onClick={() => setViewRecord(null)}>
                                &times;
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.grid2}>
                                <div className={styles.inputGroup}>
                                    <label>Stencil / Model Name</label>
                                    <div className={styles.readOnlyValue}>{viewRecord.stencil_name}</div>
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>Job Number</label>
                                    <div className={styles.readOnlyValue}>{viewRecord.job_number}</div>
                                </div>
                            </div>
                            <div className={styles.grid2}>
                                <div className={styles.inputGroup}>
                                    <label>Revision</label>
                                    <div className={styles.readOnlyValue}>{viewRecord.revision}</div>
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>Thickness</label>
                                    <div className={styles.readOnlyValue}>{viewRecord.thickness_mills}</div>
                                </div>
                            </div>
                            <div className={styles.grid2}>
                                <div className={styles.inputGroup}>
                                    <label>Manufacturing Date</label>
                                    <div className={styles.readOnlyValue}>
                                        {viewRecord.manufacturing_date ? new Date(viewRecord.manufacturing_date).toISOString().split('T')[0] : ''}
                                    </div>
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>Sides</label>
                                    <div className={styles.readOnlyValue}>{viewRecord.side}</div>
                                </div>
                            </div>
                            <div className={styles.grid2}>
                                <div className={styles.inputGroup}>
                                    <label>Status</label>
                                    <div className={styles.readOnlyValue}>{viewRecord.status}</div>
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>Storage Location</label>
                                    <div className={styles.readOnlyValue}>{viewRecord.storage_location || '-'}</div>
                                </div>
                            </div>
                            {/* Remarks */}
                            {viewRecord.remarks && viewRecord.remarks.trim() && (
                                <div className={styles.inputGroup} style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                                    <label>Remarks</label>
                                    <div className={styles.readOnlyValue}>{viewRecord.remarks}</div>
                                </div>
                            )}

                            {/* Audit Information */}
                            <h4 style={{ marginTop: '1.5rem', marginBottom: '0.75rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.25rem', color: '#475569', fontSize: '0.95rem', fontWeight: 'bold' }}>
                                📋 Audit Information
                            </h4>
                            <div className={styles.grid2}>
                                <div className={styles.inputGroup}>
                                    <label>Created By</label>
                                    <div className={styles.readOnlyValue}>{viewRecord.created_by_name}</div>
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>Created Date & Time</label>
                                    <div className={styles.readOnlyValue}>
                                        {viewRecord.created_at ? new Date(viewRecord.created_at).toLocaleString() : ''}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <button className={styles.secondaryButton} onClick={() => setViewRecord(null)}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Details Modal */}
            {editRecord && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <form onSubmit={handleUpdateStencil}>
                            <div className={styles.modalHeader}>
                                <h3>✏️ Edit Stencil Details</h3>
                                <button type="button" className={styles.modalClose} onClick={() => setEditRecord(null)}>
                                    &times;
                                </button>
                            </div>
                            <div className={styles.modalBody}>
                                <div className={styles.grid2}>
                                    <div className={styles.inputGroup}>
                                        <label>Stencil / Model Name</label>
                                        <div className={styles.readOnlyValue}>{editRecord.stencil_name}</div>
                                    </div>
                                    <div className={styles.inputGroup}>
                                        <label>Status <span>*</span></label>
                                        <select
                                            className={styles.select}
                                            value={editStatus}
                                            onChange={(e) => setEditStatus(e.target.value as any)}
                                            required
                                        >
                                            <option value="ACTIVE">ACTIVE</option>
                                            <option value="INACTIVE">INACTIVE</option>
                                            <option value="SCRAPPED">SCRAPPED</option>
                                        </select>
                                    </div>
                                </div>
                                <div className={styles.grid2}>
                                    <div className={styles.inputGroup}>
                                        <label>Job Number <span>*</span></label>
                                        <input
                                            type="text"
                                            className={styles.input}
                                            value={editJobNumber}
                                            onChange={(e) => setEditJobNumber(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className={styles.inputGroup}>
                                        <label>Revision <span>*</span></label>
                                        <input
                                            type="text"
                                            className={styles.input}
                                            value={editRevision}
                                            onChange={(e) => setEditRevision(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className={styles.grid2}>
                                    <div className={styles.inputGroup}>
                                        <label>Manufacturing Date <span>*</span></label>
                                        <input
                                            type="date"
                                            className={styles.input}
                                            value={editMfgDate}
                                            onChange={(e) => setEditMfgDate(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className={styles.inputGroup}>
                                        <label>Storage Location</label>
                                        <input
                                            type="text"
                                            className={styles.input}
                                            value={editStorage}
                                            onChange={(e) => setEditStorage(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className={styles.inputGroup} style={{ marginBottom: '1rem' }}>
                                    <label>Remarks</label>
                                    <textarea
                                        className={styles.textarea}
                                        value={editRemarks}
                                        onChange={(e) => setEditRemarks(e.target.value)}
                                        rows={3}
                                    />
                                </div>
                            </div>
                            <div className={styles.modalFooter}>
                                <button type="button" className={styles.secondaryButton} onClick={() => setEditRecord(null)} style={{ marginRight: '1rem' }}>
                                    Cancel
                                </button>
                                <button type="submit" className={styles.button}>
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StencilMasterRecord;
