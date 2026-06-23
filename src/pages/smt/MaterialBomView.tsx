import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from './MaterialBomView.module.css';
import { 
    ArrowLeft, RefreshCw, Save, CheckCircle, Search, FileSpreadsheet
} from 'lucide-react';

interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
}

interface BomItem {
    qms_bom_item_id: number;
    sl_no: string;
    vepl_part_no: string;
    description: string;
    manufacturer: string;
    mfr_part_no: string;
    qty_per_product: number;
    required_qty: number;
    issued_qty: number;
    delta_qty: number;
    is_new?: boolean;
    is_changed?: boolean;
    is_removed?: boolean;
}

interface RecordDetails {
    id: string;
    work_order_id: string;
    work_order_number: string;
    po_number: string | null;
    product_name: string | null;
    product_description: string | null;
    quantity: number;
    production_quantity: number;
    bom_revision_number: string;
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

// Performance Optimized Row Component to prevent input lag in 400+ rows table
const BomRow: React.FC<{
    item: BomItem;
    onQtyChange: (veplPartNo: string, newQty: number) => void;
}> = React.memo(({ item, onQtyChange }) => {
    const [inputValue, setInputValue] = useState<string>(item.issued_qty.toString());

    // Keep input synced if props update
    useEffect(() => {
        setInputValue(item.issued_qty.toString());
    }, [item.issued_qty]);

    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setInputValue(val);
        const parsed = parseFloat(val);
        if (!isNaN(parsed) && parsed >= 0) {
            onQtyChange(item.vepl_part_no, parsed);
        } else if (val === '') {
            onQtyChange(item.vepl_part_no, 0);
        }
    };

    const handleBlur = () => {
        const parsed = parseFloat(inputValue);
        if (isNaN(parsed) || parsed < 0) {
            setInputValue('0');
            onQtyChange(item.vepl_part_no, 0);
        } else {
            setInputValue(parsed.toString());
        }
    };

    const delta = item.required_qty - (parseFloat(inputValue) || 0);

    // Dynamic row classes
    let rowClassName = '';
    if (item.is_new) rowClassName = styles.rowNew;
    else if (item.is_changed) rowClassName = styles.rowChanged;
    else if (item.is_removed) rowClassName = styles.rowRemoved;

    return (
        <tr className={rowClassName}>
            <td style={{ textAlign: 'center', fontWeight: '500' }}>{item.sl_no || '-'}</td>
            <td className={styles.partNo}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {item.vepl_part_no || '-'}
                    {item.is_new && <span className={styles.badgeNew}>New</span>}
                    {item.is_changed && <span className={styles.badgeChanged}>Changed</span>}
                    {item.is_removed && <span className={styles.badgeRemoved}>Removed</span>}
                </div>
            </td>
            <td className={styles.description}>
                {item.description || '-'}
                {item.is_removed && (
                    <div className={styles.removedIndicator}>Removed From Latest BOM</div>
                )}
            </td>
            <td className={styles.preLine}>{item.manufacturer || '-'}</td>
            <td className={styles.preLine}>{item.mfr_part_no || '-'}</td>
            <td className={styles.number}>{item.qty_per_product.toFixed(4)}</td>
            <td className={`${styles.number} ${styles.semibold}`}>{item.required_qty.toFixed(4)}</td>
            <td className={styles.inputCol}>
                <input
                    type="number"
                    step="any"
                    min="0"
                    value={inputValue}
                    onChange={handleTextChange}
                    onBlur={handleBlur}
                    className={styles.rowInput}
                    disabled={item.is_removed}
                />
            </td>
            <td className={`${styles.number} ${styles.semibold} ${delta < 0 ? styles.deltaNegative : delta > 0 ? styles.deltaPositive : styles.deltaZero}`}>
                {delta.toFixed(4)}
            </td>
        </tr>
    );
});

