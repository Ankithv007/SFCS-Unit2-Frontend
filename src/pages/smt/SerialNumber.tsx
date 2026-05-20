import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './SerialNumber.module.css';
import { useSmtAuth } from '../../context/SmtAuthContext';
import { useAuth } from '../../hooks/useAuth';
import { apiFetch } from '../../utils/api';
import QRCodeReact from 'react-qr-code';
import QRCode from 'qrcode';

// ─── Toaster ─────────────────────────────────────────────────────────────────
interface Toast { id: number; message: string; type: 'success' | 'error' | 'info'; }

const Toaster: React.FC<{ toasts: Toast[]; onRemove: (id: number) => void }> = ({ toasts, onRemove }) => (
    <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 9999, display: 'flex', flexDirection: 'column-reverse', gap: '0.5rem' }}>
        {toasts.map(t => (
            <div key={t.id} onClick={() => onRemove(t.id)} style={{
                padding: '0.85rem 1.25rem', borderRadius: '0.6rem', cursor: 'pointer', minWidth: '280px',
                background: t.type === 'error' ? '#fee2e2' : t.type === 'success' ? '#dcfce7' : '#fffbeb',
                color: t.type === 'error' ? '#991b1b' : t.type === 'success' ? '#166534' : '#92400e',
                border: `1px solid ${t.type === 'error' ? '#fca5a5' : t.type === 'success' ? '#86efac' : '#fde68a'}`,
                fontWeight: 600, fontSize: '0.9rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                animation: 'slideIn 0.2s ease'
            }}>
                {t.type === 'error' ? '❌ ' : t.type === 'success' ? '✅ ' : 'ℹ️ '}{t.message}
            </div>
        ))}
    </div>
);

interface ScannedComponent {
    id: string;
    barcode: string;
    scanned_by: string;
    scanned_at: string;
    product_name: string;
    wo_qty: number;
    panel_qty: number;
    wo_number: string;
    status: 'ACCEPTED' | 'rework' | 'SCRAP' | 'SCANNED';
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
    barcode_source?: string;
    created_by: string;
    created_at: string;
    is_registered: boolean;
    components: ScannedComponent[];
}

