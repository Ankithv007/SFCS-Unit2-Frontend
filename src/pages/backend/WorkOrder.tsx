import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import { checkDeletePermission } from '../../utils/security';
import styles from './WorkOrder.module.css';
import smtStyles from '../smt/work-order/WorkOrder.module.css';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../hooks/useAuth';
import {
    Settings,
    Calendar,
    Eye,
    Trash2,
    Search,
    X,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';

interface WorkOrderRecord {
    id: number;
    wo_number: string;
    po_id?: string;
    product_name?: string;
    product_description?: string;
    sides?: string;
    quantity: number;
    customer_name: string;
    model: string;
    selected_stages?: string[] | string;
    line_id?: string;
    priority?: string;
    solder_paste_status?: string;
    created_by: string;
    created_at: string;
    updated_by?: string;
    updated_at?: string;
    remark?: string;
}

const ALL_STAGES = ['PTH', 'VI', 'QA', 'Flashing', 'PCBA-FCT', 'Assembly', 'Unit Testing', 'QI', 'Packing'];

const WorkOrder: React.FC = () => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [workOrders, setWorkOrders] = useState<WorkOrderRecord[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    // Pagination States
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [pageSize, setPageSize] = useState<number>(20);
    const [totalRecords, setTotalRecords] = useState<number>(0);
    const [totalPages, setTotalPages] = useState<number>(1);

    // Search States
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [activeSearch, setActiveSearch] = useState<string>('');

    const canDelete = user?.role === 'Super Admin';

    // Modal States
    const [selectedWO, setSelectedWO] = useState<WorkOrderRecord | null>(null);
    const [woToDelete, setWoToDelete] = useState<WorkOrderRecord | null>(null);

    const fetchWorkOrders = async (page = 1, limit = 20, search = '') => {
        setIsLoading(true);
        try {
            const queryParams = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString()
            });
            if (search.trim()) {
                queryParams.append('search', search.trim());
            }
            const res = await apiFetch(`/api/backend/work-order?${queryParams.toString()}`);
            if (res && res.data && Array.isArray(res.data)) {
                setWorkOrders(res.data);
                const total = typeof res.total === 'number' ? res.total : res.data.length;
                setTotalRecords(total);
                setTotalPages(typeof res.totalPages === 'number' ? res.totalPages : Math.ceil(total / limit) || 1);
                if (typeof res.page === 'number') {
                    setCurrentPage(res.page);
                }
            } else if (Array.isArray(res)) {
                setWorkOrders(res);
                setTotalRecords(res.length);
                setTotalPages(Math.ceil(res.length / limit) || 1);
            } else {
                setWorkOrders([]);
                setTotalRecords(0);
                setTotalPages(1);
            }
        } catch (error) {
            console.error('Error fetching work orders:', error);
            showToast('Failed to load work orders', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchWorkOrders(currentPage, pageSize, activeSearch);
    }, [currentPage, pageSize]);

    const handleSearch = () => {
        const trimmed = searchQuery.trim();
        setActiveSearch(trimmed);
        setCurrentPage(1);
        fetchWorkOrders(1, pageSize, trimmed);
    };

    const handleClearSearch = () => {
        setSearchQuery('');
        setActiveSearch('');
        setCurrentPage(1);
        fetchWorkOrders(1, pageSize, '');
    };

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        setCurrentPage(1);
        fetchWorkOrders(1, newSize, activeSearch);
    };

    const handlePageChange = (newPage: number) => {
        if (newPage < 1 || (totalPages > 0 && newPage > totalPages) || newPage === currentPage || isLoading) {
            return;
        }
        setCurrentPage(newPage);
    };

    const getPageNumbers = (current: number, total: number): (number | string)[] => {
        if (total <= 7) {
            return Array.from({ length: total }, (_, i) => i + 1);
        }
        const pages: (number | string)[] = [];
        if (current <= 4) {
            for (let i = 1; i <= 5; i++) pages.push(i);
            pages.push('...');
            pages.push(total);
        } else if (current >= total - 3) {
            pages.push(1);
            pages.push('...');
            for (let i = total - 4; i <= total; i++) pages.push(i);
        } else {
            pages.push(1);
            pages.push('...');
            pages.push(current - 1);
            pages.push(current);
            pages.push(current + 1);
            pages.push('...');
            pages.push(total);
        }
        return pages;
    };

    const handleView = (wo: WorkOrderRecord) => {
        console.log("VIEW CLICKED", wo);
        setSelectedWO(wo);
    };

    const handleDeleteClick = (wo: WorkOrderRecord) => {
        if (!checkDeletePermission(user?.role, showToast)) {
            return;
        }
        console.log("DELETE CLICKED", wo);
        setWoToDelete(wo);
    };

    const handleConfirmDelete = async () => {
        if (!woToDelete) return;

        try {
            await apiFetch(`/api/backend/work-order/${woToDelete.id}`, {
                method: 'DELETE'
            });
            showToast('Work Order deleted successfully', 'success');
            setWoToDelete(null);
            // Refresh table on current page
            await fetchWorkOrders(currentPage, pageSize, activeSearch);
        } catch (error: any) {
            showToast(error.message || 'Failed to delete work order', 'error');
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.headerRow}>
                <div className={styles.headerContent}>
                    <h2><Settings size={28} /> Work Order Management</h2>
                    <p>Track production work orders</p>
                </div>
            </div>

            <div className={styles.card}>
                <div className={styles.cardHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <h3 style={{ margin: 0 }}><Calendar size={20} /> Work Order Records</h3>

                    {/* Search Work Order */}
                    <div className={styles.searchSection}>
                        <div className={styles.searchWrapper}>
                            <Search size={16} className={styles.searchIcon} />
                            <input
                                type="text"
                                placeholder="Enter Work Order Number..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleSearch();
                                    }
                                }}
                                disabled={isLoading}
                                className={styles.searchInput}
                            />
                        </div>
                        <button
                            type="button"
                            className={styles.searchBtn}
                            onClick={handleSearch}
                            disabled={isLoading}
                        >
                            <Search size={14} /> Search
                        </button>
                        {(activeSearch || searchQuery) && (
                            <button
                                type="button"
                                className={styles.clearBtn}
                                onClick={handleClearSearch}
                                disabled={isLoading}
                            >
                                <X size={14} /> Clear
                            </button>
                        )}
                    </div>
                </div>

                <div className={styles.tableContainer}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>WO NUMBER</th>
                                <th>QTY</th>
                                <th>CUSTOMER</th>
                                <th>MODEL</th>
                                <th>CREATED BY</th>
                                <th>DATE</th>
                                <th>ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
                                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.6rem' }}>
                                            <span className={styles.spinner} />
                                            <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>Loading work orders...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : workOrders.length > 0 ? (
                                workOrders.map((wo) => (
                                    <tr key={wo.id}>
                                        <td style={{ fontWeight: 'bold', color: '#4f46e5' }}>{wo.wo_number}</td>
                                        <td>{wo.quantity}</td>
                                        <td>{wo.customer_name}</td>
                                        <td>
                                            <span style={{
                                                padding: '4px 8px',
                                                backgroundColor: '#eef2ff',
                                                color: '#4338ca',
                                                borderRadius: '6px',
                                                fontSize: '0.8rem',
                                                fontWeight: 'bold'
                                            }}>
                                                {wo.model}
                                            </span>
                                        </td>
                                        <td>{wo.created_by}</td>
                                        <td>{new Date(wo.created_at).toLocaleDateString()}</td>
                                        <td>
                                            <div className={styles.actions}>
                                                <button
                                                    type="button"
                                                    className={smtStyles.secondaryButton} 
                                                    onClick={() => handleView(wo)}
                                                >
                                                    <Eye size={14} /> View
                                                </button>

                                                {canDelete && (
                                                    <button
                                                        type="button"
                                                        className={styles.deleteBtn}
                                                        onClick={() => handleDeleteClick(wo)}
                                                    >
                                                        <Trash2 size={14} /> Delete
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: '#9ca3af' }}>
                                        {activeSearch ? (
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '1rem', color: '#4b5563', marginBottom: '0.25rem' }}>
                                                    No Work Orders found matching "{activeSearch}"
                                                </div>
                                                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                                    Try entering a different Work Order Number or click Clear.
                                                </div>
                                            </div>
                                        ) : (
                                            'No records found.'
                                        )}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {totalRecords > 0 && (
                    <div className={styles.paginationSection}>
                        <div className={styles.paginationInfo}>
                            Showing {workOrders.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, totalRecords)} of {totalRecords} Work Orders
                            {activeSearch && (
                                <span style={{ marginLeft: '0.5rem', color: '#4f46e5', fontWeight: 600 }}>
                                    (filtered by "{activeSearch}")
                                </span>
                            )}
                        </div>

                        <div className={styles.paginationControls}>
                            {/* Page size selection */}
                            <select
                                value={pageSize}
                                onChange={(e) => handlePageSizeChange(parseInt(e.target.value, 10))}
                                disabled={isLoading}
                                className={styles.pageSizeSelect}
                                aria-label="Work orders per page"
                            >
                                <option value={10}>10 per page</option>
                                <option value={20}>20 per page</option>
                                <option value={50}>50 per page</option>
                                <option value={100}>100 per page</option>
                            </select>

                            {/* Previous button */}
                            <button
                                type="button"
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1 || isLoading}
                                className={styles.navBtn}
                            >
                                <ChevronLeft size={16} /> Previous
                            </button>

                            {/* Page numbers with ellipsis */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                {getPageNumbers(currentPage, totalPages).map((p, idx) => {
                                    if (p === '...') {
                                        return (
                                            <span key={`ellipsis-${idx}`} className={styles.ellipsis}>
                                                ...
                                            </span>
                                        );
                                    }
                                    const isCurrent = p === currentPage;
                                    return (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => handlePageChange(p as number)}
                                            disabled={isLoading}
                                            className={`${styles.pageNumberBtn} ${isCurrent ? styles.activePageNumber : ''}`}
                                        >
                                            {p}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Next button */}
                            <button
                                type="button"
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages || totalPages === 0 || isLoading}
                                className={styles.navBtn}
                            >
                                Next <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* View Details Dialog */}
            {selectedWO && (
                <div className={smtStyles.modalOverlay} onClick={() => setSelectedWO(null)}>
                    <div className={smtStyles.modalContent} style={{ maxWidth: '850px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
                        <div className={smtStyles.modalHeader}>
                            <h4 className={smtStyles.modalTitle} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.2rem' }}>
                                🔍 Work Order Details - {selectedWO.wo_number}
                            </h4>
                            <button className={smtStyles.modalCloseBtn} onClick={() => setSelectedWO(null)}>
                                ❌
                            </button>
                        </div>
                        <div className={smtStyles.modalBody} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem' }}>
                            <div className={smtStyles.detailGrid}>
                                
                                {/* Work Order Information */}
                                <div className={`${smtStyles.detailCard} ${smtStyles.detailCardFullWidth}`}>
                                    <div className={smtStyles.detailCardHeader}>
                                        📋 Work Order Information
                                    </div>
                                    <div className={smtStyles.detailItemGrid}>
                                        <div className={smtStyles.detailItem}>
                                            <span className={smtStyles.detailLabel}>Work Order ID</span>
                                            <span className={smtStyles.detailValue} style={{ fontWeight: 600 }}>{selectedWO.wo_number}</span>
                                        </div>
                                        <div className={smtStyles.detailItem}>
                                            <span className={smtStyles.detailLabel}>PO ID</span>
                                            <span className={smtStyles.detailValue}>{selectedWO.po_id || '-'}</span>
                                        </div>
                                        <div className={smtStyles.detailItem}>
                                            <span className={smtStyles.detailLabel}>Product Name</span>
                                            <span className={smtStyles.detailValue}>{selectedWO.product_name || '-'}</span>
                                        </div>
                                        <div className={smtStyles.detailItem}>
                                            <span className={smtStyles.detailLabel}>Number of Sides</span>
                                            <span className={smtStyles.detailValue}>{selectedWO.sides || '-'}</span>
                                        </div>
                                        <div className={smtStyles.detailItem}>
                                            <span className={smtStyles.detailLabel}>Quantity</span>
                                            <span className={smtStyles.detailValue}>{selectedWO.quantity} units</span>
                                        </div>
                                        <div className={smtStyles.detailItem}>
                                            <span className={smtStyles.detailLabel}>Customer Name</span>
                                            <span className={smtStyles.detailValue} style={{ fontWeight: 600 }}>{selectedWO.customer_name || '-'}</span>
                                        </div>
                                        <div className={smtStyles.detailItem}>
                                            <span className={smtStyles.detailLabel}>Model Name</span>
                                            <span className={smtStyles.detailValue} style={{ fontWeight: 600 }}>{selectedWO.model || '-'}</span>
                                        </div>
                                        <div className={`${smtStyles.detailItem} ${smtStyles.detailItemFullWidth}`} style={{ marginTop: '0.5rem' }}>
                                            <span className={smtStyles.detailLabel}>Process Routing / Stages</span>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.25rem' }}>
                                                {(() => {
                                                    let stages: string[] = [];
                                                    if (Array.isArray(selectedWO.selected_stages)) {
                                                        stages = selectedWO.selected_stages;
                                                    } else if (typeof selectedWO.selected_stages === 'string') {
                                                        try {
                                                            const parsed = JSON.parse(selectedWO.selected_stages);
                                                            if (Array.isArray(parsed)) {
                                                                stages = parsed;
                                                            } else {
                                                                stages = ALL_STAGES;
                                                            }
                                                        } catch (e) {
                                                            stages = ALL_STAGES;
                                                        }
                                                    } else if (selectedWO.selected_stages === null || selectedWO.selected_stages === undefined) {
                                                        stages = ALL_STAGES;
                                                    }

                                                    if (stages.length === 0) {
                                                        return <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>No stages configured</span>;
                                                    }

                                                    // Always display in canonical process order
                                                    const sorted = [...stages].sort(
                                                        (a, b) => {
                                                            const idxA = ALL_STAGES.indexOf(a);
                                                            const idxB = ALL_STAGES.indexOf(b);
                                                            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                                                            if (idxA !== -1) return -1;
                                                            if (idxB !== -1) return 1;
                                                            return 0;
                                                        }
                                                    );
                                                    return sorted.map((st: string) => (
                                                        <span key={st} style={{
                                                            padding: '2px 8px',
                                                            borderRadius: '4px',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 600,
                                                            backgroundColor: '#eff6ff',
                                                            color: '#1d4ed8',
                                                            border: '1px solid #bfdbfe'
                                                        }}>
                                                            {st}
                                                        </span>
                                                    ));
                                                })()}
                                            </div>
                                        </div>
                                        <div className={`${smtStyles.detailItem} ${smtStyles.detailItemFullWidth}`} style={{ marginTop: '0.5rem' }}>
                                            <span className={smtStyles.detailLabel}>Product Description</span>
                                            <span className={smtStyles.detailValue} style={{ whiteSpace: 'pre-wrap' }}>
                                                {selectedWO.product_description || '-'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Production Information */}
                                <div className={`${smtStyles.detailCard} ${smtStyles.detailCardFullWidth}`}>
                                    <div className={smtStyles.detailCardHeader}>
                                        ⚙️ Production Information
                                    </div>
                                    <div className={smtStyles.detailItemGrid}>
                                        <div className={smtStyles.detailItem}>
                                            <span className={smtStyles.detailLabel}>Line ID</span>
                                            <span className={smtStyles.detailValue}>{selectedWO.line_id || 'SMT-1'}</span>
                                        </div>
                                        <div className={smtStyles.detailItem}>
                                            <span className={smtStyles.detailLabel}>Priority</span>
                                            <div>
                                                <span style={{
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 'bold',
                                                    backgroundColor: selectedWO.priority === 'high' ? '#fee2e2' : selectedWO.priority === 'medium' ? '#fef3c7' : '#e0e7ff',
                                                    color: selectedWO.priority === 'high' ? '#991b1b' : selectedWO.priority === 'medium' ? '#92400e' : '#3730a3'
                                                }}>
                                                    {(selectedWO.priority || 'MEDIUM').toUpperCase()}
                                                </span>
                                            </div>
                                        </div>
                                        <div className={smtStyles.detailItem}>
                                            <span className={smtStyles.detailLabel}>Current Solder Paste Status</span>
                                            <span className={smtStyles.detailValue}>
                                                <span style={{
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 'bold',
                                                    backgroundColor: selectedWO.solder_paste_status === 'Completed' ? '#d1fae5' : selectedWO.solder_paste_status === 'In Progress' ? '#dbeafe' : '#f3f4f6',
                                                    color: selectedWO.solder_paste_status === 'Completed' ? '#065f46' : selectedWO.solder_paste_status === 'In Progress' ? '#1e40af' : '#374151'
                                                }}>
                                                    {selectedWO.solder_paste_status || 'Pending'}
                                                </span>
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Audit Information */}
                                <div className={`${smtStyles.detailCard} ${smtStyles.detailCardFullWidth}`}>
                                    <div className={smtStyles.detailCardHeader}>
                                        🛡️ Audit Information
                                    </div>
                                    <div className={smtStyles.detailItemGrid}>
                                        <div className={smtStyles.detailItem}>
                                            <span className={smtStyles.detailLabel}>Created By</span>
                                            <span className={smtStyles.detailValue}>{selectedWO.created_by || 'System Admin'}</span>
                                        </div>
                                        <div className={smtStyles.detailItem}>
                                            <span className={smtStyles.detailLabel}>Date Created</span>
                                            <span className={smtStyles.detailValue}>
                                                {new Date(selectedWO.created_at).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className={smtStyles.detailItem}>
                                            <span className={smtStyles.detailLabel}>Last Updated By</span>
                                            <span className={smtStyles.detailValue} style={{ color: '#9ca3af' }}>{selectedWO.updated_by || 'N/A'}</span>
                                        </div>
                                        <div className={smtStyles.detailItem}>
                                            <span className={smtStyles.detailLabel}>Last Updated Date</span>
                                            <span className={smtStyles.detailValue} style={{ color: '#9ca3af' }}>
                                                {selectedWO.updated_at ? new Date(selectedWO.updated_at).toLocaleString() : 'N/A'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Additional Information */}
                                <div className={`${smtStyles.detailCard} ${smtStyles.detailCardFullWidth}`}>
                                    <div className={smtStyles.detailCardHeader}>
                                        📝 Additional Information
                                    </div>
                                    <div className={smtStyles.detailItem}>
                                        <span className={smtStyles.detailLabel}>Remarks</span>
                                        <div style={{
                                            marginTop: '6px',
                                            color: '#374151',
                                            whiteSpace: 'pre-wrap',
                                            backgroundColor: '#f1f5f9',
                                            padding: '0.75rem',
                                            borderRadius: '6px',
                                            border: '1px solid #e2e8f0',
                                            fontSize: '0.9rem'
                                        }}>
                                            {selectedWO.remark || '-'}
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>
                        <div className={smtStyles.modalFooter} style={{ padding: '1rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
                            <button className={smtStyles.secondaryButton} onClick={() => setSelectedWO(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Modal */}
            {woToDelete && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <h2>Confirm Delete</h2>
                        </div>
                        <div className={styles.modalContent}>
                            <p>Are you sure you want to delete <strong>{woToDelete.wo_number}</strong>?</p>
                        </div>
                        <div className={styles.modalFooter}>
                            <button className={styles.closeBtn} onClick={() => setWoToDelete(null)}>Cancel</button>
                            <button className={styles.confirmDeleteBtn} onClick={handleConfirmDelete}>Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WorkOrder;
