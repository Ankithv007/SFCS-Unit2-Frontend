import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from './MaterialReturnBomView.module.css';
import { 
    ArrowLeft, RefreshCw, Save, Search, FileSpreadsheet, X
} from 'lucide-react';

interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
}

interface BomItem {
    material_management_item_id: string;
    sl_no: string;
    vepl_part_no: string;
    description: string;
    manufacturer: string;
    mfr_part_no: string;
    qty_per_product: number;
    required_qty: number;
    issued_qty: number;
    return_qty: number;
    delta_qty: number;
    remarks: string | null;
}

interface RecordDetails {
    id: string;
    work_order_id: string;
    work_order_number: string;
    po_number: string | null;
    product_name: string | null;
    product_description: string | null;
    quantity: number;
    current_bom_revision: string;
    status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CLOSED';
    remarks: string | null;
    created_by: string;
    created_at: string;
}

const Toaster: React.FC<{ toasts: Toast[]; onRemove: (id: number) => void }> = ({ toasts, onRemove }) => (
    <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 9999, display: 'flex', flexDirection: 'column-reverse', gap: '0.5rem' }}>
        {toasts.map(t => (
            <div key={t.id} onClick={() => onRemove(t.id)} style={{
                padding: '0.85rem 1.25rem', borderRadius: '0.6rem', cursor: 'pointer', minWidth: '280px',
                background: t.type === 'error' ? '#fee2e2' : t.type === 'success' ? '#dcfce7' : '#fffbeb',
                color: t.type === 'error' ? '#991b1b' : t.type === 'success' ? '#166534' : '#92400e',
                border: `1px solid ${t.type === 'error' ? '#fca5a5' : t.type === 'success' ? '#86efac' : '#fde68a'}`,
                fontWeight: 600, fontSize: '0.9rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                animation: 'slideIn 0.2s ease'
            }}>
                {t.type === 'error' ? '❌ ' : t.type === 'success' ? '✅ ' : 'ℹ️ '}{t.message}
            </div>
        ))}
    </div>
);

// Performance Optimized Row Component to prevent input lag in large tables
const BomRow: React.FC<{
    item: BomItem;
    onQtyChange: (itemId: string, newQty: number) => void;
    onEditRemark: (item: BomItem) => void;
}> = React.memo(({ item, onQtyChange, onEditRemark }) => {
    const [inputValue, setInputValue] = useState<string>(item.return_qty.toString());

    // Keep input synced if props update
    useEffect(() => {
        setInputValue(item.return_qty.toString());
    }, [item.return_qty]);

    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setInputValue(val);
        const parsed = parseFloat(val);
        if (!isNaN(parsed) && parsed >= 0) {
            onQtyChange(item.material_management_item_id, parsed);
        } else if (val === '') {
            onQtyChange(item.material_management_item_id, 0);
        }
    };

    const handleBlur = () => {
        const parsed = parseFloat(inputValue);
        if (isNaN(parsed) || parsed < 0) {
            setInputValue('0');
            onQtyChange(item.material_management_item_id, 0);
        } else {
            setInputValue(parsed.toString());
        }
    };

    const parsedReturn = parseFloat(inputValue) || 0;
    const isError = parsedReturn > item.issued_qty;
    const delta = item.issued_qty - parsedReturn;

    return (
        <tr>
            <td style={{ textAlign: 'center', fontWeight: '500' }}>{item.sl_no || '-'}</td>
            <td className={styles.partNo}>{item.vepl_part_no || '-'}</td>
            <td className={styles.description}>{item.description || '-'}</td>
            <td className={styles.preLine}>{item.manufacturer || '-'}</td>
            <td className={styles.preLine}>{item.mfr_part_no || '-'}</td>
            <td className={styles.number}>{Number(item.qty_per_product).toFixed(4)}</td>
            <td className={styles.number}>{Number(item.required_qty).toFixed(4)}</td>
            <td className={`${styles.number} ${styles.semibold}`}>{Number(item.issued_qty).toFixed(4)}</td>
            <td className={styles.inputCol}>
                <input
                    type="number"
                    step="any"
                    min="0"
                    value={inputValue}
                    onChange={handleTextChange}
                    onBlur={handleBlur}
                    className={`${styles.rowInput} ${isError ? styles.rowInputError : ''}`}
                    title={isError ? "Return Qty cannot exceed Issued Qty" : ""}
                />
            </td>
            <td className={`${styles.number} ${styles.semibold} ${delta < 0 ? styles.deltaNegative : delta > 0 ? styles.deltaPositive : styles.deltaZero}`}>
                {delta.toFixed(4)}
            </td>
            <td>
                <button
                    type="button"
                    onClick={() => onEditRemark(item)}
                    className={item.remarks ? styles.rowRemarkBtnFilled : styles.rowRemarkBtn}
                >
                    {item.remarks ? 'View/Edit Remark' : 'Edit Remark'}
                </button>
            </td>
        </tr>
    );
});

