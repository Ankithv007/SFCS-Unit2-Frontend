import React, { useState, useEffect, useRef } from 'react';
import styles from './RemovalFromRefrigerator.module.css';
import { Search, RefreshCw, Eye, X, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useSmtAuth } from '../../context/SmtAuthContext';

interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
}

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
    currentStage: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    isDeleted: boolean;
    deletedAt: string | null;
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

const getInitialRecords = (): SolderPasteRemovalRecord[] => {
    const saved = localStorage.getItem('solder_paste_removal_records_v2');
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (e) {
            console.error(e);
        }
    }
    // Seed records
    const sample: SolderPasteRemovalRecord[] = [
        {
            recordId: 'SPM-2026-0001',
            uniqueId: 'SP-1029-A',
            pasteName: 'Indium 8.9HF',
            manufacturerName: 'Indium Corporation',
            manufacturerDate: '2026-05-10',
            pasteExpiryDate: '2026-11-10',
            refrigeratorRemovalDateTime: '2026-06-23T08:15:00',
            removedBy: 'Ankith Operator',
            approvedByQA: 'Jane Inspector QA',
            currentStage: 'Removal from Refrigerator',
            status: 'ACTIVE',
            createdAt: '2026-06-23T08:15:00',
            updatedAt: '2026-06-23T08:15:00',
            isDeleted: false,
            deletedAt: null
        },
        {
            recordId: 'SPM-2026-0002',
            uniqueId: 'SP-3048-B',
            pasteName: 'Kester NP505-HR',
            manufacturerName: 'Kester Solder',
            manufacturerDate: '2026-04-15',
            pasteExpiryDate: '2026-10-15',
            refrigeratorRemovalDateTime: '2026-06-23T09:30:00',
            removedBy: 'Ankith Operator',
            approvedByQA: 'John QA Lead',
            currentStage: 'Removal from Refrigerator',
            status: 'ACTIVE',
            createdAt: '2026-06-23T09:30:00',
            updatedAt: '2026-06-23T09:30:00',
            isDeleted: false,
            deletedAt: null
        }
    ];
    localStorage.setItem('solder_paste_removal_records_v2', JSON.stringify(sample));
    return sample;
};

const getSystemTimestampString = () => {
    return formatCustomDateTime(new Date());
};

