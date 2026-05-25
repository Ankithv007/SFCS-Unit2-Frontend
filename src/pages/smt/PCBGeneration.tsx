import React, { useState, useEffect, useRef } from 'react';
import styles from './PCBGeneration.module.css';
import { useSmtAuth } from '../../context/SmtAuthContext';
import { useAuth } from '../../hooks/useAuth';
import { apiFetch } from '../../utils/api';
import { Pagination } from '../../components/Pagination';
import QRCode from 'qrcode';
import QRCodeReact from 'react-qr-code';
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
    generated_qty?: number;
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
    const { user } = useAuth();
    const isSuperAdmin = (user?.role || '').toLowerCase() === 'admin' || user?.role === 'Super Admin';

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
    const scanInputRef = useRef<HTMLInputElement>(null);

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
            const data = await apiFetch(`/api/smt/inspections?work_order_id=${woId}&process_step=PCB Registration`);
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
        showToast(`Started PCB Registration for ${selectedWo.id}`, 'success');
        setTimeout(() => { scanInputRef.current?.focus(); }, 100);
    };

    const handleViewBatch = (batch: SmtWorkOrder) => {
        setScannerName(smtUser?.name || '');
        setActiveBatch(batch);
        fetchComponents(batch.id);
        fetchAllSerials(batch.id);
        setTimeout(() => { scanInputRef.current?.focus(); }, 100);
    };

    const handleDeleteBatch = async (batchId: string) => {
        if (!isSuperAdmin) {
            showToast("Access Denied: Only Super Admin can delete.", "error");
            return;
        }
        if (!window.confirm(`Are you sure you want to reset and delete the scan session for Work Order ${batchId}? This will remove all PCB Registration records for this batch.`)) {
            return;
        }

        try {
            await apiFetch(`/api/smt/inspections/batch?work_order_id=${batchId}&process_step=PCB Registration`, {
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

    const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const trimmedBarcode = e.currentTarget.value.trim().toUpperCase();
            if (!trimmedBarcode || !activeBatch) return;

            if (!scannerName.trim()) {
                showToast('Please enter Scanner Name', 'error');
                return;
            }

            const targetLimit = activeBatch.barcode_source !== 'PRE_EXISTING'
                ? Number(activeBatch.generated_qty || allSerials.length)
                : activeBatch.quantity;

            if (scannedComponents.length >= targetLimit) {
                showToast(`Target quantity (${targetLimit}) already reached.`, 'error');
                setBarcode('');
                return;
            }

            // Sync the state immediately just in case
            setBarcode(trimmedBarcode);
            await submitScan(trimmedBarcode);
        }
    };

    const handleScan = async (e: React.FormEvent) => {
        e.preventDefault();
        const currentVal = scanInputRef.current?.value || barcode;
        const trimmedBarcode = currentVal.trim().toUpperCase();
        if (!trimmedBarcode || !activeBatch) return;

        if (!scannerName.trim()) {
            showToast('Please enter Scanner Name', 'error');
            return;
        }

        const targetLimit = activeBatch.barcode_source !== 'PRE_EXISTING'
            ? Number(activeBatch.generated_qty || allSerials.length)
            : activeBatch.quantity;

        if (scannedComponents.length >= targetLimit) {
            showToast(`Target quantity (${targetLimit}) already reached.`, 'error');
            setBarcode('');
            return;
        }

        setBarcode(trimmedBarcode);
        await submitScan(trimmedBarcode);
    };

    const submitScan = async (code: string) => {
        if (scanLock.current) return;
        
        // Prevent duplicate scanning in this step
        if (scannedComponents.some(c => c.serial_number === code)) {
            showToast(`Barcode ${code} has already been scanned for this Work Order.`, 'error');
            setBarcode('');
            scanInputRef.current?.focus();
            return;
        }

        scanLock.current = true;
        setTimeout(() => { scanLock.current = false; }, 300);

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
                    scanInputRef.current?.focus();
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
                    process_step: 'PCB Registration',
                    scanned_by: scannerName,
                    status: 'PASS'
                })
            });

            showToast('PCB Scanned Successfully', 'success');
            setBarcode('');
            scanInputRef.current?.focus();
            
            // Refresh counts
            await fetchComponents(activeBatch!.id);
            
            // Update active batch count optimistically
            setActiveBatch(prev => prev ? { ...prev, scanned_count: Number(prev.scanned_count) + 1 } : prev);

        } catch (error: any) {
            console.error('Error scanning component:', error);
            showToast(error.message || 'Scan failed', 'error');
            setBarcode('');
            scanInputRef.current?.focus();
        }
    };

    // Automatic Scanner Submit Behavior (exactly like Spi.tsx)
    useEffect(() => {
        if (!activeBatch) return;
        const cleanInput = (barcode || '').trim().replace(/-/g, '').toUpperCase();
        if (cleanInput.length < 5) return; // Min length for auto-trigger

        const match = allSerials.find((s: any) =>
            [s.serial_number].some(v =>
                (v || '').toString().replace(/-/g, '').toUpperCase() === cleanInput
            )
        );

        if (match) {
            const alreadyScanned = scannedComponents.some(c => c.serial_number === match.serial_number);
            if (!alreadyScanned) {
                if (scannerName.trim()) {
                    submitScan(match.serial_number);
                }
            }
        }
    }, [barcode, allSerials, scannedComponents, activeBatch, scannerName]);


    // const handlePrintAll = async () => {
    //     if (allSerials.length === 0) {
    //         showToast('No serials to print', 'info');
    //         return;
    //     }
    //     
    //     const printWindow = window.open('', '_blank');
    //     if (!printWindow) return;
    // 
    //     try {
    //         const labelsData = await Promise.all(allSerials.map(async (s) => {
    //             const dataUrl = await QRCode.toDataURL(s.serial_number, {
    //                 width: 200, margin: 2, errorCorrectionLevel: 'H'
    //             });
    //             return { serial: s.serial_number, dataUrl };
    //         }));
    // 
    //         const html = `
    //             <html>
    //                 <head>
    //                     <title>Print Labels - ${activeBatch?.id}</title>
    //                     <style>
    //                         @media print { body { margin: 0; } .label { page-break-after: always; } }
    //                         body { display: flex; flex-direction: column; align-items: center; font-family: sans-serif; }
    //                         .label { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; }
    //                         .serial { margin-top: 10px; font-size: 16px; font-weight: bold; }
    //                         img { width: 150px; height: 150px; }
    //                     </style>
    //                 </head>
    //                 <body>
    //                     \${labelsData.map(d => `
    //                         <div class="label">
    //                             <img src="\${d.dataUrl}" />
    //                             <div class="serial">\${d.serial}</div>
    //                             <div style="font-size: 12px; color: #4b5563; margin-top: 4px;">WO: \${activeBatch?.id}</div>
    //                             <div style="font-size: 12px; color: #4b5563;">Product: \${activeBatch?.product_name}</div>
    //                         </div>
    //                     `).join('')}
    //                     <script>window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 500); };<\/script>
    //                 </body>
    //             </html>
    //         `;
    //         printWindow.document.write(html);
    //         printWindow.document.close();
    //     } catch (err) {
    //         console.error("Print error:", err);
    //         showToast("Failed to generate print labels", "error");
    //     }
    // };

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
                const serial = s.serial_number.replace(/-/g, "").toUpperCase();
                const dataUrl = await QRCode.toDataURL(serial, {
                    width: 200, margin: 2, errorCorrectionLevel: 'H'
                });
                return { serial, dataUrl };
            }));

            const html = `
                <html>
                    <head>
                        <title>Print Remaining Labels - ${activeBatch?.id}</title>
                        <style>
                            @media print {
                                body { margin: 0; padding: 0; }
                                @page { margin: 0; }
                            }
                            body {
                                display: flex;
                                flex-direction: column;
                                align-items: center;
                                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                            }
                            .print-label {
                                display: flex;
                                flex-direction: column;
                                align-items: center;
                                justify-content: center;
                                page-break-after: always;
                                padding: 20px;
                                text-align: center;
                            }
                            .serial-text {
                                margin-top: 10px;
                                font-size: 18px;
                                font-weight: bold;
                                color: #000;
                            }
                            img {
                                width: 150px;
                                height: 150px;
                                display: block;
                            }
                        </style>
                    </head>
                    <body>
                        ${labelsData.map(d => `
                            <div class="print-label">
                                <img src="${d.dataUrl}" />
                                <p class="serial-text">${d.serial}</p>
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

    // const handleDownloadPending = async () => {
    //     if (remainingSerials.length === 0) {
    //         showToast('No remaining serials to download', 'info');
    //         return;
    //     }
    // 
    //     try {
    //         const labelsData = await Promise.all(remainingSerials.map(async (s) => {
    //             const dataUrl = await QRCode.toDataURL(s.serial_number, {
    //                 width: 200, margin: 2, errorCorrectionLevel: 'H'
    //             });
    //             return { serial: s.serial_number, dataUrl };
    //         }));
    // 
    //         const htmlContent = `
    //             <!DOCTYPE html>
    //             <html>
    //                 <head>
    //                     <title>Pending Barcodes - \${activeBatch?.id}</title>
    //                     <style>
    //                         body {
    //                             font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    //                             margin: 0;
    //                             padding: 2rem;
    //                             background-color: #f3f4f6;
    //                             display: flex;
    //                             flex-direction: column;
    //                             align-items: center;
    //                         }
    //                         .header {
    //                             text-align: center;
    //                             margin-bottom: 2rem;
    //                             background: #ffffff;
    //                             padding: 1.5rem 2.5rem;
    //                             border-radius: 12px;
    //                             box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
    //                             width: 100%;
    //                             max-width: 600px;
    //                         }
    //                         .header h1 { margin: 0 0 0.5rem 0; font-size: 1.5rem; color: #111827; }
    //                         .header p { margin: 0.25rem 0; font-size: 0.9rem; color: #4b5563; }
    //                         .grid {
    //                             display: grid;
    //                             grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    //                             gap: 1.5rem;
    //                             width: 100%;
    //                             max-width: 1000px;
    //                         }
    //                         .card {
    //                             background: #ffffff;
    //                             border: 1px solid #e5e7eb;
    //                             border-radius: 8px;
    //                             padding: 1rem;
    //                             display: flex;
    //                             flex-direction: column;
    //                             align-items: center;
    //                             justify-content: center;
    //                             box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    //                         }
    //                         .card img {
    //                             width: 140px;
    //                             height: 140px;
    //                             display: block;
    //                         }
    //                         .serial {
    //                             margin-top: 0.75rem;
    //                             font-size: 0.95rem;
    //                             font-weight: bold;
    //                             color: #111827;
    //                             word-break: break-all;
    //                             text-align: center;
    //                         }
    //                         .meta {
    //                             font-size: 0.75rem;
    //                             color: #6b7280;
    //                             margin-top: 0.25rem;
    //                             text-align: center;
    //                         }
    //                         @media print {
    //                             body { background-color: #ffffff; padding: 0; }
    //                             .header { display: none; }
    //                             .grid { display: block; }
    //                             .card { page-break-after: always; border: none; box-shadow: none; padding: 20px; }
    //                             .card img { width: 150px; height: 150px; }
    //                         }
    //                     </style>
    //                 </head>
    //                 <body>
    //                     <div class="header">
    //                         <h1>Pending Barcodes</h1>
    //                         <p><strong>Work Order:</strong> \${activeBatch?.id}</p>
    //                         <p><strong>Product Name:</strong> \${activeBatch?.product_name || 'N/A'}</p>
    //                         <p><strong>Total Pending Count:</strong> \${remainingSerials.length}</p>
    //                         <p style="font-size: 0.8rem; color: #9ca3af; margin-top: 0.5rem;">Downloaded on: \${new Date().toLocaleString()}</p>
    //                     </div>
    //                     <div class="grid">
    //                         \${labelsData.map(d => `
    //                             <div class="card">
    //                                 <img src="\${d.dataUrl}" />
    //                                 <div class="serial">\${d.serial}</div>
    //                                 <div class="meta">WO: \${activeBatch?.id}</div>
    //                                 <div class="meta">Product: \${activeBatch?.product_name}</div>
    //                             </div>
    //                         `).join('')}
    //                     </div>
    //                 </body>
    //             </html>
    //         `;
    // 
    //         const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    //         const url = URL.createObjectURL(blob);
    //         const link = document.createElement('a');
    //         link.href = url;
    //         link.setAttribute('download', `pending_barcodes_WO_\${activeBatch?.id || 'export'}.html`);
    //         document.body.appendChild(link);
    //         link.click();
    //         document.body.removeChild(link);
    //         showToast('Pending barcodes list downloaded successfully', 'success');
    //     } catch (err) {
    //         console.error("Download error:", err);
    //         showToast("Failed to generate offline download", "error");
    //     }
    // };

    // Filter Logic
    const dropdownBatches = batches.filter(b => {
        const isGenerated = b.barcode_source !== 'PRE_EXISTING';
        const targetQty = isGenerated ? Number(b.generated_qty || 0) : b.quantity;
        return Number(b.scanned_count) === 0 && targetQty > 0;
    });

    const pendingBatches = batches.filter(b => {
        const isGenerated = b.barcode_source !== 'PRE_EXISTING';
        const targetQty = isGenerated ? Number(b.generated_qty || 0) : b.quantity;
        return Number(b.scanned_count) > 0 && Number(b.scanned_count) < targetQty;
    });

    const completedBatches = batches.filter(b => {
        const isGenerated = b.barcode_source !== 'PRE_EXISTING';
        const targetQty = isGenerated ? Number(b.generated_qty || 0) : b.quantity;
        return Number(b.scanned_count) >= targetQty && targetQty > 0;
    });

    const sortedScannedComponents = [...scannedComponents].sort((a, b) => {
        const timeA = a.scanned_at ? new Date(a.scanned_at).getTime() : Date.now();
        const timeB = b.scanned_at ? new Date(b.scanned_at).getTime() : Date.now();
        return timeB - timeA;
    });

    const filteredScannedComponents = sortedScannedComponents.filter((item) =>
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
    const targetLimit = activeBatch ? (activeBatch.barcode_source !== 'PRE_EXISTING' ? Number(activeBatch.generated_qty || allSerials.length) : activeBatch.quantity) : 0;

    return (
        <div className={styles.container}>
            <style>{`
                @keyframes rowHighlight {
                    0% { box-shadow: inset 0 0 20px rgba(79, 70, 229, 0.4); }
                    100% { box-shadow: none; }
                }
            `}</style>
            <div className={styles.headerRow}>
                <div className={styles.headerContent}>
                    <h2><span role="img" aria-label="printer">🖨️</span> PCB Registration</h2>
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
                        <h3>Start PCB Registration</h3>
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
                                                    <button 
                                                        className={styles.secondaryButton}
                                                        style={{ borderColor: '#ef4444', color: '#ef4444' }}
                                                        onClick={() => handleDeleteBatch(batch.id)}
                                                        title="Delete Scan Session"
                                                    >
                                                        Delete
                                                    </button>
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
                                                    <button 
                                                        className={styles.secondaryButton}
                                                        style={{ borderColor: '#ef4444', color: '#ef4444' }}
                                                        onClick={() => handleDeleteBatch(batch.id)}
                                                        title="Delete Scan Session"
                                                    >
                                                        Delete
                                                    </button>
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
                                <span>Total Scanned: <strong>{scannedComponents.length}</strong> / {activeBatch.barcode_source !== 'PRE_EXISTING' ? (activeBatch.generated_qty || allSerials.length) : activeBatch.quantity}</span>
                                <span style={{ color: '#2563eb', fontWeight: 600 }}>Scanned Qty: {scannedComponents.length}</span>
                                <span style={{ color: '#f59e0b', fontWeight: 600 }}>Pending Qty: {Math.max(0, (activeBatch.barcode_source !== 'PRE_EXISTING' ? (activeBatch.generated_qty || allSerials.length) : activeBatch.quantity) - scannedComponents.length)}</span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            {(activeBatch.barcode_source === 'GENERATED' || activeBatch.barcode_source === 'Generate Barcode') && (
                                <button className={styles.secondaryButton} onClick={() => setShowRemainingModal(true)}>
                                    📋 View Pending Barcodes
                                </button>
                            )}
                            {(activeBatch.barcode_source === 'GENERATED' || activeBatch.barcode_source === 'Generate Barcode') && remainingSerials.length > 0 && (
                                <button 
                                    className={styles.button} 
                                    style={{ background: '#2563eb', borderColor: '#2563eb' }} 
                                    onClick={handlePrintRemaining}
                                >
                                    📥 Download Pending Barcode PDF
                                </button>
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
                                    ref={scanInputRef}
                                    type="text"
                                    className={styles.scanInput}
                                    placeholder="Scan PCB Barcode..."
                                    value={barcode}
                                    onChange={(e) => setBarcode(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    autoFocus
                                    disabled={scannedComponents.length >= targetLimit}
                                />
                            </div>
                            <button type="submit" className={styles.scanButton} disabled={scannedComponents.length >= targetLimit}>
                                SCAN
                            </button>
                        </form>

                        <h3>Scanned Components ({scannedComponents.length})</h3>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th style={{ position: 'relative', textAlign: 'center', verticalAlign: 'middle' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                            SERIAL NUMBER
                                            <button
                                                type="button"
                                                onClick={() => setShowBarcodeFilter(!showBarcodeFilter)}
                                                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.9rem' }}
                                                title="Filter Serial Number"
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
                                    <th style={{ textAlign: 'center', verticalAlign: 'middle' }}>BARCODE PREVIEW</th>
                                    <th style={{ textAlign: 'center', verticalAlign: 'middle' }}>STATUS</th>
                                    <th style={{ textAlign: 'center', verticalAlign: 'middle' }}>SCANNED BY</th>
                                    <th style={{ textAlign: 'center', verticalAlign: 'middle' }}>SCANNED AT</th>
                                </tr>
                            </thead>
                            <tbody>
                                <style>{`
                                    @keyframes rowHighlight {
                                        0% { background-color: #dbeafe; }
                                        100% { background-color: transparent; }
                                    }
                                `}</style>
                                {paginatedScannedComponents.map((item) => {
                                    const codeValue = (item.serial_number || '').toUpperCase();
                                    const isNew = Date.now() - new Date(item.scanned_at || 0).getTime() < 4000;
                                    return (
                                        <tr 
                                            key={item.id} 
                                            style={{ 
                                                height: '140px',
                                                animation: isNew ? 'rowHighlight 4s ease-out' : undefined
                                            }}
                                        >
                                            <td style={{ 
                                                fontWeight: 'bold', 
                                                fontSize: '1rem', 
                                                letterSpacing: '1px',
                                                textAlign: 'center', 
                                                verticalAlign: 'middle' 
                                            }}>
                                                {codeValue}
                                            </td>
                                            <td style={{ 
                                                textAlign: 'center', 
                                                verticalAlign: 'middle',
                                                padding: '0.5rem'
                                            }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                                                    <QRCodeReact
                                                        value={codeValue.replace(/-/g, "")}
                                                        size={65}
                                                        level="H"
                                                        style={{ display: 'block', margin: '0 auto' }}
                                                    />
                                                    <p style={{ marginTop: '0.5rem', marginBottom: 0, fontSize: '0.8rem', fontWeight: 'bold', color: '#111827' }}>
                                                        {codeValue}
                                                    </p>
                                                </div>
                                            </td>
                                            <td style={{ 
                                                textAlign: 'center', 
                                                verticalAlign: 'middle' 
                                            }}>
                                                <span className={`${styles.badge} ${styles.badgeSuccess}`} style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}>
                                                    {item.status}
                                                </span>
                                            </td>
                                            <td style={{ 
                                                textAlign: 'center', 
                                                verticalAlign: 'middle',
                                                fontWeight: 500,
                                                color: '#374151'
                                            }}>
                                                {item.scanned_by}
                                            </td>
                                            <td style={{ 
                                                color: '#6b7280', 
                                                fontSize: '0.9rem', 
                                                textAlign: 'center', 
                                                verticalAlign: 'middle' 
                                            }}>
                                                {new Date(item.scanned_at).toLocaleString()}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredScannedComponents.length === 0 && (
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
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
                                                <th style={{ textAlign: 'center', verticalAlign: 'middle' }}>#</th>
                                                <th style={{ textAlign: 'center', verticalAlign: 'middle' }}>Barcode Number</th>
                                                <th style={{ textAlign: 'center', verticalAlign: 'middle' }}>Preview</th>
                                                <th style={{ textAlign: 'center', verticalAlign: 'middle' }}>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {remainingSerials.map((s, idx) => (
                                                <tr key={s.id} style={{ height: '90px' }}>
                                                    <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>{idx + 1}</td>
                                                    <td style={{ fontWeight: 600, textAlign: 'center', verticalAlign: 'middle' }}>{s.serial_number}</td>
                                                    <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0.25rem' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                            <QRCodeReact value={s.serial_number.replace(/-/g, "").toUpperCase()} size={45} level="H" />
                                                        </div>
                                                    </td>
                                                    <td className={styles.statusYellow} style={{ textAlign: 'center', verticalAlign: 'middle' }}>Pending</td>
                                                </tr>
                                            ))}
                                            {remainingSerials.length === 0 && (
                                                <tr>
                                                    <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
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
