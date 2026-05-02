import React, { useState, useEffect } from 'react';
import { useSmtAuth } from '../../context/SmtAuthContext';
import styles from './Printing.module.css';

export const Printing: React.FC = () => {
    const { smtUser, smtLogout } = useSmtAuth();
    const [workOrders, setWorkOrders] = useState<any[]>([]);
    
    // Form state
    const [selectedWoId, setSelectedWoId] = useState('');
    const [stencilName, setStencilName] = useState('');
    const [squeegeeNumber, setSqueegeeNumber] = useState('');
    const [solderPaste, setSolderPaste] = useState('');
    const [side, setSide] = useState('TOP');
    const [savedSetups, setSavedSetups] = useState<any[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch ONLY Registered Work Orders
                const woRes = await fetch('/api/smt/work-orders/registered');
                if (woRes.ok) {
                    const data = await woRes.json();
                    setWorkOrders(data);
                }
            } catch (err) {
                console.error("Fetch error:", err);
            }
        };
        fetchData();
    }, []);
    const getShift = () => {
        const hour = new Date().getHours();
        if (hour >= 23 || hour < 7) return 'C (11PM - 07AM)';
        if (hour >= 15 && hour < 23) return 'B (03PM - 11PM)';
        if (hour >= 8 && hour < 17) return 'G (08AM - 05PM)';
        if (hour >= 6 && hour < 15) return 'A (06AM - 03PM)';
        return 'N/A';
    };

    const handleSaveSetup = () => {
        if (!selectedWoId) {
            alert("Please select a Work Order.");
            return;
        }
        
        const newSetup = {
            id: Date.now(),
            work_order_id: selectedWoId,
            stencil_name: stencilName || '-',
            squeegee_number: squeegeeNumber || '-',
            solder_paste: solderPaste || '-',
            side: side,
            timestamp: new Date().toISOString()
        };
        
        setSavedSetups([newSetup, ...savedSetups]);
        
        // Reset form
        setSelectedWoId('');
        setStencilName('');
        setSqueegeeNumber('');
        setSolderPaste('');
        setSide('TOP');
        
        alert("Printing Setup Saved!");
    };

    const handleViewDetails = (setup: any) => {
        const wo = workOrders.find(w => w.id === setup.work_order_id);
        const details = wo 
            ? `📋 WORK ORDER DETAILS\n--------------------------\nWO NUMBER: ${wo.id}\nPRODUCT: ${wo.product_name}\nWO QTY: ${wo.quantity}\nPANEL QTY: ${wo.panel_quantity}\nCREATED BY: ${wo.created_by}\n\n🛠️ PRINTING SETUP\n--------------------------\nSTENCIL: ${setup.stencil_name}\nSQUEEGEE: ${setup.squeegee_number}\nSOLDER PASTE: ${setup.solder_paste}\nSIDE: ${setup.side}\nTIME: ${new Date(setup.timestamp).toLocaleString()}`
            : `Viewing details for WO: ${setup.work_order_id}\n\nStencil: ${setup.stencil_name}\nSqueegee: ${setup.squeegee_number}\nSolder Paste: ${setup.solder_paste}\nSide: ${setup.side}`;
        
        alert(details);
    };

    return (
        <div className={styles.container}>
            <div className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2>🖨️ Solder Paste Printing</h2>
                    <p>Manage SMT Solder Paste Printing tasks. Logged in as: <strong>{smtUser?.name} ({smtUser?.userId})</strong> | Shift: <strong>{getShift()}</strong></p>
                </div>
                <button 
                    onClick={smtLogout} 
                    className={styles.secondaryButton}
                    style={{ borderColor: '#ef4444', color: '#ef4444' }}
                >
                    Logout SMT
                </button>
            </div>
            

            <div className={styles.card}>
                <h3>Solder Paste Printing Form</h3>
                <div className={styles.formGrid}>
                    <div className={styles.inputGroup}>
                        <label>Select Work Order *</label>
                        <select 
                            className={styles.batchSelect}
                            value={selectedWoId}
                            onChange={(e) => setSelectedWoId(e.target.value)}
                        >
                            <option value="">-- Select Work Order --</option>
                            {workOrders.map((wo: any) => (
                                <option key={wo.id} value={wo.id}>{wo.id}</option>
                            ))}
                        </select>
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
        </div>
    );
};
