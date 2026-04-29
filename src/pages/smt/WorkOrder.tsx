import React, { useState, useEffect } from 'react';
import styles from './WorkOrder.module.css';

const DescriptionCell: React.FC<{ text: string }> = ({ text }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    if (!text) return <td>-</td>;
    
    const words = text.split(' ');
    const isLong = words.length > 20;
    
    const displayText = isLong && !isExpanded 
        ? words.slice(0, 20).join(' ') + '...' 
        : text;

    return (
        <td style={{ maxWidth: '200px', whiteSpace: 'normal', wordWrap: 'break-word', lineHeight: '1.5' }}>
            {displayText}
            {isLong && (
                <button 
                    onClick={() => setIsExpanded(!isExpanded)}
                    style={{ 
                        background: 'none', 
                        border: 'none', 
                        color: '#2563eb', 
                        cursor: 'pointer', 
                        padding: 0, 
                        marginLeft: '5px',
                        fontSize: '0.85rem',
                        fontWeight: 'bold',
                        textDecoration: 'underline'
                    }}
                >
                    {isExpanded ? 'Read Less' : 'Read More'}
                </button>
            )}
        </td>
    );
};

export const WorkOrder: React.FC = () => {
    const today = new Date();
    const datePrefix = `WO${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}`;

    const [userSequence, setUserSequence] = useState('');
    const [lineId, setLineId] = useState('SMT-1');
    const [productName, setProductName] = useState('');
    const [productDescription, setProductDescription] = useState('');
    const [quantity, setQuantity] = useState('');
    const [panelQuantity, setPanelQuantity] = useState('');
    const [priority, setPriority] = useState('medium');
    const [error, setError] = useState('');

    const [workOrders, setWorkOrders] = useState<any[]>([]);

    useEffect(() => {
        fetchWorkOrders();
    }, []);

    const fetchWorkOrders = async () => {
        try {
            const res = await fetch('/api/smt/work-orders');
            if (res.ok) {
                const data = await res.json();
                setWorkOrders(data.map((wo: any) => ({
                    work_order_id: wo.id,
                    product_name: wo.product_name,
                    product_description: wo.product_description,
                    quantity: wo.quantity,
                    panel_quantity: wo.panel_quantity,
                    line_id: wo.line_id,
                    priority: wo.priority,
                    created_at: wo.created_at
                })));
            }
        } catch (err) {
            console.error("Failed to fetch work orders:", err);
        }
    };

    const handleCreateWorkOrder = async () => {
        // Validation
        if (!/^\d{5}$/.test(userSequence)) {
            setError('Sequence must be exactly 5 digits.');
            return;
        }
        if (!productName || !productDescription || !quantity || !panelQuantity) {
            setError('All fields are required.');
            return;
        }
        if (parseInt(quantity) <= 0 || parseInt(panelQuantity) <= 0) {
            setError('Quantities must be greater than 0.');
            return;
        }
        if (workOrders.some(wo => wo.work_order_id === datePrefix + userSequence)) {
            setError('Work Order ID already exists.');
            return;
        }

        setError('');
        const workOrderId = datePrefix + userSequence;

        const payload = {
            work_order_id: workOrderId,
            area_id: 'SMT',
            line_id: lineId,
            product_name: productName,
            product_description: productDescription,
            quantity: parseInt(quantity),
            panel_quantity: parseInt(panelQuantity),
            priority: priority,
            created_at: new Date().toISOString()
        };

        try {
            const res = await fetch('/api/smt/work-orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const data = await res.json();
                const newWo = {
                    work_order_id: data.id,
                    product_name: data.product_name,
                    product_description: data.product_description,
                    quantity: data.quantity,
                    panel_quantity: data.panel_quantity,
                    line_id: data.line_id,
                    priority: data.priority,
                    created_at: data.created_at
                };
                setWorkOrders([newWo, ...workOrders]);
            } else {
                const errorData = await res.json();
                setError(`Failed to create Work Order: ${errorData.error || 'Unknown error'}`);
            }
        } catch (err) {
            console.error("API error:", err);
            setError('Error connecting to backend API.');
        }

        // Reset form
        setUserSequence('');
        setProductName('');
        setProductDescription('');
        setQuantity('');
        setPanelQuantity('');
        setPriority('medium');
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2>📝 Work Order</h2>
                <p>Manage SMT Work Orders.</p>
            </div>

            <div className={styles.card}>
                <h3>Create New Work Order</h3>

                {error && <div style={{ color: 'var(--error-color)', marginBottom: '1rem', fontWeight: 'bold' }}>{error}</div>}

                <div className={styles.formGrid} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                    <div className={styles.inputGroup}>
                        <label>Work Order ID *</label>
                        <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                            <div style={{
                                backgroundColor: '#e9ecef',
                                border: '1px solid #ced4da',
                                borderRadius: '4px 0 0 4px',
                                padding: '0 10px',
                                color: '#495057',
                                fontWeight: '600',
                                borderRight: 'none',
                                height: '42px',
                                display: 'flex',
                                alignItems: 'center',
                                boxSizing: 'border-box',
                                whiteSpace: 'nowrap'
                            }}>
                                {datePrefix}
                            </div>
                            <input
                                type="text"
                                value={userSequence}
                                onChange={(e) => setUserSequence(e.target.value.replace(/\D/g, ''))}
                                onBlur={(e) => {
                                    if (e.target.value) {
                                        setUserSequence(e.target.value.padStart(5, '0'));
                                    }
                                }}
                                placeholder="00000"
                                maxLength={5}
                                style={{
                                    borderRadius: '0 4px 4px 0',
                                    flex: 1,
                                    minWidth: 0,
                                    height: '42px',
                                    boxSizing: 'border-box',
                                    border: '1px solid #d1d5db',
                                    padding: '0 10px'
                                }}
                            />
                        </div>
                        <span style={{ fontSize: '12px', color: '#6c757d', marginTop: '4px' }}>
                            Enter 5-digit sequence
                        </span>
                    </div>

                    <div className={styles.inputGroup}>
                        <label>Area ID</label>
                        <input
                            type="text"
                            value="SMT"
                            disabled
                            style={{ height: '42px', boxSizing: 'border-box', backgroundColor: '#e9ecef', color: '#6c757d', fontWeight: 'bold' }}
                            className={styles.input}
                        />
                    </div>

                    <div className={styles.inputGroup}>
                        <label>Line ID *</label>
                        <select
                            value={lineId}
                            onChange={(e) => setLineId(e.target.value)}
                            className={styles.select}
                            style={{ height: '42px', boxSizing: 'border-box' }}
                        >
                            <option value="SMT-1">SMT-1</option>
                            <option value="SMT-2">SMT-2</option>
                            <option value="SMT-3">SMT-3</option>
                        </select>
                    </div>

                    <div className={styles.inputGroup}>
                        <label>Priority *</label>
                        <select
                            value={priority}
                            onChange={(e) => setPriority(e.target.value)}
                            className={styles.select}
                            style={{ height: '42px', boxSizing: 'border-box' }}
                        >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                        </select>
                    </div>

                    <div className={styles.inputGroup} style={{ gridColumn: 'span 2' }}>
                        <label>Product Name *</label>
                        <input
                            type="text"
                            value={productName}
                            onChange={(e) => setProductName(e.target.value)}
                            placeholder="e.g. Sensor Board v2"
                            className={styles.input}
                            style={{ boxSizing: 'border-box' }}
                        />
                    </div>

                    <div className={styles.inputGroup} style={{ gridColumn: 'span 2' }}>
                        <label>Product Description *</label>
                        <textarea
                            value={productDescription}
                            onChange={(e) => setProductDescription(e.target.value)}
                            placeholder="Enter product description"
                            className={styles.input}
                            style={{ boxSizing: 'border-box', minHeight: '80px', resize: 'vertical' }}
                        />
                    </div>

                    <div className={styles.inputGroup}>
                        <label>Quantity *</label>
                        <input
                            type="number"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            placeholder="e.g. 1000"
                            min="1"
                            className={styles.input}
                            style={{ boxSizing: 'border-box' }}
                        />
                    </div>

                    <div className={styles.inputGroup}>
                        <label>Panel Quantity *</label>
                        <input
                            type="number"
                            value={panelQuantity}
                            onChange={(e) => setPanelQuantity(e.target.value)}
                            placeholder="e.g. 25"
                            min="1"
                            className={styles.input}
                            style={{ boxSizing: 'border-box' }}
                        />
                    </div>
                </div>

                <div className={styles.actions} style={{ marginTop: '30px' }}>
                    <button className={styles.button} onClick={handleCreateWorkOrder}>
                        Create Work Order
                    </button>
                </div>
            </div>

            <div className={styles.card}>
                <h3>Created Work Orders</h3>
                <div className={styles.tableContainer}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>WORK ORDER ID</th>
                                <th>PRODUCT NAME</th>
                                <th>PRODUCT DESCRIPTION</th>
                                <th>QUANTITY</th>
                                <th>PANEL QTY</th>
                                <th>LINE ID</th>
                                <th>PRIORITY</th>
                                <th>DATE CREATED</th>
                            </tr>
                        </thead>
                        <tbody>
                            {workOrders.map((wo, index) => (
                                <tr key={index}>
                                    <td style={{ fontWeight: 600 }}>{wo.work_order_id}</td>
                                    <td>{wo.product_name}</td>
                                    <DescriptionCell text={wo.product_description} />
                                    <td>{wo.quantity}</td>
                                    <td>{wo.panel_quantity}</td>
                                    <td>{wo.line_id}</td>
                                    <td>
                                        <span style={{
                                            padding: '4px 8px',
                                            borderRadius: '4px',
                                            fontSize: '0.85rem',
                                            fontWeight: 'bold',
                                            backgroundColor: wo.priority === 'high' ? '#fee2e2' : wo.priority === 'medium' ? '#fef3c7' : '#e0e7ff',
                                            color: wo.priority === 'high' ? '#991b1b' : wo.priority === 'medium' ? '#92400e' : '#3730a3'
                                        }}>
                                            {wo.priority.toUpperCase()}
                                        </span>
                                    </td>
                                    <td>{new Date(wo.created_at).toLocaleDateString()}</td>
                                </tr>
                            ))}
                            {workOrders.length === 0 && (
                                <tr>
                                    <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                                        No work orders created yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
