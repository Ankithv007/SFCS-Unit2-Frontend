import React, { useState, useEffect } from 'react';
import styles from './Impedance.module.css';
import { useToast } from '../../components/Toast';

interface Batch {
    id: number;
    batch_number: string;
    quantity: number;
    created_at: string;
    scanned_count?: number;
    last_tested_by?: string;
    last_active?: string;
    passed_count?: number;
    failed_count?: number;
    iqc_passed_count?: number;
}

export const Impedance: React.FC = () => {
    const [userName, setUserName] = useState<string>('');
    const [isSessionActive, setIsSessionActive] = useState<boolean>(false);
    const [barcode, setBarcode] = useState<string>('');
    const [scannedItems, setScannedItems] = useState<any[]>([]);
    const [batches, setBatches] = useState<Batch[]>([]);
    const { showToast } = useToast();

    // Fail Modal State
    const [failModalOpen, setFailModalOpen] = useState(false);
    const [selectedScan, setSelectedScan] = useState<any>(null);
    const [failRemark, setFailRemark] = useState('');

    const handleFailClick = (scan: any) => {
        setSelectedScan(scan);
        setFailRemark('');
        setFailModalOpen(true);
    };

    const handleFailConfirm = async () => {
        if (!selectedScan) return;
        if (!failRemark.trim()) {
            showToast('Please enter a remark for failure', 'error');
            return;
        }

        try {
            const response = await fetch(`http://localhost:5002/api/impedance/scans/${selectedScan.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'FAILED',
                    remarks: failRemark
                })
            });

            if (response.ok) {
                showToast('PCB marked as FAILED', 'success');
                setFailModalOpen(false);

                // Update local state
                setScannedItems(prev => prev.map(item =>
                    item.id === selectedScan.id
                        ? { ...item, status: 'FAILED', remarks: failRemark }
                        : item
                ));
                fetchBatches(); // Update batch counts
            } else {
                showToast('Failed to update status', 'error');
            }
        } catch (error) {
            console.error('Error updating scan:', error);
            showToast('Network error', 'error');
        }
    };

    // Fetch batches on mount and when session ends
    useEffect(() => {
        fetchBatches();
    }, [isSessionActive]);

    const fetchBatches = async () => {
        try {
            const response = await fetch('http://localhost:5002/api/impedance/batches', { cache: 'no-store' });
            if (response.ok) {
                const data = await response.json();
                setBatches(data);
            }
        } catch (error) {
            console.error('Error fetching batches:', error);
        }
    };

    const handleStartTesting = () => {
        if (!userName.trim()) {
            showToast('Please enter Operator Name', 'error');
            return;
        }
        setIsSessionActive(true);
        showToast('Scanning started. PCBs will be auto-assigned to batches.', 'success');
    };

    const handleScan = async (e: React.FormEvent) => {
        e.preventDefault();
        let scannedBarcode = barcode.trim();
        if (!scannedBarcode) return;

        // Check for Part Number (PN) explicitly
        if (scannedBarcode.toUpperCase().startsWith('PN:')) {
            showToast('Invalid Barcode. You scanned a Part Number (PN).', 'error');
            setBarcode('');
            return;
        }

        // Validate that the barcode starts with 'AY-' (ignoring 'SN:' prefix if present)
        const coreBarcode = scannedBarcode.toUpperCase().startsWith('SN:')
            ? scannedBarcode.substring(3).trim()
            : scannedBarcode;

        if (!coreBarcode.toUpperCase().startsWith('AY-')) {
            showToast('Invalid Barcode. Serial Number must start with "AY-".', 'error');
            setBarcode('');
            return;
        }

        // Auto-format: If it doesn't start with SN:, add it
        if (!scannedBarcode.toUpperCase().startsWith('SN:')) {
            scannedBarcode = `SN:${scannedBarcode}`;
        }

        try {
            const response = await fetch('http://localhost:5002/api/impedance/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    barcode: scannedBarcode,
                    tested_by: userName
                })
            });

            const result = await response.json();

            if (response.ok) {
                showToast(`Assigned to ${result.batch_number}`, 'success');
                setScannedItems(prev => [result, ...prev]);
                fetchBatches(); // Update counts in background
            } else {
                showToast(result.error || 'Scan Failed', 'error');
            }
        } catch (error) {
            console.error('Error scanning PCB:', error);
            showToast('Failed to scan PCB', 'error');
        } finally {
            setBarcode('');
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2><span role="img" aria-label="icon">⚡</span> Impedance Testing</h2>
                <p>Measure and verify impedance characteristics of PCBs.</p>
            </div>

            {!isSessionActive ? (
                <>
                    <div className={styles.card}>
                        <h3>Operator Setup</h3>
                        <div className={styles.formGrid}>
                            <div className={styles.inputGroup}>
                                <label>Tested By (Operator Name) *</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    placeholder="Enter your name"
                                    value={userName}
                                    onChange={(e) => setUserName(e.target.value)}
                                />
                            </div>
                            {/* Shift selection removed */}
                            <div className={styles.inputGroup}>
                                <label>Date & Time</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    value={new Date().toLocaleString()}
                                    disabled
                                    style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed' }}
                                />
                            </div>
                        </div>
                        <button
                            className={styles.button}
                            onClick={handleStartTesting}
                            style={{ marginTop: '2rem' }}
                        >
                            Start Testing
                        </button>
                    </div>

                    {/* Recent Batches List */}
                    <div className={styles.card}>
                        <h3>Recent Batches</h3>
                        <div className={styles.listContainer}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Batch Number</th>
                                        <th>Created By</th>
                                        <th>Date</th>
                                        <th>Qty</th>
                                        <th>Passed</th>
                                        <th>Failed</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {batches.map((batch) => (
                                        <tr key={batch.id}>
                                            <td style={{ fontWeight: 600 }}>{batch.batch_number}</td>
                                            <td>{batch.last_tested_by || '-'}</td>
                                            <td>{batch.created_at ? new Date(batch.created_at).toLocaleString() : '-'}</td>
                                            <td>
                                                <span style={{
                                                    fontWeight: 600,
                                                    color: (batch.passed_count ?? 0) >= (batch.iqc_passed_count ?? batch.quantity) ? '#059669' : '#4f46e5'
                                                }}>
                                                    {batch.passed_count ?? 0} / {batch.iqc_passed_count ?? 0}
                                                </span>
                                            </td>
                                            <td>
                                                <span style={{ color: '#059669', fontWeight: 600 }}>
                                                    {batch.passed_count || 0}
                                                </span>
                                            </td>
                                            <td>
                                                <span style={{ color: '#ef4444', fontWeight: 600 }}>
                                                    {batch.failed_count || 0}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button
                                                        className={styles.secondaryButton}
                                                        onClick={async () => {
                                                            if (!userName.trim()) {
                                                                showToast('Please enter Operator Name in settings above', 'error');
                                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                                                return;
                                                            }

                                                            try {
                                                                const response = await fetch(`http://localhost:5002/api/impedance/batches/${batch.id}/scans`);
                                                                if (response.ok) {
                                                                    const scans = await response.json();
                                                                    setScannedItems(scans);
                                                                    setIsSessionActive(true);
                                                                    showToast(`Viewing ${batch.batch_number}`, 'success');
                                                                } else {
                                                                    showToast('Failed to load batch details', 'error');
                                                                }
                                                            } catch (err) {
                                                                console.error(err);
                                                                showToast('Network error loading batch details', 'error');
                                                            }
                                                        }}
                                                    >
                                                        View
                                                    </button>
                                                    <button
                                                        style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.375rem', cursor: 'pointer' }}
                                                        onClick={async () => {
                                                            const confirm1 = window.confirm('Are you sure you want to remove this batch from Impedance? This will delete all IMPEDANCE scans.');
                                                            if (!confirm1) return;

                                                            const confirm2 = window.confirm('⚠️ FINAL WARNING: This will NOT delete the IQC batch, but all Impedance progress will be lost. Continue?');
                                                            if (!confirm2) return;

                                                            try {
                                                                const response = await fetch(`http://localhost:5002/api/impedance/batches/${batch.id}`, {
                                                                    method: 'DELETE',
                                                                });

                                                                if (response.ok) {
                                                                    showToast('Impedance data cleared successfully', 'success');
                                                                    fetchBatches();
                                                                } else {
                                                                    showToast('Failed to clear data', 'error');
                                                                }
                                                            } catch (err) {
                                                                showToast('Network error during deletion', 'error');
                                                            }
                                                        }}
                                                        className={styles.deleteTextButton}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <div className={styles.activeBatchHeader}>
                        <div>
                            <h3>Scanning Active</h3>
                            <small>Operator: {userName}</small>
                        </div>
                        <button
                            className={styles.secondaryButton}
                            onClick={() => setIsSessionActive(false)}
                        >
                            End Session
                        </button>
                    </div>

                    <div className={styles.scanSection}>
                        <form className={styles.scanForm} onSubmit={handleScan}>
                            <input
                                type="text"
                                className={styles.scanInput}
                                placeholder="Scan PCB Barcode..."
                                value={barcode}
                                onChange={(e) => setBarcode(e.target.value)}
                                autoFocus
                            />
                            <button type="submit" className={styles.scanButton}>
                                SCAN
                            </button>
                        </form>

                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Barcode</th>
                                    <th>Assigned Batch</th>
                                    <th>Pass Status</th>
                                    <th>Fail Status</th>
                                    <th>IQC Status</th>
                                    <th>Time</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {scannedItems.map((item) => (
                                    <tr key={item.id}>
                                        <td style={{ fontWeight: 'bold' }}>{item.barcode}</td>
                                        <td style={{ color: '#4f46e5' }}>{item.batch_number}</td>
                                        <td style={{ textAlign: 'center', fontSize: '1.2rem' }}>
                                            {item.status === 'ACCEPTED' ? '✅' : '-'}
                                        </td>
                                        <td style={{ textAlign: 'center', fontSize: '1.2rem' }}>
                                            {item.status !== 'ACCEPTED' ? '❌' : '-'}
                                        </td>
                                        <td style={{ textAlign: 'center', fontSize: '1.2rem' }}>
                                            {item.iqc_status === 'ACCEPTED' ? '✅' : '❌'}
                                        </td>
                                        <td>{new Date(item.scanned_at || Date.now()).toLocaleTimeString()}</td>
                                        <td>
                                            {item.status === 'ACCEPTED' && (
                                                <button
                                                    onClick={() => handleFailClick(item)}
                                                    className={styles.deleteTextButton}
                                                    style={{ border: '1px solid #ef4444', color: '#ef4444' }}
                                                >
                                                    Fail
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {scannedItems.length === 0 && (
                                    <tr>
                                        <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                                            Ready to scan. PCBs will be auto-assigned.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
            {/* Fail Modal */}
            {failModalOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '2rem',
                        borderRadius: '0.75rem',
                        width: '100%',
                        maxWidth: '500px',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                    }}>
                        <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#ef4444' }}>Mark PCB as Failed</h3>
                        <p style={{ marginBottom: '1.5rem', color: '#4b5563' }}>
                            Please provide a reason for failing PCB <strong>{selectedScan?.barcode}</strong>.
                        </p>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Remark / Failure Reason *</label>
                            <textarea
                                className={styles.textarea}
                                rows={4}
                                value={failRemark}
                                onChange={(e) => setFailRemark(e.target.value)}
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
        </div>
    );
};