const RemovalFromRefrigerator: React.FC = () => {
    // Auth context roles
    const { user } = useAuth();
    const { smtUser } = useSmtAuth();
    
    // Check delete permission: Super Admin, Admin, Manager, or no users logged in (during dev testing)
    const isAuthorizedToDelete = 
        (smtUser && ['Super Admin', 'Admin', 'Manager'].includes(smtUser.role)) ||
        (user && ['Super Admin', 'Admin', 'Manager'].includes(user.role)) ||
        (!user && !smtUser);

    // Toasts
    const [toasts, setToasts] = useState<Toast[]>([]);
    const toastId = useRef(0);
    const addToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        const id = toastId.current++;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    };

    // Records state
    const [records, setRecords] = useState<SolderPasteRemovalRecord[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Form inputs
    const [uniqueId, setUniqueId] = useState('');
    const [pasteName, setPasteName] = useState('');
    const [manufacturerName, setManufacturerName] = useState('');
    const [manufacturerDate, setManufacturerDate] = useState('');
    const [pasteExpiryDate, setPasteExpiryDate] = useState('');
    const [refrigeratorRemovalDateTime, setRefrigeratorRemovalDateTime] = useState('');
    const [removedBy, setRemovedBy] = useState('');
    const [approvedByQA, setApprovedByQA] = useState('');

    // Validation state
    const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});

    // Search and Pagination
    const [search, setSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const recordsPerPage = 5;

    // View Details Modal
    const [detailRecord, setDetailRecord] = useState<SolderPasteRemovalRecord | null>(null);

    // Custom Confirmation Modal
    const [deleteTargetRecord, setDeleteTargetRecord] = useState<SolderPasteRemovalRecord | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Load initial records & setup ticking timer
    useEffect(() => {
        setIsLoading(true);
        const data = getInitialRecords();
        setRecords(data);
        setRefrigeratorRemovalDateTime(getSystemTimestampString());
        setIsLoading(false);

        // Keep updating timestamp ticking clock every second
        const timer = setInterval(() => {
            setRefrigeratorRemovalDateTime(getSystemTimestampString());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Refresh table action
    const handleRefreshTable = () => {
        setIsLoading(true);
        const data = getInitialRecords();
        setRecords(data);
        setIsLoading(false);
        addToast('Records refreshed successfully.', 'success');
    };

    // Form validation helper
    const validateForm = (): boolean => {
        const errors: { [key: string]: string } = {};
        const now = new Date();

        if (!uniqueId.trim()) errors.uniqueId = 'Unique ID is required.';
        else {
            const isDuplicate = records.some(
                r => !r.isDeleted && r.uniqueId.trim().toLowerCase() === uniqueId.trim().toLowerCase()
            );
            if (isDuplicate) {
                errors.uniqueId = 'Unique ID must be unique.';
            }
        }

        if (!pasteName.trim()) errors.pasteName = 'Paste Name is required.';
        if (!manufacturerName.trim()) errors.manufacturerName = 'Manufacturer Name is required.';
        
        if (!manufacturerDate) errors.manufacturerDate = 'Manufacturer Date is required.';
        else {
            const mDate = new Date(manufacturerDate);
            if (mDate > now) {
                errors.manufacturerDate = 'Manufacturer Date cannot be a future date.';
            }
        }

        if (!pasteExpiryDate) errors.pasteExpiryDate = 'Paste Expiry Date is required.';
        else if (manufacturerDate) {
            const mDate = new Date(manufacturerDate);
            const eDate = new Date(pasteExpiryDate);
            if (eDate <= mDate) {
                errors.pasteExpiryDate = 'Paste Expiry Date must be greater than Manufacturer Date.';
            }
        }

        if (!refrigeratorRemovalDateTime) errors.refrigeratorRemovalDateTime = 'Removal Date & Time is required.';
        if (!removedBy.trim()) errors.removedBy = 'Removed By Operator name is required.';
        if (!approvedByQA.trim()) errors.approvedByQA = 'Approved By QA Inspector name is required.';

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // Submit handler
    const handleCreateRecord = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!validateForm()) {
            addToast('Please correct validation errors in the form.', 'error');
            return;
        }

        // Generate standardized SPM-YYYY-XXXX Record ID
        const year = new Date().getFullYear();
        const nextNum = records.length + 1;
        const recordId = `SPM-${year}-${String(nextNum).padStart(4, '0')}`;

        // Get exact current local ISO timestamp for creation/updates
        const currentIsoTimestamp = new Date().toISOString();

        const newRecord: SolderPasteRemovalRecord = {
            recordId,
            uniqueId: uniqueId.trim(),
            pasteName: pasteName.trim(),
            manufacturerName: manufacturerName.trim(),
            manufacturerDate,
            pasteExpiryDate,
            refrigeratorRemovalDateTime: new Date().toISOString(), // capture absolute timestamp at this moment
            removedBy: removedBy.trim(),
            approvedByQA: approvedByQA.trim(),
            currentStage: 'Removal from Refrigerator',
            status: 'ACTIVE',
            createdAt: currentIsoTimestamp,
            updatedAt: currentIsoTimestamp,
            isDeleted: false,
            deletedAt: null
        };

        const updatedRecords = [newRecord, ...records];
        setRecords(updatedRecords);
        localStorage.setItem('solder_paste_removal_records_v2', JSON.stringify(updatedRecords));

        addToast(`Removal record ${recordId} created and saved successfully!`, 'success');

        // Reset manual fields
        setUniqueId('');
        setPasteName('');
        setManufacturerName('');
        setManufacturerDate('');
        setPasteExpiryDate('');
        setRemovedBy('');
        setApprovedByQA('');
        setRefrigeratorRemovalDateTime(getSystemTimestampString());
        setValidationErrors({});
        setCurrentPage(1); // Go back to page 1 to see the new record
    };

    // Clear handler
    const handleClearForm = () => {
        setUniqueId('');
        setPasteName('');
        setManufacturerName('');
        setManufacturerDate('');
        setPasteExpiryDate('');
        setRemovedBy('');
        setApprovedByQA('');
        setRefrigeratorRemovalDateTime(getSystemTimestampString());
        setValidationErrors({});
        addToast('Form cleared.', 'info');
    };

    // Open delete confirmation modal
    const handleOpenDelete = (record: SolderPasteRemovalRecord) => {
        setDeleteTargetRecord(record);
        setShowDeleteConfirm(true);
    };

    // Confirm soft delete action
    const handleConfirmDelete = () => {
        if (!deleteTargetRecord) return;

        const updatedRecords = records.map(rec => {
            if (rec.recordId === deleteTargetRecord.recordId) {
                return {
                    ...rec,
                    isDeleted: true,
                    status: 'DELETED',
                    deletedAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
            }
            return rec;
        });

        setRecords(updatedRecords);
        localStorage.setItem('solder_paste_removal_records_v2', JSON.stringify(updatedRecords));

        addToast(`Record ${deleteTargetRecord.recordId} soft-deleted successfully.`, 'success');
        
        setShowDeleteConfirm(false);
        setDeleteTargetRecord(null);

        // Adjust pagination page if last item on page is deleted
        const activeFilteredRecords = updatedRecords.filter(r => !r.isDeleted && matchSearchQuery(r));
        const maxPage = Math.ceil(activeFilteredRecords.length / recordsPerPage) || 1;
        if (currentPage > maxPage) {
            setCurrentPage(maxPage);
        }
    };

    // Search query matching
    const matchSearchQuery = (rec: SolderPasteRemovalRecord): boolean => {
        const q = search.toLowerCase().trim();
        if (!q) return true;
        return (
            rec.recordId.toLowerCase().includes(q) ||
            rec.uniqueId.toLowerCase().includes(q) ||
            rec.pasteName.toLowerCase().includes(q) ||
            rec.manufacturerName.toLowerCase().includes(q) ||
            rec.removedBy.toLowerCase().includes(q) ||
            rec.approvedByQA.toLowerCase().includes(q)
        );
    };

    // Filtering active records (non-deleted)
    const activeRecords = records.filter(rec => !rec.isDeleted && matchSearchQuery(rec));

    // Pagination Calculation
    const totalPages = Math.ceil(activeRecords.length / recordsPerPage);
    const indexOfLastRecord = currentPage * recordsPerPage;
    const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
    const currentRecords = activeRecords.slice(indexOfFirstRecord, indexOfLastRecord);

    return (
        <div className={styles.container}>
            <Toaster toasts={toasts} onRemove={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />

            {/* Breadcrumb Navigation */}
            <div className={styles.breadcrumbs}>
                <span>SMT</span>
                <span>&gt;</span>
                <span>Solder Paste Management</span>
                <span>&gt;</span>
                <strong className={styles.breadcrumbActive}>Removal from Refrigerator</strong>
            </div>

            {/* Page Header Card */}
            <div className={styles.header}>
                <h2>Removal from Refrigerator</h2>
                <p>Track solder paste removal activities from refrigerated storage before production use.</p>
            </div>

            {/* Removal Entry Form Card */}
            <div className={styles.card}>
                <h3>Solder Paste Removal Entry Form</h3>
                <form onSubmit={handleCreateRecord}>
                    <div className={styles.formGrid4}>
                        <div className={styles.inputGroup}>
                            <label htmlFor="uniqueId">Unique ID *</label>
                            <input 
                                id="uniqueId"
                                className={`${styles.input} ${validationErrors.uniqueId ? styles.inputError : ''}`}
                                type="text"
                                placeholder="e.g. SP-5029-X"
                                value={uniqueId}
                                onChange={(e) => {
                                    setUniqueId(e.target.value);
                                    if (validationErrors.uniqueId) {
                                        setValidationErrors(prev => ({ ...prev, uniqueId: '' }));
                                    }
                                }}
                            />
                            {validationErrors.uniqueId && <span className={styles.errorText}>{validationErrors.uniqueId}</span>}
                        </div>

                        <div className={styles.inputGroup}>
                            <label htmlFor="pasteName">Paste Name *</label>
                            <input 
                                id="pasteName"
                                className={`${styles.input} ${validationErrors.pasteName ? styles.inputError : ''}`}
                                type="text"
                                placeholder="e.g. Indium 8.9HF"
                                value={pasteName}
                                onChange={(e) => {
                                    setPasteName(e.target.value);
                                    if (validationErrors.pasteName) {
                                        setValidationErrors(prev => ({ ...prev, pasteName: '' }));
                                    }
                                }}
                            />
                            {validationErrors.pasteName && <span className={styles.errorText}>{validationErrors.pasteName}</span>}
                        </div>

                        <div className={styles.inputGroup}>
                            <label htmlFor="manufacturerName">Manufacturer Name *</label>
                            <input 
                                id="manufacturerName"
                                className={`${styles.input} ${validationErrors.manufacturerName ? styles.inputError : ''}`}
                                type="text"
                                placeholder="e.g. Indium Corporation"
                                value={manufacturerName}
                                onChange={(e) => {
                                    setManufacturerName(e.target.value);
                                    if (validationErrors.manufacturerName) {
                                        setValidationErrors(prev => ({ ...prev, manufacturerName: '' }));
                                    }
                                }}
                            />
                            {validationErrors.manufacturerName && <span className={styles.errorText}>{validationErrors.manufacturerName}</span>}
                        </div>

                        <div className={styles.inputGroup}>
                            <label htmlFor="refrigeratorRemovalDateTime">Refrigerator Removal Date & Time *</label>
                            <input 
                                id="refrigeratorRemovalDateTime"
                                className={styles.input}
                                type="text"
                                value={refrigeratorRemovalDateTime}
                                disabled
                                title="Automatically populated with the current system timestamp to preserve audit trails."
                            />
                        </div>
                    </div>

                    <div className={styles.formGrid4} style={{ marginTop: '1rem' }}>
                        <div className={styles.inputGroup}>
                            <label htmlFor="manufacturerDate">Manufacturer Date *</label>
                            <input 
                                id="manufacturerDate"
                                className={`${styles.input} ${validationErrors.manufacturerDate ? styles.inputError : ''}`}
                                type="date"
                                value={manufacturerDate}
                                onChange={(e) => {
                                    setManufacturerDate(e.target.value);
                                    if (validationErrors.manufacturerDate) {
                                        setValidationErrors(prev => ({ ...prev, manufacturerDate: '' }));
                                    }
                                }}
                            />
                            {validationErrors.manufacturerDate && <span className={styles.errorText}>{validationErrors.manufacturerDate}</span>}
                        </div>

                        <div className={styles.inputGroup}>
                            <label htmlFor="pasteExpiryDate">Paste Expiry Date *</label>
                            <input 
                                id="pasteExpiryDate"
                                className={`${styles.input} ${validationErrors.pasteExpiryDate ? styles.inputError : ''}`}
                                type="date"
                                value={pasteExpiryDate}
                                onChange={(e) => {
                                    setPasteExpiryDate(e.target.value);
                                    if (validationErrors.pasteExpiryDate) {
                                        setValidationErrors(prev => ({ ...prev, pasteExpiryDate: '' }));
                                    }
                                }}
                            />
                            {validationErrors.pasteExpiryDate && <span className={styles.errorText}>{validationErrors.pasteExpiryDate}</span>}
                        </div>

                        <div className={styles.inputGroup}>
                            <label htmlFor="removedBy">Removed By *</label>
                            <input 
                                id="removedBy"
                                className={`${styles.input} ${validationErrors.removedBy ? styles.inputError : ''}`}
                                type="text"
                                placeholder="Operator name / ID"
                                value={removedBy}
                                onChange={(e) => {
                                    setRemovedBy(e.target.value);
                                    if (validationErrors.removedBy) {
                                        setValidationErrors(prev => ({ ...prev, removedBy: '' }));
                                    }
                                }}
                            />
                            {validationErrors.removedBy && <span className={styles.errorText}>{validationErrors.removedBy}</span>}
                        </div>

                        <div className={styles.inputGroup}>
                            <label htmlFor="approvedByQA">Approved By QA *</label>
                            <input 
                                id="approvedByQA"
                                className={`${styles.input} ${validationErrors.approvedByQA ? styles.inputError : ''}`}
                                type="text"
                                placeholder="QA Inspector name / ID"
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

                    <div className={styles.formFooter}>
                        <button type="button" className={`${styles.button} ${styles.btnSecondary}`} onClick={handleClearForm}>
                            Clear Form
                        </button>
                        <button type="submit" className={`${styles.button} ${styles.btnPrimary}`}>
                            Create Record
                        </button>
                    </div>
                </form>
            </div>

            {/* Completed Refrigerator Removal Records Card */}
            <div className={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <h3 style={{ margin: 0, border: 'none', padding: 0 }}>Completed Refrigerator Removal Records</h3>
                    <div className={styles.searchBar}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <Search size={16} style={{ position: 'absolute', left: '0.75rem', color: '#94a3b8' }} />
                            <input 
                                className={styles.input} 
                                style={{ paddingLeft: '2.5rem', width: '300px' }} 
                                type="text" 
                                placeholder="Search Record ID / Unique ID / Paste..." 
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                    setCurrentPage(1);
                                }}
                            />
                        </div>
                        <button className={`${styles.button} ${styles.btnSecondary}`} onClick={handleRefreshTable} title="Refresh Table">
                            <RefreshCw size={16} />
                        </button>
                    </div>
                </div>

                <div className={styles.tableContainer}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Record ID</th>
                                <th>Unique ID</th>
                                <th>Paste Name</th>
                                <th>Manufacturer Name</th>
                                <th>Mfg Date</th>
                                <th>Expiry Date</th>
                                <th>Removal Date & Time</th>
                                <th>Removed By</th>
                                <th>Approved By QA</th>
                                <th>Created Date & Time</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={12} style={{ textAlign: 'center', padding: '3rem' }}>
                                        <RefreshCw className="animate-spin" size={24} style={{ color: '#4f46e5' }} />
                                    </td>
                                </tr>
                            ) : currentRecords.length === 0 ? (
                                <tr>
                                    <td colSpan={12} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                                        No refrigerator removal records found.
                                    </td>
                                </tr>
                            ) : currentRecords.map(rec => (
                                <tr key={rec.recordId}>
                                    <td style={{ fontWeight: 700, color: '#4f46e5' }}>{rec.recordId}</td>
                                    <td style={{ fontWeight: 600, color: '#0f172a' }}>{rec.uniqueId}</td>
                                    <td>{rec.pasteName}</td>
                                    <td>{rec.manufacturerName}</td>
                                    <td>{formatCustomDateOnly(rec.manufacturerDate)}</td>
                                    <td>{formatCustomDateOnly(rec.pasteExpiryDate)}</td>
                                    <td>{formatCustomDateTime(rec.refrigeratorRemovalDateTime)}</td>
                                    <td>{rec.removedBy}</td>
                                    <td>{rec.approvedByQA}</td>
                                    <td>{formatCustomDateTime(rec.createdAt)}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                                            <button 
                                                className={styles.viewBtn} 
                                                onClick={() => setDetailRecord(rec)}
                                                title="View Details"
                                            >
                                                <Eye size={13} style={{ marginRight: '4px' }} />
                                                View
                                            </button>
                                            {isAuthorizedToDelete && (
                                                <button 
                                                    className={styles.deleteBtn} 
                                                    onClick={() => handleOpenDelete(rec)}
                                                    title="Soft Delete Record"
                                                >
                                                    <X size={13} style={{ marginRight: '4px' }} />
                                                    Delete
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {activeRecords.length > recordsPerPage && (
                    <div className={styles.pagination}>
                        <div className={styles.paginationInfo}>
                            Showing {indexOfFirstRecord + 1} to {Math.min(indexOfLastRecord, activeRecords.length)} of {activeRecords.length} records
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                                className={styles.paginationBtn}
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                            >
                                Previous
                            </button>
                            <button 
                                className={styles.paginationBtn}
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* View Details Modal */}
            {detailRecord && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalHeader}>
                            <h3>Removal Record Details — {detailRecord.recordId}</h3>
                            <button className={styles.closeModalBtn} onClick={() => setDetailRecord(null)} title="Close">
                                <X size={20} />
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            {/* Section 1: Record Identifiers */}
                            <div className={styles.detailsSection}>
                                <h4 className={styles.sectionTitle}>Process Stage & Metadata</h4>
                                <div className={styles.detailsGrid}>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Record ID</span>
                                        <span className={styles.detailValue} style={{ fontWeight: 700, color: '#4f46e5' }}>{detailRecord.recordId}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Stage Status</span>
                                        <span className={styles.detailValue}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.15rem 0.4rem', borderRadius: '4px', backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }}>
                                                {detailRecord.status}
                                            </span>
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Created Date & Time</span>
                                        <span className={styles.detailValue}>{formatCustomDateTime(detailRecord.createdAt)}</span>
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

                            {/* Section 3: Personnel & Approvals */}
                            <div className={styles.detailsSection}>
                                <h4 className={styles.sectionTitle}>Personnel & Approvals</h4>
                                <div className={styles.detailsGrid}>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Removed By</span>
                                        <span className={styles.detailValue}>{detailRecord.removedBy}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Approved By QA</span>
                                        <span className={styles.detailValue}>{detailRecord.approvedByQA}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Last Updated</span>
                                        <span className={styles.detailValue}>{formatCustomDateTime(detailRecord.updatedAt)}</span>
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

            {/* Custom Confirmation Modal */}
            {showDeleteConfirm && deleteTargetRecord && (
                <div className={styles.modalOverlay} style={{ zIndex: 1010 }}>
                    <div className={styles.modalContent} style={{ maxWidth: '500px' }}>
                        <div className={styles.modalHeader} style={{ borderBottom: 'none', paddingBottom: '0.5rem' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#dc2626' }}>
                                <AlertTriangle size={22} />
                                Delete Confirmation
                            </h3>
                            <button className={styles.closeModalBtn} onClick={() => { setShowDeleteConfirm(false); setDeleteTargetRecord(null); }} title="Close">
                                <X size={20} />
                            </button>
                        </div>
                        <div className={styles.modalBody} style={{ padding: '0 1.5rem 1.5rem 1.5rem' }}>
                            <p style={{ margin: 0, fontSize: '0.95rem', color: '#334155', lineHeight: '1.5' }}>
                                Are you sure you want to delete this Refrigerator Removal Record?
                            </p>
                            <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.5rem', fontSize: '0.85rem' }}>
                                <strong>Record ID:</strong> {deleteTargetRecord.recordId} <br />
                                <strong>Unique ID:</strong> {deleteTargetRecord.uniqueId} <br />
                                <strong>Paste Name:</strong> {deleteTargetRecord.pasteName}
                            </div>
                        </div>
                        <div className={styles.modalFooter} style={{ backgroundColor: '#f8fafc', borderBottomLeftRadius: '1rem', borderBottomRightRadius: '1rem' }}>
                            <button 
                                className={`${styles.button} ${styles.btnSecondary}`} 
                                onClick={() => { setShowDeleteConfirm(false); setDeleteTargetRecord(null); }}
                            >
                                Cancel
                            </button>
                            <button 
                                className={`${styles.button}`} 
                                style={{ backgroundColor: '#dc2626', color: '#ffffff', border: 'none' }}
                                onClick={handleConfirmDelete}
                            >
                                Confirm Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RemovalFromRefrigerator;
