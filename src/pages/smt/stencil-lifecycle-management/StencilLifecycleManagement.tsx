import React, { useState, useEffect, useRef } from 'react';
import styles from './StencilLifecycleManagement.module.css';
import { WorkOrderSelector } from '../../../components/WorkOrderSelector';
import { useSmtAuth } from '../../../context/SmtAuthContext';
import { useAuth } from '../../../hooks/useAuth';
import { useToast } from '../../../components/Toast';
import { apiFetch } from '../../../utils/api';
import { isStencilSideCompatible, calculateRequiredLifecyclePrints } from '../../../utils/smtHelper';

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
    physical_status?: string;
    remarks: string | null;
    print_count: number;
    target_life_cycle: number;
    current_cycle_capacity?: number;
    cycle_number?: number;
    total_lifetime_prints?: number;
    current_cycle_used?: number;
    stencil_id?: string;
    stencil_rack_number?: string;
    lifecycle_status?: string;
    remaining_life?: number;
    remaining_percentage?: string;
    health_indicator?: string;
    maintenance_count?: number;
    last_maintenance_date?: string;
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
    cycle_number?: number;
    previous_used_prints?: number;
    quantity_added?: number;
    new_used_prints?: number;
    previous_remaining_prints?: number;
    new_remaining_prints?: number;
    status: string;
    remarks: string | null;
    created_by_name: string;
    created_at: string;
    updated_by_name?: string | null;
    updated_at?: string | null;
    deleted_by_name?: string | null;
    deleted_at?: string | null;
    is_deleted?: boolean;
}

interface DetailModalData {
    record: LifecycleRecord;
    stencil: Stencil | null;
    workOrder: WorkOrder | null;
}

