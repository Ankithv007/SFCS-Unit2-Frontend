import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useSmtAuth } from '../../context/SmtAuthContext';
import styles from './Thawing.module.css';
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

// Standard date formatting helpers
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

interface SolderPasteRemovalRecord {
    recordId: string;
    uniqueId: string;
    pasteName: string;
    manufacturerName: string;
    manufacturerDate: string;
    pasteExpiryDate: string;
    refrigeratorRemovalDateTime: string;
    removedBy: string;
    approvedByQA: string;
    status: string;
    isDeleted: boolean;
    createdAt: string;
}

interface SolderPasteThawingRecord {
    recordId: string;
    uniqueId: string;
    pasteName: string;
    manufacturerName: string;
    manufacturerDate: string;
    pasteExpiryDate: string;
    refrigeratorRemovalDateTime: string;
    removedBy: string; // operator from removal stage
    approvedByQA: string; // QA from removal stage

    operatorName: string; // thawing stage operator name
    thawingApprovedByQA: string; // thawing stage QA approver

    thawingStartTime: string; // ISO string
    thawingStartFormatted: string; // DD-MMM-YYYY HH:mm:ss
    thawingEndTime: string | null; // ISO string
    thawingEndFormatted: string | null; // DD-MMM-YYYY HH:mm:ss

    thawingCompletedBy: string | null;
    qaApprovedBy: string | null;

    thawingDurationSeconds: number; // elapsed duration
    status: 'PENDING' | 'READY_FOR_MIXING' | 'OVER_LIMIT' | 'DELETED';

    // Audit fields
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    updatedBy: string;
}

