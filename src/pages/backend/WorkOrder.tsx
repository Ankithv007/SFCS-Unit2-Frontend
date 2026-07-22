import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import { checkDeletePermission } from '../../utils/security';
import styles from './WorkOrder.module.css';
import sharedStyles from '../smt/work-order/WorkOrder.module.css';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../hooks/useAuth';
import {
    Settings,
    Calendar,
    Package,
    Hash,
    Building2,
    Eye,
    Trash2,
    X
} from 'lucide-react';

interface WorkOrderRecord {
    id: number;
    wo_number: string;
    quantity: number;
    customer_name: string;
    model: string;
    created_by: string;
    created_at: string;
}

const WorkOrder: React.FC = () => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [workOrders, setWorkOrders] = useState<WorkOrderRecord[]>([]);

    // Form State
    const [userSequence, setUserSequence] = useState('');
    const [quantity, setQuantity] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [selectedModel, setSelectedModel] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

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

    const handleCreateWorkOrder = async (e: React.FormEvent) => {
        e.preventDefault();

        const finalWONumber = userSequence.trim().toUpperCase();
        if (!finalWONumber) {
            showToast('Work Order ID is required.', 'error');
            return;
        }
        if (finalWONumber.length < 3 || finalWONumber.length > 50) {
            showToast('Work Order ID must be between 3 and 50 characters.', 'error');
            return;
        }
        if (!/^[A-Z0-9\-_]+$/.test(finalWONumber)) {
            showToast('Work Order ID can only contain letters, numbers, hyphens (-), and underscores (_).', 'error');
            return;
        }

        if (!quantity || parseInt(quantity) <= 0) {
            showToast('Please enter a valid quantity', 'error');
            return;
        }
        if (!customerName.trim()) {
            showToast('Customer name is required', 'error');
            return;
        }

        if (workOrders.some(wo => wo.wo_number.toUpperCase() === finalWONumber)) {
            showToast('Work Order number already exists', 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                wo_number: finalWONumber,
                quantity: parseInt(quantity),
                customer_name: customerName,
                model: selectedModel,
                created_by: user?.name || 'Unknown'
            };

            await apiFetch('/api/backend/work-order', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            showToast('Work Order created successfully', 'success');

            // Reset form
            setUserSequence('');
            setQuantity('');
            setCustomerName('');
            setSelectedModel('');

            // 🔥 REFRESH TABLE
            await fetchWorkOrders();
        } catch (error: any) {
            showToast(error.message || 'Failed to create work order', 'error');
        } finally {
            setIsSubmitting(false);
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
                    <p>Generate and track production work orders</p>
                </div>
            </div>

            <div className={styles.card}>
                <div className={styles.cardHeader}>
                    <h3><Package size={20} /> Create New Work Order</h3>
                </div>
                <form onSubmit={handleCreateWorkOrder}>
                    <div className={styles.formGrid}>
                        <div className={styles.inputGroup}>
                            <label><Hash size={14} /> Work Order ID *</label>
                            <input
                                type="text"
                                className={styles.input}
                                value={userSequence}
                                onChange={(e) => setUserSequence(e.target.value)}
                                placeholder="e.g. WO2026060200016"
                                required
                                spellCheck={false}
                                autoComplete="off"
                                autoCorrect="off"
                                autoCapitalize="none"
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label><Building2 size={14} /> Customer Name *</label>
                            <input
                                type="text"
                                className={styles.input}
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                placeholder="Enter customer name"
                                required
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label><Package size={14} /> Quantity *</label>
                            <input
                                type="number"
                                className={styles.input}
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                placeholder="Qty"
                                min="1"
                                required
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label><Settings size={14} /> Model *</label>
                            <input
                                type="text"
                                className={styles.input}
                                value={selectedModel}
                                onChange={(e) => setSelectedModel(e.target.value)}
                                placeholder="Enter model name..."
                                required
                            />
                        </div>
                    </div>
                    <button type="submit" className={styles.button} disabled={isSubmitting}>
                        {isSubmitting ? 'Creating...' : 'Create Work Order'}
                    </button>
                </form>
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
                                                    className={sharedStyles.secondaryButton} onClick={() => handleView(wo)}
                                                >
                                                    <Eye size={14} /> View
                                                </button>

                                                <button
                                                    type="button"
                                                    className={styles.deleteBtn}
                                                    onClick={() => handleDeleteClick(wo)}
                                                >
                                                    <Trash2 size={14} /> Delete
                                                </button>

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

            {/* View Modal */}
            {selectedWO && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <h2>Details</h2>
                            <button onClick={() => setSelectedWO(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className={styles.modalContent}>
                            <div className={styles.detailRow}>
                                <span className={styles.detailLabel}>WO Number:</span>
                                <span className={styles.detailValue}>{selectedWO.wo_number}</span>
                            </div>
                            <div className={styles.detailRow}>
                                <span className={styles.detailLabel}>Customer:</span>
                                <span className={styles.detailValue}>{selectedWO.customer_name}</span>
                            </div>
                            <div className={styles.detailRow}>
                                <span className={styles.detailLabel}>Quantity:</span>
                                <span className={styles.detailValue}>{selectedWO.quantity}</span>
                            </div>
                            <div className={styles.detailRow}>
                                <span className={styles.detailLabel}>Model:</span>
                                <span className={styles.detailValue}>{selectedWO.model}</span>
                            </div>
                            <div className={styles.detailRow}>
                                <span className={styles.detailLabel}>Created By:</span>
                                <span className={styles.detailValue}>{selectedWO.created_by}</span>
                            </div>
                            <div className={styles.detailRow}>
                                <span className={styles.detailLabel}>Created At:</span>
                                <span className={styles.detailValue}>{new Date(selectedWO.created_at).toLocaleString()}</span>
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <button className={styles.closeBtn} onClick={() => setSelectedWO(null)}>Close</button>
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
