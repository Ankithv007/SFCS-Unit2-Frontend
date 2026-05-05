import React, { useState, useEffect } from 'react';
import styles from './PostAoi.module.css';
import { useSmtAuth } from '../../context/SmtAuthContext';
import { BatchDetailView } from '../../components/BatchDetailView';

const PostAoi: React.FC = () => {
    const { smtUser, smtLogout } = useSmtAuth();
    const [workOrders, setWorkOrders] = useState<any[]>([]);

    // View mode state
    const [selectedWoId, setSelectedWoId] = useState<string | null>(null);

    // Form state
    const [formWoId, setFormWoId] = useState('');
    const [productName, setProductName] = useState('');
    const [woQty, setWoQty] = useState('');
    const [panelQty, setPanelQty] = useState('');
    const [createdBy, setCreatedBy] = useState('');
    const [savedEntries, setSavedEntries] = useState<any[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const woRes = await fetch('/api/smt/work-orders/registered');
                if (woRes.ok) {
                    const data = await woRes.json();
                    setWorkOrders(data);
                }

                const setupRes = await fetch('/api/smt/process-setups?process_name=POST_AOI');
                if (setupRes.ok) {
                    const data = await setupRes.json();
                    setSavedEntries(data);
                }

                if (smtUser) {
                    setCreatedBy(smtUser.name || smtUser.userId || 'System');
                }
            } catch (err) {
                console.error("Failed to fetch data:", err);
            }
        };
        fetchData();
    }, [smtUser]);

    const handleSelectWo = (woId: string) => {
        setFormWoId(woId);
        const wo = workOrders.find(w => (w.id === woId || w.work_order_id === woId));
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

    const getShift = () => {
        const hour = new Date().getHours();
        if (hour >= 23 || hour < 7) return 'C (11PM - 07AM)';
        if (hour >= 15 && hour < 23) return 'B (03PM - 11PM)';
        if (hour >= 8 && hour < 17) return 'G (08AM - 05PM)';
        if (hour >= 6 && hour < 15) return 'A (06AM - 03PM)';
        return 'N/A';
    };

    const handleStartProcess = async () => {
        if (!formWoId) {
            alert('Please select a Work Order.');
            return;
        }

        try {
            const res = await fetch('/api/smt/process-setups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    work_order_id: formWoId,
                    process_name: 'POST_AOI',
                    product_name: productName,
                    quantity: parseInt(woQty)
                })
            });

            if (res.ok) {
                const newEntry = await res.json();
                setSavedEntries([newEntry, ...savedEntries]);
                alert(`Starting Post AOI Inspection for WO: ${formWoId}`);
            } else {
                alert("Failed to save Post AOI setup");
            }
        } catch (err) {
            console.error("Error saving setup:", err);
            alert("Connection error while saving setup");
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#1e293b' }}>🤖 Post AOI Inspection</h2>
                    <p style={{ color: '#64748b' }}>Manage SMT Automated Optical Inspection tasks. Logged in as: <strong>{smtUser?.name}</strong> | Shift: <strong>{getShift()}</strong></p>
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

            {selectedWoId ? (
                <BatchDetailView
                    woId={selectedWoId}
                    onBack={() => setSelectedWoId(null)}
                    title="AOI"
                    icon="🤖"
                    filterStep="SPI"
                    filterStatus="PASS"
                    showOnlyCompleted={false}
                    hideTabs={true}
                    enablePassFail={true}
                />
            ) : (
                <>
                    <div className={styles.card}>
                        <h3 style={{ marginBottom: '1.5rem', borderBottom: '2px solid #f1f5f9', paddingBottom: '0.75rem' }}>Post AOI Setup Form</h3>
                        <div className={styles.formGrid}>
                            <div className={styles.inputGroup}>
                                <label>Select Work Order (Registered Only) *</label>
                                <select
                                    className={styles.input}
                                    value={formWoId}
                                    onChange={(e) => handleSelectWo(e.target.value)}
                                >
                                    <option value="">-- Select Work Order --</option>
                                    {workOrders.map((wo) => (
                                        <option key={wo.id || wo.work_order_id} value={wo.id || wo.work_order_id}>
                                            {wo.id || wo.work_order_id} - {wo.product_name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className={styles.inputGroup}>
                                <label>Product Name (Auto-filled)</label>
                                <input
                                    type="text"
                                    className={styles.input}
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
                                    value={panelQty}
                                    disabled
                                    style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold' }}
                                />
                            </div>

                            <div className={styles.inputGroup}>
                                <label>Generated By *</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    value={createdBy}
                                    readOnly
                                    style={{ backgroundColor: '#f3f4f6', color: '#6b7280', fontWeight: 'bold' }}
                                />
                            </div>
                        </div>
                        <div style={{ marginTop: '30px' }}>
                            <button className={styles.button} onClick={handleStartProcess}>
                                Start Post AOI Inspection
                            </button>
                        </div>
                    </div>

                    <div className={styles.card}>
                        <h3>Recent Post AOI Entries</h3>
                        <div className={styles.tableContainer}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>WO NUMBER</th>
                                        <th>PRODUCT NAME</th>
                                        <th>WO QTY</th>
                                        <th>PANEL QTY</th>
                                        <th>TIME</th>
                                        <th>ACTION</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {savedEntries.map((entry) => (
                                        <tr key={entry.id}>
                                            <td style={{ color: '#2563eb', fontWeight: 600 }}>{entry.work_order_id}</td>
                                            <td>{entry.product_name}</td>
                                            <td>{entry.quantity || entry.wo_qty}</td>
                                            <td>{entry.panel_qty || 'N/A'}</td>
                                            <td style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                                                {new Date(entry.timestamp).toLocaleTimeString()}
                                            </td>
                                            <td style={{ display: 'flex', gap: '5px' }}>
                                                <button
                                                    className={styles.secondaryButton}
                                                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                                                    onClick={() => setSelectedWoId(entry.work_order_id)}
                                                >
                                                    View
                                                </button>
                                                <button
                                                    className={styles.secondaryButton}
                                                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', borderColor: '#ef4444', color: '#ef4444' }}
                                                    onClick={async () => {
                                                        if (window.confirm("Are you sure you want to delete this entry?")) {
                                                            const res = await fetch(`/api/smt/process-setups/${entry.id}`, { method: 'DELETE' });
                                                            if (res.ok) setSavedEntries(savedEntries.filter(e => e.id !== entry.id));
                                                        }
                                                    }}
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {savedEntries.length === 0 && (
                                        <tr>
                                            <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                                                No recent entries found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default PostAoi;
