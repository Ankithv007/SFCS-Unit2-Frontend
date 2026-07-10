import React, { useState, useEffect, useRef } from 'react';
import styles from './StencilLifecycleManagement.module.css';
import { WorkOrderSelector } from '../../components/WorkOrderSelector';
import { useSmtAuth } from '../../context/SmtAuthContext';
import { useToast } from '../../components/Toast';
import { apiFetch } from '../../utils/api';

interface Stencil {
    id: string;
    stencil_name: string;
    job_number: string;
    revision: string;
    thickness_mills: string;
    manufacturing_date: string;
    side: string;
    storage_location: string | null;
    status: string;
    remarks: string | null;
    print_count: number;
    target_life_cycle: number;
}

interface WorkOrder {
    id: string;
    po_id: string;
    product_name: string;
    product_description: string;
    sides: string;
    quantity: number;
    panel_quantity: number;
    priority: string;
    line_id: string;
    created_by: string;
    created_at: string;
    remark: string | null;
}

interface LifecycleRecord {
    id: string;
    stencil_record_id: string;
    stencil_name: string;
    work_order_id: string;
    work_order_number: string;
    product_name: string;
    product_description: string | null;
    sides: string;
    quantity: number;
    target_life_cycle: number;
    qty_life_cycle: number;
    balance_life_cycle: number;
    current_used_life_cycle: number;
    status: 'Available' | 'Running' | 'Completed' | 'Expired';
    remarks: string | null;
    created_by_name: string;
    created_at: string;
    updated_by_name?: string | null;
    updated_at?: string | null;
    deleted_by_name?: string | null;
    deleted_at?: string | null;
}

interface DetailModalData {
    record: LifecycleRecord;
    stencil: Stencil | null;
    workOrder: WorkOrder | null;
}

