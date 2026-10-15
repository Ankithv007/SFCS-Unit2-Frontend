import React, { useState, useEffect } from 'react';
import styles from './StencilRackManagement.module.css';
import { useToast } from '../../../components/Toast';
import { apiFetch } from '../../../utils/api';
import { useAuth } from '../../../hooks/useAuth';
import { 
    Grid, Plus, Trash2, Edit2, AlertCircle, X, Info, Settings, FileSpreadsheet, Search, ArrowLeft
} from 'lucide-react';

interface Rack {
    id: string;
    name: string;
    rows: number;
    columns: number;
    description: string | null;
    status: 'ACTIVE' | 'INACTIVE';
    capacity?: number;
    occupied?: number;
}

interface RackLocation {
    id: string;
    rack_id: string;
    row_number: number;
    column_number: number;
    location_code: string;
    status: 'EMPTY' | 'STORED' | 'CHECKED_OUT';
    stencil_rack_number: string | null;
    job_number: string | null;
    stencil_name: string | null;
    revision: string | null;
    thickness_mills: number | null;
    manufacturing_date: string | null;
    side: 'TOP' | 'BOTTOM' | 'TOP/BOTTOM' | null;
    remarks: string | null;
    checked_out_by_code: string | null;
    checked_out_by_name: string | null;
    checked_out_by_dept: string | null;
    checked_out_by_role: string | null;
    checked_out_at: string | null;
    is_blocked?: boolean;
    blocked_reason?: string | null;
    blocked_by_code?: string | null;
    blocked_by_name?: string | null;
    blocked_at?: string | null;
}

interface StencilDetails {
    stencil_rack_number: string | null;
    job_number: string | null;
    stencil_name: string | null;
    revision: string | null;
    thickness_mills: number | null;
    manufacturing_date: string | null;
    side: 'TOP' | 'BOTTOM' | 'TOP/BOTTOM' | null;
    location_id: string;
    location_code: string;
    rack_id: string;
    rack_name: string;
    rack_status: 'ACTIVE' | 'INACTIVE';
    row_number: number;
    column_number: number;
    location_status: 'STORED' | 'CHECKED_OUT' | 'EMPTY';
    is_blocked?: boolean;
    blocked_reason?: string | null;
    blocked_by_code?: string | null;
    blocked_by_name?: string | null;
    blocked_at?: string | null;
    remarks: string | null;
    holder: {
        employee_code: string | null;
        employee_name: string | null;
        department: string | null;
        role: string | null;
        received_at: string | null;
        elapsed_time: string | null;
        work_order_id: string | null;
        work_order_number: string | null;
        work_order_side: string | null;
        machine: string | null;
        production_line: string | null;
        remarks: string | null;
    } | null;
}

