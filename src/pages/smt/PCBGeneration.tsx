import React, { useState, useEffect, useRef } from 'react';
import styles from './PCBGeneration.module.css';
import { useSmtAuth } from '../../context/SmtAuthContext';
import { apiFetch } from '../../utils/api';
import { Pagination } from '../../components/Pagination';
import QRCode from 'qrcode';
import { useToast } from '../../components/Toast';

interface SmtWorkOrder {
    id: string;
    product_name: string;
    quantity: number;
    panel_quantity: number;
    barcode_source: string;
    created_at: string;
    created_by: string;
    scanned_count: number;
}

interface SmtSerial {
    id: number;
    serial_number: string;
    status: string;
    created_at: string;
}

interface ScannedComponent {
    id: number;
    serial_id: number;
    process_step: string;
    scanned_by: string;
    status: string;
    scanned_at: string;
    serial_number: string;
}

const PCBGeneration: React.FC = () => {
    const { smtUser, smtLogout } = useSmtAuth();
    const { showToast } = useToast();

    // Batch Data State
    const [batches, setBatches] = useState<SmtWorkOrder[]>([]);
    const [activeBatch, setActiveBatch] = useState<SmtWorkOrder | null>(null);
    const [scannedComponents, setScannedComponents] = useState<ScannedComponent[]>([]);
    const [allSerials, setAllSerials] = useState<SmtSerial[]>([]); // To check against GENERATED serials

    // Start Batch State
    const [selectedWoId, setSelectedWoId] = useState('');
    const [scannerName, setScannerName] = useState(smtUser?.name || '');

    // Scan State
    const [barcode, setBarcode] = useState('');
    const scanLock = useRef(false);

    // Search / Filter
    const [barcodeFilter, setBarcodeFilter] = useState("");
    const [showBarcodeFilter, setShowBarcodeFilter] = useState(false);

    // Pagination
    const [pendingPage, setPendingPage] = useState(1);
    const [completedPage, setCompletedPage] = useState(1);
    const [scannedPage, setScannedPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    // Remaining Modal State
    const [showRemainingModal, setShowRemainingModal] = useState(false);

    useEffect(() => {
        if (!activeBatch) {
            fetchBatches();
        }
    }, [activeBatch]);

    // Real-time Polling for updates
    useEffect(() => {
        const pollInterval = setInterval(async () => {
            try {
                if (!activeBatch) {
                    await fetchBatches();
                } else {
                    // Update active batch live counts
                    const data = await apiFetch('/api/smt/work-orders/registered');
                    const updatedBatch = data.find((b: SmtWorkOrder) => b.id === activeBatch.id);
                    if (updatedBatch) {
                        setActiveBatch(updatedBatch);
                    }
                    await fetchComponents(activeBatch.id);
                }
            } catch (error) {
                console.error('Polling error:', error);
            }
        }, 15000); // Poll every 15 seconds

        return () => clearInterval(pollInterval);
    }, [activeBatch]);

    const fetchBatches = async () => {
        try {
            const data = await apiFetch('/api/smt/work-orders/registered');
            setBatches(data);
        } catch (error) {
            console.error('Error fetching batches:', error);
            showToast('Failed to load batches', 'error');
        }
    };

    const fetchComponents = async (woId: string) => {
        try {
            const data = await apiFetch(`/api/smt/inspections?work_order_id=${woId}&process_step=PCB Generation`);
            setScannedComponents(data);
        } catch (error) {
            console.error('Error fetching components:', error);
        }
    };

    const fetchAllSerials = async (woId: string) => {
        try {
            const data = await apiFetch(`/api/smt/serial-numbers?work_order_id=${woId}`);
            setAllSerials(data);
        } catch (error) {
            console.error('Error fetching serials:', error);
        }
    };

    const handleStartBatch = async () => {
        if (!selectedWoId || !scannerName) {
            showToast('Work Order and Scanner Name are required', 'error');
            return;
        }

        const selectedWo = batches.find(b => b.id === selectedWoId);
        if (!selectedWo) return;

        setActiveBatch(selectedWo);
        fetchComponents(selectedWo.id);
        fetchAllSerials(selectedWo.id);
        setSelectedWoId('');
        showToast(`Started PCB Generation for ${selectedWo.id}`, 'success');
    };

    const handleViewBatch = (batch: SmtWorkOrder) => {
        setScannerName(smtUser?.name || '');
        setActiveBatch(batch);
        fetchComponents(batch.id);
        fetchAllSerials(batch.id);
    };

    const handleDeleteBatch = async (batchId: string) => {
        if (!window.confirm(`Are you sure you want to reset and delete the scan session for Work Order ${batchId}? This will remove all PCB Generation records for this batch.`)) {
            return;
        }

        try {
            await apiFetch(`/api/smt/inspections/batch?work_order_id=${batchId}&process_step=PCB Generation`, {
                method: 'DELETE'
            });
            showToast(`Scan session for ${batchId} deleted successfully`, 'success');
            fetchBatches();
            if (activeBatch?.id === batchId) {
                setActiveBatch(null);
                setScannedComponents([]);
            }
        } catch (err: any) {
            console.error('Delete error:', err);
            showToast(err.message || 'Failed to delete scan session', 'error');
        }
    };

    const handleScan = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedBarcode = barcode.trim().toUpperCase();
        if (!trimmedBarcode || !activeBatch) return;

        if (!scannerName.trim()) {
            showToast('Please enter Scanner Name', 'error');
            return;
        }

        if (scannedComponents.length >= activeBatch.quantity) {
            showToast(`Target quantity (${activeBatch.quantity}) already reached.`, 'error');
            setBarcode('');
            return;
        }

        await submitScan(trimmedBarcode);
    };

    const submitScan = async (code: string) => {
        if (scanLock.current) return;
        
        // Prevent duplicate scanning in this step
        if (scannedComponents.some(c => c.serial_number === code)) {
            showToast(`Barcode ${code} has already been scanned for this Work Order.`, 'error');
            setBarcode('');
            return;
        }

        scanLock.current = true;
        setTimeout(() => { scanLock.current = false; }, 2000);

        try {
            let serialIdToInspect: number | null = null;

            if (activeBatch?.barcode_source === 'PRE_EXISTING') {
                // If it's PRE_EXISTING, the serial might not exist yet.
                const existingSerial = allSerials.find(s => s.serial_number === code);
                
                if (existingSerial) {
                    serialIdToInspect = existingSerial.id;
                } else {
                    // Create the serial number on the fly
                    const res = await apiFetch('/api/smt/serial-numbers', {
                        method: 'POST',
                        body: JSON.stringify({
                            work_order_id: activeBatch.id,
                            format: 'EXISTING',
                            serials: [code],
                            created_by: scannerName,
                            barcode_source: 'PRE_EXISTING'
                        })
                    });
                    
                    if (res.inserted > 0) {
                        // Re-fetch serials to get the ID
                        const data = await apiFetch(`/api/smt/serial-numbers?work_order_id=${activeBatch.id}`);
                        setAllSerials(data);
                        const newSerial = data.find((s: SmtSerial) => s.serial_number === code);
                        if (newSerial) serialIdToInspect = newSerial.id;
                    } else {
                        throw new Error(`Failed to create serial number ${code}`);
                    }
                }
            } else {
                // For GENERATED, the barcode MUST exist in our system for this Work Order
                const existingSerial = allSerials.find(s => s.serial_number === code);
                if (!existingSerial) {
                    showToast(`Barcode ${code} does not belong to this Work Order!`, 'error');
                    setBarcode('');
                    scanLock.current = false;
                    return;
                }
                serialIdToInspect = existingSerial.id;
            }

            if (!serialIdToInspect) {
                throw new Error("Could not resolve Serial ID");
            }

            // Create the Inspection Record
            await apiFetch('/api/smt/inspections', {
                method: 'POST',
                body: JSON.stringify({
                    serial_id: serialIdToInspect,
                    process_step: 'PCB Generation',
                    scanned_by: scannerName,
                    status: 'PASS'
                })
            });

            showToast('PCB Scanned Successfully', 'success');
            setBarcode('');
            
            // Refresh counts
            await fetchComponents(activeBatch!.id);
            
            // Update active batch count optimistically
            setActiveBatch(prev => prev ? { ...prev, scanned_count: Number(prev.scanned_count) + 1 } : prev);

        } catch (error: any) {
            console.error('Error scanning component:', error);
            showToast(error.message || 'Scan failed', 'error');
            setBarcode('');
        }
    };

    const handlePrintAll = async () => {
        if (allSerials.length === 0) {
            showToast('No serials to print', 'info');
            return;
        }
        
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        try {
            const labelsData = await Promise.all(allSerials.map(async (s) => {
                const dataUrl = await QRCode.toDataURL(s.serial_number, {
                    width: 200, margin: 2, errorCorrectionLevel: 'H'
                });
                return { serial: s.serial_number, dataUrl };
            }));

            const html = `
                <html>
                    <head>
                        <title>Print Labels - ${activeBatch?.id}</title>
                        <style>
                            @media print { body { margin: 0; } .label { page-break-after: always; } }
                            body { display: flex; flex-direction: column; align-items: center; font-family: sans-serif; }
                            .label { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; }
                            .serial { margin-top: 10px; font-size: 16px; font-weight: bold; }
                            img { width: 150px; height: 150px; }
                        </style>
                    </head>
                    <body>
                        ${labelsData.map(d => `
                            <div class="label">
                                <img src="${d.dataUrl}" />
                                <div class="serial">${d.serial}</div>
                            </div>
                        `).join('')}
                        <script>window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 500); };</script>
                    </body>
                </html>
            `;
            printWindow.document.write(html);
            printWindow.document.close();
        } catch (err) {
            console.error("Print error:", err);
            showToast("Failed to generate print labels", "error");
        }
    };

    const remainingSerials = allSerials.filter(s => !scannedComponents.some(c => c.serial_number === s.serial_number));

    const handlePrintRemaining = async () => {
        if (remainingSerials.length === 0) {
            showToast('No remaining serials to print', 'info');
            return;
        }
        
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        try {
            const labelsData = await Promise.all(remainingSerials.map(async (s) => {
                const dataUrl = await QRCode.toDataURL(s.serial_number, {
                    width: 200, margin: 2, errorCorrectionLevel: 'H'
                });
                return { serial: s.serial_number, dataUrl };
            }));

            const html = `
                <html>
                    <head>
                        <title>Print Remaining Labels - ${activeBatch?.id}</title>
                        <style>
                            @media print { body { margin: 0; } .label { page-break-after: always; } }
                            body { display: flex; flex-direction: column; align-items: center; font-family: sans-serif; }
                            .label { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; }
                            .serial { margin-top: 10px; font-size: 16px; font-weight: bold; }
                            img { width: 150px; height: 150px; }
                        </style>
                    </head>
                    <body>
                        ${labelsData.map(d => `
                            <div class="label">
                                <img src="${d.dataUrl}" />
                                <div class="serial">${d.serial}</div>
                            </div>
                        `).join('')}
                        <script>window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 500); };</script>
                    </body>
                </html>
            `;
            printWindow.document.write(html);
            printWindow.document.close();
        } catch (err) {
            console.error("Print error:", err);
            showToast("Failed to generate print labels", "error");
        }
    };

    // Filter Logic
    const dropdownBatches = batches.filter(b => Number(b.scanned_count) === 0 && b.quantity > 0);
    const pendingBatches = batches.filter(b => Number(b.scanned_count) > 0 && Number(b.scanned_count) < b.quantity);
    const completedBatches = batches.filter(b => Number(b.scanned_count) >= b.quantity && b.quantity > 0);

    const filteredScannedComponents = scannedComponents.filter((item) =>
        item.serial_number?.toLowerCase().includes(barcodeFilter.trim().toLowerCase())
    );

    // Pagination Logic
    const paginatedPendingBatches = pendingBatches.slice((pendingPage - 1) * ITEMS_PER_PAGE, pendingPage * ITEMS_PER_PAGE);
    const paginatedCompletedBatches = completedBatches.slice((completedPage - 1) * ITEMS_PER_PAGE, completedPage * ITEMS_PER_PAGE);
    const paginatedScannedComponents = filteredScannedComponents.slice((scannedPage - 1) * ITEMS_PER_PAGE, scannedPage * ITEMS_PER_PAGE);

    const getShift = () => {
        const h = new Date().getHours();
        if (h >= 23 || h < 7)  return 'C (11PM – 07AM)';
        if (h >= 15 && h < 23) return 'B (03PM – 11PM)';
        if (h >= 8  && h < 17) return 'G (08AM – 05PM)';
        if (h >= 6  && h < 15) return 'A (06AM – 03PM)';
        return 'N/A';
    };

    const selectedWoDetails = batches.find(b => b.id === selectedWoId);

    return (
        <div className={styles.container}>
            <div className={styles.headerRow}>
                <div className={styles.headerContent}>
                    <h2><span role="img" aria-label="printer">🖨️</span> PCB Generation</h2>
                    <p>Manage PCB barcode scanning and registration. Shift: <strong>{getShift()}</strong></p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div className={styles.statsBadge} style={{ background: '#f1f5f9', color: '#475569' }}>
                        Logged in: <strong>{smtUser?.name}</strong>
                    </div>
                    <button
                        onClick={() => { if (window.confirm('Are you sure you want to logout from SMT?')) smtLogout(); }}
                        className={styles.secondaryButton}
                        style={{ borderColor: '#ef4444', color: '#ef4444' }}
                    >
                        Logout SMT
                    </button>
                </div>
            </div>

            {!activeBatch ? (
                <>
                    {/* Create Batch */}
                    <div className={styles.card}>
                        <h3>Start PCB Generation</h3>
                        <div className={styles.formGrid}>
                            <div className={styles.inputGroup}>
                                <label>Select Work Order *</label>
                                <select
                                    className={styles.batchSelect}
                                    value={selectedWoId}
                                    onChange={(e) => setSelectedWoId(e.target.value)}
                                >
                                    <option value="">-- Select Work Order --</option>
                                    {dropdownBatches.map(wo => (
                                        <option key={wo.id} value={wo.id}>
                                            {wo.id} - {wo.product_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Product Name (Auto-filled)</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    value={selectedWoDetails?.product_name || ''}
                                    readOnly
                                    style={{ backgroundColor: '#f3f4f6' }}
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Total Qty (Auto-filled)</label>
                                <input
                                    type="number"
                                    className={styles.input}
                                    value={selectedWoDetails?.quantity || ''}
                                    readOnly
                                    style={{ backgroundColor: '#f3f4f6' }}
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Panel Qty (Auto-filled)</label>
                                <input
                                    type="number"
                                    className={styles.input}
                                    value={selectedWoDetails?.panel_quantity || ''}
                                    readOnly
                                    style={{ backgroundColor: '#f3f4f6' }}
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Barcode Source (Auto-filled)</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    value={selectedWoDetails?.barcode_source || ''}
                                    readOnly
                                    style={{ backgroundColor: '#f3f4f6', fontWeight: 600, color: '#4f46e5' }}
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Scanner Name *</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    placeholder="Your Name"
                                    value={scannerName}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setScannerName(e.target.value.toUpperCase())}
                                />
                            </div>
                        </div>
                        <button className={styles.button} onClick={handleStartBatch}>
                            Start Scanning
                        </button>
                    </div>

                    {/* Pending Batches */}
                    <div className={styles.card}>
                        <h3>Pending Batches</h3>
                        <div className={styles.tableContainer}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Work Order</th>
                                        <th>Product Name</th>
                                        <th>Barcode Source</th>
                                        <th>Total Qty</th>
                                        <th>Scanned Qty</th>
                                        <th>Pending Qty</th>
                                        <th>Status</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedPendingBatches.map((batch: SmtWorkOrder) => (
                                        <tr key={batch.id}>
                                            <td style={{ fontWeight: 600 }}>{batch.id}</td>
                                            <td>{batch.product_name}</td>
                                            <td style={{ color: '#4f46e5', fontWeight: 600 }}>{batch.barcode_source}</td>
                                            <td>{batch.quantity}</td>
                                            <td className={styles.statusBlue}>{batch.scanned_count}</td>
                                            <td className={styles.statusYellow}>{batch.quantity - Number(batch.scanned_count)}</td>
                                            <td><span className={`${styles.badge} ${styles.badgeInfo}`}>PENDING</span></td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                    <button
                                                        className={styles.secondaryButton}
                                                        onClick={() => handleViewBatch(batch)}
                                                    >
                                                        Resume
                                                    </button>
                                                    {((smtUser as any)?.role === 'Super Admin' || (smtUser as any)?.role === 'Admin') && (
                                                        <button 
                                                            className={styles.deleteTextButton}
                                                            onClick={() => handleDeleteBatch(batch.id)}
                                                            title="Delete Scan Session"
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
                                            <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                                                No pending Work Orders.
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
                                        <th>Work Order</th>
                                        <th>Product Name</th>
                                        <th>Barcode Source</th>
                                        <th>Total Qty</th>
                                        <th>Completed Qty</th>
                                        <th>Pending Qty</th>
                                        <th>Status</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedCompletedBatches.map((batch: SmtWorkOrder) => (
                                        <tr key={batch.id}>
                                            <td style={{ fontWeight: 600 }}>{batch.id}</td>
                                            <td>{batch.product_name}</td>
                                            <td style={{ color: '#4f46e5', fontWeight: 600 }}>{batch.barcode_source}</td>
                                            <td>{batch.quantity}</td>
                                            <td className={styles.statusGreen}>{batch.scanned_count}</td>
                                            <td className={styles.statusGreen}>0</td>
                                            <td><span className={`${styles.badge} ${styles.badgeSuccess}`}>COMPLETED</span></td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                    <button
                                                        className={styles.secondaryButton}
                                                        onClick={() => handleViewBatch(batch)}
                                                        title="View Details"
                                                    >
                                                        View
                                                    </button>
                                                    {((smtUser as any)?.role === 'Super Admin' || (smtUser as any)?.role === 'Admin') && (
                                                        <button 
                                                            className={styles.deleteTextButton}
                                                            onClick={() => handleDeleteBatch(batch.id)}
                                                            title="Delete Scan Session"
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
                                            <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                                                No completed Work Orders.
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
                            <h3>Work Order: {activeBatch.id}</h3>
                            <small>Product: {activeBatch.product_name} | Source: {activeBatch.barcode_source}</small>
                            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', fontSize: '0.95rem', color: '#4b5563', marginTop: '0.5rem' }}>
                                <span>Total Scanned: <strong>{scannedComponents.length}</strong> / {activeBatch.quantity}</span>
                                <span style={{ color: '#2563eb', fontWeight: 600 }}>Scanned Qty: {scannedComponents.length}</span>
                                <span style={{ color: '#f59e0b', fontWeight: 600 }}>Pending Qty: {activeBatch.quantity - scannedComponents.length}</span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            {activeBatch.barcode_source === 'GENERATED' && (
                                <>
                                    <button className={styles.secondaryButton} onClick={() => setShowRemainingModal(true)}>
                                        📋 View Remaining
                                    </button>
                                    <button className={styles.button} onClick={handlePrintAll} disabled={allSerials.length === 0}>
                                        🖨️ Print Labels
                                    </button>
                                </>
                            )}
                            <button
                                className={styles.secondaryButton}
                                onClick={() => { setActiveBatch(null); fetchBatches(); }}
                            >
                                Back to Dashboard
                            </button>
                        </div>
                    </div>

                    <div className={styles.scanSection}>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Scanned By *</label>
                            <input
                                type="text"
                                className={styles.input}
                                placeholder="Enter Your Name"
                                value={scannerName}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setScannerName(e.target.value.toUpperCase())}
                                style={{ maxWidth: '300px' }}
                            />
                        </div>

                        <form className={styles.scanForm} onSubmit={handleScan}>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <input
                                    type="text"
                                    className={styles.scanInput}
                                    placeholder="Scan PCB Barcode..."
                                    value={barcode}
                                    onChange={(e) => setBarcode(e.target.value)}
                                    autoFocus
                                    disabled={scannedComponents.length >= activeBatch.quantity}
                                />
                            </div>
                            <button type="submit" className={styles.scanButton} disabled={scannedComponents.length >= activeBatch.quantity}>
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
                                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                        setBarcodeFilter(e.target.value);
                                                        setScannedPage(1);
                                                    }}
                                                    autoFocus
                                                    className={styles.input}
                                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', width: '100%', boxSizing: 'border-box' }}
                                                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
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
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedScannedComponents.map((item) => (
                                    <tr key={item.id}>
                                        <td style={{ fontWeight: 600 }}>{item.serial_number}</td>
                                        <td>{item.scanned_by}</td>
                                        <td>{new Date(item.scanned_at).toLocaleString()}</td>
                                        <td className={styles.statusGreen}>{item.status}</td>
                                    </tr>
                                ))}
                                {filteredScannedComponents.length === 0 && (
                                    <tr>
                                        <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                                            No components scanned yet.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                        <Pagination
                            currentPage={scannedPage}
                            totalPages={Math.ceil(filteredScannedComponents.length / ITEMS_PER_PAGE)}
                            onPageChange={setScannedPage}
                        />
                    </div>

                    {/* Remaining Barcodes Modal */}
                    {showRemainingModal && (
                        <div className={styles.modalOverlay} onClick={() => setShowRemainingModal(false)}>
                            <div className={styles.card} style={{ maxWidth: '600px', width: '100%', margin: '2rem', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '1rem' }}>
                                    <h3 style={{ margin: 0, borderBottom: 'none', paddingBottom: 0 }}>Remaining Barcodes ({remainingSerials.length})</h3>
                                    <button onClick={() => setShowRemainingModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#9ca3af' }}>&times;</button>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                    <p style={{ color: '#4b5563', margin: 0 }}>These serial numbers have not been scanned yet.</p>
                                    <button className={styles.button} onClick={handlePrintRemaining} disabled={remainingSerials.length === 0}>
                                        🖨️ Print Remaining
                                    </button>
                                </div>
                                <div className={styles.tableContainer}>
                                    <table className={styles.table}>
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>Barcode Number</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {remainingSerials.map((s, idx) => (
                                                <tr key={s.id}>
                                                    <td>{idx + 1}</td>
                                                    <td style={{ fontWeight: 600 }}>{s.serial_number}</td>
                                                    <td className={styles.statusYellow}>Pending</td>
                                                </tr>
                                            ))}
                                            {remainingSerials.length === 0 && (
                                                <tr>
                                                    <td colSpan={3} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                                                        All barcodes have been scanned! 🎉
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default PCBGeneration;
