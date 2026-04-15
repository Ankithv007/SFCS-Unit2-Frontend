import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../../utils/api';
import styles from './IQC.module.css';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../hooks/useAuth';
import { Pagination } from '../../components/Pagination';


interface Batch {
    id: number;
    batch_number: string;
    created_by: string;
    created_at: string;

    expected_quantity: number;
    received_quantity: number;
    warehouse_received_quantity?: number;
    warehouse_expected_quantity?: number;
    passed_count: number;
    failed_count: number;
    rework_count: number;
    scrap_count: number;
}

interface Component {
    id: number;
    barcode: string;
    scanned_by: string;
    scanned_at: string;
    status: 'ACCEPTED' | 'REJECTED' | 'REWORK' | 'SCRAP';
    remarks: string;
    previous_batch?: string;
}

export const IQC: React.FC = () => {
    const { user } = useAuth();
    const [batches, setBatches] = useState<Batch[]>([]);
    const [activeBatch, setActiveBatch] = useState<Batch | null>(null);
    const [scannedComponents, setScannedComponents] = useState<Component[]>([]);

    // Create Batch State
    const [createdBy, setCreatedBy] = useState('');
    const [batchNumber, setBatchNumber] = useState('');
    const [quantity, setQuantity] = useState('');

    // Scan State
    const [barcode, setBarcode] = useState('');
    const [scannerName, setScannerName] = useState('');
    const scanLock = useRef(false); // Prevents double-submit from scanner trailing newline

    const { showToast } = useToast();

    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResult, setSearchResult] = useState<any | null>(null);
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const [barcodeFilter, setBarcodeFilter] = useState("");
    const [showBarcodeFilter, setShowBarcodeFilter] = useState(false);

    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            showToast('Please enter a barcode', 'error');
            return;
        }

        try {
            const data = await apiFetch(`/api/pretest/iqc/search?barcode=${encodeURIComponent(searchQuery.trim())}`);
            setSearchResult(data[0]);
            showToast('Component found!', 'success');
            setIsSearchExpanded(false);
            setSearchQuery('');
        } catch (error) {
            console.error('Search error:', error);
            showToast('Component not found or network error', 'error');
            setSearchResult(null);
        }
    };

    const [warehouseBatches, setWarehouseBatches] = useState<any[]>([]);

    useEffect(() => {
        if (!activeBatch) {
            fetchBatches();
            fetchWarehouseBatches();
        }
    }, [activeBatch]);

    // Real-time Polling for Warehouse Updates
    useEffect(() => {
        const pollInterval = setInterval(async () => {
            try {
                // Poll IQC Batches
                const iqcData = await apiFetch('/api/pretest/iqc/batches');
                if (iqcData) {
                    setBatches(iqcData);

                    // Update active batch live counts dynamically from the main array
                    if (activeBatch) {
                        const updatedBatch = iqcData.find((b: Batch) => b.id === activeBatch.id);
                        if (updatedBatch) {
                            setActiveBatch(updatedBatch);
                        }
                    }
                }

                // Poll Warehouse Batches (Important for the "Create Batch" screen)
                if (!activeBatch) {
                    const whData = await apiFetch('/api/pretest/warehouse/batches');
                    if (whData) setWarehouseBatches(whData);
                }
            } catch (error) {
                console.error('Polling error:', error);
            }
        }, 15000); // Poll every 15 seconds

        return () => clearInterval(pollInterval);
    }, [activeBatch]);

    const fetchWarehouseBatches = async () => {
        try {
            const data = await apiFetch('/api/pretest/warehouse/batches');
            if (data) setWarehouseBatches(data);
        } catch (error) {
            console.error('Error fetching warehouse batches:', error);
        }
    };

    const handleWarehouseBatchSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedBatchNumber = e.target.value;
        setBatchNumber(selectedBatchNumber);

        const selectedBatch = warehouseBatches.find(b => b.batch_number === selectedBatchNumber);
        if (selectedBatch) {
            console.log('Selected Warehouse Batch:', selectedBatch);
            // User requested "Total Count" (Actual Scanned) to be auto-filled
            setQuantity(selectedBatch.received_quantity);
        }
    };

    const fetchBatches = async () => {
        try {
            const data = await apiFetch('/api/pretest/iqc/batches');
            if (data) setBatches(data);
        } catch (error) {
            console.error('Error fetching batches:', error);
            showToast('Failed to load batches', 'error');
        }
    };

    const handleCreateBatch = async () => {
        if (!createdBy || !batchNumber) {
            showToast('Batch Number and Created By are required', 'error');
            return;
        }

        try {
            const newBatch = await apiFetch('/api/pretest/iqc/batches', {
                method: 'POST',
                body: JSON.stringify({
                    batch_number: batchNumber,
                    created_by: createdBy,
                    quantity: quantity ? parseInt(quantity) : null
                })
            });

            showToast(`Batch ${batchNumber} created!`, 'success');
            setBatchNumber('');
            setQuantity('');

            // Auto-start
            setActiveBatch(newBatch);
            setScannerName(createdBy);
            fetchComponents(newBatch.id);
        } catch (error: any) {
            console.error('Error creating batch:', error);
            showToast(error.message || 'Failed to create batch', 'error');
        }
    };

    const handleViewBatch = (batch: Batch) => {
        setScannerName('');
        setActiveBatch(batch);
        fetchComponents(batch.id);
    };

    const fetchComponents = async (batchId: number) => {
        try {
            const data = await apiFetch(`/api/pretest/iqc/batches/${batchId}/components`);
            setScannedComponents(data);
        } catch (error) {
            console.error('Error fetching components:', error);
        }
    };

    const handleBarcodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.toUpperCase();
        setBarcode(val);

        if (!activeBatch || !scannerName) return;

        const trimmed = val.trim();

        let coreBarcode = trimmed;
        if (coreBarcode.startsWith('SN:')) {
            coreBarcode = coreBarcode.substring(3).trim();
        }

        const BARCODE_REGEX = /^[A-Z]{2}-[A-Z0-9]{4}-[A-Z0-9]{2}-[A-Z0-9]{4}$/;
        if (BARCODE_REGEX.test(coreBarcode)) {
            if (!scanLock.current) submitScan(coreBarcode, false);
        }
    };

    const handleScan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!barcode.trim() || !activeBatch) return;

        if (!scannerName.trim()) {
            showToast('Please enter Scanned By name', 'error');
            return;
        }

        let finalBarcode = barcode.trim();
        if (finalBarcode.toUpperCase().startsWith('SN:')) {
            finalBarcode = finalBarcode.substring(3).trim();
        }

        await submitScan(finalBarcode, false);
    };

    const handleUpdateStatus = async (component: Component, newStatus: 'ACCEPTED' | 'REWORK' | 'SCRAP') => {
        let reason = '';
        if (newStatus === 'REWORK' || newStatus === 'SCRAP') {
            reason = prompt(`Enter mandatory remarks for ${newStatus}:`) || '';
            if (!reason.trim()) {
                showToast(`Remarks are mandatory for ${newStatus}`, 'error');
                return;
            }
        }

        try {
            const updated = await apiFetch(`/api/pretest/iqc/components/${component.id}/status`, {
                method: 'PUT',
                body: JSON.stringify({
                    status: newStatus,
                    remarks: reason
                })
            });

            showToast(`Component marked as ${newStatus}`, newStatus === 'ACCEPTED' ? 'success' : 'error');

            // Update local state
            setScannedComponents(prev => prev.map(c =>
                c.id === component.id ? { ...c, status: updated.status, remarks: updated.remarks } : c
            ));
            fetchBatches(); // Update counts
        } catch (error: any) {
            console.error('Error updating status:', error);
            showToast(error.message || 'Failed to update status', 'error');
        }
    };

    const submitScan = async (code: string, forceMove: boolean) => {
        let coreBarcode = code.trim().toUpperCase();
        if (coreBarcode.startsWith('SN:')) {
            coreBarcode = coreBarcode.substring(3).trim();
        }

        const BARCODE_REGEX = /^[A-Z]{2}-[A-Z0-9]{4}-[A-Z0-9]{2}-[A-Z0-9]{4}$/;
        if (!BARCODE_REGEX.test(coreBarcode)) {
            showToast('Invalid Barcode format. Must be 15 characters (e.g. AO-4734-34-2344)', 'error');
            setBarcode('');
            return;
        }

        // Lock to prevent double-submit from scanner trailing newline
        scanLock.current = true;
        setTimeout(() => { scanLock.current = false; }, 2000);

        try {
            const newComponent = await apiFetch('/api/pretest/iqc/scan', {
                method: 'POST',
                body: JSON.stringify({
                    batch_id: activeBatch?.id,
                    barcode: coreBarcode,
                    scanned_by: scannerName,
                    status: 'ACCEPTED', // Always default to ACCEPTED
                    remarks: '',
                    force_move: forceMove
                })
            });

            setScannedComponents(prev => {
                if (prev.some(comp => comp.barcode === newComponent.barcode)) return prev;
                return [newComponent, ...prev];
            });
            showToast('Component Accepted', 'success');
            setBarcode('');

            // Refresh batches to update counts
            fetchBatches();
        } catch (error: any) {
            console.error('Error scanning component:', error);
            const errorCode = error?.code;
            const errorMessage = error?.message || '';
            const isMoveRequired = errorCode === 'MOVE_REQUIRED' || errorMessage.includes('Move it?');

            // Handle MOVE_REQUIRED: component belongs to another batch — ask user
            if (isMoveRequired) {
                const confirmMove = window.confirm(
                    `${errorMessage}\n\nClick OK to move it to this batch, or Cancel to skip.`
                );
                if (confirmMove) {
                    await submitScan(coreBarcode, true);
                } else {
                    setBarcode('');
                }
                return;
            }

            // Silently clear barcode for duplicates (no toast shown)
            if (errorMessage.toLowerCase().includes('duplicate')) {
                setBarcode('');
            } else {
                showToast(errorMessage || 'Scan failed', 'error');
                if (errorMessage && (errorMessage.includes('scrapped') || errorMessage.includes('Rework'))) {
                    setBarcode('');
                }
            }
        }
    };

    const handleDeleteBatch = async (batchId: number) => {
        console.log('Current User:', user);
        if (user?.role !== 'Admin' && user?.role !== 'Super Admin' && user?.role !== 'Manager') {
            alert(`Only Admin, Super Admin, or Manager can delete this batch. Your role: ${user?.role}`);
            return;
        }

        if (!window.confirm('Are you sure you want to delete this batch? All data will be lost.')) return;

        if (!window.confirm('⚠️ FINAL WARNING: This action cannot be undone. Are you absolutely sure?')) return;

        try {
            console.log(`Attempting to delete batch ${batchId}`);
            await apiFetch(`/api/pretest/iqc/batches/${batchId}`, {
                method: 'DELETE'
            });

            showToast('Batch deleted successfully', 'success');
            fetchBatches();
        } catch (error: any) {
            console.error('Error deleting batch:', error);
            showToast('Error during deletion: ' + error.message, 'error');
            alert(`Delete Failed: ${error.message}`);
        }
    };

    // Pagination State
    const [pendingPage, setPendingPage] = useState(1);
    const [completedPage, setCompletedPage] = useState(1);
    const [scannedPage, setScannedPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    // Filtered Batches
    // Dynamic Target: The greater of Warehouse Expected (Plan) OR Warehouse Received (Actual)
    // This ensures that if Warehouse scans EXTRA items (more than plan), IQC must also scan them to complete.
    // Filtered Batches
    // Strict Business Rule: 
    // Target is ALWAYS Warehouse Total Count (Expected Qty).
    // EXCEPTION: If Warehouse scans MORE than expected (Extras), then Target increases to match Received Qty.
    const getTargetQty = (b: Batch) => {
        return Number(b.warehouse_received_quantity) || 0;
    };

    const completedBatches = batches.filter(b => {
        const target = getTargetQty(b);
        const processed = b.passed_count + b.scrap_count;
        // Batch moves to Completed only if all Rework -> Pass or Scrap
        return processed >= target && target > 0 && b.rework_count === 0;
    });
    const pendingBatches = batches.filter(b => {
        const target = getTargetQty(b);
        const processed = b.passed_count + b.scrap_count;
        // If any Rework exists, batch stays in Pending Batches
        return target === 0 || processed < target || b.rework_count > 0;
    });

    // Filter Logic for Scanned Components
    const filteredScannedComponents = scannedComponents.filter(item =>
        item.barcode.toLowerCase().includes(barcodeFilter.trim().toLowerCase())
    );

    // Pagination Logic
    const paginatedPendingBatches = pendingBatches.slice((pendingPage - 1) * ITEMS_PER_PAGE, pendingPage * ITEMS_PER_PAGE);
    const paginatedCompletedBatches = completedBatches.slice((completedPage - 1) * ITEMS_PER_PAGE, completedPage * ITEMS_PER_PAGE);
    const paginatedScannedComponents = filteredScannedComponents.slice((scannedPage - 1) * ITEMS_PER_PAGE, scannedPage * ITEMS_PER_PAGE);

    return (
        <div className={styles.container}>
            <div className={styles.headerRow}>
                <div className={styles.headerContent}>
                    <h2><span role="img" aria-label="search">🔍</span> Pre-IQC (Incoming Quality Control)</h2>
                    <p>Verify components against quality standards.</p>
                </div>
                <div className={styles.searchWrapper}>
                    {!isSearchExpanded ? (
                        <button
                            className={styles.searchIconBtn}
                            onClick={() => setIsSearchExpanded(true)}
                            title="Search Component"
                        >
                            🔍
                        </button>
                    ) : (
                        <div className={styles.expandedSearchContainer}>
                            <div className={styles.inputRow}>
                                <span className={styles.searchIconStatic}>🔍</span>
                                <input
                                    autoFocus
                                    type="text"
                                    className={styles.expandedInput}
                                    placeholder="Scan or Type..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                />
                                <button
                                    onClick={() => { setIsSearchExpanded(false); setSearchQuery(''); }}
                                    className={styles.closeBtn}
                                    title="Close Search"
                                >
                                    ×
                                </button>
                            </div>
                            <button className={styles.searchSubmitBtn} onClick={handleSearch}>
                                Search
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Search Result Modal */}
            {searchResult && (
                <div className={styles.modalOverlay} onClick={() => setSearchResult(null)}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <h3>Component Found!</h3>
                        <div className={styles.resultGrid}>
                            <p><strong>Barcode:</strong> {searchResult.barcode}</p>
                            <p><strong>IQC Batch Number:</strong> <span className={styles.highlight}>{searchResult.batch_number}</span></p>
                            <p><strong>Warehouse Batch:</strong> <span className={styles.highlight} style={{ backgroundColor: '#fff7ed', color: '#c2410c' }}>{searchResult.warehouse_batch || 'N/A'}</span></p>
                            <p><strong>Status:</strong> <span className={searchResult.status === 'ACCEPTED' ? styles.statusGreen : (searchResult.status === 'In Warehouse' ? styles.statusBlue : styles.statusRed)}>{searchResult.status}</span></p>
                            <p><strong>Scanned By:</strong> {searchResult.scanned_by}</p>
                            <p><strong>Scanned At:</strong> {new Date(searchResult.scanned_at).toLocaleString()}</p>
                            <p><strong>Remarks:</strong> {searchResult.remarks || '-'}</p>
                            <p><strong>Previous Batch:</strong> {searchResult.previous_batch || 'N/A'}</p>
                        </div>
                        <button className={styles.secondaryButton} onClick={() => setSearchResult(null)} style={{ marginTop: '1rem', width: '100%' }}>
                            Close
                        </button>
                    </div>
                </div>
            )}

            {!activeBatch ? (
                <>
                    {/* Create Batch */}
                    <div className={styles.card}>
                        <h3>Create New IQC Batch</h3>
                        <div className={styles.formGrid}>
                            <div className={styles.inputGroup}>
                                <label>Select Warehouse Batch *</label>
                                <select
                                    className={styles.batchSelect}
                                    value={batchNumber}
                                    onChange={handleWarehouseBatchSelect}
                                >
                                    <option value="">-- Select Batch --</option>
                                    {warehouseBatches
                                        .filter(wb => !batches.some(b => b.batch_number === wb.batch_number))
                                        .map(wb => (
                                            <option key={wb.id} value={wb.batch_number}>
                                                {wb.batch_number}
                                            </option>
                                        ))}
                                </select>
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Total Quantity (Auto-filled)</label>
                                <input
                                    type="number"
                                    className={styles.input}
                                    placeholder="Quantity"
                                    value={quantity}
                                    onChange={(e) => setQuantity(e.target.value)}
                                    readOnly
                                    style={{ backgroundColor: '#f3f4f6' }}
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Created By *</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    placeholder="Your Name"
                                    value={createdBy}
                                    onChange={(e) => setCreatedBy(e.target.value)}
                                />
                            </div>
                        </div>
                        <button className={styles.button} onClick={handleCreateBatch}>
                            Create Batch
                        </button>
                    </div>

                    {/* Pending Batches */}
                    <div className={styles.card}>
                        <h3>Pending Batches</h3>
                        <div className={styles.tableContainer}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Batch Number</th>
                                        <th>Created By</th>
                                        <th>Date</th>
                                        <th>Received Qty</th>
                                        <th>Passed</th>
                                        <th>Rework</th>
                                        <th>Scrap</th>
                                        <th>Download</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedPendingBatches.map(batch => (
                                        <tr key={batch.id}>
                                            <td style={{ fontWeight: 600 }}>{batch.batch_number}</td>
                                            <td>{batch.created_by}</td>
                                            <td>{new Date(batch.created_at).toLocaleDateString()}</td>
                                            <td className={styles.statusBlue}>{batch.passed_count + batch.rework_count + batch.scrap_count} / {getTargetQty(batch)}</td>
                                            <td className={styles.statusGreen}>{batch.passed_count}</td>
                                            <td className={styles.statusYellow}>{batch.rework_count}</td>
                                            <td className={styles.statusRed}>{batch.scrap_count}</td>
                                            <td>
                                                <button
                                                    className={styles.secondaryButton}
                                                    onClick={async () => {
                                                        try {
                                                            const blob = await apiFetch(`/api/pretest/iqc/batches/${batch.id}/download`);
                                                            const url = window.URL.createObjectURL(blob);
                                                            const link = document.createElement('a');
                                                            link.href = url;

                                                            const now = new Date();
                                                            const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-');
                                                            const cleanBatch = batch.batch_number.replace(/[^a-zA-Z0-9_-]/g, '_');
                                                            const fileName = `IQC_Report_${cleanBatch}_${timestamp}.xlsx`;

                                                            link.setAttribute('download', fileName);
                                                            document.body.appendChild(link);
                                                            link.click();
                                                            document.body.removeChild(link);
                                                            window.URL.revokeObjectURL(url);
                                                        } catch (e) {
                                                            showToast('Download failed', 'error');
                                                        }
                                                    }}
                                                    title="Download Excel Report"
                                                >
                                                    📥
                                                </button>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button
                                                        className={styles.secondaryButton}
                                                        onClick={() => handleViewBatch(batch)}
                                                    >
                                                        Resume
                                                    </button>
                                                    <button
                                                        className={styles.deleteTextButton}
                                                        onClick={() => handleDeleteBatch(batch.id)}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {pendingBatches.length === 0 && (
                                        <tr>
                                            <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                                                No pending batches.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                            <Pagination
                                currentPage={pendingPage}
                                totalPages={Math.ceil(pendingBatches.length / ITEMS_PER_PAGE)}
                                onPageChange={setPendingPage}
                            />
                        </div>
                    </div>

                    {/* Completed Batches */}
                    <div className={styles.card}>
                        <h3>Completed Batches</h3>
                        <div className={styles.tableContainer}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Batch Number</th>
                                        <th>Created By</th>
                                        <th>Date</th>
                                        <th>Received Qty</th>
                                        <th>Passed</th>
                                        <th>Rework</th>
                                        <th>Scrap</th>
                                        <th>Download</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedCompletedBatches.map(batch => (
                                        <tr key={batch.id}>
                                            <td style={{ fontWeight: 600 }}>{batch.batch_number}</td>
                                            <td>{batch.created_by}</td>
                                            <td>{new Date(batch.created_at).toLocaleDateString()}</td>
                                            <td className={styles.statusBlue}>{getTargetQty(batch)}</td>
                                            <td className={styles.statusGreen}>{batch.passed_count}</td>
                                            <td className={styles.statusYellow}>{batch.rework_count}</td>
                                            <td className={styles.statusRed}>{batch.scrap_count}</td>
                                            <td>
                                                <button
                                                    className={styles.secondaryButton}
                                                    onClick={async () => {
                                                        try {
                                                            const blob = await apiFetch(`/api/pretest/iqc/batches/${batch.id}/download`, {
                                                                headers: { 'Accept': 'application/blob' }
                                                            });
                                                            const url = window.URL.createObjectURL(blob);
                                                            const link = document.createElement('a');
                                                            link.href = url;
                                                            link.setAttribute('download', `iqc_batch_${batch.batch_number}.csv`);
                                                            document.body.appendChild(link);
                                                            link.click();
                                                            document.body.removeChild(link);
                                                            window.URL.revokeObjectURL(url);
                                                        } catch (e) {
                                                            showToast('Download failed', 'error');
                                                        }
                                                    }}
                                                    title="Download CSV Report"
                                                >
                                                    📥
                                                </button>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    {['admin', 'super admin', 'manager'].includes(user?.role?.toLowerCase() || '') && (
                                                        <button
                                                            className={styles.secondaryButton}
                                                            onClick={() => handleViewBatch(batch)}
                                                            title="View Batch Details"
                                                        >
                                                            View
                                                        </button>
                                                    )}
                                                    <button
                                                        className={styles.deleteTextButton}
                                                        onClick={() => handleDeleteBatch(batch.id)}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {completedBatches.length === 0 && (
                                        <tr>
                                            <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                                                No completed batches.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                            <Pagination
                                currentPage={completedPage}
                                totalPages={Math.ceil(completedBatches.length / ITEMS_PER_PAGE)}
                                onPageChange={setCompletedPage}
                            />
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <div className={styles.activeBatchHeader}>
                        <div>
                            <h3>Batch: {activeBatch.batch_number}</h3>
                            <small>Created by: {activeBatch.created_by}</small>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', fontSize: '0.95rem', color: '#4b5563', marginTop: '0.5rem' }}>
                                <span>Total Scanned: <strong>{scannedComponents.length}</strong> / {getTargetQty(activeBatch)}</span>
                                <span style={{ color: '#2563eb', fontWeight: 600 }}>🏭 Available: {activeBatch.warehouse_received_quantity || 0}</span>
                                <span style={{ color: '#10b981', fontWeight: 600 }}>✅ Passed: {scannedComponents.filter(c => c.status === 'ACCEPTED').length}</span>
                                <span style={{ color: '#eab308', fontWeight: 600 }}>🔄 Rework: {scannedComponents.filter(c => c.status === 'REWORK').length}</span>
                                <span style={{ color: '#ef4444', fontWeight: 600 }}>🗑 Scrap: {scannedComponents.filter(c => c.status === 'SCRAP').length}</span>
                            </div>
                        </div>
                        <button
                            className={styles.secondaryButton}
                            onClick={() => setActiveBatch(null)}
                        >
                            End Session
                        </button>
                    </div>

                    <div className={styles.scanSection}>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Scanned By *</label>
                            <input
                                type="text"
                                className={styles.input}
                                placeholder="Enter Your Name"
                                value={scannerName}
                                onChange={(e) => setScannerName(e.target.value)}
                                style={{ maxWidth: '300px' }}
                            />
                        </div>

                        <form className={styles.scanForm} onSubmit={handleScan}>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <input
                                    type="text"
                                    className={styles.scanInput}
                                    placeholder="Scan Component Barcode..."
                                    value={barcode}
                                    onChange={handleBarcodeChange}
                                    autoFocus
                                />
                            </div>
                            <button type="submit" className={styles.scanButton}>
                                SCAN
                            </button>
                        </form>

                        <h3>Scanned Components ({scannedComponents.length})</h3>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th style={{ position: 'relative' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            BARCODE
                                            <button
                                                type="button"
                                                onClick={() => setShowBarcodeFilter(!showBarcodeFilter)}
                                                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.9rem' }}
                                                title="Filter Barcode"
                                            >
                                                🔍
                                            </button>
                                        </div>
                                        {showBarcodeFilter && (
                                            <div style={{ marginTop: '0.5rem' }}>
                                                <input
                                                    type="text"
                                                    placeholder="Search..."
                                                    value={barcodeFilter}
                                                    onChange={(e) => {
                                                        setBarcodeFilter(e.target.value);
                                                        setScannedPage(1); // Reset to first page
                                                    }}
                                                    autoFocus
                                                    className={styles.input}
                                                    style={{
                                                        padding: '0.25rem 0.5rem',
                                                        fontSize: '0.8rem',
                                                        width: '100%',
                                                        boxSizing: 'border-box'
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Escape') {
                                                            setShowBarcodeFilter(false);
                                                            setBarcodeFilter('');
                                                        }
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </th>
                                    <th>SCANNED BY</th>
                                    <th>TIME</th>
                                    <th>STATUS</th>
                                    <th>PREVIOUS BATCH</th>
                                    <th>REMARKS</th>
                                    <th>ACTION</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedScannedComponents.map(comp => (
                                    <tr key={comp.id}>
                                        <td style={{ fontWeight: 600 }}>{comp.barcode}</td>
                                        <td>{comp.scanned_by}</td>
                                        <td>{new Date(comp.scanned_at).toLocaleTimeString()}</td>
                                        <td className={comp.status === 'ACCEPTED' ? styles.statusGreen : (comp.status === 'REWORK' ? styles.statusYellow : (comp.status === 'SCRAP' ? styles.statusRed : ''))}>
                                            {comp.status}
                                        </td>
                                        <td style={{ color: comp.previous_batch ? '#c2410c' : '#6b7280', fontWeight: comp.previous_batch ? 600 : 400 }}>
                                            {comp.previous_batch || '-'}
                                        </td>
                                        <td>{comp.remarks || '-'}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                {comp.status !== 'SCRAP' && (
                                                    <>
                                                        {comp.status !== 'ACCEPTED' && (
                                                            <button
                                                                className={styles.statusGreen}
                                                                style={{ border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600 }}
                                                                onClick={() => handleUpdateStatus(comp, 'ACCEPTED')}
                                                            >
                                                                Pass
                                                            </button>
                                                        )}
                                                        {comp.status !== 'REWORK' && (
                                                            <button
                                                                className={styles.statusYellow}
                                                                style={{ border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600 }}
                                                                onClick={() => handleUpdateStatus(comp, 'REWORK')}
                                                            >
                                                                Rework
                                                            </button>
                                                        )}
                                                        <button
                                                            className={styles.statusRed}
                                                            style={{ border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600 }}
                                                            onClick={() => handleUpdateStatus(comp, 'SCRAP')}
                                                        >
                                                            Scrap
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <Pagination
                            currentPage={scannedPage}
                            totalPages={Math.ceil(scannedComponents.length / ITEMS_PER_PAGE)}
                            onPageChange={setScannedPage}
                        />
                    </div>
                </>
            )
            }
        </div >
    );
};
