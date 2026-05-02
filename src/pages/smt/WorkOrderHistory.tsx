import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import styles from './WorkOrderHistory.module.css';

interface WorkOrderHistoryData {
    work_order_id: string;
    area_id: string;
    line_id: string;
    product_name: string;
    total_qty: number;
    completed_qty: number;
    balance_qty: number;
    status: 'ACTIVE' | 'INACTIVE' | 'COMPLETED';
    created_by: string;
    run_date_time: string;
}

export const WorkOrderHistory: React.FC = () => {
    const location = useLocation();
    
    // Filters state
    const [areaId, setAreaId] = useState('SMT');
    const [lineId, setLineId] = useState('ALL');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    
    // Data state
    const [historyData, setHistoryData] = useState<WorkOrderHistoryData[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        // Auto-fill from location state if available
        if (location.state && location.state.areaId) {
            setAreaId(location.state.areaId);
        }
        
        // Initial fetch
        const today = new Date().toISOString().split('T')[0];
        setFromDate(today);
        setToDate(today);
        
        // fetchHistory(today, today, 'ALL', areaId); // We'll wait for state to settle
    }, [location.state]);

    const fetchHistory = async () => {
        setLoading(true);
        setError('');
        try {
            const queryParams = new URLSearchParams({
                areaId,
                lineId,
                fromDate,
                toDate
            });
            const res = await fetch(`/api/smt/workorder-history?${queryParams.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setHistoryData(data);
            } else {
                const errData = await res.json();
                setError(errData.error || 'Failed to fetch history data');
            }
        } catch (err) {
            console.error("API Error:", err);
            setError('Connection error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        fetchHistory();
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'ACTIVE': return styles.statusActive;
            case 'INACTIVE': return styles.statusInactive;
            case 'COMPLETED': return styles.statusCompleted;
            default: return '';
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2>📊 Work Order History</h2>
                <p>View and track SMT Work Order progress and status.</p>
            </div>

            <div className={styles.card}>
                <h3>Filters</h3>
                <form onSubmit={handleSubmit} className={styles.formGrid}>
                    <div className={styles.inputGroup}>
                        <label>Area ID</label>
                        <input 
                            type="text" 
                            value={areaId} 
                            readOnly 
                            className={styles.input} 
                            style={{ backgroundColor: '#e9ecef', fontWeight: 'bold' }}
                        />
                    </div>
                    <div className={styles.inputGroup}>
                        <label>Line ID</label>
                        <select 
                            value={lineId} 
                            onChange={(e) => setLineId(e.target.value)} 
                            className={styles.select}
                        >
                            <option value="ALL">ALL</option>
                            <option value="SMT-1">SMT-1</option>
                            <option value="SMT-2">SMT-2</option>
                            <option value="SMT-3">SMT-3</option>
                        </select>
                    </div>
                    <div className={styles.inputGroup}>
                        <label>From Date</label>
                        <input 
                            type="date" 
                            value={fromDate} 
                            onChange={(e) => setFromDate(e.target.value)} 
                            className={styles.input}
                        />
                    </div>
                    <div className={styles.inputGroup}>
                        <label>To Date</label>
                        <input 
                            type="date" 
                            value={toDate} 
                            onChange={(e) => setToDate(e.target.value)} 
                            className={styles.input}
                        />
                    </div>
                    <div className={styles.inputGroup} style={{ justifyContent: 'flex-end' }}>
                        <button type="submit" className={styles.button} disabled={loading}>
                            {loading ? 'Searching...' : 'Submit'}
                        </button>
                    </div>
                </form>
            </div>

            <div className={styles.card}>
                <h3>History Details</h3>
                {error && <div className={styles.error}>{error}</div>}
                
                <div className={styles.tableContainer}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>WO Status</th>
                                <th>Work Order ID</th>
                                <th>Area ID</th>
                                <th>Line ID</th>
                                <th>Product Name</th>
                                <th>Total Qty</th>
                                <th>Completed Qty</th>
                                <th>Balance Qty</th>
                                <th>Created By</th>
                                <th>Run Date & Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={10} className={styles.loading}>Loading history data...</td>
                                </tr>
                            ) : historyData.length > 0 ? (
                                historyData.map((row, index) => (
                                    <tr key={index}>
                                        <td>
                                            <span className={`${styles.statusBadge} ${getStatusStyle(row.status)}`}>
                                                {row.status}
                                            </span>
                                        </td>
                                        <td style={{ fontWeight: 600 }}>{row.work_order_id}</td>
                                        <td>{row.area_id}</td>
                                        <td>{row.line_id}</td>
                                        <td>{row.product_name}</td>
                                        <td style={{ fontWeight: 600 }}>{row.total_qty}</td>
                                        <td style={{ color: '#10b981', fontWeight: 600 }}>{row.completed_qty}</td>
                                        <td style={{ color: '#ef4444', fontWeight: 600 }}>{row.balance_qty}</td>
                                        <td>{row.created_by || 'System'}</td>
                                        <td>
                                            {new Date(row.run_date_time).toLocaleDateString()} <br />
                                            <small style={{ color: '#6b7280' }}>
                                                {new Date(row.run_date_time).toLocaleTimeString()}
                                            </small>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={10} className={styles.noData}>No work order history found for the selected filters.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