const StencilLifecycleManagement: React.FC = () => {
    const { smtUser, smtLogout } = useSmtAuth();
    const { showToast } = useToast();

    // Data lists from backend
    const [stencils, setStencils] = useState<Stencil[]>([]);
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
    const [records, setRecords] = useState<LifecycleRecord[]>([]);

    // Selection states
    const [selectedStencil, setSelectedStencil] = useState<Stencil | null>(null);
    const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
    const [remarks, setRemarks] = useState('');

    // Searchable Dropdowns search inputs
    const [stencilSearch, setStencilSearch] = useState('');
    const [stencilDropdownOpen, setStencilDropdownOpen] = useState(false);
    // Dropdown references for clicking outside
    const stencilRef = useRef<HTMLDivElement>(null);

    // Table state
    const [searchText, setSearchText] = useState('');
    const [sortBy, setSortBy] = useState('created_at');
    const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const [limit] = useState(10);
    const [loadingTable, setLoadingTable] = useState(false);

    // Modals
    const [viewDetailData, setViewDetailData] = useState<DetailModalData | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const isSuperAdmin = smtUser?.role === 'Super Admin';

    const lastWarnedRef = useRef<{ stencilId: string; level: number } | null>(null);

    const getWarningDetails = (remaining: number) => {
        if (remaining <= 1000) {
            return {
                level: 3,
                icon: '🚨',
                title: 'Final Warning',
                message: 'This stencil is very close to reaching its maximum life cycle.',
                suggestion: 'Replace this stencil as soon as possible.',
                toastType: 'error' as const,
                bannerColor: 'red'
            };
        } else if (remaining <= 2500) {
            return {
                level: 2,
                icon: '⚠️',
                title: 'Critical Warning',
                message: 'This stencil has very few prints remaining.',
                suggestion: 'Please schedule a stencil replacement.',
                toastType: 'info' as const,
                bannerColor: 'orange'
            };
        } else if (remaining <= 5000) {
            return {
                level: 1,
                icon: '⚠️',
                title: 'Warning',
                message: 'This stencil is approaching its maximum life cycle.',
                suggestion: 'Please prepare a replacement stencil soon.',
                toastType: 'info' as const,
                bannerColor: 'yellow'
            };
        }
        return null;
    };

    const getWarningLevel = (remaining: number) => {
        if (remaining <= 1000) return 3;
        if (remaining <= 2500) return 2;
        if (remaining <= 5000) return 1;
        return 0;
    };

    // Auto-refresh selectedStencil when stencils list changes (e.g. after create, delete, reload)
    useEffect(() => {
        if (selectedStencil && stencils.length > 0) {
            const updated = stencils.find(s => s.id === selectedStencil.id);
            if (updated) {
                if (updated.print_count !== selectedStencil.print_count || updated.status !== selectedStencil.status) {
                    setSelectedStencil(updated);
                }
            } else {
                setSelectedStencil(null);
            }
        }
    }, [stencils, selectedStencil]);

    // Evaluate selectedStencil warning toasts to prevent duplicates during re-renders
    useEffect(() => {
        if (selectedStencil) {
            const remaining = selectedStencil.target_life_cycle - selectedStencil.print_count;
            const level = getWarningLevel(remaining);
            const lastWarned = lastWarnedRef.current;

            const isNewStencil = !lastWarned || lastWarned.stencilId !== selectedStencil.id;
            const isNewLevel = !lastWarned || lastWarned.level !== level;

            if (level > 0 && (isNewStencil || isNewLevel)) {
                lastWarnedRef.current = { stencilId: selectedStencil.id, level };
                const warning = getWarningDetails(remaining);
                if (warning) {
                    const formattedRemaining = remaining.toLocaleString();
                    const toastMsg = `${warning.title}\n\nRemaining Prints: ${formattedRemaining}\n\n${warning.message}\n\n${warning.suggestion}`;
                    showToast(toastMsg, warning.toastType);
                }
            } else if (isNewStencil || isNewLevel) {
                lastWarnedRef.current = { stencilId: selectedStencil.id, level };
            }
        } else {
            lastWarnedRef.current = null;
        }
    }, [selectedStencil, showToast]);
    useEffect(() => {
        fetchActiveStencils();
        fetchWorkOrders();
        fetchRecords();
    }, [currentPage, sortBy, sortOrder]);

    // Handle clicks outside dropdowns to close them
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (stencilRef.current && !stencilRef.current.contains(event.target as Node)) {
                setStencilDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchActiveStencils = async () => {
        try {
            const data = await apiFetch('/api/smt/stencil-lifecycle/stencils');
            setStencils(data);
        } catch (err: any) {
            console.error('Failed to fetch stencils:', err);
            showToast('Failed to load active stencils.', 'error');
        }
    };

    const fetchWorkOrders = async () => {
        try {
            const data = await apiFetch('/api/smt/stencil-lifecycle/work-orders');
            setWorkOrders(data);
        } catch (err: any) {
            console.error('Failed to fetch work orders:', err);
            showToast('Failed to load work orders.', 'error');
        }
    };

    const fetchRecords = async () => {
        setLoadingTable(true);
        try {
            const queryParams = new URLSearchParams({
                page: String(currentPage),
                limit: String(limit),
                search: searchText.trim(),
                sortBy,
                sortOrder
            });
            const res = await apiFetch(`/api/smt/stencil-lifecycle/records?${queryParams.toString()}`);
            setRecords(res.data);
            setTotalPages(res.pagination.pages);
            setTotalRecords(res.pagination.total);
        } catch (err: any) {
            console.error('Failed to fetch lifecycle records:', err);
            showToast('Failed to load lifecycle records.', 'error');
        } finally {
            setLoadingTable(false);
        }
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setCurrentPage(1);
        fetchRecords();
    };

    // Sorting bubbles matching values to the top
    const getFilteredStencils = () => {
        const q = stencilSearch.trim().toLowerCase();
        if (!q) return stencils;
        return [...stencils]
            .filter(s => s.stencil_name.toLowerCase().includes(q))
            .sort((a, b) => {
                const aNameMatch = a.stencil_name.toLowerCase().startsWith(q);
                const bNameMatch = b.stencil_name.toLowerCase().startsWith(q);
                if (aNameMatch && !bNameMatch) return -1;
                if (!aNameMatch && bNameMatch) return 1;
                return 0;
            });
    };



    const handleCreateLifecycle = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStencil || !selectedWorkOrder) {
            showToast('Please select both a Stencil and a Work Order.', 'error');
            return;
        }

        setSubmitting(true);
        try {
            const res = await apiFetch('/api/smt/stencil-lifecycle/create', {
                method: 'POST',
                body: JSON.stringify({
                    stencil_record_id: selectedStencil.id,
                    work_order_id: selectedWorkOrder.id,
                    remarks: remarks || null
                })
            });

            // Reset selection inputs
            setSelectedStencil(null);
            setSelectedWorkOrder(null);
            setStencilSearch('');
            setRemarks('');

            // Reload data before triggering toast so that the tables and states update first
            fetchActiveStencils();
            fetchWorkOrders();
            fetchRecords();

            const remaining = res.record?.balance_life_cycle;
            if (remaining !== undefined && remaining !== null) {
                const warning = getWarningDetails(remaining);
                if (warning) {
                    const formattedRemaining = remaining.toLocaleString();
                    const toastMsg = `${warning.title}\n\nRemaining Prints: ${formattedRemaining}\n\n${warning.message}\n\n${warning.suggestion}`;
                    showToast(toastMsg, warning.toastType);
                } else {
                    showToast('Stencil Lifecycle Record Created Successfully.', 'success');
                }
            } else {
                showToast('Stencil Lifecycle Record Created Successfully.', 'success');
            }
        } catch (err: any) {
            console.error('Lifecycle creation error:', err);
            showToast(err.message || 'Failed to create record.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleViewDetails = async (id: string) => {
        try {
            const data = await apiFetch(`/api/smt/stencil-lifecycle/records/${id}`);
            setViewDetailData(data);
        } catch (err: any) {
            console.error('Failed to fetch details:', err);
            showToast('Failed to retrieve lifecycle record details.', 'error');
        }
    };

    const handleDeleteRecord = async () => {
        if (!confirmDeleteId) return;
        if (!isSuperAdmin) {
            showToast("Only Super Admin is authorized to delete records.\nPlease contact your Super Admin if this record needs to be deleted.", "error");
            setConfirmDeleteId(null);
            return;
        }

        try {
            await apiFetch(`/api/smt/stencil-lifecycle/records/${confirmDeleteId}`, {
                method: 'DELETE'
            });

            showToast('Lifecycle record deleted and stencil print count updated successfully.', 'success');
            setConfirmDeleteId(null);

            // Reload all
            fetchActiveStencils();
            fetchRecords();
        } catch (err: any) {
            console.error('Failed to delete record:', err);
            showToast(err.message || 'Failed to delete lifecycle record.', 'error');
        }
    };

    const handleSort = (col: string) => {
        if (sortBy === col) {
            setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
        } else {
            setSortBy(col);
            setSortOrder('ASC');
        }
        setCurrentPage(1);
    };


    return (
        <div className={styles.container}>
            {/* Header row */}
            <div className={styles.headerRow}>
                <div className={styles.headerContent}>
                    <h2> Stencil Life Cycle Management</h2>
                    <p>Track stencil print limit consumption and assign work orders safely.</p>
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

            {/* Creation Card */}
            <div className={styles.card}>
                <h3>Assign Work Order to Stencil</h3>
                <form onSubmit={handleCreateLifecycle}>
                    <div className={styles.creationLayout}>
                        {/* Stencil Search & Preview */}
                        <div className={styles.formGrid}>
                            <div className={styles.inputGroup} ref={stencilRef}>
                                <label>Stencil / Model Name <span>*</span></label>
                                <div className={styles.dropdownWrapper}>
                                    <div className={styles.dropdownInputWrapper}>
                                        <input
                                            type="text"
                                            className={styles.input}
                                            placeholder="Select Stencil / Model Name"
                                            value={selectedStencil ? selectedStencil.stencil_name : stencilSearch}
                                            onChange={(e) => {
                                                setStencilSearch(e.target.value);
                                                setSelectedStencil(null);
                                                setStencilDropdownOpen(true);
                                            }}
                                            onFocus={() => setStencilDropdownOpen(true)}
                                        />
                                        <span className={styles.dropdownArrow}>▼</span>
                                    </div>
                                    {stencilDropdownOpen && (
                                        <ul className={styles.dropdownList}>
                                            {getFilteredStencils().length === 0 ? (
                                                <li className={styles.noOptions}>No active stencils found</li>
                                            ) : (
                                                getFilteredStencils().map((s) => (
                                                    <li
                                                        key={s.id}
                                                        className={styles.dropdownOption}
                                                        onClick={() => {
                                                            setSelectedStencil(s);
                                                            setStencilSearch(s.stencil_name);
                                                            setStencilDropdownOpen(false);
                                                        }}
                                                    >
                                                        <span className={styles.dropdownOptionMain}>{s.stencil_name}</span>
                                                        <span className={styles.dropdownOptionSub}>
                                                            Rev: {s.revision} | Prints: {s.print_count}
                                                        </span>
                                                    </li>
                                                ))
                                            )}
                                        </ul>
                                    )}
                                </div>
                            </div>

                            {/* Stencil details display */}
                            <div className={styles.detailsSection}>
                                <h4>Selected Stencil Details</h4>
                                {selectedStencil ? (
                                    <div className={styles.detailsGrid}>
                                        <div className={styles.detailField}>
                                            <span className={styles.detailLabel}>Stencil / Model Name</span>
                                            <span className={styles.detailValue}>{selectedStencil.stencil_name}</span>
                                        </div>
                                        <div className={styles.detailField}>
                                            <span className={styles.detailLabel}>Revision</span>
                                            <span className={styles.detailValue}>{selectedStencil.revision}</span>
                                        </div>
                                        <div className={styles.detailField}>
                                            <span className={styles.detailLabel}>Thickness</span>
                                            <span className={styles.detailValue}>{selectedStencil.thickness_mills} mills</span>
                                        </div>
                                        <div className={styles.detailField}>
                                            <span className={styles.detailLabel}>Manufacturing Date</span>
                                            <span className={styles.detailValue}>{selectedStencil.manufacturing_date ? new Date(selectedStencil.manufacturing_date).toLocaleDateString() : '-'}</span>
                                        </div>
                                        <div className={styles.detailField}>
                                            <span className={styles.detailLabel}>Sides</span>
                                            <span className={styles.detailValue}>{selectedStencil.side || '-'}</span>
                                        </div>
                                        <div className={styles.detailField}>
                                            <span className={styles.detailLabel}>Remark</span>
                                            <span className={styles.detailValue}>{selectedStencil.remarks || '-'}</span>
                                        </div>

                                        <hr className={styles.divider} />

                                        <div className={styles.detailField}>
                                            <span className={styles.detailLabel}>Target Life Cycle</span>
                                            <span className={styles.detailValue}>{selectedStencil.target_life_cycle}</span>
                                        </div>
                                        <div className={styles.detailField}>
                                            <span className={styles.detailLabel}>Current Used Prints</span>
                                            <span className={styles.detailValue}>{selectedStencil.print_count}</span>
                                        </div>
                                        <div className={styles.detailField}>
                                            <span className={styles.detailLabel}>Remaining Prints</span>
                                            <span className={styles.detailValue}>{selectedStencil.target_life_cycle - selectedStencil.print_count}</span>
                                        </div>

                                        {(() => {
                                            const remaining = selectedStencil.target_life_cycle - selectedStencil.print_count;
                                            const warning = getWarningDetails(remaining);
                                            if (!warning) return null;

                                            let bannerClass = '';
                                            if (warning.bannerColor === 'red') bannerClass = styles.warningRed;
                                            else if (warning.bannerColor === 'orange') bannerClass = styles.warningOrange;
                                            else if (warning.bannerColor === 'yellow') bannerClass = styles.warningYellow;

                                            return (
                                                <div className={`${styles.warningBanner} ${bannerClass}`} style={{ gridColumn: 'span 2', marginTop: '0.5rem' }}>
                                                    <div className={styles.warningTitle}>
                                                        <span>{warning.icon}</span>
                                                        <span>{warning.title}</span>
                                                    </div>
                                                    <div style={{ fontWeight: 'bold' }}>
                                                        Remaining Prints: {remaining.toLocaleString()}
                                                    </div>
                                                    <div>{warning.message}</div>
                                                    <div style={{ fontSize: '0.825rem', opacity: 0.9, fontStyle: 'italic' }}>
                                                        {warning.suggestion}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                ) : (
                                    <div className={styles.emptyState}>Select a stencil to view details</div>
                                )}
                            </div>
                        </div>

                        {/* Work Order Search & Preview */}
                        <div className={styles.formGrid}>
                            <div className={styles.inputGroup}>
                                <label>Work Order <span>*</span></label>
                                <WorkOrderSelector
                                    options={workOrders}
                                    value={selectedWorkOrder ? selectedWorkOrder.id : ''}
                                    onChange={(val) => {
                                        const wo = workOrders.find(w => w.id === val);
                                        setSelectedWorkOrder(wo || null);
                                    }}
                                    placeholder="Select Work Order"
                                    valueKey="id"
                                    labelKey="id"
                                    productNameKey="product_name"
                                    quantityKey="quantity"
                                    required
                                />
                            </div>

                            {/* Work order details display */}
                            <div className={styles.detailsSection}>
                                <h4>Selected Work Order Details</h4>
                                {selectedWorkOrder ? (
                                    <div className={styles.detailsGrid}>
                                        <div className={styles.detailField}>
                                            <span className={styles.detailLabel}>Work Order Number</span>
                                            <span className={styles.detailValue}>{selectedWorkOrder.id}</span>
                                        </div>
                                        <div className={styles.detailField}>
                                            <span className={styles.detailLabel}>PO Number</span>
                                            <span className={styles.detailValue}>{selectedWorkOrder.po_id}</span>
                                        </div>
                                        <div className={styles.detailField}>
                                            <span className={styles.detailLabel}>Product Name</span>
                                            <span className={styles.detailValue}>{selectedWorkOrder.product_name}</span>
                                        </div>
                                        <div className={styles.detailField}>
                                            <span className={styles.detailLabel}>Product Description</span>
                                            <span className={styles.detailValue}>{selectedWorkOrder.product_description || '-'}</span>
                                        </div>
                                        <div className={styles.detailField}>
                                            <span className={styles.detailLabel}>Sides</span>
                                            <span className={styles.detailValue}>{selectedWorkOrder.sides}</span>
                                        </div>
                                        <div className={styles.detailField}>
                                            <span className={styles.detailLabel}>Quantity</span>
                                            <span className={styles.detailValue}>{selectedWorkOrder.quantity}</span>
                                        </div>
                                        <div className={styles.detailField}>
                                            <span className={styles.detailLabel}>PCB Per Panel</span>
                                            <span className={styles.detailValue}>{selectedWorkOrder.panel_quantity > 0 ? Math.round(selectedWorkOrder.quantity / selectedWorkOrder.panel_quantity) : 1}</span>
                                        </div>
                                        <div className={styles.detailField}>
                                            <span className={styles.detailLabel}>Panel Quantity</span>
                                            <span className={styles.detailValue}>{selectedWorkOrder.panel_quantity}</span>
                                        </div>
                                        <div className={styles.detailField}>
                                            <span className={styles.detailLabel}>Priority</span>
                                            <span className={styles.detailValue}>{selectedWorkOrder.priority || 'Medium'}</span>
                                        </div>
                                        <div className={styles.detailField}>
                                            <span className={styles.detailLabel}>Line</span>
                                            <span className={styles.detailValue}>{selectedWorkOrder.line_id || '-'}</span>
                                        </div>
                                        <div className={styles.detailField}>
                                            <span className={styles.detailLabel}>Created By</span>
                                            <span className={styles.detailValue}>{selectedWorkOrder.created_by}</span>
                                        </div>
                                        <div className={styles.detailField}>
                                            <span className={styles.detailLabel}>Created Date</span>
                                            <span className={styles.detailValue}>{new Date(selectedWorkOrder.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className={styles.emptyState}>Select a work order to view details</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Remarks input and Submit row */}
                    <div className={styles.inputGroup} style={{ marginBottom: '1.5rem' }}>
                        <label>Remarks</label>
                        <textarea
                            className={styles.textarea}
                            rows={3}
                            placeholder="Enter any additional remarks regarding this life cycle assignment"
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                        <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={() => {
                                setSelectedStencil(null);
                                setSelectedWorkOrder(null);
                                setStencilSearch('');
                                setRemarks('');
                            }}
                            disabled={submitting}
                        >
                            Reset
                        </button>
                        <button
                            type="submit"
                            className={styles.button}
                            disabled={!selectedStencil || !selectedWorkOrder || submitting}
                        >
                            {submitting ? 'Creating Assignment...' : 'Create Assignment'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Completed Batches Table */}
            <div className={styles.card}>
                <div className={styles.tableHeader}>
                    <h3>Completed Batches / Assignment History</h3>
                    <form onSubmit={handleSearchSubmit} className={styles.searchBar}>
                        <input
                            type="text"
                            className={styles.input}
                            placeholder="Search by stencil, work order, status..."
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
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
                                <th onClick={() => handleSort('stencil_name')} className={styles.sortable}>
                                    Stencil / Model Name {sortBy === 'stencil_name' ? (sortOrder === 'ASC' ? '▲' : '▼') : ''}
                                </th>
                                <th onClick={() => handleSort('work_order_number')} className={styles.sortable}>
                                    Work Order {sortBy === 'work_order_number' ? (sortOrder === 'ASC' ? '▲' : '▼') : ''}
                                </th>
                                <th onClick={() => handleSort('sides')} className={styles.sortable}>
                                    Sides {sortBy === 'sides' ? (sortOrder === 'ASC' ? '▲' : '▼') : ''}
                                </th>
                                <th onClick={() => handleSort('product_name')} className={styles.sortable}>
                                    Product Name {sortBy === 'product_name' ? (sortOrder === 'ASC' ? '▲' : '▼') : ''}
                                </th>
                                <th onClick={() => handleSort('target_life_cycle')} className={styles.sortable}>
                                    Target Life Cycle {sortBy === 'target_life_cycle' ? (sortOrder === 'ASC' ? '▲' : '▼') : ''}
                                </th>
                                <th onClick={() => handleSort('qty_life_cycle')} className={styles.sortable}>
                                    Qty Life Cycle {sortBy === 'qty_life_cycle' ? (sortOrder === 'ASC' ? '▲' : '▼') : ''}
                                </th>
                                <th onClick={() => handleSort('balance_life_cycle')} className={styles.sortable}>
                                    Balance Life Cycle {sortBy === 'balance_life_cycle' ? (sortOrder === 'ASC' ? '▲' : '▼') : ''}
                                </th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loadingTable ? (
                                <tr>
                                    <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                                        Loading lifecycle records...
                                    </td>
                                </tr>
                            ) : records.length === 0 ? (
                                <tr>
                                    <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                                        No lifecycle records found.
                                    </td>
                                </tr>
                            ) : (
                                records.map((rec) => (
                                    <tr key={rec.id}>
                                        <td style={{ fontWeight: 650 }}>{rec.stencil_name}</td>
                                        <td>{rec.work_order_number}</td>
                                        <td>{rec.sides}</td>
                                        <td>{rec.product_name}</td>
                                        <td style={{ textAlign: 'center' }}>{rec.target_life_cycle}</td>
                                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{rec.qty_life_cycle}</td>
                                        <td style={{ textAlign: 'center', color: rec.balance_life_cycle === 0 ? '#ef4444' : 'inherit' }}>
                                            {rec.balance_life_cycle}
                                        </td>
                                        <td>
                                            <div className={styles.actionCell}>
                                                <button
                                                    onClick={() => handleViewDetails(rec.id)}
                                                    className={styles.viewButton}
                                                >
                                                    View
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (!isSuperAdmin) {
                                                            showToast("Only Super Admin is authorized to delete records.\nPlease contact your Super Admin if this record needs to be deleted.", "error");
                                                        } else {
                                                            setConfirmDeleteId(rec.id);
                                                        }
                                                    }}
                                                    className={styles.deleteButton}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination footer */}
                <div className={styles.paginationWrapper}>
                    <span>
                        Showing Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({totalRecords} records)
                    </span>
                    <div className={styles.paginationButtons}>
                        <button
                            className={styles.secondaryButton}
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        >
                            Previous
                        </button>
                        <button
                            className={styles.secondaryButton}
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {/* View Details Modal */}
            {viewDetailData && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalHeader}>
                            <h3>📄 Stencil Lifecycle Detail Sheet</h3>
                            <button
                                className={styles.modalClose}
                                onClick={() => setViewDetailData(null)}
                            >
                                &times;
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            {/* Stencil Info Section */}
                            <div>
                                <div className={styles.modalSectionTitle}>Stencil Master Record Information</div>
                                <div className={styles.modalGrid}>
                                    {viewDetailData.record.stencil_name && (
                                        <div className={styles.modalField}>
                                            <span className={styles.modalLabel}>Stencil / Model Name</span>
                                            <span className={styles.modalValue}>{viewDetailData.record.stencil_name}</span>
                                        </div>
                                    )}
                                    {viewDetailData.stencil?.job_number && (
                                        <div className={styles.modalField}>
                                            <span className={styles.modalLabel}>Job Number</span>
                                            <span className={styles.modalValue}>{viewDetailData.stencil.job_number}</span>
                                        </div>
                                    )}
                                    {viewDetailData.stencil?.revision && (
                                        <div className={styles.modalField}>
                                            <span className={styles.modalLabel}>Revision</span>
                                            <span className={styles.modalValue}>{viewDetailData.stencil.revision}</span>
                                        </div>
                                    )}
                                    {viewDetailData.stencil?.thickness_mills && (
                                        <div className={styles.modalField}>
                                            <span className={styles.modalLabel}>Thickness</span>
                                            <span className={styles.modalValue}>{viewDetailData.stencil.thickness_mills} mills</span>
                                        </div>
                                    )}
                                    {viewDetailData.stencil?.manufacturing_date && (
                                        <div className={styles.modalField}>
                                            <span className={styles.modalLabel}>Manufacturing Date</span>
                                            <span className={styles.modalValue}>
                                                {new Date(viewDetailData.stencil.manufacturing_date).toISOString().split('T')[0]}
                                            </span>
                                        </div>
                                    )}
                                    {viewDetailData.stencil?.side && (
                                        <div className={styles.modalField}>
                                            <span className={styles.modalLabel}>Sides</span>
                                            <span className={styles.modalValue}>{viewDetailData.stencil.side}</span>
                                        </div>
                                    )}
                                    {viewDetailData.stencil?.remarks && viewDetailData.stencil.remarks.trim() && (
                                        <div className={styles.modalField}>
                                            <span className={styles.modalLabel}>Remark</span>
                                            <span className={styles.modalValue}>{viewDetailData.stencil.remarks}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Work Order Info Section */}
                            <div>
                                <div className={styles.modalSectionTitle}>Work Order Information</div>
                                <div className={styles.modalGrid}>
                                    <div className={styles.modalField}>
                                        <span className={styles.modalLabel}>Work Order Number</span>
                                        <span className={styles.modalValue}>{viewDetailData.record.work_order_number}</span>
                                    </div>
                                    <div className={styles.modalField}>
                                        <span className={styles.modalLabel}>PO Number</span>
                                        <span className={styles.modalValue}>{viewDetailData.workOrder?.po_id || 'N/A'}</span>
                                    </div>
                                    <div className={styles.modalField}>
                                        <span className={styles.modalLabel}>Product Name</span>
                                        <span className={styles.modalValue}>{viewDetailData.record.product_name}</span>
                                    </div>
                                    <div className={styles.modalField}>
                                        <span className={styles.modalLabel}>Product Description</span>
                                        <span className={styles.modalValue}>{viewDetailData.record.product_description || '-'}</span>
                                    </div>
                                    <div className={styles.modalField}>
                                        <span className={styles.modalLabel}>Sides</span>
                                        <span className={styles.modalValue}>{viewDetailData.record.sides}</span>
                                    </div>
                                    <div className={styles.modalField}>
                                        <span className={styles.modalLabel}>Quantity</span>
                                        <span className={styles.modalValue}>{viewDetailData.record.quantity}</span>
                                    </div>
                                    <div className={styles.modalField}>
                                        <span className={styles.modalLabel}>PCB Per Panel</span>
                                        <span className={styles.modalValue}>
                                            {viewDetailData.workOrder && viewDetailData.workOrder.panel_quantity > 0
                                                ? Math.round(viewDetailData.workOrder.quantity / viewDetailData.workOrder.panel_quantity)
                                                : 1}
                                        </span>
                                    </div>
                                    <div className={styles.modalField}>
                                        <span className={styles.modalLabel}>Panel Quantity</span>
                                        <span className={styles.modalValue}>{viewDetailData.workOrder?.panel_quantity || 0}</span>
                                    </div>
                                    <div className={styles.modalField}>
                                        <span className={styles.modalLabel}>Priority</span>
                                        <span className={styles.modalValue}>{viewDetailData.workOrder?.priority || 'Medium'}</span>
                                    </div>
                                    <div className={styles.modalField}>
                                        <span className={styles.modalLabel}>Line</span>
                                        <span className={styles.modalValue}>{viewDetailData.workOrder?.line_id || '-'}</span>
                                    </div>
                                    <div className={styles.modalField}>
                                        <span className={styles.modalLabel}>WO Remarks</span>
                                        <span className={styles.modalValue}>{viewDetailData.workOrder?.remark || '-'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Lifecycle & Status Info Section */}
                            <div>
                                <div className={styles.modalSectionTitle}>Life Cycle Information</div>
                                <div className={styles.modalGrid}>
                                    <div className={styles.modalField}>
                                        <span className={styles.modalLabel}>Target Life Cycle limit</span>
                                        <span className={styles.modalValue}>{viewDetailData.record.target_life_cycle}</span>
                                    </div>
                                    <div className={styles.modalField}>
                                        <span className={styles.modalLabel}>Qty Life Cycle (WO Qty)</span>
                                        <span className={styles.modalValue}>{viewDetailData.record.qty_life_cycle}</span>
                                    </div>
                                    <div className={styles.modalField}>
                                        <span className={styles.modalLabel}>Balance Life Cycle</span>
                                        <span className={styles.modalValue}>{viewDetailData.record.balance_life_cycle}</span>
                                    </div>
                                    <div className={styles.modalField}>
                                        <span className={styles.modalLabel}>Current Used prints</span>
                                        <span className={styles.modalValue}>{viewDetailData.record.current_used_life_cycle}</span>
                                    </div>
                                    <div className={styles.modalField}>
                                        <span className={styles.modalLabel}>Lifecycle Status</span>
                                        <span className={styles.modalValue}>{viewDetailData.record.status}</span>
                                    </div>
                                    <div className={styles.modalField}>
                                        <span className={styles.modalLabel}>Assignment Remarks</span>
                                        <span className={styles.modalValue}>{viewDetailData.record.remarks || '-'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Audit Logs Section */}
                            <div>
                                <div className={styles.modalSectionTitle}>Audit Log</div>
                                <div className={styles.modalGrid}>
                                    <div className={styles.modalField}>
                                        <span className={styles.modalLabel}>Created By</span>
                                        <span className={styles.modalValue}>{viewDetailData.record.created_by_name}</span>
                                    </div>
                                    <div className={styles.modalField}>
                                        <span className={styles.modalLabel}>Created Date</span>
                                        <span className={styles.modalValue}>{new Date(viewDetailData.record.created_at).toLocaleString()}</span>
                                    </div>
                                    {viewDetailData.record.updated_by_name && (
                                        <div className={styles.modalField}>
                                            <span className={styles.modalLabel}>Updated By</span>
                                            <span className={styles.modalValue}>{viewDetailData.record.updated_by_name}</span>
                                        </div>
                                    )}
                                    {viewDetailData.record.updated_by_name && viewDetailData.record.updated_at && (
                                        <div className={styles.modalField}>
                                            <span className={styles.modalLabel}>Updated Date</span>
                                            <span className={styles.modalValue}>{new Date(viewDetailData.record.updated_at).toLocaleString()}</span>
                                        </div>
                                    )}
                                    {viewDetailData.record.deleted_by_name && (
                                        <div className={styles.modalField}>
                                            <span className={styles.modalLabel}>Deleted By</span>
                                            <span className={styles.modalValue}>{viewDetailData.record.deleted_by_name}</span>
                                        </div>
                                    )}
                                    {viewDetailData.record.deleted_at && (
                                        <div className={styles.modalField}>
                                            <span className={styles.modalLabel}>Deleted Date</span>
                                            <span className={styles.modalValue}>{new Date(viewDetailData.record.deleted_at).toLocaleString()}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <button
                                className={styles.secondaryButton}
                                style={{ minWidth: '120px' }}
                                onClick={() => setViewDetailData(null)}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Delete Dialog */}
            {confirmDeleteId && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent} style={{ maxWidth: '450px' }}>
                        <div className={styles.modalHeader}>
                            <h3>⚠️ Confirm Record Deletion</h3>
                            <button
                                className={styles.modalClose}
                                onClick={() => setConfirmDeleteId(null)}
                            >
                                &times;
                            </button>
                        </div>
                        <div className={styles.modalBody} style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>
                            <p>Are you sure you want to delete this stencil lifecycle assignment record?</p>
                            <p style={{ color: '#ef4444', fontWeight: 600 }}>
                                This action will subtract the assigned quantity from the stencil's total used print count and log the action in the audit trail.
                            </p>
                            <p>This action cannot be undone.</p>
                        </div>
                        <div className={styles.modalFooter} style={{ justifyContent: 'flex-end', gap: '0.75rem' }}>
                            <button
                                className={styles.secondaryButton}
                                onClick={() => setConfirmDeleteId(null)}
                            >
                                Cancel
                            </button>
                            <button
                                className={styles.dangerButton}
                                onClick={handleDeleteRecord}
                            >
                                Confirm Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StencilLifecycleManagement;