const Thawing: React.FC = () => {
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
    const [removalRecords, setRemovalRecords] = useState<SolderPasteRemovalRecord[]>([]);
    const [thawingRecords, setThawingRecords] = useState<SolderPasteThawingRecord[]>([]);
    const [tickTrigger, setTickTrigger] = useState(0);

    // Form inputs state
    const [selectedRemovalId, setSelectedRemovalId] = useState('');
    const [operatorName, setOperatorName] = useState('');
    const [approvedByQA, setApprovedByQA] = useState('');
    const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});

    // Stop Modal State
    const [showStopModal, setShowStopModal] = useState(false);
    const [stopTargetRecord, setStopTargetRecord] = useState<SolderPasteThawingRecord | null>(null);
    const [stopCompletedBy, setStopCompletedBy] = useState('');
    const [stopQAApprovedBy, setStopQAApprovedBy] = useState('');
    const [stopErrors, setStopErrors] = useState<{ [key: string]: string }>({});

    // View Details Modal State
    const [detailRecord, setDetailRecord] = useState<SolderPasteThawingRecord | null>(null);

    // Search and Pagination States
    const [searchPending, setSearchPending] = useState('');
    const [searchCompleted, setSearchCompleted] = useState('');
    const [searchOverLimit, setSearchOverLimit] = useState('');

    const [pagePending, setPagePending] = useState(1);
    const [pageCompleted, setPageCompleted] = useState(1);
    const [pageOverLimit, setPageOverLimit] = useState(1);
    const itemsPerPage = 5;

    // Load records from local storage
    const loadAllRecords = () => {
        // Load removal records
        const removalsSaved = localStorage.getItem('solder_paste_removal_records_v2');
        if (removalsSaved) {
            try {
                setRemovalRecords(JSON.parse(removalsSaved));
            } catch (e) {
                console.error('Failed to parse removal records', e);
            }
        } else {
            setRemovalRecords([]);
        }

        // Load thawing records (No dummy seeding)
        const thawSaved = localStorage.getItem('solder_paste_thawing_records_v2');
        if (thawSaved) {
            try {
                setThawingRecords(JSON.parse(thawSaved));
            } catch (e) {
                console.error('Failed to parse thawing records', e);
            }
        } else {
            setThawingRecords([]);
        }
    };

    useEffect(() => {
        loadAllRecords();
    }, []);

    // Helper to calculate elapsed seconds dynamically
    const getElapsedSeconds = (startTimeIso: string) => {
        const start = new Date(startTimeIso).getTime();
        const now = new Date().getTime();
        return Math.max(0, Math.floor((now - start) / 1000));
    };

    // Live counter tick + Auto OVER_LIMIT check loop
    useEffect(() => {
        const timer = setInterval(() => {
            setTickTrigger(prev => prev + 1);

            setThawingRecords(prevRecords => {
                let changed = false;
                const updated = prevRecords.map(rec => {
                    if (rec.status === 'PENDING') {
                        const elapsed = Math.floor((new Date().getTime() - new Date(rec.thawingStartTime).getTime()) / 1000);
                        if (elapsed >= 43200) { // 12 hours limit reached
                            changed = true;
                            return {
                                ...rec,
                                status: 'OVER_LIMIT' as const,
                                thawingEndTime: new Date().toISOString(),
                                thawingEndFormatted: formatCustomDateTime(new Date()),
                                thawingDurationSeconds: elapsed,
                                updatedAt: new Date().toISOString(),
                                updatedBy: currentUser
                            };
                        }
                    }
                    return rec;
                });

                if (changed) {
                    localStorage.setItem('solder_paste_thawing_records_v2', JSON.stringify(updated));
                    setTimeout(() => {
                        addToast('A thawing record exceeded 12 hours and transitioned to OVER LIMIT.', 'error');
                    }, 0);
                    return updated;
                }
                return prevRecords;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [currentUser]);

    // Relationship filtering: filter removals to show only those not yet thawing (or deleted thawing records)
    const availableRemovalRecords = useMemo(() => {
        return removalRecords.filter(rem => {
            // Must be active and not deleted in removal page
            if (rem.isDeleted || rem.status !== 'ACTIVE') return false;

            // Must not have an active thawing record referencing this recordId
            const isUsed = thawingRecords.some(th => th.recordId === rem.recordId && th.status !== 'DELETED');
            return !isUsed;
        });
    }, [removalRecords, thawingRecords]);

    // Find details of the selected removal record
    const selectedRemovalRecord = useMemo(() => {
        return removalRecords.find(r => r.recordId === selectedRemovalId) || null;
    }, [selectedRemovalId, removalRecords]);

    // Form validation
    const handleStartThawing = (e: React.FormEvent) => {
        e.preventDefault();
        const errors: { [key: string]: string } = {};

        if (!selectedRemovalId) {
            errors.selectedRemovalId = 'Select a Unique ID to start thawing.';
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

        const remRecord = selectedRemovalRecord;
        if (!remRecord) {
            addToast('Selected removal record not found.', 'error');
            return;
        }

        // Duplicate guard validation
        const isDuplicate = thawingRecords.some(tr => tr.recordId === remRecord.recordId && tr.status !== 'DELETED');
        if (isDuplicate) {
            addToast('This container is already undergoing or has completed thawing.', 'error');
            return;
        }

        const currentIso = new Date().toISOString();
        const newThawRecord: Omit<SolderPasteThawingRecord, 'operatorUsernameOrId'> & { [key: string]: any } = {
            recordId: remRecord.recordId,
            uniqueId: remRecord.uniqueId,
            pasteName: remRecord.pasteName,
            manufacturerName: remRecord.manufacturerName,
            manufacturerDate: remRecord.manufacturerDate,
            pasteExpiryDate: remRecord.pasteExpiryDate,
            refrigeratorRemovalDateTime: remRecord.refrigeratorRemovalDateTime,
            removedBy: remRecord.removedBy,
            approvedByQA: remRecord.approvedByQA,

            operatorName: operatorName.trim(),
            thawingApprovedByQA: approvedByQA.trim(),

            thawingStartTime: currentIso,
            thawingStartFormatted: formatCustomDateTime(currentIso),
            thawingEndTime: null,
            thawingEndFormatted: null,

            thawingCompletedBy: null,
            qaApprovedBy: null,

            thawingDurationSeconds: 0,
            status: 'PENDING',

            createdAt: currentIso,
            updatedAt: currentIso,
            createdBy: currentUser,
            updatedBy: currentUser
        };

        const updatedThawing = [newThawRecord as SolderPasteThawingRecord, ...thawingRecords];
        setThawingRecords(updatedThawing);
        localStorage.setItem('solder_paste_thawing_records_v2', JSON.stringify(updatedThawing));

        addToast(`Thawing process started for container ${remRecord.uniqueId}!`, 'success');

        // Reset state inputs
        setSelectedRemovalId('');
        setOperatorName('');
        setApprovedByQA('');
        setValidationErrors({});
    };

    const handleClearForm = () => {
        setSelectedRemovalId('');
        setOperatorName('');
        setApprovedByQA('');
        setValidationErrors({});
        addToast('Form fields cleared.', 'info');
    };

    // Stop Thawing Click Action
    const handleStopClick = (record: SolderPasteThawingRecord) => {
        const elapsed = getElapsedSeconds(record.thawingStartTime);
        if (elapsed < 60) { // 1 Minute = 60 seconds (Temporary Testing Configuration)
            addToast('Minimum thawing duration of 1 minute has not been reached.', 'error');
            return;
        }

        setStopTargetRecord(record);
        setStopCompletedBy('');
        setStopQAApprovedBy('');
        setStopErrors({});
        setShowStopModal(true);
    };

    // Confirm Stop Completion Modal Action
    const handleConfirmStop = () => {
        if (!stopTargetRecord) return;

        const errors: { [key: string]: string } = {};
        if (!stopCompletedBy.trim()) {
            errors.stopCompletedBy = 'Completing operator is required.';
        }
        if (!stopQAApprovedBy.trim()) {
            errors.stopQAApprovedBy = 'QA approver name is required.';
        }

        if (Object.keys(errors).length > 0) {
            setStopErrors(errors);
            return;
        }

        const elapsed = getElapsedSeconds(stopTargetRecord.thawingStartTime);
        const currentIso = new Date().toISOString();

        // Update the state
        const updated = thawingRecords.map(rec => {
            if (rec.recordId === stopTargetRecord.recordId) {
                return {
                    ...rec,
                    status: 'READY_FOR_MIXING' as const,
                    thawingEndTime: currentIso,
                    thawingEndFormatted: formatCustomDateTime(currentIso),
                    thawingDurationSeconds: elapsed,
                    thawingCompletedBy: stopCompletedBy.trim(),
                    qaApprovedBy: stopQAApprovedBy.trim(),
                    updatedAt: currentIso,
                    updatedBy: currentUser
                };
            }
            return rec;
        });

        setThawingRecords(updated);
        localStorage.setItem('solder_paste_thawing_records_v2', JSON.stringify(updated));

        addToast(`Thawing successfully completed for container ${stopTargetRecord.uniqueId}. Status set to READY FOR MIXING.`, 'success');

        setShowStopModal(false);
        setStopTargetRecord(null);
    };

    // Search matches filter
    const matchSearch = (rec: SolderPasteThawingRecord, q: string): boolean => {
        const term = q.toLowerCase().trim();
        if (!term) return true;
        return (
            rec.recordId.toLowerCase().includes(term) ||
            rec.uniqueId.toLowerCase().includes(term) ||
            rec.pasteName.toLowerCase().includes(term) ||
            rec.manufacturerName.toLowerCase().includes(term)
        );
    };

    // Segmented Datasets
    const pendingBatches = useMemo(() => {
        return thawingRecords.filter(r => r.status === 'PENDING' && matchSearch(r, searchPending));
    }, [thawingRecords, searchPending]);

    const completedBatches = useMemo(() => {
        return thawingRecords.filter(r => r.status === 'READY_FOR_MIXING' && matchSearch(r, searchCompleted));
    }, [thawingRecords, searchCompleted]);

    const overLimitBatches = useMemo(() => {
        return thawingRecords.filter(r => r.status === 'OVER_LIMIT' && matchSearch(r, searchOverLimit));
    }, [thawingRecords, searchOverLimit]);

    // Counts for Summary Cards (No dummy records counted, direct state evaluation)
    const pendingCount = useMemo(() => thawingRecords.filter(r => r.status === 'PENDING').length, [thawingRecords]);
    const completedCount = useMemo(() => thawingRecords.filter(r => r.status === 'READY_FOR_MIXING').length, [thawingRecords]);
    const overLimitCount = useMemo(() => thawingRecords.filter(r => r.status === 'OVER_LIMIT').length, [thawingRecords]);

    // Pagination calculations
    const paginatedPending = useMemo(() => {
        const start = (pagePending - 1) * itemsPerPage;
        return pendingBatches.slice(start, start + itemsPerPage);
    }, [pendingBatches, pagePending]);

    const paginatedCompleted = useMemo(() => {
        const start = (pageCompleted - 1) * itemsPerPage;
        return completedBatches.slice(start, start + itemsPerPage);
    }, [completedBatches, pageCompleted]);

    const paginatedOverLimit = useMemo(() => {
        const start = (pageOverLimit - 1) * itemsPerPage;
        return overLimitBatches.slice(start, start + itemsPerPage);
    }, [overLimitBatches, pageOverLimit]);

    const totalPagesPending = Math.ceil(pendingBatches.length / itemsPerPage) || 1;
    const totalPagesCompleted = Math.ceil(completedBatches.length / itemsPerPage) || 1;
    const totalPagesOverLimit = Math.ceil(overLimitBatches.length / itemsPerPage) || 1;

    return (
        <div className={styles.container}>
            <Toaster toasts={toasts} onRemove={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />

            {/* Breadcrumbs */}
            <div className={styles.breadcrumbs}>
                <span>SMT</span>
                <span>&gt;</span>
                <span>Solder Paste Management</span>
                <span>&gt;</span>
                <strong className={styles.breadcrumbActive}>Thawing</strong>
            </div>

            {/* Header */}
            <div className={styles.header}>
                <h2>Thawing Stage Management</h2>
                <div className={styles.bannerAlert}>
                    <div className={styles.bannerHeader}>
                        <span className={styles.bannerIcon}>⚠️</span>
                        <strong className={styles.bannerTitle}>THAWING CONDITION</strong>
                    </div>
                    <div className={styles.bannerBody}>
                        <div className={styles.bannerItem}>
                            <span className={styles.bannerLabel}>Minimum Thawing Time:</span>
                            <strong className={styles.bannerHighlight}>4 – 8 Hours</strong>
                        </div>
                        <div className={styles.bannerDivider}></div>
                        <div className={styles.bannerItem}>
                            <span className={styles.bannerLabel}>Maximum Working Time:</span>
                            <strong className={styles.bannerHighlight}>12 Hours</strong>
                        </div>
                    </div>
                </div>
            </div>

            {/* Summary Cards Row */}
            <div className={styles.summaryGrid}>
                <div className={styles.summaryCard} style={{ borderLeft: '4px solid #f59e0b' }}>
                    <span className={styles.summaryLabel}>Pending Batches</span>
                    <span className={styles.summaryCount}>{pendingCount}</span>
                </div>
                <div className={styles.summaryCard} style={{ borderLeft: '4px solid #10b981' }}>
                    <span className={styles.summaryLabel}>Completed Batches</span>
                    <span className={styles.summaryCount}>{completedCount}</span>
                </div>
                <div className={styles.summaryCard} style={{ borderLeft: '4px solid #ef4444' }}>
                    <span className={styles.summaryLabel}>Over Limit Batches</span>
                    <span className={styles.summaryCount}>{overLimitCount}</span>
                </div>
            </div>

            {/* Entry Form */}
            <div className={styles.card}>
                <h3>Start Solder Paste Thawing Run</h3>
                <form onSubmit={handleStartThawing}>
                    <div className={styles.formGrid3}>
                        <div className={styles.inputGroup}>
                            <label htmlFor="selectUniqueId">Select Unique ID (From Fridge Removal) *</label>
                            <select
                                id="selectUniqueId"
                                className={`${styles.select} ${validationErrors.selectedRemovalId ? styles.inputError : ''}`}
                                value={selectedRemovalId}
                                onChange={(e) => {
                                    setSelectedRemovalId(e.target.value);
                                    if (validationErrors.selectedRemovalId) {
                                        setValidationErrors(prev => ({ ...prev, selectedRemovalId: '' }));
                                    }
                                }}
                            >
                                <option value="">-- Choose Container --</option>
                                {availableRemovalRecords.map(rem => (
                                    <option key={rem.recordId} value={rem.recordId}>
                                        {rem.uniqueId}
                                    </option>
                                ))}
                            </select>
                            {validationErrors.selectedRemovalId && <span className={styles.errorText}>{validationErrors.selectedRemovalId}</span>}
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

                    {/* Preview Box for selected container details */}
                    {selectedRemovalRecord && (
                        <div className={styles.previewBox}>
                            <h4 className={styles.previewTitle}>Container Removal Metadata</h4>
                            <div className={styles.previewGrid}>
                                <div className={styles.previewItem}>
                                    <span className={styles.previewLabel}>Unique ID</span>
                                    <span className={styles.previewValue}>{selectedRemovalRecord.uniqueId}</span>
                                </div>
                                <div className={styles.previewItem}>
                                    <span className={styles.previewLabel}>Paste Name</span>
                                    <span className={styles.previewValue}>{selectedRemovalRecord.pasteName}</span>
                                </div>
                                <div className={styles.previewItem}>
                                    <span className={styles.previewLabel}>Manufacturer</span>
                                    <span className={styles.previewValue}>{selectedRemovalRecord.manufacturerName}</span>
                                </div>
                                <div className={styles.previewItem}>
                                    <span className={styles.previewLabel}>Mfg Date</span>
                                    <span className={styles.previewValue}>{formatCustomDateOnly(selectedRemovalRecord.manufacturerDate)}</span>
                                </div>
                                <div className={styles.previewItem}>
                                    <span className={styles.previewLabel}>Expiry Date</span>
                                    <span className={styles.previewValue}>{formatCustomDateOnly(selectedRemovalRecord.pasteExpiryDate)}</span>
                                </div>
                                <div className={styles.previewItem}>
                                    <span className={styles.previewLabel}>Removed By</span>
                                    <span className={styles.previewValue}>{selectedRemovalRecord.removedBy}</span>
                                </div>
                                <div className={styles.previewItem}>
                                    <span className={styles.previewLabel}>Removal QA</span>
                                    <span className={styles.previewValue}>{selectedRemovalRecord.approvedByQA}</span>
                                </div>
                                <div className={styles.previewItem}>
                                    <span className={styles.previewLabel}>Removal Date & Time</span>
                                    <span className={styles.previewValue}>{formatCustomDateTime(selectedRemovalRecord.refrigeratorRemovalDateTime)}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className={styles.formFooter}>
                        <button type="button" className={`${styles.button} ${styles.btnSecondary}`} onClick={handleClearForm}>
                            Clear Form
                        </button>
                        <button type="submit" className={`${styles.button} ${styles.btnPrimary}`}>
                            <Play size={14} /> Start Thawing
                        </button>
                    </div>
                </form>
            </div>

            {/* Pending Batches Section */}
            <div className={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <h3 style={{ margin: 0, border: 'none', padding: 0 }}>Pending Batches</h3>
                    <div className={styles.searchBar}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <Search size={16} style={{ position: 'absolute', left: '0.75rem', color: '#94a3b8' }} />
                            <input
                                className={styles.input}
                                style={{ paddingLeft: '2.5rem', width: '260px' }}
                                type="text"
                                placeholder="Search Pending..."
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
                                <th>Thawing Time</th>
                                <th>Operator Name</th>
                                <th>Approved By QA</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedPending.length === 0 ? (
                                <tr>
                                    <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                        No pending thawing batches active.
                                    </td>
                                </tr>
                            ) : paginatedPending.map(rec => {
                                const elapsed = getElapsedSeconds(rec.thawingStartTime);
                                return (
                                    <tr key={rec.recordId}>
                                        <td style={{ fontWeight: 600, color: '#0f172a' }}>{rec.uniqueId}</td>
                                        <td>{rec.pasteName}</td>
                                        <td>{rec.manufacturerName}</td>
                                        <td>{formatCustomDateOnly(rec.manufacturerDate)}</td>
                                        <td>{formatCustomDateOnly(rec.pasteExpiryDate)}</td>
                                        <td style={{ fontWeight: 700, color: '#d97706', fontFamily: 'monospace', fontSize: '0.95rem' }}>
                                            {formatDuration(elapsed)}
                                        </td>
                                        <td>{rec.operatorName || rec.removedBy || '—'}</td>
                                        <td>{rec.thawingApprovedByQA || rec.approvedByQA || '—'}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.35rem' }}>
                                                <button className={styles.viewBtn} onClick={() => setDetailRecord(rec)} title="View Details">
                                                    <Eye size={13} style={{ marginRight: '4px' }} /> View
                                                </button>
                                                <button className={styles.stopBtn} onClick={() => handleStopClick(rec)} title="Stop Timer & Complete Hold">
                                                    <Square size={12} style={{ marginRight: '4px' }} /> Stop
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Pending Pagination */}
                {pendingBatches.length > itemsPerPage && (
                    <div className={styles.pagination}>
                        <div className={styles.paginationInfo}>
                            Showing {((pagePending - 1) * itemsPerPage) + 1} to {Math.min(pagePending * itemsPerPage, pendingBatches.length)} of {pendingBatches.length} records
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                className={styles.paginationBtn}
                                onClick={() => setPagePending(prev => Math.max(1, prev - 1))}
                                disabled={pagePending === 1}
                            >
                                Previous
                            </button>
                            <button
                                className={styles.paginationBtn}
                                onClick={() => setPagePending(prev => Math.min(totalPagesPending, prev + 1))}
                                disabled={pagePending === totalPagesPending}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Completed Batches Section */}
            <div className={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <h3 style={{ margin: 0, border: 'none', padding: 0 }}>Completed Batches (Ready for Mixing)</h3>
                    <div className={styles.searchBar}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <Search size={16} style={{ position: 'absolute', left: '0.75rem', color: '#94a3b8' }} />
                            <input
                                className={styles.input}
                                style={{ paddingLeft: '2.5rem', width: '260px' }}
                                type="text"
                                placeholder="Search Completed..."
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
                                <th>Thawing Start Date & Time</th>
                                <th>Thawing Completion Date & Time</th>
                                <th>Total Thawing Duration</th>
                                <th>Approved Operator Name</th>
                                <th>Approved By QA</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedCompleted.length === 0 ? (
                                <tr>
                                    <td colSpan={11} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                        No completed batches found.
                                    </td>
                                </tr>
                            ) : paginatedCompleted.map(rec => (
                                <tr key={rec.recordId}>
                                    <td style={{ fontWeight: 600, color: '#0f172a' }}>{rec.uniqueId}</td>
                                    <td>{rec.pasteName}</td>
                                    <td>{rec.manufacturerName}</td>
                                    <td>{formatCustomDateOnly(rec.manufacturerDate)}</td>
                                    <td>{formatCustomDateOnly(rec.pasteExpiryDate)}</td>
                                    <td>{rec.thawingStartFormatted}</td>
                                    <td>{rec.thawingEndFormatted}</td>
                                    <td style={{ fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
                                        {formatDuration(rec.thawingDurationSeconds)}
                                    </td>
                                    <td>{rec.thawingCompletedBy || '—'}</td>
                                    <td>{rec.qaApprovedBy || '—'}</td>
                                    <td>
                                        <button className={styles.viewBtn} onClick={() => setDetailRecord(rec)} title="View Details">
                                            <Eye size={13} style={{ marginRight: '4px' }} /> View
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Completed Pagination */}
                {completedBatches.length > itemsPerPage && (
                    <div className={styles.pagination}>
                        <div className={styles.paginationInfo}>
                            Showing {((pageCompleted - 1) * itemsPerPage) + 1} to {Math.min(pageCompleted * itemsPerPage, completedBatches.length)} of {completedBatches.length} records
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                className={styles.paginationBtn}
                                onClick={() => setPageCompleted(prev => Math.max(1, prev - 1))}
                                disabled={pageCompleted === 1}
                            >
                                Previous
                            </button>
                            <button
                                className={styles.paginationBtn}
                                onClick={() => setPageCompleted(prev => Math.min(totalPagesCompleted, prev + 1))}
                                disabled={pageCompleted === totalPagesCompleted}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Thawing Time Over Limit Section */}
            <div className={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <h3 style={{ margin: 0, border: 'none', padding: 0 }}>Thawing Time Over Limit</h3>
                    <div className={styles.searchBar}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <Search size={16} style={{ position: 'absolute', left: '0.75rem', color: '#94a3b8' }} />
                            <input
                                className={styles.input}
                                style={{ paddingLeft: '2.5rem', width: '260px' }}
                                type="text"
                                placeholder="Search Over Limit..."
                                value={searchOverLimit}
                                onChange={(e) => {
                                    setSearchOverLimit(e.target.value);
                                    setPageOverLimit(1);
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
                                <th>Thawing Start Date & Time</th>
                                <th>Current Thawing Duration</th>
                                <th>Operator Name</th>
                                <th>Approved By QA</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedOverLimit.length === 0 ? (
                                <tr>
                                    <td colSpan={11} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                        No over-limit batches found.
                                    </td>
                                </tr>
                            ) : paginatedOverLimit.map(rec => (
                                <tr key={rec.recordId}>
                                    <td style={{ fontWeight: 600, color: '#0f172a' }}>{rec.uniqueId}</td>
                                    <td>{rec.pasteName}</td>
                                    <td>{rec.manufacturerName}</td>
                                    <td>{formatCustomDateOnly(rec.manufacturerDate)}</td>
                                    <td>{formatCustomDateOnly(rec.pasteExpiryDate)}</td>
                                    <td>{rec.thawingStartFormatted}</td>
                                    <td style={{ fontWeight: 700, color: '#ef4444', fontFamily: 'monospace' }}>
                                        {formatDuration(rec.thawingDurationSeconds)}
                                    </td>
                                    <td>{rec.operatorName || rec.removedBy || '—'}</td>
                                    <td>{rec.thawingApprovedByQA || rec.approvedByQA || '—'}</td>
                                    <td>
                                        <span className={`${styles.badge} ${styles.badgeError}`}>
                                            OVER LIMIT
                                        </span>
                                    </td>
                                    <td>
                                        <button className={styles.viewBtn} onClick={() => setDetailRecord(rec)} title="View Details">
                                            <Eye size={13} style={{ marginRight: '4px' }} /> View
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Over Limit Pagination */}
                {overLimitBatches.length > itemsPerPage && (
                    <div className={styles.pagination}>
                        <div className={styles.paginationInfo}>
                            Showing {((pageOverLimit - 1) * itemsPerPage) + 1} to {Math.min(pageOverLimit * itemsPerPage, overLimitBatches.length)} of {overLimitBatches.length} records
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                className={styles.paginationBtn}
                                onClick={() => setPageOverLimit(prev => Math.max(1, prev - 1))}
                                disabled={pageOverLimit === 1}
                            >
                                Previous
                            </button>
                            <button
                                className={styles.paginationBtn}
                                onClick={() => setPageOverLimit(prev => Math.min(totalPagesOverLimit, prev + 1))}
                                disabled={pageOverLimit === totalPagesOverLimit}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Custom Stop Confirmation Modal */}
            {showStopModal && stopTargetRecord && (
                <div className={styles.modalOverlay} style={{ zIndex: 1010 }}>
                    <div className={styles.modalContent} style={{ maxWidth: '500px' }}>
                        <div className={styles.modalHeader}>
                            <h3>Verify Thawing Completion</h3>
                            <button className={styles.closeModalBtn} onClick={() => setShowStopModal(false)} title="Close">
                                <X size={20} />
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            <p style={{ marginTop: 0, fontSize: '0.9rem', color: '#64748b', lineHeight: '1.5' }}>
                                Enter operator and QA approvals to stop the thawing timer and mark container <strong>{stopTargetRecord.uniqueId}</strong> as ready for Solder Paste Mixing.
                            </p>
                            <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.375rem', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
                                <strong>Thawing Start:</strong> {stopTargetRecord.thawingStartFormatted} <br />
                                <strong>Duration:</strong> {formatDuration(getElapsedSeconds(stopTargetRecord.thawingStartTime))}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div className={styles.inputGroup}>
                                    <label htmlFor="stopCompletedBy">Thawing Completed By *</label>
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
                            <button className={`${styles.button} ${styles.btnPrimary}`} onClick={handleConfirmStop} style={{ backgroundColor: '#ea580c' }}>
                                Complete Thawing
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Read-Only View Details Modal */}
            {detailRecord && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalHeader}>
                            <h3>Solder Paste Thawing Run details — {detailRecord.uniqueId}</h3>
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
                                        <span className={styles.detailLabel}>Thawing Status</span>
                                        <span className={styles.detailValue}>
                                            <span className={`${styles.badge} ${detailRecord.status === 'PENDING' ? styles.badgeWarning :
                                                detailRecord.status === 'READY_FOR_MIXING' ? styles.badgeSuccess :
                                                    styles.badgeError
                                                }`}>
                                                {detailRecord.status.replace(/_/g, ' ')}
                                            </span>
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Total Thawing Duration</span>
                                        <span className={styles.detailValue} style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                                            {formatDuration(detailRecord.status === 'PENDING' ? getElapsedSeconds(detailRecord.thawingStartTime) : detailRecord.thawingDurationSeconds)}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Eligibility for Mixing</span>
                                        <span className={styles.detailValue}>
                                            <span style={{
                                                fontSize: '0.75rem', fontWeight: 700, padding: '0.15rem 0.4rem', borderRadius: '4px',
                                                backgroundColor: detailRecord.status === 'READY_FOR_MIXING' ? '#dcfce7' : '#fee2e2',
                                                color: detailRecord.status === 'READY_FOR_MIXING' ? '#15803d' : '#991b1b',
                                                border: `1px solid ${detailRecord.status === 'READY_FOR_MIXING' ? '#bbf7d0' : '#fca5a5'}`
                                            }}>
                                                {detailRecord.status === 'READY_FOR_MIXING' ? 'ELIGIBLE' : 'NOT ELIGIBLE'}
                                            </span>
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Material & Removal Specifications */}
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
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Refrigerator Removal Time</span>
                                        <span className={styles.detailValue}>{formatCustomDateTime(detailRecord.refrigeratorRemovalDateTime)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: Thawing Operations & Audit */}
                            <div className={styles.detailsSection}>
                                <h4 className={styles.sectionTitle}>Thawing Operations & Audit</h4>
                                <div className={styles.detailsGrid}>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Operator Name</span>
                                        <span className={styles.detailValue}>{detailRecord.operatorName || detailRecord.removedBy || '—'}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Approved By QA</span>
                                        <span className={styles.detailValue}>{detailRecord.thawingApprovedByQA || detailRecord.approvedByQA || '—'}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Thawing Start Date & Time</span>
                                        <span className={styles.detailValue}>{detailRecord.thawingStartFormatted}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Thawing Completion Date & Time</span>
                                        <span className={styles.detailValue}>{detailRecord.thawingEndFormatted || '—'}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Thawing Completed By</span>
                                        <span className={styles.detailValue}>{detailRecord.thawingCompletedBy || '—'}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>QA Approved By (Completion)</span>
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
            {/* Dynamic tick trigger for live counters */}
            <span style={{ display: 'none' }}>{tickTrigger}</span>
        </div>
    );
};

export default Thawing;
