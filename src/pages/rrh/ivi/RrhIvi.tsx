import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import styles from './Ivi.module.css';
import { WorkOrderSelector } from '../../../components/WorkOrderSelector';
import { apiFetch } from '../../../utils/api';

// ─── SKU to Band Mapping (Strictly as specified) ─────────────────────────────
const SKU_TO_BAND_MAP: Record<string, string> = {
    '611-SKU000176-P': 'B1',
    '611-SKU000208-P': 'B28',
    '611-SKU000209-P': 'B41',
    '611-SKU000212-P': 'B1+B28',
    '611-SKU000222-P': 'B28',
    '611-SKU000223-P': 'B1+B28',
    '611-SKU000225-P': 'B5',
    '611-SKU000226-P': 'B5+B28',
    '611-SKU000227-P': 'B3',
    '611-SKU000228-P': 'B3+B28',
};

const getBandFromTpn = (tpn: string | null | undefined): string => {
    if (!tpn) return '—';
    const clean = tpn.trim().toUpperCase();
    return SKU_TO_BAND_MAP[clean] || SKU_TO_BAND_MAP[tpn.trim()] || '—';
};

// ─── Toaster Notification System ─────────────────────────────────────────────
interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
}

const Toaster: React.FC<{ toasts: Toast[]; onRemove: (id: number) => void }> = ({ toasts, onRemove }) => (
    <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 9999, display: 'flex', flexDirection: 'column-reverse', gap: '0.5rem' }}>
        {toasts.map(t => {
            const bg = t.type === 'error' ? '#fee2e2' : t.type === 'success' ? '#dcfce7' : t.type === 'warning' ? '#fef3c7' : '#eff6ff';
            const color = t.type === 'error' ? '#991b1b' : t.type === 'success' ? '#166534' : t.type === 'warning' ? '#92400e' : '#1e40af';
            const border = t.type === 'error' ? '#fca5a5' : t.type === 'success' ? '#86efac' : t.type === 'warning' ? '#fcd34d' : '#bfdbfe';
            const icon = t.type === 'error' ? '❌' : t.type === 'success' ? '✅' : t.type === 'warning' ? '⚠️' : 'ℹ️';

            return (
                <div key={t.id} onClick={() => onRemove(t.id)} style={{
                    padding: '0.85rem 1.25rem', borderRadius: '0.6rem', cursor: 'pointer', minWidth: '320px',
                    background: bg, color, border: `1px solid ${border}`,
                    fontWeight: 600, fontSize: '0.9rem', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                    <span>{icon}</span>
                    <span>{t.message}</span>
                </div>
            );
        })}
    </div>
);

// ─── Interfaces ──────────────────────────────────────────────────────────────
interface EligibleWorkOrder {
    id?: number | string;
    work_order_id: string;
    work_order_number?: string;
    work_order_date?: string;
    date?: string;
    lot_quantity?: number;
    status?: string;
}

interface IviSession {
    id: number | string;
    work_order_id: string;
    status: string; // In Progress, Completed, Paused, Aborted
    created_by: string;
    created_by_name: string;
    created_at: string;
    updated_at?: string;
    lot_quantity?: number;
    work_order_date?: string;
    date?: string;
}

interface FetchedSerialDetails {
    serial_number: string;
    band_serial_no: string;
    work_order_no: string;
    wo_date: string;
    tejas_dc_no: string;
    tejas_obd_no: string;
    bat_lot_no: string;
    physical_tpn: string;
    band: string;
    source?: string;
    sl_no?: string | number | null;
    inward_scan_id?: number;
    inward_scanned_by?: string;
    inward_scanned_at?: string;
    already_inspected?: boolean;
    previous_inspection?: any;
}

interface RemainingInwardMasterRecord {
    id: number | string;
    inward_scan_id: number;
    work_order_id: string;
    serial_number: string;
    band_serial_no: string;
    physical_tpn: string;
    band: string;
    sl_no?: string | number | null;
    inward_scanned_by?: string;
    inward_scanned_at?: string;
    tejas_dc_no?: string;
    tejas_obd_no?: string;
    bat_lot_no?: string;
    wo_date?: string;
    global_row_number?: number;
}

interface InspectionRecord {
    id: number | string;
    session_id: number | string;
    work_order_id: string;
    serial_number: string;
    band_serial_no?: string;
    sl_no?: string | number | null;
    tejas_dc_no: string | null;
    tejas_obd_no: string | null;
    bat_lot_no: string | null;
    physical_tpn: string | null;
    band: string | null;
    wo_date: string | null;
    duplexer_main: string;
    duplexer_part_no: string;
    rrh_unit: string | null;
    image_urls?: string[];
    status: 'PASS' | 'FAIL';
    remarks: string | null;
    scanned_by: string;
    scanned_at: string;
}

interface SessionStats {
    lotQuantity: number;
    totalInwarded?: number;
    remainingInward?: number;
    passed: number;
    failed: number;
    pending: number;
    total: number;
    yield: string | number;
}

// ─── Visual Inspection Checkpoints Definition ─────────────────────────────────
export interface CheckpointDef {
    id: number;
    title: string;
    description: string;
}

export const IVI_CHECKPOINTS: CheckpointDef[] = [
    {
        id: 1,
        title: 'Caps Verification',
        description: 'Verify that all required caps are available and properly fitted.'
    },
    {
        id: 2,
        title: 'Ports & Connectors',
        description: 'Verify that all antenna ports, PWR connectors, and OPT connectors are available, properly fitted, and free from damage.'
    },
    {
        id: 3,
        title: 'Required Screws',
        description: 'Verify that all required screws are available, properly tightened, and free from damage.'
    },
    {
        id: 4,
        title: 'Specified Screws & Hardware',
        description: 'Verify that all specified screws and hardware are available and properly secured.'
    },
    {
        id: 5,
        title: 'Unit Painting & Chassis Cleanliness',
        description: 'Verify that the unit painting is proper and the chassis is clean, dust-free, and free from visible damage.'
    },
    {
        id: 6,
        title: 'Unit Labels Verification',
        description: 'Verify that all required unit labels are available, properly positioned, legible, and match the applicable unit details.'
    }
];

export interface CheckpointRecord {
    id: number;
    title: string;
    description: string;
    status: 'PASS' | 'FAIL' | null;
    remark: string;
    confirmed: boolean;
}

export const createInitialCheckpoints = (): CheckpointRecord[] =>
    IVI_CHECKPOINTS.map(cp => ({
        ...cp,
        status: null,
        remark: '',
        confirmed: false
    }));

export const RrhIvi: React.FC = () => {
    // ─── Toaster State ───────────────────────────────────────────────────────
    const [toasts, setToasts] = useState<Toast[]>([]);
    const toastId = useRef(0);
    const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
        const id = ++toastId.current;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
    }, []);
    const removeToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

    // ─── Session Setup State ─────────────────────────────────────────────────
    const [eligibleWos, setEligibleWos] = useState<EligibleWorkOrder[]>([]);
    const [selectedWoId, setSelectedWoId] = useState('');
    const [selectedWoDetails, setSelectedWoDetails] = useState<{
        workOrderNumber: string;
        dateTime: string | null;
        lotQuantity: number;
        remainingLotQuantity?: number;
    } | null>(null);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [detailsError, setDetailsError] = useState('');

    // Sessions Tables State
    const [activeSessionsList, setActiveSessionsList] = useState<IviSession[]>([]);
    const [completedSessionsList, setCompletedSessionsList] = useState<IviSession[]>([]);
    const [sessionsLoading, setSessionsLoading] = useState(false);

    // Active pagination & search
    const [activePage, setActivePage] = useState(1);
    const [activeLimit, setActiveLimit] = useState(5);
    const [activeSearch, setActiveSearch] = useState('');
    const [activeTotal, setActiveTotal] = useState(0);

    // Completed pagination & search
    const [completedPage, setCompletedPage] = useState(1);
    const [completedLimit, setCompletedLimit] = useState(5);
    const [completedSearch, setCompletedSearch] = useState('');
    const [completedTotal, setCompletedTotal] = useState(0);

    // ─── Active Session State ────────────────────────────────────────────────
    const [activeSession, setActiveSession] = useState<IviSession | null>(null);
    const [stats, setStats] = useState<SessionStats>({
        lotQuantity: 0,
        passed: 0,
        failed: 0,
        pending: 0,
        total: 0,
        yield: '0.00'
    });

    // ─── Inspection Form State ───────────────────────────────────────────────
    const [serialInput, setSerialInput] = useState('');
    const [isFetchingSerial, setIsFetchingSerial] = useState(false);
    const [fetchedSerial, setFetchedSerial] = useState<FetchedSerialDetails | null>(null);

    // Form inputs (Duplexer Make & RRH Unit Defect)
    const [duplexerMain, setDuplexerMain] = useState('');
    const [duplexerPartNo, setDuplexerPartNo] = useState('');
    const [rrhUnit, setRrhUnit] = useState('');
    const [statusVal, setStatusVal] = useState<'PASS' | 'FAIL'>('PASS');
    const [remarksVal, setRemarksVal] = useState('');
    const [selectedImages, setSelectedImages] = useState<File[]>([]);
    const [isCompressing, setIsCompressing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // ─── Visual Inspection Checkpoints State ─────────────────────────────────
    const [checkpoints, setCheckpoints] = useState<CheckpointRecord[]>(createInitialCheckpoints);
    const [activeCpIndex, setActiveCpIndex] = useState(0);
    const [currentCpStatus, setCurrentCpStatus] = useState<'PASS' | 'FAIL' | null>(null);
    const [currentCpRemark, setCurrentCpRemark] = useState('');

    const handleSelectCpStatus = (st: 'PASS' | 'FAIL') => {
        setCurrentCpStatus(st);
        if (st === 'PASS') {
            setCurrentCpRemark('');
        }
    };

    const handleConfirmCurrentCheckpoint = () => {
        if (!currentCpStatus) {
            addToast('Please select Pass or Fail before confirming.', 'warning');
            return;
        }

        if (currentCpStatus === 'FAIL' && !currentCpRemark.trim()) {
            addToast('Please explain why this checkpoint failed.', 'warning');
            return;
        }

        const updated = checkpoints.map((cp, idx) => {
            if (idx === activeCpIndex) {
                return {
                    ...cp,
                    status: currentCpStatus,
                    remark: currentCpStatus === 'PASS' ? 'no defect' : currentCpRemark.trim(),
                    confirmed: true
                };
            }
            return cp;
        });

        setCheckpoints(updated);

        // Update RRH Unit Defect and Status based on all confirmed checkpoints
        const failedCps = updated.filter(c => c.status === 'FAIL');
        if (failedCps.length === 0) {
            setRrhUnit('no defect');
            setStatusVal('PASS');
        } else {
            const defectText = failedCps.map(c => c.remark.trim()).filter(Boolean).join('; ');
            setRrhUnit(defectText);
            setStatusVal('FAIL');
        }

        // Advance to next checkpoint if available
        if (activeCpIndex < IVI_CHECKPOINTS.length - 1) {
            const nextIdx = activeCpIndex + 1;
            setActiveCpIndex(nextIdx);
            const nextCp = updated[nextIdx];
            setCurrentCpStatus(nextCp.status);
            setCurrentCpRemark(nextCp.status === 'FAIL' ? nextCp.remark : '');
            addToast(`Checkpoint ${activeCpIndex + 1} confirmed. Advancing to Checkpoint ${nextIdx + 1}.`, 'success');
        } else {
            addToast('All 6 checkpoints confirmed.', 'success');
        }
    };

    const handleJumpToCp = (index: number) => {
        setActiveCpIndex(index);
        const target = checkpoints[index];
        setCurrentCpStatus(target.status);
        setCurrentCpRemark(target.status === 'FAIL' ? target.remark : '');
    };

    // Recent inspections table state
    const [recentInspections, setRecentInspections] = useState<InspectionRecord[]>([]);
    const [inspectionSearch, setInspectionSearch] = useState('');
    const [isExporting, setIsExporting] = useState(false);
    const [viewingImages, setViewingImages] = useState<{ serial: string; images: string[] } | null>(null);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);

    // Filter recent inspections by search query
    const filteredRecentInspections = useMemo(() => {
        if (!inspectionSearch.trim()) return recentInspections;
        const q = inspectionSearch.trim().toLowerCase();
        return recentInspections.filter(item => {
            return (
                (item.band_serial_no && item.band_serial_no.toLowerCase().includes(q)) ||
                (item.serial_number && item.serial_number.toLowerCase().includes(q)) ||
                (item.physical_tpn && item.physical_tpn.toLowerCase().includes(q)) ||
                (item.tejas_dc_no && item.tejas_dc_no.toLowerCase().includes(q)) ||
                (item.tejas_obd_no && item.tejas_obd_no.toLowerCase().includes(q)) ||
                (item.band && item.band.toLowerCase().includes(q)) ||
                (item.duplexer_main && item.duplexer_main.toLowerCase().includes(q)) ||
                (item.duplexer_part_no && item.duplexer_part_no.toLowerCase().includes(q)) ||
                (item.rrh_unit && item.rrh_unit.toLowerCase().includes(q)) ||
                (item.status && item.status.toLowerCase().includes(q)) ||
                (item.remarks && item.remarks.toLowerCase().includes(q)) ||
                (item.scanned_by && item.scanned_by.toLowerCase().includes(q))
            );
        });
    }, [recentInspections, inspectionSearch]);

    // Remaining Inward Master Data List State
    const [remainingMasterData, setRemainingMasterData] = useState<RemainingInwardMasterRecord[]>([]);
    const [remainingTotal, setRemainingTotal] = useState(0);
    const [remainingPage, setRemainingPage] = useState(1);
    const [remainingLimit, setRemainingLimit] = useState(10);
    const [remainingSearch, setRemainingSearch] = useState('');
    const [remainingLoading, setRemainingLoading] = useState(false);

    const serialInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Image Helpers
    const parseImages = (urls: any): string[] => {
        if (!urls) return [];
        if (Array.isArray(urls)) return urls.filter(Boolean);
        if (typeof urls === 'string') {
            try {
                const parsed = JSON.parse(urls);
                if (Array.isArray(parsed)) return parsed.filter(Boolean);
            } catch {
                if (urls.trim().startsWith('/uploads') || urls.trim().startsWith('http')) {
                    return [urls.trim()];
                }
            }
        }
        return [];
    };

    const handleDownloadImage = async (imgUrl: string, fileName?: string) => {
        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch(imgUrl, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (!res.ok) throw new Error('Failed to fetch image file.');
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const name = fileName || imgUrl.split('/').pop() || 'ivi_photo.jpg';
            a.download = name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            addToast('Photo downloaded successfully.', 'success');
        } catch (err: any) {
            window.open(imgUrl, '_blank');
        }
    };

    // Formatters
    const formatTimestamp = (dStr: string | null | undefined) => {
        if (!dStr) return '—';
        return new Date(dStr).toLocaleString('en-IN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    };

    const formatWoDateTime = (rawDateTime?: string | null) => {
        if (!rawDateTime) return '—';
        try {
            const cleanStr = typeof rawDateTime === 'string' && rawDateTime.includes(' ') && !rawDateTime.includes('T')
                ? rawDateTime.replace(' ', 'T')
                : rawDateTime;
            const d = new Date(cleanStr);
            if (!isNaN(d.getTime())) {
                return d.toLocaleDateString('en-GB'); // DD/MM/YYYY
            }
        } catch { }
        return String(rawDateTime);
    };

    // ─── 1. Load Work Orders for Dropdown ────────────────────────────────────
    const fetchEligibleWorkOrders = useCallback(async () => {
        try {
            const response = await apiFetch('/api/rrh/work-orders?limit=all');
            const list: EligibleWorkOrder[] = response?.data || (Array.isArray(response) ? response : []);
            setEligibleWos(list);
        } catch (err: any) {
            console.error('Failed to load eligible RRH work orders:', err);
            addToast('Failed to load eligible work orders.', 'error');
        }
    }, [addToast]);

    // ─── 2. Fetch Sessions Lists ─────────────────────────────────────────────
    const fetchActiveSessions = useCallback(async (page = activePage, limit = activeLimit, search = activeSearch) => {
        setSessionsLoading(true);
        try {
            const params = new URLSearchParams({
                status: 'In Progress,Pending,Paused',
                page: String(page),
                limit: String(limit),
                search
            });
            const res = await apiFetch(`/api/rrh/ivi/sessions?${params}`);
            setActiveSessionsList(res.sessions || []);
            setActiveTotal(res.total || 0);
        } catch (err: any) {
            console.error('Failed to fetch active IVI sessions:', err);
        } finally {
            setSessionsLoading(false);
        }
    }, [activePage, activeLimit, activeSearch]);

    const fetchCompletedSessions = useCallback(async (page = completedPage, limit = completedLimit, search = completedSearch) => {
        try {
            const params = new URLSearchParams({
                status: 'Completed',
                page: String(page),
                limit: String(limit),
                search
            });
            const res = await apiFetch(`/api/rrh/ivi/sessions?${params}`);
            setCompletedSessionsList(res.sessions || []);
            setCompletedTotal(res.total || 0);
        } catch (err: any) {
            console.error('Failed to fetch completed IVI sessions:', err);
        }
    }, [completedPage, completedLimit, completedSearch]);

    const fetchSessionsLists = useCallback(() => {
        fetchActiveSessions();
        fetchCompletedSessions();
    }, [fetchActiveSessions, fetchCompletedSessions]);

    useEffect(() => {
        fetchEligibleWorkOrders();
        fetchSessionsLists();
    }, [fetchEligibleWorkOrders, fetchSessionsLists]);

    // ─── 3. Handle Work Order Select ─────────────────────────────────────────
    const handleWorkOrderSelect = async (woId: string) => {
        setSelectedWoId(woId);
        if (!woId) {
            setSelectedWoDetails(null);
            setDetailsError('');
            return;
        }

        setDetailsLoading(true);
        setDetailsError('');

        const localWo = eligibleWos.find((w: any) => w.work_order_id === woId || w.id?.toString() === woId);
        let woNum = localWo?.work_order_id || woId;
        let woDate = localWo?.work_order_date || localWo?.date || (localWo as any)?.created_at || null;
        let lotQty = Number(localWo?.lot_quantity) || 0;

        if (localWo && lotQty > 0) {
            setSelectedWoDetails({
                workOrderNumber: woNum,
                dateTime: woDate,
                lotQuantity: lotQty
            });
            setDetailsLoading(false);
        }

        try {
            const res = await apiFetch(`/api/rrh/work-orders/${encodeURIComponent(woId)}`);
            const data = res?.data || res?.workOrder || res;
            if (data && (data.work_order_id || data.id)) {
                woNum = data.work_order_id || String(data.id);
                woDate = data.work_order_date || data.date || data.created_at || woDate;
                lotQty = Number(data.lot_quantity) || lotQty;
            }

            // Check if there is an active session to calculate remaining lot quantity
            let remQty: number | undefined = undefined;
            try {
                const sessionRes = await apiFetch(`/api/rrh/ivi/sessions?search=${encodeURIComponent(woNum)}&limit=1`);
                if (sessionRes?.sessions && sessionRes.sessions.length > 0) {
                    const sid = sessionRes.sessions[0].id;
                    const statsRes = await apiFetch(`/api/rrh/ivi/sessions/${sid}`);
                    if (statsRes?.stats) {
                        remQty = statsRes.stats.pending;
                    }
                }
            } catch { }

            setSelectedWoDetails({
                workOrderNumber: woNum,
                dateTime: woDate,
                lotQuantity: lotQty,
                remainingLotQuantity: remQty !== undefined ? remQty : lotQty
            });
        } catch (err: any) {
            if (!localWo) {
                setDetailsError(err.message || 'Failed to load Work Order details.');
                addToast('Error loading work order details', 'error');
                setSelectedWoDetails(null);
            }
        } finally {
            setDetailsLoading(false);
        }
    };

    // ─── 4. Start New IVI Session ────────────────────────────────────────────
    const handleStartSession = async () => {
        if (!selectedWoId) {
            addToast('Please select a Work Order first.', 'warning');
            return;
        }

        try {
            const session = await apiFetch('/api/rrh/ivi/sessions', {
                method: 'POST',
                body: JSON.stringify({ work_order_id: selectedWoId })
            });

            addToast(`IVI session ready for Work Order ${selectedWoId}`, 'success');
            setActiveSession({
                ...session,
                lot_quantity: selectedWoDetails?.lotQuantity,
                work_order_date: selectedWoDetails?.dateTime || undefined
            });
            fetchSessionsLists();
        } catch (err: any) {
            addToast(`Failed to start session: ${err.message}`, 'error');
        }
    };

    // ─── 5. Fetch Live Remaining Inward Master Data ──────────────────────────
    const fetchRemainingMasterData = useCallback(async (
        sessionId: number | string,
        pageVal = remainingPage,
        limitVal = remainingLimit,
        searchVal = remainingSearch
    ) => {
        setRemainingLoading(true);
        try {
            const query = new URLSearchParams({
                page: String(pageVal),
                limit: String(limitVal),
                ...(searchVal ? { search: searchVal } : {})
            });
            const res = await apiFetch(`/api/rrh/ivi/sessions/${sessionId}/remaining-master-data?${query}`);
            if (res && res.data) {
                setRemainingMasterData(res.data || []);
                setRemainingTotal(res.total || 0);
            }
        } catch (err: any) {
            console.error('Error loading remaining inward master data:', err);
        } finally {
            setRemainingLoading(false);
        }
    }, [remainingPage, remainingLimit, remainingSearch]);

    // ─── 5b. Load Active Session Data, Recent Inspections, and Remaining Inward Units ────
    const fetchSessionData = useCallback(async (sessionId: string | number) => {
        try {
            // Fetch session & stats
            const res = await apiFetch(`/api/rrh/ivi/sessions/${sessionId}`);
            if (res.session) {
                setActiveSession(res.session);
            }
            if (res.stats) {
                setStats(res.stats);
            }

            // Fetch recent inspections (strictly most recent at the top)
            const inspections = await apiFetch(`/api/rrh/ivi/sessions/${sessionId}/inspections`);
            if (Array.isArray(inspections)) {
                const sorted = [...inspections].sort((a, b) => {
                    const timeA = new Date(a.scanned_at || 0).getTime();
                    const timeB = new Date(b.scanned_at || 0).getTime();
                    if (timeB !== timeA) return timeB - timeA;
                    return (Number(b.id) || 0) - (Number(a.id) || 0);
                });
                setRecentInspections(sorted);
            }

            // Fetch remaining inward units
            fetchRemainingMasterData(sessionId, remainingPage, remainingLimit, remainingSearch);
        } catch (err: any) {
            console.error('Failed to load session data:', err);
        }
    }, [fetchRemainingMasterData, remainingPage, remainingLimit, remainingSearch]);

    useEffect(() => {
        if (activeSession?.id) {
            fetchSessionData(activeSession.id);
            fetchRemainingMasterData(activeSession.id, 1, remainingLimit, '');
            if (activeSession.work_order_id && (!selectedWoDetails || selectedWoDetails.workOrderNumber !== activeSession.work_order_id)) {
                handleWorkOrderSelect(activeSession.work_order_id);
            }
            // Auto focus serial input
            setTimeout(() => {
                serialInputRef.current?.focus();
            }, 100);
        }
    }, [activeSession?.id]);

    // ─── 6. Lookup Scanned Serial Number Details (From RRH Inward Scanned Logs) ────
    const handleLookupSerial = async (serialToLookup: string) => {
        const clean = serialToLookup.trim();
        if (!clean) return;

        setIsFetchingSerial(true);
        try {
            const params = new URLSearchParams({
                serial: clean,
                work_order_id: activeSession?.work_order_id || selectedWoDetails?.workOrderNumber || ''
            });

            const data = await apiFetch(`/api/rrh/ivi/lookup?${params}`);
            if (data.found) {
                setFetchedSerial(data);
                if (data.already_inspected) {
                    addToast(`Warning: Serial "${clean}" was already inspected in IVI (${data.previous_inspection?.status || 'recorded'}).`, 'warning');
                } else {
                    addToast(`Details retrieved from RRH Inward for serial "${clean}"`, 'success');
                }
            } else {
                setFetchedSerial(null);
                addToast(data.message || `Serial "${clean}" not found in RRH Inward scanned logs.`, 'warning');
            }
        } catch (err: any) {
            setFetchedSerial(null);
            addToast(err.message || `Serial "${clean}" not found in RRH Inward scanned logs.`, 'error');
        } finally {
            setIsFetchingSerial(false);
        }
    };

    // ─── 6b. Select Unit from Remaining Inward Table to Inspect ──────────────
    const handleSelectRemainingUnit = (itemOrSerial: RemainingInwardMasterRecord | string) => {
        const serial = typeof itemOrSerial === 'string' ? itemOrSerial : (itemOrSerial.band_serial_no || itemOrSerial.serial_number);
        setSerialInput(serial);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        handleLookupSerial(serial);
    };

    // ─── 7. Clear Serial Input & Form ────────────────────────────────────────
    const handleClear = () => {
        setSerialInput('');
        setFetchedSerial(null);
        setDuplexerMain('');
        setDuplexerPartNo('');
        setRrhUnit('');
        setStatusVal('PASS');
        setRemarksVal('');
        setSelectedImages([]);
        setCheckpoints(createInitialCheckpoints());
        setActiveCpIndex(0);
        setCurrentCpStatus(null);
        setCurrentCpRemark('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        serialInputRef.current?.focus();
    };

    // ─── 8. Image Compression & Selection (Max 6 photos, Max Compression under 600KB) ──
    const compressImageFile = (file: File): Promise<File> => {
        return new Promise((resolve) => {
            if (!file.type.startsWith('image/')) {
                resolve(file);
                return;
            }

            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    // Scale to max 1280px edge to minimize storage while keeping text legible
                    const MAX_EDGE = 1280;
                    if (width > MAX_EDGE || height > MAX_EDGE) {
                        if (width > height) {
                            height = Math.round((height * MAX_EDGE) / width);
                            width = MAX_EDGE;
                        } else {
                            width = Math.round((width * MAX_EDGE) / height);
                            height = MAX_EDGE;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        resolve(file);
                        return;
                    }

                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'medium';
                    ctx.drawImage(img, 0, 0, width, height);

                    // Max compression: 0.55 quality produces minimal size (~20-45KB) for storage
                    canvas.toBlob(
                        (blob) => {
                            if (!blob) {
                                resolve(file);
                            } else {
                                const newName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
                                const compressedFile = new File([blob], newName, {
                                    type: 'image/jpeg',
                                    lastModified: Date.now()
                                });
                                resolve(compressedFile.size < file.size ? compressedFile : file);
                            }
                        },
                        'image/jpeg',
                        0.55
                    );
                };
                img.onerror = () => resolve(file);
            };
            reader.onerror = () => resolve(file);
        });
    };

    const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const MAX_TOTAL = 6;
        const MAX_BYTES = 600 * 1024; // 600 KB
        const rawFiles = Array.from(files);

        // Reject images > 600 KB
        const oversized = rawFiles.filter(f => f.size > MAX_BYTES);
        if (oversized.length > 0) {
            addToast('Upload image under 600 KB', 'warning');
        }

        const validFiles = rawFiles.filter(f => f.size <= MAX_BYTES);
        if (validFiles.length === 0) {
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        const currentCount = selectedImages.length;
        const availableSlots = MAX_TOTAL - currentCount;

        if (availableSlots <= 0) {
            addToast(`Maximum ${MAX_TOTAL} images allowed per inspection. Please remove an existing image first.`, 'warning');
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        const filesToProcess = validFiles.slice(0, availableSlots);
        if (validFiles.length > availableSlots) {
            addToast(`Only ${availableSlots} more image(s) can be added (Maximum ${MAX_TOTAL} images). Extra images were omitted.`, 'warning');
        }

        setIsCompressing(true);
        try {
            const compressedResults = await Promise.all(filesToProcess.map(compressImageFile));
            setSelectedImages(prev => [...prev, ...compressedResults].slice(0, MAX_TOTAL));
            addToast(`${compressedResults.length} image(s) compressed and attached successfully.`, 'success');
        } catch (err) {
            console.error('Image compression error:', err);
            addToast('Error compressing some images.', 'warning');
        } finally {
            setIsCompressing(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const removeImage = (index: number) => {
        setSelectedImages(prev => prev.filter((_, i) => i !== index));
    };

    // ─── 9. Submit Inspection ────────────────────────────────────────────────
    const handleSubmitInspection = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!activeSession?.id) {
            addToast('No active session.', 'error');
            return;
        }

        if (!serialInput.trim()) {
            addToast('Please scan or enter a Serial Number.', 'warning');
            serialInputRef.current?.focus();
            return;
        }

        if (!duplexerMain.trim()) {
            addToast('Duplexer Make is required.', 'warning');
            return;
        }

        if (!duplexerPartNo.trim()) {
            addToast('Duplexer Part No. is required.', 'warning');
            return;
        }

        // Validate: number and alphabets mix
        const cleanPartNo = duplexerPartNo.trim();
        const hasLetter = /[a-zA-Z]/.test(cleanPartNo);
        const hasNumber = /[0-9]/.test(cleanPartNo);
        if (!hasLetter || !hasNumber) {
            addToast('Duplexer Part No. must contain a mix of numbers and alphabets.', 'error');
            return;
        }

        // Checkpoints verification check
        const allCpConfirmed = checkpoints.every(c => c.confirmed);
        if (!allCpConfirmed) {
            addToast('Please complete and confirm all 6 inspection checkpoints before submitting.', 'warning');
            return;
        }

        if (isCompressing) {
            addToast('Please wait for images to finish compressing.', 'warning');
            return;
        }

        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('work_order_id', activeSession.work_order_id);
            formData.append('serial_number', serialInput.trim().toUpperCase());
            formData.append('duplexer_make', duplexerMain.trim());
            formData.append('duplexer_main', duplexerMain.trim());
            formData.append('duplexer_part_no', cleanPartNo);
            if (rrhUnit.trim()) {
                formData.append('rrh_unit', rrhUnit.trim());
                formData.append('rrh_unit_defect', rrhUnit.trim());
            }
            formData.append('status', statusVal);
            if (remarksVal.trim()) formData.append('remarks', remarksVal.trim());

            // Fetched metadata
            if (fetchedSerial) {
                if (fetchedSerial.sl_no) formData.append('sl_no', String(fetchedSerial.sl_no));
                if (fetchedSerial.band_serial_no) formData.append('band_serial_no', fetchedSerial.band_serial_no);
                if (fetchedSerial.inward_scan_id) formData.append('inward_scan_id', String(fetchedSerial.inward_scan_id));
                if (fetchedSerial.tejas_dc_no) formData.append('tejas_dc_no', fetchedSerial.tejas_dc_no);
                if (fetchedSerial.tejas_obd_no) formData.append('tejas_obd_no', fetchedSerial.tejas_obd_no);
                if (fetchedSerial.bat_lot_no) formData.append('bat_lot_no', fetchedSerial.bat_lot_no);
                if (fetchedSerial.physical_tpn) formData.append('physical_tpn', fetchedSerial.physical_tpn);
                if (fetchedSerial.band) formData.append('band', fetchedSerial.band);
                if (fetchedSerial.wo_date) formData.append('wo_date', fetchedSerial.wo_date);
            }

            // Append images (max 6 images)
            for (const img of selectedImages.slice(0, 6)) {
                formData.append('images', img);
            }

            await apiFetch(`/api/rrh/ivi/sessions/${activeSession.id}/inspections`, {
                method: 'POST',
                body: formData
            });

            addToast(`Inspection submitted successfully with status: ${statusVal}`, 'success');

            // Refresh recent inspections & stats
            fetchSessionData(activeSession.id);

            // Reset form for next serial
            handleClear();
        } catch (err: any) {
            addToast(err.message || 'Failed to submit inspection.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    // ─── 10. Export to Excel ─────────────────────────────────────────────────
    const handleExportExcel = async (customSessionId?: string | number, customWoId?: string) => {
        const sId = customSessionId || activeSession?.id;
        const woId = customWoId || activeSession?.work_order_id || 'Unknown';
        if (!sId) return;
        setIsExporting(true);
        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch(`/api/rrh/ivi/sessions/${sId}/export`, {
                headers: {
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                }
            });

            if (!res.ok) throw new Error('Failed to export inspections.');

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `RRH_IVI_Inspections_${woId}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            addToast('Excel export downloaded successfully.', 'success');
        } catch (err: any) {
            addToast(err.message || 'Failed to export Excel.', 'error');
        } finally {
            setIsExporting(false);
        }
    };


    // ─── 11. Delete Session ──────────────────────────────────────────────────
    const handleDeleteSession = async (sessionId: string | number, woId: string) => {
        if (!window.confirm(`Are you sure you want to delete the IVI Session for Work Order "${woId}"? This action will remove the session.`)) return;

        try {
            await apiFetch(`/api/rrh/ivi/sessions/${sessionId}`, { method: 'DELETE' });
            addToast(`IVI session for Work Order "${woId}" deleted successfully.`, 'success');
            fetchSessionsLists();
            if (activeSession?.id === sessionId) {
                setActiveSession(null);
            }
        } catch (err: any) {
            addToast(err.message || `Failed to delete session: ${err.message}`, 'error');
        }
    };

    // Helper for Status Badge
    const getStatusBadge = (status: string) => {
        const s = (status || '').toUpperCase();
        if (s === 'PASS' || s === 'COMPLETED') {
            return <span className={styles.badgePass}>{status}</span>;
        } else if (s === 'FAIL' || s === 'ABORTED' || s === 'CANCELLED') {
            return <span className={styles.badgeFail}>{status}</span>;
        } else {
            return <span className={styles.badgeProgress}>{status}</span>;
        }
    };

    return (
        <div className={styles.container}>
            <Toaster toasts={toasts} onRemove={removeToast} />

            <div className={styles.header}>
                <h2>RRH IVI (Initial Visual Inspection)</h2>
                <p>Perform and record initial visual inspections for RRH mechanical parts and assemblies.</p>
            </div>

            {!activeSession ? (
                /* ─── VIEW 1: SESSION SETUP & HISTORY ────────────────────────── */
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
                    {/* Work Order Selector Card */}
                    <div className={styles.card} style={{ marginBottom: '0' }}>
                        <h3>Select Work Order</h3>
                        <div className={styles.inputGroup} style={{ maxWidth: '480px' }}>
                            <WorkOrderSelector
                                options={eligibleWos}
                                value={selectedWoId}
                                onChange={handleWorkOrderSelect}
                                placeholder="-- Select Eligible RRH Work Order --"
                                valueKey="work_order_id"
                                labelKey="work_order_id"
                                quantityKey="lot_quantity"
                                required
                            />
                        </div>
                    </div>

                    {/* Selected Work Order Details Panel */}
                    {detailsLoading ? (
                        <div className={styles.card} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                            <div style={{ display: 'inline-block', width: '2rem', height: '2rem', border: '3px solid #cbd5e1', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '0.5rem' }}></div>
                            <p style={{ margin: '0' }}>Loading Work Order details...</p>
                        </div>
                    ) : selectedWoDetails ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div className={styles.infoPanel}>
                                <div className={styles.infoPanelTitle}>
                                    Work Order Information
                                </div>
                                <div className={styles.infoPanelGrid}>
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                        gap: '1.5rem',
                                        alignItems: 'center'
                                    }}>
                                        <div className={styles.infoItem}>
                                            <span className={styles.infoLabel}>Work Order Number</span>
                                            <span className={styles.infoValue} style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>
                                                {selectedWoDetails.workOrderNumber}
                                            </span>
                                        </div>
                                        <div className={styles.infoItem}>
                                            <span className={styles.infoLabel}>Work Order Date</span>
                                            <span className={styles.infoValue} style={{ fontSize: '1.05rem' }}>
                                                {formatWoDateTime(selectedWoDetails.dateTime)}
                                            </span>
                                        </div>
                                        <div className={styles.infoItem}>
                                            <span className={styles.infoLabel}>Lot Quantity</span>
                                            <span className={styles.infoValue} style={{ fontSize: '1.25rem', fontWeight: 800, color: '#4f46e5' }}>
                                                {selectedWoDetails.lotQuantity}
                                            </span>
                                        </div>
                                        <div className={styles.infoItem}>
                                            <span className={styles.infoLabel}>Remaining Lot Quantity</span>
                                            <span className={styles.infoValue} style={{ fontSize: '1.25rem', fontWeight: 800, color: '#d97706' }}>
                                                {selectedWoDetails.remainingLotQuantity ?? selectedWoDetails.lotQuantity}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                                <button
                                    onClick={handleStartSession}
                                    className={styles.button}
                                    style={{ padding: '0.85rem 3rem', fontSize: '1.05rem', letterSpacing: '0.5px' }}
                                >
                                    Start IVI Session
                                </button>
                            </div>
                        </div>
                    ) : detailsError ? (
                        <div className={styles.card} style={{ padding: '2rem', textAlign: 'center', color: '#dc2626', borderColor: '#fca5a5', backgroundColor: '#fef2f2' }}>
                            <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>⚠️</span>
                            {detailsError}
                        </div>
                    ) : (
                        <div className={styles.card} style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b', border: '1px dashed #cbd5e1' }}>
                            Please select an eligible RRH Work Order to view Lot Quantity and start an IVI session.
                        </div>
                    )}

                    {/* Active Sessions Panel */}
                    <div className={styles.card}>
                        <h3>Active IVI Sessions</h3>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1, maxWidth: '400px' }}>
                                <input
                                    type="text"
                                    className={styles.input}
                                    placeholder="Search active sessions by WO ID..."
                                    value={activeSearch}
                                    onChange={e => setActiveSearch(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { setActivePage(1); fetchActiveSessions(1, activeLimit, activeSearch); } }}
                                    style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                                />
                                <button
                                    className={styles.button}
                                    onClick={() => { setActivePage(1); fetchActiveSessions(1, activeLimit, activeSearch); }}
                                    style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                                >
                                    Search
                                </button>
                                {activeSearch && (
                                    <button
                                        className={styles.secondaryButton}
                                        onClick={() => { setActiveSearch(''); setActivePage(1); fetchActiveSessions(1, activeLimit, ''); }}
                                        style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.85rem', color: '#64748b' }}>
                                <span>Show</span>
                                <select
                                    className={styles.select}
                                    value={activeLimit}
                                    onChange={e => {
                                        const newLimit = parseInt(e.target.value);
                                        setActiveLimit(newLimit);
                                        setActivePage(1);
                                        fetchActiveSessions(1, newLimit, activeSearch);
                                    }}
                                    style={{ padding: '0.35rem 1.5rem 0.35rem 0.75rem', width: 'auto', fontSize: '0.85rem' }}
                                >
                                    <option value={5}>5</option>
                                    <option value={10}>10</option>
                                    <option value={20}>20</option>
                                </select>
                                <span>entries</span>
                            </div>
                        </div>

                        {sessionsLoading ? (
                            <div style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>Loading sessions...</div>
                        ) : (
                            <>
                                <div className={styles.tableContainer}>
                                    <table className={styles.table}>
                                        <thead>
                                            <tr>
                                                <th>Work Order Number</th>
                                                <th>Started By</th>
                                                <th>Started At</th>
                                                <th>Status</th>
                                                <th>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {activeSessionsList.map(session => (
                                                <tr key={session.id}>
                                                    <td style={{ fontWeight: 700, color: '#4f46e5' }}>{session.work_order_id}</td>
                                                    <td>{session.created_by_name || session.created_by || '—'}</td>
                                                    <td style={{ fontSize: '0.85rem', color: '#64748b' }}>{formatTimestamp(session.created_at)}</td>
                                                    <td>{getStatusBadge(session.status)}</td>
                                                    <td style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                        <button
                                                            className={styles.secondaryButton}
                                                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', backgroundColor: '#eef2ff', color: '#4338ca', borderColor: '#c7d2fe', fontWeight: 600 }}
                                                            onClick={() => setActiveSession(session)}
                                                        >
                                                            View Details / Resume
                                                        </button>
                                                        <button
                                                            className={styles.secondaryButton}
                                                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                            onClick={() => handleExportExcel(session.id, session.work_order_id)}
                                                            title="Download scanned inspections Excel"
                                                        >
                                                            Download 📊
                                                        </button>
                                                        <button
                                                            className={styles.secondaryButton}
                                                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', color: '#b91c1c', borderColor: '#fca5a5' }}
                                                            onClick={() => handleDeleteSession(session.id, session.work_order_id)}
                                                        >
                                                            Delete
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {activeSessionsList.length === 0 && (
                                                <tr>
                                                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                                        No active IVI sessions found. Select a Work Order above to begin.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', fontSize: '0.85rem', color: '#64748b' }}>
                                    <span>Showing {activeSessionsList.length} of {activeTotal} sessions</span>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <button
                                            className={styles.secondaryButton}
                                            disabled={activePage === 1}
                                            onClick={() => {
                                                const p = activePage - 1;
                                                setActivePage(p);
                                                fetchActiveSessions(p, activeLimit, activeSearch);
                                            }}
                                        >
                                            Previous
                                        </button>
                                        <span style={{ padding: '0.35rem 0.5rem' }}>Page {activePage}</span>
                                        <button
                                            className={styles.secondaryButton}
                                            disabled={activePage * activeLimit >= activeTotal}
                                            onClick={() => {
                                                const p = activePage + 1;
                                                setActivePage(p);
                                                fetchActiveSessions(p, activeLimit, activeSearch);
                                            }}
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Completed Sessions History */}
                    <div className={styles.card}>
                        <h3>Completed IVI Sessions History</h3>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1, maxWidth: '400px' }}>
                                <input
                                    type="text"
                                    className={styles.input}
                                    placeholder="Search completed sessions..."
                                    value={completedSearch}
                                    onChange={e => setCompletedSearch(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { setCompletedPage(1); fetchCompletedSessions(1, completedLimit, completedSearch); } }}
                                    style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                                />
                                <button
                                    className={styles.button}
                                    onClick={() => { setCompletedPage(1); fetchCompletedSessions(1, completedLimit, completedSearch); }}
                                    style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                                >
                                    Search
                                </button>
                                {completedSearch && (
                                    <button
                                        className={styles.secondaryButton}
                                        onClick={() => { setCompletedSearch(''); setCompletedPage(1); fetchCompletedSessions(1, completedLimit, ''); }}
                                        style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.85rem', color: '#64748b' }}>
                                <span>Show</span>
                                <select
                                    className={styles.select}
                                    value={completedLimit}
                                    onChange={e => {
                                        const newLimit = parseInt(e.target.value);
                                        setCompletedLimit(newLimit);
                                        setCompletedPage(1);
                                        fetchCompletedSessions(1, newLimit, completedSearch);
                                    }}
                                    style={{ padding: '0.35rem 1.5rem 0.35rem 0.75rem', width: 'auto', fontSize: '0.85rem' }}
                                >
                                    <option value={5}>5</option>
                                    <option value={10}>10</option>
                                    <option value={20}>20</option>
                                </select>
                                <span>entries</span>
                            </div>
                        </div>

                        <div className={styles.tableContainer}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Work Order Number</th>
                                        <th>Started By</th>
                                        <th>Completed At</th>
                                        <th>Status</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {completedSessionsList.map(session => (
                                        <tr key={session.id}>
                                            <td style={{ fontWeight: 600, color: '#334155' }}>{session.work_order_id}</td>
                                            <td>{session.created_by_name || session.created_by || '—'}</td>
                                            <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                                {formatTimestamp(session.updated_at || session.created_at)}
                                            </td>
                                            <td>{getStatusBadge(session.status)}</td>
                                            <td style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                <button
                                                    className={styles.secondaryButton}
                                                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                                                    onClick={() => setActiveSession(session)}
                                                >
                                                    View Details
                                                </button>
                                                <button
                                                    className={styles.secondaryButton}
                                                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                    onClick={() => handleExportExcel(session.id, session.work_order_id)}
                                                    title="Download scanned inspections Excel"
                                                >
                                                    Download 📊
                                                </button>
                                                <button
                                                    className={styles.secondaryButton}
                                                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', color: '#b91c1c', borderColor: '#fca5a5' }}
                                                    onClick={() => handleDeleteSession(session.id, session.work_order_id)}
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {completedSessionsList.length === 0 && (
                                        <tr>
                                            <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                                No completed IVI sessions found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', fontSize: '0.85rem', color: '#64748b' }}>
                            <span>Showing {completedSessionsList.length} of {completedTotal} sessions</span>
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                    className={styles.secondaryButton}
                                    disabled={completedPage === 1}
                                    onClick={() => {
                                        const p = completedPage - 1;
                                        setCompletedPage(p);
                                        fetchCompletedSessions(p, completedLimit, completedSearch);
                                    }}
                                >
                                    Previous
                                </button>
                                <span style={{ padding: '0.35rem 0.5rem' }}>Page {completedPage}</span>
                                <button
                                    className={styles.secondaryButton}
                                    disabled={completedPage * completedLimit >= completedTotal}
                                    onClick={() => {
                                        const p = completedPage + 1;
                                        setCompletedPage(p);
                                        fetchCompletedSessions(p, completedLimit, completedSearch);
                                    }}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* ─── VIEW 2: ACTIVE IVI INSPECTION PAGE ─────────────────────── */
                <div>
                    {/* Top Navigation & Info (SMT Pre-AOI detailHeaderCard style) */}
                    <div style={{
                        background: 'linear-gradient(to right, #e0e7ff, #eff6ff)',
                        border: '1px solid #c7d2fe',
                        borderRadius: '1rem',
                        padding: '1.5rem',
                        marginBottom: '2rem'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                            <div>
                                <h3 style={{ margin: 0, color: '#111827', fontSize: '1.35rem', fontWeight: 700 }}>
                                    RRH Initial Visual Inspection — Active Session
                                </h3>
                                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', marginTop: '0.75rem', color: '#374151', fontSize: '0.95rem', flexWrap: 'wrap' }}>
                                    <span>Work Order: <strong style={{ color: '#4f46e5' }}>{activeSession.work_order_id}</strong></span>
                                    <span>Session ID: <strong>{activeSession.id}</strong></span>
                                    <span>Date: <strong>{formatWoDateTime(activeSession.work_order_date || activeSession.date || selectedWoDetails?.dateTime || activeSession.created_at)}</strong></span>
                                    <span>Status: {getStatusBadge(activeSession.status)}</span>
                                </div>
                            </div>
                            <button
                                className={styles.detailBackButton}
                                onClick={() => { setActiveSession(null); fetchSessionsLists(); }}
                            >
                                ← Back to Session Setup
                            </button>
                        </div>
                    </div>

                    {/* Summary Statistics Dashboard Cards (SMT Pre-AOI Card style) */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                        <div className={styles.card} style={{ margin: 0, padding: '1.25rem', borderLeft: '5px solid #2563eb', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>Lot Quantity</p>
                            <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.8rem', color: '#1e293b', fontWeight: 800 }}>{stats.lotQuantity || activeSession.lot_quantity || selectedWoDetails?.lotQuantity || 0}</h2>
                        </div>
                        <div className={styles.card} style={{ margin: 0, padding: '1.25rem', borderLeft: '5px solid #8b5cf6', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>Remaining Lot Quantity</p>
                            <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.8rem', color: '#6d28d9', fontWeight: 800 }}>{stats.pending ?? Math.max(0, (stats.lotQuantity || activeSession.lot_quantity || selectedWoDetails?.lotQuantity || 0) - stats.passed)}</h2>
                        </div>
                        <div className={styles.card} style={{ margin: 0, padding: '1.25rem', borderLeft: '5px solid #0ea5e9', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>Inward Passed</p>
                            <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.8rem', color: '#0284c7', fontWeight: 800 }}>{stats.totalInwarded ?? 0}</h2>
                        </div>
                        <div className={styles.card} style={{ margin: 0, padding: '1.25rem', borderLeft: '5px solid #16a34a', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>Passed</p>
                            <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.8rem', color: '#15803d', fontWeight: 800 }}>{stats.passed}</h2>
                        </div>
                        <div className={styles.card} style={{ margin: 0, padding: '1.25rem', borderLeft: '5px solid #dc2626', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>Failed</p>
                            <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.8rem', color: '#b91c1c', fontWeight: 800 }}>{stats.failed}</h2>
                        </div>
                        <div className={styles.card} style={{ margin: 0, padding: '1.25rem', borderLeft: '5px solid #0d9488', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>Yield (%)</p>
                            <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.8rem', color: '#0f766e', fontWeight: 800 }}>{stats.yield}%</h2>
                        </div>
                    </div>

                    {/* ─── MAIN INSPECTION CARD (Matches Image Perfectly) ────── */}
                    <div className={styles.card}>
                        <h3 className={styles.inspectionTitle}>RRH IVI (Initial Visual Inspection)</h3>

                        {/* Serial Number Input & Clear Button */}
                        <div className={styles.serialRow}>
                            <input
                                ref={serialInputRef}
                                type="text"
                                className={styles.serialInput}
                                placeholder="Scan or enter Serial Number..."
                                value={serialInput}
                                onChange={e => {
                                    setSerialInput(e.target.value);
                                    if (fetchedSerial) setFetchedSerial(null);
                                }}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleLookupSerial(serialInput);
                                    }
                                }}
                                disabled={isFetchingSerial || isSubmitting}
                            />
                            <button
                                type="button"
                                className={styles.clearButton}
                                onClick={handleClear}
                                title="Clear Serial Number and Form"
                            >
                                Clear
                            </button>
                            {isFetchingSerial && (
                                <span style={{ fontSize: '0.85rem', color: '#4f46e5', fontWeight: 600 }}>
                                    Fetching details...
                                </span>
                            )}
                        </div>

                        {/* Readout Details of Scanned Serial Number */}
                        {fetchedSerial && (
                            <div className={styles.scannedInfoPanel}>
                                <div className={styles.scannedInfoGridRow1}>
                                    <div className={styles.scannedInfoItem}>
                                        <span className={styles.scannedInfoLabel}>Work Order No.</span>
                                        <span className={styles.scannedInfoValue}>{fetchedSerial.work_order_no || activeSession.work_order_id}</span>
                                    </div>
                                    <div className={styles.scannedInfoItem}>
                                        <span className={styles.scannedInfoLabel}>WO Date</span>
                                        <span className={styles.scannedInfoValue}>{fetchedSerial.wo_date}</span>
                                    </div>
                                    <div className={styles.scannedInfoItem}>
                                        <span className={styles.scannedInfoLabel}>Tejas DC No.</span>
                                        <span className={styles.scannedInfoValue}>{fetchedSerial.tejas_dc_no}</span>
                                    </div>
                                    <div className={styles.scannedInfoItem}>
                                        <span className={styles.scannedInfoLabel}>Tejas OBD No.</span>
                                        <span className={styles.scannedInfoValue}>{fetchedSerial.tejas_obd_no}</span>
                                    </div>
                                    <div className={styles.scannedInfoItem}>
                                        <span className={styles.scannedInfoLabel}>BAT Lot No.</span>
                                        <span className={styles.scannedInfoValue}>{fetchedSerial.bat_lot_no}</span>
                                    </div>
                                </div>
                                <div className={styles.scannedInfoGridRow2}>
                                    <div className={styles.scannedInfoItem}>
                                        <span className={styles.scannedInfoLabel}>Physical TPN</span>
                                        <span className={styles.scannedInfoValue}>{fetchedSerial.physical_tpn}</span>
                                    </div>
                                    <div className={styles.scannedInfoItem}>
                                        <span className={styles.scannedInfoLabel}>Band</span>
                                        <span className={`${styles.scannedInfoValue} ${styles.bandText}`}>
                                            {fetchedSerial.band || getBandFromTpn(fetchedSerial.physical_tpn)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Inspection Form */}
                        <form onSubmit={handleSubmitInspection}>
                            {/* Row 1: Duplexer Make * | Duplexer Part No. * */}
                            <div className={styles.formGrid2Col}>
                                <div className={styles.fieldGroup}>
                                    <label className={styles.fieldLabel}>Duplexer Make *</label>
                                    <input
                                        type="text"
                                        className={styles.fieldInput}
                                        value={duplexerMain}
                                        onChange={e => setDuplexerMain(e.target.value)}
                                        placeholder="Enter Duplexer Make"
                                        required
                                    />
                                </div>
                                <div className={styles.fieldGroup}>
                                    <label className={styles.fieldLabel}>Duplexer Part No. *</label>
                                    <input
                                        type="text"
                                        className={styles.fieldInput}
                                        value={duplexerPartNo}
                                        onChange={e => setDuplexerPartNo(e.target.value)}
                                        placeholder="Enter Duplexer Part No. (mix of letters & numbers)"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Row 2: RRH Unit Defect (Read-only, auto-generated from checkpoints) | Photos (Optional, max 600KB each) */}
                            <div className={styles.formGrid2Col}>
                                <div className={styles.fieldGroup}>
                                    <label className={styles.fieldLabel}>RRH Unit Defect</label>
                                    <input
                                        type="text"
                                        className={styles.fieldInput}
                                        value={rrhUnit}
                                        readOnly
                                        style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed', color: '#1e293b' }}
                                        placeholder='Auto-generated from Checkpoints ("no defect" or failure remarks)'
                                    />
                                    <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem', display: 'block' }}>
                                        Auto-generated from Checkpoints (manual typing disabled).
                                    </span>
                                </div>
                                <div className={styles.fieldGroup}>
                                    <label className={styles.fieldLabel}>
                                        Photos (Optional, max 6 images, under 600 KB each) {selectedImages.length > 0 && `(${selectedImages.length}/6)`}
                                    </label>
                                    <div className={styles.fileInputWrapper}>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            disabled={isCompressing || selectedImages.length >= 6}
                                            onChange={handleImageSelect}
                                        />
                                    </div>
                                    {isCompressing && (
                                        <div style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 600, marginTop: '0.3rem' }}>
                                            ⏳ Compressing images to minimum size...
                                        </div>
                                    )}
                                    {selectedImages.length > 0 && (
                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                                            {selectedImages.map((img, idx) => (
                                                <span key={idx} style={{
                                                    background: '#e2e8f0', color: '#1e293b', fontSize: '0.75rem',
                                                    padding: '0.2rem 0.5rem', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px'
                                                }}>
                                                    📷 {img.name} ({Math.round(img.size / 1024)}KB)
                                                    <button type="button" onClick={() => removeImage(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c', fontWeight: 700 }}>×</button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Row 3: Status * | Remarks */}
                            <div className={styles.formGrid2Col}>
                                <div className={styles.fieldGroup}>
                                    <label className={styles.fieldLabel}>Status *</label>
                                    <select
                                        className={styles.fieldSelect}
                                        value={statusVal}
                                        onChange={e => setStatusVal(e.target.value as 'PASS' | 'FAIL')}
                                        required
                                    >
                                        <option value="PASS">PASS</option>
                                        <option value="FAIL">FAIL</option>
                                    </select>
                                    <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem', display: 'block' }}>
                                        Automatically updated by inspection checkpoints.
                                    </span>
                                </div>
                                <div className={styles.fieldGroup}>
                                    <label className={styles.fieldLabel}>Remarks</label>
                                    <input
                                        type="text"
                                        className={styles.fieldInput}
                                        value={remarksVal}
                                        onChange={e => setRemarksVal(e.target.value)}
                                        placeholder="Enter optional additional remarks..."
                                    />
                                </div>
                            </div>

                            {/* Visual Inspection Checkpoints (Matching Reference UI — positioned above Submit Inspection) */}
                            <div className={styles.checkpointSection}>
                                <h3 className={styles.checkpointHeading}>Visual Inspection Checkpoints</h3>
                                <p className={styles.attemptInfo}>
                                    Mark <strong>Pass</strong> or <strong>Fail</strong> for each checkpoint. Confirm each selection to advance.
                                </p>

                                {/* Step Navigation Tracker */}
                                <div className={styles.stepNavRow}>
                                    {checkpoints.map((cp, idx) => {
                                        const isActive = idx === activeCpIndex;
                                        let statusClass = '';
                                        let statusIcon = null;
                                        if (cp.confirmed) {
                                            if (cp.status === 'PASS') {
                                                statusClass = styles.stepNavPillPass;
                                                statusIcon = '✔ ';
                                            } else if (cp.status === 'FAIL') {
                                                statusClass = styles.stepNavPillFail;
                                                statusIcon = '❌ ';
                                            }
                                        }
                                        return (
                                            <button
                                                key={cp.id}
                                                type="button"
                                                className={`${styles.stepNavPill} ${isActive ? styles.stepNavPillActive : ''} ${statusClass}`}
                                                onClick={() => handleJumpToCp(idx)}
                                                title={cp.description}
                                            >
                                                {statusIcon}Point {cp.id}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Active Checkpoint Content */}
                                {(() => {
                                    const currentCp = IVI_CHECKPOINTS[activeCpIndex];
                                    const isConfirmed = checkpoints[activeCpIndex]?.confirmed;
                                    return (
                                        <div>
                                            {/* Status Badge */}
                                            <div className={styles.checkpointStatusBox}>
                                                <strong>Status:</strong> Checkpoint {activeCpIndex + 1} of {IVI_CHECKPOINTS.length} — {currentCp.title}
                                                {isConfirmed && (
                                                    <span style={{ marginLeft: '10px', fontSize: '0.85rem', fontWeight: 700, color: checkpoints[activeCpIndex].status === 'PASS' ? '#16a34a' : '#dc2626' }}>
                                                        ({checkpoints[activeCpIndex].status === 'PASS' ? 'Confirmed: PASS' : 'Confirmed: FAIL'})
                                                    </span>
                                                )}
                                            </div>

                                            {/* Prompt */}
                                            <div className={styles.checkpointPrompt}>
                                                {currentCp.id}. {currentCp.description}
                                            </div>

                                            {/* Pass / Fail Buttons */}
                                            <div className={styles.statusButtons}>
                                                <button
                                                    type="button"
                                                    className={`${styles.statusBtn} ${currentCpStatus === 'PASS' ? styles.passActive : ''}`}
                                                    onClick={() => handleSelectCpStatus('PASS')}
                                                >
                                                    ✔ Pass
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`${styles.statusBtn} ${currentCpStatus === 'FAIL' ? styles.failActive : ''}`}
                                                    onClick={() => handleSelectCpStatus('FAIL')}
                                                >
                                                    ❌ Fail
                                                </button>
                                            </div>

                                            {/* Remark on Fail */}
                                            {currentCpStatus === 'FAIL' && (
                                                <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
                                                    <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>
                                                        Defect Remark *
                                                    </label>
                                                    <textarea
                                                        className={styles.checkpointTextarea}
                                                        rows={3}
                                                        placeholder="Explain why this checkpoint failed..."
                                                        value={currentCpRemark}
                                                        onChange={e => setCurrentCpRemark(e.target.value)}
                                                        required
                                                    />
                                                </div>
                                            )}

                                            {/* Confirm Button */}
                                            <button
                                                type="button"
                                                className={styles.confirmBtn}
                                                onClick={handleConfirmCurrentCheckpoint}
                                                style={{ marginTop: '0.5rem' }}
                                            >
                                                Confirm Checkpoint
                                            </button>
                                        </div>
                                    );
                                })()}

                                {/* All Confirmed Summary Banner */}
                                {checkpoints.every(c => c.confirmed) && (
                                    <div className={`${styles.allConfirmedBanner} ${checkpoints.some(c => c.status === 'FAIL') ? styles.allConfirmedBannerFail : ''}`}>
                                        <div>
                                            {checkpoints.some(c => c.status === 'FAIL') ? (
                                                <span>⚠️ Checkpoints verified with failure(s). Inspection status set to <strong>FAIL</strong> and defect remarks saved in RRH Unit Defect.</span>
                                            ) : (
                                                <span>✅ All 6 checkpoints verified and passed! RRH Unit Defect set to <strong>"no defect"</strong> and status set to <strong>PASS</strong>.</span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Row 4: Submit Inspection Button */}
                            <button
                                type="submit"
                                className={styles.submitInspectionButton}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'Submitting Inspection...' : 'Submit Inspection'}
                            </button>
                        </form>
                    </div>

                    {/* ─── RECENT INSPECTIONS TABLE CARD ─────────────────────── */}
                    <div className={styles.card}>
                        <div className={styles.recentHeader} style={{ marginBottom: '0.4rem' }}>
                            <h3 className={styles.recentTitle}>
                                Recent Inspections ({filteredRecentInspections.length}{filteredRecentInspections.length !== recentInspections.length ? ` of ${recentInspections.length}` : ''})
                            </h3>

                            {/* Export Excel button */}
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <button
                                    type="button"
                                    className={styles.exportExcelButton}
                                    onClick={() => handleExportExcel()}
                                    disabled={isExporting || recentInspections.length === 0}
                                >
                                    {isExporting ? 'Exporting...' : 'Export Excel 📊'}
                                </button>
                            </div>
                        </div>

                        {/* Search Bar directly under Recent Inspections */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem', maxWidth: '460px' }}>
                            <input
                                type="text"
                                className={styles.input}
                                placeholder="Search recent inspections (Serial, TPN, Status, etc.)..."
                                value={inspectionSearch}
                                onChange={e => setInspectionSearch(e.target.value)}
                                style={{ padding: '0.55rem 0.85rem', fontSize: '0.9rem', width: '100%' }}
                            />
                            {inspectionSearch && (
                                <button
                                    type="button"
                                    className={styles.secondaryButton}
                                    onClick={() => setInspectionSearch('')}
                                    style={{ padding: '0.55rem 1rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                                >
                                    Clear
                                </button>
                            )}
                        </div>

                        <div className={styles.tableContainer}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>S.No</th>
                                        <th>Band Serial No</th>
                                        <th>Tejas DC No</th>
                                        <th>Tejas OBD No</th>
                                        <th>Physical TPN</th>
                                        <th>Band</th>
                                        <th>Duplexer Make</th>
                                        <th>Duplexer Part No</th>
                                        <th>RRH Unit Defect</th>
                                        <th>Status</th>
                                        <th>Photos</th>
                                        <th>Remarks</th>
                                        <th>Scanned By</th>
                                        <th>Date & Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRecentInspections.map((row) => (
                                        <tr key={row.id}>
                                            <td style={{ fontWeight: 600, color: '#64748b', textAlign: 'center' }}>{row.sl_no || '-'}</td>
                                            <td style={{ fontWeight: 700, color: '#1e293b', fontFamily: 'monospace' }}>{row.band_serial_no || row.serial_number}</td>
                                            <td>{row.tejas_dc_no || '—'}</td>
                                            <td>{row.tejas_obd_no || '—'}</td>
                                            <td style={{ fontFamily: 'monospace' }}>{row.physical_tpn || '—'}</td>
                                            <td style={{ fontWeight: 700, color: '#2563eb' }}>
                                                {row.band || getBandFromTpn(row.physical_tpn)}
                                            </td>
                                            <td>{row.duplexer_main || '—'}</td>
                                            <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{row.duplexer_part_no || '—'}</td>
                                            <td>{row.rrh_unit || '—'}</td>
                                            <td>
                                                {row.status === 'PASS' ? (
                                                    <span className={styles.badgePass}>PASS</span>
                                                ) : (
                                                    <span className={styles.badgeFail}>FAIL</span>
                                                )}
                                            </td>
                                            <td>
                                                {(() => {
                                                    const imgs = parseImages(row.image_urls);
                                                    if (imgs.length === 0) {
                                                        return <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>—</span>;
                                                    }
                                                    return (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <button
                                                                type="button"
                                                                className={styles.secondaryButton}
                                                                style={{
                                                                    padding: '0.25rem 0.55rem',
                                                                    fontSize: '0.8rem',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px',
                                                                    backgroundColor: '#eef2ff',
                                                                    color: '#4338ca',
                                                                    borderColor: '#c7d2fe',
                                                                    fontWeight: 600
                                                                }}
                                                                onClick={() => {
                                                                    setViewingImages({ serial: row.band_serial_no || row.serial_number, images: imgs });
                                                                    setSelectedImageIndex(0);
                                                                }}
                                                                title="View inspection photos"
                                                            >
                                                                🖼️ View ({imgs.length})
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className={styles.secondaryButton}
                                                                style={{
                                                                    padding: '0.25rem 0.45rem',
                                                                    fontSize: '0.8rem',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center'
                                                                }}
                                                                onClick={() => handleDownloadImage(imgs[0], `IVI_${row.band_serial_no || row.serial_number}_photo_1.jpg`)}
                                                                title="Download photo"
                                                            >
                                                                📥
                                                            </button>
                                                        </div>
                                                    );
                                                })()}
                                            </td>
                                            <td style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.remarks || ''}>
                                                {row.remarks || '—'}
                                            </td>
                                            <td>{row.scanned_by || '—'}</td>
                                            <td style={{ fontSize: '0.85rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                                                {formatTimestamp(row.scanned_at)}
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredRecentInspections.length === 0 && (
                                        <tr>
                                            <td colSpan={14} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                                {inspectionSearch ? 'No matching inspections found for this search.' : 'No inspections recorded yet in this IVI session.'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* ─── LIVE REMAINING INWARD MASTER DATA TABLE ─────────── */}
                    <div className={styles.card} style={{ marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
                            <div>
                                <h3 style={{ margin: 0, paddingBottom: 0, borderBottom: 'none' }}>
                                    Remaining Inward Master Data ({remainingTotal} items remaining)
                                </h3>
                                <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                                    Live session view: Master units scanned & passed in RRH Inward ready for Initial Visual Inspection. Successfully inspected units are deducted immediately.
                                </p>
                            </div>

                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.85rem', color: '#64748b' }}>
                                    <span>Show</span>
                                    <select
                                        className={styles.select}
                                        value={remainingLimit}
                                        onChange={e => {
                                            const lim = parseInt(e.target.value, 10);
                                            setRemainingLimit(lim);
                                            setRemainingPage(1);
                                            if (activeSession?.id) {
                                                fetchRemainingMasterData(activeSession.id, 1, lim, remainingSearch);
                                            }
                                        }}
                                        style={{ padding: '0.35rem 1.5rem 0.35rem 0.75rem', width: 'auto', fontSize: '0.85rem' }}
                                    >
                                        <option value={10}>10</option>
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                    </select>
                                </div>
                                <input
                                    type="text"
                                    className={styles.input}
                                    placeholder="Search remaining serials..."
                                    value={remainingSearch}
                                    onChange={e => setRemainingSearch(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && activeSession?.id) {
                                            setRemainingPage(1);
                                            fetchRemainingMasterData(activeSession.id, 1, remainingLimit, remainingSearch);
                                        }
                                    }}
                                    style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', width: '220px' }}
                                />
                                <button
                                    className={styles.button}
                                    style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                                    onClick={() => {
                                        if (activeSession?.id) {
                                            setRemainingPage(1);
                                            fetchRemainingMasterData(activeSession.id, 1, remainingLimit, remainingSearch);
                                        }
                                    }}
                                >
                                    Filter
                                </button>
                                {remainingSearch && (
                                    <button
                                        className={styles.secondaryButton}
                                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                                        onClick={() => {
                                            setRemainingSearch('');
                                            setRemainingPage(1);
                                            if (activeSession?.id) {
                                                fetchRemainingMasterData(activeSession.id, 1, remainingLimit, '');
                                            }
                                        }}
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                        </div>

                        {remainingLoading ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                                Loading remaining inward master data...
                            </div>
                        ) : remainingTotal === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2.5rem', background: '#f0fdf4', borderRadius: '8px', border: '1px dashed #16a34a', color: '#166534', fontWeight: 600 }}>
                                🎉 All inwarded units for this Work Order have been inspected for this session!
                            </div>
                        ) : (
                            <>
                                <div className={styles.tableContainer}>
                                    <table className={styles.table}>
                                        <thead>
                                            <tr>
                                                <th style={{ width: '50px' }}>S.No.</th>
                                                <th>Physical TPN</th>
                                                <th>Band Serial Number</th>
                                                <th>Band</th>
                                                <th>Tejas DC No</th>
                                                <th>Tejas OBD No</th>
                                                <th>BAT Lot No</th>
                                                <th>Inward Scanned At</th>
                                                <th>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {remainingMasterData.map((item, idx) => (
                                                <tr key={item.id}>
                                                    <td style={{ textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
                                                        {item.sl_no ?? item.global_row_number ?? ((remainingPage - 1) * remainingLimit + idx + 1)}
                                                    </td>
                                                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                                                        {item.physical_tpn || '—'}
                                                    </td>
                                                    <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f766e' }}>
                                                        {item.band_serial_no || item.serial_number}
                                                    </td>
                                                    <td>
                                                        <span style={{ color: '#2563eb', fontWeight: 700 }}>
                                                            {item.band || getBandFromTpn(item.physical_tpn)}
                                                        </span>
                                                    </td>
                                                    <td>{item.tejas_dc_no || '—'}</td>
                                                    <td>{item.tejas_obd_no || '—'}</td>
                                                    <td>{item.bat_lot_no || '—'}</td>
                                                    <td style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                                        {formatTimestamp(item.inward_scanned_at)}
                                                    </td>
                                                    <td>
                                                        <button
                                                            className={styles.button}
                                                            style={{ padding: '0.25rem 0.65rem', fontSize: '0.78rem', backgroundImage: 'none', backgroundColor: '#0ea5e9' }}
                                                            onClick={() => handleSelectRemainingUnit(item)}
                                                            title="Inspect this inwarded unit"
                                                            disabled={activeSession.status === 'Completed'}
                                                        >
                                                            Inspect Unit
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                        Showing {Math.min((remainingPage - 1) * remainingLimit + 1, remainingTotal)} to {Math.min(remainingPage * remainingLimit, remainingTotal)} of {remainingTotal} items
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <button
                                            className={styles.secondaryButton}
                                            disabled={remainingPage === 1}
                                            onClick={() => {
                                                const p = remainingPage - 1;
                                                setRemainingPage(p);
                                                if (activeSession?.id) {
                                                    fetchRemainingMasterData(activeSession.id, p, remainingLimit, remainingSearch);
                                                }
                                            }}
                                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
                                        >
                                            Previous
                                        </button>
                                        <span style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem', color: '#64748b' }}>
                                            Page {remainingPage} of {Math.ceil(remainingTotal / remainingLimit) || 1}
                                        </span>
                                        <button
                                            className={styles.secondaryButton}
                                            disabled={remainingPage * remainingLimit >= remainingTotal}
                                            onClick={() => {
                                                const p = remainingPage + 1;
                                                setRemainingPage(p);
                                                if (activeSession?.id) {
                                                    fetchRemainingMasterData(activeSession.id, p, remainingLimit, remainingSearch);
                                                }
                                            }}
                                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ─── MODAL: VIEW & DOWNLOAD INSPECTION PHOTOS ──────────────── */}
            {viewingImages && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.75)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 99999,
                    padding: '1.5rem'
                }} onClick={() => setViewingImages(null)}>
                    <div style={{
                        background: '#ffffff',
                        borderRadius: '12px',
                        maxWidth: '850px',
                        width: '100%',
                        maxHeight: '90vh',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        border: '1px solid #e2e8f0'
                    }} onClick={e => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div style={{
                            padding: '1.25rem 1.5rem',
                            borderBottom: '1px solid #e5e7eb',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: '#f8fafc'
                        }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#111827', fontWeight: 700 }}>
                                    Inspection Photos — <span style={{ color: '#4f46e5' }}>{viewingImages.serial}</span>
                                </h3>
                                <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                                    Showing {selectedImageIndex + 1} of {viewingImages.images.length} photo{viewingImages.images.length > 1 ? 's' : ''}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setViewingImages(null)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '1.4rem',
                                    cursor: 'pointer',
                                    color: '#64748b',
                                    padding: '0.25rem',
                                    lineHeight: 1
                                }}
                                title="Close"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Body / Main Image Preview */}
                        <div style={{
                            padding: '1.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#0f172a',
                            overflow: 'hidden',
                            minHeight: '380px',
                            maxHeight: '58vh'
                        }}>
                            {viewingImages.images[selectedImageIndex] ? (
                                <img
                                    src={viewingImages.images[selectedImageIndex]}
                                    alt={`Inspection photo ${selectedImageIndex + 1} for ${viewingImages.serial}`}
                                    style={{
                                        maxWidth: '100%',
                                        maxHeight: '56vh',
                                        objectFit: 'contain',
                                        borderRadius: '4px',
                                        boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                                    }}
                                />
                            ) : (
                                <div style={{ color: '#94a3b8' }}>Image not found</div>
                            )}
                        </div>

                        {/* Thumbnail Strip (if multiple photos) */}
                        {viewingImages.images.length > 1 && (
                            <div style={{
                                display: 'flex',
                                gap: '10px',
                                padding: '0.75rem 1.5rem',
                                background: '#f1f5f9',
                                borderTop: '1px solid #e2e8f0',
                                overflowX: 'auto'
                            }}>
                                {viewingImages.images.map((img, i) => (
                                    <div
                                        key={i}
                                        onClick={() => setSelectedImageIndex(i)}
                                        style={{
                                            width: '60px',
                                            height: '60px',
                                            borderRadius: '6px',
                                            overflow: 'hidden',
                                            cursor: 'pointer',
                                            border: i === selectedImageIndex ? '2px solid #4f46e5' : '2px solid #cbd5e1',
                                            opacity: i === selectedImageIndex ? 1 : 0.6,
                                            flexShrink: 0,
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        <img
                                            src={img}
                                            alt={`Thumb ${i + 1}`}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Modal Footer / Download Actions */}
                        <div style={{
                            padding: '1rem 1.5rem',
                            borderTop: '1px solid #e5e7eb',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: '#ffffff'
                        }}>
                            <button
                                type="button"
                                className={styles.secondaryButton}
                                onClick={() => setViewingImages(null)}
                                style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
                            >
                                Close
                            </button>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    type="button"
                                    className={styles.button}
                                    style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                                    onClick={() => handleDownloadImage(
                                        viewingImages.images[selectedImageIndex],
                                        `IVI_${viewingImages.serial}_photo_${selectedImageIndex + 1}.jpg`
                                    )}
                                >
                                    📥 Download Photo
                                </button>
                                {viewingImages.images.length > 1 && (
                                    <button
                                        type="button"
                                        className={styles.secondaryButton}
                                        style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                                        onClick={() => {
                                            viewingImages.images.forEach((img, i) => {
                                                setTimeout(() => {
                                                    handleDownloadImage(img, `IVI_${viewingImages.serial}_photo_${i + 1}.jpg`);
                                                }, i * 300);
                                            });
                                        }}
                                    >
                                        📦 Download All ({viewingImages.images.length})
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
