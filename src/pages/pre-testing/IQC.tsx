import React, { useState, useEffect } from 'react';
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
}

interface Component {
    id: number;
    barcode: string;
    scanned_by: string;
    scanned_at: string;
    status: 'ACCEPTED' | 'REJECTED';
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

    const { showToast } = useToast();

    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResult, setSearchResult] = useState<any | null>(null);
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);

    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            showToast('Please enter a barcode', 'error');
            return;
        }

        try {
            const response = await fetch(`http://localhost:5002/api/iqc/search?barcode=${encodeURIComponent(searchQuery.trim())}`);
            if (response.ok) {
                const data = await response.json();
                setSearchResult(data[0]);
                showToast('Component found!', 'success');
                setIsSearchExpanded(false);
                setSearchQuery('');
            } else {
                showToast('Component not found in any batch', 'error');
                setSearchResult(null);
            }
        } catch (error) {
            console.error('Search error:', error);
            showToast('Network error', 'error');
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
                const response = await fetch('http://localhost:5002/api/iqc/batches');
                if (response.ok) {
                    const data = await response.json();
                    setBatches(data);

                    // Update active batch live count if selected
                    if (activeBatch) {
                        const updatedBatch = data.find((b: Batch) => b.id === activeBatch.id);
                        if (updatedBatch && updatedBatch.warehouse_received_quantity !== activeBatch.warehouse_received_quantity) {
                            setActiveBatch(prev => prev ? { ...prev, warehouse_received_quantity: updatedBatch.warehouse_received_quantity } : null);
                        }
                    }
                }
            } catch (error) {
                console.error('Polling error:', error);
            }
        }, 2000); // Poll every 2 seconds

        return () => clearInterval(pollInterval);
    }, [activeBatch]);

    const fetchWarehouseBatches = async () => {
        try {
            const response = await fetch('http://localhost:5002/api/warehouse/batches');
            if (response.ok) {
                const data = await response.json();
                setWarehouseBatches(data);
            }
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
            const response = await fetch('http://localhost:5002/api/iqc/batches');
            if (response.ok) {
                const data = await response.json();
                setBatches(data);
            }
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
            const response = await fetch('http://localhost:5002/api/iqc/batches', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    batch_number: batchNumber,
                    created_by: createdBy,
                    quantity: quantity ? parseInt(quantity) : null
                })
            });

            if (response.ok) {
                const newBatch = await response.json();
                showToast(`Batch ${batchNumber} created!`, 'success');
                setBatchNumber('');
                setQuantity('');

                // Auto-start
                setActiveBatch(newBatch);
                setScannerName(createdBy);
                fetchComponents(newBatch.id);
            } else {
                const error = await response.json();
                showToast(error.error || 'Failed to create batch', 'error');
            }
        } catch (error) {
            console.error('Error creating batch:', error);
            showToast('Network error', 'error');
        }
    };

    const handleViewBatch = (batch: Batch) => {
        setScannerName('');
        setActiveBatch(batch);
        fetchComponents(batch.id);
    };

    const fetchComponents = async (batchId: number) => {
        try {
            const response = await fetch(`http://localhost:5002/api/iqc/batches/${batchId}/components`);
            if (response.ok) {
                const data = await response.json();
                setScannedComponents(data);
            }
        } catch (error) {
            console.error('Error fetching components:', error);
        }
    };

    const handleBarcodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setBarcode(val);

        if (!activeBatch || !scannerName) return;

        const trimmed = val.trim().toUpperCase();

        // Check for double scan (concatenated barcode)
        if (trimmed.length > 18) {
            showToast('Invalid Barcode: Too long. Please scan one item at a time.', 'error');
            setBarcode('');
            return;
        }

        // Auto-submit if it matches AY- format (15 chars)
        if (trimmed.startsWith('AY-') && trimmed.length === 15) {
            submitScan(trimmed, false);
        }
        // Auto-submit if it matches SN:AY- format (18 chars)
        else if (trimmed.startsWith('SN:AY-') && trimmed.length === 18) {
            submitScan(trimmed.substring(3), false);
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

    const submitScan = async (code: string, forceMove: boolean) => {
        // Validation: Must start with AY- and be 15 chars
        if (!code.toUpperCase().startsWith('AY-')) {
            showToast('Invalid Barcode. Serial Number must start with "AY-".', 'error');
            setBarcode('');
            return;
        }
        if (code.length !== 15) {
            showToast(`Invalid Barcode Length: ${code.length}. Expected 15 characters.`, 'error');
            setBarcode('');
            return;
        }

        try {
            const response = await fetch('http://localhost:5002/api/iqc/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    batch_id: activeBatch?.id,
                    barcode: code,
                    scanned_by: scannerName,
                    status: 'ACCEPTED', // Always default to ACCEPTED
                    remarks: '',
                    force_move: forceMove
                })
            });

            if (response.ok) {
                const newComponent = await response.json();
                setScannedComponents(prev => {
                    if (prev.some(comp => comp.barcode === newComponent.barcode)) return prev;
                    return [newComponent, ...prev];
                });
                showToast('Component Accepted', 'success');
                setBarcode('');

                // Refresh batches to update counts
                fetchBatches();
            } else {
                const error = await response.json();

                if (response.status === 409 && error.code === 'MOVE_REQUIRED') {
                    if (window.confirm(error.error)) {
                        await submitScan(code, true);
                    } else {
                        setBarcode('');
                    }
                    return;
                }

                showToast(error.error || 'Scan failed', 'error');
                if (response.status === 409) {
                    setBarcode(''); // Clear input on duplicate
                }
            }
        } catch (error) {
            console.error('Error scanning component:', error);
            showToast('Network error', 'error');
        }
    };

    const handleMarkAsFailed = async (component: Component) => {
        const reason = prompt('Enter remarks for rejection:');
        if (!reason) return; // User cancelled or empty

        try {
            const response = await fetch(`http://localhost:5002/api/iqc/components/${component.id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'REJECTED',
                    remarks: reason
                })
            });

            if (response.ok) {
                showToast('Component marked as Failed', 'error'); // Red toast for failure
                // Update local state
                setScannedComponents(prev => prev.map(c =>
                    c.id === component.id ? { ...c, status: 'REJECTED', remarks: reason } : c
                ));
                fetchBatches(); // Update counts
            } else {
                showToast('Failed to update status', 'error');
            }
        } catch (error) {
            console.error('Error updating status:', error);
            showToast('Network error', 'error');
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
            console.log(`Attempting to delete batch ${batchId} with token:`, localStorage.getItem('auth_token'));
            const response = await fetch(`http://localhost:5002/api/iqc/batches/${batchId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });

            console.log('Delete response status:', response.status);
            const data = await response.json();
            console.log('Delete response body:', data);

            if (response.ok) {
                showToast('Batch deleted successfully', 'success');
                fetchBatches();
            } else {
                showToast(`Failed to delete: ${data.error || 'Unknown error'}`, 'error');
                alert(`Delete Failed: ${data.error} (Status: ${response.status})`);
            }
        } catch (error) {
            console.error('Error deleting batch:', error);
            showToast('Network error during deletion', 'error');
            alert(`Network Error: ${error}`);
        }
    };

    // Pagination State
    const [pendingPage, setPendingPage] = useState(1);
    const [completedPage, setCompletedPage] = useState(1);
    const [scannedPage, setScannedPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    // Filtered Batches
    // Filtered Batches
    // Strict Validation: Completed ONLY when (Passed + Failed) equals Warehouse Total Target (Expected Qty)
    // We use warehouse_expected_quantity if available, otherwise fallback to expected_quantity (for legacy/safety)
    const completedBatches = batches.filter(b => (b.passed_count + b.failed_count) >= (b.warehouse_expected_quantity || b.expected_quantity));
    const pendingBatches = batches.filter(b => (b.passed_count + b.failed_count) < (b.warehouse_expected_quantity || b.expected_quantity));

    // Pagination Logic
    const paginatedPendingBatches = pendingBatches.slice((pendingPage - 1) * ITEMS_PER_PAGE, pendingPage * ITEMS_PER_PAGE);
    const paginatedCompletedBatches = completedBatches.slice((completedPage - 1) * ITEMS_PER_PAGE, completedPage * ITEMS_PER_PAGE);
    const paginatedScannedComponents = scannedComponents.slice((scannedPage - 1) * ITEMS_PER_PAGE, scannedPage * ITEMS_PER_PAGE);

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
                                        <th>Total passed QTY</th>
                                        <th>Failed</th>
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
                                            <td className={styles.statusBlue}>{batch.expected_quantity}</td>
                                            <td className={styles.statusGreen}>{batch.passed_count}</td>
                                            <td className={styles.statusRed}>{batch.failed_count}</td>
                                            <td>
                                                <button
                                                    className={styles.secondaryButton}
                                                    onClick={() => window.open(`http://localhost:5002/api/iqc/batches/${batch.id}/download`, '_blank')}
                                                    title="Download CSV Report"
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
                                        <th>Total passed QTY</th>
                                        <th>Failed</th>
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
                                            <td className={styles.statusBlue}>{batch.expected_quantity}</td>
                                            <td className={styles.statusGreen}>{batch.passed_count}</td>
                                            <td className={styles.statusRed}>{batch.failed_count}</td>
                                            <td>
                                                <button
                                                    className={styles.secondaryButton}
                                                    onClick={() => window.open(`http://localhost:5002/api/iqc/batches/${batch.id}/download`, '_blank')}
                                                    title="Download CSV Report"
                                                >
                                                    📥
                                                </button>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
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
                    {/* Active Batch */}
                    <div className={styles.activeBatchHeader}>
                        <div>
                            <h3>{activeBatch.batch_number}</h3>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', fontSize: '0.95rem', color: '#4b5563' }}>
                                <span>Total Scanned: <strong>{scannedComponents.length}</strong> {activeBatch.expected_quantity ? `/ ${activeBatch.expected_quantity}` : ''}</span>
                                <span style={{ color: '#2563eb', fontWeight: 600 }}>🏭 Available: {activeBatch.warehouse_received_quantity || 0}</span>
                                <span style={{ color: '#10b981', fontWeight: 600 }}>✅ Passed: {scannedComponents.filter(c => c.status === 'ACCEPTED').length}</span>
                                <span style={{ color: '#ef4444', fontWeight: 600 }}>❌ Failed: {scannedComponents.filter(c => c.status === 'REJECTED').length}</span>
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
                                    <th>Barcode</th>
                                    <th>Scanned By</th>
                                    <th>Time</th>
                                    <th>Status</th>
                                    <th>Remarks</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedScannedComponents.map(comp => (
                                    <tr key={comp.id}>
                                        <td style={{ fontWeight: 600 }}>{comp.barcode}</td>
                                        <td>{comp.scanned_by}</td>
                                        <td>{new Date(comp.scanned_at).toLocaleTimeString()}</td>
                                        <td className={comp.status === 'ACCEPTED' ? styles.statusGreen : styles.statusRed}>
                                            {comp.status}
                                        </td>
                                        <td>{comp.remarks || '-'}</td>
                                        <td>
                                            {comp.status === 'ACCEPTED' && (
                                                <button
                                                    className={styles.deleteTextButton}
                                                    onClick={() => handleMarkAsFailed(comp)}
                                                >
                                                    Mark as Failed
                                                </button>
                                            )}
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
            )}
        </div>
    );
};
