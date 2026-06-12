import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSmtAuth } from '../../context/SmtAuthContext';
import styles from './SolderPasteManagement.module.css';

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

const getOperatorDetails = (row: any) => {
    if (row.process_step === 'Solder Paste - Removal') {
        return {
            name: row.solder_paste_stage1_operator || 'Unknown',
            code: row.solder_paste_stage1_employee_code || 'Unknown'
        };
    } else if (row.process_step === 'Solder Paste - Thawing') {
        return {
            name: row.solder_paste_stage2_operator || 'System',
            code: row.solder_paste_stage2_employee_code || 'Timer'
        };
    } else {
        return {
            name: row.solder_paste_stage3_operator || 'Unknown',
            code: row.solder_paste_stage3_employee_code || 'Unknown'
        };
    }
};

const formatDateTime = (dateString: string) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '—';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const strHours = String(hours).padStart(2, '0');

    return `${day}-${month}-${year} ${strHours}:${minutes}:${seconds} ${ampm}`;
};

export const SolderPasteManagement: React.FC = () => {
    const { smtUser, smtLogout } = useSmtAuth();

    // UI Navigation
    const [activeTab, setActiveTab] = useState<'stage1' | 'stage2' | 'stage3'>('stage1');

    // Eligible Work Orders
    const [eligibleWos, setEligibleWos] = useState<any[]>([]);
    const [selectedWoId, setSelectedWoId] = useState<string>('');
    const [woDetails, setWoDetails] = useState<any | null>(null);

    // Form inputs
    const [solderPasteBarcode, setSolderPasteBarcode] = useState<string>('');

    // State indicators
    const [submitting, setSubmitting] = useState<boolean>(false);
    const [dashboardCounts, setDashboardCounts] = useState({
        pending: 0,
        in_progress: 0,
        ready_for_mixing: 0,
        completed: 0
    });

    // Timer states for Thawing stage
    const [thawingRemainingMs, setThawingRemainingMs] = useState<number>(0);
    const [lastCompletedStage1, setLastCompletedStage1] = useState<any>(null);
    const [lastCompletedStage3, setLastCompletedStage3] = useState<any>(null);
    const [completedBatches, setCompletedBatches] = useState<any[]>([]);
    const [loadingBatches, setLoadingBatches] = useState<boolean>(false);

    // Search and Pagination States
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [nowTime, setNowTime] = useState<number>(Date.now());

    // Live clock ticker effect
    useEffect(() => {
        const timer = setInterval(() => {
            setNowTime(Date.now());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Toaster
    const [toasts, setToasts] = useState<Toast[]>([]);
    const toastId = useRef(0);
    const scanInputRef = useRef<HTMLInputElement>(null);

    const isOperator = true; // Permitted for all authenticated SMT users

    const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
        const id = ++toastId.current;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    }, []);

    const removeToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

    // Fetch dashboard counts
    const fetchDashboardCounts = async () => {
        try {
            const res = await fetch('/api/smt/solder-paste/dashboard-counts');
            if (res.ok) {
                const data = await res.json();
                setDashboardCounts({
                    pending: parseInt(data.pending) || 0,
                    in_progress: parseInt(data.in_progress) || 0,
                    ready_for_mixing: parseInt(data.ready_for_mixing) || 0,
                    completed: parseInt(data.completed) || 0
                });
            }
        } catch (err) {
            console.error("Error fetching dashboard counts:", err);
        }
    };

    // Fetch completed batches history
    const fetchCompletedBatches = async () => {
        setLoadingBatches(true);
        try {
            const res = await fetch('/api/smt/solder-paste/completed-batches');
            if (res.ok) {
                const data = await res.json();
                setCompletedBatches(data);
            }
        } catch (err) {
            console.error("Error fetching completed batches:", err);
        } finally {
            setLoadingBatches(false);
        }
    };

    // Fetch eligible Work Orders based on active tab
    const fetchEligibleWos = async (tab: 'stage1' | 'stage2' | 'stage3') => {
        let stageNum = '1';
        if (tab === 'stage2') stageNum = '2';
        if (tab === 'stage3') stageNum = '3';

        try {
            const res = await fetch(`/api/smt/solder-paste/eligible-wos?stage=${stageNum}`);
            if (res.ok) {
                const data = await res.json();
                setEligibleWos(data);
            }
        } catch (err) {
            console.error("Error fetching eligible WOs:", err);
            addToast("Failed to fetch eligible Work Orders.", "error");
        }
    };

    // Fetch details/status of currently selected Work Order
    const fetchWoStatus = async (woId: string) => {
        if (!woId) {
            setWoDetails(null);
            setThawingRemainingMs(0);
            return;
        }

        try {
            const res = await fetch(`/api/smt/solder-paste/status/${encodeURIComponent(woId)}`);
            if (res.ok) {
                const data = await res.json();
                setWoDetails(data);
                if (data.stage2?.status === 'In Progress') {
                    setThawingRemainingMs(data.stage2.thawing_remaining_ms || 0);
                } else {
                    setThawingRemainingMs(0);
                }
            } else {
                setWoDetails(null);
                setThawingRemainingMs(0);
            }
        } catch (err) {
            console.error("Error fetching WO status:", err);
            addToast("Error loading Work Order details.", "error");
        }
    };

    // Handle shift query
    const getShift = () => {
        const hour = new Date().getHours();
        if (hour >= 23 || hour < 7) return 'C (11PM - 07AM)';
        if (hour >= 15 && hour < 23) return 'B (03PM - 11PM)';
        if (hour >= 8 && hour < 17) return 'G (08AM - 05PM)';
        if (hour >= 6 && hour < 15) return 'A (06AM - 03PM)';
        return 'N/A';
    };

    // Generic hh:mm:ss AM/PM Formatter
    const formatTimeSecondsAMPM = (dateString: string | Date) => {
        if (!dateString) return '—';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '—';
        let hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        const strHours = String(hours).padStart(2, '0');
        return `${strHours}:${minutes}:${seconds} ${ampm}`;
    };

    // Stage 2 Thawing Duration / Remaining Countdown Calculator (in HH:MM:SS format)
    const getThawingDurationText = (startAtStr: string, completedAtStr?: string) => {
        if (!startAtStr) return '—';
        const startAt = new Date(startAtStr).getTime();
        const expectedAt = startAt + 4 * 60 * 60 * 1000;
        const now = Date.now();
        
        if (completedAtStr || now >= expectedAt) {
            return '04:00:00';
        }
        
        const remainingMs = expectedAt - now;
        const totalSecs = Math.max(0, Math.floor(remainingMs / 1000));
        const hours = Math.floor(totalSecs / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);
        const secs = totalSecs % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Stage 2 Thawing Status Logic
    const getStage2Status = (startAtStr: string, completedAtStr?: string) => {
        if (!startAtStr) return 'Pending';
        const startAt = new Date(startAtStr).getTime();
        const expectedAt = startAt + 4 * 60 * 60 * 1000;
        const now = Date.now();
        
        if (completedAtStr || now >= expectedAt) {
            return 'Completed';
        }
        return 'In Progress';
    };


    // Filter, Search, and Paginate batches history
    const getFilteredAndPaginatedBatches = () => {
        // Filter by process step of active stage/tab
        let stageFiltered = completedBatches.filter(row => {
            if (activeTab === 'stage1') {
                return row.process_step === 'Solder Paste - Removal';
            } else if (activeTab === 'stage2') {
                return row.process_step === 'Solder Paste - Thawing';
            } else {
                return row.process_step === 'Solder Paste - Mixing';
            }
        });

        // Apply instant search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            stageFiltered = stageFiltered.filter(row => 
                (row.work_order_id && row.work_order_id.toLowerCase().includes(query)) ||
                (row.product_name && row.product_name.toLowerCase().includes(query)) ||
                (row.solder_paste_barcode && row.solder_paste_barcode.toLowerCase().includes(query))
            );
        }

        const pageSize = 20;
        const totalItems = stageFiltered.length;
        const totalPages = Math.ceil(totalItems / pageSize) || 1;
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = Math.min(startIndex + pageSize, totalItems);
        const paginatedItems = stageFiltered.slice(startIndex, endIndex);

        return {
            items: paginatedItems,
            totalItems,
            startIndex,
            endIndex,
            totalPages
        };
    };

    // Initialize Page
    useEffect(() => {
        fetchDashboardCounts();
        fetchEligibleWos(activeTab);
        fetchCompletedBatches();
        setSelectedWoId('');
        setWoDetails(null);
        setSolderPasteBarcode('');
        setLastCompletedStage1(null);
        setLastCompletedStage3(null);
        setSearchQuery('');
        setCurrentPage(1);
    }, [activeTab]);

    // Focus input on Tab changes or Work Order selection
    useEffect(() => {
        if (activeTab === 'stage1' && selectedWoId && scanInputRef.current) {
            const timer = setTimeout(() => {
                scanInputRef.current?.focus();
            }, 80);
            return () => clearTimeout(timer);
        }
    }, [activeTab, selectedWoId, woDetails]);

    // Handle Work Order selection change
    const handleSelectWo = (woId: string) => {
        setSelectedWoId(woId);
        fetchWoStatus(woId);
        setSolderPasteBarcode('');
        setLastCompletedStage1(null);
        setLastCompletedStage3(null);
    };

    // Database-driven thawing timer effect
    useEffect(() => {
        if (activeTab === 'stage2' && woDetails?.stage2?.status === 'In Progress' && woDetails?.stage2?.start_at) {
            const startAt = new Date(woDetails.stage2.start_at).getTime();
            const elapsed = nowTime - startAt;
            const remaining = Math.max(0, 14400000 - elapsed);
            
            setThawingRemainingMs(remaining);

            if (remaining === 0) {
                addToast("Thawing complete! Work Order is ready for mixing.", "success");
                if (selectedWoId) {
                    fetchWoStatus(selectedWoId);
                }
                fetchDashboardCounts();
                fetchCompletedBatches();
            }
        } else {
            setThawingRemainingMs(0);
        }
    }, [activeTab, woDetails?.stage2?.status, woDetails?.stage2?.start_at, nowTime, selectedWoId]);

    // Format remaining time to HH:MM:SS
    const formatTime = (ms: number) => {
        const totalSecs = Math.floor(ms / 1000);
        const hours = Math.floor(totalSecs / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);
        const secs = totalSecs % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Submit Stage 1 - Removal from Fridge
    const handleStage1Submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedWoId) {
            addToast("Please select a Work Order.", "error");
            return;
        }
        if (!solderPasteBarcode.trim()) {
            addToast("Solder paste barcode is required.", "error");
            return;
        }
        if (!isOperator) {
            addToast("Access Denied: Only SMT operators can perform this action.", "error");
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch('/api/smt/solder-paste/stage1', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    work_order_id: selectedWoId,
                    solder_paste_barcode: solderPasteBarcode.trim().toUpperCase(),
                    operator_name: smtUser?.name || 'Unknown',
                    employee_code: smtUser?.userId || 'Unknown',
                    operator_role: smtUser?.role
                })
            });

            if (res.ok) {
                addToast("Stage 1 (Removal from Fridge) completed successfully!", "success");
                setLastCompletedStage1({
                    work_order_id: selectedWoId,
                    product_name: woDetails?.product_name || '—',
                    solder_paste_barcode: solderPasteBarcode.trim().toUpperCase(),
                    operator: `${smtUser?.name || 'Unknown'} (${smtUser?.userId || 'Unknown'})`,
                    date_time: new Date().toLocaleString(),
                    status: 'Completed'
                });
                // Reset/refresh
                fetchDashboardCounts();
                fetchEligibleWos('stage1');
                fetchCompletedBatches();
                setSelectedWoId('');
                setWoDetails(null);
                setSolderPasteBarcode('');
            } else {
                const data = await res.json();
                addToast(data.error || "Failed to complete Stage 1.", "error");
            }
        } catch (err) {
            console.error(err);
            addToast("Connection error while submitting.", "error");
        } finally {
            setSubmitting(false);
            if (scanInputRef.current) scanInputRef.current.focus();
        }
    };

    // Submit Stage 2 - Start Thawing
    const handleStage2Submit = async () => {
        if (!selectedWoId) {
            addToast("Please select a Work Order.", "error");
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch('/api/smt/solder-paste/stage2/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    work_order_id: selectedWoId,
                    operator_name: smtUser?.name || 'Unknown',
                    employee_code: smtUser?.userId || 'Unknown',
                    operator_role: smtUser?.role
                })
            });

            if (res.ok) {
                addToast("Stage 2 (Thawing) started successfully. 4-hour timer is running.", "success");
                fetchDashboardCounts();
                fetchWoStatus(selectedWoId);
                fetchCompletedBatches();
            } else {
                const data = await res.json();
                addToast(data.error || "Failed to start Thawing.", "error");
            }
        } catch (err) {
            console.error(err);
            addToast("Connection error.", "error");
        } finally {
            setSubmitting(false);
        }
    };

    // Submit Stage 3 - Start Mixing
    const handleStage3Start = async () => {
        if (!selectedWoId) {
            addToast("Please select a Work Order.", "error");
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch('/api/smt/solder-paste/stage3/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    work_order_id: selectedWoId,
                    operator_name: smtUser?.name || 'Unknown',
                    employee_code: smtUser?.userId || 'Unknown',
                    operator_role: smtUser?.role
                })
            });

            if (res.ok) {
                addToast("Stage 3 (Mixing) started successfully.", "success");
                fetchDashboardCounts();
                fetchWoStatus(selectedWoId);
                fetchCompletedBatches();
            } else {
                const data = await res.json();
                addToast(data.error || "Failed to start Mixing.", "error");
            }
        } catch (err) {
            console.error(err);
            addToast("Connection error.", "error");
        } finally {
            setSubmitting(false);
        }
    };

    // Submit Stage 3 - Complete Mixing
    const handleStage3Complete = async () => {
        if (!selectedWoId) {
            addToast("Please select a Work Order.", "error");
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch('/api/smt/solder-paste/stage3/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    work_order_id: selectedWoId,
                    operator_name: smtUser?.name || 'Unknown',
                    employee_code: smtUser?.userId || 'Unknown',
                    operator_role: smtUser?.role
                })
            });

            if (res.ok) {
                addToast("Stage 3 (Mixing) completed successfully! Solder Paste is Ready for Printing.", "success");
                setLastCompletedStage3({
                    work_order_id: selectedWoId,
                    product_name: woDetails?.product_name || '—',
                    solder_paste_barcode: woDetails?.solder_paste_barcode || '—',
                    mixing_start_time: woDetails?.stage3?.start_at ? new Date(woDetails.stage3.start_at).toLocaleString() : new Date().toLocaleString(),
                    mixing_completion_time: new Date().toLocaleString(),
                    operator: `${smtUser?.name || 'Unknown'} (${smtUser?.userId || 'Unknown'})`,
                    status: 'Completed'
                });
                fetchDashboardCounts();
                fetchEligibleWos('stage3');
                fetchCompletedBatches();
                setSelectedWoId('');
                setWoDetails(null);
            } else {
                const data = await res.json();
                addToast(data.error || "Failed to complete Mixing.", "error");
            }
        } catch (err) {
            console.error(err);
            addToast("Connection error.", "error");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className={styles.container}>
            <Toaster toasts={toasts} onRemove={removeToast} />

            {/* Header */}
            <div className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2>🧴 Solder Paste Management</h2>
                    <p style={{ color: '#64748b' }}>
                        Track container preparation workflow before SMT Printing. Logged in as: <strong>{smtUser?.name}</strong> ({smtUser?.role}) | Shift: <strong>{getShift()}</strong>
                    </p>
                </div>
                <button
                    onClick={() => {
                        if (window.confirm("Are you sure you want to logout from SMT?")) {
                            smtLogout();
                        }
                    }}
                    className={styles.secondaryButton}
                    style={{ borderColor: '#ef4444', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                    <span>🔒</span> Logout SMT
                </button>
            </div>

            {/* Dashboard Counts Row */}
            <div className={styles.metricContainer}>
                <div className={`${styles.metricCard} ${styles.metricPending}`}>
                    <div className={styles.metricNumber}>{dashboardCounts.pending}</div>
                    <div className={styles.metricLabel}>Pending Prep</div>
                </div>
                <div className={`${styles.metricCard} ${styles.metricInProgress}`}>
                    <div className={styles.metricNumber}>{dashboardCounts.in_progress}</div>
                    <div className={styles.metricLabel}>Thawing (In Progress)</div>
                </div>
                <div className={`${styles.metricCard} ${styles.metricReady}`}>
                    <div className={styles.metricNumber}>{dashboardCounts.ready_for_mixing}</div>
                    <div className={styles.metricLabel}>Ready For Mixing</div>
                </div>
                <div className={`${styles.metricCard} ${styles.metricCompleted}`}>
                    <div className={styles.metricNumber}>{dashboardCounts.completed}</div>
                    <div className={styles.metricLabel}>Completed (Ready to Print)</div>
                </div>
            </div>


            {/* Step Navigation Tabs */}
            <div className={styles.tabs}>
                <button
                    className={`${styles.tab} ${activeTab === 'stage1' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('stage1')}
                >
                    ❄️ Stage 1: Removal From Fridge
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'stage2' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('stage2')}
                >
                    ⏳ Stage 2: Thawing Timer
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'stage3' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('stage3')}
                >
                    🌪️ Stage 3: Paste Mixing
                </button>
            </div>

            {/* Active Content Panel */}
            <div className={styles.card}>

                {/* Stage 1 Panel */}
                {activeTab === 'stage1' && (
                    <>
                        <form onSubmit={handleStage1Submit}>
                            <h3>❄️ Step 1: Removal From Fridge</h3>
                            <div className={styles.formGrid}>
                                <div className={styles.inputGroup}>
                                    <label>Select Work Order *</label>
                                    <select
                                        className={styles.select}
                                        value={selectedWoId}
                                        onChange={(e) => handleSelectWo(e.target.value)}
                                    >
                                        <option value="">-- Choose Work Order --</option>
                                        {eligibleWos.map(wo => (
                                            <option key={wo.id} value={wo.id}>
                                                {wo.id} - {wo.product_name} (Qty: {wo.quantity})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className={styles.inputGroup}>
                                    <label>Scan Solder Paste Barcode *</label>
                                    <input
                                        type="text"
                                        className={styles.input}
                                        value={solderPasteBarcode}
                                        onChange={(e) => setSolderPasteBarcode(e.target.value)}
                                        placeholder="Scan container barcode here"
                                        disabled={!selectedWoId || submitting}
                                        ref={scanInputRef}
                                    />
                                </div>
                            </div>

                            {woDetails && (
                                <div className={styles.detailsContainer} style={{ marginTop: '1.5rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem' }}>
                                    <h4 style={{ margin: '0 0 1rem 0', color: '#0f172a', fontSize: '0.95rem', fontWeight: 700 }}>📋 Work Order Details</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                        <div>
                                            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>Work Order ID</span>
                                            <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>{woDetails.work_order_id}</strong>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>Product Name</span>
                                            <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>{woDetails.product_name || '—'}</strong>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>Product Description</span>
                                            <span style={{ fontSize: '0.9rem', color: '#1e293b' }}>{woDetails.product_description || '—'}</span>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>Quantity</span>
                                            <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>{woDetails.quantity}</strong>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>Panel Qty</span>
                                            <span style={{ fontSize: '0.9rem', color: '#1e293b' }}>{woDetails.panel_quantity || '—'}</span>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>Line ID</span>
                                            <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>{woDetails.line_id || '—'}</strong>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className={styles.actionSection}>
                                <button
                                    type="submit"
                                    className={styles.button}
                                    disabled={!selectedWoId || !solderPasteBarcode || submitting}
                                >
                                    {submitting ? 'Processing...' : ' Register '}
                                </button>
                            </div>
                        </form>

                        {lastCompletedStage1 && (
                            <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#ecfdf5', border: '1px solid #10b981', borderRadius: '8px' }}>
                                <h4 style={{ color: '#065f46', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span>✅</span> Removal From Fridge Completed
                                </h4>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
                                    <div>
                                        <span style={{ fontSize: '0.8rem', color: '#047857', display: 'block' }}>Work Order ID</span>
                                        <strong style={{ fontSize: '0.9rem', color: '#065f46' }}>{lastCompletedStage1.work_order_id}</strong>
                                    </div>
                                    <div>
                                        <span style={{ fontSize: '0.8rem', color: '#047857', display: 'block' }}>Product Name</span>
                                        <strong style={{ fontSize: '0.9rem', color: '#065f46' }}>{lastCompletedStage1.product_name}</strong>
                                    </div>
                                    <div>
                                        <span style={{ fontSize: '0.8rem', color: '#047857', display: 'block' }}>Solder Paste Barcode</span>
                                        <strong style={{ fontSize: '0.9rem', color: '#065f46' }}>{lastCompletedStage1.solder_paste_barcode}</strong>
                                    </div>
                                    <div>
                                        <span style={{ fontSize: '0.8rem', color: '#047857', display: 'block' }}>Operator</span>
                                        <strong style={{ fontSize: '0.9rem', color: '#065f46' }}>{lastCompletedStage1.operator}</strong>
                                    </div>
                                    <div>
                                        <span style={{ fontSize: '0.8rem', color: '#047857', display: 'block' }}>Date & Time</span>
                                        <strong style={{ fontSize: '0.9rem', color: '#065f46' }}>{lastCompletedStage1.date_time}</strong>
                                    </div>
                                    <div>
                                        <span style={{ fontSize: '0.8rem', color: '#047857', display: 'block' }}>Status</span>
                                        <span className={`${styles.statusBadge} ${styles.badgeCompleted}`}>{lastCompletedStage1.status}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Stage 2 Panel */}
                {activeTab === 'stage2' && (
                    <div>
                        <h3>⏳ Step 2: Thawing Process Control</h3>
                        <div className={styles.formGrid}>
                            <div className={styles.inputGroup}>
                                <label>Select Work Order *</label>
                                <select
                                    className={styles.select}
                                    value={selectedWoId}
                                    onChange={(e) => handleSelectWo(e.target.value)}
                                >
                                    <option value="">-- Choose Work Order --</option>
                                    {eligibleWos.map(wo => (
                                        <option key={wo.id} value={wo.id}>
                                            {wo.id} - {wo.product_name} [Paste: {wo.solder_paste_barcode}]
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {woDetails && (
                            <>
                                <div className={styles.detailsContainer} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem' }}>
                                    <h4 style={{ margin: '0 0 1rem 0', color: '#0f172a', fontSize: '0.95rem', fontWeight: 700 }}>📋 Work Order Details</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                                        <div>
                                            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>Work Order ID</span>
                                            <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>{woDetails.work_order_id}</strong>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>Product Name</span>
                                            <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>{woDetails.product_name || '—'}</strong>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>Product Description</span>
                                            <span style={{ fontSize: '0.9rem', color: '#1e293b' }}>{woDetails.product_description || '—'}</span>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>Quantity</span>
                                            <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>{woDetails.quantity}</strong>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>Panel Qty</span>
                                            <span style={{ fontSize: '0.9rem', color: '#1e293b' }}>{woDetails.panel_quantity || '—'}</span>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>Line ID</span>
                                            <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>{woDetails.line_id || '—'}</strong>
                                        </div>
                                    </div>

                                    <div className={styles.detailsRow} style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
                                        <div>
                                            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>Remaining Time</span>
                                            <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>
                                                {woDetails.stage2?.status === 'In Progress'
                                                    ? formatTime(thawingRemainingMs)
                                                    : woDetails.stage2?.status === 'Ready For Mixing'
                                                        ? '00:00:00'
                                                        : '04:00:00'}
                                            </strong>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>Expected Completion Time</span>
                                            <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>
                                                {woDetails.stage2?.start_at
                                                    ? formatTimeSecondsAMPM(new Date(new Date(woDetails.stage2.start_at).getTime() + 14400000))
                                                    : 'Not Started'}
                                            </strong>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>Status</span>
                                            <span className={`${styles.statusBadge} ${woDetails.stage2?.status === 'In Progress' ? styles.badgeInProgress :
                                                    woDetails.stage2?.status === 'Ready For Mixing' ? styles.badgeReady : styles.badgePending
                                                 }`}>
                                                {woDetails.stage2?.status === 'Ready For Mixing' ? 'Completed' : (woDetails.stage2?.status || 'Pending Start')}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {woDetails.stage2?.status === 'In Progress' && (
                                    <div className={styles.timerDisplaySection}>
                                        <div className={styles.timerLabel}>🕒 Elapsed Thawing Countdown</div>
                                        <div className={styles.timerValue}>{formatTime(thawingRemainingMs)}</div>
                                        <div className={styles.timerSubtext}>
                                            The solder paste container must thaw for a minimum of 4 hours before mixing is permitted.
                                        </div>
                                    </div>
                                )}

                                {woDetails.stage2?.status === 'Ready For Mixing' && (
                                    <div className={styles.timerDisplaySection} style={{ borderColor: '#10b981', background: '#ecfdf5' }}>
                                        <div className={styles.timerLabel} style={{ color: '#047857' }}>✅ Thawing Completed</div>
                                        <div className={styles.timerValue} style={{ color: '#047857' }}>00:00:00</div>
                                        <div className={styles.timerSubtext} style={{ color: '#065f46', fontWeight: 600 }}>
                                            The 4-hour thawing timer has completed. Solder paste is ready for the mixing stage.
                                        </div>
                                    </div>
                                )}

                                <div className={styles.actionSection}>
                                    {(!woDetails.stage2?.status || woDetails.stage2?.status === 'Pending') && (
                                        <button
                                            type="button"
                                            className={styles.button}
                                            onClick={handleStage2Submit}
                                            disabled={submitting}
                                        >
                                            {submitting ? 'Starting...' : '🚀 Start Thawing Timer'}
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Stage 3 Panel */}
                {activeTab === 'stage3' && (
                    <div>
                        <h3>🌪️ Step 3: Solder Paste Mixing</h3>
                        <div className={styles.formGrid}>
                            <div className={styles.inputGroup}>
                                <label>Select Work Order *</label>
                                <select
                                    className={styles.select}
                                    value={selectedWoId}
                                    onChange={(e) => handleSelectWo(e.target.value)}
                                >
                                    <option value="">-- Choose Work Order --</option>
                                    {eligibleWos.map(wo => (
                                        <option key={wo.id} value={wo.id}>
                                            {wo.id} - {wo.product_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {woDetails && (
                            <>
                                <div className={styles.detailsContainer} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem' }}>
                                    <h4 style={{ margin: '0 0 1rem 0', color: '#0f172a', fontSize: '0.95rem', fontWeight: 700 }}>📋 Work Order Details</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                                        <div>
                                            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>Work Order ID</span>
                                            <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>{woDetails.work_order_id}</strong>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>Product Name</span>
                                            <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>{woDetails.product_name || '—'}</strong>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>Product Description</span>
                                            <span style={{ fontSize: '0.9rem', color: '#1e293b' }}>{woDetails.product_description || '—'}</span>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>Quantity</span>
                                            <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>{woDetails.quantity}</strong>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>Panel Qty</span>
                                            <span style={{ fontSize: '0.9rem', color: '#1e293b' }}>{woDetails.panel_quantity || '—'}</span>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>Line ID</span>
                                            <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>{woDetails.line_id || '—'}</strong>
                                        </div>
                                    </div>
                                    <div className={styles.detailsRow} style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
                                        <div>
                                            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>Solder Paste Barcode</span>
                                            <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>{woDetails.solder_paste_barcode}</strong>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>Thawing Completion Time</span>
                                            <strong>
                                                {woDetails.stage2?.completed_at
                                                    ? new Date(woDetails.stage2.completed_at).toLocaleString()
                                                    : woDetails.stage2?.start_at
                                                        ? new Date(new Date(woDetails.stage2.start_at).getTime() + 14400000).toLocaleString()
                                                        : 'N/A'}
                                            </strong>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>Mixing Start Time</span>
                                            <strong>{woDetails.stage3?.start_at ? new Date(woDetails.stage3.start_at).toLocaleString() : 'Not Started'}</strong>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>Status</span>
                                            <span className={`${styles.statusBadge} ${woDetails.stage3?.status === 'Completed' ? styles.badgeCompleted :
                                                    woDetails.stage3?.status === 'In Progress' ? styles.badgeInProgress : styles.badgePending
                                                }`}>
                                                {woDetails.stage3?.status || 'Pending Start'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.actionSection}>
                                    {(!woDetails.stage3?.status || woDetails.stage3?.status === 'Pending') ? (
                                        <button
                                            type="button"
                                            className={styles.button}
                                            onClick={handleStage3Start}
                                            disabled={submitting}
                                        >
                                            {submitting ? 'Starting...' : '🌪️ Start Mixing Session'}
                                        </button>
                                    ) : woDetails.stage3?.status === 'In Progress' ? (
                                        <button
                                            type="button"
                                            className={styles.button}
                                            style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)' }}
                                            onClick={handleStage3Complete}
                                            disabled={submitting}
                                        >
                                            {submitting ? 'Saving...' : '✅ Complete Mixing Process'}
                                        </button>
                                    ) : null}
                                </div>
                            </>
                        )}

                        {lastCompletedStage3 && (
                            <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#ecfdf5', border: '1px solid #10b981', borderRadius: '8px' }}>
                                <h4 style={{ color: '#065f46', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span>✅</span> Mixing Completed
                                </h4>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
                                    <div>
                                        <span style={{ fontSize: '0.8rem', color: '#047857', display: 'block' }}>Work Order ID</span>
                                        <strong style={{ fontSize: '0.9rem', color: '#065f46' }}>{lastCompletedStage3.work_order_id}</strong>
                                    </div>
                                    <div>
                                        <span style={{ fontSize: '0.8rem', color: '#047857', display: 'block' }}>Product Name</span>
                                        <strong style={{ fontSize: '0.9rem', color: '#065f46' }}>{lastCompletedStage3.product_name}</strong>
                                    </div>
                                    <div>
                                        <span style={{ fontSize: '0.8rem', color: '#047857', display: 'block' }}>Solder Paste Barcode</span>
                                        <strong style={{ fontSize: '0.9rem', color: '#065f46' }}>{lastCompletedStage3.solder_paste_barcode}</strong>
                                    </div>
                                    <div>
                                        <span style={{ fontSize: '0.8rem', color: '#047857', display: 'block' }}>Mixing Start Time</span>
                                        <strong style={{ fontSize: '0.9rem', color: '#065f46' }}>{lastCompletedStage3.mixing_start_time}</strong>
                                    </div>
                                    <div>
                                        <span style={{ fontSize: '0.8rem', color: '#047857', display: 'block' }}>Mixing Completion Time</span>
                                        <strong style={{ fontSize: '0.9rem', color: '#065f46' }}>{lastCompletedStage3.mixing_completion_time}</strong>
                                    </div>
                                    <div>
                                        <span style={{ fontSize: '0.8rem', color: '#047857', display: 'block' }}>Operator</span>
                                        <strong style={{ fontSize: '0.9rem', color: '#065f46' }}>{lastCompletedStage3.operator}</strong>
                                    </div>
                                    <div>
                                        <span style={{ fontSize: '0.8rem', color: '#047857', display: 'block' }}>Status</span>
                                        <span className={`${styles.statusBadge} ${styles.badgeCompleted}`}>{lastCompletedStage3.status}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Completed Batches Section */}
            {(() => {
                const { items, totalItems, startIndex, endIndex, totalPages } = getFilteredAndPaginatedBatches();
                const stageTitle = 
                    activeTab === 'stage1' ? 'Stage 1: Removal From Fridge' :
                    activeTab === 'stage2' ? 'Stage 2: Thawing' :
                    'Stage 3: Paste Mixing';

                const colSpanCount = activeTab === 'stage2' ? 12 : 10;

                return (
                    <div className={styles.card} style={{ marginTop: '2.5rem' }}>
                        <h3 style={{ borderBottom: '2px solid #f1f5f9', paddingBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' }}>
                            <span>📋 {stageTitle} History</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 500, padding: '0.25rem 0.75rem', backgroundColor: '#e2e8f0', color: '#475569', borderRadius: '9999px' }}>
                                Stage Separated View
                            </span>
                        </h3>

                        {/* Instant Search Bar */}
                        <div style={{ marginBottom: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', marginTop: '1rem' }}>
                            <div style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
                                <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>🔍</span>
                                <input
                                    type="text"
                                    placeholder="Search by Work Order ID, Product, or Barcode..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className={styles.input}
                                    style={{ paddingLeft: '2.25rem', width: '100%', margin: 0, height: '40px' }}
                                />
                            </div>
                            <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                                Total: <strong>{totalItems}</strong> records
                            </div>
                        </div>

                        {/* History Table */}
                        <div className={styles.tableContainer}>
                            <table className={styles.table}>
                                <thead>
                                    {activeTab === 'stage2' ? (
                                        <tr>
                                            <th>Work Order ID</th>
                                            <th>Product Name</th>
                                            <th>Product Description</th>
                                            <th>Quantity</th>
                                            <th>Panel Qty</th>
                                            <th>Line ID</th>
                                            <th>Solder Paste Barcode</th>
                                            <th>Operator Name</th>
                                            <th>Remaining Duration / Total Duration</th>
                                            <th>Expected Completion Time</th>
                                            <th>Registered Date & Time</th>
                                            <th>Status</th>
                                        </tr>
                                    ) : (
                                        <tr>
                                            <th>Work Order ID</th>
                                            <th>Product Name</th>
                                            <th>Product Description</th>
                                            <th>Quantity</th>
                                            <th>Panel Qty</th>
                                            <th>Line ID</th>
                                            <th>Solder Paste Barcode</th>
                                            <th>Operator Name</th>
                                            <th>Registered Date & Time</th>
                                            <th>Status</th>
                                        </tr>
                                    )}
                                </thead>
                                <tbody>
                                    {loadingBatches ? (
                                        <tr>
                                            <td colSpan={colSpanCount} className={styles.loading}>Loading history records...</td>
                                        </tr>
                                    ) : items.length > 0 ? (
                                        items.map((row, index) => {
                                            const op = getOperatorDetails(row);
                                            
                                            // Stage 2 Thawing details computation
                                            const durationText = activeTab === 'stage2' ? getThawingDurationText(row.solder_paste_stage2_start_at, row.solder_paste_stage2_completed_at) : '';
                                            
                                            const displayStatus = 
                                                activeTab === 'stage2' 
                                                    ? getStage2Status(row.solder_paste_stage2_start_at, row.solder_paste_stage2_completed_at)
                                                    : (row.step_status || 'Completed');

                                            const getBadgeClass = (status: string) => {
                                                if (status === 'Completed' || status === 'Ready For Mixing') return styles.badgeCompleted;
                                                if (status === 'In Progress') return styles.badgeInProgress;
                                                return styles.badgePending;
                                            };

                                            return (
                                                <tr key={row.inspection_id || index}>
                                                    <td style={{ fontWeight: 600 }}>{row.work_order_id}</td>
                                                    <td>{row.product_name || '—'}</td>
                                                    <td>{row.product_description || '—'}</td>
                                                    <td>{row.quantity || 0}</td>
                                                    <td>{row.panel_quantity || 0}</td>
                                                    <td>{row.line_id || '—'}</td>
                                                    <td>{row.solder_paste_barcode || '—'}</td>
                                                    <td>{op.name}</td>
                                                    {activeTab === 'stage2' && (
                                                        <>
                                                            <td style={{ fontWeight: 600, color: '#0284c7' }}>{durationText}</td>
                                                            <td style={{ fontWeight: 600 }}>{row.solder_paste_stage2_start_at ? formatTimeSecondsAMPM(new Date(new Date(row.solder_paste_stage2_start_at).getTime() + 14400000)) : '—'}</td>
                                                        </>
                                                    )}
                                                    <td>{formatDateTime(row.created_at)}</td>
                                                    <td>
                                                        <span className={`${styles.statusBadge} ${getBadgeClass(displayStatus)}`}>
                                                            {displayStatus}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={colSpanCount} className={styles.noData}>No records found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Bar */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', padding: '0.75rem 0', borderTop: '1px solid #f1f5f9' }}>
                            <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
                                {totalItems > 0 ? (
                                    <>Showing <strong>{startIndex + 1}-{endIndex}</strong> of <strong>{totalItems}</strong></>
                                ) : (
                                    'Showing 0-0 of 0'
                                )}
                            </span>
                            {totalPages > 1 && (
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        type="button"
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        disabled={currentPage === 1}
                                        className={styles.secondaryButton}
                                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                                    >
                                        ◀ Previous
                                    </button>
                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                        <button
                                            type="button"
                                            key={page}
                                            onClick={() => setCurrentPage(page)}
                                            className={currentPage === page ? styles.button : styles.secondaryButton}
                                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', minWidth: '2.25rem', height: '32px' }}
                                        >
                                            {page}
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                        disabled={currentPage === totalPages}
                                        className={styles.secondaryButton}
                                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
                                    >
                                        Next ▶
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default SolderPasteManagement;
