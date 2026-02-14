import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import styles from './Warehouse.module.css';
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
    extra_quantity: number;
    shortage_quantity: number;
}

interface Scan {
    id: number;
    barcode: string;
    scanned_by: string;
    scanned_at: string;
    previous_batch?: string;
}

export const Warehouse: React.FC = () => {
    const { user } = useAuth();
    const [batches, setBatches] = useState<Batch[]>([]);
    const [activeBatch, setActiveBatch] = useState<Batch | null>(null);
    const [scannedItems, setScannedItems] = useState<Scan[]>([]);

    // Create Batch State
    const [createdBy, setCreatedBy] = useState('');
    const [batchSuffix, setBatchSuffix] = useState('');
    const [expectedQty, setExpectedQty] = useState('');

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
            const data = await apiFetch(`/api/pretest/warehouse/search?barcode=${encodeURIComponent(searchQuery.trim())}`);
            // If multiple results (history), show the latest one
            setSearchResult(data[0]);
            showToast('Item found!', 'success');
            setIsSearchExpanded(false);
            setSearchQuery('');
        } catch (error) {
            console.error('Search error:', error);
            showToast('Item not found or network error', 'error');
            setSearchResult(null);
        }
    };

    // Auto-generate Batch Prefix: PREVEYYYYMMDD-
    const getBatchPrefix = () => {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `PREVE${year}${month}${day}-`;
    };

    const batchPrefix = getBatchPrefix();

    useEffect(() => {
        if (!activeBatch) {
            fetchBatches();
        }
    }, [activeBatch]); // Refresh batches when session ends

    const fetchBatches = async () => {
        try {
            const data = await apiFetch('/api/pretest/warehouse/batches');
            if (data) setBatches(data);
        } catch (error) {
            console.error('Error fetching batches:', error);
            showToast('Failed to load batches', 'error');
        }
    };

    const handleCreateBatch = async () => {
        if (!createdBy || !batchSuffix || !expectedQty) {
            showToast('All fields are mandatory', 'error');
            return;
        }

        if (!/^\d{1,5}$/.test(batchSuffix)) {
            showToast('Batch suffix must be 1-5 digits', 'error');
            return;
        }

        const batchNumber = `${batchPrefix}${batchSuffix.padStart(5, '0')}`;

        try {
            const newBatch = await apiFetch('/api/pretest/warehouse/batches', {
                method: 'POST',
                body: JSON.stringify({
                    batch_number: batchNumber,
                    created_by: createdBy,
                    expected_quantity: parseInt(expectedQty)
                })
            });

            showToast(`Batch ${batchNumber} created!`, 'success');
            setBatchSuffix('');
            setExpectedQty('');

            // Auto-start scanning
            setActiveBatch(newBatch);
            setScannerName(createdBy);
            fetchScans(newBatch.id);
        } catch (error: any) {
            console.error('Error creating batch:', error);
            showToast(error.message || 'Failed to create batch', 'error');
        }
    };

    const handleViewBatch = async (batch: Batch) => {
        // Clear scanner name on resume so user must enter it
        setScannerName('');
        setActiveBatch(batch);
        fetchScans(batch.id);
    };

    const fetchScans = async (batchId: number) => {
        try {
            const data = await apiFetch(`/api/pretest/warehouse/batches/${batchId}/scans`);
            if (data) setScannedItems(data);
        } catch (error) {
            console.error('Error fetching scans:', error);
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
            submitScan(trimmed);
        }
        // Auto-submit if it matches SN:AY- format (18 chars)
        else if (trimmed.startsWith('SN:AY-') && trimmed.length === 18) {
            submitScan(trimmed.substring(3));
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

        await submitScan(finalBarcode);
    };

    const isSubmitting = React.useRef(false);

    const submitScan = async (code: string) => {
        if (isSubmitting.current) return;

        // 1. Check for Part Number (PN)
        if (code.toUpperCase().startsWith('PN:')) {
            showToast('Invalid Barcode. You scanned a Part Number (PN). Please scan the Serial Number (SN).', 'error');
            setBarcode('');
            return;
        }

        // 2. Validate it starts with AY-
        if (!code.toUpperCase().startsWith('AY-')) {
            showToast('Invalid Barcode. Serial Number must start with "AY-".', 'error');
            setBarcode('');
            return;
        }

        // 3. Validate Length (Must be exactly 15 chars)
        if (code.length !== 15) {
            showToast(`Invalid Barcode Length: ${code.length}. Expected 15 characters.`, 'error');
            setBarcode('');
            return;
        }

        isSubmitting.current = true;

        try {
            const newScan = await apiFetch('/api/pretest/warehouse/scan', {
                method: 'POST',
                body: JSON.stringify({
                    batch_id: activeBatch?.id,
                    barcode: code,
                    scanned_by: scannerName
                })
            });

            setScannedItems(prev => {
                // Double check to prevent UI duplication if race condition occurs
                if (prev.some(item => item.barcode === newScan.barcode)) return prev;
                return [newScan, ...prev];
            });
            showToast('Item scanned', 'success');
            setBarcode('');
        } catch (error: any) {
            console.error('Error scanning item:', error);
            showToast(error.message || 'Scan failed', 'error');
            if (error.message && error.message.includes('duplicate')) { // Assuming error message contains 'duplicate' or we check status code if apiFetch threw specific error
                setBarcode('');
            }
        } finally {
            // Small delay to ensure the 'Enter' key event from scanner is fully processed
            setTimeout(() => {
                isSubmitting.current = false;
            }, 500);
        }
    };

    // Pagination State
    const [batchesPage, setBatchesPage] = useState(1);
    const [scansPage, setScansPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    // Pagination Logic
    const paginatedBatches = batches.slice((batchesPage - 1) * ITEMS_PER_PAGE, batchesPage * ITEMS_PER_PAGE);
    const paginatedScannedItems = scannedItems.slice((scansPage - 1) * ITEMS_PER_PAGE, scansPage * ITEMS_PER_PAGE);

    return (
        <div className={styles.container}>
            <div className={styles.headerRow}>
                <div className={styles.headerContent}>
                    <h2><span role="img" aria-label="factory">🏭</span> Warehouse Management</h2>
                    <p>Manage incoming material batches and verify quantities.</p>
                </div>
                <div className={styles.searchWrapper}>
                    {!isSearchExpanded ? (
                        <button
                            className={styles.searchIconBtn}
                            onClick={() => setIsSearchExpanded(true)}
                            title="Search Item"
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
                        <h3>Item Found!</h3>
                        <div className={styles.resultGrid}>
                            <p><strong>Barcode:</strong> {searchResult.barcode}</p>
                            <p><strong>Batch Number:</strong> <span className={styles.highlight}>{searchResult.batch_number}</span></p>
                            <p><strong>Scanned By:</strong> {searchResult.scanned_by}</p>
                            <p><strong>Scanned At:</strong> {new Date(searchResult.scanned_at).toLocaleString()}</p>
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
                    {/* Create Batch Card */}
                    <div className={styles.card}>
                        <h3>Create New Batch</h3>
                        <div className={styles.formGrid}>
                            <div className={styles.inputGroup}>
                                <label>Batch Number *</label>
                                <div className={styles.batchInputWrapper}>
                                    <span className={styles.batchPrefix}>{batchPrefix}</span>
                                    <input
                                        type="text"
                                        className={styles.batchSuffixInput}
                                        placeholder="XXXXX"
                                        maxLength={5}
                                        value={batchSuffix}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, '');
                                            setBatchSuffix(val);
                                        }}
                                    />
                                </div>
                                <small style={{ color: '#6b7280' }}>Enter 5-digit sequence (e.g., 00025)</small>
                            </div>

                            <div className={styles.inputGroup}>
                                <label>Received Qty *</label>
                                <input
                                    type="number"
                                    className={styles.input}
                                    placeholder="Enter Quantity"
                                    min="1"
                                    value={expectedQty}
                                    onChange={(e) => setExpectedQty(e.target.value)}
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

                    {/* Recent Batches Table */}
                    <div className={styles.card}>
                        <h3>Recent Batches</h3>
                        <div className={styles.tableContainer}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Batch Number</th>
                                        <th>Created By</th>
                                        <th>Date</th>
                                        <th>Received Qty</th>
                                        <th>Extra Qty</th>
                                        <th>Shortage Qty</th>
                                        <th>Total Count</th>
                                        <th>Download</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedBatches.map(batch => (
                                        <tr key={batch.id}>
                                            <td style={{ fontWeight: 600 }}>{batch.batch_number}</td>
                                            <td>{batch.created_by}</td>
                                            <td>{new Date(batch.created_at).toLocaleDateString()}</td>
                                            <td className={styles.statusBlue}>
                                                {batch.expected_quantity}
                                            </td>
                                            <td className={batch.extra_quantity > 0 ? styles.statusYellow : ''}>
                                                {batch.extra_quantity > 0 ? `+${batch.extra_quantity}` : '-'}
                                            </td>
                                            <td className={batch.shortage_quantity > 0 ? styles.statusRed : ''}>
                                                {batch.shortage_quantity > 0 ? `-${batch.shortage_quantity}` : '-'}
                                            </td>
                                            <td className={styles.statusGreen}>
                                                {batch.received_quantity}
                                            </td>
                                            <td>
                                                <button
                                                    className={styles.secondaryButton}
                                                    onClick={async () => {
                                                        try {
                                                            const blob = await apiFetch(`/api/pretest/warehouse/batches/${batch.id}/download`);
                                                            const url = window.URL.createObjectURL(blob);
                                                            const link = document.createElement('a');
                                                            link.href = url;

                                                            const now = new Date();
                                                            const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-');
                                                            const cleanBatch = batch.batch_number.replace(/[^a-zA-Z0-9_-]/g, '_');
                                                            const fileName = `Warehouse_Report_${cleanBatch}_${timestamp}.xlsx`;

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
                                                        onClick={async () => {
                                                            console.log('Current User:', user);
                                                            if (user?.role !== 'Admin' && user?.role !== 'Super Admin' && user?.role !== 'Manager') {
                                                                alert(`Only Admin, Super Admin, or Manager can delete this batch. Your role: ${user?.role}`);
                                                                return;
                                                            }

                                                            const confirm1 = window.confirm('Are you sure you want to delete this batch? This will remove all associated scans.');
                                                            if (!confirm1) return;

                                                            const confirm2 = window.confirm('⚠️ FINAL WARNING: This action cannot be undone. Are you absolutely sure?');
                                                            if (!confirm2) return;

                                                            try {
                                                                console.log(`Attempting to delete batch ${batch.id}`);
                                                                await apiFetch(`/api/pretest/warehouse/batches/${batch.id}`, {
                                                                    method: 'DELETE'
                                                                });

                                                                showToast('Batch deleted successfully', 'success');
                                                                fetchBatches();
                                                            } catch (err: any) {
                                                                console.error('Network error during deletion:', err);
                                                                showToast('Error during deletion: ' + err.message, 'error');
                                                                alert(`Delete Failed: ${err.message}`);
                                                            }
                                                        }}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {batches.length === 0 && (
                                        <tr>
                                            <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                                                No batches found. Create one to get started.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                            <Pagination
                                currentPage={batchesPage}
                                totalPages={Math.ceil(batches.length / ITEMS_PER_PAGE)}
                                onPageChange={setBatchesPage}
                            />
                        </div>
                    </div>
                </>
            ) : (
                <>
                    {/* Active Batch View */}
                    <div className={styles.activeBatchHeader}>
                        <div>
                            <h3>{activeBatch.batch_number}</h3>
                            <small>Expected: {activeBatch.expected_quantity} | Created by: {activeBatch.created_by}</small>
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
                            <input
                                type="text"
                                className={styles.scanInput}
                                placeholder="Scan Item Barcode..."
                                value={barcode}
                                onChange={handleBarcodeChange}
                                autoFocus
                            />
                            <button type="submit" className={styles.scanButton}>
                                SCAN
                            </button>
                        </form>

                        <h3>Scanned Items ({scannedItems.length})</h3>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Barcode</th>
                                    <th>Scanned By</th>
                                    <th>Time</th>
                                    <th>Previous Batch</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedScannedItems.map(scan => (
                                    <tr key={scan.id}>
                                        <td style={{ fontWeight: 600 }}>{scan.barcode}</td>
                                        <td>{scan.scanned_by}</td>
                                        <td>{new Date(scan.scanned_at).toLocaleTimeString()}</td>
                                        <td>
                                            {scan.previous_batch ? (
                                                <span style={{ color: '#ea580c', fontWeight: 600, fontSize: '0.9rem' }}>
                                                    {scan.previous_batch}
                                                </span>
                                            ) : (
                                                <span style={{ color: '#9ca3af' }}>-</span>
                                            )}
                                        </td>
                                        <td className={styles.statusGreen}>ACCEPTED</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <Pagination
                            currentPage={scansPage}
                            totalPages={Math.ceil(scannedItems.length / ITEMS_PER_PAGE)}
                            onPageChange={setScansPage}
                        />
                    </div>
                </>
            )}
        </div>
    );
};
