import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import styles from './WorkOrderHistory.module.css';
import SMTCountDetailsModal from '../../components/SMTCountDetailsModal';

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
    const [selectedCount, setSelectedCount] = useState<{
        workOrderId: string;
        stage: string;
        type: string;
        label: string;
    } | null>(null);

    // Filters state
    const [areaId, setAreaId] = useState('SMT');
    const [lineId, setLineId] = useState('ALL');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    // Data state
    const [historyData, setHistoryData] = useState<WorkOrderHistoryData[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [qmsMap, setQmsMap] = useState<Record<string, any>>({});

    const fetchQmsRecords = async () => {
        try {
            const res = await fetch('/api/smt/qms/records');
            if (res.ok) {
                const data = await res.json();
                const map: Record<string, any> = {};
                if (Array.isArray(data)) {
                    data.forEach((item: any) => {
                        map[item.work_order_number] = item;
                    });
                }
                setQmsMap(map);
            }
        } catch (err) {
            console.error("Failed to load QMS records for history view", err);
        }
    };

    const renderQmsDocs = (workOrderId: string) => {
        const qms = qmsMap[workOrderId];
        if (!qms || !qms.files_metadata) return <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>None</span>;
        const meta = qms.files_metadata;
        const items = [];
        if (meta.bom) items.push(<a key="bom" href={`/api/smt/qms/files/download/${qms.id}/bom`} title={`BOM: ${meta.bom.originalName}`} style={{ color: '#4f46e5', fontWeight: 'bold', textDecoration: 'underline', marginRight: '6px' }}>BOM</a>);
        if (meta.pfc) items.push(<a key="pfc" href={`/api/smt/qms/files/download/${qms.id}/pfc`} title={`PFC: ${meta.pfc.originalName}`} style={{ color: '#0f766e', fontWeight: 'bold', textDecoration: 'underline', marginRight: '6px' }}>PFC</a>);
        if (meta.xy) items.push(<a key="xy" href={`/api/smt/qms/files/download/${qms.id}/xy`} title={`XY: ${meta.xy.originalName}`} style={{ color: '#b45309', fontWeight: 'bold', textDecoration: 'underline', marginRight: '6px' }}>XY</a>);
        if (meta.ecn) items.push(<a key="ecn" href={`/api/smt/qms/files/download/${qms.id}/ecn`} title={`ECN: ${meta.ecn.originalName}`} style={{ color: '#be185d', fontWeight: 'bold', textDecoration: 'underline', marginRight: '6px' }}>ECN</a>);
        if (meta.drawing) items.push(<a key="drawing" href={`/api/smt/qms/files/download/${qms.id}/drawing`} title={`Drawing: ${meta.drawing.originalName}`} style={{ color: '#4338ca', fontWeight: 'bold', textDecoration: 'underline' }}>DWG</a>);
        return items.length > 0 ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', fontSize: '0.75rem' }}>{items}</div> : <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>None</span>;
    };

    const fetchHistory = async (fDate = fromDate, tDate = toDate, lId = lineId, aId = areaId) => {
        setLoading(true);
        setError('');
        try {
            const queryParams = new URLSearchParams({
                areaId: aId,
                lineId: lId,
                fromDate: fDate,
                toDate: tDate
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

    useEffect(() => {
        let currentAreaId = 'SMT';
        // Auto-fill from location state if available
        if (location.state && location.state.areaId) {
            currentAreaId = location.state.areaId;
            setAreaId(currentAreaId);
        }

        // Timezone-safe local date initialization
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`;

        setFromDate(todayStr);
        setToDate(todayStr);

        // Safely trigger initial auto-fetch
        fetchHistory(todayStr, todayStr, 'ALL', currentAreaId);
        fetchQmsRecords();
    }, [location.state]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        fetchHistory();
    };

    const getDisplayStatus = (status: string, totalQty: number, scannedQty: number) => {
        if (status === 'COMPLETED' || (scannedQty >= totalQty && totalQty > 0)) return 'COMPLETED';
        return 'PENDING';
    };

    const getStatusStyle = (displayStatus: string) => {
        if (displayStatus === 'COMPLETED') return styles.statusCompleted;
        return styles.statusActive;
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
                        <label style={{ visibility: 'hidden' }}>Search</label>
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
                                <th>Scanned Qty</th>
                                <th>Balance Qty</th>
                                <th>Document Process Documents</th>
                                <th>Created By</th>
                                <th>Run Date & Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={11} className={styles.loading}>Loading history data...</td>
                                </tr>
                            ) : historyData.length > 0 ? (
                                historyData.map((row, index) => {
                                    const dispStatus = getDisplayStatus(row.status, row.total_qty, row.completed_qty);
                                    return (
                                        <tr key={index}>
                                            <td>
                                                <span className={`${styles.statusBadge} ${getStatusStyle(dispStatus)}`}>
                                                    {dispStatus}
                                                </span>
                                            </td>
                                            <td style={{ fontWeight: 600 }}>{row.work_order_id}</td>
                                            <td>{row.area_id}</td>
                                            <td>{row.line_id}</td>
                                            <td>{row.product_name}</td>
                                            <td 
                                                className="smt-clickable-count smt-total" 
                                                onClick={() => setSelectedCount({
                                                    workOrderId: row.work_order_id,
                                                    stage: 'Work Order',
                                                    type: 'total',
                                                    label: 'Total Quantity'
                                                })}
                                            >
                                                {row.total_qty}
                                            </td>
                                            <td 
                                                className="smt-clickable-count smt-passed" 
                                                onClick={() => setSelectedCount({
                                                    workOrderId: row.work_order_id,
                                                    stage: 'Work Order',
                                                    type: 'completed',
                                                    label: 'Completed Quantity'
                                                })}
                                                style={{ fontWeight: 'bold' }}
                                            >
                                                {row.completed_qty}
                                            </td>
                                            <td 
                                                className="smt-clickable-count smt-pending" 
                                                onClick={() => setSelectedCount({
                                                    workOrderId: row.work_order_id,
                                                    stage: 'Work Order',
                                                    type: 'pending',
                                                    label: 'Balance Quantity'
                                                })}
                                                style={{ fontWeight: 'bold' }}
                                            >
                                                {row.balance_qty}
                                            </td>
                                            <td>
                                                {renderQmsDocs(row.work_order_id)}
                                            </td>
                                            <td>{row.created_by || 'System'}</td>
                                            <td>
                                                {new Date(row.run_date_time).toLocaleDateString()} <br />
                                                <small style={{ color: '#6b7280' }}>
                                                    {new Date(row.run_date_time).toLocaleTimeString()}
                                                </small>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={11} className={styles.noData}>No work order history found for the selected filters.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {selectedCount && (
                <SMTCountDetailsModal
                    workOrderId={selectedCount.workOrderId}
                    stage={selectedCount.stage}
                    type={selectedCount.type}
                    label={selectedCount.label}
                    onClose={() => setSelectedCount(null)}
                />
            )}
        </div>
    );
};
