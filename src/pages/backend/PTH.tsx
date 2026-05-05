import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../../utils/api';
import styles from './PTH.module.css';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../hooks/useAuth';
import { Search } from 'lucide-react';

interface WorkOrder {
    id: number;
    wo_number: string;
    quantity: number;
    customer_name: string;
    model: string;
    created_by: string;
    created_at: string;
}

interface ScanRecord {
    id: number;
    barcode: string;
    scanned_by: string;
    scanned_at: string;
}

const PTH: React.FC = () => {
    const { user } = useAuth();
    const { showToast } = useToast();

    // Navigation State
    const [step, setStep] = useState<'select' | 'scan'>('select');

    // Data States
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
    const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
    const [scannedItems, setScannedItems] = useState<ScanRecord[]>([]);

    // Scan Form State
    const [barcode, setBarcode] = useState('');
    const [operatorName, setOperatorName] = useState(user?.name || '');
    const [isScanning, setIsScanning] = useState(false);
    
    const scanInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (step === 'select') {
            fetchWorkOrders();
        }
    }, [step]);

    // Keep focus on scan input when in scan step
    useEffect(() => {
        if (step === 'scan' && scanInputRef.current) {
            scanInputRef.current.focus();
        }
    });

    const fetchWorkOrders = async () => {
        try {
            const data = await apiFetch('/api/backend/work-order');
            if (data) setWorkOrders(data);
        } catch (error) {
            showToast('Failed to load work orders', 'error');
        }
    };

    const fetchScans = async (woId: number) => {
        try {
            const data = await apiFetch(`/api/backend/pth/scans/${woId}`);
            setScannedItems(data);
        } catch (error) {
            console.error('Error fetching scans:', error);
        }
    };

    const handleSelectWO = (id: string) => {
        const wo = workOrders.find(w => w.id === parseInt(id));
        setSelectedWO(wo || null);
    };

    const handleContinue = () => {
        if (!selectedWO) {
            showToast('Please select a Work Order', 'error');
            return;
        }
        setStep('scan');
        fetchScans(selectedWO.id);
    };

    const handleScan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!barcode.trim() || isScanning || !selectedWO) return;
        
        if (!operatorName.trim()) {
            showToast('Please enter operator name', 'error');
            return;
        }

        setIsScanning(true);
        try {
            const newScan = await apiFetch('/api/backend/pth/scan', {
                method: 'POST',
                body: JSON.stringify({
                    work_order_id: selectedWO.id,
                    barcode: barcode.trim().toUpperCase(),
                    scanned_by: operatorName.trim()
                })
            });
            
            showToast('Item scanned successfully', 'success');
            setBarcode('');
            setScannedItems(prev => [newScan, ...prev]);
        } catch (error: any) {
            showToast(error.message || 'Scan failed', 'error');
        } finally {
            setIsScanning(false);
            if (scanInputRef.current) scanInputRef.current.focus();
        }
    };

    const handleEndSession = () => {
        setStep('select');
        setSelectedWO(null);
        setScannedItems([]);
    };

    if (step === 'scan' && selectedWO) {
        return (
            <div className={styles.container}>
                {/* Unified Header with ALL details */}
                <div className={styles.headerBar}>
                    <div className={styles.headerInfo}>
                        <h1 className={styles.woNumber}>{selectedWO.wo_number}</h1>
                        <p className={styles.woMeta}>
                            Expected: {selectedWO.quantity} | 
                            Scanned: {scannedItems.length} | 
                            Customer: {selectedWO.customer_name} | 
                            Model: {selectedWO.model} | 
                            Created by: {selectedWO.created_by}
                        </p>
                    </div>
                    <button className={styles.endSessionBtn} onClick={handleEndSession}>
                        End Session
                    </button>
                </div>

                <div className={styles.scanContent}>
                    {/* Scanned By Input */}
                    <div className={styles.operatorSection}>
                        <label>Scanned By *</label>
                        <input
                            type="text"
                            className={styles.operatorInput}
                            value={operatorName}
                            onChange={(e) => setOperatorName(e.target.value)}
                            placeholder="Enter Your Name"
                        />
                    </div>

                    {/* Large Scan Box */}
                    <div className={styles.scanBoxWrapper}>
                        <form onSubmit={handleScan} className={styles.scanBox}>
                            <input
                                ref={scanInputRef}
                                type="text"
                                className={styles.largeScanInput}
                                placeholder="Scan Item Barcode..."
                                value={barcode}
                                onChange={(e) => setBarcode(e.target.value)}
                                autoFocus
                            />
                            <button type="submit" className={styles.largeScanBtn} disabled={isScanning}>
                                {isScanning ? '...' : 'SCAN'}
                            </button>
                        </form>
                    </div>

                    {/* Table Section (Cleaned up - no info cards in between) */}
                    <div className={styles.tableCard}>
                        <div className={styles.tableHeader}>
                            <h3>Scanned Items ({scannedItems.length})</h3>
                        </div>
                        <div className={styles.tableWrapper}>
                            <table className={styles.scanTable}>
                                <thead>
                                    <tr>
                                        <th>BARCODE <Search size={14} style={{ marginLeft: 4, cursor: 'pointer' }} /></th>
                                        <th>SCANNED BY</th>
                                        <th>TIME</th>
                                        <th>STATUS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {scannedItems.length > 0 ? (
                                        scannedItems.map((scan) => (
                                            <tr key={scan.id}>
                                                <td className={styles.barcodeCell}>{scan.barcode}</td>
                                                <td>{scan.scanned_by}</td>
                                                <td>{new Date(scan.scanned_at).toLocaleTimeString()}</td>
                                                <td>
                                                    <span className={styles.acceptedBadge}>ACCEPTED</span>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={4} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                                                No items scanned in this session.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h2>⚙️ PTH Batch Management</h2>
                    <p>Select a Work Order to continue to scanning</p>
                </div>
            </div>

            <div className={styles.card}>
                <h3>Work Order Details</h3>
                <div className={styles.formGrid}>
                    <div className={styles.inputGroup}>
                        <label>Select Work Order *</label>
                        <select 
                            className={styles.select} 
                            onChange={(e) => handleSelectWO(e.target.value)}
                            defaultValue=""
                            required
                        >
                            <option value="" disabled>-- Select Work Order --</option>
                            {workOrders.map(wo => (
                                <option key={wo.id} value={wo.id}>{wo.wo_number}</option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.inputGroup}>
                        <label>Customer Name (Auto-filled)</label>
                        <input
                            type="text"
                            className={styles.input}
                            value={selectedWO?.customer_name || ""}
                            placeholder="Customer Name"
                            disabled
                            style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold' }}
                        />
                    </div>

                    <div className={styles.inputGroup}>
                        <label>WO Qty (Auto-filled)</label>
                        <input
                            type="text"
                            className={styles.input}
                            value={selectedWO?.quantity || ""}
                            placeholder="WO Quantity"
                            disabled
                            style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold' }}
                        />
                    </div>

                    <div className={styles.inputGroup}>
                        <label>Model (Auto-filled)</label>
                        <input
                            type="text"
                            className={styles.input}
                            value={selectedWO?.model || ""}
                            placeholder="Model"
                            disabled
                            style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold' }}
                        />
                    </div>

                    <div className={styles.inputGroup}>
                        <label>Created By (Auto-filled)</label>
                        <input
                            type="text"
                            className={styles.input}
                            value={selectedWO?.created_by || ""}
                            placeholder="Created By"
                            disabled
                            style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold' }}
                        />
                    </div>

                    <div className={styles.inputGroup}>
                        <label>Created At (Auto-filled)</label>
                        <input
                            type="text"
                            className={styles.input}
                            value={selectedWO ? new Date(selectedWO.created_at).toLocaleDateString() : ""}
                            placeholder="Created At"
                            disabled
                            style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold' }}
                        />
                    </div>
                </div>

                <div style={{ marginTop: '30px' }}>
                    <button 
                        className={styles.button} 
                        onClick={handleContinue}
                        disabled={!selectedWO}
                    >
                        Continue to Scan
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PTH;
