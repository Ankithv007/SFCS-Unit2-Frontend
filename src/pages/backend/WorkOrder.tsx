import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../../utils/api';
import styles from './WorkOrder.module.css';
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

const MODELS = [
    "2G with IOT",
    "2G without IOT",
    "4G - 3W",
    "4G - SCV",
    "4G - HCV",
    "4G - Mini",
    "2G - E-Rick",
    "4G - E-Tractor",
    "BMS - Telematics"
];

const WorkOrder: React.FC = () => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [workOrders, setWorkOrders] = useState<WorkOrderRecord[]>([]);
    
    // Form State
    const [userSequence, setUserSequence] = useState('');
    const [quantity, setQuantity] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [selectedModel, setSelectedModel] = useState(MODELS[0]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Modal States
    const [selectedWO, setSelectedWO] = useState<WorkOrderRecord | null>(null);
    const [woToDelete, setWoToDelete] = useState<WorkOrderRecord | null>(null);

    // Auto-generated Date Prefix
    const datePrefix = useMemo(() => {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        return `WO${yyyy}${mm}${dd}`;
    }, []);

    useEffect(() => {
        fetchWorkOrders();
    }, []);

    const fetchWorkOrders = async () => {
        try {
            console.log("Fetching Work Orders...");
            const data = await apiFetch('/api/backend/work-order');
            if (data) {
                console.log("Data received:", data);
                setWorkOrders(data);
            }
        } catch (error) {
            console.error('Error fetching work orders:', error);
            showToast('Failed to load work orders', 'error');
        }
    };

    const handleCreateWorkOrder = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!userSequence || userSequence.length < 2 || userSequence.length > 6) {
            showToast('Sequence must be between 2 and 6 digits', 'error');
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

        const fullWONumber = `${datePrefix}${userSequence.padStart(6, '0')}`;
        
        if (workOrders.some(wo => wo.wo_number === fullWONumber)) {
            showToast('Work Order number already exists', 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                wo_number: fullWONumber,
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
            setSelectedModel(MODELS[0]);
            
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



    const isAdmin = ['Admin', 'Super Admin'].includes(user?.role || '');

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
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <div style={{ 
                                    backgroundColor: '#f3f4f6', 
                                    padding: '0.625rem 1rem', 
                                    border: '1px solid #d1d5db',
                                    borderRight: 'none',
                                    borderRadius: '8px 0 0 8px',
                                    color: '#4b5563',
                                    fontWeight: 'bold'
                                }}>
                                    {datePrefix}
                                </div>
                                <input
                                    type="text"
                                    className={styles.input}
                                    style={{ borderRadius: '0 8px 8px 0', flex: 1 }}
                                    value={userSequence}
                                    onChange={(e) => setUserSequence(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder="XXXXXX"
                                    required
                                />
                            </div>
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
                            <select
                                className={styles.select}
                                value={selectedModel}
                                onChange={(e) => setSelectedModel(e.target.value)}
                                required
                            >
                                {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
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
                                                    className={styles.viewBtn} 
                                                    onClick={() => handleView(wo)}
                                                >
                                                    <Eye size={14} /> View
                                                </button>

                                                {isAdmin && (
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