const MaterialBomView: React.FC = () => {
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
    const [isSyncing, setIsSyncing] = useState(false);

    // Save states
    const [generalRemarks, setGeneralRemarks] = useState('');
    const [selectedStatus, setSelectedStatus] = useState<'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CLOSED'>('DRAFT');

    // Revision and Sync States
    const [bomRevisionId, setBomRevisionId] = useState<number | null>(null);
    const [latestBomRevisionId, setLatestBomRevisionId] = useState<number | null>(null);
    const [latestBomRevisionNumber, setLatestBomRevisionNumber] = useState<string>('');
    const [newComponentsCount, setNewComponentsCount] = useState(0);
    const [changedComponentsCount, setChangedComponentsCount] = useState(0);
    const [removedComponentsCount, setRemovedComponentsCount] = useState(0);

    // Local BOM search query state
    const [searchQuery, setSearchQuery] = useState('');
    const [loadError, setLoadError] = useState<string | null>(null);

    // Fetch Details & BOM Items
    const fetchData = async () => {
        setIsLoading(true);
        setLoadError(null);
        try {
            const token = localStorage.getItem('auth_token') || '';
            
            // Get record metadata details
            const detailRes = await fetch(`/api/smt/material-management/records/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!detailRes.ok) {
                const errData = await detailRes.json().catch(() => ({}));
                throw new Error(errData.error || 'Material Management Record Not Found');
            }
            const detailData = await detailRes.json();
            setRecordDetails(detailData);
            setGeneralRemarks(detailData.remarks || '');
            setSelectedStatus(detailData.status);

            // Get BOM items
            const bomRes = await fetch(`/api/smt/material-management/records/${id}/bom`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!bomRes.ok) {
                const errData = await bomRes.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed To Load BOM Data');
            }
            const bomData = await bomRes.json();
            
            if (!bomData.items || bomData.items.length === 0) {
                throw new Error('No BOM Components Found');
            }
            setBomItems(bomData.items);

            // Set sync and revision states
            setBomRevisionId(bomData.bom_revision_id);
            setLatestBomRevisionId(bomData.latest_bom_revision_id);
            setLatestBomRevisionNumber(bomData.latest_bom_revision_number);
            setNewComponentsCount(bomData.newComponentsCount || 0);
            setChangedComponentsCount(bomData.changedComponentsCount || 0);
            setRemovedComponentsCount(bomData.removedComponentsCount || 0);

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

    // Handle change of issued quantity in optimized callback
    const handleQtyChange = React.useCallback((veplPartNo: string, newQty: number) => {
        setBomItems(prev => {
            return prev.map(item => {
                if (item.vepl_part_no === veplPartNo) {
                    return {
                        ...item,
                        issued_qty: newQty,
                        delta_qty: item.required_qty - newQty
                    };
                }
                return item;
            });
        });
    }, []);

    // Summary calculations
    const summary = React.useMemo(() => {
        const totalComponents = bomItems.length;
        let totalRequired = 0;
        let totalIssued = 0;
        let totalDelta = 0;

        bomItems.forEach(item => {
            totalRequired += item.required_qty;
            totalIssued += item.issued_qty;
            totalDelta += (item.required_qty - item.issued_qty);
        });

        return {
            totalComponents,
            totalRequired,
            totalIssued,
            totalDelta
        };
    }, [bomItems]);

    // Sync BOM to Latest active QMS revision
    const handleSyncBom = async () => {
        setIsSyncing(true);
        try {
            const token = localStorage.getItem('auth_token') || '';
            const response = await fetch(`/api/smt/material-management/records/${id}/sync-bom`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Failed to synchronize BOM.');
            }
            addToast('BOM synchronized successfully.', 'success');
            await fetchData();
        } catch (err: any) {
            addToast(err.message || 'Error occurred while synchronizing.', 'error');
        } finally {
            setIsSyncing(false);
        }
    };

    // Save Action
    const handleSave = async (targetStatus: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CLOSED') => {
        if (!recordDetails) return;

        setIsSaving(true);
        try {
            const token = localStorage.getItem('auth_token') || '';
            const response = await fetch(`/api/smt/material-management/records/${id}/bom`, {
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
                throw new Error(result.error || 'Failed to save BOM quantities.');
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

    const handleDownloadExcel = async (recordId: string, workOrderNumber: string) => {
        try {
            const token = localStorage.getItem('auth_token') || '';
            const response = await fetch(`/api/smt/material-management/records/${recordId}/export/excel`, {
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
            a.download = `Material_Report_${workOrderNumber}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            addToast('Excel report downloaded successfully.', 'success');
        } catch (err: any) {
            addToast(err.message || 'Failed to download report.', 'error');
        }
    };

    // Filter BOM items locally
    const filteredBomItems = React.useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return bomItems;
        return bomItems.filter(item => 
            (item.vepl_part_no || '').toLowerCase().includes(query) ||
            (item.description || '').toLowerCase().includes(query) ||
            (item.manufacturer || '').toLowerCase().includes(query) ||
            (item.mfr_part_no || '').toLowerCase().includes(query)
        );
    }, [bomItems, searchQuery]);



    if (isLoading) {
        return (
            <div className={styles.loadingContainer}>
                <RefreshCw className={styles.spinner} size={36} />
                <p>Loading BOM component worksheet...</p>
            </div>
        );
    }

    if (!recordDetails) {
        return (
            <div className={styles.errorContainer}>
                <p>Error: Material Management record not found.</p>
                <button className={styles.btnSecondary} onClick={() => navigate('/smt/material-management/requests')}>
                    <ArrowLeft size={16} /> Back to dashboard
                </button>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <Toaster toasts={toasts} onRemove={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />

            <div className={styles.header}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button className={styles.backBtn} onClick={() => navigate('/smt/material-management/requests')}>
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h2>Work With BOM</h2>
                        <p>Work Order: <strong>{recordDetails.work_order_number}</strong> | PO: <strong>{recordDetails.po_number || 'N/A'}</strong></p>
                    </div>
                </div>
                
                <div className={styles.actions}>
                    <button 
                        className={styles.btnSecondary} 
                        onClick={() => handleDownloadExcel(recordDetails.id, recordDetails.work_order_number)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <FileSpreadsheet size={16} /> Excel
                    </button>

                    <div className={styles.statusSelectWrapper}>
                        <label>Status:</label>
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
                        className={styles.btnSecondary} 
                        onClick={() => handleSave(selectedStatus)} 
                        disabled={isSaving}
                    >
                        <Save size={16} /> {selectedStatus === 'COMPLETED' || selectedStatus === 'CLOSED' ? 'Save Changes' : 'Save Draft'}
                    </button>
                    
                    <button 
                        className={styles.btnPrimary} 
                        onClick={() => handleSave('COMPLETED')} 
                        disabled={isSaving}
                    >
                        <CheckCircle size={16} /> Complete Material Issue
                    </button>
                </div>
            </div>

            {/* BOM Synchronization Banner */}
            {bomRevisionId !== latestBomRevisionId && latestBomRevisionId !== null && (
                <div className={styles.syncBanner}>
                    <div className={styles.syncBannerText}>
                        <div className={styles.syncBannerTitle}>BOM Updated From Document Process (Latest: Rev {latestBomRevisionNumber})</div>
                        <div className={styles.syncBannerInfo}>
                            <span>{changedComponentsCount} Component(s) Changed</span>
                            <span>{newComponentsCount} New Component(s) Added</span>
                            {removedComponentsCount > 0 && <span>{removedComponentsCount} Component(s) Removed</span>}
                        </div>
                    </div>
                    <button className={styles.syncBtn} onClick={handleSyncBom} disabled={isSyncing}>
                        {isSyncing ? 'Refreshing...' : 'Refresh BOM'}
                    </button>
                </div>
            )}

            {/* Material Summary Section */}
            <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Work Order No</span>
                    <span className={styles.summaryVal}>{recordDetails.work_order_number}</span>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>PO Number</span>
                    <span className={styles.summaryVal}>{recordDetails.po_number || 'N/A'}</span>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Product Name</span>
                    <span className={styles.summaryVal}>{recordDetails.product_name || 'N/A'}</span>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Production Qty</span>
                    <span className={styles.summaryVal}>{recordDetails.production_quantity}</span>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Current BOM Revision</span>
                    <span className={styles.summaryVal}>
                        <span className={styles.revTag}>Rev {recordDetails.bom_revision_number || '1.1'}</span>
                    </span>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Total Components</span>
                    <span className={styles.summaryVal}>{summary.totalComponents}</span>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Total Required Qty</span>
                    <span className={styles.summaryVal}>{summary.totalRequired.toFixed(2)}</span>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Total Issued Qty</span>
                    <span className={styles.summaryVal}>{summary.totalIssued.toFixed(2)}</span>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Total Delta Qty</span>
                    <span className={`${styles.summaryVal} ${summary.totalDelta < 0 ? styles.deltaNegative : summary.totalDelta > 0 ? styles.deltaPositive : styles.deltaZero}`}>
                        {summary.totalDelta.toFixed(2)}
                    </span>
                </div>
            </div>

            {/* General Remarks Input */}
            <div className={styles.card} style={{ marginBottom: '1.25rem' }}>
                <div className={styles.inputGroup}>
                    <label>Audit Remarks / Reason for Quantity Changes</label>
                    <input 
                        type="text" 
                        value={generalRemarks} 
                        onChange={(e) => setGeneralRemarks(e.target.value)}
                        placeholder="e.g., Adjusted due to supplier shortage, issue correction..."
                        className={styles.remarksInput}
                    />
                </div>
            </div>

            {/* BOM Table */}
            <div className={styles.card} style={{ padding: 0 }}>
                <div className={styles.tableHeaderArea}>
                    <div className={styles.searchWrapper}>
                        <Search size={16} className={styles.searchIcon} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search VEPL Part No / Description / Manufacturer / Mfr. Part No..."
                            className={styles.searchInput}
                        />
                    </div>
                </div>
                <div className={styles.tableContainer}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th style={{ width: '80px', textAlign: 'center' }}>Sl No</th>
                                <th>VEPL Part No</th>
                                <th>Description</th>
                                <th>Manufacturer</th>
                                <th>Mfr. Part No</th>
                                <th className={styles.number}>Qty / Product</th>
                                <th className={styles.number}>Required Qty</th>
                                <th style={{ width: '130px', textAlign: 'right' }}>Issued Qty</th>
                                <th className={styles.number}>Delta</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loadError ? (
                                <tr>
                                    <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: '#dc2626', fontWeight: 600 }}>
                                        ⚠️ {loadError}
                                    </td>
                                </tr>
                            ) : filteredBomItems.length === 0 ? (
                                <tr>
                                    <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                                        No matching BOM components found.
                                    </td>
                                </tr>
                            ) : (
                                filteredBomItems.map((item) => (
                                    <BomRow
                                        key={item.qms_bom_item_id}
                                        item={item}
                                        onQtyChange={handleQtyChange}
                                    />
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default MaterialBomView;
