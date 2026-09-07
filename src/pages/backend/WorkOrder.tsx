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
    Trash2
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

    const canDelete = user?.role === 'Super Admin';

    // Modal States
    const [selectedWO, setSelectedWO] = useState<WorkOrderRecord | null>(null);
    const [woToDelete, setWoToDelete] = useState<WorkOrderRecord | null>(null);

    useEffect(() => {
        fetchWorkOrders();
    }, []);

    const fetchWorkOrders = async () => {
        try {
            console.log("Fetching Work Orders...");
            const data = await apiFetch('/api/backend/work-order');
            setWorkOrders(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error fetching work orders:', error);
            showToast('Failed to load work orders', 'error');
        }
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
            // 🔥 REFRESH TABLE
            await fetchWorkOrders();
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
                <div className={styles.cardHeader}>
                    <h3><Calendar size={20} /> Work Order Records</h3>
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
                            {workOrders.length > 0 ? (
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
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                                        No records found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
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
                                                    let stages: string[] = ALL_STAGES;
                                                    if (Array.isArray(selectedWO.selected_stages)) {
                                                        stages = selectedWO.selected_stages;
                                                    } else if (typeof selectedWO.selected_stages === 'string') {
                                                        try {
                                                            stages = JSON.parse(selectedWO.selected_stages);
                                                        } catch (e) {
                                                            stages = ALL_STAGES;
                                                        }
                                                    }
                                                    // Always display in canonical process order
                                                    const sorted = [...stages].sort(
                                                        (a, b) => ALL_STAGES.indexOf(a) - ALL_STAGES.indexOf(b)
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
