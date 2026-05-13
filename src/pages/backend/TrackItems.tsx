import React, { useState } from 'react';
import { apiFetch } from '../../utils/api';
import { Search, History, CheckCircle, Clock, AlertTriangle, MessageSquare, Package } from 'lucide-react';
import styles from './TrackItems.module.css';

interface ScanHistoryEntry {
    stage: string;
    status: string;
    remarks: string;
    scanned_by: string;
    scanned_at: string;
}

interface ItemDetails {
    barcode: string;
    batch_number: string;
    wo_number: string;
    model: string;
    current_stage: string;
    scan_history: ScanHistoryEntry[];
}

const TrackItems: React.FC = () => {
    const [barcode, setBarcode] = useState('');
    const [loading, setLoading] = useState(false);
    const [item, setItem] = useState<ItemDetails | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!barcode.trim()) return;

        setLoading(true);
        setError(null);
        setItem(null);

        try {
            const data = await apiFetch(`/api/backend/track/${barcode.trim()}`);
            setItem(data);
        } catch (err: any) {
            setError(err.message || 'Item not found or failed to fetch details');
        } finally {
            setLoading(false);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status.toLowerCase()) {
            case 'accepted':
            case 'passed':
                return <CheckCircle className={styles.statusPass} size={18} />;
            case 'rework':
                return <MessageSquare className={styles.statusRework} size={18} />;
            case 'debug':
                return <AlertTriangle className={styles.statusDebug} size={18} />;
            default:
                return <Clock className={styles.statusPending} size={18} />;
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h2>🔍 Item Traceability</h2>
                    <p>Track barcode history across all production stages.</p>
                </div>
            </div>

            <div className={styles.searchCard}>
                <form onSubmit={handleSearch} className={styles.searchForm}>
                    <div className={styles.searchInputWrapper}>
                        <Search className={styles.searchIcon} size={20} />
                        <input
                            type="text"
                            placeholder="Scan or enter Barcode..."
                            value={barcode}
                            onChange={(e) => setBarcode(e.target.value)}
                            className={styles.searchInput}
                            autoFocus
                        />
                    </div>
                    <button type="submit" className={styles.searchBtn} disabled={loading}>
                        {loading ? 'Searching...' : 'TRACK ITEM'}
                    </button>
                </form>
            </div>

            {error && (
                <div className={styles.errorBox}>
                    <AlertTriangle size={20} />
                    <span>{error}</span>
                </div>
            )}

            {item && (
                <div className={styles.resultGrid}>
                    <div className={styles.infoCard}>
                        <h3 className={styles.cardTitle}>
                            <Package size={20} />
                            Item Information
                        </h3>
                        <div className={styles.infoGrid}>
                            <div className={styles.infoItem}>
                                <label>Barcode</label>
                                <span>{item.barcode}</span>
                            </div>
                            <div className={styles.infoItem}>
                                <label>Batch Number</label>
                                <span>{item.batch_number}</span>
                            </div>
                            <div className={styles.infoItem}>
                                <label>WO Number</label>
                                <span>{item.wo_number}</span>
                            </div>
                            <div className={styles.infoItem}>
                                <label>Model</label>
                                <span>{item.model}</span>
                            </div>
                            <div className={styles.infoItem}>
                                <label>Current Location</label>
                                <span className={styles.stageBadge}>{item.current_stage.toUpperCase()}</span>
                            </div>
                        </div>
                    </div>

                    <div className={styles.timelineCard}>
                        <h3 className={styles.cardTitle}>
                            <History size={20} />
                            Production History
                        </h3>
                        <div className={styles.timeline}>
                            {item.scan_history && Array.isArray(item.scan_history) && item.scan_history.length > 0 ? (
                                item.scan_history.map((entry, idx) => (
                                    <div key={idx} className={styles.timelineItem}>
                                        <div className={styles.timelineMarker}>
                                            {getStatusIcon(entry.status)}
                                        </div>
                                        <div className={styles.timelineContent}>
                                            <div className={styles.timelineHeader}>
                                                <span className={styles.timelineStage}>{entry.stage}</span>
                                                <span className={styles.timelineTime}>
                                                    {new Date(entry.scanned_at).toLocaleString()}
                                                </span>
                                            </div>
                                            <div className={styles.timelineStatus}>
                                                Status: <span className={styles[`statusText${entry.status}`]}>{entry.status.toUpperCase()}</span>
                                            </div>
                                            <div className={styles.timelineOperator}>
                                                Operator: <span>{entry.scanned_by}</span>
                                            </div>
                                            {entry.remarks && (
                                                <div className={styles.timelineRemarks}>
                                                    Remarks: <span>{entry.remarks}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className={styles.emptyTimeline}>No history records found for this item.</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TrackItems;
