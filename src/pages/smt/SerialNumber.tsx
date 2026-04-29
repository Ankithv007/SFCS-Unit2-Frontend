import React, { useState, useEffect } from 'react';
import styles from './SerialNumber.module.css';

interface ScannedComponent {
    id: string;
    barcode: string;
    scanned_by: string;
    scanned_at: string;
    product_name: string;
    wo_qty: number;
    panel_qty: number;
    wo_number: string;
    status: 'ACCEPTED' | 'REWORK' | 'SCRAP';
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
    components: ScannedComponent[];
}

export const SerialNumber: React.FC = () => {
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

    const [batches, setBatches] = useState<SmtBatch[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch Work Orders
                const woRes = await fetch('/api/smt/work-orders');
                if (woRes.ok) {
                    const data = await woRes.json();
                    setWorkOrders(data.map((wo: any) => ({
                        ...wo,
                        work_order_id: wo.id // Map DB 'id' to UI 'work_order_id'
                    })));
                }

                // Fetch Serials and group into batches
                const serialRes = await fetch('/api/smt/serial-numbers');
                if (serialRes.ok) {
                    const serialData = await serialRes.json();
                    const grouped = serialData.reduce((acc: any, curr: any) => {
                        const key = `${curr.work_order_id}-${curr.serial_format}`;
                        if (!acc[key]) {
                            acc[key] = {
                                id: curr.id,
                                work_order_id: curr.work_order_id,
                                product_name: "Loading...", // In a real app, join with WO table
                                starting_number: parseInt(curr.serial_number.replace(/\D/g, '')),
                                end_number: parseInt(curr.serial_number.replace(/\D/g, '')),
                                serial_format: curr.serial_format,
                                created_by: "API",
                                created_at: curr.created_at,
                                components: []
                            };
                        }
                        const num = parseInt(curr.serial_number.replace(/\D/g, ''));
                        if (num < acc[key].starting_number) acc[key].starting_number = num;
                        if (num > acc[key].end_number) acc[key].end_number = num;
                        return acc;
                    }, {});
                    setBatches(Object.values(grouped));
                }
            } catch (err) {
                console.error("Failed to fetch data:", err);
            }
        };
        fetchData();
    }, []);

    // Removed local storage effect
    useEffect(() => {
        if (activeBatch) {
            setBatches(prev => prev.map(b => b.id === activeBatch.id ? activeBatch : b));
        }
    }, [activeBatch]);

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
        if (!selectedWoId || !createdBy || !startingNumber || !endNumber || !serialFormat) {
            alert('Please fill out all fields.');
            return;
        }

        if (!/^[A-Za-z]{1,10}$/.test(serialFormat)) {
            alert('Serial Format must be up to 10 alphabet characters only.');
            return;
        }

        const start = parseInt(startingNumber);
        const end = parseInt(endNumber);

        if (isNaN(start) || isNaN(end) || start > end) {
            alert('Please enter a valid numeric range.');
            return;
        }

        if (end - start + 1 > parseInt(woQty)) {
            if (!window.confirm(`You are generating ${end - start + 1} serials, but the Work Order quantity is only ${woQty}. Continue?`)) {
                return;
            }
        }

        const formatStr = serialFormat.toUpperCase();
        const newComponents: ScannedComponent[] = [];
        for (let i = start; i <= end; i++) {
            newComponents.push({
                id: Date.now().toString() + i,
                barcode: `${formatStr}-${i.toString().padStart(6, '0')}`,
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
                    serials: newComponents.map(c => c.barcode)
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



    const handleDeleteBatch = (id: number) => {
        // Mock Super Admin authorization check
        const pwd = window.prompt("Enter Super Admin password to authorize deletion:");
        if (pwd !== "admin123") {
            alert("Unauthorized. Only Super Admins can delete generated serials.");
            return;
        }

        // Ask for confirmation
        if (window.confirm("Are you sure you want to delete this generated batch? This action cannot be undone.")) {
            setBatches(batches.filter(b => b.id !== id));
            if (activeBatch && activeBatch.id === id) {
                setActiveBatch(null);
            }
        }
    };

    const filteredComponents = activeBatch?.components.filter(c =>
        c.barcode.toLowerCase().includes(barcodeFilter.toLowerCase())
    ) || [];

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
                                    onChange={(e) => setSerialFormat(e.target.value.replace(/[^A-Za-z]/g, '').toUpperCase())}
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
                                    placeholder="Your Name"
                                    value={createdBy}
                                    onChange={(e) => setCreatedBy(e.target.value.toUpperCase())}
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
                                    {batches.map((batch) => (
                                        <tr key={batch.id}>
                                            <td style={{ fontWeight: 600 }}>{batch.product_name}</td>
                                            <td>{batch.wo_qty}</td>
                                            <td>{batch.panel_qty}</td>
                                            <td style={{ color: '#2563eb', fontWeight: 600 }}>{batch.work_order_id}</td>
                                            <td>{batch.serial_format ? `${batch.serial_format}-${batch.starting_number.toString().padStart(6, '0')}` : batch.starting_number} to {batch.serial_format ? `${batch.serial_format}-${batch.end_number.toString().padStart(6, '0')}` : batch.end_number}</td>
                                            <td style={{ color: '#6b7280', fontSize: '0.9rem' }}>{new Date(batch.created_at).toLocaleString()}</td>
                                            <td style={{ fontWeight: 500, color: '#374151' }}>{batch.created_by}</td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button
                                                        className={styles.secondaryButton}
                                                        onClick={() => { setActiveBatch(batch); setCurrentPage(1); setBarcodeFilter(''); }}
                                                    >
                                                        View Details
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
                                    {batches.length === 0 && (
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
                </>
            ) : (
                <>
                    <div className={styles.activeBatchHeader}>
                        <div>
                            <h3>Work Order: {activeBatch.work_order_id}</h3>
                            <small>Generated by: {activeBatch.created_by} | {new Date(activeBatch.created_at).toLocaleString()}</small>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', fontSize: '0.95rem', color: '#4b5563', marginTop: '0.5rem' }}>
                                <span>Product: <strong>{activeBatch.product_name}</strong></span>
                                <span>Total Generated: <strong>{activeBatch.components.length}</strong></span>
                            </div>
                        </div>
                        <button
                            className={styles.secondaryButton}
                            onClick={() => setActiveBatch(null)}
                        >
                            Back to Batches
                        </button>
                    </div>

                    <div className={styles.scanSection}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, padding: 0, border: 'none' }}>Serial Number Details</h3>
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
                                        <th>STATUS</th>
                                        <th>GENERATED AT</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedComponents.map((component) => (
                                        <tr key={component.id}>
                                            <td style={{ fontWeight: 'bold', fontSize: '1.1rem', letterSpacing: '2px' }}>
                                                {component.barcode}
                                            </td>
                                            <td>
                                                <span style={{
                                                    padding: '0.25rem 0.75rem',
                                                    borderRadius: '999px',
                                                    fontSize: '0.875rem',
                                                    fontWeight: 'bold',
                                                    backgroundColor: component.status === 'ACCEPTED' ? '#d1fae5'
                                                        : component.status === 'REWORK' ? '#fef3c7'
                                                            : '#fee2e2',
                                                    color: component.status === 'ACCEPTED' ? '#065f46'
                                                        : component.status === 'REWORK' ? '#92400e'
                                                            : '#991b1b'
                                                }}>
                                                    {component.status}
                                                </span>
                                            </td>
                                            <td style={{ color: '#6b7280' }}>
                                                {new Date(component.scanned_at).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredComponents.length === 0 && (
                                        <tr>
                                            <td colSpan={3} style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                                                No serials found matching filter.
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
                                    onClick={() => setCurrentPage((prev: number) => Math.max(prev - 1, 1))}
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
                                    onClick={() => setCurrentPage((prev: number) => Math.min(prev + 1, totalPages))}
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
