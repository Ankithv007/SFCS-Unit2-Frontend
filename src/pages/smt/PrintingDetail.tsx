import React, { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';

interface PrintingDetailProps {
    woId: string;
    onBack: () => void;
    title: string;
}

export const PrintingDetail: React.FC<PrintingDetailProps> = ({ woId, onBack, title }) => {
    const [serials, setSerials] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [scanBarcode, setScanBarcode] = useState('');
    const [scannedBy, setScannedBy] = useState('');

    useEffect(() => {
        if (woId) fetchSerials();
    }, [woId]);

    const fetchSerials = async () => {
        setLoading(true);
        try {
            // Printing specifically looks for units that passed "Serial Number" registration
            const res = await fetch(`/api/smt/serial-numbers?work_order_id=${encodeURIComponent(woId)}&filter_step=Serial Number&filter_status=PASS&current_step=Printing`);
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
        const cleanInput = scanBarcode.trim().replace(/-/g, "");
        if (!cleanInput) return;

        try {
            const serialObj = serials.find(s =>
                (s.serial_number && s.serial_number.replace(/-/g, "") === cleanInput) ||
                (s.barcode && s.barcode.replace(/-/g, "") === cleanInput)
            );

            if (!serialObj) {
                alert(`Serial Number "${scanBarcode}" not found or not ready for printing!`);
                setScanBarcode('');
                return;
            }

            const res = await fetch('/api/smt/inspections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serial_id: serialObj.id,
                    process_step: 'Printing',
                    scanned_by: scannedBy || 'System',
                    status: 'PASS'
                })
            });

            if (res.ok) {
                setScanBarcode('');
                fetchSerials();
            } else {
                alert("Failed to save printing record");
            }
        } catch (err) {
            console.error("Scan error:", err);
        }
    };

    const completedSerials = serials.filter(s =>
        s.is_completed_here === true ||
        s.is_completed_here === 't' ||
        s.is_completed_here === 1 ||
        String(s.is_completed_here).toLowerCase() === 'true'
    );
    const pendingSerials = serials.filter(s => !completedSerials.includes(s));

    return (
        <div style={{ padding: '1rem' }}>
            <div style={{ backgroundColor: '#eef2ff', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ margin: 0 }}>{title || '🖨️ Printing Batch Detail'}: {woId}</h3>
                        <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem' }}>
                            <span>Total: <strong>{serials.length}</strong></span>
                            <span style={{ color: '#059669' }}>Completed: <strong>{completedSerials.length}</strong></span>
                            <span style={{ color: '#d97706' }}>Pending: <strong>{pendingSerials.length}</strong></span>
                        </div>
                    </div>
                    <button onClick={onBack} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>Back</button>
                </div>
            </div>

            <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', border: '1px solid #e2e8f0' }}>
                <form onSubmit={handleScan} style={{ display: 'grid', gap: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <label>Scanned By *</label>
                        <input
                            type="text"
                            value={scannedBy}
                            onChange={e => setScannedBy(e.target.value)}
                            placeholder="Operator name"
                            style={{ padding: '8px', width: '200px' }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <input
                            type="text"
                            value={scanBarcode}
                            onChange={e => setScanBarcode(e.target.value)}
                            placeholder="Scan Barcode..."
                            style={{ padding: '8px', flex: 1 }}
                            autoFocus
                        />
                        <button type="submit" style={{ padding: '8px 20px', background: '#4338ca', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>SCAN</button>
                    </div>
                </form>
            </div>

            <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                            <th style={{ padding: '1rem' }}>SERIAL NUMBER</th>
                            <th style={{ padding: '1rem' }}>BARCODE</th>
                            <th style={{ padding: '1rem' }}>STATUS</th>
                            <th style={{ padding: '1rem' }}>TIMESTAMP</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem' }}>Loading...</td></tr>
                        ) : serials.map((s, idx) => {
                            const isDone = completedSerials.includes(s);
                            return (
                                <tr key={s.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '1rem', fontWeight: 'bold' }}>{s.serial_number}</td>
                                    <td style={{ padding: '1rem' }}>
                                        <QRCode value={s.serial_number} size={32} />
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <span style={{
                                            padding: '4px 12px',
                                            borderRadius: '999px',
                                            fontSize: '0.75rem',
                                            fontWeight: 'bold',
                                            backgroundColor: isDone ? '#dcfce7' : '#fef3c7',
                                            color: isDone ? '#166534' : '#92400e'
                                        }}>
                                            {isDone ? '✓ COMPLETED' : '🕒 PENDING'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1rem', fontSize: '0.85rem', color: '#64748b' }}>
                                        {isDone ? new Date(s.updated_at || s.created_at).toLocaleString() : 'N/A'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
