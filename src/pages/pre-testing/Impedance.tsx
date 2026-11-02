import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../../utils/api';
import styles from './Impedance.module.css';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../hooks/useAuth';
import { Pagination } from '../../components/Pagination';

interface Batch {
    id: number;
    batch_number: string;
    quantity: number;
    created_at: string;
    scan_count?: number;
    last_tested_by?: string;
    last_active?: string;
    passed_count?: number;
    failed_count?: number;
    iqc_passed_count?: number;
    warehouse_received_quantity?: number;
    tested_by?: string;
    started_at?: string;
}

export const Impedance: React.FC = () => {
    const [userName, setUserName] = useState<string>('');
    const [isSessionActive, setIsSessionActive] = useState<boolean>(false);
    const [barcode, setBarcode] = useState<string>('');
    const [scannedItems, setScannedItems] = useState<any[]>([]);
    const [batches, setBatches] = useState<Batch[]>([]);
    const [iqcBatches, setIQCBatches] = useState<any[]>([]);
    const [selectedIQCBatch, setSelectedIQCBatch] = useState<string>('');
    const [quantity, setQuantity] = useState<number | string>('');
    const [currentBatchId, setCurrentBatchId] = useState<number | null>(null);
    const { showToast } = useToast();
    const { user } = useAuth();
    const scanLock = useRef(false);

    // Pagination State
    const [pendingPage, setPendingPage] = useState(1);
    const [completedPage, setCompletedPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    // Fail Modal State
    const [failModalOpen, setFailModalOpen] = useState(false);
    const [selectedScan] = useState<any>(null);
    const [failremarks, setFailremarks] = useState('');

    // Dropdown State
    const [openDropdown, setOpenDropdown] = useState<{ id: number, test: string } | null>(null);

    // Scan Modal State
    const [scanModalOpen, setScanModalOpen] = useState(false);
    const [pendingBarcode, setPendingBarcode] = useState('');
    const [scanTestResults, setScanTestResults] = useState({
        test_pa1: true,
        test_pa2: true,
        test_pa4: true,
        test_pa5: true,
        test_r160: true
    });

    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResult, setSearchResult] = useState<any | null>(null);
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const [barcodeFilter, setBarcodeFilter] = useState("");
    const [showBarcodeFilter, setShowBarcodeFilter] = useState(false);

    // View Batch Details State
    const [viewBatch, setViewBatch] = useState<Batch | null>(null);
    const [viewBatchScans] = useState<any[]>([]);



    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            showToast('Please enter a barcode', 'error');
            return;
        }

        try {
            const data = await apiFetch(`/api/pretest/impedance/search?barcode=${encodeURIComponent(searchQuery.trim())}`);
            setSearchResult(data);
            showToast('Component found!', 'success');
            setIsSearchExpanded(false);
            setSearchQuery('');
        } catch (error) {
            console.error('Search error:', error);
            showToast('Component not found or network error', 'error');
            setSearchResult(null);
        }
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setOpenDropdown(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const handleTestUpdate = async (item: any, testKey: string, result: boolean) => {
        setOpenDropdown(null); // Close dropdown

        // Optimistic update
        setScannedItems(prev => prev.map(s =>
            s.id === item.id ? { ...s, [testKey]: result } : s
        ));

        try {
            const updatedScan = await apiFetch(`/api/pretest/impedance/scans/${item.id}/test`, {
                method: 'PUT',
                body: JSON.stringify({ test_name: testKey, result: result })
            });

            setScannedItems(prev => prev.map(s =>
                s.id === item.id ? updatedScan : s
            ));
            fetchBatches(); // Update counts
        } catch (error) {
            console.error('Error updating test:', error);
            showToast('Failed to update test', 'error');
            // Revert on failure
            setScannedItems(prev => prev.map(s =>
                s.id === item.id ? { ...s, [testKey]: !result } : s
            ));
        }
    };



    const handleFailConfirm = async () => {
        if (!selectedScan) return;
        if (!failremarks.trim()) {
            showToast('Please enter a remarks for failure', 'error');
            return;
        }

        try {
            await apiFetch(`/api/pretest/impedance/scans/${selectedScan.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    status: 'FAILED',
                    remarks: failremarks
                })
            });

            showToast('PCB marked as FAILED', 'success');
            setFailModalOpen(false);

            // Update local state
            setScannedItems(prev => prev.map(item =>
                item.id === selectedScan.id
                    ? { ...item, status: 'FAILED', remarks: failremarks }
                    : item
            ));
            fetchBatches(); // Update batch counts
        } catch (error) {
            console.error('Error updating scan:', error);
            showToast('Failed to update status', 'error');
        }
    };

    // Fetch batches on mount and when session ends
    useEffect(() => {
        fetchBatches();
        fetchIQCBatches();
    }, [isSessionActive]);

    // Polling for real-time updates (Sync with IQC)
    useEffect(() => {
        const intervalId = setInterval(() => {
            fetchBatches(); // Keep batch counts updated

            // Poll for available IQC batches if on the creation screen
            if (!isSessionActive) {
                fetchIQCBatches();
            }

            if (isSessionActive && currentBatchId) {
                fetchSessionScans(currentBatchId); // Keep scan list updated (handle rollbacks)
            }
        }, 15000); // Poll every 15 seconds

        return () => clearInterval(intervalId);
    }, [isSessionActive, currentBatchId]);

    // Fetch scans when entering a session
    useEffect(() => {
        console.log('Session Active State Changed:', { currentBatchId, isSessionActive });
        if (currentBatchId && isSessionActive) {
            console.log('Fetching scans for session:', currentBatchId);
            fetchSessionScans(currentBatchId);
        } else {
            setScannedItems([]);
        }
    }, [currentBatchId, isSessionActive]);

    const fetchSessionScans = async (sessionId: number) => {
        try {
            console.log(`Making API call to: /api/pretest/impedance/sessions/${sessionId}/scans`);
            const data = await apiFetch(`/api/pretest/impedance/sessions/${sessionId}/scans`);
            console.log('Fetched scans data:', data);
            setScannedItems(data);
        } catch (error) {
            console.error('Error fetching scans:', error);
            showToast('Failed to load scans', 'error');
        }
    };

    const fetchIQCBatches = async () => {
        try {
            const data = await apiFetch('/api/pretest/impedance/iqc-batches');
            setIQCBatches(data);
        } catch (error) {
            console.error('Error fetching IQC batches:', error);
        }
    };

    const fetchBatches = async () => {
        try {
            const data = await apiFetch('/api/pretest/impedance/batches', { cache: 'no-store' });
            setBatches(data);
        } catch (error) {
            console.error('Error fetching batches:', error);
        }
    };

    const handleIQCBatchSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const batchId = e.target.value;
        setSelectedIQCBatch(batchId);
        const batch = iqcBatches.find(b => b.id.toString() === batchId);
        if (batch) {
            setQuantity(batch.passed_count);
        } else {
            setQuantity('');
        }
    };

    const handleCreateBatch = async () => {
        if (!selectedIQCBatch || !userName.trim()) {
            showToast('Please select a batch and enter Operator Name', 'error');
            return;
        }

        try {
            const newBatch = await apiFetch('/api/pretest/impedance/batches', {
                method: 'POST',
                body: JSON.stringify({
                    iqc_batch_id: selectedIQCBatch,
                    created_by: userName
                })
            });

            setCurrentBatchId(newBatch.id);
            setIsSessionActive(true); // Automatically start session
            showToast('Impedance Batch Created', 'success');

            // Clear form
            setSelectedIQCBatch('');
            setQuantity('');

            fetchBatches();
            fetchIQCBatches();
        } catch (error) {
            console.error('Error creating batch:', error);
            showToast('Failed to create batch', 'error');
        }
    };

    const handleScan = (input: React.FormEvent | string) => {
        if (scanLock.current) return;
        scanLock.current = true;
        setTimeout(() => { scanLock.current = false; }, 2000);

        let scannedBarcode = '';
        if (typeof input === 'string') {
            scannedBarcode = input;
        } else {
            input.preventDefault();
            scannedBarcode = barcode.trim();
        }

        if (!scannedBarcode) return;

        if (!userName.trim()) {
            showToast('Please enter Scanned By name', 'error');
            return;
        }

        let coreBarcode = scannedBarcode.trim().toUpperCase();
        if (coreBarcode.startsWith('SN:')) {
            coreBarcode = coreBarcode.substring(3).trim();
        }

        const BARCODE_REGEX = /^[A-Z]{2}-[A-Z0-9]{4}-[A-Z0-9]{2}-[A-Z0-9]{4}$/;
        if (!BARCODE_REGEX.test(coreBarcode)) {
            showToast('Invalid Barcode format. Must be 15 characters (e.g. AO-4734-34-2344)', 'error');
            setBarcode('');
            return;
        }

        // Prevent duplicate processing if modal is already open for this barcode
        if (scanModalOpen && pendingBarcode === coreBarcode) {
            return;
        }

        setPendingBarcode(coreBarcode);
        setScanModalOpen(true);
        setBarcode(''); // Clear input immediately for next scan
    };


    const handleScanConfirm = async () => {
        try {
            const result = await apiFetch('/api/pretest/impedance/scan', {
                method: 'POST',
                body: JSON.stringify({
                    session_id: currentBatchId,
                    barcode: pendingBarcode,
                    tested_by: userName,
                    ...scanTestResults
                })
            });

            showToast(`Assigned to ${result.batch_number}`, 'success');
            setScannedItems(prev => [result, ...prev]);
            fetchBatches(); // Update counts in background
            setScanModalOpen(false);
        } catch (error: any) {
            console.error('Error scanning PCB:', error);
            if (error.message && error.message.toLowerCase().includes('duplicate')) {
                // Silent
            } else {
                showToast(error.message || 'Scan Failed', 'error');
            }
        }
    };

    const handleScanCancel = () => {
        setScanModalOpen(false);
        setPendingBarcode('');
        showToast('Scan cancelled', 'info');
    };

    // Filter and Paginate Batches
    // Dynamic State: Pending if Scanned < IQC Passed or IQC is 0, Completed if Scanned >= IQC Passed & IQC > 0
    const pendingBatches = batches.filter(b => (b.iqc_passed_count || 0) === 0 || (b.scan_count || 0) < (b.iqc_passed_count || 0));
    const completedBatches = batches.filter(b => (b.scan_count || 0) >= (b.iqc_passed_count || 0) && (b.iqc_passed_count || 0) > 0);

    const paginatedPendingBatches = pendingBatches.slice((pendingPage - 1) * ITEMS_PER_PAGE, pendingPage * ITEMS_PER_PAGE);
    const paginatedCompletedBatches = completedBatches.slice((completedPage - 1) * ITEMS_PER_PAGE, completedPage * ITEMS_PER_PAGE);

    const activeBatch = batches.find(b => b.id === currentBatchId);

    return (
        <div className={styles.container}>
            <div className={styles.headerRow}>
                <div className={styles.headerContent}>
                    <h2><span role="img" aria-label="icon">⚡</span> Impedance Testing</h2>
                    <p>Measure and verify impedance characteristics of PCBs.</p>
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

            {/* Search Result Modal (Traceability View) */}
            {searchResult && (
                <div className={styles.modalOverlay} onClick={() => setSearchResult(null)}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <h3>Traceability View</h3>
                        <div className={styles.resultGrid}>
                            <p><strong>Barcode:</strong> {searchResult.barcode}</p>

                            {/* Warehouse Status */}
                            <div style={{ padding: '0.75rem', background: '#f0f9ff', borderRadius: '0.5rem', border: '1px solid #bae6fd' }}>
                                <h4 style={{ margin: '0 0 0.5rem 0', color: '#0369a1' }}>📦 Warehouse</h4>
                                <p style={{ background: 'transparent', padding: '0.25rem 0' }}><strong>Batch:</strong> {searchResult.warehouse?.batch_number || 'N/A'}</p>
                                <p style={{ background: 'transparent', padding: '0.25rem 0' }}><strong>Status:</strong> <span className={styles.statusBlue}>{searchResult.warehouse?.status}</span></p>
                                {searchResult.warehouse?.scanned_at && (
                                    <p style={{ background: 'transparent', padding: '0.25rem 0' }}><strong>Time:</strong> {new Date(searchResult.warehouse.scanned_at).toLocaleString()}</p>
                                )}
                            </div>

                            {/* IQC Status */}
                            <div style={{ padding: '0.75rem', background: '#fdf4ff', borderRadius: '0.5rem', border: '1px solid #f0abfc' }}>
                                <h4 style={{ margin: '0 0 0.5rem 0', color: '#a21caf' }}>🔍 IQC</h4>
                                <p style={{ background: 'transparent', padding: '0.25rem 0' }}><strong>Batch:</strong> {searchResult.iqc?.batch_number || 'N/A'}</p>
                                <p style={{ background: 'transparent', padding: '0.25rem 0' }}><strong>Status:</strong>
                                    <span className={
                                        searchResult.iqc?.status === 'ACCEPTED' ? styles.statusGreen :
                                            searchResult.iqc?.status === 'REJECTED' ? styles.statusRed : styles.statusYellow
                                    }>
                                        {searchResult.iqc?.status || 'Pending'}
                                    </span>
                                </p>
                                {searchResult.iqc?.scanned_at && (
                                    <p style={{ background: 'transparent', padding: '0.25rem 0' }}><strong>Time:</strong> {new Date(searchResult.iqc.scanned_at).toLocaleString()}</p>
                                )}
                            </div>

                            {/* Impedance Status */}
                            <div style={{ padding: '0.75rem', background: '#fff7ed', borderRadius: '0.5rem', border: '1px solid #fdba74' }}>
                                <h4 style={{ margin: '0 0 0.5rem 0', color: '#c2410c' }}>⚡ Impedance</h4>
                                <p style={{ background: 'transparent', padding: '0.25rem 0' }}><strong>Status:</strong>
                                    <span className={
                                        searchResult.impedance?.status === 'Passed' ? styles.statusGreen :
                                            searchResult.impedance?.status?.includes('Failed') ? styles.statusRed : styles.statusYellow
                                    }>
                                        {searchResult.impedance?.status || 'Pending'}
                                    </span>
                                </p>
                                {searchResult.impedance?.scanned_at && (
                                    <p style={{ background: 'transparent', padding: '0.25rem 0' }}><strong>Time:</strong> {new Date(searchResult.impedance.scanned_at).toLocaleString()}</p>
                                )}
                            </div>

                        </div>
                        <button className={styles.secondaryButton} onClick={() => setSearchResult(null)} style={{ marginTop: '1rem', width: '100%' }}>
                            Close
                        </button>
                    </div>
                </div>
            )}

            {/* View Batch Details Modal */}
            {viewBatch && (
                <div className={styles.modalOverlay} onClick={() => setViewBatch(null)}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '90%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3>Batch: <span className={styles.highlight}>{viewBatch.batch_number}</span></h3>
                            <button onClick={() => setViewBatch(null)} className={styles.closeBtn} style={{ fontSize: '1.5rem' }}>×</button>
                        </div>

                        <div style={{
                            display: 'flex',
                            gap: '2rem',
                            padding: '1rem',
                            backgroundColor: '#f9fafb',
                            borderRadius: '0.5rem',
                            marginBottom: '1rem',
                            flexWrap: 'wrap',
                            fontSize: '1.1rem',
                            border: '1px solid #e5e7eb'
                        }}>
                            <div style={{ fontWeight: 600 }}>
                                Total Scanned: <span style={{ fontSize: '1.2rem' }}>{(viewBatch.passed_count || 0) + (viewBatch.failed_count || 0)}</span> / {viewBatch.iqc_passed_count || 0}
                            </div>
                            <div style={{ color: '#2563eb', fontWeight: 600 }}>
                                🏭 Available: {viewBatch.iqc_passed_count || 0}
                            </div>
                            <div style={{ color: '#10b981', fontWeight: 600 }}>
                                ✅ Passed: {viewBatch.passed_count || 0}
                            </div>
                            <div style={{ color: '#ef4444', fontWeight: 600 }}>
                                ❌ Failed: {viewBatch.failed_count || 0}
                            </div>
                        </div>

                        <div className={styles.tableContainer} style={{ maxHeight: '400px', overflowY: 'auto' }}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Barcode</th>
                                        <th>Scanned By</th>
                                        <th>PA_1(1V)</th>
                                        <th>PA_2(1V)</th>
                                        <th>PA_4(0.5V)</th>
                                        <th>PA_5(0.5V)</th>
                                        <th>R160(0.5V)</th>
                                        <th>Status</th>
                                        <th>Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {viewBatchScans.map((scan, index) => (
                                        <tr key={index}>
                                            <td style={{ fontWeight: 500 }}>{scan.barcode}</td>
                                            <td>{scan.tested_by || '-'}</td>
                                            <td style={{ textAlign: 'center' }}>{scan.test_pa1 ? '✅' : '❌'}</td>
                                            <td style={{ textAlign: 'center' }}>{scan.test_pa2 ? '✅' : '❌'}</td>
                                            <td style={{ textAlign: 'center' }}>{scan.test_pa4 ? '✅' : '❌'}</td>
                                            <td style={{ textAlign: 'center' }}>{scan.test_pa5 ? '✅' : '❌'}</td>
                                            <td style={{ textAlign: 'center' }}>{scan.test_r160 ? '✅' : '❌'}</td>
                                            <td>
                                                <span className={scan.status === 'ACCEPTED' ? styles.statusGreen : styles.statusRed}>
                                                    {scan.status === 'ACCEPTED' ? 'PASS' : 'FAIL'}
                                                </span>
                                            </td>
                                            <td>{new Date(scan.scanned_at).toLocaleTimeString()}</td>
                                        </tr>
                                    ))}
                                    {viewBatchScans.length === 0 && (
                                        <tr>
                                            <td colSpan={9} style={{ textAlign: 'center', padding: '1rem' }}>No scans found for this batch.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                            <button className={styles.secondaryButton} onClick={() => setViewBatch(null)}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {!isSessionActive ? (
                <>
                    <div className={styles.card}>
                        <h3>Create New Impedance Batch</h3>
                        <div className={styles.formGrid}>
                            <div className={styles.inputGroup}>
                                <label>Select IQC Batch *</label>
                                <select
                                    className={styles.batchSelect}
                                    value={selectedIQCBatch}
                                    onChange={handleIQCBatchSelect}
                                >
                                    <option value="">-- Select Batch --</option>
                                    {iqcBatches.map(batch => (
                                        <option key={batch.id} value={batch.id}>
                                            {batch.batch_number}
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
                                    value={userName}
                                    onChange={(e) => setUserName(e.target.value)}
                                />
                            </div>
                        </div>
                        <button
                            className={styles.button}
                            onClick={handleCreateBatch}
                            style={{ marginTop: '2rem' }}
                        >
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
                                        <th>Failed</th>
                                        <th>Download</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedPendingBatches.map(batch => (
                                        <tr key={batch.id}>
                                            <td style={{ fontWeight: 600 }}>{batch.batch_number}</td>
                                            <td>{batch.tested_by || batch.last_tested_by}</td>
                                            <td>{new Date(batch.created_at || batch.started_at || '').toLocaleDateString()}</td>
                                            <td className={styles.statusBlue}>{batch.scan_count || 0} / {batch.iqc_passed_count}</td>
                                            <td className={styles.statusGreen}>{batch.passed_count || 0}</td>
                                            <td className={styles.statusRed}>{batch.failed_count || 0}</td>
                                            <td>
                                                <button
                                                    className={styles.secondaryButton}
                                                    onClick={async () => {
                                                        try {
                                                            const blob = await apiFetch(`/api/pretest/impedance/batches/${batch.id}/download`);
                                                            const url = window.URL.createObjectURL(blob);
                                                            const link = document.createElement('a');
                                                            link.href = url;

                                                            const now = new Date();
                                                            const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-');
                                                            const cleanBatch = batch.batch_number.replace(/[^a-zA-Z0-9_-]/g, '_');
                                                            const fileName = `Impedance_Report_${cleanBatch}_${timestamp}.xlsx`;

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
                                                        onClick={() => {
                                                            setCurrentBatchId(batch.id);
                                                            setUserName(''); // Clear name to force re-entry
                                                            setIsSessionActive(true);
                                                        }}
                                                    >
                                                        Resume
                                                    </button>
                                                    {['admin', 'super admin', 'manager'].includes(user?.role?.toLowerCase() || '') && (
                                                        <button
                                                            className={styles.deleteTextButton}
                                                            onClick={async () => {
                                                                const confirm1 = window.confirm('Are you sure you want to remove this batch from Impedance? This will delete all IMPEDANCE scans.');
                                                                if (!confirm1) return;

                                                                const confirm2 = window.confirm('⚠️ FINAL WARNING: This will NOT delete the IQC batch, but all Impedance progress will be lost. Continue?');
                                                                if (!confirm2) return;

                                                                try {
                                                                    await apiFetch(`/api/pretest/impedance/batches/${batch.id}`, {
                                                                        method: 'DELETE',
                                                                    });

                                                                    showToast('Impedance data cleared successfully', 'success');
                                                                    fetchBatches();
                                                                } catch (error) {
                                                                    console.error('Error deleting batch:', error);
                                                                    showToast('Failed to delete batch', 'error');
                                                                }
                                                            }}
                                                        >
                                                            Delete
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {pendingBatches.length === 0 && (
                                        <tr>
                                            <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
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
                                        <th>Failed</th>
                                        <th>Download</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedCompletedBatches.map(batch => (
                                        <tr key={batch.id}>
                                            <td style={{ fontWeight: 600 }}>{batch.batch_number}</td>
                                            <td>{batch.tested_by || batch.last_tested_by}</td>
                                            <td>{new Date(batch.created_at || batch.started_at || '').toLocaleDateString()}</td>
                                            <td className={styles.statusBlue}>{(batch.passed_count || 0) + (batch.failed_count || 0)} / {batch.iqc_passed_count}</td>
                                            <td className={styles.statusGreen}>{batch.passed_count || 0}</td>
                                            <td className={styles.statusRed}>{batch.failed_count || 0}</td>
                                            <td>
                                                <button
                                                    className={styles.secondaryButton}
                                                    onClick={async () => {
                                                        try {
                                                            const blob = await apiFetch(`/api/pretest/impedance/batches/${batch.id}/download`, {
                                                                headers: { 'Accept': 'application/blob' }
                                                            });
                                                            const url = window.URL.createObjectURL(blob);
                                                            window.open(url, '_blank');
                                                            setTimeout(() => window.URL.revokeObjectURL(url), 100);
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
                                                    <button
                                                        className={styles.secondaryButton}
                                                        onClick={() => {
                                                            setCurrentBatchId(batch.id);
                                                            setUserName(''); // Clear name
                                                            setIsSessionActive(true);
                                                            // We might need a way to signal "read-only" or "completed view" if we want to hide the scan input, 
                                                            // but the user asked for "same how the pending batch show", so opening the session view is the correct first step.
                                                            // If the batch is completed, they probably shouldn't scan more, but the logic handles that (completed batches move to completed list).
                                                            // If they view a completed batch, they see the list.
                                                        }}
                                                    >
                                                        View
                                                    </button>
                                                    {['Admin', 'Super Admin', 'Manager'].includes(user?.role || '') && (
                                                        <button
                                                            className={styles.deleteTextButton}
                                                            onClick={async () => {
                                                                const confirm1 = window.confirm('Are you sure you want to remove this batch from Impedance? This will delete all IMPEDANCE scans.');
                                                                if (!confirm1) return;

                                                                const confirm2 = window.confirm('⚠️ FINAL WARNING: This will NOT delete the IQC batch, but all Impedance progress will be lost. Continue?');
                                                                if (!confirm2) return;

                                                                try {
                                                                    await apiFetch(`/api/pretest/impedance/batches/${batch.id}`, {
                                                                        method: 'DELETE',
                                                                    });

                                                                    showToast('Impedance data cleared successfully', 'success');
                                                                    fetchBatches();
                                                                } catch (error) {
                                                                    console.error('Error deleting batch:', error);
                                                                    showToast('Failed to delete batch', 'error');
                                                                }
                                                            }}
                                                        >
                                                            Delete
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {completedBatches.length === 0 && (
                                        <tr>
                                            <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
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
                            <h3>Active Batch: <span className={styles.highlight}>{activeBatch?.batch_number}</span></h3>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            {!completedBatches.some(b => b.id === currentBatchId) && (
                                <button
                                    className={styles.secondaryButton}
                                    onClick={() => {
                                        if (currentBatchId) fetchSessionScans(currentBatchId);
                                    }}
                                >
                                    🔄 Refresh
                                </button>
                            )}
                            <button
                                className={styles.secondaryButton}
                                onClick={() => setIsSessionActive(false)}
                            >
                                End Session
                            </button>
                        </div>
                    </div>

                    <div style={{
                        display: 'flex',
                        gap: '2rem',
                        padding: '1rem',
                        backgroundColor: 'white',
                        borderRadius: '0.5rem',
                        marginBottom: '1rem',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        flexWrap: 'wrap',
                        fontSize: '1.1rem'
                    }}>
                        <div style={{ fontWeight: 600 }}>
                            Total Scanned: <span style={{ fontSize: '1.2rem' }}>{(activeBatch?.passed_count || 0) + (activeBatch?.failed_count || 0)}</span> / {activeBatch?.iqc_passed_count || 0}
                        </div>
                        <div style={{ color: '#2563eb', fontWeight: 600 }}>
                            🏭 Available: {activeBatch?.iqc_passed_count || 0}
                        </div>
                        <div style={{ color: '#6366f1', fontWeight: 600 }}>
                            📦 From Warehouse: {activeBatch?.warehouse_received_quantity || 0}
                        </div>
                        <div style={{ color: '#10b981', fontWeight: 600 }}>
                            ✅ Passed: {activeBatch?.passed_count || 0}
                        </div>
                        <div style={{ color: '#ef4444', fontWeight: 600 }}>
                            ❌ Failed: {activeBatch?.failed_count || 0}
                        </div>
                    </div>

                    <div className={styles.scanSection}>
                        {/* Only show scan input if batch is NOT completed */}
                        {!completedBatches.some(b => b.id === currentBatchId) && (
                            <>
                                <div style={{ marginBottom: '1rem' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Scanned By *</label>
                                    <input
                                        type="text"
                                        className={styles.input}
                                        placeholder="Enter Your Name"
                                        value={userName}
                                        onChange={(e) => setUserName(e.target.value)}
                                        style={{ maxWidth: '300px' }}
                                    />
                                </div>

                                <div className={styles.scanForm}>
                                    <input
                                        type="text"
                                        className={styles.scanInput}
                                        placeholder="Scan PCB Barcode..."
                                        value={barcode}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setBarcode(val);
                                            // Auto-scan if length is sufficient (e.g., 15 chars for typical barcode)
                                            if (val.trim().length >= 15) {
                                                // Trigger scan logic immediately
                                                handleScan(val.trim());
                                            }
                                        }}
                                        autoFocus
                                    />
                                    {/* Hidden button to keep form behavior if needed, but main interaction is auto-scan */}
                                    <button
                                        type="button"
                                        className={styles.scanButton}
                                        onClick={() => handleScan(barcode.trim())}
                                    >
                                        SCAN
                                    </button>
                                </div>
                            </>
                        )}

                        <div style={{ marginBottom: '1rem', color: '#6b7280', fontSize: '0.9rem' }}>
                            Session ID: {currentBatchId} | Scanned Items: {scannedItems.length}
                        </div>

                        {/* Filtered Scanned Items */}
                        {(() => {
                            const filteredScannedItems = scannedItems.filter(item =>
                                item.barcode.toLowerCase().includes(barcodeFilter.trim().toLowerCase())
                            );

                            return (
                                <>
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
                                                                onChange={(e) => setBarcodeFilter(e.target.value)}
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
                                                <th>Scanned By</th>
                                                <th>PA_1(1V)</th>
                                                <th>PA_2(1V)</th>
                                                <th>PA_4(0.5V)</th>
                                                <th>PA_5(0.5V)</th>
                                                <th>R160(0.5V)</th>
                                                <th>Status</th>
                                                <th>Time</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredScannedItems.map((item) => (
                                                <tr key={item.id}>
                                                    <td style={{ fontWeight: 'bold' }}>{item.barcode}</td>
                                                    <td>{item.tested_by || '-'}</td>
                                                    {['test_pa1', 'test_pa2', 'test_pa4', 'test_pa5', 'test_r160'].map((testKey) => (
                                                        <td key={testKey} style={{ textAlign: 'center' }}>
                                                            <div className={styles.dropdownContainer}>
                                                                <span style={{ fontSize: '1.2rem' }}>
                                                                    {item[testKey] !== false ? '✅' : '❌'}
                                                                </span>
                                                                {['admin', 'super admin', 'manager'].includes(user?.role?.toLowerCase() || '') && !completedBatches.some(b => b.id === currentBatchId) && (
                                                                    <button
                                                                        className={styles.dropdownTrigger}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setOpenDropdown(openDropdown?.id === item.id && openDropdown?.test === testKey ? null : { id: item.id, test: testKey });
                                                                        }}
                                                                    >
                                                                        ▼
                                                                    </button>
                                                                )}
                                                                {openDropdown?.id === item.id && openDropdown?.test === testKey && (
                                                                    <div className={styles.dropdownMenu}>
                                                                        <button
                                                                            className={`${styles.dropdownItem} ${styles.dropdownItemPass}`}
                                                                            onClick={() => handleTestUpdate(item, testKey, true)}
                                                                        >
                                                                            Pass ✅
                                                                        </button>
                                                                        <button
                                                                            className={`${styles.dropdownItem} ${styles.dropdownItemFail}`}
                                                                            onClick={() => handleTestUpdate(item, testKey, false)}
                                                                        >
                                                                            Fail ❌
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    ))}
                                                    <td style={{ fontWeight: 600, color: item.status === 'ACCEPTED' ? '#10b981' : '#ef4444' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <span>{item.status === 'ACCEPTED' ? 'PASS' : 'FAIL'}</span>
                                                            {['admin', 'super admin'].includes(user?.role?.toLowerCase() || '') && (
                                                                <button
                                                                    className={styles.deleteTextButton}
                                                                    onClick={async () => {
                                                                        if (window.confirm('Are you sure you want to delete this scan?')) {
                                                                            try {
                                                                                await apiFetch(`/api/pretest/impedance/scan/${item.id}`, { method: 'DELETE' });
                                                                                setScannedItems(prev => prev.filter(s => s.id !== item.id));
                                                                                showToast('Scan deleted successfully', 'success');
                                                                                fetchBatches();
                                                                            } catch (err: any) {
                                                                                showToast(err.message || 'Failed to delete scan', 'error');
                                                                            }
                                                                        }
                                                                    }}
                                                                    title="Delete Scan"
                                                                >
                                                                    Delete
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td>{new Date(item.scanned_at || Date.now()).toLocaleTimeString()}</td>
                                                </tr>
                                            ))}
                                            {filteredScannedItems.length === 0 && (
                                                <tr>
                                                    <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                                                        {barcodeFilter ? 'No items match your filter.' : 'Ready to scan. PCBs will be auto-assigned.'}
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </>
                            );
                        })()}
                    </div>
                </>
            )}

            {/* Fail Modal */}
            {failModalOpen && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#ef4444' }}>Mark PCB as Failed</h3>
                        <p style={{ marginBottom: '1.5rem', color: '#4b5563' }}>
                            Please provide a reason for failing PCB <strong>{selectedScan?.barcode}</strong>.
                        </p>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Remarks / Failure Reason *</label>
                            <textarea
                                className={styles.textarea}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
                                rows={4}
                                value={failremarks}
                                onChange={(e) => setFailremarks(e.target.value)}
                                placeholder="Enter failure details..."
                                autoFocus
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                            <button
                                onClick={() => setFailModalOpen(false)}
                                className={styles.secondaryButton}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleFailConfirm}
                                style={{
                                    backgroundColor: '#ef4444',
                                    color: 'white',
                                    border: 'none',
                                    padding: '0.5rem 1.5rem',
                                    borderRadius: '0.5rem',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Confirm Failure
                            </button>
                        </div>
                    </div>
                </div>
            )}


            {/* Scan Confirmation Modal */}
            {
                scanModalOpen && (
                    <div className={styles.modalOverlay}>
                        <div className={styles.modalContent} style={{ maxWidth: '500px' }}>
                            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Confirm Test Results</h3>
                            <p style={{ marginBottom: '1.5rem', color: '#4b5563' }}>
                                PCB Barcode: <strong>{pendingBarcode}</strong>
                            </p>

                            <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
                                {[
                                    { key: 'test_pa1', label: 'PA_1(1V)' },
                                    { key: 'test_pa2', label: 'PA_2(1V)' },
                                    { key: 'test_pa4', label: 'PA_4(0.5V)' },
                                    { key: 'test_pa5', label: 'PA_5(0.5V)' },
                                    { key: 'test_r160', label: 'R160(0.5V)' }
                                ].map((test) => (
                                    <div key={test.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}>
                                        <span style={{ fontWeight: 500 }}>{test.label}</span>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button
                                                type="button"
                                                onClick={() => setScanTestResults(prev => ({ ...prev, [test.key]: true }))}
                                                style={{
                                                    padding: '0.25rem 0.75rem',
                                                    borderRadius: '0.25rem',
                                                    border: '1px solid #10b981',
                                                    backgroundColor: scanTestResults[test.key as keyof typeof scanTestResults] ? '#10b981' : 'white',
                                                    color: scanTestResults[test.key as keyof typeof scanTestResults] ? 'white' : '#10b981',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Pass ✅
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setScanTestResults(prev => ({ ...prev, [test.key]: false }))}
                                                style={{
                                                    padding: '0.25rem 0.75rem',
                                                    borderRadius: '0.25rem',
                                                    border: '1px solid #ef4444',
                                                    backgroundColor: !scanTestResults[test.key as keyof typeof scanTestResults] ? '#ef4444' : 'white',
                                                    color: !scanTestResults[test.key as keyof typeof scanTestResults] ? 'white' : '#ef4444',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Fail ❌
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                <button
                                    onClick={handleScanCancel}
                                    className={styles.secondaryButton}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleScanConfirm}
                                    style={{
                                        backgroundColor: '#2563eb',
                                        color: 'white',
                                        border: 'none',
                                        padding: '0.5rem 1.5rem',
                                        borderRadius: '0.5rem',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Confirm & Save
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};
