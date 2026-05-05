import React, { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';

interface BatchDetailViewProps {
    woId: string;
    onBack: () => void;
    title: string;
    icon: string;
    showOnlyCompleted?: boolean;
    enablePassFail?: boolean;
    filterStep?: string;
    filterStatus?: string;
    enableFail?: boolean;
    hideTabs?: boolean;
}

export const BatchDetailView: React.FC<BatchDetailViewProps> = ({
    woId,
    onBack,
    title,
    icon,
    showOnlyCompleted = false,
    enablePassFail = false,
    filterStep,
    filterStatus,
    enableFail = true,
    hideTabs = false
}) => {
    const [serials, setSerials] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [scanBarcode, setScanBarcode] = useState('');
    const [scannedBy, setScannedBy] = useState('');
    const [activeTab, setActiveTab] = useState<'PENDING' | 'COMPLETED'>(showOnlyCompleted ? 'COMPLETED' : 'PENDING');
    const [reworkTarget, setReworkTarget] = useState<number | null>(null);
    const [reworkReason, setReworkReason] = useState('');

    useEffect(() => {
        if (woId) {
            fetchSerials();
        }
    }, [woId]);

    const fetchSerials = async () => {
        setLoading(true);
        try {
            let url = `/api/smt/serial-numbers?work_order_id=${woId}`;
            if (filterStep) url += `&filter_step=${filterStep}`;
            if (filterStatus) url += `&filter_status=${filterStatus}`;

            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setSerials(data);
            }
        } catch (err) {
            console.error("Error fetching serials:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleScan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!scanBarcode.trim()) return;

        try {
            const serialObj = serials.find(s => s.serial_number === scanBarcode || s.barcode === scanBarcode);
            if (!serialObj) {
                alert("Serial Number not found in this Work Order!");
                setScanBarcode('');
                return;
            }

            const res = await fetch('/api/smt/inspections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serial_id: serialObj.id,
                    process_step: title,
                    scanned_by: scannedBy || 'System',
                    status: 'PASS'
                })
            });

            if (res.ok) {
                setScanBarcode('');
                fetchSerials();
            } else {
                alert("Failed to save inspection");
            }
        } catch (err) {
            console.error("Scan error:", err);
        }
    };

    const handlePassFail = async (serialId: number, status: 'PASS' | 'FAIL') => {
        if (status === 'FAIL' && !reworkReason && reworkTarget === serialId) {
            alert("Please enter a rework reason.");
            return;
        }

        try {
            const res = await fetch('/api/smt/inspections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serial_id: serialId,
                    process_step: title,
                    scanned_by: scannedBy || 'System',
                    status: status,
                    rework_reason: status === 'FAIL' ? reworkReason : null
                })
            });

            if (res.ok) {
                setReworkTarget(null);
                setReworkReason('');
                fetchSerials();
            } else {
                alert(`Failed to save ${status} status.`);
            }
        } catch (err) {
            console.error("Pass/Fail error:", err);
        }
    };

    // Robust check for boolean completion
    const completedSerials = serials.filter(s => s.is_completed_here === true || s.is_completed_here === 't' || s.is_completed_here === 1);
    const pendingSerials = serials.filter(s => !(s.is_completed_here === true || s.is_completed_here === 't' || s.is_completed_here === 1));

    const displaySerials = hideTabs ? serials : (activeTab === 'PENDING' ? pendingSerials : completedSerials);

    return (
        <div style={{ padding: '1rem' }}>
            <div style={{
                backgroundColor: '#eef2ff',
                border: '1px solid #e0e7ff',
                borderRadius: '12px',
                padding: '1.5rem',
                marginBottom: '2rem'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.4rem', color: '#1e1b4b' }}>{icon} {title} Detail: {woId}</h3>
                        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                                <span>Total Active: <strong>{serials.length}</strong></span>
                                <span style={{ color: '#059669' }}>✅ Scanned Here: <strong>{completedSerials.length}</strong></span>
                                <span style={{ color: '#d97706' }}>🕒 Remaining: <strong>{pendingSerials.length}</strong></span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onBack}
                        style={{
                            backgroundColor: 'white',
                            border: '1px solid #d1d5db',
                            padding: '0.5rem 1.2rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: '600'
                        }}
                    >
                        Back to List
                    </button>
                </div>
            </div>

            <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid #f1f5f9', marginBottom: '2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <form onSubmit={handleScan}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label style={{ fontWeight: 'bold', color: '#475569' }}>Scanned By *</label>
                            <input
                                type="text"
                                style={{
                                    padding: '0.6rem',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '6px',
                                    maxWidth: '300px'
                                }}
                                value={scannedBy}
                                onChange={(e) => setScannedBy(e.target.value)}
                                placeholder="Enter operator name..."
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <input
                                type="text"
                                style={{
                                    padding: '0.6rem',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '6px',
                                    flex: 1
                                }}
                                placeholder="Scan Item Barcode..."
                                value={scanBarcode}
                                onChange={(e) => setScanBarcode(e.target.value)}
                                autoFocus
                            />
                            <button type="submit" style={{
                                backgroundColor: '#4338ca',
                                color: 'white',
                                border: 'none',
                                padding: '0.6rem 1.5rem',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: '600'
                            }}>SCAN</button>
                        </div>
                    </div>
                </form>
            </div>

            <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                {(!showOnlyCompleted && !hideTabs) && (
                    <div style={{ display: 'flex', borderBottom: '1px solid #f1f5f9' }}>
                        <button
                            onClick={() => setActiveTab('PENDING')}
                            style={{
                                flex: 1,
                                padding: '1rem',
                                border: 'none',
                                backgroundColor: activeTab === 'PENDING' ? '#fff' : '#f8fafc',
                                borderBottom: activeTab === 'PENDING' ? '3px solid #4338ca' : 'none',
                                color: activeTab === 'PENDING' ? '#4338ca' : '#64748b',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            Pending ({pendingSerials.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('COMPLETED')}
                            style={{
                                flex: 1,
                                padding: '1rem',
                                border: 'none',
                                backgroundColor: activeTab === 'COMPLETED' ? '#fff' : '#f8fafc',
                                borderBottom: activeTab === 'COMPLETED' ? '3px solid #059669' : 'none',
                                color: activeTab === 'COMPLETED' ? '#059669' : '#64748b',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            Completed ({completedSerials.length})
                        </button>
                    </div>
                )}

                <div style={{ padding: '1rem', overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '2px solid #f1f5f9', color: '#64748b', fontSize: '0.85rem' }}>
                                <th style={{ padding: '1rem' }}>SERIAL NUMBER</th>
                                <th style={{ padding: '1rem' }}>BARCODE</th>
                                <th style={{ padding: '1rem' }}>STATUS</th>
                                {(title === 'Rework' || filterStatus === 'FAIL' || title === 'VI / Touch Up') && <th style={{ padding: '1rem' }}>REWORK REASON</th>}
                                <th style={{ padding: '1rem' }}>TIMESTAMP</th>
                                <th style={{ padding: '1rem' }}>ACTION</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>Loading...</td></tr>
                            ) : displaySerials.map((s, idx) => (
                                <tr key={s.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '1rem', fontWeight: 'bold', color: '#1e293b' }}>{s.serial_number}</td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ padding: '4px', backgroundColor: 'white', display: 'inline-block', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                                            <QRCode value={s.serial_number} size={36} />
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <span style={{
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: '9999px',
                                            fontSize: '0.75rem',
                                            fontWeight: '600',
                                            backgroundColor: s.last_status === 'FAIL' ? '#fee2e2' : (s.last_status === 'PASS' ? '#dcfce7' : (s.status === 'SCANNED' ? '#eef2ff' : '#fef3c7')),
                                            color: s.last_status === 'FAIL' ? '#991b1b' : (s.last_status === 'PASS' ? '#166534' : (s.status === 'SCANNED' ? '#3730a3' : '#92400e')),
                                            border: s.last_status ? '1px solid currentColor' : 'none'
                                        }}>
                                            {s.last_status ? `● ${s.last_status}` : (s.status === 'SCANNED' ? '✓ COMPLETED' : '🕒 PENDING')}
                                        </span>
                                    </td>
                                    {(title === 'Rework' || filterStatus === 'FAIL' || title === 'VI / Touch Up') && (
                                        <td style={{ padding: '1rem', color: '#ef4444', fontWeight: 'bold' }}>
                                            {s.rework_reason || 'N/A'}
                                        </td>
                                    )}
                                    <td style={{ padding: '1rem', fontSize: '0.85rem', color: '#64748b' }}>
                                        {s.status === 'SCANNED' ? new Date(s.updated_at || s.created_at).toLocaleString() : 'N/A'}
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        {enablePassFail ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                                {reworkTarget === s.id ? (
                                                    <div style={{ display: 'flex', gap: '5px' }}>
                                                        <input
                                                            type="text"
                                                            placeholder="Rework Reason..."
                                                            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '0.8rem' }}
                                                            value={reworkReason}
                                                            onChange={(e) => setReworkReason(e.target.value)}
                                                            autoFocus
                                                        />
                                                        <button
                                                            onClick={() => handlePassFail(s.id, 'FAIL')}
                                                            style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer' }}
                                                        >Submit</button>
                                                        <button
                                                            onClick={() => { setReworkTarget(null); setReworkReason(''); }}
                                                            style={{ backgroundColor: '#ccc', color: 'black', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer' }}
                                                        >Cancel</button>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', gap: '5px' }}>
                                                        <button
                                                            onClick={() => handlePassFail(s.id, 'PASS')}
                                                            style={{ backgroundColor: '#22c55e', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                                                        >Pass</button>
                                                        {enableFail && (
                                                            <button
                                                                onClick={() => setReworkTarget(s.id)}
                                                                style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                                                            >Fail</button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <button style={{
                                                backgroundColor: 'transparent',
                                                border: '1px solid #e2e8f0',
                                                padding: '0.4rem 1rem',
                                                fontSize: '0.75rem',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                color: '#475569'
                                            }}>Print</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {displaySerials.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                        {activeTab === 'PENDING' ? 'No pending items!' : 'No completed items yet.'}
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
