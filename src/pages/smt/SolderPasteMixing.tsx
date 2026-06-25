import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useSmtAuth } from '../../context/SmtAuthContext';
import styles from './SolderPasteMixing.module.css';
import { Search, Eye, X, Play, Square } from 'lucide-react';

interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
}

const Toaster: React.FC<{ toasts: Toast[]; onRemove: (id: number) => void }> = ({ toasts, onRemove }) => (
    <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 9999, display: 'flex', flexDirection: 'column-reverse', gap: '0.5rem' }}>
        {toasts.map(t => (
            <div key={t.id} onClick={() => onRemove(t.id)} style={{
                padding: '0.85rem 1.25rem', borderRadius: '0.6rem', cursor: 'pointer', minWidth: '280px',
                background: t.type === 'error' ? '#fee2e2' : t.type === 'success' ? '#dcfce7' : '#fffbeb',
                color: t.type === 'error' ? '#991b1b' : t.type === 'success' ? '#166534' : '#92400e',
                border: `1px solid ${t.type === 'error' ? '#fca5a5' : t.type === 'success' ? '#86efac' : '#fde68a'}`,
                fontWeight: 600, fontSize: '0.9rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                animation: 'slideIn 0.2s ease'
            }}>
                {t.type === 'error' ? '❌ ' : t.type === 'success' ? '✅ ' : 'ℹ️ '}{t.message}
            </div>
        ))}
    </div>
);

// Date formatting helpers matching standard
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatCustomDateTime = (dateString: string | Date | null): string => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '—';
    const day = String(date.getDate()).padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
};

const formatCustomDateOnly = (dateString: string | Date | null): string => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '—';
    const day = String(date.getDate()).padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
};

const formatDuration = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [
        String(hours).padStart(2, '0'),
        String(minutes).padStart(2, '0'),
        String(seconds).padStart(2, '0')
    ].join(':');
};

interface SolderPasteThawingRecord {
    recordId: string;
    uniqueId: string;
    pasteName: string;
    manufacturerName: string;
    manufacturerDate: string;
    pasteExpiryDate: string;
    refrigeratorRemovalDateTime: string;
    removedBy: string;
    approvedByQA: string;
    operatorName: string;
    thawingApprovedByQA: string;
    thawingStartTime: string;
    thawingStartFormatted: string;
    thawingEndTime: string | null;
    thawingEndFormatted: string | null;
    thawingCompletedBy: string | null;
    qaApprovedBy: string | null;
    thawingDurationSeconds: number;
    status: 'PENDING' | 'READY_FOR_MIXING' | 'OVER_LIMIT' | 'DELETED';
    createdAt: string;
}

interface SolderPasteMixingRecord {
    uniqueId: string;
    pasteName: string;
    manufacturerName: string;
    manufacturerDate: string;
    pasteExpiryDate: string;

    // Mixing Stage Start Metadata
    operatorName: string;
    approvedByQA: string;
    mixingStartTime: string; // ISO string
    mixingStartFormatted: string; // DD-MMM-YYYY HH:mm:ss

    // Mixing Stage Completion Metadata
    mixingEndTime: string | null; // ISO string
    mixingEndFormatted: string | null; // DD-MMM-YYYY HH:mm:ss
    mixingCompletedBy: string | null;
    qaApprovedBy: string | null;

    mixingDurationSeconds: number;
    status: 'PENDING' | 'READY_FOR_USE' | 'DELETED';

    // Audit fields
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    updatedBy: string;
}