export const SerialNumber: React.FC = () => {
    const { smtUser, smtLogout } = useSmtAuth();
    const { user } = useAuth();
    const isSuperAdmin = (user?.role || '').toLowerCase() === 'admin' || user?.role === 'Super Admin';
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
    const [barcodeSource, setBarcodeSource] = useState('Generate Barcode');

    // Active batch state
    const [activeBatch, setActiveBatch] = useState<SmtBatch | null>(null);
    const [barcodeFilter, setBarcodeFilter] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    const [batches, setBatches] = useState<SmtBatch[]>([]);

    // Toast state
    const [toasts, setToasts] = useState<Toast[]>([]);
    const toastId = useRef(0);

    const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
        const id = ++toastId.current;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    }, []);

    const removeToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

    const fetchBatches = async (woId?: string) => {
        try {
            const url = woId ? `/api/smt/serial-numbers?work_order_id=${woId}` : '/api/smt/serial-numbers';
            const serialRes = await fetch(url);
            if (serialRes.ok) {
                const serialData = await serialRes.json();
                const grouped = serialData.reduce((acc: any, curr: any) => {
                    const key = `${curr.work_order_id}-${curr.serial_format.replace(/-/g, "")}`;
                    if (!acc[key]) {
                        const rawNum = curr.serial_number.replace(/\D/g, '');
                        const num = rawNum ? parseInt(rawNum) : 0;
                        acc[key] = {
                            id: curr.id,
                            work_order_id: curr.work_order_id,
                            product_name: curr.product_name || "Unknown Product",
                            wo_qty: curr.wo_qty || 0,
                            panel_qty: curr.panel_qty || 0,
                            starting_number: num,
                            end_number: num,
                            serial_format: curr.serial_format.replace(/-/g, ""),
                            barcode_source: curr.barcode_source || (curr.serial_format.replace(/-/g, "") === 'PREEXISTING' ? 'PRE_EXISTING' : 'GENERATED'),
                            created_by: curr.created_by || curr.wo_created_by || "System",
                            created_at: curr.created_at,
                            is_registered: !!curr.is_registered,
                            components: []
                        };
                    }

                    const rawNum = curr.serial_number.replace(/\D/g, '');
                    const num = rawNum ? parseInt(rawNum) : 0;
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
                const sortedBatches = Object.values(grouped).sort((a: any, b: any) => 
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                );
                setBatches(sortedBatches as SmtBatch[]);
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
    };

    const handleGenerateSerials = async () => {
        if (!selectedWoId || !createdBy) {
            alert('Please select a Work Order.');
            return;
        }

        const isExisting = barcodeSource === 'Barcode Already Available';
        const start = parseInt(startingNumber);
        const end = parseInt(endNumber);

        if (!isExisting) {
            if (!startingNumber || !endNumber || !serialFormat) {
                alert('Please fill out all fields for barcode generation.');
                return;
            }
            if (isNaN(start) || isNaN(end) || start > end) {
                alert('Please enter a valid numeric range.');
                return;
            }
        }

        const formatStr = (serialFormat || '').replace(/-/g, "").toUpperCase();
        const newComponents: ScannedComponent[] = [];
        
        if (!isExisting) {
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
        }

        try {
            const res = await fetch('/api/smt/serial-numbers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    work_order_id: selectedWoId,
                    format: isExisting ? 'PRE-EXISTING' : formatStr,
                    serials: isExisting ? [] : newComponents.map(c => c.barcode),
                    created_by: createdBy,
                    barcode_source: isExisting ? 'PRE_EXISTING' : 'GENERATED'
                })
            });

            if (res.ok) {
                const data = await res.json();
                
                // 1. Instantly update local state
                const newBatchObj: SmtBatch = {
                    id: Date.now(),
                    work_order_id: selectedWoId,
                    product_name: productName || "Unknown Product",
                    wo_qty: parseInt(woQty) || 0,
                    panel_qty: parseInt(panelQty) || 0,
                    starting_number: isNaN(start) ? 0 : start,
                    end_number: isNaN(end) ? 0 : end,
                    serial_format: formatStr,
                    barcode_source: isExisting ? 'PRE_EXISTING' : 'GENERATED',
                    created_by: createdBy,
                    created_at: new Date().toISOString(),
                    is_registered: true,
                    components: newComponents
                };

                const updatedBatches = [newBatchObj, ...batches].sort((a, b) => 
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                );
                
                setBatches(updatedBatches);
                
                // 2. Fetch silently in background
                fetchBatches();
                
                // 3. Show non-blocking toasts instead of alerts
                if (isExisting) {
                    addToast('Work Order successfully registered for existing barcodes!', 'success');
                } else {
                    if (data.inserted === 0) {
                        addToast('All these serial numbers already exist in the system.', 'info');
                    } else if (data.inserted < data.total) {
                        addToast(`Generated ${data.inserted} new serials. ${data.total - data.inserted} already existed.`, 'success');
                    } else {
                        addToast(`Successfully generated all ${data.inserted} serials!`, 'success');
                    }
                }
            } else {
                const errorData = await res.json().catch(() => ({}));
                addToast(`Failed to register: ${errorData.error || 'Unknown API error'}`, 'error');
            }
        } catch (err) {
            console.error("API error:", err);
            addToast('Error connecting to backend API.', 'error');
        }

        // Reset form
        setSelectedWoId('');
        setProductName('');
        setWoQty('');
        setPanelQty('');
        setSerialFormat('');
        setStartingNumber('');
        setEndNumber('');
        setBarcodeSource('Generate Barcode');
    };

    const handleDeleteBatch = async (woId: string) => {
        if (!isSuperAdmin) {
            addToast("Access Denied: Only Super Admin can delete.", "error");
            return;
        }
        if (window.confirm(`Are you sure you want to delete all serials for Work Order ${woId}? This action cannot be undone.`)) {
            try {
                const res = await apiFetch(`/api/smt/serial-numbers?work_order_id=${woId}`, {
                    method: 'DELETE'
                });
                if (res.ok) {
                    setBatches(batches.filter(b => b.work_order_id !== woId));
                    if (activeBatch && activeBatch.work_order_id === woId) {
                        setActiveBatch(null);
                    }
                    addToast('Batch deleted successfully.', 'success');
                } else {
                    addToast('Failed to delete batch from database.', 'error');
                }
            } catch (err) {
                console.error("Delete error:", err);
                addToast('Error connecting to backend.', 'error');
            }
        }
    };

    const activeAvailableCount = activeBatch?.components.length || 0;

    const filteredComponents = activeBatch?.components.filter(c => {
        return c.barcode.toLowerCase().includes(barcodeFilter.toLowerCase());
    }) || [];

    const itemsPerPage = 50;
    const totalPages = Math.ceil(filteredComponents.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedComponents = filteredComponents.slice(startIndex, startIndex + itemsPerPage);

    return (
        <>
            <Toaster toasts={toasts} onRemove={removeToast} />
            <div className={styles.container}>
                <div className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2>🔢 Serial Number Scanning</h2>
                        <p>Scan and manage unique PCB serial numbers for SMT production.</p>
                    </div>
                    <button
                        onClick={() => {
                            if (window.confirm("Are you sure you want to logout from SMT?")) {
                                smtLogout();
                            }
                        }}
                        className={styles.secondaryButton}
                        style={{ borderColor: '#ef4444', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <span>🔒</span> Logout SMT
                    </button>
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
                                        {workOrders
                                            .filter(wo => !batches.some(b => b.work_order_id === wo.work_order_id))
                                            .map((wo, i) => (
                                                <option key={i} value={wo.work_order_id}>{wo.work_order_id}</option>
                                            ))
                                        }
                                    </select>
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>Barcode Source *</label>
                                    <select
                                        className={styles.batchSelect}
                                        value={barcodeSource}
                                        onChange={(e) => setBarcodeSource(e.target.value)}
                                    >
                                        <option value="Generate Barcode">Generate Barcode</option>
                                        <option value="Barcode Already Available">Barcode Already Available</option>
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
                                        disabled={barcodeSource === 'Barcode Already Available'}
                                        style={barcodeSource === 'Barcode Already Available' ? { backgroundColor: '#f3f4f6', cursor: 'not-allowed' } : {}}
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
                                        disabled={barcodeSource === 'Barcode Already Available'}
                                        style={barcodeSource === 'Barcode Already Available' ? { backgroundColor: '#f3f4f6', cursor: 'not-allowed' } : {}}
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
                                        disabled={barcodeSource === 'Barcode Already Available'}
                                        style={barcodeSource === 'Barcode Already Available' ? { backgroundColor: '#f3f4f6', cursor: 'not-allowed' } : {}}
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
                                            <th>BARCODE SOURCE</th>
                                            <th>START - END</th>
                                            <th>GENERATED AT</th>
                                            <th>CREATED BY</th>
                                            <th>ACTION</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {batches.map((batch) => {
                                            const isPreExisting = batch.barcode_source === 'PRE_EXISTING' || batch.serial_format === 'PREEXISTING';
                                            const displaySource = isPreExisting ? 'PRE_EXISTING' : 'GENERATED';
                                            return (
                                                <tr key={batch.id}>
                                                    <td style={{ fontWeight: 600 }}>{(batch.product_name || '').toUpperCase()}</td>
                                                    <td>{batch.wo_qty}</td>
                                                    <td>{batch.panel_qty}</td>
                                                    <td style={{ color: '#2563eb', fontWeight: 600 }}>{(batch.work_order_id || '').toUpperCase()}</td>
                                                    <td style={{ fontWeight: 'bold', color: isPreExisting ? '#d97706' : '#2563eb' }}>{displaySource}</td>
                                                    <td>
                                                        {isPreExisting ? (
                                                            "-"
                                                        ) : (
                                                            `${(batch.serial_format || '').toUpperCase()}${batch.starting_number.toString().padStart(6, '0')} to ${(batch.serial_format || '').toUpperCase()}${batch.end_number.toString().padStart(6, '0')}`
                                                        )}
                                                    </td>
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
                                            );
                                        })}
                                        {batches.length === 0 && (
                                            <tr>
                                                <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                                                    No serials generated yet.
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
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        🏭 Serial Number Available: <strong style={{ color: '#2563eb' }}>{activeAvailableCount}</strong>
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
                                    onClick={() => { setActiveBatch(null); }}
                                    style={{ padding: '0.5rem 1rem' }}
                                >
                                    Back to Batches
                                </button>
                            </div>
                        </div>

                        <div className={styles.scanSection}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h3 style={{ margin: 0, padding: 0, border: 'none' }}>
                                    Generated Serial Numbers
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
                                            <th>GENERATED AT</th>
                                            <th>ACTION</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedComponents.map((component) => {
                                            return (
                                                <tr key={component.id} style={{ height: '100px' }}>
                                                    <td style={{ fontWeight: 'bold', fontSize: '1rem', letterSpacing: '1px' }}>
                                                        {(component.barcode || '').toUpperCase()}
                                                    </td>
                                                    <td style={{ textAlign: 'center', padding: '0.5rem' }}>
                                                        <div className={styles.qrItem}>
                                                            <QRCodeReact
                                                                value={(component.barcode || '').replace(/-/g, "").toUpperCase()}
                                                                size={80}
                                                                level="H"
                                                            />
                                                            <p className={styles.serialText}>
                                                                {(component.barcode || '').replace(/-/g, "").toUpperCase()}
                                                            </p>
                                                        </div>
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
                                                <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                                                    No generated items match your search filter.
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
        </>
    );
};

export default SerialNumber;