const StencilRackManagement: React.FC = () => {
    const { showToast } = useToast();
    const { user, permissions } = useAuth();

    const userRole = user?.role || '';
    const isSuperAdmin = userRole === 'Super Admin';
    const allowedCreateRoles = ['Super Admin', 'Admin', 'Manager'];
    const canCreateRack = allowedCreateRoles.some(r => r.toLowerCase() === userRole.toLowerCase().trim()) || permissions.some(p => p.permission_key === 'smt_stencil_rack' && p.can_create);
    const canEditLocations = isSuperAdmin || permissions.some(p => p.permission_key === 'smt_stencil_rack' && p.can_edit);

    // State
    const [loading, setLoading] = useState(false);
    const [racks, setRacks] = useState<Rack[]>([]);
    const [selectedRack, setSelectedRack] = useState<Rack | null>(null);
    const [locations, setLocations] = useState<RackLocation[]>([]);
    const [selectedLocation, setSelectedLocation] = useState<RackLocation | null>(null);

    // Search Stencil State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchedStencil, setSearchedStencil] = useState<StencilDetails | null>(null);
    const [searchNoResult, setSearchNoResult] = useState(false);
    const [lastSearchedQuery, setLastSearchedQuery] = useState('');

    // Modals
    const [showRackModal, setShowRackModal] = useState(false);
    const [editRackData, setEditRackData] = useState<Rack | null>(null);
    const [showEditLocationModal, setShowEditLocationModal] = useState(false);
    const [downloadingRackId, setDownloadingRackId] = useState<string | null>(null);

    const handleDownloadRackExcel = async (rack: Rack) => {
        if (!rack || !rack.id) return;
        setDownloadingRackId(rack.id);
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`/api/smt/stencil-rack/${rack.id}/export/excel`, {
                method: 'GET',
                headers: {
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.message || `Failed to export Excel for rack ${rack.name}`);
            }

            const blob = await response.blob();
            const safeName = rack.name.replace(/[^a-zA-Z0-9_-]/g, '_');
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Stencil_Rack_${safeName}_Report.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            showToast(`Excel report downloaded for rack: ${rack.name}`, 'success');
        } catch (err: any) {
            console.error('Error downloading rack Excel report:', err);
            showToast(err.message || 'Failed to download Excel report', 'error');
        } finally {
            setDownloadingRackId(null);
        }
    };

    // Rack Form State
    const [rackName, setRackName] = useState('');
    const [rackRows, setRackRows] = useState(4);
    const [rackColumns, setRackColumns] = useState(4);
    const [rackDesc, setRackDesc] = useState('');
    const [rackStatus, setRackStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');

    // Location/Stencil Edit Form State
    const [stencilRackNumber, setStencilRackNumber] = useState('');
    const [stencilJobNumber, setStencilJobNumber] = useState('');
    const [stencilName, setStencilName] = useState('');
    const [stencilRevision, setStencilRevision] = useState('');
    const [stencilThickness, setStencilThickness] = useState('');
    const [stencilMfgDate, setStencilMfgDate] = useState('');
    const [stencilSide, setStencilSide] = useState<'TOP' | 'BOTTOM' | 'TOP/BOTTOM' | ''>('');
    const [stencilRemarks, setStencilRemarks] = useState('');

    useEffect(() => {
        fetchRacks();
    }, []);

    useEffect(() => {
        if (selectedRack) {
            fetchLocations(selectedRack.id);
        } else {
            setLocations([]);
            setSelectedLocation(null);
        }
    }, [selectedRack]);

    const fetchRacks = async () => {
        setLoading(true);
        try {
            const res = await apiFetch('/api/smt/stencil-rack');
            if (res.success) {
                setRacks(res.racks);
                if (selectedRack) {
                    const updated = res.racks.find((r: Rack) => r.id === selectedRack.id);
                    if (updated) setSelectedRack(updated);
                }
            }
        } catch (err: any) {
            showToast(err.message || 'Failed to fetch racks.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchLocations = async (rackId: string) => {
        try {
            const res = await apiFetch(`/api/smt/stencil-rack/${rackId}/locations`);
            if (res.success) {
                setLocations(res.locations);
            }
        } catch (err: any) {
            showToast(err.message || 'Failed to fetch rack locations.', 'error');
        }
    };

    // Racks Management Operations
    const handleOpenCreateRack = () => {
        setEditRackData(null);
        setRackName('');
        setRackRows(4);
        setRackColumns(4);
        setRackDesc('');
        setRackStatus('ACTIVE');
        setShowRackModal(true);
    };

    const handleOpenEditRack = (rack: Rack) => {
        setEditRackData(rack);
        setRackName(rack.name);
        setRackRows(rack.rows);
        setRackColumns(rack.columns);
        setRackDesc(rack.description || '');
        setRackStatus(rack.status);
        setShowRackModal(true);
    };

    const handleSaveRack = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!rackName.trim() || rackRows < 1 || rackColumns < 1) {
            showToast('Please fill all mandatory fields correctly.', 'error');
            return;
        }

        try {
            const payload = {
                name: rackName.trim(),
                rows: rackRows,
                columns: rackColumns,
                description: rackDesc.trim(),
                status: rackStatus
            };

            if (editRackData) {
                const res = await apiFetch(`/api/smt/stencil-rack/${editRackData.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
                if (res.success) {
                    showToast('Rack configuration updated successfully.', 'success');
                    setShowRackModal(false);
                    fetchRacks();
                }
            } else {
                const res = await apiFetch('/api/smt/stencil-rack', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                if (res.success) {
                    showToast('Rack created successfully.', 'success');
                    setShowRackModal(false);
                    fetchRacks();
                }
            }
        } catch (err: any) {
            showToast(err.message || 'Failed to save rack configuration.', 'error');
        }
    };

    const handleDeleteRack = async (rack: Rack) => {
        if (rack.occupied && rack.occupied > 0) {
            showToast('Cannot delete rack because it contains stencils. Relocate or clear stencils first.', 'error');
            return;
        }

        if (!window.confirm(`Are you sure you want to delete rack "${rack.name}"? This operation is permanent.`)) {
            return;
        }

        try {
            const res = await apiFetch(`/api/smt/stencil-rack/${rack.id}`, {
                method: 'DELETE'
            });
            if (res.success) {
                showToast('Rack deleted successfully.', 'success');
                if (selectedRack?.id === rack.id) setSelectedRack(null);
                fetchRacks();
            }
        } catch (err: any) {
            showToast(err.message || 'Failed to delete rack.', 'error');
        }
    };

    // Stencil Click Location Assignment & Updates
    const handleCellClick = (location: RackLocation) => {
        setSelectedLocation(location);

        // Prepopulate fields
        setStencilRackNumber(location.stencil_rack_number || '');
        setStencilJobNumber(location.job_number || '');
        setStencilName(location.stencil_name || '');
        setStencilRevision(location.revision || '');
        setStencilThickness(location.thickness_mills ? location.thickness_mills.toString() : '');
        setStencilSide(location.side || '');
        setStencilRemarks(location.remarks || '');

        if (location.manufacturing_date) {
            // Extract YYYY-MM-DD from date string
            const dateObj = new Date(location.manufacturing_date);
            const yyyy = dateObj.getFullYear();
            const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
            const dd = String(dateObj.getDate()).padStart(2, '0');
            setStencilMfgDate(`${yyyy}-${mm}-${dd}`);
        } else {
            setStencilMfgDate('');
        }

        setShowEditLocationModal(true);
    };

    const handleSaveLocation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedLocation) return;

        if (selectedLocation.status === 'CHECKED_OUT') {
            showToast('This stencil is checked out to SMT Production. Modifying its configuration is blocked.', 'error');
            return;
        }

        if (!stencilRackNumber.trim()) {
            showToast('Stencil Rack Number is a mandatory field.', 'error');
            return;
        }

        if (!stencilJobNumber.trim()) {
            showToast('Job Number is a mandatory field.', 'error');
            return;
        }

        try {
            const payload = {
                stencil_rack_number: stencilRackNumber.trim(),
                job_number: stencilJobNumber.trim(),
                stencil_name: stencilName.trim(),
                revision: stencilRevision.trim(),
                thickness_mills: stencilThickness ? parseFloat(stencilThickness) : null,
                manufacturing_date: stencilMfgDate || null,
                side: stencilSide || null,
                remarks: stencilRemarks.trim()
            };

            const res = await apiFetch(`/api/smt/stencil-rack/locations/${selectedLocation.id}/assign`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            if (res.success) {
                showToast(res.message, 'success');
                setShowEditLocationModal(false);
                if (selectedRack) {
                    fetchLocations(selectedRack.id);
                }
                fetchRacks();
            }
        } catch (err: any) {
            showToast(err.message || 'Failed to save location details.', 'error');
        }
    };

    const handleClearLocation = async () => {
        if (!selectedLocation) return;

        if (selectedLocation.status === 'CHECKED_OUT') {
            showToast('This stencil is checked out to SMT Production. Clearing its slot assignment is blocked.', 'error');
            return;
        }

        if (!window.confirm(`Are you sure you want to clear stencil "${selectedLocation.stencil_rack_number || selectedLocation.job_number}" from location ${selectedLocation.location_code}?`)) {
            return;
        }

        try {
            const res = await apiFetch(`/api/smt/stencil-rack/locations/${selectedLocation.id}/clear`, {
                method: 'POST'
            });

            if (res.success) {
                showToast('Location slot assignment cleared.', 'success');
                setShowEditLocationModal(false);
                if (selectedRack) {
                    fetchLocations(selectedRack.id);
                }
                fetchRacks();
            }
        } catch (err: any) {
            showToast(err.message || 'Failed to clear location slot.', 'error');
        }
    };

    // Stencil Block / Unblock Handler
    const handleToggleBlock = async (loc: RackLocation | StencilDetails, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();

        const currentStatus = 'status' in loc ? loc.status : loc.location_status;
        if (currentStatus === 'EMPTY') {
            showToast('Cannot block or unblock an empty location slot.', 'error');
            return;
        }

        const isCheckedOut = currentStatus === 'CHECKED_OUT';
        const isCurrentlyBlocked = Boolean(loc.is_blocked);
        const locId = 'location_id' in loc ? loc.location_id : loc.id;
        const stencilIdentifier = loc.stencil_rack_number || loc.job_number || 'Stencil';

        if (!isCurrentlyBlocked) {
            // Attempting to BLOCK
            if (isCheckedOut) {
                showToast('Blocking is not applicable: this stencil is already checked out. Return it to the rack before blocking.', 'error');
                return;
            }

            if (currentStatus !== 'STORED') {
                showToast('A stencil can be blocked only while it is physically stored in the rack (STORED).', 'error');
                return;
            }

            const promptReason = window.prompt(
                `Enter reason for blocking Stencil "${stencilIdentifier}":`,
                'Damaged / Needs Maintenance / Mesh Tension Issue'
            );
            if (promptReason === null) return; // User cancelled
            const reason = promptReason.trim() || 'Operational block applied by supervisor.';

            try {
                const res = await apiFetch(`/api/smt/stencil-rack/locations/${locId}/block`, {
                    method: 'PATCH',
                    body: JSON.stringify({ block: true, reason })
                });

                if (res.success) {
                    showToast(res.message || `Stencil "${stencilIdentifier}" is now BLOCKED.`, 'success');
                    if (selectedRack) {
                        fetchLocations(selectedRack.id);
                    }
                    if (selectedLocation && selectedLocation.id === locId) {
                        setSelectedLocation(prev => prev ? { ...prev, is_blocked: true, blocked_reason: reason } : null);
                    }
                    if (searchedStencil && (searchedStencil.location_id === locId || searchedStencil.stencil_rack_number === loc.stencil_rack_number)) {
                        setSearchedStencil(prev => prev ? { ...prev, is_blocked: true, blocked_reason: reason } : null);
                    }
                }
            } catch (err: any) {
                showToast(err.message || 'Failed to block stencil.', 'error');
            }
        } else {
            // Attempting to UNBLOCK
            if (!window.confirm(`Are you sure you want to unblock Stencil "${stencilIdentifier}"?`)) {
                return;
            }

            try {
                const res = await apiFetch(`/api/smt/stencil-rack/locations/${locId}/block`, {
                    method: 'PATCH',
                    body: JSON.stringify({ block: false })
                });

                if (res.success) {
                    showToast(res.message || `Stencil "${stencilIdentifier}" has been unblocked.`, 'success');
                    if (selectedRack) {
                        fetchLocations(selectedRack.id);
                    }
                    if (selectedLocation && selectedLocation.id === locId) {
                        setSelectedLocation(prev => prev ? { ...prev, is_blocked: false, blocked_reason: null, blocked_by_name: null, blocked_at: null } : null);
                    }
                    if (searchedStencil && (searchedStencil.location_id === locId || searchedStencil.stencil_rack_number === loc.stencil_rack_number)) {
                        setSearchedStencil(prev => prev ? { ...prev, is_blocked: false, blocked_reason: null, blocked_by_name: null, blocked_at: null } : null);
                    }
                }
            } catch (err: any) {
                showToast(err.message || 'Failed to unblock stencil.', 'error');
            }
        }
    };

    // Stencil Search Handler (Read-Only)
    const handleSearchSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const query = searchQuery.trim();
        if (!query) {
            showToast('Please enter a Rack Number, Job Number, or Stencil / Model Name to search.', 'info');
            return;
        }

        setSearchLoading(true);
        setSearchNoResult(false);
        setLastSearchedQuery(query);

        try {
            const res = await apiFetch(`/api/smt/stencil-rack/stencil-info/${encodeURIComponent(query)}`);
            if (res.success && res.stencil) {
                setSearchedStencil(res.stencil);
                setSearchNoResult(false);
                showToast(`Found stencil details for '${query}'`, 'success');
            } else {
                setSearchedStencil(null);
                setSearchNoResult(true);
                showToast(res.message || 'No matching stencil record found.', 'info');
            }
        } catch (err: any) {
            setSearchedStencil(null);
            setSearchNoResult(true);
            showToast(err.message || `No matching stencil record found for '${query}'.`, 'error');
        } finally {
            setSearchLoading(false);
        }
    };

    const handleClearSearch = () => {
        setSearchQuery('');
        setSearchedStencil(null);
        setSearchNoResult(false);
        setLastSearchedQuery('');
    };

    return (
        <div className={styles.container}>
            {/* Header Area */}
            <div className={styles.headerRow}>
                <div className={styles.headerContent}>
                    <h2><Grid size={24} /> Stencil Rack Configuration</h2>
                    <p>Register stencil racks, configure grids, and manage direct coordinates stencil storage.</p>
                </div>
                <div className={styles.actionButtons}>
                    <form className={styles.searchForm} onSubmit={handleSearchSubmit}>
                        <div className={styles.searchInputWrapper}>
                            <Search size={16} className={styles.searchIcon} />
                            <input 
                                type="text"
                                className={styles.searchInput}
                                value={searchQuery}
                                onChange={e => {
                                    setSearchQuery(e.target.value);
                                    if (searchNoResult) setSearchNoResult(false);
                                }}
                                placeholder="Search by Rack Number, Job Number, or Stencil / Model Name"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    className={styles.searchClearBtn}
                                    onClick={handleClearSearch}
                                    title="Clear search"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                        <button 
                            type="submit" 
                            className={styles.btnPrimary} 
                            disabled={searchLoading || !searchQuery.trim()}
                        >
                            {searchLoading ? 'Searching...' : 'Search'}
                        </button>
                    </form>
                    {canCreateRack && (
                        <button className={styles.btnPrimary} onClick={handleOpenCreateRack}>
                            <Plus size={18} /> Add Stencil Rack
                        </button>
                    )}
                </div>
            </div>

            {/* Main Layout (Racks List + Coordinate Matrix) */}
            <div className={styles.mainLayout}>
                
                {/* Horizontal Rack Cards Selector */}
                <div className={styles.rackSelectorContainer}>
                    <h3 className={styles.sidebarTitle}>Select Stencil Rack</h3>
                    <div className={styles.selectorBody}>
                        {/* Existing Horizontal Rack Cards Selector */}
                        <div className={styles.rackHorizontalSelector}>
                            {loading && racks.length === 0 ? (
                                <div className={styles.emptyStateSimple}>Loading racks...</div>
                            ) : racks.length === 0 ? (
                                <div className={styles.emptyStateSimple}>No racks registered. Create one to begin.</div>
                            ) : (
                                racks.map(rack => (
                                    <div 
                                        key={rack.id}
                                        className={`${styles.rackHorizontalCard} ${!searchedStencil && !searchNoResult && selectedRack?.id === rack.id ? styles.activeRackHorizontalCard : ''}`}
                                        onClick={() => {
                                            setSelectedRack(rack);
                                            setSearchedStencil(null);
                                            setSearchNoResult(false);
                                        }}
                                    >
                                        <div className={styles.rackCardHeader}>
                                            <span className={styles.rackName}>{rack.name}</span>
                                            <span className={`${styles.badge} ${rack.status === 'ACTIVE' ? styles.badgeActive : styles.badgeInactive}`}>
                                                {rack.status}
                                            </span>
                                        </div>
                                        <div className={styles.rackCardDetails}>
                                            <span className={styles.rackDimensions}>{rack.rows} × {rack.columns}</span>
                                        </div>
                                        <div className={styles.rackCardActions}>
                                            <button 
                                                type="button"
                                                className={styles.btnIcon} 
                                                title={`Download Excel Report for ${rack.name}`}
                                                disabled={downloadingRackId === rack.id}
                                                onClick={(e) => { 
                                                    e.stopPropagation(); 
                                                    handleDownloadRackExcel(rack); 
                                                }}
                                            >
                                                <FileSpreadsheet size={14} />
                                            </button>
                                            {isSuperAdmin && (
                                                <>
                                                    <button 
                                                        className={styles.btnIcon} 
                                                        title="Edit Rack"
                                                        onClick={(e) => { e.stopPropagation(); handleOpenEditRack(rack); }}
                                                    >
                                                        <Settings size={14} />
                                                    </button>
                                                    <button 
                                                        className={styles.btnIconDanger} 
                                                        title="Delete Rack"
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteRack(rack); }}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Direct Grid Layout Matrix Explorer OR Stencil Details */}
                <div className={styles.detailArea}>
                    {searchedStencil ? (
                        <div>
                            {/* Stencil Details Header */}
                            <div className={styles.searchResultHeader}>
                                <div className={styles.searchResultTitle}>
                                    <h3>
                                        <Info size={20} color="#2563eb" /> 
                                        Stencil Details
                                    </h3>
                                    <p>Read-only stencil specifications and storage location information.</p>
                                </div>
                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                    <button 
                                        type="button" 
                                        className={styles.btnSecondary} 
                                        onClick={handleClearSearch}
                                    >
                                        <ArrowLeft size={16} /> Back to Rack Matrix Grid
                                    </button>
                                </div>
                            </div>

                            {/* Blocked Alert Banner if blocked */}
                            {searchedStencil.is_blocked && (
                                <div className={styles.blockedAlertBanner}>
                                    <AlertCircle size={22} color="#b91c1c" style={{ flexShrink: 0, marginTop: '2px' }} />
                                    <div>
                                        <div className={styles.blockedAlertTitle}>
                                            STENCIL IS CURRENTLY BLOCKED — NOT APPLICABLE FOR USE
                                        </div>
                                        <div className={styles.blockedAlertReason}>
                                            <strong>Reason:</strong> {searchedStencil.blocked_reason || 'No reason specified'}
                                        </div>
                                        <div className={styles.blockedAlertMeta}>
                                            Blocked by: {searchedStencil.blocked_by_name || 'Authorized Supervisor'} {searchedStencil.blocked_at ? `on ${new Date(searchedStencil.blocked_at).toLocaleString()}` : ''}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Read-Only Stencil Details Presentation */}
                            <div className={styles.stencilDetailsCard}>
                                <div className={styles.stencilInfoGrid}>
                                    <div className={styles.infoGroupItem}>
                                        <span className={styles.infoLabel}>Stencil Rack Number</span>
                                        <span className={styles.infoValue}>{searchedStencil.stencil_rack_number || '-'}</span>
                                    </div>
                                    <div className={styles.infoGroupItem}>
                                        <span className={styles.infoLabel}>Job Number</span>
                                        <span className={styles.infoValue}>{searchedStencil.job_number || '-'}</span>
                                    </div>
                                    <div className={styles.infoGroupItem}>
                                        <span className={styles.infoLabel}>Stencil / Model Name</span>
                                        <span className={styles.infoValue}>{searchedStencil.stencil_name || '-'}</span>
                                    </div>
                                    <div className={styles.infoGroupItem}>
                                        <span className={styles.infoLabel}>Revision</span>
                                        <span className={styles.infoValue}>{searchedStencil.revision || '-'}</span>
                                    </div>
                                    <div className={styles.infoGroupItem}>
                                        <span className={styles.infoLabel}>Thickness (mills)</span>
                                        <span className={styles.infoValue}>
                                            {searchedStencil.thickness_mills !== null && searchedStencil.thickness_mills !== undefined 
                                                ? `${searchedStencil.thickness_mills} mils` 
                                                : '-'}
                                        </span>
                                    </div>
                                    <div className={styles.infoGroupItem}>
                                        <span className={styles.infoLabel}>Manufacturing Date</span>
                                        <span className={styles.infoValue}>
                                            {searchedStencil.manufacturing_date 
                                                ? new Date(searchedStencil.manufacturing_date).toLocaleDateString() 
                                                : '-'}
                                        </span>
                                    </div>
                                    <div className={styles.infoGroupItem}>
                                        <span className={styles.infoLabel}>Sides</span>
                                        <span className={styles.infoValue}>{searchedStencil.side || '-'}</span>
                                    </div>
                                    <div className={styles.infoGroupItem}>
                                        <span className={styles.infoLabel}>Current Rack</span>
                                        <span className={styles.infoValue}>{searchedStencil.rack_name || '-'}</span>
                                    </div>
                                    <div className={styles.infoGroupItem}>
                                        <span className={styles.infoLabel}>Current Row</span>
                                        <span className={styles.infoValue}>
                                            {searchedStencil.row_number !== null && searchedStencil.row_number !== undefined 
                                                ? searchedStencil.row_number 
                                                : '-'}
                                        </span>
                                    </div>
                                    <div className={styles.infoGroupItem}>
                                        <span className={styles.infoLabel}>Current Column</span>
                                        <span className={styles.infoValue}>
                                            {searchedStencil.column_number !== null && searchedStencil.column_number !== undefined 
                                                ? searchedStencil.column_number 
                                                : '-'}
                                        </span>
                                    </div>
                                    <div className={styles.infoGroupItem}>
                                        <span className={styles.infoLabel}>Location Code</span>
                                        <span className={styles.infoValue}>{searchedStencil.location_code || '-'}</span>
                                    </div>
                                    <div className={styles.infoGroupItem}>
                                        <span className={styles.infoLabel}>Current Status</span>
                                        <span className={`${styles.statusBadge} ${
                                            searchedStencil.location_status === 'STORED' ? styles.statusStored : 
                                            searchedStencil.location_status === 'CHECKED_OUT' ? styles.statusCheckedOut : 
                                            styles.statusEmpty
                                        }`}>
                                            {searchedStencil.location_status}
                                        </span>
                                    </div>
                                    <div className={styles.infoGroupItem}>
                                        <span className={styles.infoLabel}>Blocking Status</span>
                                        <span className={styles.infoValue}>
                                            {searchedStencil.is_blocked ? (
                                                <span className={styles.statusBlockedBadge} title={searchedStencil.blocked_reason || 'Blocked'}>
                                                    BLOCKED
                                                </span>
                                            ) : (
                                                <span className={styles.statusActiveBadge}>
                                                    UNBLOCKED
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                    <div className={styles.infoGroupItem}>
                                        <span className={styles.infoLabel}>Current Holder</span>
                                        <span className={styles.infoValue}>
                                            {searchedStencil.holder?.employee_name 
                                                ? `${searchedStencil.holder.employee_name} (${searchedStencil.holder.employee_code || '-'})` 
                                                : (searchedStencil.location_status === 'CHECKED_OUT' ? 'Checked Out' : 'None (In Storage)')}
                                        </span>
                                    </div>
                                    <div className={styles.infoGroupItem}>
                                        <span className={styles.infoLabel}>Received Date</span>
                                        <span className={styles.infoValue}>
                                            {searchedStencil.holder?.received_at 
                                                ? new Date(searchedStencil.holder.received_at).toLocaleDateString() 
                                                : '-'}
                                        </span>
                                    </div>
                                    <div className={styles.infoGroupItem}>
                                        <span className={styles.infoLabel}>Received Time</span>
                                        <span className={styles.infoValue}>
                                            {searchedStencil.holder?.received_at 
                                                ? new Date(searchedStencil.holder.received_at).toLocaleTimeString() 
                                                : '-'}
                                        </span>
                                    </div>
                                    <div className={styles.infoGroupItem}>
                                        <span className={styles.infoLabel}>Elapsed Time</span>
                                        <span className={styles.infoValue}>
                                            {searchedStencil.holder?.elapsed_time || '-'}
                                        </span>
                                    </div>
                                    <div className={`${styles.infoGroupItem} ${styles.infoGroupItemFull}`}>
                                        <span className={styles.infoLabel}>Remarks</span>
                                        <span className={styles.infoValue}>{searchedStencil.remarks || 'No remarks.'}</span>
                                    </div>
                                </div>

                                {/* Holder / Checkout Details if active */}
                                {searchedStencil.location_status === 'CHECKED_OUT' && searchedStencil.holder && (
                                    <div className={styles.holderDetailsCard}>
                                        <div className={styles.holderHeader}>
                                            <AlertCircle size={18} />
                                            <span>Active Checkout & Production Assignment Details</span>
                                        </div>
                                        <div className={styles.holderGrid}>
                                            <div className={styles.infoGroupItem}>
                                                <span className={styles.infoLabel}>Holder Name</span>
                                                <span className={styles.infoValue}>{searchedStencil.holder.employee_name} ({searchedStencil.holder.employee_code})</span>
                                            </div>
                                            <div className={styles.infoGroupItem}>
                                                <span className={styles.infoLabel}>Department / Role</span>
                                                <span className={styles.infoValue}>{searchedStencil.holder.department || '-'} / {searchedStencil.holder.role || '-'}</span>
                                            </div>
                                            <div className={styles.infoGroupItem}>
                                                <span className={styles.infoLabel}>Work Order</span>
                                                <span className={styles.infoValue}>{searchedStencil.holder.work_order_number || searchedStencil.holder.work_order_id || '-'}</span>
                                            </div>
                                            <div className={styles.infoGroupItem}>
                                                <span className={styles.infoLabel}>Side</span>
                                                <span className={styles.infoValue}>{searchedStencil.holder.work_order_side || '-'}</span>
                                            </div>
                                            <div className={styles.infoGroupItem}>
                                                <span className={styles.infoLabel}>Machine / Line</span>
                                                <span className={styles.infoValue}>{searchedStencil.holder.machine || '-'} / {searchedStencil.holder.production_line || '-'}</span>
                                            </div>
                                            <div className={styles.infoGroupItem}>
                                                <span className={styles.infoLabel}>Checkout Remarks</span>
                                                <span className={styles.infoValue}>{searchedStencil.holder.remarks || '-'}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : searchNoResult ? (
                        <div className={styles.noResultContainer}>
                            <AlertCircle size={48} strokeWidth={1.5} color="#ef4444" />
                            <h3 className={styles.noResultTitle}>No Matching Record Found</h3>
                            <p className={styles.noResultText}>
                                No stencil record found matching: "<strong>{lastSearchedQuery}</strong>". Please verify the Stencil Rack Number, Job Number, or Stencil / Model Name and try again.
                            </p>
                            <button 
                                type="button" 
                                className={styles.btnSecondary} 
                                onClick={handleClearSearch}
                            >
                                Clear Search
                            </button>
                        </div>
                    ) : !selectedRack ? (
                        <div className={styles.emptyState}>
                            <AlertCircle size={48} strokeWidth={1.5} />
                            <h3>Select a Stencil Rack</h3>
                            <p>Choose a rack from the selector above to display the storage matrix grid and assign/edit stencils.</p>
                        </div>
                    ) : (
                        <div>
                            {/* Selected Rack Meta Info */}
                            <div className={styles.detailHeader}>
                                <div className={styles.detailHeaderTitle}>
                                    <h3>Storage Matrix Explorer</h3>
                                    <p>Manage physical storage assignments by row and column coordinates.</p>
                                </div>
                            </div>

                            {/* Information Card */}
                            <div className={styles.rackInfoCard}>
                                <div className={styles.infoGroupItem}>
                                    <span className={styles.infoLabel}>Rack Name</span>
                                    <span className={styles.infoValue}>{selectedRack.name}</span>
                                </div>
                                <div className={styles.infoGroupItem}>
                                    <span className={styles.infoLabel}>Status</span>
                                    <span className={`${styles.infoValue} ${selectedRack.status === 'ACTIVE' ? styles.statusTextActive : styles.statusTextInactive}`}>
                                        {selectedRack.status}
                                    </span>
                                </div>
                                <div className={styles.infoGroupItem}>
                                    <span className={styles.infoLabel}>Rows</span>
                                    <span className={styles.infoValue}>{selectedRack.rows}</span>
                                </div>
                                <div className={styles.infoGroupItem}>
                                    <span className={styles.infoLabel}>Columns</span>
                                    <span className={styles.infoValue}>{selectedRack.columns}</span>
                                </div>
                                <div className={styles.infoGroupItem}>
                                    <span className={styles.infoLabel}>Total Locations</span>
                                    <span className={styles.infoValue}>{selectedRack.rows * selectedRack.columns}</span>
                                </div>
                                <div className={styles.infoGroupItem}>
                                    <span className={styles.infoLabel}>Occupied Locations</span>
                                    <span className={styles.badgeCountGreen}>
                                        {locations.filter(l => l.status === 'STORED').length}
                                    </span>
                                </div>
                                <div className={styles.infoGroupItem}>
                                    <span className={styles.infoLabel}>Empty Locations</span>
                                    <span className={styles.badgeCountGray}>
                                        {locations.filter(l => l.status === 'EMPTY').length}
                                    </span>
                                </div>
                                <div className={styles.infoGroupItem}>
                                    <span className={styles.infoLabel}>Checked Out</span>
                                    <span className={styles.badgeCountOrange}>
                                        {locations.filter(l => l.status === 'CHECKED_OUT').length}
                                    </span>
                                </div>
                                <div className={`${styles.infoGroupItem} ${styles.infoGroupItemFull}`}>
                                    <span className={styles.infoLabel}>Description</span>
                                    <span className={styles.infoValue}>{selectedRack.description || 'No description provided.'}</span>
                                </div>
                            </div>

                            {selectedRack.status === 'INACTIVE' && (
                                <div className={styles.inactiveWarning}>
                                    <AlertCircle size={18} />
                                    <span>Warning: This rack is currently <strong>INACTIVE</strong>. Stencil Assignment, Return, Receive, and Relocation operations are blocked.</span>
                                </div>
                            )}

                            {/* Coordinate Table Matrix */}
                            <div className={styles.tableWrapper}>
                                <table className={styles.matrixTable}>
                                    <thead>
                                        <tr>
                                            <th className={styles.cornerHeader}></th>
                                            {Array.from({ length: selectedRack.columns }, (_, i) => (
                                                <th key={i}>C{i + 1}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Array.from({ length: selectedRack.rows }, (_, rIndex) => {
                                            const rowNum = rIndex + 1;
                                            return (
                                                <tr key={rIndex}>
                                                    <td className={styles.rowHeader}>R{rowNum}</td>
                                                    {Array.from({ length: selectedRack.columns }, (_, cIndex) => {
                                                        const colNum = cIndex + 1;
                                                        const loc = locations.find(
                                                            l => l.row_number === rowNum && l.column_number === colNum
                                                        );

                                                        if (!loc) {
                                                            return <td key={cIndex} className={styles.emptyCell}></td>;
                                                        }
                                                        let cellClass = styles.matrixCellEmpty;
                                                        if (loc.is_blocked) cellClass = styles.matrixCellBlocked;
                                                        else if (loc.status === 'STORED') cellClass = styles.matrixCellStored;
                                                        else if (loc.status === 'CHECKED_OUT') cellClass = styles.matrixCellCheckedOut;

                                                        return (
                                                            <td 
                                                                key={cIndex} 
                                                                className={`${styles.matrixCell} ${cellClass}`}
                                                            >
                                                                {loc.status !== 'EMPTY' ? (
                                                                    <div 
                                                                        className={styles.cellCardOccupied}
                                                                        onClick={() => {
                                                                            if (canEditLocations) {
                                                                                if (selectedRack.status === 'INACTIVE') {
                                                                                    showToast('This rack is INACTIVE. Grid edits are locked.', 'error');
                                                                                    return;
                                                                                }
                                                                                handleCellClick(loc);
                                                                            }
                                                                        }}
                                                                    >
                                                                        {/* Top Row: Stencil Number (Left Upper) & Edit Action (Right Upper) */}
                                                                        <div className={styles.cellCardTopRow}>
                                                                            <span 
                                                                                className={styles.cellRackNumber} 
                                                                                title={`Stencil Number: ${loc.stencil_rack_number || '-'}`}
                                                                            >
                                                                                {loc.stencil_rack_number || '-'}
                                                                            </span>
                                                                            {canEditLocations && (
                                                                                <button 
                                                                                    type="button" 
                                                                                    className={styles.cellEditBtn} 
                                                                                    title="Edit Stencil Location"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        if (selectedRack.status === 'INACTIVE') {
                                                                                            showToast('This rack is INACTIVE. Grid edits are locked.', 'error');
                                                                                            return;
                                                                                        }
                                                                                        handleCellClick(loc);
                                                                                    }}
                                                                                >
                                                                                    <Edit2 size={12} /> Edit
                                                                                </button>
                                                                            )}
                                                                        </div>

                                                                        {/* Middle Body: Job Number & Stencil Name */}
                                                                        <div className={styles.cellCardBody}>
                                                                            <div 
                                                                                className={styles.cellJobNumber} 
                                                                                title={`Job Number: ${loc.job_number || '-'}`}
                                                                            >
                                                                                {loc.job_number || '-'}
                                                                            </div>
                                                                            {loc.stencil_name && (
                                                                                <div 
                                                                                    className={styles.cellStencilName} 
                                                                                    title={`Stencil Name: ${loc.stencil_name}`}
                                                                                >
                                                                                    {loc.stencil_name}
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        {/* Bottom Row: Status Badge & Blocked Indicator */}
                                                                        <div className={styles.cellStatusBadgeWrapper} style={{ gap: '0.35rem', flexWrap: 'wrap' }}>
                                                                            <span className={`${styles.statusBadge} ${loc.status === 'STORED' ? styles.statusStored : styles.statusCheckedOut}`}>
                                                                                {loc.status}
                                                                            </span>
                                                                            {loc.is_blocked && (
                                                                                <span 
                                                                                    className={styles.statusBlockedBadge}
                                                                                    title={`BLOCKED: ${loc.blocked_reason || 'No reason specified'}`}
                                                                                >
                                                                                    BLOCKED
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div 
                                                                        className={styles.cellCardEmpty}
                                                                        onClick={() => {
                                                                            if (canEditLocations) {
                                                                                if (selectedRack.status === 'INACTIVE') {
                                                                                    showToast('This rack is INACTIVE. Grid edits are locked.', 'error');
                                                                                    return;
                                                                                }
                                                                                handleCellClick(loc);
                                                                            }
                                                                        }}
                                                                    >
                                                                        {/* Top Row: Location Code (Left Upper) & Edit Button (Right Upper) */}
                                                                        <div className={styles.cellCardTopRow}>
                                                                            <span 
                                                                                className={styles.cellEmptyCoordinate} 
                                                                                title={`Location: ${loc.location_code}`}
                                                                            >
                                                                                {loc.location_code}
                                                                            </span>
                                                                            {canEditLocations && (
                                                                                <button 
                                                                                    type="button" 
                                                                                    className={styles.cellEditBtn}
                                                                                    title="Assign Stencil Location"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        if (selectedRack.status === 'INACTIVE') {
                                                                                            showToast('This rack is INACTIVE. Grid edits are locked.', 'error');
                                                                                            return;
                                                                                        }
                                                                                        handleCellClick(loc);
                                                                                    }}
                                                                                >
                                                                                    <Edit2 size={12} /> Edit
                                                                                </button>
                                                                            )}
                                                                        </div>

                                                                        <div className={styles.cellCardBody}>
                                                                            <div className={styles.cellEmptyLabel}>Empty Location</div>
                                                                        </div>

                                                                        <div className={styles.cellStatusBadgeWrapper}>
                                                                            <span className={`${styles.statusBadge} ${styles.statusEmpty}`}>
                                                                                EMPTY
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                        </div>
                    )}
                </div>

            </div>

            {/* RACK EDIT/CREATE CONFIG MODAL */}
            {showRackModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalHeader}>
                            <h3>{editRackData ? 'Edit Rack Configuration' : 'Create Stencil Rack'}</h3>
                            <button className={styles.btnClose} onClick={() => setShowRackModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <form className={styles.form} onSubmit={handleSaveRack}>
                            <div className={styles.formGroup}>
                                <label>Rack Name <span>*</span></label>
                                <input 
                                    type="text" 
                                    className={styles.input} 
                                    required 
                                    value={rackName} 
                                    onChange={e => setRackName(e.target.value)} 
                                    placeholder="e.g. Rack A"
                                />
                            </div>
                            <div className={styles.formGrid}>
                                <div className={styles.formGroup}>
                                    <label>Rows Count <span>*</span></label>
                                    <input 
                                        type="number" 
                                        className={styles.input} 
                                        required 
                                        min={1} 
                                        value={rackRows} 
                                        onChange={e => setRackRows(parseInt(e.target.value))} 
                                        disabled={!!editRackData && (editRackData.occupied || 0) > 0}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Columns Count <span>*</span></label>
                                    <input 
                                        type="number" 
                                        className={styles.input} 
                                        required 
                                        min={1} 
                                        value={rackColumns} 
                                        onChange={e => setRackColumns(parseInt(e.target.value))} 
                                        disabled={!!editRackData && (editRackData.occupied || 0) > 0}
                                    />
                                </div>
                            </div>
                            <div className={styles.formGroup}>
                                <label>Description</label>
                                <textarea 
                                    className={styles.textarea} 
                                    rows={3} 
                                    value={rackDesc} 
                                    onChange={e => setRackDesc(e.target.value)} 
                                    placeholder="Description or notes..."
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Status</label>
                                <select 
                                    className={styles.select} 
                                    value={rackStatus} 
                                    onChange={e => setRackStatus(e.target.value as any)}
                                >
                                    <option value="ACTIVE">ACTIVE</option>
                                    <option value="INACTIVE">INACTIVE</option>
                                </select>
                            </div>
                            <div className={styles.modalActions}>
                                <button type="button" className={styles.btnSecondary} onClick={() => setShowRackModal(false)}>Cancel</button>
                                <button type="submit" className={styles.btnPrimary}>Save Configuration</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* STENCIL EDIT / ASSIGN DIALOG */}
            {showEditLocationModal && selectedLocation && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalHeader}>
                            <h3>Slot Assignment: {selectedLocation.location_code}</h3>
                            <button className={styles.btnClose} onClick={() => setShowEditLocationModal(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        {selectedLocation.is_blocked && (
                            <div className={styles.blockedAlertBanner}>
                                <AlertCircle size={20} color="#b91c1c" style={{ flexShrink: 0, marginTop: '2px' }} />
                                <div>
                                    <div className={styles.blockedAlertTitle}>
                                        STENCIL IS CURRENTLY BLOCKED — NOT APPLICABLE FOR USE
                                    </div>
                                    <div className={styles.blockedAlertReason}>
                                        <strong>Reason:</strong> {selectedLocation.blocked_reason || 'No reason specified'}
                                    </div>
                                    <div className={styles.blockedAlertMeta}>
                                        Blocked by: {selectedLocation.blocked_by_name || 'Authorized Supervisor'} {selectedLocation.blocked_at ? `on ${new Date(selectedLocation.blocked_at).toLocaleString()}` : ''}
                                    </div>
                                </div>
                            </div>
                        )}

                        {selectedLocation.status === 'CHECKED_OUT' && (
                            <div className={styles.notApplicableBanner}>
                                <Info size={16} />
                                <span>Blocking is not applicable: this stencil is already checked out. Return it to the rack before blocking.</span>
                            </div>
                        )}

                        {selectedLocation.status === 'CHECKED_OUT' && (
                            <div className={styles.checkoutAlert}>
                                <Info size={16} />
                                <span>Checked Out: Stencil details are read-only. Holder: {selectedLocation.checked_out_by_name} ({selectedLocation.checked_out_by_code})</span>
                            </div>
                        )}

                        <form className={styles.form} onSubmit={handleSaveLocation}>
                            <div className={styles.formGroup}>
                                <label>Stencil Rack Number <span>*</span></label>
                                <input 
                                    type="text" 
                                    className={styles.input} 
                                    required 
                                    disabled={selectedLocation.status === 'CHECKED_OUT'}
                                    value={stencilRackNumber} 
                                    onChange={e => setStencilRackNumber(e.target.value)} 
                                    placeholder="Enter unique Stencil Rack Number"
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Job Number <span>*</span></label>
                                <input 
                                    type="text" 
                                    className={styles.input} 
                                    required 
                                    disabled={selectedLocation.status === 'CHECKED_OUT'}
                                    value={stencilJobNumber} 
                                    onChange={e => setStencilJobNumber(e.target.value)} 
                                    placeholder="Enter unique stencil Job Number"
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Stencil / Model Name</label>
                                <input 
                                    type="text" 
                                    className={styles.input} 
                                    disabled={selectedLocation.status === 'CHECKED_OUT'}
                                    value={stencilName} 
                                    onChange={e => setStencilName(e.target.value)} 
                                    placeholder="Enter model name"
                                />
                            </div>
                            <div className={styles.formGrid}>
                                <div className={styles.formGroup}>
                                    <label>Revision</label>
                                    <input 
                                        type="text" 
                                        className={styles.input} 
                                        disabled={selectedLocation.status === 'CHECKED_OUT'}
                                        value={stencilRevision} 
                                        onChange={e => setStencilRevision(e.target.value)} 
                                        placeholder="e.g. 02"
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Thickness</label>
                                    <input 
                                        type="number" 
                                        step="0.01"
                                        className={styles.input} 
                                        disabled={selectedLocation.status === 'CHECKED_OUT'}
                                        value={stencilThickness} 
                                        onChange={e => setStencilThickness(e.target.value)} 
                                        placeholder="e.g. 4.5"
                                    />
                                </div>
                            </div>
                            <div className={styles.formGrid}>
                                <div className={styles.formGroup}>
                                    <label>Manufacturing Date</label>
                                    <input 
                                        type="date" 
                                        className={styles.input} 
                                        disabled={selectedLocation.status === 'CHECKED_OUT'}
                                        value={stencilMfgDate} 
                                        onChange={e => setStencilMfgDate(e.target.value)} 
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Sides</label>
                                    <select 
                                        className={styles.select} 
                                        disabled={selectedLocation.status === 'CHECKED_OUT'}
                                        value={stencilSide} 
                                        onChange={e => setStencilSide(e.target.value as any)}
                                    >
                                        <option value="">-- Select Side --</option>
                                        <option value="TOP">TOP</option>
                                        <option value="BOTTOM">BOTTOM</option>
                                        <option value="TOP/BOTTOM">TOP/BOTTOM</option>
                                    </select>
                                </div>
                            </div>
                            <div className={styles.formGroup}>
                                <label>Remarks</label>
                                <textarea 
                                    className={styles.textarea} 
                                    rows={2} 
                                    disabled={selectedLocation.status === 'CHECKED_OUT'}
                                    value={stencilRemarks} 
                                    onChange={e => setStencilRemarks(e.target.value)} 
                                    placeholder="Remarks or notes..."
                                />
                            </div>

                            <div className={styles.modalActions}>
                                {selectedLocation.status !== 'EMPTY' && selectedLocation.status !== 'CHECKED_OUT' && (
                                    <button 
                                        type="button" 
                                        className={styles.btnDanger} 
                                        style={{ marginRight: 'auto' }}
                                        onClick={handleClearLocation}
                                    >
                                        Clear Slot
                                    </button>
                                )}
                                <button type="button" className={styles.btnSecondary} onClick={() => setShowEditLocationModal(false)}>
                                    Cancel
                                </button>
                                {canEditLocations && selectedLocation.status === 'STORED' && (
                                    selectedLocation.is_blocked ? (
                                        <button 
                                            type="button" 
                                            className={styles.cellUnblockBtn} 
                                            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                                            onClick={() => handleToggleBlock(selectedLocation)}
                                        >
                                            Unblock Stencil
                                        </button>
                                    ) : (
                                        <button 
                                            type="button" 
                                            className={styles.cellBlockBtn} 
                                            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                                            onClick={() => handleToggleBlock(selectedLocation)}
                                        >
                                            Block Stencil
                                        </button>
                                    )
                                )}
                                {selectedLocation.status !== 'CHECKED_OUT' && (
                                    <button type="submit" className={styles.btnPrimary}>
                                        Save Details
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StencilRackManagement;
