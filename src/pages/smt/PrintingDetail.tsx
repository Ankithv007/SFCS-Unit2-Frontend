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
            // Fetch only those that passed PCB Generation
            const res = await fetch(`/api/smt/serial-numbers?work_order_id=${encodeURIComponent(woId)}&filter_step=PCB Generation&filter_status=PASS&current_step=Printing`);
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

    const handlePass = async (serialId: number) => {
        try {
            const res = await fetch('/api/smt/inspections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serial_id: serialId,
                    process_step: 'Printing',
                    scanned_by: scannedBy || 'System',
                    status: 'PASS'
                })
            });

            if (res.ok) {
                fetchSerials();
            } else {
                alert("Failed to save printing record");
            }
        } catch (err) {
            console.error("Pass error:", err);
        }
    };

    const handleFail = async (serialId: number) => {
        const remark = window.prompt("Please enter mandatory failure remark (e.g. Print mismatch, Smudged print, Barcode unreadable, Alignment issue):");
        if (remark === null) return; // cancelled
        if (!remark.trim()) {
            alert("Error: Failure remark is MANDATORY. Status not updated.");
            return;
        }

        try {
            const res = await fetch('/api/smt/inspections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serial_id: serialId,
                    process_step: 'Printing',
                    scanned_by: scannedBy || 'System',
                    status: 'FAIL',
                    rework_reason: remark.trim()
                })
            });

            if (res.ok) {
                fetchSerials();
            } else {
                alert("Failed to save printing failure record");
            }
        } catch (err) {
            console.error("Fail error:", err);
        }
    };

    const scannedSerials = serials.filter(s => s.step_status !== null && s.step_status !== undefined);

    const processScan = async (barcodeInput: string) => {
        const cleanInput = barcodeInput.trim().replace(/-/g, "");
        if (!cleanInput) return false;

        const serialObj = serials.find(s =>
            (s.serial_number && s.serial_number.replace(/-/g, "") === cleanInput) ||
            (s.barcode && s.barcode.replace(/-/g, "") === cleanInput)
        );

        if (!serialObj) {
            alert(`Serial Number "${barcodeInput}" not found, does not belong to this Work Order, or has not passed PCB Generation stage!`);
            setScanBarcode('');
            return false;
        }

        // Check if already scanned and PASSed in Printing stage to prevent duplicates
        const alreadyScanned = scannedSerials.find(s => s.id === serialObj.id);
        if (alreadyScanned && alreadyScanned.step_status === 'PASS') {
            alert(`Barcode "${barcodeInput}" has already been printed successfully (PASS)!`);
            setScanBarcode('');
            return false;
        }

        // Automatic PASS scan
        await handlePass(serialObj.id);
        setScanBarcode('');
        return true;
    };

    const handleScan = async (e: React.FormEvent) => {
        e.preventDefault();
        await processScan(scanBarcode);
    };

    useEffect(() => {
        const tryAutoScan = async () => {
            const cleanInput = scanBarcode.trim().replace(/-/g, "");
            if (!cleanInput) return;

            const match = serials.find(s =>
                (s.serial_number && s.serial_number.replace(/-/g, "") === cleanInput) ||
                (s.barcode && s.barcode.replace(/-/g, "") === cleanInput)
            );

            // Only trigger auto scan if it has not been successfully processed yet (meaning it's not already PASS in scannedSerials)
            if (match) {
                const alreadyScanned = scannedSerials.find(s => s.id === match.id);
                if (!alreadyScanned || alreadyScanned.step_status !== 'PASS') {
                    await processScan(scanBarcode);
                }
            }
        };

        tryAutoScan();
    }, [scanBarcode, serials]);

    return (
        <div style={{ padding: '1rem' }}>
            <div style={{ backgroundColor: '#eef2ff', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ margin: 0 }}>{title || '🖨️ Printing Batch Detail'}: {woId}</h3>
                        <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem' }}>
                            <span>Total Qty (PCB Passed): <strong style={{ color: '#2563eb' }}>{serials.length}</strong></span>
                            <span style={{ color: '#059669' }}>Scanned Qty: <strong>{scannedSerials.length}</strong></span>
                            <span style={{ color: '#059669' }}>Passed: <strong>{scannedSerials.filter(s => s.step_status === 'PASS').length}</strong></span>
                            <span style={{ color: '#ef4444' }}>Failed: <strong>{scannedSerials.filter(s => s.step_status === 'FAIL').length}</strong></span>
                            <span style={{ color: '#d97706' }}>Pending Qty: <strong>{serials.length - scannedSerials.length}</strong></span>
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
                            placeholder="Scan Item Barcode..."
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
                        <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                            <th style={{ padding: '1rem', textAlign: 'center', fontWeight: 600, color: '#475569', fontSize: '0.75rem', letterSpacing: '0.05em' }}>BARCODE PREVIEW</th>
                            <th style={{ padding: '1rem', fontWeight: 600, color: '#475569', fontSize: '0.75rem', letterSpacing: '0.05em' }}>BARCODE NUMBER</th>
                            <th style={{ padding: '1rem', fontWeight: 600, color: '#475569', fontSize: '0.75rem', letterSpacing: '0.05em' }}>STATUS</th>
                            <th style={{ padding: '1rem', fontWeight: 600, color: '#475569', fontSize: '0.75rem', letterSpacing: '0.05em' }}>REMARK</th>
                            <th style={{ padding: '1rem', fontWeight: 600, color: '#475569', fontSize: '0.75rem', letterSpacing: '0.05em' }}>SCANNED BY</th>
                            <th style={{ padding: '1rem', fontWeight: 600, color: '#475569', fontSize: '0.75rem', letterSpacing: '0.05em' }}>SCANNED AT</th>
                            <th style={{ padding: '1rem', fontWeight: 600, color: '#475569', fontSize: '0.75rem', letterSpacing: '0.05em' }}>ACTION</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>Loading...</td></tr>
                        ) : scannedSerials.map((s, idx) => {
                            const isDone = s.step_status === 'PASS';
                            const isFailed = s.step_status === 'FAIL';
                            const showBarcodeImage = s.barcode_source === 'GENERATED' || !s.barcode_source || (s.barcode_source === 'PRE_EXISTING' && s.serial_number);

                            let badgeBg = '#f3f4f6';
                            let badgeColor = '#4b5563';
                            let badgeText = 'PENDING';

                            if (isDone) {
                                badgeBg = '#dcfce7';
                                badgeColor = '#15803d';
                                badgeText = 'PASS';
                            } else if (isFailed) {
                                badgeBg = '#fee2e2';
                                badgeColor = '#b91c1c';
                                badgeText = 'FAIL';
                            } else {
                                badgeBg = '#fffbeb';
                                badgeColor = '#d97706';
                                badgeText = 'PENDING';
                            }

                            return (
                                <tr 
                                    key={s.id || idx} 
                                    style={{ 
                                        borderBottom: '1px solid #e2e8f0', 
                                        backgroundColor: isDone ? '#f0fdf4' : '#fee2e2',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                        {showBarcodeImage ? (
                                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                                <QRCode value={(s.serial_number || '').toUpperCase()} size={64} />
                                            </div>
                                        ) : (
                                            <span style={{ color: '#9ca3af' }}>-</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '1rem', fontWeight: 700, color: '#1e293b', fontSize: '1rem', letterSpacing: '1px' }}>
                                        {(s.serial_number || '').toUpperCase()}
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <span style={{
                                            padding: '6px 14px',
                                            borderRadius: '999px',
                                            fontSize: '0.75rem',
                                            fontWeight: 'bold',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            backgroundColor: badgeBg,
                                            color: badgeColor
                                        }}>
                                            {badgeText === 'PASS' && '✓ '}
                                            {badgeText === 'FAIL' && '● '}
                                            {badgeText === 'PENDING' && '🕒 '}
                                            {badgeText}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1rem', fontWeight: 500, color: isFailed ? '#b91c1c' : '#64748b' }}>
                                        {isFailed ? (s.step_remark || '-') : '-'}
                                    </td>
                                    <td style={{ padding: '1rem', fontWeight: 600, color: '#475569' }}>
                                        {s.step_scanned_by || 'System'}
                                    </td>
                                    <td style={{ padding: '1rem', fontSize: '0.85rem', color: '#64748b' }}>
                                        {s.step_scanned_at ? new Date(s.step_scanned_at).toLocaleString() : '-'}
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        {isDone ? (
                                            <button
                                                onClick={() => handleFail(s.id)}
                                                style={{ 
                                                    height: '32px', 
                                                    padding: '0 12px', 
                                                    fontSize: '0.8rem', 
                                                    backgroundColor: '#ef4444', 
                                                    color: 'white', 
                                                    border: 'none', 
                                                    borderRadius: '4px', 
                                                    cursor: 'pointer' 
                                                }}
                                                type="button"
                                            >
                                                FAIL
                                            </button>
                                        ) : (
                                            <span style={{ color: '#9ca3af' }}>-</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        {!loading && scannedSerials.length === 0 && (
                            <tr>
                                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                                    No items scanned yet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
