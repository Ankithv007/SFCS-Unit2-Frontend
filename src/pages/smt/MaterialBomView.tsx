import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from './MaterialBomView.module.css';
import { 
    ArrowLeft, RefreshCw, Save, CheckCircle, Search, FileSpreadsheet, X
} from 'lucide-react';

interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
}

interface ScannedUid {
    uid: string;
    issued_qty: number;
    remaining_qty: number;
    returned_qty: number;
    scanned_by: string;
    scanned_at: string;
}

interface ReturnedUid {
    uid: string;
    returned_qty: number;
    remaining_qty_after: number;
    returned_by: string;
    returned_at: string;
}

interface BomItem {
    qms_bom_item_id: number;
    material_management_item_id: string;
    sl_no: string;
    vepl_part_no: string;
    description: string;
    manufacturer: string;
    mfr_part_no: string;
    qty_per_product: number;
    required_qty: number;
    issued_qty: number;
    delta_qty: number;
    return_qty: number;
    return_delta: number;
    total_uid_count: number;
    issued_uids?: ScannedUid[];
    returned_uids?: ReturnedUid[];
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

// Compact Uids list helper component
const UidCompactList: React.FC<{
    uids: { uid: string; qty: number }[];
    title: string;
}> = ({ uids, title }) => {
    const [expanded, setExpanded] = useState(false);
    if (!uids || uids.length === 0) {
        return <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontStyle: 'italic' }}>None</span>;
    }
    const displayed = expanded ? uids : uids.slice(0, 3);
    const extraCount = uids.length - 3;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div className={styles.uidBadgeList}>
                {displayed.map(u => (
                    <span key={u.uid} className={styles.uidBadge} title={`${title}: ${u.uid} | Qty: ${u.qty}`}>
                        {u.uid} → {u.qty}
                    </span>
                ))}
            </div>
            {extraCount > 0 && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        setExpanded(!expanded);
                    }}
                    className={styles.expandUidsBtn}
                >
                    {expanded ? 'Show Less' : `+${extraCount} more`}
                </button>
            )}
        </div>
    );
};

// Performance Optimized Row Component for SMT transaction grid
interface BomRowProps {
    item: BomItem;
    onOpenScanIssue: (item: BomItem) => void;
    onOpenScanReturn: (item: BomItem) => void;
    showIssueScanButton: boolean;
    showReturnScanButton: boolean;
    highlightedRowId?: string | null;
}

