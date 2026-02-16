import React, { useState, useRef, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import styles from './Trace.module.css';
import { useToast } from '../../components/Toast';

interface TraceSummary {
    current_stage: string;
    last_status: string;
    operator: string;
    batch_id: number | null;
    last_updated_at: string;
}

interface TimelineItem {
    stage: string;
    order: number;
    status: string;
    operator: string;
    timestamp: string;
    source: string;
    remarks: string;
}

interface TraceData {
    barcode: string;
    summary: TraceSummary;
    timeline: TimelineItem[];
}

export const Trace: React.FC = () => {
    const [barcode, setBarcode] = useState('');
    const [traceData, setTraceData] = useState<TraceData | null>(null);
    const [loading, setLoading] = useState(false);
    const [hasAttempted, setHasAttempted] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);
    const { showToast } = useToast();

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleTrace = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        const trimmedBarcode = barcode.trim();
        if (!trimmedBarcode) {
            showToast('Please enter a barcode', 'error');
            return;
        }

        setLoading(true);
        setHasAttempted(true);
        setTraceData(null); // Clear previous results

        try {
            // Using /api/pretest prefix to match Nginx and other modules
            const data = await apiFetch(`/api/pretest/trace/${encodeURIComponent(trimmedBarcode)}`);
            setTraceData(data);
            showToast('Unit history retrieved', 'success');
        } catch (error: any) {
            console.error('Trace error:', error);
            // Handle 404 or other errors
            if (error.message.includes('404') || error.status === 404) {
                showToast('No history found for this barcode', 'info');
            } else {
                showToast(error.message || 'Failed to retrieve history', 'error');
            }
        } finally {
            setLoading(false);
            inputRef.current?.focus();
        }
    };

    const getStatusClass = (status: string) => {
        switch (status.toLowerCase()) {
            case 'passed': return styles.passed;
            case 'failed': return styles.failed;
            case 'rework': return styles.rework;
            case 'scrap': return styles.scrap;
            default: return '';
        }
    };

    const getStageIcon = (stage: string) => {
        switch (stage) {
            case 'Warehouse': return '🏭';
            case 'Pre-IQC': return '🔍';
            case 'Pre-Impedance': return '⚡';
            case 'Pre-Calibration': return '⚖️';
            case 'Pre-ACLR': return '📡';
            default: return '🔘';
        }
    };

    return (
        <div className={styles.container}>
            {/* Header Area - Matches Pre-ACLR style */}
            <div className={styles.headerRow}>
                <div className={styles.headerContent}>
                    <h2>🕵️‍♂️ TRACE</h2>
                </div>
                <div className={styles.fixedInfoItem}>
                    System: <strong>PRE-TESTING (E2E)</strong>
                </div>
            </div>

            {/* Scan Box - Matches Pre-ACLR style */}
            <div className={styles.card}>
                <form onSubmit={handleTrace} className={styles.scanningSection}>
                    <div className={styles.inputGroup}>
                        <label>Unit Barcode Scan *</label>
                        <div className={styles.barcodeRow}>
                            <input
                                ref={inputRef}
                                type="text"
                                className={styles.barcodeInput}
                                placeholder="Scan or enter barcode..."
                                value={barcode}
                                onChange={(e) => setBarcode(e.target.value)}
                                disabled={loading}
                            />
                            <button
                                type="submit"
                                className={styles.traceBtn}
                                disabled={loading || !barcode.trim()}
                            >
                                {loading ? 'Tracing...' : 'Trace Unit'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>

            {/* Results Display Area */}
            <div className={styles.resultsArea}>
                {loading && (
                    <div className={styles.loadingOverlay}>
                        <div className={styles.spinner}></div>
                    </div>
                )}

                {!loading && traceData && (
                    <>
                        <div className={styles.summaryGrid}>
                            <div className={styles.summaryCard}>
                                <span className={styles.cardTitle}>Barcode</span>
                                <span className={styles.cardValue}>{traceData.barcode}</span>
                            </div>
                            <div className={styles.summaryCard}>
                                <span className={styles.cardTitle}>Current Stage</span>
                                <span className={styles.cardValue}>{traceData.summary.current_stage}</span>
                            </div>
                            <div className={styles.summaryCard}>
                                <span className={styles.cardTitle}>Last Status</span>
                                <div>
                                    <span className={`${styles.statusBadge} ${getStatusClass(traceData.summary.last_status)}`}>
                                        {traceData.summary.last_status}
                                    </span>
                                </div>
                            </div>
                            <div className={styles.summaryCard}>
                                <span className={styles.cardTitle}>Operator</span>
                                <span className={styles.cardValue}>{traceData.summary.operator}</span>
                            </div>
                        </div>

                        <div className={styles.timelineSection}>
                            <div className={styles.timelineContainer}>
                                <div className={styles.timelineLine}></div>
                                {traceData.timeline.map((item, idx) => (
                                    <div key={idx} className={styles.timelineItem}>
                                        <div className={styles.timelineDot}>
                                            {item.status.toLowerCase() === 'passed' ? '✓' : '!'}
                                        </div>
                                        <div className={styles.timelineContent}>
                                            <div className={styles.timelineMain}>
                                                <h4>
                                                    {getStageIcon(item.stage)} {item.stage}
                                                </h4>
                                                <div className={styles.timelineTimestamp}>
                                                    {new Date(item.timestamp).toLocaleString()}
                                                </div>
                                                {item.remarks && item.remarks !== '-' && (
                                                    <div className={styles.remarks}>{item.remarks}</div>
                                                )}
                                            </div>
                                            <div className={styles.timelineRight}>
                                                <span className={`${styles.statusBadge} ${getStatusClass(item.status)}`}>
                                                    {item.status}
                                                </span>
                                                <div className={styles.detailRow}>
                                                    Op: <strong>{item.operator}</strong>
                                                </div>
                                                <div className={styles.detailRow}>
                                                    Sys: <strong>{item.source}</strong>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                {!loading && !traceData && hasAttempted && (
                    <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>❓</div>
                        <h3>No Data Found</h3>
                        <p>No activity has been recorded for barcode "{barcode}" yet.</p>
                    </div>
                )}

                {!loading && !hasAttempted && (
                    <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>🔍</div>
                        <h3>Ready to Trace</h3>
                        <p>Scan a unit to view its journey across the production floor.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
