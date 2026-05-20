import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../../utils/api';
import styles from './Rework.module.css';
import sharedStyles from '../smt/WorkOrder.module.css';

import { useToast } from '../../components/Toast';
import { useAuth } from '../../hooks/useAuth';
import SearchInput from '../../components/SearchInput';
import ScanDecisionModal from '../../components/ScanDecisionModal';
import { Search, ArrowLeft, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

interface Batch {
    id: number;
    work_order_id: number;
    wo_number: string;
    batch_number: string;
    customer_name?: string;
    model?: string;
    workOrderQty: number;
    sourceStage?: string;
    scanned: number; // Number of items currently in Rework for this batch/WO/Stage
    rework: number;
    debug: number;
    passed: number;
    status: 'pending' | 'in_progress' | 'completed';
}

interface ScanRecord {
    id: number | string;
    barcode: string;
    unit_serial_number?: string;
    scanned_by: string;
    scanned_at: string;
    status: string;
    remarks?: string;
    repair_time?: string;
    repair_remark?: string;
    failed_at?: string;
    failed_remarks?: string;
}

const Rework: React.FC = () => {
    const { user } = useAuth();
    const { showToast } = useToast();

    const [activeFailureBatches, setActiveFailureBatches] = useState<Batch[]>([]);
    const [page, setPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);

    const [activeBatch, setActiveBatch] = useState<Batch | null>(null);
    const [scannedItems, setScannedItems] = useState<ScanRecord[]>([]);
    const [tableSearch, setTableSearch] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [scanTotalRecords, setScanTotalRecords] = useState(0);

    const [barcode, setBarcode] = useState('');
    const scanInputRef = useRef<HTMLInputElement>(null);
    const [pendingBarcode, setPendingBarcode] = useState<string | null>(null);

    useEffect(() => {
        fetchActiveBatches();
        
        // Add polling for real-time visibility (every 10 seconds)
        const interval = setInterval(() => {
            if (!activeBatch) {
                fetchActiveBatches();
            }
        }, 10000);

        return () => clearInterval(interval);
    }, [page, searchTerm, activeBatch]);

    useEffect(() => {
        if (activeBatch && scanInputRef.current && !pendingBarcode) {
            scanInputRef.current.focus();
        }
    });

    useEffect(() => {
        if (barcode.trim().length >= 14 && !isScanning && activeBatch) {
            handleScan();
        }
    }, [barcode, isScanning, activeBatch]);

    const fetchActiveBatches = async () => {
        try {
            const data = await apiFetch(`/api/backend/rework/batch?page=${page}&limit=10&search=${searchTerm}`);
            setActiveFailureBatches(data.data || []);
            setTotalPages(data.totalPages || 1);
            setTotalRecords(data.total || 0);
        } catch (error) {
            console.error("Error fetching rework batches:", error);
        }
    };

    const fetchScans = async (batchId: number, page = 1) => {
        try {
            const data = await apiFetch(`/api/backend/rework/scan/${batchId}?page=${page}&limit=50`);
            setScannedItems(data.data || []);
            setScanTotalRecords(data.total || 0);
        } catch (error) {
            console.error('Error fetching scans:', error);
            setScannedItems([]);
        }
    };

    const handleStartScanning = async (batch: Batch) => {
        try {
            await fetchScans(batch.id);
            setActiveBatch(batch);
            setBarcode('');
            showToast(`Repair session started for ${batch.batch_number}`, 'success');
        } catch (error) {
            showToast('Failed to load batch failures', 'error');
        }
    };

    const handleEndSession = () => {
        setActiveBatch(null);
        fetchActiveBatches();
    };

    const handleScan = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!barcode.trim() || isScanning || !activeBatch) return;
        setPendingBarcode(barcode.trim().toUpperCase());
        setBarcode('');
    };

    const handleScanFinalize = async (_status: string, remarks?: string) => {
        if (!pendingBarcode || !activeBatch) return;
        if (!remarks?.trim()) {
            showToast('Repair remark is mandatory', 'error');
            return;
        }

        setIsScanning(true);
        try {
            const response = await apiFetch('/api/backend/rework/scan', {
                method: 'POST',
                body: JSON.stringify({
                    batch_id: activeBatch.id,
                    work_order_id: activeBatch.work_order_id,
                    barcode: pendingBarcode,
                    scanned_by: user?.name || 'Operator',
                    status: 'ACCEPTED', // Always ACCEPTED from rework
                    remarks: remarks
                })
            });

            if (response.success) {
                showToast(response.message || 'Item resolved', 'success');
                setPendingBarcode(null);
                fetchScans(activeBatch.id, 1);
                fetchActiveBatches();
                
                // Refresh the active batch counters
                const updatedBatches = await apiFetch(`/api/backend/rework/batch?search=${activeBatch.batch_number}`);
                const updated = updatedBatches.data?.find((b: Batch) => b.id === activeBatch.id);
                if (updated) {
                    setActiveBatch(updated);
                } else {
                    // Batch disappeared because no more failures
                    showToast('All failures resolved for this batch!', 'success');
                    setActiveBatch(null);
                }
            }
        } catch (error: any) {
            showToast(error.message || 'Scan failed', 'error');
            setPendingBarcode(null);
        } finally {
            setIsScanning(false);
        }
    };

    const BatchTable = () => (
        <div className={styles.card}>
            <div className={styles.tableHeader}>
                <h3 style={{ margin: 0 }}>Pending Rework ({totalRecords})</h3>
                <SearchInput 
                    value={searchTerm} 
                    onChange={setSearchTerm} 
                    placeholder="Search Work Order..." 
                />
            </div>
            <div className={styles.tableWrapper}>
                <table className={styles.scanTable}>
                    <thead>
                        <tr>
                            <th>Batch Number</th>
                            <th>Customer</th>
                            <th>Model</th>
                            <th>Work Order Qty</th>
                            <th>Source Stage</th>
                            <th>Scanned</th>
                            <th>Pending</th>
                            <th>Passed</th>
                            <th>Rework</th>
                            <th>Debug</th>
                            <th className={styles.actionColumn}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {activeFailureBatches.length > 0 ? (
                            activeFailureBatches.map(batch => (
                                <tr key={`${batch.id}-${batch.sourceStage}`}>
                                    <td style={{ fontWeight: 700 }}>{batch.batch_number}</td>
                                    <td>{batch.customer_name || "-"}</td>
                                    <td>{batch.model || "-"}</td>
                                    <td style={{ fontWeight: 600 }}>{batch.workOrderQty}</td>
                                    <td style={{ color: '#6366f1', fontWeight: 700 }}>{batch.sourceStage}</td>
                                    <td className={styles.statusBlue}>0</td>
                                    <td style={{ color: 'orange', fontWeight: 700 }}>{batch.rework}</td>
                                    <td className={styles.statusGreen}>0</td>
                                    <td style={{ color: '#f59e0b', fontWeight: 700 }}>{batch.rework}</td>
                                    <td style={{ color: '#ef4444', fontWeight: 700 }}>0</td>
                                    <td className={styles.actionColumn}>
                                        <button className={sharedStyles.secondaryButton} onClick={() => handleStartScanning(batch)}>
                                            <Search size={14} /> Start Repair
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem' }}>No active rework failures found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {totalRecords > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', padding: '0 1rem', paddingBottom: '1rem' }}>
                    <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
                        Showing {(page - 1) * 10 + 1}-{Math.min(page * 10, totalRecords)} of {totalRecords} batches
                    </span>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button className={sharedStyles.secondaryButton} disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
                        <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Page {page} of {totalPages}</span>
                        <button className={sharedStyles.secondaryButton} disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next</button>
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div className={styles.container}>
            {!activeBatch ? (
                <>
                    <div className={styles.header}>
                        <div>
                            <h2>🛠️ Rework Stage</h2>
                            <p>Process repaired boards and return them to the production line.</p>
                        </div>
                    </div>
                    <BatchTable />
                </>
            ) : (
                <>
                    <div className={styles.headerBar}>
                        <div className={styles.headerInfo}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <button className={styles.backBtn} onClick={handleEndSession}>
                                    <ArrowLeft size={18} />
                                </button>
                                <h2 style={{ fontSize: '0.9rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, margin: 0 }}>Rework Page</h2>
                            </div>
                            <h1 className={styles.woNumber}>{activeBatch.batch_number}</h1>
                            <p className={styles.woMeta}>
                                📥 Active Failures: <span style={{ color: '#ef4444', fontWeight: 800 }}>{activeBatch.rework}</span> |
                                📋 Work Order Qty: {activeBatch.workOrderQty}
                            </p>
                        </div>
                        <button className={sharedStyles.secondaryButton} onClick={handleEndSession}>Close Session</button>
                    </div>

                    <div className={styles.scanContent}>
                        {/* Session Counters */}
                        <div className={sharedStyles.statsGrid} style={{ marginBottom: '1.5rem' }}>
                            <div className={sharedStyles.statCard}>
                                <div className={sharedStyles.statHeader}>
                                    <span className={sharedStyles.statTitle}>SCANNED</span>
                                    <div className={`${sharedStyles.statIcon} ${sharedStyles.blue}`}>
                                        <Search size={16} />
                                    </div>
                                </div>
                                <div className={sharedStyles.statValue}>{scannedItems.length}</div>
                                <div className={sharedStyles.statLabel}>Processed in session</div>
                            </div>
                            <div className={sharedStyles.statCard}>
                                <div className={sharedStyles.statHeader}>
                                    <span className={sharedStyles.statTitle}>PENDING</span>
                                    <div className={`${sharedStyles.statIcon} ${sharedStyles.orange}`}>
                                        <Clock size={16} />
                                    </div>
                                </div>
                                <div className={sharedStyles.statValue}>{activeBatch.rework}</div>
                                <div className={sharedStyles.statLabel}>Waiting for repair</div>
                            </div>
                            <div className={sharedStyles.statCard}>
                                <div className={sharedStyles.statHeader}>
                                    <span className={sharedStyles.statTitle}>PASSED</span>
                                    <div className={`${sharedStyles.statIcon} ${sharedStyles.green}`}>
                                        <CheckCircle size={16} />
                                    </div>
                                </div>
                                <div className={sharedStyles.statValue}>{scannedItems.length}</div>
                                <div className={sharedStyles.statLabel}>Successfully repaired</div>
                            </div>
                            <div className={sharedStyles.statCard}>
                                <div className={sharedStyles.statHeader}>
                                    <span className={sharedStyles.statTitle}>REWORK</span>
                                    <div className={`${sharedStyles.statIcon} ${sharedStyles.red}`}>
                                        <AlertTriangle size={16} />
                                    </div>
                                </div>
                                <div className={sharedStyles.statValue}>{activeBatch.rework}</div>
                                <div className={sharedStyles.statLabel}>Active failures</div>
                            </div>
                        </div>

                        <div className={styles.operatorSection}>
                            <label>Repair Operator</label>
                            <input type="text" className={styles.operatorInput} value={user?.name || ""} disabled />
                        </div>

                        <div className={styles.scanBoxWrapper}>
                            <form onSubmit={handleScan} className={styles.scanBox}>
                                <input
                                    ref={scanInputRef}
                                    type="text"
                                    className={styles.largeScanInput}
                                    placeholder="Scan Barcode or Unit Serial Number..."
                                    value={barcode}
                                    onChange={(e) => setBarcode(e.target.value)}
                                    autoFocus
                                />
                                <button type="submit" className={styles.largeScanBtn} disabled={isScanning}>
                                    {isScanning ? '...' : 'SCAN'}
                                </button>
                            </form>
                        </div>

                        <div className={styles.tableCard}>
                            <div className={styles.tableHeader}>
                                <h3>Recently Repaired ({scanTotalRecords})</h3>
                                <div className={styles.tableSearchWrapper}>
                                    <Search size={16} className={styles.tableSearchIcon} />
                                    <input
                                        type="text"
                                        placeholder="Search barcode..."
                                        className={styles.tableSearchInput}
                                        value={tableSearch}
                                        onChange={(e) => setTableSearch(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className={styles.tableWrapper}>
                                <table className={styles.scanTable}>
                                    <thead>
                                        <tr>
                                            <th>BARCODE</th>
                                            <th>UNIT SERIAL NO</th>
                                            <th>REWORKED BY</th>
                                            <th>REWORK DATE &amp; TIME</th>
                                            <th>STATUS</th>
                                            <th>FAILURE DATE &amp; TIME</th>
                                            <th>FAILURE REMARK</th>
                                            <th>REWORK REMARK</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {scannedItems.filter(s => s.barcode?.toLowerCase().includes(tableSearch.toLowerCase()) || (s.unit_serial_number || '').toLowerCase().includes(tableSearch.toLowerCase())).map((scan) => (
                                            <tr key={scan.id}>
                                                <td className={styles.barcodeCell}>{scan.barcode}</td>
                                                <td style={{ color: scan.unit_serial_number ? '#22c55e' : '#475569', fontWeight: scan.unit_serial_number ? 700 : 400, fontFamily: 'monospace' }}>{scan.unit_serial_number || '-'}</td>
                                                <td>{scan.scanned_by}</td>
                                                <td>{new Date(scan.scanned_at).toLocaleString()}</td>
                                                <td><span className={styles.acceptedBadge}>PASSED</span></td>
                                                <td>{scan.failed_at ? new Date(scan.failed_at).toLocaleString() : '-'}</td>
                                                <td style={{ color: '#ef4444' }}>{scan.failed_remarks || '-'}</td>
                                                <td style={{ fontWeight: 600 }}>{scan.remarks || '-'}</td>
                                            </tr>
                                        ))}
                                        {scannedItems.length === 0 && (
                                            <tr><td colSpan={8} style={{ textAlign: 'center', padding: '3rem' }}>No repairs recorded in this session.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {pendingBarcode && (
                <ScanDecisionModal
                    barcode={pendingBarcode}
                    repairMode={true}
                    onFinalize={handleScanFinalize}
                    onClose={() => setPendingBarcode(null)}
                />
            )}
        </div>
    );
};

export default Rework;