const BomRow: React.FC<BomRowProps> = React.memo(({ 
    item, 
    onOpenScanIssue, 
    onOpenScanReturn, 
    showIssueScanButton, 
    showReturnScanButton,
    highlightedRowId
}) => {
    const delta = item.issued_qty - item.required_qty;
    const returnDelta = item.issued_qty - item.return_qty; // Return Delta = Issued Qty - Return Qty

    // Dynamic row classes
    let rowClassName = '';
    if (item.is_new) rowClassName = styles.rowNew;
    else if (item.is_changed) rowClassName = styles.rowChanged;
    else if (item.is_removed) rowClassName = styles.rowRemoved;

    if (item.material_management_item_id === highlightedRowId) {
        rowClassName = `${rowClassName} ${styles.highlightRow}`;
    }

    const formatDelta = (val: number) => {
        if (val > 0) return `+${val.toFixed(2)}`;
        if (val < 0) return `${val.toFixed(2)}`;
        return '0.00';
    };

    // Aggregate returned UIDs for display
    const aggregatedReturnedUids = React.useMemo(() => {
        const uidsMap = new Map<string, number>();
        (item.returned_uids || []).forEach(u => {
            uidsMap.set(u.uid, (uidsMap.get(u.uid) || 0) + u.returned_qty);
        });
        const list: { uid: string; qty: number }[] = [];
        uidsMap.forEach((qty, uid) => {
            list.push({ uid, qty });
        });
        return list;
    }, [item.returned_uids]);

    return (
        <tr id={`bom-row-${item.material_management_item_id}`} className={rowClassName}>
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
            
            {/* Scan Column (Issue) */}
            <td style={{ textAlign: 'center' }}>
                <button
                    className={styles.scanBtn}
                    onClick={() => onOpenScanIssue(item)}
                    disabled={item.issued_qty >= item.required_qty || !showIssueScanButton || item.is_removed}
                >
                    Scan
                </button>
            </td>

            {/* Issued Qty */}
            <td className={`${styles.number} ${styles.semibold}`}>{item.issued_qty.toFixed(2)}</td>

            {/* UID Issued */}
            <td>
                <UidCompactList 
                    uids={(item.issued_uids || []).map(u => ({ uid: u.uid, qty: u.issued_qty }))} 
                    title="Issued" 
                />
            </td>

            {/* Issued Delta */}
            <td className={`${styles.number} ${styles.semibold} ${delta < 0 ? styles.deltaNegative : delta > 0 ? styles.deltaPositive : styles.deltaZero}`}>
                {formatDelta(delta)}
            </td>

            {/* Return Scan */}
            <td style={{ textAlign: 'center' }}>
                <button
                    className={styles.returnScanBtn}
                    onClick={() => onOpenScanReturn(item)}
                    disabled={!showReturnScanButton || item.is_removed || item.issued_qty <= 0}
                >
                    Return
                </button>
            </td>

            {/* Return UID */}
            <td>
                <UidCompactList 
                    uids={aggregatedReturnedUids} 
                    title="Returned" 
                />
            </td>

            {/* Return Qty */}
            <td className={`${styles.number} ${styles.semibold}`}>{item.return_qty.toFixed(2)}</td>

            {/* Return Delta */}
            <td className={`${styles.number} ${styles.semibold} ${styles.deltaReturn}`}>
                {returnDelta.toFixed(2)}
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

    // Global scan states
    const [lockMode, setLockMode] = useState<'request' | 'return'>('request');
    const [globalBarcodeInput, setGlobalBarcodeInput] = useState('');
    const [isGlobalScanning, setIsGlobalScanning] = useState(false);
    const [globalScanError, setGlobalScanError] = useState<string | null>(null);
    const [lastScannedInfo, setLastScannedInfo] = useState<{
        message: string;
        uid: string;
        veplPartNo: string;
        quantity: number;
        issuedQty?: number;
        remainingQty?: number;
        mode?: 'request' | 'return';
        time: string;
    } | null>(null);
    const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null);

    // Refs
    const globalScanInputRef = useRef<HTMLInputElement>(null);

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

    // Scan Modal State
    const [scanModalOpen, setScanModalOpen] = useState(false);
    const [scanningItem, setScanningItem] = useState<BomItem | null>(null);
    const [scanType, setScanType] = useState<'issue' | 'return'>('issue');
    const [barcodeInput, setBarcodeInput] = useState('');
    const [scanError, setScanError] = useState<string | null>(null);
    const [scanSuccess, setScanSuccess] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const scanInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isLoading && !isGlobalScanning && !scanModalOpen) {
            globalScanInputRef.current?.focus();
        }
    }, [isLoading, isGlobalScanning, scanModalOpen]);

    useEffect(() => {
        if (scanModalOpen && !isScanning) {
            scanInputRef.current?.focus();
        }
    }, [scanModalOpen, isScanning]);

    // Continuous Scan Dialog Focus Lock
    useEffect(() => {
        if (!scanModalOpen) return;

        const handleGlobalFocus = (e: FocusEvent) => {
            if (scanInputRef.current && e.target !== scanInputRef.current) {
                const clickedClose = (e.target as HTMLElement)?.closest(`.${styles.closeModalBtn}`);
                if (clickedClose) return;
                scanInputRef.current.focus();
            }
        };

        document.addEventListener('focusin', handleGlobalFocus);
        setTimeout(() => scanInputRef.current?.focus(), 50);

        return () => {
            document.removeEventListener('focusin', handleGlobalFocus);
        };
    }, [scanModalOpen]);

    const handleOpenScanIssue = (item: BomItem) => {
        setScanType('issue');
        setScanningItem(item);
        setBarcodeInput('');
        setScanError(null);
        setScanSuccess(null);
        setScanModalOpen(true);
    };

    const handleOpenScanReturn = (item: BomItem) => {
        setScanType('return');
        setScanningItem(item);
        setBarcodeInput('');
        setScanError(null);
        setScanSuccess(null);
        setScanModalOpen(true);
    };

    const handleCloseScan = () => {
        setScanModalOpen(false);
        setScanningItem(null);
        setTimeout(() => globalScanInputRef.current?.focus(), 50);
    };

    const handleScanSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!scanningItem || !barcodeInput.trim()) return;

        setIsScanning(true);
        setScanError(null);
        setScanSuccess(null);

        const cleanedBarcode = barcodeInput.replace(/[\r\n]/g, '').trim();
        if (!cleanedBarcode) {
            setScanError('Barcode cannot be empty.');
            setIsScanning(false);
            setBarcodeInput('');
            setTimeout(() => scanInputRef.current?.focus(), 50);
            return;
        }

        try {
            const token = localStorage.getItem('auth_token') || '';
            const endpoint = scanType === 'issue'
                ? `/api/smt/material-management/records/${id}/scan`
                : `/api/smt/material-management/records/${id}/return-scan`;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    material_management_item_id: scanningItem.material_management_item_id,
                    barcode: cleanedBarcode
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Barcode scan failed.');
            }

            addToast(result.message || 'Material scanned successfully.', 'success');
            
            const lastUidObj = scanType === 'issue'
                ? result.issued_uids[result.issued_uids.length - 1]
                : result.returned_uids[result.returned_uids.length - 1];

            if (scanType === 'return') {
                const matchingIssued = result.issued_uids?.find((u: any) => u.uid === lastUidObj?.uid);
                const issuedQty = matchingIssued ? parseFloat(matchingIssued.issued_qty) : 0;
                const remainingQty = matchingIssued ? parseFloat(matchingIssued.remaining_qty) : 0;
                const lastReturned = result.returned_uids && result.returned_uids.length > 0
                    ? result.returned_uids[result.returned_uids.length - 1]
                    : null;
                const currentReturnQty = lastReturned ? parseFloat(lastReturned.returned_qty) : 0;

                setScanSuccess(`Returned successfully: UID ${lastUidObj?.uid || ''} | Requested Qty: ${issuedQty} | Current Return Qty: ${currentReturnQty} | Remaining Qty: ${remainingQty}`);
            } else {
                setScanSuccess(`Scanned successfully: UID ${lastUidObj?.uid || ''}`);
            }

            setBomItems(prev => prev.map(item => {
                if (item.material_management_item_id === scanningItem.material_management_item_id) {
                    const updated = {
                        ...item,
                        issued_qty: parseFloat(result.issued_qty),
                        delta_qty: parseFloat(result.delta_qty),
                        return_qty: parseFloat(result.return_qty),
                        return_delta: parseFloat(result.return_delta),
                        total_uid_count: result.total_uid_count,
                        issued_uids: result.issued_uids,
                        returned_uids: result.returned_uids
                    };
                    setScanningItem(updated);
                    return updated;
                }
                return item;
            }));

        } catch (err: any) {
            addToast(err.message, 'error');
            setScanError(err.message);
        } finally {
            setIsScanning(false);
            setBarcodeInput('');
            setTimeout(() => scanInputRef.current?.focus(), 50);
        }
    };

    const handleGlobalScanSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const rawInput = globalBarcodeInput;
        setGlobalBarcodeInput(''); // Clear immediately
        setGlobalScanError(null);
        setLastScannedInfo(null);

        const cleanedBarcode = rawInput.replace(/[\r\n]/g, '').trim();
        if (!cleanedBarcode) {
            setGlobalScanError('Barcode cannot be empty.');
            setTimeout(() => globalScanInputRef.current?.focus(), 50);
            return;
        }

        setIsGlobalScanning(true);

        try {
            const token = localStorage.getItem('auth_token') || '';
            const response = await fetch('/api/smt/material-management/global-scan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    material_management_id: id,
                    mode: lockMode,
                    barcode: cleanedBarcode
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Barcode scan failed.');
            }

            // Success toast
            addToast(result.message || 'Material scanned successfully.', 'success');

            // Format scan time
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });

            const updatedRow = result.updated_row;
            const updatedRowId = result.updated_row_id;

            // Set global scan success info
            const scannedUid = result.scanned_info?.uid;
            const matchingIssued = updatedRow?.issued_uids?.find((u: any) => u.uid === scannedUid);
            const issuedQty = matchingIssued ? parseFloat(matchingIssued.issued_qty) : 0;
            const remainingQty = matchingIssued ? parseFloat(matchingIssued.remaining_qty) : 0;

            setLastScannedInfo({
                message: result.message || 'Material scanned successfully.',
                uid: scannedUid || '',
                veplPartNo: result.scanned_info?.veplPartNo || '',
                quantity: result.scanned_info?.quantity || 0,
                issuedQty,
                remainingQty,
                mode: lockMode,
                time: timeStr
            });

            // Update local bomItems with the updated BOM row
            setBomItems(prev => prev.map(item => {
                if (item.material_management_item_id === updatedRowId) {
                    return {
                        ...item,
                        issued_qty: parseFloat(updatedRow.issued_qty),
                        delta_qty: parseFloat(updatedRow.delta_qty),
                        issued_delta: parseFloat(updatedRow.issued_delta),
                        return_qty: parseFloat(updatedRow.return_qty),
                        return_delta: parseFloat(updatedRow.return_delta),
                        total_uid_count: updatedRow.total_uid_count,
                        issued_uids: updatedRow.issued_uids,
                        returned_uids: updatedRow.returned_uids
                    };
                }
                return item;
            }));

            // Update recordDetails summary statistics if returned from backend
            if (result.summary && recordDetails) {
                setRecordDetails(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        total_components: result.summary.total_components,
                        total_request_scanned: result.summary.total_request_scanned,
                        total_return_scanned: result.summary.total_return_scanned
                    };
                });
            }

            // Highlight row (do not auto-scroll)
            setHighlightedRowId(updatedRowId);
            setTimeout(() => {
                setHighlightedRowId(null);
            }, 2000);

        } catch (err: any) {
            setGlobalScanError(err.message || 'Failed to process global scan.');
            addToast(err.message || 'Failed to process global scan.', 'error');
        } finally {
            setIsGlobalScanning(false);
            setTimeout(() => globalScanInputRef.current?.focus(), 50);
        }
    };

    // Summary calculations
    const summary = React.useMemo(() => {
        const totalComponents = bomItems.length;
        let totalRequestScanned = 0;
        let totalReturnScanned = 0;

        bomItems.forEach(item => {
            if (item.issued_qty > 0) {
                totalRequestScanned++;
            }
            if (item.return_qty > 0) {
                totalReturnScanned++;
            }
        });

        return {
            totalComponents,
            totalRequestScanned,
            totalReturnScanned
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
                <button className={styles.btnSecondary} onClick={() => navigate('/smt/material-management')}>
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
                    <button className={styles.backBtn} onClick={() => navigate('/smt/material-management')}>
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
                    <span className={styles.summaryLabel}>Total Request Scanned</span>
                    <span className={styles.summaryVal}>
                        {summary.totalRequestScanned} / {summary.totalComponents}
                    </span>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Total Return Scanned</span>
                    <span className={styles.summaryVal}>
                        {summary.totalReturnScanned} / {summary.totalComponents}
                    </span>
                </div>
            </div>

            {/* Global Material Scanner */}
            <div className={`${styles.card} ${styles.stickyScanner}`} style={{ marginBottom: '1.25rem' }}>
                <h3 className={styles.scannerHeader}>Global Material Scanner</h3>
                <div className={styles.lockToggleGroup}>
                    <button
                        type="button"
                        className={`${styles.lockBtn} ${lockMode === 'request' ? styles.lockBtnActive : styles.lockBtnInactive}`}
                        onClick={() => {
                            setLockMode('request');
                            setTimeout(() => globalScanInputRef.current?.focus(), 50);
                        }}
                    >
                        Request Lock
                    </button>
                    <button
                        type="button"
                        className={`${styles.lockBtn} ${lockMode === 'return' ? styles.lockBtnActive : styles.lockBtnInactive}`}
                        onClick={() => {
                            setLockMode('return');
                            setTimeout(() => globalScanInputRef.current?.focus(), 50);
                        }}
                    >
                        Return Lock
                    </button>
                </div>

                <form onSubmit={handleGlobalScanSubmit}>
                    <div className={styles.inputGroup}>
                        <label htmlFor="global-barcode-scan">Barcode Scan</label>
                        <input
                            id="global-barcode-scan"
                            type="text"
                            ref={globalScanInputRef}
                            value={globalBarcodeInput}
                            onChange={(e) => setGlobalBarcodeInput(e.target.value)}
                            placeholder="Scan reel barcode here..."
                            className={styles.globalScanInput}
                            disabled={isGlobalScanning}
                            autoComplete="off"
                        />
                    </div>
                </form>

                {globalScanError && (
                    <div className={styles.scannerErrorMsg}>
                        ❌ {globalScanError}
                    </div>
                )}
                {lastScannedInfo && (
                    <div className={styles.scannerSuccessMsg}>
                        <div className={styles.successTitle}>✔ {lastScannedInfo.message}</div>
                        <div className={styles.successDetails}>
                            <span><strong>UID:</strong> {lastScannedInfo.uid}</span>
                            <span><strong>VEPL Part No:</strong> {lastScannedInfo.veplPartNo}</span>
                            {lastScannedInfo.mode === 'return' ? (
                                <>
                                    <span><strong>Requested Qty:</strong> {lastScannedInfo.issuedQty}</span>
                                    <span><strong>Current Return Qty:</strong> {lastScannedInfo.quantity}</span>
                                    <span><strong>Remaining Qty:</strong> {lastScannedInfo.remainingQty}</span>
                                </>
                            ) : (
                                <span><strong>Quantity:</strong> {lastScannedInfo.quantity}</span>
                            )}
                            <span><strong>Time:</strong> {lastScannedInfo.time}</span>
                        </div>
                    </div>
                )}
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
                                <th style={{ width: '50px', textAlign: 'center' }}>Sl No</th>
                                <th>VEPL Part No</th>
                                <th>Description</th>
                                <th>Manufacturer</th>
                                <th>Mfr. Part No</th>
                                <th className={styles.number}>Qty / Product</th>
                                <th className={styles.number}>Required Qty</th>
                                <th style={{ textAlign: 'center' }}>Scan</th>
                                <th className={styles.number}>Issued Qty</th>
                                <th>UID Issued</th>
                                <th className={styles.number}>Issued Delta</th>
                                <th style={{ textAlign: 'center' }}>Return Scan</th>
                                <th>Return UID</th>
                                <th className={styles.number}>Return Qty</th>
                                <th className={styles.number}>Return Delta</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loadError ? (
                                <tr>
                                    <td colSpan={15} style={{ textAlign: 'center', padding: '3rem', color: '#dc2626', fontWeight: 600 }}>
                                        ⚠️ {loadError}
                                    </td>
                                </tr>
                            ) : filteredBomItems.length === 0 ? (
                                <tr>
                                    <td colSpan={15} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                                        No matching BOM components found.
                                    </td>
                                </tr>
                            ) : (
                                filteredBomItems.map((item) => (
                                    <BomRow
                                        key={item.qms_bom_item_id}
                                        item={item}
                                        onOpenScanIssue={handleOpenScanIssue}
                                        onOpenScanReturn={handleOpenScanReturn}
                                        showIssueScanButton={recordDetails.status !== 'COMPLETED' && recordDetails.status !== 'CLOSED'}
                                        showReturnScanButton={recordDetails.status !== 'CLOSED'}
                                        highlightedRowId={highlightedRowId}
                                    />
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Continuous Scan Modal */}
            {scanModalOpen && scanningItem && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalHeader}>
                            <h3>{scanType === 'issue' ? 'Scan Issue Barcode' : 'Scan Return Barcode'} - VEPL Part No: {scanningItem.vepl_part_no}</h3>
                            <button className={styles.closeModalBtn} onClick={handleCloseScan}>
                                <X size={20} />
                            </button>
                        </div>
                        
                        <form onSubmit={handleScanSubmit}>
                            <div className={styles.modalBody}>
                                <div className={styles.scanItemInfo}>
                                    <div className={styles.scanInfoRow}>
                                        <span className={styles.scanInfoLabel}>Description</span>
                                        <span className={styles.scanInfoVal}>{scanningItem.description || '-'}</span>
                                    </div>
                                    <div className={styles.scanInfoRow}>
                                        <span className={styles.scanInfoLabel}>Mfr Part No</span>
                                        <span className={styles.scanInfoVal}>{scanningItem.mfr_part_no || '-'}</span>
                                    </div>
                                    <div className={styles.scanInfoRow}>
                                        <span className={styles.scanInfoLabel}>Required Qty</span>
                                        <span className={styles.scanInfoVal}>{scanningItem.required_qty.toFixed(2)}</span>
                                    </div>
                                    <div className={styles.scanInfoRow}>
                                        <span className={styles.scanInfoLabel}>Issued Qty</span>
                                        <span className={styles.scanInfoVal}>{scanningItem.issued_qty.toFixed(2)}</span>
                                    </div>
                                    <div className={styles.scanInfoRow}>
                                        <span className={styles.scanInfoLabel}>Returned Qty</span>
                                        <span className={styles.scanInfoVal}>{scanningItem.return_qty.toFixed(2)}</span>
                                    </div>
                                    <div className={styles.scanInfoRow}>
                                        <span className={styles.scanInfoLabel}>Return Delta</span>
                                        <span className={styles.scanInfoVal}>{(scanningItem.issued_qty - scanningItem.return_qty).toFixed(2)}</span>
                                    </div>
                                </div>

                                <div className={styles.scanInputGroup}>
                                    <label htmlFor="barcode-scanner-input">
                                        {scanType === 'issue' ? 'Scan / Enter SMT Issue Barcode' : 'Scan / Enter SMT Return Barcode'}
                                    </label>
                                    <input
                                        id="barcode-scanner-input"
                                        ref={scanInputRef}
                                        type="text"
                                        value={barcodeInput}
                                        onChange={(e) => setBarcodeInput(e.target.value)}
                                        placeholder={scanType === 'issue' ? "Scan issue barcode..." : "Scan return barcode..."}
                                        className={styles.scanInput}
                                        disabled={isScanning}
                                        autoComplete="off"
                                    />
                                </div>

                                <div className={styles.statusMessageArea}>
                                    {scanError && <span className={styles.scanErrorText}>⚠️ {scanError}</span>}
                                    {scanSuccess && <span className={styles.scanSuccessText}>✓ {scanSuccess}</span>}
                                </div>

                                {scanType === 'issue' ? (
                                    <div className={styles.uidListSection}>
                                        <span className={styles.uidListTitle}>Scanned Reels / UIDs ({scanningItem.total_uid_count || 0})</span>
                                        <div className={styles.uidListScroll}>
                                            {scanningItem.issued_uids && scanningItem.issued_uids.length > 0 ? (
                                                scanningItem.issued_uids.map((u, index) => (
                                                    <div key={index} className={styles.uidListItem}>
                                                        <span className={styles.uidListItemText}>
                                                            {index + 1}. UID: <strong>{u.uid}</strong> (by {u.scanned_by})
                                                        </span>
                                                        <span className={styles.uidListItemQty}>
                                                            Qty: {u.issued_qty} (Remaining: {u.remaining_qty})
                                                        </span>
                                                    </div>
                                                ))
                                            ) : (
                                                <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
                                                    No reels scanned yet.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className={styles.uidListSection}>
                                        <span className={styles.uidListTitle}>UID Balances / Status</span>
                                        <div className={styles.uidListScroll} style={{ maxHeight: '250px', overflowY: 'auto' }}>
                                            {scanningItem.issued_uids && scanningItem.issued_uids.length > 0 ? (
                                                <table className={styles.modalUidTable}>
                                                    <thead>
                                                        <tr>
                                                            <th>UID</th>
                                                            <th style={{ textAlign: 'right' }}>Issued Qty</th>
                                                            <th style={{ textAlign: 'right' }}>Returned Qty</th>
                                                            <th style={{ textAlign: 'right' }}>Remaining Qty</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {scanningItem.issued_uids.map((u, index) => (
                                                            <tr key={index}>
                                                                 <td style={{ fontWeight: '500' }}>{u.uid}</td>
                                                                 <td style={{ textAlign: 'right' }}>{u.issued_qty.toFixed(2)}</td>
                                                                 <td style={{ textAlign: 'right', color: u.returned_qty > 0 ? '#16a34a' : 'inherit' }}>
                                                                    {u.returned_qty.toFixed(2)}
                                                                 </td>
                                                                 <td style={{ textAlign: 'right', fontWeight: '600', color: u.remaining_qty === 0 ? '#64748b' : '#3b82f6' }}>
                                                                    {u.remaining_qty.toFixed(2)}
                                                                 </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            ) : (
                                                <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
                                                    No UIDs issued for this BOM component.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            <div style={{ padding: '1rem 1.5rem', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
                                <button type="button" className={styles.btnSecondary} onClick={handleCloseScan}>
                                    Close
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MaterialBomView;
