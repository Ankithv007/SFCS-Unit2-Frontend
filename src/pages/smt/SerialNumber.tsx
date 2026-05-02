import React, { useState, useEffect } from 'react';
import styles from './SerialNumber.module.css';
import { useSmtAuth } from '../../context/SmtAuthContext';
import QRCodeReact from 'react-qr-code';
import QRCode from 'qrcode';

interface ScannedComponent {
    id: string;
    barcode: string;
    scanned_by: string;
    scanned_at: string;
    product_name: string;
    wo_qty: number;
    panel_qty: number;
    wo_number: string;
    status: 'ACCEPTED' | 'REWORK' | 'SCRAP' | 'SCANNED';
}

interface SmtBatch {
    id: number;
    work_order_id: string;
    product_name: string;
    wo_qty: number;
    panel_qty: number;
    serial_format: string;
    starting_number: number;
    end_number: number;
    created_by: string;
    created_at: string;
    is_registered: boolean;
    components: ScannedComponent[];
}

export const SerialNumber: React.FC = () => {
    const { smtUser } = useSmtAuth();
    const [workOrders, setWorkOrders] = useState<any[]>([]);

    // Form state
    const [selectedWoId, setSelectedWoId] = useState('');
    const [productName, setProductName] = useState('');
    const [woQty, setWoQty] = useState('');
    const [panelQty, setPanelQty] = useState('');
    const [createdBy, setCreatedBy] = useState('');
    const [serialFormat, setSerialFormat] = useState('');
    const [startingNumber, setStartingNumber] = useState('');
    const [endNumber, setEndNumber] = useState('');

    // Active batch state
    const [activeBatch, setActiveBatch] = useState<SmtBatch | null>(null);
    const [barcodeFilter, setBarcodeFilter] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [scannedBy, setScannedBy] = useState('');
    const [scanInput, setScanInput] = useState('');
    const [actuallyScanned, setActuallyScanned] = useState<string[]>([]);
    const [viewMode, setViewMode] = useState<'GENERATED' | 'REGISTRATION_PENDING' | 'REGISTRATION_COMPLETED' | null>(null);

    const [batches, setBatches] = useState<SmtBatch[]>([]);

    const fetchBatches = async (woId?: string) => {
        try {
            const url = woId ? `/api/smt/serial-numbers?work_order_id=${woId}` : '/api/smt/serial-numbers';
            const serialRes = await fetch(url);
            if (serialRes.ok) {
                const serialData = await serialRes.json();
                const grouped = serialData.reduce((acc: any, curr: any) => {
                    const key = `${curr.work_order_id}-${curr.serial_format.replace(/-/g, "")}`;
                    if (!acc[key]) {
                        acc[key] = {
                            id: curr.id,
                            work_order_id: curr.work_order_id,
                            product_name: curr.product_name || "Unknown Product",
                            wo_qty: curr.wo_qty || 0,
                            panel_qty: curr.panel_qty || 0,
                            starting_number: parseInt(curr.serial_number.replace(/\D/g, '')),
                            end_number: parseInt(curr.serial_number.replace(/\D/g, '')),
                            serial_format: curr.serial_format.replace(/-/g, ""),
                            created_by: curr.created_by || curr.wo_created_by || "System",
                            created_at: curr.created_at,
                            is_registered: !!curr.is_registered,
                            components: []
                        };
                    }

                    const num = parseInt(curr.serial_number.replace(/\D/g, ''));
                    if (num < acc[key].starting_number) acc[key].starting_number = num;
                    if (num > acc[key].end_number) acc[key].end_number = num;

                    acc[key].components.push({
                        id: curr.id,
                        barcode: curr.serial_number,
                        scanned_by: curr.wo_created_by,
                        scanned_at: curr.created_at,
                        product_name: curr.product_name,
                        wo_qty: curr.wo_qty,
                        panel_qty: curr.panel_qty,
                        wo_number: curr.work_order_id,
                        status: curr.status || 'ACCEPTED'
                    });

                    return acc;
                }, {});
                setBatches(Object.values(grouped));
            }
        } catch (err) {
            console.error("Failed to fetch batches:", err);
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const woRes = await fetch('/api/smt/workorders/pending');
                if (woRes.ok) {
                    const data = await woRes.json();
                    setWorkOrders(data.map((wo: any) => ({
                        ...wo,
                        work_order_id: wo.id
                    })));
                }
                fetchBatches();
                if (smtUser) {
                    const name = smtUser.name || smtUser.userId || 'System';
                    setCreatedBy(name);
                    setScannedBy(name);
                }
            } catch (err) {
                console.error("Failed to fetch data:", err);
            }
        };
        fetchData();
    }, [smtUser]);

    const handlePrint = async (components: ScannedComponent[]) => {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            try {
                const labelsData = await Promise.all(components.map(async (c) => {
                    const serial = c.barcode.replace(/-/g, "");
                    const dataUrl = await QRCode.toDataURL(serial, {
                        width: 200,
                        margin: 2,
                        errorCorrectionLevel: 'H'
                    });
                    return { serial, dataUrl };
                }));

                const labelsHtml = labelsData.map(d => `
                    <div class="print-label">
                        <img src="${d.dataUrl}" />
                        <p class="serial-text">${d.serial}</p>
                    </div>
                `).join('');

                printWindow.document.write(`
                    <html>
                        <head>
                            <title>Print Labels</title>
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
                            ${labelsHtml}
                            <script>
                                window.onload = () => {
                                    setTimeout(() => {
                                        window.print();
                                        window.close();
                                    }, 500);
                                };
                            </script>
                        </body>
                    </html>
                `);
                printWindow.document.close();
            } catch (err) {
                console.error("Print Error:", err);
                alert("Failed to generate labels for printing.");
            }
        }
    };

    const handleSelectWo = (woId: string) => {
        setSelectedWoId(woId);
        const wo = workOrders.find(w => w.work_order_id === woId);
        if (wo) {
            setProductName(wo.product_name);
            setWoQty(wo.quantity.toString());
            setPanelQty(wo.panel_quantity.toString());
        } else {
            setProductName('');
            setWoQty('');
            setPanelQty('');
        }
        fetchBatches(woId);
    };

    const handleGenerateSerials = async () => {
        if (!selectedWoId || !createdBy || !startingNumber || !endNumber || !serialFormat) {
            alert('Please fill out all fields.');
            return;
        }

        const start = parseInt(startingNumber);
        const end = parseInt(endNumber);

        if (isNaN(start) || isNaN(end) || start > end) {
            alert('Please enter a valid numeric range.');
            return;
        }

        const formatStr = serialFormat.replace(/-/g, "").toUpperCase();
        const newComponents: ScannedComponent[] = [];
        for (let i = start; i <= end; i++) {
            const serialNumber = `${formatStr}${i.toString().padStart(6, '0')}`;
            newComponents.push({
                id: Date.now().toString() + i,
                barcode: serialNumber,
                scanned_by: createdBy,
                scanned_at: new Date().toISOString(),
                product_name: productName,
                wo_qty: parseInt(woQty),
                panel_qty: parseInt(panelQty),
                wo_number: selectedWoId,
                status: 'ACCEPTED'
            });
        }

        try {
            const res = await fetch('/api/smt/serial-numbers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    work_order_id: selectedWoId,
                    format: formatStr,
                    serials: newComponents.map(c => c.barcode),
                    created_by: createdBy
                })
            });

            if (res.ok) {
                const newBatch: SmtBatch = {
                    id: Date.now(),
                    work_order_id: selectedWoId,
                    product_name: productName,
                    wo_qty: parseInt(woQty),
                    panel_qty: parseInt(panelQty),
                    serial_format: formatStr,
                    starting_number: start,
                    end_number: end,
                    created_by: createdBy,
                    created_at: new Date().toISOString(),
                    is_registered: false,
                    components: newComponents
                };
                setBatches([newBatch, ...batches]);
                alert('Serials Generated Successfully!');
            } else {
                alert('Failed to generate serials via API.');
            }
        } catch (err) {
            console.error("API error:", err);
            alert('Error connecting to backend API.');
        }

        // Reset form
        setSelectedWoId('');
        setProductName('');
        setWoQty('');
        setPanelQty('');
        setSerialFormat('');
        setStartingNumber('');
        setEndNumber('');
    };

    const handleDeleteBatch = async (woId: string) => {
        if (window.confirm(`Are you sure you want to delete all serials for Work Order ${woId}? This action cannot be undone.`)) {
            try {
                const res = await fetch(`/api/smt/serial-numbers?work_order_id=${woId}`, {
                    method: 'DELETE'
                });
                if (res.ok) {
                    setBatches(batches.filter(b => b.work_order_id !== woId));
                    if (activeBatch && activeBatch.work_order_id === woId) {
                        setActiveBatch(null);
                    }
                    alert('Batch deleted successfully.');
                } else {
                    alert('Failed to delete batch from database.');
                }
            } catch (err) {
                console.error("Delete error:", err);
                alert('Error connecting to backend.');
            }
        }
    };

    const handleRegister = async (woId: string) => {
        try {
            const res = await fetch(`/api/smt/work-orders/${woId}/register`, {
                method: 'POST'
            });
            if (res.ok) {
                alert(`Work Order ${woId} registered successfully!`);
            } else {
                alert('Failed to register Work Order.');
            }
        } catch (err) {
            console.error("Registration error:", err);
            alert('Error connecting to backend API.');
        }
    };
    const handleScan = async () => {
        const cleanScan = scanInput.trim();
        if (!cleanScan) return;

        // 1. If we have an active batch, check there first
        let targetComponent = activeBatch?.components.find(c => c.barcode === cleanScan);
        let targetBatch = activeBatch;

        // 2. If no active batch OR not found in active batch, search all batches
        if (!targetComponent) {
            for (const b of batches) {
                const comp = b.components.find(c => c.barcode === cleanScan);
                if (comp) {
                    targetComponent = comp;
                    targetBatch = b;
                    break;
                }
            }
        }

        if (targetComponent && targetBatch) {
            if (targetComponent.status === 'SCANNED') {
                alert(`Serial ${cleanScan} is already scanned.`);
            } else {
                try {
                    const res = await fetch(`/api/smt/serial-numbers/${targetComponent.id}/status`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            status: 'SCANNED',
                            scannedBy: scannedBy || 'System'
                        })
                    });

                    if (res.ok) {
                        // Update local batches state
                        setBatches(prev => prev.map(b => {
                            if (b.work_order_id === targetBatch!.work_order_id) {
                                return {
                                    ...b,
                                    components: b.components.map(c => c.id === targetComponent!.id ? { ...c, status: 'SCANNED' } : c)
                                };
                            }
                            return b;
                        }));

                        // If this was the active batch, update the scanning UI state too
                        if (activeBatch && targetBatch.work_order_id === activeBatch.work_order_id) {
                            setActuallyScanned(prev => [...prev, cleanScan]);
                        } else {
                            alert(`Successfully scanned ${cleanScan} for WO ${targetBatch.work_order_id}`);
                        }
                    }
                } catch (err) {
                    console.error("Scan error:", err);
                    alert('Error connecting to backend.');
                }
            }
        } else {
            alert(`Serial ${cleanScan} not found in any pending Work Order.`);
        }
        setScanInput('');
    };
    const filteredComponents = activeBatch?.components.filter(c => {
        const matchesFilter = c.barcode.toLowerCase().includes(barcodeFilter.toLowerCase());
        
        if (viewMode === 'REGISTRATION_PENDING') {
            // Viewing from Pending: Show only items NOT yet scanned
            return matchesFilter && c.status !== 'SCANNED';
        }
        if (viewMode === 'REGISTRATION_COMPLETED') {
            // Viewing from Completed: Show only items that ARE scanned
            return matchesFilter && c.status === 'SCANNED';
        }
        
        return matchesFilter;
    }) || [];

    const itemsPerPage = 50;
    const totalPages = Math.ceil(filteredComponents.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedComponents = filteredComponents.slice(startIndex, startIndex + itemsPerPage);

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2>🔢 Serial Number</h2>
                <p>Generate SMT Serial Numbers based on Work Orders.</p>
            </div>

            {!activeBatch ? (
                <>
                    <div className={styles.card}>
                        <h3>Generate Serials for Work Order</h3>
                        <div className={styles.formGrid} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                            <div className={styles.inputGroup}>
                                <label>Select Work Order *</label>
                                <select
                                    className={styles.batchSelect}
                                    value={selectedWoId}
                                    onChange={(e) => handleSelectWo(e.target.value)}
                                >
                                    <option value="">-- Select Work Order --</option>
                                    {workOrders.map((wo, i) => (
                                        <option key={i} value={wo.work_order_id}>{wo.work_order_id}</option>
                                    ))}
                                </select>
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Product Name (Auto-filled)</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    placeholder="Product Name"
                                    value={productName}
                                    disabled
                                    style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold' }}
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>WO Qty (Auto-filled)</label>
                                <input
                                    type="number"
                                    className={styles.input}
                                    placeholder="WO Quantity"
                                    value={woQty}
                                    disabled
                                    style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold' }}
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Panel Qty (Auto-filled)</label>
                                <input
                                    type="number"
                                    className={styles.input}
                                    placeholder="Panel Quantity"
                                    value={panelQty}
                                    disabled
                                    style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold' }}
                                />
                            </div>

                            <div className={styles.inputGroup}>
                                <label>Serial Format *</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    placeholder="e.g. QWERTYUIOP"
                                    maxLength={10}
                                    value={serialFormat}
                                    onChange={(e) => setSerialFormat(e.target.value.toUpperCase())}
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Starting Number *</label>
                                <input
                                    type="number"
                                    className={styles.input}
                                    placeholder="e.g. 1"
                                    value={startingNumber}
                                    onChange={(e) => setStartingNumber(e.target.value)}
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>End Number *</label>
                                <input
                                    type="number"
                                    className={styles.input}
                                    placeholder="e.g. 100"
                                    value={endNumber}
                                    onChange={(e) => setEndNumber(e.target.value)}
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Generated By *</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    placeholder="Logged in user"
                                    value={createdBy}
                                    style={{ backgroundColor: '#f3f4f6', color: '#6b7280', fontWeight: 'bold' }}
                                    readOnly
                                />
                            </div>
                        </div>
                        <div style={{ marginTop: '30px' }}>
                            <button className={styles.button} onClick={handleGenerateSerials}>
                                Generate Serials
                            </button>
                        </div>
                    </div>

                    <div className={styles.card}>
                        <h3>Generated Batches</h3>
                        <div className={styles.tableContainer}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>PRODUCT NAME</th>
                                        <th>WO QTY</th>
                                        <th>PANEL QTY</th>
                                        <th>WO NUMBER</th>
                                        <th>START - END</th>
                                        <th>GENERATED AT</th>
                                        <th>CREATED BY</th>
                                        <th>ACTION</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {batches.filter(b => b.components.some(c => c.status !== 'SCANNED')).map((batch) => (
                                        <tr key={batch.id}>
                                            <td style={{ fontWeight: 600 }}>{batch.product_name}</td>
                                            <td>{batch.wo_qty}</td>
                                            <td>{batch.panel_qty}</td>
                                            <td style={{ color: '#2563eb', fontWeight: 600 }}>{batch.work_order_id}</td>
                                            <td>{batch.serial_format ? `${batch.serial_format}${batch.starting_number.toString().padStart(6, '0')}` : batch.starting_number} to {batch.serial_format ? `${batch.serial_format}${batch.end_number.toString().padStart(6, '0')}` : batch.end_number}</td>
                                            <td style={{ color: '#6b7280', fontSize: '0.9rem' }}>{new Date(batch.created_at).toLocaleString()}</td>
                                            <td style={{ fontWeight: 500, color: '#374151' }}>{batch.created_by}</td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button
                                                        className={styles.secondaryButton}
                                                        onClick={() => {
                                                            setActiveBatch(batch);
                                                            setCurrentPage(1);
                                                            setBarcodeFilter('');
                                                            setViewMode('GENERATED');
                                                        }}
                                                    >
                                                        View Details
                                                    </button>
                                                    <button
                                                        className={styles.deleteTextButton}
                                                        onClick={() => handleDeleteBatch(batch.work_order_id)}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {batches.filter(b => b.components.some(c => c.status !== 'SCANNED')).length === 0 && (
                                        <tr>
                                            <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                                                No serials generated yet.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className={styles.card}>
                        <h3 style={{ color: '#d97706' }}>Pending PCB Registration</h3>
                        <div className={styles.tableContainer}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>WO NUMBER</th>
                                        <th>PRODUCT NAME</th>
                                        <th>AVAILABLE</th>
                                        <th>COMPLETED</th>
                                        <th>PENDING</th>
                                        <th>ACTION</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {batches.filter(b => b.components.some(c => c.status !== 'SCANNED')).map((batch) => {
                                        const available = batch.components.length;
                                        const completed = batch.components.filter(c => c.status === 'SCANNED').length;
                                        const pending = available - completed;
                                        const isFullyScanned = available > 0 && completed === available;
                                        return (
                                            <tr key={batch.id}>
                                                <td style={{ color: '#2563eb', fontWeight: 600 }}>{batch.work_order_id}</td>
                                                <td style={{ fontWeight: 600 }}>{batch.product_name}</td>
                                                <td>{available}</td>
                                                <td style={{ color: '#059669', fontWeight: 700 }}>{completed}</td>
                                                <td style={{ color: '#d97706', fontWeight: 700 }}>{pending}</td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <button
                                                            className={styles.secondaryButton}
                                                            onClick={() => {
                                                                setActiveBatch(batch);
                                                                setCurrentPage(1);
                                                                setBarcodeFilter('');
                                                                setViewMode('REGISTRATION_PENDING');
                                                                setActuallyScanned(batch.components.filter(c => c.status === 'SCANNED').map(c => c.barcode));
                                                            }}
                                                            style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                                                        >
                                                            View
                                                        </button>
                                                        <button
                                                            className={styles.button}
                                                            disabled={!isFullyScanned || batch.is_registered}
                                                            onClick={() => {
                                                                handleRegister(batch.work_order_id);
                                                                setBatches(batches.map(b => b.id === batch.id ? { ...b, is_registered: true } : b));
                                                            }}
                                                            style={{
                                                                padding: '0.4rem 1rem',
                                                                fontSize: '0.85rem',
                                                                opacity: (!isFullyScanned || batch.is_registered) ? 0.5 : 1,
                                                                cursor: (!isFullyScanned || batch.is_registered) ? 'not-allowed' : 'pointer'
                                                            }}
                                                        >
                                                            {batch.is_registered ? 'Registered' : 'Register'}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {batches.filter(b => b.components.some(c => c.status !== 'SCANNED')).length === 0 && (
                                            <tr>
                                                <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                                                    No pending registrations.
                                                </td>
                                            </tr>
                                        )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className={styles.card}>
                        <h3 style={{ color: '#059669' }}>Completed PCB Registration</h3>
                        <div className={styles.tableContainer}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>WO NUMBER</th>
                                        <th>PRODUCT NAME</th>
                                        <th>AVAILABLE</th>
                                        <th>COMPLETED</th>
                                        <th>PENDING</th>
                                        <th>ACTION</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {batches.filter(b => b.components.some(c => c.status === 'SCANNED')).map((batch) => {
                                        const available = batch.components.length;
                                        const completed = batch.components.filter(c => c.status === 'SCANNED').length;
                                        const pending = available - completed;
                                        return (
                                            <tr key={batch.id}>
                                                <td style={{ color: '#2563eb', fontWeight: 600 }}>{batch.work_order_id}</td>
                                                <td style={{ fontWeight: 600 }}>{batch.product_name}</td>
                                                <td>{available}</td>
                                                <td style={{ color: '#059669', fontWeight: 700 }}>{completed}</td>
                                                <td style={{ color: '#d97706', fontWeight: 700 }}>{pending}</td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <button
                                                            className={styles.secondaryButton}
                                                            onClick={() => {
                                                                setActiveBatch(batch);
                                                                setCurrentPage(1);
                                                                setBarcodeFilter('');
                                                                setViewMode('REGISTRATION_COMPLETED');
                                                                setActuallyScanned(batch.components.filter(c => c.status === 'SCANNED').map(c => c.barcode));
                                                            }}
                                                            style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                                                        >
                                                            View Scanned Serials
                                                        </button>
                                                        <span style={{
                                                            color: '#059669',
                                                            fontSize: '0.85rem',
                                                            fontWeight: 700,
                                                            display: 'flex',
                                                            alignItems: 'center'
                                                        }}>
                                                            ✓ COMPLETED
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {batches.filter(b => b.components.some(c => c.status === 'SCANNED')).length === 0 && (
                                            <tr>
                                                <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                                                    No completed registrations.
                                                </td>
                                            </tr>
                                        )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <div className={styles.activeBatchHeader}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.3rem' }}>Batch: {activeBatch.work_order_id}</h3>
                            <p style={{ margin: '4px 0', fontSize: '0.9rem', color: '#6b7280' }}>Created by: {activeBatch.created_by}</p>

                            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', fontSize: '1rem', color: '#4b5563', marginTop: '1rem' }}>
                                <span>Total Scanned: <strong>{actuallyScanned.length} / {activeBatch.components.length}</strong></span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    🏭 Serial Number Available: <strong style={{ color: '#2563eb' }}>{activeBatch.components.length}</strong>
                                </span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    ✅ completed: <strong style={{ color: '#059669' }}>{actuallyScanned.length}</strong>
                                </span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    🔄 pending: <strong style={{ color: '#d97706' }}>{activeBatch.components.length - actuallyScanned.length}</strong>
                                </span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button
                                className={styles.button}
                                onClick={() => handlePrint(activeBatch.components)}
                                style={{ backgroundColor: '#059669', padding: '0.5rem 1rem' }}
                            >
                                🖨️ Print All
                            </button>
                            <button
                                className={styles.secondaryButton}
                                onClick={() => { setActiveBatch(null); setActuallyScanned([]); setViewMode(null); }}
                                style={{ padding: '0.5rem 1rem' }}
                            >
                                Back to Batches
                            </button>
                        </div>
                    </div>

                    {(viewMode === 'REGISTRATION_PENDING' || viewMode === 'REGISTRATION_COMPLETED') && (
                        <div className={styles.card} style={{ border: '1px dashed #d1d5db', backgroundColor: '#f9fafb' }}>
                            <div className={styles.inputGroup} style={{ maxWidth: '300px', marginBottom: '1.5rem' }}>
                                <label style={{ fontWeight: 'bold' }}>Scanned By *</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    value={scannedBy}
                                    onChange={(e) => setScannedBy(e.target.value)}
                                    placeholder="Enter Your Name"
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <input
                                    type="text"
                                    className={styles.input}
                                    style={{ flex: 1, height: '50px', fontSize: '1.2rem', borderColor: '#6366f1' }}
                                    placeholder="Scan Item Barcode..."
                                    value={scanInput}
                                    onChange={(e) => setScanInput(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleScan()}
                                />
                                <button
                                    className={styles.button}
                                    style={{ height: '50px', padding: '0 2rem', backgroundColor: '#10b981' }}
                                    onClick={handleScan}
                                >
                                    SCAN
                                </button>
                            </div>
                        </div>
                    )}

                    <div className={styles.scanSection}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, padding: 0, border: 'none' }}>
                                {(viewMode === 'REGISTRATION_PENDING' || viewMode === 'REGISTRATION_COMPLETED') ? `Items (${actuallyScanned.length})` : 'Generated Serial Numbers'}
                            </h3>
                            <input
                                type="text"
                                className={styles.input}
                                placeholder="Search by Serial Number..."
                                value={barcodeFilter}
                                onChange={(e) => { setBarcodeFilter(e.target.value); setCurrentPage(1); }}
                                style={{ width: '300px' }}
                            />
                        </div>

                        <div className={styles.tableContainer} style={{ maxHeight: '500px', overflowY: 'auto' }}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>SERIAL NUMBER</th>
                                        <th>BARCODE</th>
                                        <th>STATUS</th>
                                        <th>GENERATED AT</th>
                                        <th>ACTION</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedComponents.map((component) => {
                                        const isScanned = actuallyScanned.includes(component.barcode);
                                        return (
                                            <tr key={component.id} style={{ height: '100px', backgroundColor: isScanned ? '#f0fdf4' : '#fff7ed' }}>
                                                <td style={{ fontWeight: 'bold', fontSize: '1rem', letterSpacing: '1px' }}>
                                                    {component.barcode}
                                                </td>
                                                <td style={{ textAlign: 'center', padding: '0.5rem' }}>
                                                    <div className={styles.qrItem}>
                                                        <QRCodeReact
                                                            value={component.barcode.replace(/-/g, "")}
                                                            size={80}
                                                            level="H"
                                                        />
                                                        <p className={styles.serialText}>
                                                            {component.barcode.replace(/-/g, "")}
                                                        </p>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span style={{
                                                        padding: '0.25rem 0.75rem',
                                                        borderRadius: '1rem',
                                                        fontSize: '0.8rem',
                                                        fontWeight: 700,
                                                        backgroundColor: isScanned ? '#dcfce7' : '#f3f4f6',
                                                        color: isScanned ? '#15803d' : '#6b7280'
                                                    }}>
                                                        {isScanned ? '✓ SCANNED' : 'PENDING'}
                                                    </span>
                                                </td>
                                                <td style={{ color: '#6b7280', fontSize: '0.9rem' }}>
                                                    {new Date(component.scanned_at).toLocaleString()}
                                                </td>
                                                <td>
                                                    <button
                                                        className={styles.secondaryButton}
                                                        onClick={() => handlePrint([component])}
                                                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                                                    >
                                                        🖨️ Print
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {filteredComponents.length === 0 && (
                                        <tr>
                                            <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                                                {actuallyScanned.length === 0
                                                    ? "No items scanned yet. Please scan a serial number to see it here."
                                                    : "No scanned items match your search filter."}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {totalPages > 1 && (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1.5rem' }}>
                                <button
                                    className={styles.secondaryButton}
                                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    style={{ padding: '0.5rem 1rem' }}
                                >
                                    Previous
                                </button>
                                <span style={{ fontWeight: '500', color: '#4b5563' }}>
                                    Page {currentPage} of {totalPages}
                                </span>
                                <button
                                    className={styles.secondaryButton}
                                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages}
                                    style={{ padding: '0.5rem 1rem' }}
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};