const StencilLifecycleManagement: React.FC = () => {
    const { smtUser, smtLogout } = useSmtAuth();
    const { user } = useAuth();
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
    const stencilRef = useRef<HTMLDivElement>(null);

    // Maintenance States
    const [maintSelectedStencil, setMaintSelectedStencil] = useState<Stencil | null>(null);
    const [maintenanceReason, setMaintenanceReason] = useState('');
    const [additionalLifeCycle, setAdditionalLifeCycle] = useState<number | string>(30000);
    const [scrapReason, setScrapReason] = useState('');
    const [maintRemarks, setMaintRemarks] = useState('');
    const [maintHistory, setMaintHistory] = useState<any[]>([]);
    const [statusHistory, setStatusHistory] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'maintenance' | 'status'>('maintenance');
    const [maintStencilSearch, setMaintStencilSearch] = useState('');
    const [maintStencilDropdownOpen, setMaintStencilDropdownOpen] = useState(false);
    const maintStencilRef = useRef<HTMLDivElement>(null);

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
    const isSuperAdmin = smtUser?.role === 'Super Admin' || user?.role === 'Super Admin';

    const lastWarnedRef = useRef<{ stencilId: string; level: number } | null>(null);

    const getWarningDetails = (remaining: number) => {
        if (remaining <= 1000) {
            return {
                level: 3,
                icon: '🚨',
                title: 'Final Warning',
                message: 'This stencil is very close to reaching its current cycle capacity.',
                suggestion: 'Schedule stencil maintenance or replacement soon.',
                toastType: 'error' as const,
                bannerColor: 'red'
            };
        } else if (remaining <= 2500) {
            return {
                level: 2,
                icon: '⚠️',
                title: 'Critical Warning',
                message: 'This stencil has very few prints remaining in the current cycle.',
                suggestion: 'Please prepare for maintenance.',
                toastType: 'info' as const,
                bannerColor: 'orange'
            };
        } else if (remaining <= 5000) {
            return {
                level: 1,
                icon: '⚠️',
                title: 'Warning',
                message: 'This stencil is approaching its cycle capacity.',
                suggestion: 'Please prepare for upcoming maintenance.',
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

    // Auto-refresh selectedStencil when stencils list changes
    useEffect(() => {
        if (selectedStencil && stencils.length > 0) {
            const updated = stencils.find(s => s.id === selectedStencil.id);
            if (updated) {
                if (updated.print_count !== selectedStencil.print_count || updated.status !== selectedStencil.status || updated.lifecycle_status !== selectedStencil.lifecycle_status) {
                    setSelectedStencil(updated);
                }
            } else {
                setSelectedStencil(null);
            }
        }
    }, [stencils, selectedStencil]);

    // Auto-refresh maintSelectedStencil when stencils list changes
    useEffect(() => {
        if (maintSelectedStencil && stencils.length > 0) {
            const updated = stencils.find(s => s.id === maintSelectedStencil.id);
            if (updated) {
                setMaintSelectedStencil(updated);
            }
        }
    }, [stencils]);

    // Evaluate selectedStencil warning toasts
    useEffect(() => {
        if (selectedStencil) {
            const capacity = selectedStencil.current_cycle_capacity || selectedStencil.target_life_cycle || 60000;
            const remaining = Math.max(0, capacity - selectedStencil.print_count);
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
            if (maintStencilRef.current && !maintStencilRef.current.contains(event.target as Node)) {
                setMaintStencilDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Side effect to fetch history when maintSelectedStencil changes
    useEffect(() => {
        if (maintSelectedStencil) {
            const rackNo = maintSelectedStencil.stencil_id || maintSelectedStencil.stencil_rack_number || maintSelectedStencil.id;
            fetchStencilHistory(rackNo);
        } else {
            setMaintHistory([]);
            setStatusHistory([]);
        }
    }, [maintSelectedStencil]);

    const fetchStencilHistory = async (rackNumber: string) => {
        setHistoryLoading(true);
        try {
            const [maintData, statusData] = await Promise.all([
                apiFetch(`/api/smt/stencil-lifecycle/maintenance/history/${encodeURIComponent(rackNumber)}`),
                apiFetch(`/api/smt/stencil-lifecycle/status-history/${encodeURIComponent(rackNumber)}`)
            ]);
            setMaintHistory(maintData);
            setStatusHistory(statusData);
        } catch (err) {
            console.error('Failed to fetch stencil history:', err);
            showToast('Failed to load history logs for the selected stencil.', 'error');
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleCompleteMaintenance = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!maintSelectedStencil) return;
        const rackNo = maintSelectedStencil.stencil_id || maintSelectedStencil.stencil_rack_number || maintSelectedStencil.id;

        if (!maintenanceReason) {
            showToast('Please select a Maintenance Reason.', 'error');
            return;
        }

        const addCap = parseInt(String(additionalLifeCycle), 10);
        if (isNaN(addCap) || addCap <= 0) {
            showToast('Additional Life Cycle capacity must be a positive integer.', 'error');
            return;
        }

        if (!maintRemarks.trim()) {
            showToast('Remarks are mandatory for completing maintenance.', 'error');
            return;
        }

        setSubmitting(true);
        try {
            const res = await apiFetch('/api/smt/stencil-lifecycle/maintenance/complete', {
                method: 'POST',
                body: JSON.stringify({
                    stencil_rack_number: rackNo,
                    maintenance_reason: maintenanceReason,
                    additional_life_cycle: addCap,
                    remarks: maintRemarks.trim()
                })
            });

            showToast(res.message || `Maintenance completed successfully for Stencil ${rackNo}.`, 'success');
            setMaintRemarks('');
            setMaintenanceReason('');
            setAdditionalLifeCycle(30000);
            setMaintSelectedStencil(null);
            setMaintStencilSearch('');
            
            await Promise.all([
                fetchActiveStencils(),
                fetchRecords()
            ]);
        } catch (err: any) {
            console.error('Complete maintenance error:', err);
            showToast(err.message || 'Failed to complete maintenance.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleScrapStencil = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!maintSelectedStencil) return;
        const rackNo = maintSelectedStencil.stencil_id || maintSelectedStencil.stencil_rack_number || maintSelectedStencil.id;

        if (!scrapReason) {
            showToast('Please select a Scrap Reason.', 'error');
            return;
        }
        if (!maintRemarks.trim()) {
            showToast('Remarks are mandatory for scrapping.', 'error');
            return;
        }

        if (!window.confirm(`Are you sure you want to permanently SCRAP Stencil ${rackNo}? This action is irreversible.`)) {
            return;
        }

        setSubmitting(true);
        try {
            await apiFetch('/api/smt/stencil-lifecycle/maintenance/scrap', {
                method: 'POST',
                body: JSON.stringify({
                    stencil_rack_number: rackNo,
                    scrap_reason: scrapReason,
                    remarks: maintRemarks.trim()
                })
            });

            showToast(`Stencil ${rackNo} has been permanently scrapped.`, 'success');
            setMaintRemarks('');
            setScrapReason('');
            setMaintSelectedStencil(null);
            setMaintStencilSearch('');
            
            await Promise.all([
                fetchActiveStencils(),
                fetchRecords()
            ]);
        } catch (err: any) {
            console.error('Scrap stencil error:', err);
            showToast(err.message || 'Failed to scrap stencil.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

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

    const getWorkOrderExistingStrategy = (woId: string) => {
        const woRecords = records.filter(r => r.work_order_id === woId && !r.is_deleted);
        if (woRecords.length === 0) return { strategy: 'NONE', requiredSide: 'Bottom' };
        const hasCombined = woRecords.some(r => {
            const s = (r.sides || '').trim().toLowerCase();
            return (s.includes('top') && s.includes('bottom')) || s.includes('/');
        });
        if (hasCombined) return { strategy: 'COMBINED', requiredSide: null };

        const hasTop = woRecords.some(r => (r.sides || '').trim().toLowerCase() === 'top');
        const hasBottom = woRecords.some(r => (r.sides || '').trim().toLowerCase() === 'bottom');

        if (hasTop && hasBottom) return { strategy: 'COMPLETE', requiredSide: null };
        if (hasBottom && !hasTop) return { strategy: 'SEPARATE', requiredSide: 'Top' };
        if (hasTop && !hasBottom) return { strategy: 'SEPARATE', requiredSide: 'Bottom' };

        return { strategy: 'NONE', requiredSide: 'Bottom' };
    };

    const getFilteredStencils = () => {
        const q = stencilSearch.trim().toLowerCase();
        let availableOnly = stencils.filter(s => (s.physical_status || s.status) === 'CHECKED_OUT');
        if (selectedWorkOrder) {
            const woSides = (selectedWorkOrder.sides || '').trim().toLowerCase();
            if (woSides.includes('/') || woSides === 'top / bottom' || woSides === 'top/bottom') {
                const { strategy, requiredSide } = getWorkOrderExistingStrategy(selectedWorkOrder.id);
                if (strategy === 'COMBINED' || strategy === 'COMPLETE') {
                    availableOnly = [];
                } else if (strategy === 'SEPARATE' && requiredSide) {
                    availableOnly = availableOnly.filter(s => (s.side || '').trim().toUpperCase() === requiredSide.toUpperCase());
                } else if (strategy === 'NONE') {
                    availableOnly = availableOnly.filter(s => {
                        const sSide = (s.side || '').trim().toUpperCase();
                        return sSide === 'BOTTOM' || sSide === 'TOP/BOTTOM' || (sSide.includes('TOP') && sSide.includes('BOTTOM'));
                    });
                } else {
                    availableOnly = availableOnly.filter(s => isStencilSideCompatible(selectedWorkOrder.sides, s.side));
                }
            } else {
                availableOnly = availableOnly.filter(s => isStencilSideCompatible(selectedWorkOrder.sides, s.side));
            }
        }
        if (!q) return availableOnly;
        return [...availableOnly]
            .filter(s => s.stencil_name.toLowerCase().includes(q) || (s.stencil_id && s.stencil_id.toLowerCase().includes(q)) || (s.job_number && s.job_number.toLowerCase().includes(q)))
            .sort((a, b) => {
                const aNameMatch = a.stencil_name.toLowerCase().startsWith(q) || (a.stencil_id && a.stencil_id.toLowerCase().startsWith(q));
                const bNameMatch = b.stencil_name.toLowerCase().startsWith(q) || (b.stencil_id && b.stencil_id.toLowerCase().startsWith(q));
                if (aNameMatch && !bNameMatch) return -1;
                if (!aNameMatch && bNameMatch) return 1;
                return 0;
            });
    };

    const getFilteredMaintStencils = () => {
        const q = maintStencilSearch.trim().toLowerCase();
        if (!q) return stencils;
        return [...stencils]
            .filter(s => s.stencil_name.toLowerCase().includes(q) || (s.stencil_id && s.stencil_id.toLowerCase().includes(q)) || (s.job_number && s.job_number.toLowerCase().includes(q)))
            .sort((a, b) => {
                const aNameMatch = a.stencil_name.toLowerCase().startsWith(q) || (a.stencil_id && a.stencil_id.toLowerCase().startsWith(q));
                const bNameMatch = b.stencil_name.toLowerCase().startsWith(q) || (b.stencil_id && b.stencil_id.toLowerCase().startsWith(q));
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

        const isCheckedOut = (selectedStencil.physical_status || selectedStencil.status) === 'CHECKED_OUT';
        if (!isCheckedOut) {
            showToast('The selected stencil is currently available in the rack. Please check out the stencil from Stencil Rack Management before assigning it to a Work Order.', 'error');
            return;
        }

        if (calc && !calc.isSequenceValid) {
            showToast(calc.sequenceErrorMsg || 'Please register the BOTTOM stencil first for this TOP/BOTTOM Work Order.', 'error');
            return;
        }

        const capacity = selectedStencil.current_cycle_capacity || selectedStencil.target_life_cycle || 60000;
        const used = selectedStencil.print_count || 0;
        const panelQty = Number(selectedWorkOrder.panel_quantity || selectedWorkOrder.quantity || 0);
        const requiredPrints = calculateRequiredLifecyclePrints(selectedWorkOrder.sides, selectedStencil.side, panelQty);
        const projected = used + requiredPrints;

        if (projected > capacity) {
            showToast(`The required lifecycle prints (${requiredPrints}) exceed the stencil's remaining lifecycle capacity (${capacity - used} prints). Assignment blocked.`, 'error');
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

    // Calculate real-time capacity and side compatibility metrics when both stencil and work order are selected
    const getCapacityCalculation = () => {
        if (!selectedStencil) return null;
        const cycleCap = selectedStencil.current_cycle_capacity || selectedStencil.target_life_cycle || 60000;
        const currentUsed = selectedStencil.print_count || 0;
        const remainingPrints = Math.max(0, cycleCap - currentUsed);
        
        const panelQty = selectedWorkOrder ? Number(selectedWorkOrder.panel_quantity || selectedWorkOrder.quantity || 0) : 0;
        const woQty = selectedWorkOrder ? (selectedWorkOrder.quantity || 0) : 0;
        const woSide = selectedWorkOrder ? selectedWorkOrder.sides : '';
        const stencilSide = selectedStencil.side || '';

        const requiredPrints = (selectedWorkOrder && selectedStencil) ? calculateRequiredLifecyclePrints(woSide, stencilSide, panelQty) : 0;
        const projectedUsed = currentUsed + requiredPrints;
        const remainingAfter = cycleCap - projectedUsed;
        const isExceeded = projectedUsed > cycleCap;
        const isExactLimit = projectedUsed === cycleCap;
        let isBlockedStatus = selectedStencil.lifecycle_status === 'MAINTENANCE' || selectedStencil.lifecycle_status === 'SCRAPPED';
        const isNotCheckedOut = (selectedStencil.physical_status || selectedStencil.status) !== 'CHECKED_OUT';

        // Side compatibility calculation - Flexible matrix check
        const isSideCompatible = (!selectedWorkOrder || !selectedStencil) ? true : isStencilSideCompatible(woSide, stencilSide);

        // Determine Stencil Configuration description
        let stencilConfig = 'Single-Sided';
        const normWO = (woSide || '').trim().toUpperCase();
        const normStencil = (stencilSide || '').trim().toUpperCase();

        if (normWO.includes('/')) {
            if (normStencil.includes('/')) {
                stencilConfig = 'Combined (TOP/BOTTOM)';
            } else if (normStencil === 'TOP') {
                stencilConfig = 'Separate - TOP';
            } else if (normStencil === 'BOTTOM') {
                stencilConfig = 'Separate - BOTTOM';
            } else {
                stencilConfig = 'Separate';
            }
        } else {
            stencilConfig = `Single-Sided (${normWO})`;
        }

        // Check sequence order for TOP/BOTTOM Work Orders
        let isSequenceValid = true;
        let sequenceErrorMsg = '';
        if (selectedWorkOrder && selectedStencil && (normWO.includes('/') || normWO === 'TOP / BOTTOM')) {
            const { strategy, requiredSide } = getWorkOrderExistingStrategy(selectedWorkOrder.id);
            if (strategy === 'NONE' && normStencil === 'TOP') {
                isSequenceValid = false;
                sequenceErrorMsg = 'Please register the BOTTOM stencil first for this TOP/BOTTOM Work Order.';
            } else if (strategy === 'SEPARATE' && requiredSide && normStencil !== requiredSide.toUpperCase()) {
                isSequenceValid = false;
                sequenceErrorMsg = `Sequence error: Work Order requires ${requiredSide} stencil assignment next.`;
            } else if (strategy === 'COMBINED' || strategy === 'COMPLETE') {
                isSequenceValid = false;
                sequenceErrorMsg = 'This Work Order has already completed stencil assignments.';
            }
        }

        if (!isSequenceValid) {
            isBlockedStatus = true;
        }

        return {
            cycleCap,
            currentUsed,
            remainingPrints,
            panelQty,
            woQty,
            requiredPrints,
            projectedUsed,
            remainingAfter,
            isExceeded,
            isExactLimit,
            isBlockedStatus,
            isNotCheckedOut,
            isSideCompatible,
            isSequenceValid,
            sequenceErrorMsg,
            woSide,
            stencilSide,
            stencilConfig,
            excessPrints: isExceeded ? projectedUsed - cycleCap : 0
        };
    };

    const calc = getCapacityCalculation();

    return (
        <div className={styles.container}>
            {/* Header row */}
            <div className={styles.headerRow}>
                <div className={styles.headerContent}>
                    <h2>Stencil Life Cycle Management</h2>
                    <p>Track multi-work-order stencil usage, cycle capacity limits, and maintenance history.</p>
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
                                            value={selectedStencil ? `${selectedStencil.stencil_name} (${selectedStencil.stencil_id})` : stencilSearch}
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
                                                <li className={styles.noOptions}>No checked out stencils available</li>
                                            ) : (
                                                getFilteredStencils().map((s) => {
                                                    const cap = s.current_cycle_capacity || s.target_life_cycle || 60000;
                                                    const rem = s.remaining_life ?? (cap - s.print_count);
                                                    return (
                                                        <li
                                                            key={s.id}
                                                            className={styles.dropdownOption}
                                                            onClick={() => {
                                                                setSelectedStencil(s);
                                                                setStencilSearch(`${s.stencil_name} (${s.stencil_id})`);
                                                                setStencilDropdownOpen(false);
                                                            }}
                                                        >
                                                            <span className={styles.dropdownOptionMain}>
                                                                {s.stencil_name} <span style={{ fontSize: '0.8rem', color: '#64748b' }}>({s.stencil_id})</span>
                                                            </span>
                                                            <span className={styles.dropdownOptionSub}>
                                                                Cycle #{s.cycle_number || 1} | Prints: {s.print_count} / {cap} | Rem: {rem} ({s.remaining_percentage ?? '100.00'}%)
                                                                <span 
                                                                    style={{ 
                                                                        display: 'inline-block', 
                                                                        width: '8px', 
                                                                        height: '8px', 
                                                                        borderRadius: '50%', 
                                                                        marginLeft: '6px',
                                                                        backgroundColor: s.health_indicator === 'Red' ? '#ef4444' : s.health_indicator === 'Orange' ? '#f97316' : s.health_indicator === 'Yellow' ? '#eab308' : '#22c55e'
                                                                    }} 
                                                                    title={`Health: ${s.health_indicator}`}
                                                                />
                                                            </span>
                                                        </li>
                                                    );
                                                })
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
                                            <span className={styles.detailLabel}>Stencil Rack Number</span>
                                            <span className={styles.detailValue}>{selectedStencil.stencil_id || selectedStencil.stencil_rack_number}</span>
                                        </div>
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

                                        <hr className={styles.divider} />

                                        <div className={styles.detailField}>
                                            <span className={styles.detailLabel}>Current Lifecycle Cycle</span>
                                            <span className={styles.detailValue} style={{ fontWeight: 'bold', color: '#2563eb' }}>Cycle {selectedStencil.cycle_number || 1}</span>
                                        </div>
                                        <div className={styles.detailField}>
                                            <span className={styles.detailLabel}>Current Cycle Capacity</span>
                                            <span className={styles.detailValue}>{selectedStencil.current_cycle_capacity || selectedStencil.target_life_cycle || 60000}</span>
                                        </div>
                                        <div className={styles.detailField}>
                                            <span className={styles.detailLabel}>Current Cycle Used Prints</span>
                                            <span className={styles.detailValue}>{selectedStencil.print_count}</span>
                                        </div>
                                        <div className={styles.detailField}>
                                            <span className={styles.detailLabel}>Current Cycle Remaining</span>
                                            <span className={styles.detailValue}>
                                                {selectedStencil.remaining_life ?? ((selectedStencil.current_cycle_capacity || selectedStencil.target_life_cycle || 60000) - selectedStencil.print_count)} ({selectedStencil.remaining_percentage ?? '100.00'}%)
                                            </span>
                                        </div>
                                        <div className={styles.detailField}>
                                            <span className={styles.detailLabel}>Total Lifetime Prints</span>
                                            <span className={styles.detailValue} style={{ fontWeight: 'bold' }}>{(selectedStencil.total_lifetime_prints || 0).toLocaleString()}</span>
                                        </div>
                                        <div className={styles.detailField}>
                                            <span className={styles.detailLabel}>Total Maintenance Runs</span>
                                            <span className={styles.detailValue}>{selectedStencil.maintenance_count || 0}</span>
                                        </div>
                                        <div className={styles.detailField} style={{ gridColumn: 'span 2' }}>
                                            <span className={styles.detailLabel}>Lifecycle Status</span>
                                            <span 
                                                className={styles.detailValue} 
                                                style={{ 
                                                    fontWeight: 'bold',
                                                    color: selectedStencil.lifecycle_status === 'MAINTENANCE' ? '#d97706' : selectedStencil.lifecycle_status === 'SCRAPPED' ? '#ef4444' : '#166534'
                                                }}
                                            >
                                                {selectedStencil.lifecycle_status || 'ACTIVE'}
                                            </span>
                                        </div>

                                        {(() => {
                                            const cap = selectedStencil.current_cycle_capacity || selectedStencil.target_life_cycle || 60000;
                                            const remaining = Math.max(0, cap - selectedStencil.print_count);
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
                                    onChange={(val: string) => {
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
                                    </div>
                                ) : (
                                    <div className={styles.emptyState}>Select a work order to view details</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Real-time Capacity & Side Calculation Breakdown Panel */}
                    {calc && selectedWorkOrder && (
                        <div style={{ 
                            background: (!calc.isSideCompatible || calc.isExceeded || calc.isNotCheckedOut) ? '#fef2f2' : calc.isExactLimit ? '#fefce8' : '#f0fdf4',
                            border: `1px solid ${(!calc.isSideCompatible || calc.isExceeded || calc.isNotCheckedOut) ? '#fca5a5' : calc.isExactLimit ? '#fde047' : '#86efac'}`,
                            borderRadius: '8px',
                            padding: '1.25rem',
                            marginBottom: '1.5rem'
                        }}>
                            <h4 style={{ margin: '0 0 0.75rem 0', color: (!calc.isSideCompatible || calc.isExceeded || calc.isNotCheckedOut) ? '#991b1b' : calc.isExactLimit ? '#854d0e' : '#166534', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>{(!calc.isSideCompatible || calc.isExceeded || calc.isNotCheckedOut) ? '🚫' : calc.isExactLimit ? '⚠️' : '✅'}</span>
                                <span>Assignment & Capacity Validation Breakdown</span>
                            </h4>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.75rem', fontSize: '0.875rem' }}>
                                <div><strong>Panel Quantity:</strong> {calc.panelQty.toLocaleString()}</div>
                                <div><strong>Work Order Side:</strong> <span style={{ fontWeight: 650 }}>{calc.woSide}</span></div>
                                <div><strong>Stencil Rack Number:</strong> <span style={{ fontWeight: 650 }}>{selectedStencil?.stencil_id || selectedStencil?.stencil_rack_number}</span></div>
                                <div><strong>Stencil Side:</strong> <span style={{ fontWeight: 650 }}>{calc.stencilSide || 'N/A'}</span></div>
                                <div><strong>Stencil Configuration:</strong> <span style={{ fontWeight: 650, color: '#0369a1' }}>{calc.stencilConfig}</span></div>
                                <div><strong>Current Cycle Capacity:</strong> {calc.cycleCap.toLocaleString()}</div>
                                <div><strong>Current Cycle Used:</strong> {calc.currentUsed.toLocaleString()}</div>
                                <div><strong>Current Cycle Remaining:</strong> {calc.remainingPrints.toLocaleString()}</div>
                                <div><strong>Required Lifecycle Prints:</strong> <span style={{ fontWeight: 'bold', color: '#2563eb' }}>{calc.requiredPrints.toLocaleString()}</span></div>
                                <div>
                                    <strong>Projected Cycle Usage:</strong>{' '}
                                    <span style={{ fontWeight: 'bold', color: calc.isExceeded ? '#ef4444' : '#166534' }}>
                                        {calc.projectedUsed.toLocaleString()} / {calc.cycleCap.toLocaleString()}
                                    </span>
                                </div>
                                <div>
                                    <strong>Remaining After Assignment:</strong>{' '}
                                    <span style={{ fontWeight: 'bold', color: calc.remainingAfter < 0 ? '#ef4444' : '#166534' }}>
                                        {calc.remainingAfter.toLocaleString()}
                                    </span>
                                </div>
                                <div>
                                    <strong>Capacity Validation:</strong>{' '}
                                    <span style={{ fontWeight: 'bold', color: calc.isExceeded ? '#ef4444' : '#166534' }}>
                                        {calc.isExceeded ? 'EXCEEDS CAPACITY' : 'PASS'}
                                    </span>
                                </div>
                                <div>
                                    <strong>Side Validation:</strong>{' '}
                                    <span style={{ fontWeight: 'bold', color: !calc.isSideCompatible ? '#ef4444' : '#166534' }}>
                                        {!calc.isSideCompatible ? 'MISMATCH' : 'MATCH'}
                                    </span>
                                </div>
                                <div>
                                    <strong>Assignment:</strong>{' '}
                                    <span style={{ fontWeight: 'bold', color: (calc.isExceeded || !calc.isSideCompatible || calc.isBlockedStatus || calc.isNotCheckedOut) ? '#ef4444' : '#166534' }}>
                                        {(calc.isExceeded || !calc.isSideCompatible || calc.isBlockedStatus || calc.isNotCheckedOut) ? 'BLOCKED' : 'ALLOWED'}
                                    </span>
                                </div>
                            </div>

                            {calc.isNotCheckedOut && (
                                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #fca5a5', color: '#991b1b', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                    The selected stencil is currently available in the rack. Please check out the stencil from Stencil Rack Management before assigning it to a Work Order.
                                </div>
                            )}

                            {!calc.isSequenceValid && (
                                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #fca5a5', color: '#991b1b', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                    {calc.sequenceErrorMsg || 'Please register the BOTTOM stencil first for this TOP/BOTTOM Work Order.'}
                                </div>
                            )}

                            {!calc.isNotCheckedOut && !calc.isSideCompatible && (
                                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #fca5a5', color: '#991b1b', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                    Stencil side {calc.stencilSide || 'N/A'} is not compatible with Work Order side {calc.woSide}.
                                </div>
                            )}

                            {calc.isExceeded && calc.isSideCompatible && (
                                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #fca5a5', color: '#991b1b', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                    The required lifecycle prints exceed the stencil's remaining capacity.
                                    <div style={{ fontSize: '0.825rem', fontWeight: 'normal', marginTop: '0.25rem' }}>
                                        Current Cycle Remaining: <strong>{calc.remainingPrints.toLocaleString()}</strong> prints | Panel Quantity: <strong>{calc.panelQty.toLocaleString()}</strong> | Work Order Side: <strong>{calc.woSide}</strong> | Stencil Side: <strong>{calc.stencilSide}</strong> | Required Lifecycle Prints: <strong>{calc.requiredPrints.toLocaleString()}</strong> prints | Excess: <strong>{calc.excessPrints.toLocaleString()}</strong> prints
                                    </div>
                                </div>
                            )}

                            {calc.isExactLimit && !calc.isExceeded && calc.isSideCompatible && (
                                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #fde047', color: '#854d0e', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                    This Work Order will use the remaining lifecycle capacity exactly ({calc.projectedUsed.toLocaleString()} / {calc.cycleCap.toLocaleString()}).
                                    <div style={{ fontSize: '0.825rem', fontWeight: 'normal', marginTop: '0.25rem' }}>
                                        Upon assignment completion, remaining prints will be 0 and the stencil will require Maintenance before it can be assigned again.
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

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
                            disabled={!selectedStencil || !selectedWorkOrder || submitting || !!calc?.isExceeded || !calc?.isSideCompatible || !!calc?.isBlockedStatus || !!calc?.isNotCheckedOut}
                        >
                            {submitting ? 'Creating Assignment...' : 'Create Assignment'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Stencil Maintenance & Scrapping Card */}
            <div className={styles.card}>
                <h3>Stencil Maintenance & Scrapping</h3>
                <div className={styles.maintLayout}>
                    {/* Left Panel: Form operations */}
                    <div>
                        <div className={styles.inputGroup} ref={maintStencilRef} style={{ marginBottom: '1.5rem' }}>
                            <label>Select Stencil to Manage <span>*</span></label>
                            <div className={styles.dropdownWrapper}>
                                <div className={styles.dropdownInputWrapper}>
                                    <input
                                        type="text"
                                        className={styles.input}
                                        placeholder="Type to search stencil by name or rack number..."
                                        value={maintSelectedStencil ? `${maintSelectedStencil.stencil_name} (${maintSelectedStencil.stencil_id || maintSelectedStencil.stencil_rack_number})` : maintStencilSearch}
                                        onChange={(e) => {
                                            setMaintStencilSearch(e.target.value);
                                            setMaintSelectedStencil(null);
                                            setMaintStencilDropdownOpen(true);
                                        }}
                                        onFocus={() => setMaintStencilDropdownOpen(true)}
                                    />
                                    <span className={styles.dropdownArrow}>▼</span>
                                </div>
                                {maintStencilDropdownOpen && (
                                    <ul className={styles.dropdownList}>
                                        {getFilteredMaintStencils().length === 0 ? (
                                            <li className={styles.noOptions}>No stencils found</li>
                                        ) : (
                                            getFilteredMaintStencils().map((s) => {
                                                const isMaint = s.lifecycle_status === 'MAINTENANCE';
                                                const isScrapped = s.lifecycle_status === 'SCRAPPED';
                                                
                                                let badgeClass = styles.badgeGreen;
                                                if (isMaint) badgeClass = styles.badgeYellow;
                                                else if (isScrapped) badgeClass = styles.badgeRed;

                                                const cap = s.current_cycle_capacity || s.target_life_cycle || 60000;
                                                const rem = s.remaining_life ?? (cap - s.print_count);

                                                return (
                                                    <li
                                                        key={s.id}
                                                        className={styles.dropdownOption}
                                                        onClick={() => {
                                                            setMaintSelectedStencil(s);
                                                            setMaintStencilSearch(`${s.stencil_name} (${s.stencil_id || s.stencil_rack_number})`);
                                                            setMaintStencilDropdownOpen(false);
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <span className={styles.dropdownOptionMain}>
                                                                {s.stencil_name} <span style={{ fontSize: '0.8rem', color: '#64748b' }}>({s.stencil_id || s.stencil_rack_number})</span>
                                                            </span>
                                                            <span className={`${styles.badge} ${badgeClass}`} style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}>
                                                                {s.lifecycle_status || 'ACTIVE'}
                                                            </span>
                                                        </div>
                                                        <span className={styles.dropdownOptionSub}>
                                                            Cycle #{s.cycle_number || 1} | Prints: {s.print_count} / {cap} | Rem: {rem}
                                                        </span>
                                                    </li>
                                                );
                                            })
                                        )}
                                    </ul>
                                )}
                            </div>
                        </div>

                        {maintSelectedStencil ? (
                            <div>
                                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
                                        <div><strong>Stencil Rack Number:</strong> {maintSelectedStencil.stencil_id || maintSelectedStencil.stencil_rack_number}</div>
                                        <div>
                                            <strong>Status: </strong>
                                            <span className={`${styles.badge} ${
                                                maintSelectedStencil.lifecycle_status === 'MAINTENANCE' ? styles.badgeYellow :
                                                maintSelectedStencil.lifecycle_status === 'SCRAPPED' ? styles.badgeRed : styles.badgeGreen
                                            }`} style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem' }}>
                                                {maintSelectedStencil.lifecycle_status || 'ACTIVE'}
                                            </span>
                                        </div>
                                        <div><strong>Current Lifecycle Cycle:</strong> Cycle {maintSelectedStencil.cycle_number || 1}</div>
                                        <div><strong>Current Cycle Capacity:</strong> {maintSelectedStencil.current_cycle_capacity || maintSelectedStencil.target_life_cycle || 60000}</div>
                                        <div><strong>Current Cycle Used:</strong> {maintSelectedStencil.print_count}</div>
                                        <div><strong>Remaining Prints:</strong> {maintSelectedStencil.remaining_life ?? ((maintSelectedStencil.current_cycle_capacity || 60000) - maintSelectedStencil.print_count)} ({maintSelectedStencil.remaining_percentage}%)</div>
                                        <div><strong>Total Lifetime Prints:</strong> {(maintSelectedStencil.total_lifetime_prints || 0).toLocaleString()}</div>
                                        <div><strong>Total Maintenance Runs:</strong> {maintSelectedStencil.maintenance_count ?? 0}</div>
                                    </div>
                                </div>

                                {maintSelectedStencil.lifecycle_status === 'SCRAPPED' ? (
                                    <div style={{ padding: '1.25rem', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#991b1b', fontSize: '0.9rem', fontWeight: 550, textAlign: 'center' }}>
                                        🚫 This stencil has been permanently scrapped and cannot undergo any further operations.
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                        {maintSelectedStencil.lifecycle_status === 'MAINTENANCE' ? (
                                            <form onSubmit={handleCompleteMaintenance} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                                <div className={styles.inputGroup}>
                                                    <label>Maintenance Reason <span>*</span></label>
                                                    <select
                                                        className={styles.select}
                                                        value={maintenanceReason}
                                                        onChange={(e) => setMaintenanceReason(e.target.value)}
                                                        required
                                                    >
                                                        <option value="">-- Select Maintenance Reason --</option>
                                                        <option value="Cleaning">Cleaning</option>
                                                        <option value="Repair">Repair</option>
                                                        <option value="Inspection Passed">Inspection Passed</option>
                                                        <option value="Mesh Replacement">Mesh Replacement</option>
                                                        <option value="Other">Other</option>
                                                    </select>
                                                </div>

                                                <div className={styles.inputGroup}>
                                                    <label>Additional Life Cycle Capacity (Prints) <span>*</span></label>
                                                    <input
                                                        type="number"
                                                        className={styles.input}
                                                        min="1"
                                                        placeholder="Enter additional capacity (e.g. 30000)"
                                                        value={additionalLifeCycle}
                                                        onChange={(e) => setAdditionalLifeCycle(e.target.value)}
                                                        required
                                                    />
                                                </div>

                                                <div className={styles.inputGroup}>
                                                    <label>Maintenance Remarks <span>*</span></label>
                                                    <textarea
                                                        className={styles.textarea}
                                                        rows={3}
                                                        placeholder="Enter detailed maintenance remarks (e.g. tension check results, cleaning quality)..."
                                                        value={maintRemarks}
                                                        onChange={(e) => setMaintRemarks(e.target.value)}
                                                        required
                                                    />
                                                </div>

                                                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                                    <button
                                                        type="button"
                                                        className={styles.secondaryButton}
                                                        onClick={() => {
                                                            setMaintRemarks('');
                                                            setMaintenanceReason('');
                                                            setAdditionalLifeCycle(30000);
                                                            setScrapReason('');
                                                        }}
                                                        disabled={submitting}
                                                    >
                                                        Reset
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={styles.button}
                                                        style={{ background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', boxShadow: '0 2px 4px rgba(249, 115, 22, 0.2)' }}
                                                        onClick={() => {
                                                            if (!scrapReason) {
                                                                setScrapReason('Inspection Failed');
                                                            }
                                                            const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
                                                            handleScrapStencil(fakeEvent);
                                                        }}
                                                        disabled={submitting}
                                                    >
                                                        Scrap Stencil
                                                    </button>
                                                    <button
                                                        type="submit"
                                                        className={styles.button}
                                                        disabled={submitting}
                                                    >
                                                        {submitting ? 'Completing...' : 'Complete Maintenance'}
                                                    </button>
                                                </div>
                                            </form>
                                        ) : (
                                            <form onSubmit={handleScrapStencil} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                                <div className={styles.inputGroup}>
                                                    <label>Scrap Reason <span>*</span></label>
                                                    <select
                                                        className={styles.select}
                                                        value={scrapReason}
                                                        onChange={(e) => setScrapReason(e.target.value)}
                                                        required
                                                    >
                                                        <option value="">-- Select Scrap Reason --</option>
                                                        <option value="Damaged">Damaged</option>
                                                        <option value="Warped">Warped</option>
                                                        <option value="Aperture Damage">Aperture Damage</option>
                                                        <option value="Excessive Wear">Excessive Wear</option>
                                                        <option value="Failed Inspection">Failed Inspection</option>
                                                        <option value="Other">Other</option>
                                                    </select>
                                                </div>

                                                <div className={styles.inputGroup}>
                                                    <label>Remarks <span>*</span></label>
                                                    <textarea
                                                        className={styles.textarea}
                                                        rows={3}
                                                        placeholder="Enter detailed reason for scrapping this stencil..."
                                                        value={maintRemarks}
                                                        onChange={(e) => setMaintRemarks(e.target.value)}
                                                        required
                                                    />
                                                </div>

                                                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                                    <button
                                                        type="button"
                                                        className={styles.secondaryButton}
                                                        onClick={() => {
                                                            setMaintRemarks('');
                                                            setScrapReason('');
                                                        }}
                                                        disabled={submitting}
                                                    >
                                                        Reset
                                                    </button>
                                                    <button
                                                        type="submit"
                                                        className={styles.button}
                                                        style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', boxShadow: '0 2px 4px rgba(239, 68, 68, 0.2)' }}
                                                        disabled={submitting}
                                                    >
                                                        {submitting ? 'Scrapping...' : 'Scrap Stencil'}
                                                    </button>
                                                </div>
                                            </form>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className={styles.emptyState} style={{ height: '200px' }}>
                                Select a stencil to view management actions and history logs
                            </div>
                        )}
                    </div>

                    {/* Right Panel: History Logs */}
                    <div style={{ borderLeft: '1px solid #cbd5e1', paddingLeft: '2rem' }}>
                        <div className={styles.maintTabs}>
                            <button
                                type="button"
                                className={`${styles.maintTab} ${activeTab === 'maintenance' ? styles.maintTabActive : ''}`}
                                onClick={() => setActiveTab('maintenance')}
                            >
                                Maintenance Logs ({maintHistory.length})
                            </button>
                            <button
                                type="button"
                                className={`${styles.maintTab} ${activeTab === 'status' ? styles.maintTabActive : ''}`}
                                onClick={() => setActiveTab('status')}
                            >
                                Status Change Logs ({statusHistory.length})
                            </button>
                        </div>

                        <div className={styles.historyContainer}>
                            {historyLoading ? (
                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', color: '#64748b' }}>
                                    Loading history logs...
                                </div>
                            ) : activeTab === 'maintenance' ? (
                                maintHistory.length === 0 ? (
                                    <div className={styles.emptyState} style={{ height: '200px' }}>
                                        No maintenance logs found for this stencil
                                    </div>
                                ) : (
                                    <table className={styles.historyTable}>
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Cycle #</th>
                                                <th>Reason</th>
                                                <th>Added Capacity</th>
                                                <th>Remarks</th>
                                                <th>Technician</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {maintHistory.map((h, i) => (
                                                <tr key={h.id || i}>
                                                    <td>{new Date(h.maintenance_date).toLocaleDateString()}</td>
                                                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{h.maintenance_cycle_number || h.maintenance_count}</td>
                                                    <td style={{ fontWeight: 600 }}>{h.maintenance_reason || h.action}</td>
                                                    <td style={{ textAlign: 'center', color: '#2563eb', fontWeight: 'bold' }}>
                                                        {h.additional_lifecycle_capacity ? `+${h.additional_lifecycle_capacity}` : '-'}
                                                    </td>
                                                    <td>{h.remarks}</td>
                                                    <td>{h.performed_by_name} ({h.performed_by_code})</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )
                            ) : (
                                statusHistory.length === 0 ? (
                                    <div className={styles.emptyState} style={{ height: '200px' }}>
                                        No status transition logs found for this stencil
                                    </div>
                                ) : (
                                    <table className={styles.historyTable}>
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Transition</th>
                                                <th>Reason / Remarks</th>
                                                <th>Operator</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {statusHistory.map((h, i) => (
                                                <tr key={h.id || i}>
                                                    <td>{new Date(h.changed_date).toLocaleDateString()}</td>
                                                    <td>
                                                        <span style={{ textDecoration: 'line-through', opacity: 0.6, marginRight: '4px' }}>
                                                            {h.previous_status || 'N/A'}
                                                        </span>
                                                        <span>➔</span>
                                                        <span style={{ fontWeight: 650, marginLeft: '4px', color: h.new_status === 'MAINTENANCE' ? '#d97706' : h.new_status === 'SCRAPPED' ? '#ef4444' : '#166534' }}>
                                                            {h.new_status}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div style={{ fontWeight: 600 }}>{h.reason || 'N/A'}</div>
                                                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{h.remarks}</div>
                                                    </td>
                                                    <td>{h.changed_by_name} ({h.changed_by_code})</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )
                            )}
                        </div>
                    </div>
                </div>
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
                                <th onClick={() => handleSort('cycle_number')} className={styles.sortable}>
                                    Cycle # {sortBy === 'cycle_number' ? (sortOrder === 'ASC' ? '▲' : '▼') : ''}
                                </th>
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
                                    Cycle Capacity {sortBy === 'target_life_cycle' ? (sortOrder === 'ASC' ? '▲' : '▼') : ''}
                                </th>
                                <th onClick={() => handleSort('qty_life_cycle')} className={styles.sortable}>
                                    WO Quantity {sortBy === 'qty_life_cycle' ? (sortOrder === 'ASC' ? '▲' : '▼') : ''}
                                </th>
                                <th onClick={() => handleSort('balance_life_cycle')} className={styles.sortable}>
                                    Balance Remaining {sortBy === 'balance_life_cycle' ? (sortOrder === 'ASC' ? '▲' : '▼') : ''}
                                </th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loadingTable ? (
                                <tr>
                                    <td colSpan={9} style={{ textAlign: 'center', padding: '2rem' }}>
                                        Loading lifecycle records...
                                    </td>
                                </tr>
                            ) : records.length === 0 ? (
                                <tr>
                                    <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                                        No lifecycle records found.
                                    </td>
                                </tr>
                            ) : (
                                records.map((rec) => (
                                    <tr key={rec.id}>
                                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#2563eb' }}>
                                            Cycle {rec.cycle_number || 1}
                                        </td>
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
                                                {isSuperAdmin && (
                                                    <button
                                                        onClick={() => {
                                                            setConfirmDeleteId(rec.id);
                                                        }}
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
                                        <span className={styles.modalLabel}>Lifecycle Cycle</span>
                                        <span className={styles.modalValue} style={{ fontWeight: 'bold', color: '#2563eb' }}>Cycle {viewDetailData.record.cycle_number || 1}</span>
                                    </div>
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
