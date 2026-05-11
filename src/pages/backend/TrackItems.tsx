import React, { useState } from 'react';
import styles from './TrackItems.module.css';
import { Search, CheckCircle2, AlertCircle, XCircle, Clock, Info } from 'lucide-react';
import { apiFetch } from '../../utils/api';

interface TrackRecord {
    station: string;
    status: string;
    scanned_by: string;
    scanned_at: string;
    remarks: string | null;
    resolution_remarks: string | null;
    failed_at: string | null;
    failed_remarks: string | null;
}


const TrackItems: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchType, setSearchType] = useState<'serial' | 'batch'>('serial');
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState<TrackRecord[]>([]);
    const [searchedId, setSearchedId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchTerm.trim()) return;

        setLoading(true);
        setError(null);

        try {
            const data = await apiFetch(`/api/backend/track/${encodeURIComponent(searchTerm)}?type=${searchType}`);
            if (data && data.history) {
                setHistory(data.history);
                setSearchedId(data.id);
            } else {
                setHistory([]);
                setSearchedId(searchTerm);
            }
        } catch (err: any) {
            setError(err.message || "Failed to track item");
            setHistory([]);
        } finally {
            setLoading(false);
        }
    };

    const getIconForStatus = (status: string | undefined) => {
        if (!status) return <Clock size={24} />;
        const s = status.toLowerCase();
        if (s === 'accepted') return <CheckCircle2 size={24} />;
        if (s === 'remark') return <AlertCircle size={24} />;
        if (s === 'debug') return <XCircle size={24} />;
        return <Info size={24} />;
    };

    const getStatusClass = (status: string | undefined) => {
        if (!status) return styles.pending;
        const s = status.toLowerCase();
        if (s === 'accepted') return styles.passed;
        if (s === 'remark') return styles.remark;
        if (s === 'debug') return styles.failed;
        return styles.pending;
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2>Track Items</h2>
                <p>Track the complete lifecycle of Serial Numbers or Work Order Batches</p>
            </div>

            <div className={styles.card}>
                <form onSubmit={handleSearch} className={styles.searchSection}>
                    <div className={styles.searchOptions}>
                        <label className={styles.radioLabel}>
                            <input
                                type="radio"
                                name="searchType"
                                checked={searchType === 'serial'}
                                onChange={() => setSearchType('serial')}
                            />
                            By Serial Number
                        </label>
                        <label className={styles.radioLabel}>
                            <input
                                type="radio"
                                name="searchType"
                                checked={searchType === 'batch'}
                                onChange={() => setSearchType('batch')}
                            />
                            By Batch Number
                        </label>
                    </div>

                    <div className={styles.searchBox}>
                        <Search className={styles.searchIcon} size={20} />
                        <input
                            type="text"
                            placeholder={`Enter ${searchType === 'serial' ? 'Serial Number' : 'Batch Number'}...`}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={styles.searchInput}
                            autoFocus
                        />
                        <button type="submit" className={styles.searchBtn} disabled={!searchTerm.trim() || loading}>
                            {loading ? 'Searching...' : 'Search'}
                        </button>
                    </div>
                    {error && <p style={{ color: '#ef4444', marginTop: '1rem', fontWeight: 600 }}>{error}</p>}
                </form>

                <div className={styles.resultsArea}>
                    {!searchedId && !loading && (
                        <div className={styles.emptyState}>
                            <div className={styles.emptyIcon}>🔍</div>
                            <h3>No Items Tracked Yet</h3>
                            <p>Enter a serial number or batch number above to view its complete manufacturing history.</p>
                        </div>
                    )}

                    {searchedId && history.length === 0 && !loading && (
                        <div className={styles.emptyState}>
                            <div className={styles.emptyIcon}>⚠️</div>
                            <h3>No Records Found</h3>
                            <p>No tracking history found for ID: <strong>{searchedId}</strong></p>
                        </div>
                    )}

                    {searchedId && history.length > 0 && !loading && (
                        <div className={styles.stepperContainer}>
                            <div className={styles.stepperHeader}>
                                <div>
                                    <p style={{ margin: '0 0 0.5rem 0', color: '#64748b', fontSize: '0.875rem', fontWeight: 600 }}>TRACKING RESULTS FOR:</p>
                                    <h3 className={styles.barcodeTitle}>{searchedId}</h3>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <p style={{ margin: '0 0 0.25rem 0', color: '#64748b', fontSize: '0.875rem' }}>Current Status</p>
                                    <span className={`${styles.statusBadge} ${styles[history[history.length - 1].status.toLowerCase()] || ''}`} style={{ fontSize: '1rem', padding: '0.25rem 1rem' }}>
                                        {history[history.length - 1].status}
                                    </span>
                                </div>
                            </div>

                            <div className={styles.stepperScrollArea}>
                                <div className={styles.stepperWrapper}>
                                    {history.map((record, index) => {
                                        const isLastStep = index === history.length - 1;

                                        return (
                                            <div key={`${record.station}-${index}`} className={styles.step}>
                                                {!isLastStep && <div className={styles.stepLine}></div>}
                                                <div className={`${styles.stepIcon} ${getStatusClass(record.status)}`}>
                                                    {getIconForStatus(record.status)}
                                                </div>
                                                <div className={styles.stepContent}>
                                                    <div className={styles.stepStation}>{record.station}</div>

                                                    <div className={styles.stepDetails}>
                                                        <div className={styles.detailRow}>
                                                            <span className={`${styles.statusBadge} ${styles[record.status.toLowerCase()] || ''}`}>
                                                                {record.status}
                                                            </span>
                                                        </div>
                                                        <div className={styles.detailRow}>
                                                            <span className={styles.detailLabel}>By:</span>
                                                            <span>{record.scanned_by}</span>
                                                        </div>
                                                        <div className={styles.detailRow}>
                                                            <span className={styles.detailLabel}>Time:</span>
                                                            <span>{new Date(record.scanned_at).toLocaleString()}</span>
                                                        </div>
                                                        {(record.remarks || record.resolution_remarks || record.failed_remarks) && (
                                                            <div className={styles.detailRow} style={{ marginTop: '0.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem', width: '100%' }}>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem', width: '100%' }}>
                                                                    {record.failed_at && (
                                                                        <span style={{ color: '#64748b' }}>
                                                                            <strong>Remark/Debug Time:</strong> {new Date(record.failed_at).toLocaleString()}
                                                                        </span>
                                                                    )}
                                                                    {record.failed_remarks && (
                                                                        <span>
                                                                            <strong>Original Remark:</strong> {record.failed_remarks}
                                                                        </span>
                                                                    )}
                                                                    {record.resolution_remarks && (
                                                                        <span>
                                                                            <strong>Resolution:</strong> {record.resolution_remarks}
                                                                        </span>
                                                                    )}
                                                                    {record.remarks && (
                                                                        <span>
                                                                            <strong>Station Remark:</strong> {record.remarks}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TrackItems;
