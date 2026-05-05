import React, { useState, useEffect } from 'react';
import { useSmtAuth } from '../../context/SmtAuthContext';
import styles from './Printing.module.css';
import { BatchDetailView } from '../../components/BatchDetailView';

export const Printing: React.FC = () => {
    const { smtUser, smtLogout } = useSmtAuth();
    const [workOrders, setWorkOrders] = useState<any[]>([]);

    // Form state
    const [selectedWoId, setSelectedWoId] = useState('');
    const [productName, setProductName] = useState('');
    const [woQty, setWoQty] = useState('');
    const [panelQty, setPanelQty] = useState('');
    const [stencilName, setStencilName] = useState('');
    const [squeegeeNumber, setSqueegeeNumber] = useState('');
    const [solderPaste, setSolderPaste] = useState('');
    const [side, setSide] = useState('TOP');
    const [savedSetups, setSavedSetups] = useState<any[]>([]);
    const [viewingWoId, setViewingWoId] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch ONLY Registered Work Orders
                const woRes = await fetch('/api/smt/work-orders/registered');
                if (woRes.ok) {
                    const data = await woRes.json();
                    setWorkOrders(data);
                }

                const setupRes = await fetch('/api/smt/process-setups?process_name=PRINTING');
                if (setupRes.ok) {
                    const data = await setupRes.json();
                    setSavedSetups(data);
                }
            } catch (err) {
                console.error("Fetch error:", err);
            }
        };
        fetchData();
    }, []);
    const handleSelectWo = (woId: string) => {
        setSelectedWoId(woId);
        const wo = workOrders.find(w => w.id === woId);
        if (wo) {
            setProductName(wo.product_name || '');
            setWoQty(wo.quantity || '');
            setPanelQty(wo.panel_quantity || '');
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

    const handleSaveSetup = async () => {
        if (!selectedWoId) {
            alert("Please select a Work Order.");
            return;
        }

        try {
            const res = await fetch('/api/smt/process-setups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    work_order_id: selectedWoId,
                    process_name: 'PRINTING',
                    stencil_name: stencilName,
                    squeegee_number: squeegeeNumber,
                    solder_paste: solderPaste,
                    side: side
                })
            });

            if (res.ok) {
                const newSetup = await res.json();
                setSavedSetups([newSetup, ...savedSetups]);

                // Reset form
                setSelectedWoId('');
                setStencilName('');
                setSqueegeeNumber('');
                setSolderPaste('');
                setSide('TOP');

                alert("Printing Setup Saved to Database!");
            } else {
                alert("Failed to save setup");
            }
        } catch (err) {
            console.error("Error saving setup:", err);
            alert("Connection error");
        }
    };

    const handleViewDetails = (setup: any) => {
        setViewingWoId(setup.work_order_id);
    };

    return (
        <div className={styles.container}>
            <div className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2>🖨️ Solder Paste Printing</h2>
                    <p>Manage SMT Solder Paste Printing tasks. Logged in as: <strong>{smtUser?.name} ({smtUser?.userId})</strong> | Shift: <strong>{getShift()}</strong></p>
                </div>
                <button
                    onClick={() => {
                        if (window.confirm("Are you sure you want to logout from SMT?")) {
                            smtLogout();
                        }
                    }}
                    className={styles.secondaryButton}
                    style={{ borderColor: '#ef4444', color: '#ef4444' }}
                >
                    Logout SMT
                </button>
            </div>


            {viewingWoId ? (
                <BatchDetailView
                    woId={viewingWoId}
                    onBack={() => setViewingWoId(null)}
                    title="Printing"
                    icon="🖨️"
                    filterStep="Serial Number"
                    filterStatus="PASS"
                    hideTabs={true}
                />
            ) : (
                <>
                    <div className={styles.card}>
                        <h3>Solder Paste Printing Form</h3>
                        {/* ... existing form content ... */}
                        <div className={styles.formGrid} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
                            <div className={styles.inputGroup}>
                                <label>Select Work Order *</label>
                                <select
                                    className={styles.batchSelect}
                                    value={selectedWoId}
                                    onChange={(e) => handleSelectWo(e.target.value)}
                                >
                                    <option value="">-- Select Work Order --</option>
                                    {workOrders.map((wo: any) => (
                                        <option key={wo.id} value={wo.id}>{wo.id}</option>
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
                                    type="text"
                                    className={styles.input}
                                    value={woQty}
                                    disabled
                                    style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold' }}
                                />
                            </div>

                            <div className={styles.inputGroup}>
                                <label>Panel Qty (Auto-filled)</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    value={panelQty}
                                    disabled
                                    style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold' }}
                                />
                            </div>

                            <div className={styles.inputGroup}>
                                <label>Stencil Name</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    placeholder="Enter Stencil Name"
                                    value={stencilName}
                                    onChange={(e) => setStencilName(e.target.value)}
                                />
                            </div>

                            <div className={styles.inputGroup}>
                                <label>Squeegee Number</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    placeholder="Enter Squeegee Number"
                                    value={squeegeeNumber}
                                    onChange={(e) => setSqueegeeNumber(e.target.value)}
                                />
                            </div>

                            <div className={styles.inputGroup}>
                                <label>Solder Paste</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    placeholder="Enter Solder Paste Type"
                                    value={solderPaste}
                                    onChange={(e) => setSolderPaste(e.target.value)}
                                />
                            </div>

                            <div className={styles.inputGroup}>
                                <label>Side (Top/Bottom)</label>
                                <select
                                    className={styles.batchSelect}
                                    value={side}
                                    onChange={(e) => setSide(e.target.value)}
                                >
                                    <option value="TOP">TOP</option>
                                    <option value="BOTTOM">BOTTOM</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ marginTop: '2rem' }}>
                            <button
                                className={styles.button}
                                onClick={handleSaveSetup}
                            >
                                Save Printing Setup
                            </button>
                        </div>
                    </div>

                    <div className={styles.card}>
                        <h3>Ready for Printing</h3>
                        <div className={styles.tableContainer}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>WO NUMBER</th>
                                        <th>STENCIL NAME</th>
                                        <th>SQUEEGEE NUMBER</th>
                                        <th>SOLDER PASTE</th>
                                        <th>SIDE</th>
                                        <th>TIME</th>
                                        <th>ACTION</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {savedSetups.map((setup) => (
                                        <tr key={setup.id}>
                                            <td style={{ color: '#2563eb', fontWeight: 600 }}>{setup.work_order_id}</td>
                                            <td>{setup.stencil_name}</td>
                                            <td>{setup.squeegee_number}</td>
                                            <td>{setup.solder_paste}</td>
                                            <td>
                                                <span style={{
                                                    padding: '4px 10px',
                                                    borderRadius: '12px',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 'bold',
                                                    backgroundColor: setup.side === 'TOP' ? '#dcfce7' : '#fef9c3',
                                                    color: setup.side === 'TOP' ? '#166534' : '#854d0e'
                                                }}>
                                                    {setup.side}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                                                {new Date(setup.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button
                                                        className={styles.secondaryButton}
                                                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                                                        onClick={() => handleViewDetails(setup)}
                                                    >
                                                        View
                                                    </button>
                                                    <button
                                                        className={styles.button}
                                                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                                                        onClick={() => alert(`Proceeding to print for WO: ${setup.work_order_id}`)}
                                                    >
                                                        Start Printing
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {savedSetups.length === 0 && (
                                        <tr>
                                            <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                                                No setups saved yet. Fill the form above to start.
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