const MaterialReturnBomView: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    // Toasts
    const [toasts, setToasts] = useState<Toast[]>([]);
    const toastId = useRef(0);
    const addToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        const id = toastId.current++;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    };

    // States
    const [recordDetails, setRecordDetails] = useState<RecordDetails | null>(null);
    const [bomItems, setBomItems] = useState<BomItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Save states
    const [generalRemarks, setGeneralRemarks] = useState('');
    const [selectedStatus, setSelectedStatus] = useState<'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CLOSED'>('DRAFT');

    // Local BOM search query state
    const [searchQuery, setSearchQuery] = useState('');
    const [loadError, setLoadError] = useState<string | null>(null);

    // Modal state for active row remark edit
    const [activeRemarkItem, setActiveRemarkItem] = useState<{
        itemId: string;
        slNo: string;
        partNo: string;
        remarks: string;
    } | null>(null);

    // Fetch Details & BOM Items
    const fetchData = async () => {
        setIsLoading(true);
        setLoadError(null);
        try {
            const token = localStorage.getItem('auth_token') || '';
            
            // Get record metadata details
            const detailRes = await fetch(`/api/smt/material-return/records/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!detailRes.ok) {
                const errData = await detailRes.json().catch(() => ({}));
                throw new Error(errData.error || 'Material Return Record Not Found');
            }
            const detailData = await detailRes.json();
            setRecordDetails(detailData);
            setGeneralRemarks(detailData.remarks || '');
            setSelectedStatus(detailData.status);

            // Get BOM items
            const bomRes = await fetch(`/api/smt/material-return/records/${id}/bom`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!bomRes.ok) {
                const errData = await bomRes.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed To Load Return BOM Data');
            }
            const bomData = await bomRes.json();
            
            if (!bomData.items) {
                throw new Error('No Return BOM Components Found');
            }
            setBomItems(bomData.items);

        } catch (err: any) {
            setLoadError(err.message);
            addToast(err.message || 'Error loading page data.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [id]);

    // Handle change of return quantity in optimized callback
    const handleQtyChange = React.useCallback((itemId: string, newQty: number) => {
        setBomItems(prev => {
            return prev.map(item => {
                if (item.material_management_item_id === itemId) {
                    return {
                        ...item,
                        return_qty: newQty,
                        delta_qty: item.issued_qty - newQty
                    };
                }
                return item;
            });
        });
    }, []);

    // Handle change of row remarks
    const handleRemarksChange = React.useCallback((itemId: string, remarksVal: string) => {
        setBomItems(prev => {
            return prev.map(item => {
                if (item.material_management_item_id === itemId) {
                    return {
                        ...item,
                        remarks: remarksVal
                    };
                }
                return item;
            });
        });
    }, []);

    // Summary calculations
    const summary = React.useMemo(() => {
        const totalComponents = bomItems.length;
        let totalIssued = 0;
        let totalReturn = 0;
        let totalDelta = 0;

        bomItems.forEach(item => {
            totalIssued += parseFloat(item.issued_qty as any || 0);
            totalReturn += parseFloat(item.return_qty as any || 0);
            totalDelta += (parseFloat(item.issued_qty as any || 0) - parseFloat(item.return_qty as any || 0));
        });

        return {
            totalComponents,
            totalIssued,
            totalReturn,
            totalDelta
        };
    }, [bomItems]);

    // Validation: Check if any item's return quantity exceeds issued quantity
    const hasValidationError = React.useMemo(() => {
        return bomItems.some(item => (parseFloat(item.return_qty as any) || 0) > parseFloat(item.issued_qty as any));
    }, [bomItems]);

    // Save Action
    const handleSave = async (targetStatus: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CLOSED') => {
        if (!recordDetails) return;

        if (hasValidationError) {
            addToast('Return Qty cannot exceed Issued Qty.', 'error');
            return;
        }

        setIsSaving(true);
        try {
            const token = localStorage.getItem('auth_token') || '';
            const response = await fetch(`/api/smt/material-return/records/${id}/bom`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    items: bomItems,
                    remarks: generalRemarks,
                    status: targetStatus
                })
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Failed to save return BOM quantities.');
            }

            addToast(result.message || 'Quantities saved successfully.', 'success');
            
            // Refresh details/BOM state
            fetchData();
        } catch (err: any) {
            addToast(err.message || 'Error occurred while saving.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownloadExcel = async () => {
        if (!recordDetails) return;
        try {
            const token = localStorage.getItem('auth_token') || '';
            const response = await fetch(`/api/smt/material-return/records/${id}/export/excel`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to download Excel report.');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Material_Return_Report_${recordDetails.work_order_number}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            addToast('Excel report downloaded successfully.', 'success');
        } catch (err: any) {
            addToast(err.message || 'Failed to download report.', 'error');
        }
    };

    // Filter BOM items by search query
    const filteredBomItems = bomItems.filter(item => 
        (item.vepl_part_no && item.vepl_part_no.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.manufacturer && item.manufacturer.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.mfr_part_no && item.mfr_part_no.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    if (isLoading) {
        return (
            <div className={styles.loadingContainer}>
                <RefreshCw size={36} className={styles.spinner} />
                <h3 style={{ margin: 0, fontWeight: 600 }}>Loading Return BOM Workspace...</h3>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>Synchronizing BOM items from Material Requests.</p>
            </div>
        );
    }

    if (loadError || !recordDetails) {
        return (
            <div className={styles.errorContainer}>
                <h3>Error Loading Return Workspace</h3>
                <p>{loadError || 'Workspace metadata is missing.'}</p>
                <button onClick={() => navigate('/smt/material-management/return')} className={`${styles.button} ${styles.btnSecondary}`}>
                    <ArrowLeft size={16} style={{ marginRight: '0.5rem' }} /> Back to Return List
                </button>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <Toaster toasts={toasts} onRemove={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />

            {/* Top Workspace Header */}
            <div className={styles.header}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button className={styles.backBtn} onClick={() => navigate('/smt/material-management/return')} title="Back to Dashboard">
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h2>Work With Return BOM — {recordDetails.work_order_number}</h2>
                        <p style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                            <span>Product: <strong>{recordDetails.product_name}</strong></span>
                            <span>|</span>
                            <span>Quantity: <strong>{recordDetails.quantity}</strong></span>
                            <span>|</span>
                            <span>BOM Revision: <span className={styles.revTag}>Rev {recordDetails.current_bom_revision || '1.1'}</span></span>
                        </p>
                    </div>
                </div>

                <div className={styles.actions}>
                    {/* Status Dropdown */}
                    <div className={styles.statusSelectWrapper}>
                        <span>Status:</span>
                        <select 
                            value={selectedStatus} 
                            onChange={(e) => setSelectedStatus(e.target.value as any)} 
                            className={styles.statusSelect}
                        >
                            <option value="DRAFT">DRAFT</option>
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="COMPLETED">COMPLETED</option>
                            <option value="CLOSED">CLOSED</option>
                        </select>
                    </div>

                    <button 
                        onClick={() => handleSave(selectedStatus)} 
                        className={styles.btnPrimary} 
                        disabled={isSaving || hasValidationError}
                    >
                        <Save size={16} /> Save Changes
                    </button>

                    <button onClick={handleDownloadExcel} className={styles.btnSecondary}>
                        <FileSpreadsheet size={16} /> Excel Report
                    </button>
                </div>
            </div>

            {/* Summary Cards Grid */}
            <div className={styles.summaryGrid}>
                <div className={styles.summaryCard} style={{ borderLeft: '4px solid #6366f1' }}>
                    <span className={styles.summaryLabel}>Total Components</span>
                    <span className={styles.summaryVal}>{summary.totalComponents}</span>
                </div>
                <div className={styles.summaryCard} style={{ borderLeft: '4px solid #4f46e5' }}>
                    <span className={styles.summaryLabel}>Total Issued Qty</span>
                    <span className={styles.summaryVal}>
                        {summary.totalIssued.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>
                <div className={styles.summaryCard} style={{ borderLeft: '4px solid #16a34a' }}>
                    <span className={styles.summaryLabel}>Total Return Qty</span>
                    <span className={styles.summaryVal} style={{ color: hasValidationError ? '#ef4444' : '#16a34a' }}>
                        {summary.totalReturn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>
                <div className={styles.summaryCard} style={{ borderLeft: '4px solid #2563eb' }}>
                    <span className={styles.summaryLabel}>Total Delta Qty</span>
                    <span className={styles.summaryVal}>
                        {summary.totalDelta.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>
            </div>

            {/* Remarks Input */}
            <div className={styles.card} style={{ marginBottom: '1.25rem', padding: '1rem 1.25rem' }}>
                <div className={styles.inputGroup}>
                    <label>Master Material Return Remarks</label>
                    <input
                        type="text"
                        value={generalRemarks}
                        onChange={(e) => setGeneralRemarks(e.target.value)}
                        placeholder="Enter master-level remarks or notes for this material return..."
                        className={styles.remarksInput}
                    />
                </div>
            </div>

            {/* BOM Table Workspace */}
            <div className={styles.card} style={{ padding: 0, overflow: 'hidden' }}>
                <div className={styles.tableHeaderArea}>
                    <div className={styles.searchWrapper}>
                        <Search className={styles.searchIcon} size={16} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Filter return components by part number, description or manufacturer..."
                            className={styles.searchInput}
                        />
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>
                        Showing {filteredBomItems.length} of {bomItems.length} components
                    </div>
                </div>

                <div className={styles.tableContainer}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th style={{ width: '60px', textAlign: 'center' }}>Sl No</th>
                                <th style={{ width: '160px' }}>VEPL Part No</th>
                                <th>Description</th>
                                <th>Manufacturer</th>
                                <th>Mfr. Part No</th>
                                <th style={{ width: '100px', textAlign: 'right' }}>Qty/Prod</th>
                                <th style={{ width: '110px', textAlign: 'right' }}>Required Qty</th>
                                <th style={{ width: '110px', textAlign: 'right' }}>Issued Qty</th>
                                <th style={{ width: '130px', textAlign: 'right' }}>Return Qty</th>
                                <th style={{ width: '110px', textAlign: 'right' }}>Delta Qty</th>
                                <th style={{ width: '150px' }}>Remarks</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredBomItems.map(item => (
                                <BomRow 
                                    key={item.material_management_item_id}
                                    item={item}
                                    onQtyChange={handleQtyChange}
                                    onEditRemark={(selectedItem) => {
                                        setActiveRemarkItem({
                                            itemId: selectedItem.material_management_item_id,
                                            slNo: selectedItem.sl_no,
                                            partNo: selectedItem.vepl_part_no,
                                            remarks: selectedItem.remarks || ''
                                        });
                                    }}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Row Remarks Modal Overlay */}
            {activeRemarkItem && (
                <div className={styles.modalOverlay} onClick={() => setActiveRemarkItem(null)}>
                    <div className={styles.modalContentSmall} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3>Edit Remark — Row {activeRemarkItem.slNo}</h3>
                            <button className={styles.closeModalBtn} onClick={() => setActiveRemarkItem(null)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.inputGroup}>
                                <label style={{ marginBottom: '0.5rem', display: 'block', fontWeight: 600 }}>
                                    Remarks for Part {activeRemarkItem.partNo}
                                </label>
                                <textarea
                                    className={styles.textareaLarge}
                                    rows={5}
                                    value={activeRemarkItem.remarks}
                                    onChange={(e) => setActiveRemarkItem({
                                        ...activeRemarkItem,
                                        remarks: e.target.value
                                    })}
                                    placeholder="Enter component return remark..."
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <button
                                className={styles.btnPrimary}
                                onClick={() => {
                                    handleRemarksChange(activeRemarkItem.itemId, activeRemarkItem.remarks);
                                    setActiveRemarkItem(null);
                                }}
                            >
                                Save
                            </button>
                            <button
                                className={styles.btnSecondary}
                                onClick={() => setActiveRemarkItem(null)}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MaterialReturnBomView;