const SolderPasteMixing: React.FC = () => {
    const { user } = useAuth();
    const { smtUser } = useSmtAuth();
    const currentUser = smtUser?.name || smtUser?.userId || user?.email || 'System Operator';

    // Toasts state
    const [toasts, setToasts] = useState<Toast[]>([]);
    const toastId = useRef(0);
    const addToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        const id = toastId.current++;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    };

    // Core States
    const [thawingRecords, setThawingRecords] = useState<SolderPasteThawingRecord[]>([]);
    const [mixingRecords, setMixingRecords] = useState<SolderPasteMixingRecord[]>([]);
    const [, setTickTrigger] = useState(0);

    // Form inputs state
    const [selectedUniqueId, setSelectedUniqueId] = useState('');
    const [operatorName, setOperatorName] = useState('');
    const [approvedByQA, setApprovedByQA] = useState('');
    const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});

    // Stop Modal State
    const [showStopModal, setShowStopModal] = useState(false);
    const [stopTargetRecord, setStopTargetRecord] = useState<SolderPasteMixingRecord | null>(null);
    const [stopCompletedBy, setStopCompletedBy] = useState('');
    const [stopQAApprovedBy, setStopQAApprovedBy] = useState('');
    const [stopErrors, setStopErrors] = useState<{ [key: string]: string }>({});

    // View Details Modal State
    const [detailRecord, setDetailRecord] = useState<SolderPasteMixingRecord | null>(null);

    // Search and Pagination States
    const [searchPending, setSearchPending] = useState('');
    const [searchCompleted, setSearchCompleted] = useState('');
    const [pagePending, setPagePending] = useState(1);
    const [pageCompleted, setPageCompleted] = useState(1);
    const itemsPerPage = 5;

    // Load initial records
    useEffect(() => {
        const storedThawing = localStorage.getItem('solder_paste_thawing_records_v2');
        if (storedThawing) {
            try {
                setThawingRecords(JSON.parse(storedThawing));
            } catch (err) {
                console.error('Failed to parse thawing records', err);
            }
        }

        const storedMixing = localStorage.getItem('solder_paste_mixing_records_v2');
        if (storedMixing) {
            try {
                setMixingRecords(JSON.parse(storedMixing));
            } catch (err) {
                console.error('Failed to parse mixing records', err);
            }
        }
    }, []);

    // Live clock ticker
    useEffect(() => {
        const interval = setInterval(() => {
            setTickTrigger(prev => prev + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Filter available thawing records that have READY_FOR_MIXING status and are not already mixed
    const availableThawingRecords = useMemo(() => {
        return thawingRecords.filter(th => {
            if (th.status !== 'READY_FOR_MIXING') return false;
            // Check if this record is already used in a non-deleted mixing record
            const alreadyUsed = mixingRecords.some(mx => mx.uniqueId === th.uniqueId && mx.status !== 'DELETED');
            return !alreadyUsed;
        });
    }, [thawingRecords, mixingRecords]);

    // Active record selection metadata
    const selectedThawingRecord = useMemo(() => {
        return thawingRecords.find(t => t.uniqueId === selectedUniqueId) || null;
    }, [selectedUniqueId, thawingRecords]);

    // Helpers to get elapsed duration in seconds
    const getElapsedSeconds = (startTimeIso: string): number => {
        const start = new Date(startTimeIso).getTime();
        const now = new Date().getTime();
        return Math.max(0, Math.floor((now - start) / 1000));
    };

    // Form Submission Actions
    const handleStartMixing = (e: React.FormEvent) => {
        e.preventDefault();
        const errors: { [key: string]: string } = {};

        if (!selectedUniqueId) {
            errors.selectedUniqueId = 'Select a Unique ID to start mixing.';
        }
        if (!operatorName.trim()) {
            errors.operatorName = 'Operator name is required.';
        }
        if (!approvedByQA.trim()) {
            errors.approvedByQA = 'QA Approver is required.';
        }

        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors);
            addToast('Please fill all mandatory fields.', 'error');
            return;
        }

        const thawRecord = selectedThawingRecord;
        if (!thawRecord) {
            addToast('Selected thawing record not found.', 'error');
            return;
        }

        // Duplicate guard validation
        const isDuplicate = mixingRecords.some(mx => mx.uniqueId === thawRecord.uniqueId && mx.status !== 'DELETED');
        if (isDuplicate) {
            addToast('This container is already undergoing or has completed mixing.', 'error');
            return;
        }

        const currentIso = new Date().toISOString();
        const newMixRecord: SolderPasteMixingRecord = {
            uniqueId: thawRecord.uniqueId,
            pasteName: thawRecord.pasteName,
            manufacturerName: thawRecord.manufacturerName,
            manufacturerDate: thawRecord.manufacturerDate,
            pasteExpiryDate: thawRecord.pasteExpiryDate,

            operatorName: operatorName.trim(),
            approvedByQA: approvedByQA.trim(),
            mixingStartTime: currentIso,
            mixingStartFormatted: formatCustomDateTime(currentIso),

            mixingEndTime: null,
            mixingEndFormatted: null,
            mixingCompletedBy: null,
            qaApprovedBy: null,

            mixingDurationSeconds: 0,
            status: 'PENDING',

            createdAt: currentIso,
            updatedAt: currentIso,
            createdBy: currentUser,
            updatedBy: currentUser
        };

        const updatedMixing = [newMixRecord, ...mixingRecords];
        setMixingRecords(updatedMixing);
        localStorage.setItem('solder_paste_mixing_records_v2', JSON.stringify(updatedMixing));

        addToast(`Mixing process started for container ${thawRecord.uniqueId}!`, 'success');

        // Reset fields
        setSelectedUniqueId('');
        setOperatorName('');
        setApprovedByQA('');
        setValidationErrors({});
    };

    const handleClearForm = () => {
        setSelectedUniqueId('');
        setOperatorName('');
        setApprovedByQA('');
        setValidationErrors({});
        addToast('Form fields cleared.', 'info');
    };

    // Stop Mixing click validation
    const handleStopClick = (record: SolderPasteMixingRecord) => {
        const elapsed = getElapsedSeconds(record.mixingStartTime);
        if (elapsed < 60) { // 1 Minute testing rule
            addToast('Minimum mixing duration of 1 minute has not been reached.', 'error');
            return;
        }

        setStopTargetRecord(record);
        setStopCompletedBy('');
        setStopQAApprovedBy('');
        setStopErrors({});
        setShowStopModal(true);
    };

    // Confirm mixing completion modal action
    const handleConfirmStop = () => {
        const errors: { [key: string]: string } = {};
        if (!stopCompletedBy.trim()) {
            errors.stopCompletedBy = 'Operator verification is required.';
        }
        if (!stopQAApprovedBy.trim()) {
            errors.stopQAApprovedBy = 'QA Approval is required.';
        }

        if (Object.keys(errors).length > 0) {
            setStopErrors(errors);
            return;
        }

        if (!stopTargetRecord) return;

        const currentIso = new Date().toISOString();
        const durationSec = getElapsedSeconds(stopTargetRecord.mixingStartTime);

        const updatedMixing = mixingRecords.map(rec => {
            if (rec.uniqueId === stopTargetRecord.uniqueId && rec.status === 'PENDING') {
                return {
                    ...rec,
                    status: 'READY_FOR_USE' as const,
                    mixingEndTime: currentIso,
                    mixingEndFormatted: formatCustomDateTime(currentIso),
                    mixingCompletedBy: stopCompletedBy.trim(),
                    qaApprovedBy: stopQAApprovedBy.trim(),
                    mixingDurationSeconds: durationSec,
                    updatedAt: currentIso,
                    updatedBy: currentUser
                };
            }
            return rec;
        });

        setMixingRecords(updatedMixing);
        localStorage.setItem('solder_paste_mixing_records_v2', JSON.stringify(updatedMixing));
        addToast(`Mixing successfully completed for container ${stopTargetRecord.uniqueId}!`, 'success');

        setShowStopModal(false);
        setStopTargetRecord(null);
    };

    // Categorized records list
    const pendingBatches = useMemo(() => {
        return mixingRecords.filter(rec => rec.status === 'PENDING');
    }, [mixingRecords]);

    const completedBatches = useMemo(() => {
        return mixingRecords.filter(rec => rec.status === 'READY_FOR_USE');
    }, [mixingRecords]);

    // Counters
    const pendingCount = pendingBatches.length;
    const completedCount = completedBatches.length;

    // Filters and pagination mapping
    const filteredPending = useMemo(() => {
        const term = searchPending.toLowerCase().trim();
        if (!term) return pendingBatches;
        return pendingBatches.filter(rec =>
            rec.uniqueId.toLowerCase().includes(term) ||
            rec.pasteName.toLowerCase().includes(term) ||
            rec.manufacturerName.toLowerCase().includes(term) ||
            rec.operatorName.toLowerCase().includes(term)
        );
    }, [pendingBatches, searchPending]);

    const filteredCompleted = useMemo(() => {
        const term = searchCompleted.toLowerCase().trim();
        if (!term) return completedBatches;
        return completedBatches.filter(rec =>
            rec.uniqueId.toLowerCase().includes(term) ||
            rec.pasteName.toLowerCase().includes(term) ||
            rec.manufacturerName.toLowerCase().includes(term) ||
            (rec.mixingCompletedBy && rec.mixingCompletedBy.toLowerCase().includes(term))
        );
    }, [completedBatches, searchCompleted]);

    const paginatedPending = useMemo(() => {
        const start = (pagePending - 1) * itemsPerPage;
        return filteredPending.slice(start, start + itemsPerPage);
    }, [filteredPending, pagePending]);

    const paginatedCompleted = useMemo(() => {
        const start = (pageCompleted - 1) * itemsPerPage;
        return filteredCompleted.slice(start, start + itemsPerPage);
    }, [filteredCompleted, pageCompleted]);

    return (
        <div className={styles.container}>
            {/* Breadcrumbs */}
            <div className={styles.breadcrumbs}>
                <span>SMT</span> &gt; <span>Solder Paste Management</span> &gt; <span className={styles.breadcrumbActive}>Mixing</span>
            </div>

            {/* Header */}
            <div className={styles.header}>
                <h2>Solder Paste Mixing</h2>
                <p>Verify paste parameters, register starting conditions, and complete mechanical mixing validations.</p>
            </div>

            {/* Banner Notice Card */}
            <div className={styles.bannerAlert}>
                <div className={styles.bannerHeader}>
                    <span className={styles.bannerIcon}>⚠️</span>
                    <span className={styles.bannerTitle}>MIXING RULE</span>
                </div>
                <div className={styles.bannerBody}>
                    <div className={styles.bannerItem}>
                        <span className={styles.bannerLabel}>Minimum Required Mixing Duration:</span>
                        <span className={styles.bannerHighlight}>1 Minute</span>
                    </div>
                </div>
            </div>

            {/* Counters Row */}
            <div className={styles.summaryGrid}>
                <div className={styles.summaryCard} style={{ borderLeft: '4px solid #f59e0b' }}>
                    <span className={styles.summaryLabel}>Pending Batches</span>
                    <span className={styles.summaryCount}>{pendingCount}</span>
                </div>
                <div className={styles.summaryCard} style={{ borderLeft: '4px solid #10b981' }}>
                    <span className={styles.summaryLabel}>Completed Batches</span>
                    <span className={styles.summaryCount}>{completedCount}</span>
                </div>
            </div>

            {/* Form */}
            <div className={styles.card}>
                <h3>Start Solder Paste Mixing Run</h3>
                <form onSubmit={handleStartMixing}>
                    <div className={styles.formGrid3}>
                        <div className={styles.inputGroup}>
                            <label htmlFor="selectUniqueId">Select Unique ID *</label>
                            <select
                                id="selectUniqueId"
                                className={`${styles.select} ${validationErrors.selectedUniqueId ? styles.inputError : ''}`}
                                value={selectedUniqueId}
                                onChange={(e) => {
                                    setSelectedUniqueId(e.target.value);
                                    if (validationErrors.selectedUniqueId) {
                                        setValidationErrors(prev => ({ ...prev, selectedUniqueId: '' }));
                                    }
                                }}
                            >
                                <option value="">-- Choose Container --</option>
                                {availableThawingRecords.map(t => (
                                    <option key={t.uniqueId} value={t.uniqueId}>
                                        {t.uniqueId}
                                    </option>
                                ))}
                            </select>
                            {validationErrors.selectedUniqueId && <span className={styles.errorText}>{validationErrors.selectedUniqueId}</span>}
                        </div>

                        <div className={styles.inputGroup}>
                            <label htmlFor="operatorName">Operator Name *</label>
                            <input
                                id="operatorName"
                                type="text"
                                placeholder="Operator Full Name"
                                className={`${styles.input} ${validationErrors.operatorName ? styles.inputError : ''}`}
                                value={operatorName}
                                onChange={(e) => {
                                    setOperatorName(e.target.value);
                                    if (validationErrors.operatorName) {
                                        setValidationErrors(prev => ({ ...prev, operatorName: '' }));
                                    }
                                }}
                            />
                            {validationErrors.operatorName && <span className={styles.errorText}>{validationErrors.operatorName}</span>}
                        </div>

                        <div className={styles.inputGroup}>
                            <label htmlFor="approvedByQA">Approved By QA *</label>
                            <input
                                id="approvedByQA"
                                type="text"
                                placeholder="QA Inspector ID"
                                className={`${styles.input} ${validationErrors.approvedByQA ? styles.inputError : ''}`}
                                value={approvedByQA}
                                onChange={(e) => {
                                    setApprovedByQA(e.target.value);
                                    if (validationErrors.approvedByQA) {
                                        setValidationErrors(prev => ({ ...prev, approvedByQA: '' }));
                                    }
                                }}
                            />
                            {validationErrors.approvedByQA && <span className={styles.errorText}>{validationErrors.approvedByQA}</span>}
                        </div>
                    </div>

                    {/* Preview Selected container */}
                    {selectedThawingRecord && (
                        <div className={styles.previewBox}>
                            <h4 className={styles.previewTitle}>Container Metadata Details</h4>
                            <div className={styles.previewGrid}>
                                <div className={styles.previewItem}>
                                    <span className={styles.previewLabel}>Paste Name</span>
                                    <span className={styles.previewValue}>{selectedThawingRecord.pasteName}</span>
                                </div>
                                <div className={styles.previewItem}>
                                    <span className={styles.previewLabel}>Manufacturer</span>
                                    <span className={styles.previewValue}>{selectedThawingRecord.manufacturerName}</span>
                                </div>
                                <div className={styles.previewItem}>
                                    <span className={styles.previewLabel}>Mfg Date</span>
                                    <span className={styles.previewValue}>{formatCustomDateOnly(selectedThawingRecord.manufacturerDate)}</span>
                                </div>
                                <div className={styles.previewItem}>
                                    <span className={styles.previewLabel}>Expiry Date</span>
                                    <span className={styles.previewValue}>{formatCustomDateOnly(selectedThawingRecord.pasteExpiryDate)}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className={styles.formFooter}>
                        <button type="button" className={`${styles.button} ${styles.btnSecondary}`} onClick={handleClearForm}>
                            Clear Form
                        </button>
                        <button type="submit" className={`${styles.button} ${styles.btnPrimary}`}>
                            <Play size={14} /> Create
                        </button>
                    </div>
                </form>
            </div>

            {/* Pending Table */}
            <div className={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                    <h3 style={{ margin: 0, border: 'none', padding: 0 }}>Pending Batches</h3>
                    <div className={styles.searchBar}>
                        <div style={{ position: 'relative' }}>
                            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input
                                type="text"
                                placeholder="Search Pending..."
                                style={{ paddingLeft: '2.25rem', width: '220px' }}
                                className={styles.input}
                                value={searchPending}
                                onChange={(e) => {
                                    setSearchPending(e.target.value);
                                    setPagePending(1);
                                }}
                            />
                        </div>
                    </div>
                </div>

                <div className={styles.tableContainer}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Unique ID</th>
                                <th>Paste Name</th>
                                <th>Manufacturer Name</th>
                                <th>Mfg Date</th>
                                <th>Expiry Date</th>
                                <th>Mixing Time</th>
                                <th>Operator Name</th>
                                <th>Approved By QA</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedPending.length === 0 ? (
                                <tr>
                                    <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                        No active mixing batches.
                                    </td>
                                </tr>
                            ) : paginatedPending.map(rec => (
                                <tr key={rec.uniqueId}>
                                    <td style={{ fontWeight: 600, color: '#0f172a' }}>{rec.uniqueId}</td>
                                    <td>{rec.pasteName}</td>
                                    <td>{rec.manufacturerName}</td>
                                    <td>{formatCustomDateOnly(rec.manufacturerDate)}</td>
                                    <td>{formatCustomDateOnly(rec.pasteExpiryDate)}</td>
                                    <td style={{ fontWeight: 700, color: '#b45309', fontFamily: 'monospace' }}>
                                        {formatDuration(getElapsedSeconds(rec.mixingStartTime))}
                                    </td>
                                    <td>{rec.operatorName}</td>
                                    <td>{rec.approvedByQA}</td>
                                    <td>
                                        <button className={styles.stopBtn} onClick={() => handleStopClick(rec)} title="Stop mixing">
                                            <Square size={13} style={{ marginRight: '4px' }} /> Stop
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {filteredPending.length > itemsPerPage && (
                    <div className={styles.pagination}>
                        <div className={styles.paginationInfo}>
                            Showing {((pagePending - 1) * itemsPerPage) + 1} to {Math.min(pagePending * itemsPerPage, filteredPending.length)} of {filteredPending.length} records
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                className={styles.paginationBtn}
                                onClick={() => setPagePending(p => Math.max(1, p - 1))}
                                disabled={pagePending === 1}
                            >
                                Previous
                            </button>
                            <button
                                className={styles.paginationBtn}
                                onClick={() => setPagePending(p => p + 1)}
                                disabled={pagePending * itemsPerPage >= filteredPending.length}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Completed Table */}
            <div className={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                    <h3 style={{ margin: 0, border: 'none', padding: 0 }}>Completed Batches</h3>
                    <div className={styles.searchBar}>
                        <div style={{ position: 'relative' }}>
                            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input
                                type="text"
                                placeholder="Search Completed..."
                                style={{ paddingLeft: '2.25rem', width: '220px' }}
                                className={styles.input}
                                value={searchCompleted}
                                onChange={(e) => {
                                    setSearchCompleted(e.target.value);
                                    setPageCompleted(1);
                                }}
                            />
                        </div>
                    </div>
                </div>

                <div className={styles.tableContainer}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Unique ID</th>
                                <th>Paste Name</th>
                                <th>Manufacturer Name</th>
                                <th>Mfg Date</th>
                                <th>Expiry Date</th>
                                <th>Mixing Start Date & Time</th>
                                <th>Mixing Completion Date & Time</th>
                                <th>Total Mixing Duration</th>
                                <th>Approved Operator Name</th>
                                <th>Approved By QA</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedCompleted.length === 0 ? (
                                <tr>
                                    <td colSpan={11} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                        No completed mixing records.
                                    </td>
                                </tr>
                            ) : paginatedCompleted.map(rec => (
                                <tr key={rec.uniqueId}>
                                    <td style={{ fontWeight: 600, color: '#0f172a' }}>{rec.uniqueId}</td>
                                    <td>{rec.pasteName}</td>
                                    <td>{rec.manufacturerName}</td>
                                    <td>{formatCustomDateOnly(rec.manufacturerDate)}</td>
                                    <td>{formatCustomDateOnly(rec.pasteExpiryDate)}</td>
                                    <td>{rec.mixingStartFormatted}</td>
                                    <td>{rec.mixingEndFormatted}</td>
                                    <td style={{ fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
                                        {formatDuration(rec.mixingDurationSeconds)}
                                    </td>
                                    <td>{rec.mixingCompletedBy}</td>
                                    <td>{rec.qaApprovedBy}</td>
                                    <td>
                                        <button className={styles.viewBtn} onClick={() => setDetailRecord(rec)} title="View details">
                                            <Eye size={13} style={{ marginRight: '4px' }} /> View
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {filteredCompleted.length > itemsPerPage && (
                    <div className={styles.pagination}>
                        <div className={styles.paginationInfo}>
                            Showing {((pageCompleted - 1) * itemsPerPage) + 1} to {Math.min(pageCompleted * itemsPerPage, completedBatches.length)} of {completedBatches.length} records
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                className={styles.paginationBtn}
                                onClick={() => setPageCompleted(p => Math.max(1, p - 1))}
                                disabled={pageCompleted === 1}
                            >
                                Previous
                            </button>
                            <button
                                className={styles.paginationBtn}
                                onClick={() => setPageCompleted(p => p + 1)}
                                disabled={pageCompleted * itemsPerPage >= filteredCompleted.length}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Completion Verify Modal */}
            {showStopModal && stopTargetRecord && (
                <div className={styles.modalOverlay} style={{ zIndex: 1010 }}>
                    <div className={styles.modalContent} style={{ maxWidth: '500px' }}>
                        <div className={styles.modalHeader}>
                            <h3>Verify Mixing Completion</h3>
                            <button className={styles.closeModalBtn} onClick={() => setShowStopModal(false)} title="Close">
                                <X size={20} />
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            <p style={{ marginTop: 0, fontSize: '0.9rem', color: '#64748b', lineHeight: '1.5' }}>
                                Enter operator and QA approvals to stop the mixing timer and mark container <strong>{stopTargetRecord.uniqueId}</strong> as ready for SMT Printing.
                            </p>
                            <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.375rem', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
                                <strong>Mixing Start:</strong> {stopTargetRecord.mixingStartFormatted} <br />
                                <strong>Duration:</strong> {formatDuration(getElapsedSeconds(stopTargetRecord.mixingStartTime))}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div className={styles.inputGroup}>
                                    <label htmlFor="stopCompletedBy">Mixing Completed By *</label>
                                    <input
                                        id="stopCompletedBy"
                                        type="text"
                                        placeholder="Operator Username / ID"
                                        className={`${styles.input} ${stopErrors.stopCompletedBy ? styles.inputError : ''}`}
                                        value={stopCompletedBy}
                                        onChange={(e) => {
                                            setStopCompletedBy(e.target.value);
                                            if (stopErrors.stopCompletedBy) {
                                                setStopErrors(prev => ({ ...prev, stopCompletedBy: '' }));
                                            }
                                        }}
                                    />
                                    {stopErrors.stopCompletedBy && <span className={styles.errorText}>{stopErrors.stopCompletedBy}</span>}
                                </div>

                                <div className={styles.inputGroup}>
                                    <label htmlFor="stopQAApprovedBy">QA Approved By *</label>
                                    <input
                                        id="stopQAApprovedBy"
                                        type="text"
                                        placeholder="QA Inspector ID"
                                        className={`${styles.input} ${stopErrors.stopQAApprovedBy ? styles.inputError : ''}`}
                                        value={stopQAApprovedBy}
                                        onChange={(e) => {
                                            setStopQAApprovedBy(e.target.value);
                                            if (stopErrors.stopQAApprovedBy) {
                                                setStopErrors(prev => ({ ...prev, stopQAApprovedBy: '' }));
                                            }
                                        }}
                                    />
                                    {stopErrors.stopQAApprovedBy && <span className={styles.errorText}>{stopErrors.stopQAApprovedBy}</span>}
                                </div>
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <button className={`${styles.button} ${styles.btnSecondary}`} onClick={() => setShowStopModal(false)}>
                                Cancel
                            </button>
                            <button className={`${styles.button} ${styles.btnPrimary}`} onClick={handleConfirmStop}>
                                Complete Mixing
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Read-Only Details Modal */}
            {detailRecord && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalHeader}>
                            <h3>Solder Paste Mixing details — {detailRecord.uniqueId}</h3>
                            <button className={styles.closeModalBtn} onClick={() => setDetailRecord(null)} title="Close">
                                <X size={20} />
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            {/* Section 1: Process Stage & Status */}
                            <div className={styles.detailsSection}>
                                <h4 className={styles.sectionTitle}>Process Stage & Status</h4>
                                <div className={styles.detailsGrid}>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Mixing Status</span>
                                        <span className={styles.detailValue}>
                                            <span className={`${styles.badge} ${detailRecord.status === 'PENDING' ? styles.badgeWarning : styles.badgeSuccess}`}>
                                                {detailRecord.status.replace(/_/g, ' ')}
                                            </span>
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Total Mixing Duration</span>
                                        <span className={styles.detailValue} style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                                            {formatDuration(detailRecord.status === 'PENDING' ? getElapsedSeconds(detailRecord.mixingStartTime) : detailRecord.mixingDurationSeconds)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Material Specifications */}
                            <div className={styles.detailsSection}>
                                <h4 className={styles.sectionTitle}>Material Specifications</h4>
                                <div className={styles.detailsGrid}>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Unique ID</span>
                                        <span className={styles.detailValue}>{detailRecord.uniqueId}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Paste Name</span>
                                        <span className={styles.detailValue}>{detailRecord.pasteName}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Manufacturer Name</span>
                                        <span className={styles.detailValue}>{detailRecord.manufacturerName}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Manufacturer Date</span>
                                        <span className={styles.detailValue}>{formatCustomDateOnly(detailRecord.manufacturerDate)}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Paste Expiry Date</span>
                                        <span className={styles.detailValue}>{formatCustomDateOnly(detailRecord.pasteExpiryDate)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: Mixing Operations & Audit */}
                            <div className={styles.detailsSection}>
                                <h4 className={styles.sectionTitle}>Mixing Operations & Audit</h4>
                                <div className={styles.detailsGrid}>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Operator Name</span>
                                        <span className={styles.detailValue}>{detailRecord.operatorName || '—'}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Approved By QA</span>
                                        <span className={styles.detailValue}>{detailRecord.approvedByQA || '—'}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Mixing Start Date & Time</span>
                                        <span className={styles.detailValue}>{detailRecord.mixingStartFormatted}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Mixing Completion Date & Time</span>
                                        <span className={styles.detailValue}>{detailRecord.mixingEndFormatted || '—'}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Mixing Completed By</span>
                                        <span className={styles.detailValue}>{detailRecord.mixingCompletedBy || '—'}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>QA Approved By</span>
                                        <span className={styles.detailValue}>{detailRecord.qaApprovedBy || '—'}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Created At</span>
                                        <span className={styles.detailValue}>{formatCustomDateTime(detailRecord.createdAt)}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Created By</span>
                                        <span className={styles.detailValue}>{detailRecord.createdBy}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Last Updated At</span>
                                        <span className={styles.detailValue}>{formatCustomDateTime(detailRecord.updatedAt)}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Updated By</span>
                                        <span className={styles.detailValue}>{detailRecord.updatedBy}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <button className={`${styles.button} ${styles.btnSecondary}`} onClick={() => setDetailRecord(null)}>
                                Close Details
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toaster element */}
            <Toaster toasts={toasts} onRemove={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />
        </div>
    );
};

export default SolderPasteMixing;
