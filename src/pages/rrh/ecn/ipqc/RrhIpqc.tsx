import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import styles from './Ipqc.module.css';
import { WorkOrderSelector } from '../../../../components/WorkOrderSelector';
import { apiFetch } from '../../../../utils/api';
import { Download, AlertCircle } from 'lucide-react';

// ─── SKU to Band Mapping ──────────────────────────────────────────────────────
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

export const cleanDefectDescription = (text: string | null | undefined): string => {
    if (!text || text === '—' || text === '-' || text === 'no defect') return text || '—';
    const parts = String(text).split(/;\s*|\n+/);
    const cleaned = parts
        .map((p) => {
            let s = p.trim();
            s = s.replace(/^(?:point\s*\d+[\s:\-–.]*|point[\s:\-–.]*|:?\s*\d+\s*[:\-–.]\s*)/i, '').trim();
            return s;
        })
        .filter((p) => p.length > 0 && p !== '—' && p !== '-');

    return cleaned.length > 0 ? cleaned.join('; ') : (text ? String(text).trim() : '—');
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
            const icon = t.type === 'error' ? '✕' : t.type === 'success' ? '✓' : t.type === 'warning' ? '!' : 'ℹ';

            return (
                <div
                    key={t.id}
                    onClick={() => onRemove(t.id)}
                    style={{
                        padding: '0.85rem 1.25rem',
                        borderRadius: '0.6rem',
                        cursor: 'pointer',
                        minWidth: '320px',
                        background: bg,
                        color,
                        border: `1px solid ${border}`,
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}
                >
                    <span>{icon}</span>
                    <span>{t.message}</span>
                </div>
            );
        })}
    </div>
);

// ─── Checkpoints Definition (7 Points) ───────────────────────────────────────
export interface CheckpointDef {
    id: number;
    title: string;
}

export const IPQC_CHECKPOINTS: CheckpointDef[] = [
    { id: 1, title: '1. Verify Post-Impedance Value' },
    { id: 2, title: '2. Check the Solderability of the C552 & C441, C470, C333, C521, C345, C473' },
    { id: 3, title: '3. Check if all the screws are present and tight' },
    { id: 4, title: '4. Check all the screws in the PAM shield' },
    { id: 5, title: "5. Check the Bullet 8no's Presence & Damage" },
    { id: 6, title: '6. Verify Duplex Assembly [BZA cable connected to J39 connector]' },
    { id: 7, title: '7. Verify all 14 chassis screws are properly tightened' }
];

export interface CheckpointItemState {
    id: number;
    title: string;
    selectedStatus: 'PASS' | 'FAIL' | null;
    remark: string;
    confirmed: boolean;
    confirmedStatus: 'PASS' | 'FAIL' | null;
    previousFailureRemark?: string;
}

const createInitialCheckpoints = (): CheckpointItemState[] =>
    IPQC_CHECKPOINTS.map(cp => ({
        ...cp,
        selectedStatus: null,
        remark: '',
        confirmed: false,
        confirmedStatus: null
    }));

// Returns current local date in YYYY-MM-DD format (avoids UTC timezone shift bug where IST 00:xx displays previous day)
const getTodayLocalDate = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatTableDate = (val: any): string => {
    if (!val) return '—';
    if (typeof val === 'string') {
        const match = val.match(/^(\d{4}-\d{2}-\d{2})/);
        if (match) return match[1];
    }
    if (val instanceof Date) {
        const y = val.getFullYear();
        const m = String(val.getMonth() + 1).padStart(2, '0');
        const d = String(val.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    return String(val).split('T')[0];
};

// ─── Interfaces ──────────────────────────────────────────────────────────────
interface EligibleWorkOrder {
    id?: number | string;
    work_order_id: string;
    work_order_date?: string;
    date?: string;
    lot_quantity?: number;
    status?: string;
    ivi_passed_count?: number;
}

interface IpqcSession {
    id: number | string;
    work_order_id: string;
    status: string;
    created_by: string;
    created_by_name: string;
    created_at: string;
    lot_quantity?: number;
    lot_number?: string;
    work_order_date?: string;
    date?: string;
}

interface SessionStats {
    lotQuantity: number;
    iviPassed: number;
    completed: number;
    passed: number;
    failed: number;
    pending: number;
    editedPass: number;
    yield: string | number;
}

interface FetchedUnitDetails {
    serial_number: string;
    band_serial_no: string;
    physical_tpn: string;
    band: string;
    bat_lot_no: string;
    tejas_dc_no: string;
    tejas_obd_no: string;
    duplexer_main: string;
    duplexer_part_no: string;
    rrh_unit: string;
    ivi_status: string;
    ivi_inspected_by?: string;
    pam_tpn?: string;
    pam1?: string;
    pam2?: string;
    pam3?: string;
    pam4?: string;
    rfpc_tpn?: string;
    rfpc_sl_no?: string;
    ivi_id?: number;
    sl_no?: number | string;
}

interface ScannedProductLog {
    id: number | string;
    session_id: number | string;
    work_order_id: string;
    serial_number: string;
    band_serial_no: string;
    physical_serial_number?: string;
    physical_tpn: string;
    band: string;
    inspection_date?: string;
    e_label?: string;
    pam_tpn?: string;
    pam1?: string;
    pam2?: string;
    pam3?: string;
    pam4?: string;
    rfpc_tpn?: string;
    rfpc_sl_no?: string;
    status: string;
    remarks?: string;
    scanned_by: string;
    scanned_at: string;
    checkpoints?: any;
    is_reinspected?: boolean;
    defect_fixed?: string;
    tejas_dc_no?: string;
    tejas_obd_no?: string;
    lot?: string;
    sl_no?: number | string;
}

interface RemainingMasterRecord {
    ivi_id: number | string;
    physical_tpn: string;
    band_serial_no: string;
    serial_number?: string;
    band?: string;
    duplexer_main?: string;
    duplexer_part_no?: string;
    rrh_unit?: string;
    ivi_status?: string;
    tejas_dc_no?: string;
    tejas_obd_no?: string;
    lot?: string;
    bat_lot_no?: string;
    remarks?: string;
    ivi_scanned_at?: string;
    sl_no?: number | string;
}

export const RrhIpqc: React.FC = () => {
    // ─── Toaster State ───────────────────────────────────────────────────────
    const [toasts, setToasts] = useState<Toast[]>([]);
    const toastId = useRef(0);
    const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
        const id = ++toastId.current;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
    }, []);
    const removeToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

    // ─── Session Setup & History State (View 1) ──────────────────────────────
    const [eligibleWos, setEligibleWos] = useState<EligibleWorkOrder[]>([]);
    const [selectedWoId, setSelectedWoId] = useState('');
    const [selectedWoDetails, setSelectedWoDetails] = useState<EligibleWorkOrder | null>(null);
    const [detailsLoading, setDetailsLoading] = useState(false);

    // Active Sessions list
    const [activeSessions, setActiveSessions] = useState<IpqcSession[]>([]);
    const [activeSearch, setActiveSearch] = useState('');
    const [activePage, setActivePage] = useState(1);
    const [activeLimit, setActiveLimit] = useState(5);
    const [activeTotal, setActiveTotal] = useState(0);
    const [sessionsLoading, setSessionsLoading] = useState(false);

    // Completed Sessions list
    const [completedSessions, setCompletedSessions] = useState<IpqcSession[]>([]);
    const [completedSearch, setCompletedSearch] = useState('');
    const [completedPage, setCompletedPage] = useState(1);
    const [completedLimit, setCompletedLimit] = useState(5);
    const [completedTotal, setCompletedTotal] = useState(0);

    // Filter out active or completed work orders from the dropdown
    const availableWorkOrders = useMemo(() => {
        const activeWoIds = new Set(activeSessions.map((s: any) => String(s.work_order_id || '').trim().toUpperCase()));
        const completedWoIds = new Set(completedSessions.map((s: any) => String(s.work_order_id || '').trim().toUpperCase()));
        return eligibleWos.filter((w: any) => {
            const woId = String(w.work_order_id || '').trim().toUpperCase();
            if (activeWoIds.has(woId)) return false;
            if (completedWoIds.has(woId)) return false;
            return true;
        });
    }, [eligibleWos, activeSessions, completedSessions]);

    // ─── Active Inspection State (View 2) ────────────────────────────────────
    const [activeSession, setActiveSession] = useState<IpqcSession | null>(null);
    const [stats, setStats] = useState<SessionStats>({
        lotQuantity: 0,
        iviPassed: 0,
        completed: 0,
        passed: 0,
        failed: 0,
        pending: 0,
        editedPass: 0,
        yield: '0.00'
    });

    // Scanner & Loaded Unit State
    const [scannerInput, setScannerInput] = useState('');
    const [isSearchingSerial, setIsSearchingSerial] = useState(false);
    const [loadedUnit, setLoadedUnit] = useState<FetchedUnitDetails | null>(null);

    // Form tracking inputs
    const [inspectionDate, setInspectionDate] = useState<string>(getTodayLocalDate);
    const [eLabel, setELabel] = useState('');
    const [pamTpn, setPamTpn] = useState('');
    const [pam1, setPam1] = useState('');
    const [pam2, setPam2] = useState('');
    const [pam3, setPam3] = useState('');
    const [pam4, setPam4] = useState('');
    const [rfpcTpn, setRfpcTpn] = useState('');
    const [rfpcSlNo, setRfpcSlNo] = useState('');
    const [generalRemarks, setGeneralRemarks] = useState('');

    // Re-inspection alert
    const [reinspectionInfo, setReinspectionInfo] = useState<{
        isReinspected: boolean;
        previousFailureRemarks?: string;
    } | null>(null);

    // Checkpoints
    const [checkpoints, setCheckpoints] = useState<CheckpointItemState[]>(createInitialCheckpoints);
    const [isSubmittingInspection, setIsSubmittingInspection] = useState(false);

    // Scanned Products Logs Table (Recent Inspections)
    const [scannedLogs, setScannedLogs] = useState<ScannedProductLog[]>([]);
    const [scannedSearch, setScannedSearch] = useState('');
    const [scannedPage, setScannedPage] = useState(1);
    const [scannedLimit] = useState(10);
    const [scannedTotal, setScannedTotal] = useState(0);

    // Failed Inspections Table
    const [failedInspections, setFailedInspections] = useState<ScannedProductLog[]>([]);
    const [failedSearch, setFailedSearch] = useState('');
    const [failedPage, setFailedPage] = useState(1);
    const [failedLimit] = useState(10);
    const [failedLoading, setFailedLoading] = useState(false);
    const [failedModalRecord, setFailedModalRecord] = useState<ScannedProductLog | null>(null);
    const [fixedDefectModalRecord, setFixedDefectModalRecord] = useState<ScannedProductLog | null>(null);

    // Remaining Master Data Table
    const [remainingList, setRemainingList] = useState<RemainingMasterRecord[]>([]);
    const [remainingSearch, setRemainingSearch] = useState('');
    const [remainingPage, setRemainingPage] = useState(1);
    const [remainingLimit, setRemainingLimit] = useState(10);
    const [remainingTotal, setRemainingTotal] = useState(0);
    const [remainingLoading, setRemainingLoading] = useState(false);

    const scannerInputRef = useRef<HTMLInputElement>(null);
    const inspectionFormRef = useRef<HTMLDivElement>(null);

    // ─── 1. Load Eligible Work Orders ────────────────────────────────────────
    const fetchEligibleWorkOrders = useCallback(async () => {
        try {
            const response = await apiFetch('/api/rrh/ecn/ipqc/eligible-work-orders');
            if (response && Array.isArray(response.data)) {
                setEligibleWos(response.data);
                return;
            }
            if (Array.isArray(response)) {
                setEligibleWos(response);
                return;
            }
            setEligibleWos([]);
        } catch (err: any) {
            console.error('Failed to load eligible RRH work orders:', err);
            addToast('Failed to load eligible work orders.', 'error');
            setEligibleWos([]);
        }
    }, [addToast]);

    // ─── 2. Load Sessions Tables ─────────────────────────────────────────────
    const fetchActiveSessions = useCallback(async (page = activePage, limit = activeLimit, search = activeSearch) => {
        setSessionsLoading(true);
        try {
            const params = new URLSearchParams({
                status: 'In Progress,Pending,Paused',
                page: String(page),
                limit: String(limit),
                search
            });
            const res = await apiFetch(`/api/rrh/ecn/ipqc/sessions?${params}`);
            setActiveSessions(res?.sessions || []);
            setActiveTotal(res?.total || 0);
        } catch (err: any) {
            console.error('Failed to fetch active IPQC sessions:', err);
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
            const res = await apiFetch(`/api/rrh/ecn/ipqc/sessions?${params}`);
            setCompletedSessions(res?.sessions || []);
            setCompletedTotal(res?.total || 0);
        } catch (err: any) {
            console.error('Failed to fetch completed IPQC sessions:', err);
        }
    }, [completedPage, completedLimit, completedSearch]);

    useEffect(() => {
        if (!activeSession) {
            fetchEligibleWorkOrders();
            fetchActiveSessions();
            fetchCompletedSessions();
        }
    }, [activeSession, fetchEligibleWorkOrders, fetchActiveSessions, fetchCompletedSessions]);

    // ─── 3. Handle Work Order Select ─────────────────────────────────────────
    const handleWorkOrderSelect = async (woId: string) => {
        setSelectedWoId(woId);
        if (!woId) {
            setSelectedWoDetails(null);
            return;
        }

        setDetailsLoading(true);
        const localWo = eligibleWos.find((w: any) => w.work_order_id === woId || w.id?.toString() === woId);
        let woNum = localWo?.work_order_id || woId;
        let woDate = localWo?.work_order_date || localWo?.date || (localWo as any)?.created_at || null;
        let lotQty = Number(localWo?.lot_quantity) || 0;
        let iviPassedCount = Number(localWo?.ivi_passed_count) || 0;

        if (localWo && lotQty > 0 && iviPassedCount > 0) {
            setSelectedWoDetails({
                work_order_id: woNum,
                work_order_date: woDate,
                lot_quantity: lotQty,
                ivi_passed_count: iviPassedCount
            });
            setDetailsLoading(false);
        }

        try {
            // First fetch exact IVI details from dedicated IPQC endpoint
            const iviRes = await apiFetch(`/api/rrh/ecn/ipqc/work-orders/${encodeURIComponent(woNum)}/ivi-details`);
            const iviData = iviRes?.data || iviRes;
            if (iviData) {
                woNum = iviData.work_order_id || woNum;
                woDate = iviData.work_order_date || woDate;
                lotQty = Number(iviData.lot_quantity) || lotQty;
                iviPassedCount = Number(iviData.ivi_passed_count) || iviPassedCount;
            }

            // Fallback for general work order info if needed
            if (!lotQty) {
                const res = await apiFetch(`/api/rrh/work-orders/${encodeURIComponent(woId)}`);
                const data = res?.data || res?.workOrder || res;
                if (data && (data.work_order_id || data.id)) {
                    woNum = data.work_order_id || String(data.id);
                    woDate = data.work_order_date || data.date || data.created_at || woDate;
                    lotQty = Number(data.lot_quantity) || lotQty;
                }
            }

            setSelectedWoDetails({
                work_order_id: woNum,
                work_order_date: woDate,
                lot_quantity: lotQty,
                ivi_passed_count: iviPassedCount
            });
        } catch (err: any) {
            console.error('Error fetching work order details:', err);
        } finally {
            setDetailsLoading(false);
        }
    };

    // ─── 4. Start or Resume Session ──────────────────────────────────────────
    const handleStartSession = async (woIdToStart?: string) => {
        const targetWo = woIdToStart || selectedWoId;
        if (!targetWo) {
            addToast('Please select a Work Order first.', 'warning');
            return;
        }

        try {
            const sessionData = await apiFetch('/api/rrh/ecn/ipqc/sessions', {
                method: 'POST',
                body: JSON.stringify({ work_order_id: targetWo })
            });

            loadActiveSessionDetails(sessionData.id);
            addToast(`IPQC session for Work Order ${targetWo} is active.`, 'success');
        } catch (err: any) {
            addToast(err.message || 'Failed to start IPQC session.', 'error');
        }
    };

    // ─── 5. Load Active Session Data ─────────────────────────────────────────
    const loadActiveSessionDetails = async (sessionId: string | number) => {
        try {
            const data = await apiFetch(`/api/rrh/ecn/ipqc/sessions/${sessionId}`);
            setActiveSession(data.session);
            setStats(data.stats);

            fetchScannedLogs(sessionId);
            fetchFailedInspections(sessionId);
            fetchRemainingMaster(sessionId);

            handleClear();
            setTimeout(() => {
                scannerInputRef.current?.focus();
            }, 300);
        } catch (err: any) {
            addToast(err.message || 'Error opening session.', 'error');
        }
    };

    // ─── 6. Fetch Scanned Logs, Failed Inspections & Remaining Master ─────────
    const fetchScannedLogs = async (sessionId: string | number, searchStr = scannedSearch, pageNum = scannedPage) => {
        try {
            const query = new URLSearchParams({
                search: searchStr.trim(),
                page: pageNum.toString(),
                limit: scannedLimit.toString()
            });
            const data = await apiFetch(`/api/rrh/ecn/ipqc/sessions/${sessionId}/inspections?${query.toString()}`);
            setScannedLogs(data?.data || []);
            setScannedTotal(data?.total || 0);
        } catch (err: any) {
            console.error('Error fetching scanned logs:', err);
        }
    };

    const fetchFailedInspections = async (sessionId: string | number) => {
        setFailedLoading(true);
        try {
            const data = await apiFetch(`/api/rrh/ecn/ipqc/sessions/${sessionId}/failed-inspections`);
            setFailedInspections(data?.data || []);
        } catch (err: any) {
            console.error('Error fetching failed inspections:', err);
        } finally {
            setFailedLoading(false);
        }
    };

    const filteredFailedInspections = useMemo(() => {
        if (!failedSearch.trim()) return failedInspections;
        const q = failedSearch.trim().toLowerCase();
        return failedInspections.filter(item => {
            return (
                (item.band_serial_no && item.band_serial_no.toLowerCase().includes(q)) ||
                (item.serial_number && item.serial_number.toLowerCase().includes(q)) ||
                (item.physical_tpn && item.physical_tpn.toLowerCase().includes(q)) ||
                (item.tejas_dc_no && item.tejas_dc_no.toLowerCase().includes(q)) ||
                (item.tejas_obd_no && item.tejas_obd_no.toLowerCase().includes(q)) ||
                (item.band && item.band.toLowerCase().includes(q)) ||
                (item.pam_tpn && item.pam_tpn.toLowerCase().includes(q)) ||
                (item.rfpc_tpn && item.rfpc_tpn.toLowerCase().includes(q)) ||
                (item.remarks && item.remarks.toLowerCase().includes(q)) ||
                (item.scanned_by && item.scanned_by.toLowerCase().includes(q))
            );
        });
    }, [failedInspections, failedSearch]);

    const failedTotalPages = Math.max(1, Math.ceil(filteredFailedInspections.length / failedLimit));
    const paginatedFailedInspections = useMemo(() => {
        const start = (failedPage - 1) * failedLimit;
        return filteredFailedInspections.slice(start, start + failedLimit);
    }, [filteredFailedInspections, failedPage, failedLimit]);

    const handleReinspectFailedRecord = (row: ScannedProductLog) => {
        const serial = row.band_serial_no || row.serial_number;
        setScannerInput(serial);
        if (inspectionFormRef.current) {
            inspectionFormRef.current.scrollIntoView({ behavior: 'smooth' });
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        handleSerialLookup(serial, false, row);
        setFailedModalRecord(null);

        setTimeout(() => {
            scannerInputRef.current?.focus({ preventScroll: true });
        }, 150);

        addToast(`Loaded failed serial ${serial} for re-inspection.`, 'info');
    };

    const handleInspectRemainingUnit = (serial: string) => {
        if (!serial) return;
        setScannerInput(serial);
        if (inspectionFormRef.current) {
            inspectionFormRef.current.scrollIntoView({ behavior: 'smooth' });
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        handleSerialLookup(serial, false);
        setTimeout(() => {
            scannerInputRef.current?.focus({ preventScroll: true });
        }, 150);
    };

    const fetchRemainingMaster = async (sessionId: string | number, searchStr = remainingSearch, pageNum = remainingPage, limitNum = remainingLimit) => {
        setRemainingLoading(true);
        try {
            const query = new URLSearchParams({
                search: searchStr.trim(),
                page: pageNum.toString(),
                limit: limitNum.toString()
            });
            const data = await apiFetch(`/api/rrh/ecn/ipqc/sessions/${sessionId}/remaining-master-data?${query.toString()}`);
            setRemainingList(data?.data || []);
            setRemainingTotal(data?.total || 0);
        } catch (err: any) {
            console.error('Error fetching remaining master data:', err);
        } finally {
            setRemainingLoading(false);
        }
    };

    // ─── 7. Serial Lookup / Scan ──────────────────────────────────────────────
    const handleSerialLookup = async (serialToScan?: string, isAutoLookup = false, preloadedFailedRow?: ScannedProductLog | null) => {
        const serial = (serialToScan || scannerInput).trim().toUpperCase();
        if (!serial) {
            if (!isAutoLookup) {
                addToast('Please enter or scan a serial number / barcode.', 'warning');
            }
            return;
        }

        if (!activeSession) return;

        setIsSearchingSerial(true);
        try {
            const query = new URLSearchParams({
                serial,
                work_order_id: activeSession.work_order_id,
                session_id: activeSession.id.toString()
            });

            const data = await apiFetch(`/api/rrh/ecn/ipqc/lookup?${query.toString()}`);

            if (!data.found) {
                if (!isAutoLookup) {
                    addToast(data.message || `Serial "${serial}" not found in passed IVI units.`, 'error');
                }
                return;
            }

            const resolvedSerial = (data.band_serial_no || data.serial_number || serial).toUpperCase();
            setScannerInput(resolvedSerial);

            setLoadedUnit({
                serial_number: data.serial_number,
                band_serial_no: data.band_serial_no || data.serial_number,
                physical_tpn: data.physical_tpn || '—',
                band: data.band || getBandFromTpn(data.physical_tpn),
                bat_lot_no: data.bat_lot_no || '—',
                tejas_dc_no: data.tejas_dc_no || '—',
                tejas_obd_no: data.tejas_obd_no || '—',
                duplexer_main: data.duplexer_main || '—',
                duplexer_part_no: data.duplexer_part_no || '—',
                rrh_unit: data.rrh_unit || 'no defect',
                ivi_status: data.ivi_status || 'PASS',
                ivi_inspected_by: data.ivi_inspected_by || 'System Admin',
                pam_tpn: '',
                pam1: '',
                pam2: '',
                pam3: '',
                pam4: '',
                rfpc_tpn: '',
                rfpc_sl_no: '',
                ivi_id: data.ivi_id,
                sl_no: data.sl_no
            });

            const prev = preloadedFailedRow || (data.already_inspected && data.previous_inspection?.status === 'FAIL' ? data.previous_inspection : null);

            let savedCps: any[] = [];
            if (prev?.checkpoints) {
                try {
                    savedCps = typeof prev.checkpoints === 'string' ? JSON.parse(prev.checkpoints) : prev.checkpoints;
                    if (typeof savedCps === 'string') savedCps = JSON.parse(savedCps);
                } catch (e) {
                    savedCps = [];
                }
            }

            if (prev) {
                // Restore checkpoints like IVI: previously passed remain PASS & confirmed; previously failed remain FAIL & confirmed with failure remark
                const reCheckpoints: CheckpointItemState[] = createInitialCheckpoints().map(def => {
                    const match = Array.isArray(savedCps) ? savedCps.find((c: any) => c.id === def.id || c.title === def.title) : null;
                    if (match) {
                        if (match.status === 'FAIL') {
                            return {
                                ...def,
                                selectedStatus: 'FAIL',
                                confirmedStatus: 'FAIL',
                                confirmed: true,
                                remark: match.remark || prev.remarks || '',
                                previousFailureRemark: match.remark || prev.remarks || ''
                            };
                        } else if (match.status === 'PASS') {
                            return {
                                ...def,
                                selectedStatus: 'PASS',
                                confirmedStatus: 'PASS',
                                confirmed: true,
                                remark: '',
                                previousFailureRemark: undefined
                            };
                        }
                    }
                    return def;
                });

                setCheckpoints(reCheckpoints);

                // Restore previously entered tracking details so operator doesn't have to re-type all 7 serials
                setInspectionDate(prev.inspection_date ? formatTableDate(prev.inspection_date) : getTodayLocalDate());
                setELabel(prev.e_label || '');
                setPamTpn(prev.pam_tpn || '');
                setPam1(prev.pam1 || '');
                setPam2(prev.pam2 || '');
                setPam3(prev.pam3 || '');
                setPam4(prev.pam4 || '');
                setRfpcTpn(prev.rfpc_tpn || '');
                setRfpcSlNo(prev.rfpc_sl_no || '');
                setGeneralRemarks(prev.remarks || '');

                setReinspectionInfo({
                    isReinspected: true,
                    previousFailureRemarks: prev.remarks || 'Previous inspection was marked as FAIL.'
                });

                addToast(`Unit "${resolvedSerial}" loaded in RE-INSPECTION mode. Review and confirm resolution of failed checkpoint(s).`, 'warning');
            } else {
                setInspectionDate(getTodayLocalDate());
                setELabel('');
                setPamTpn('');
                setPam1('');
                setPam2('');
                setPam3('');
                setPam4('');
                setRfpcTpn('');
                setRfpcSlNo('');
                setGeneralRemarks('');
                setCheckpoints(createInitialCheckpoints());
                setReinspectionInfo(null);
                addToast(`Unit "${resolvedSerial}" loaded successfully.`, 'success');
            }
        } catch (err: any) {
            if (!isAutoLookup) {
                addToast(err.message || 'Failed to lookup serial details.', 'error');
            }
        } finally {
            setIsSearchingSerial(false);
            scannerInputRef.current?.focus({ preventScroll: true });
        }
    };

    // ─── Auto-lookup serial without pressing enter (debounced 300ms) ───────────
    useEffect(() => {
        if (!activeSession) return;
        const clean = scannerInput.trim().toUpperCase();
        if (!clean) {
            return;
        }

        // If already loaded this exact serial, do not re-lookup
        if (loadedUnit && (loadedUnit.serial_number?.toUpperCase() === clean || loadedUnit.band_serial_no?.toUpperCase() === clean)) {
            return;
        }

        if (clean.length < 3) return;

        const timer = setTimeout(() => {
            handleSerialLookup(clean, true);
        }, 300);

        return () => clearTimeout(timer);
    }, [scannerInput, activeSession, loadedUnit]);

    // ─── 8. Checkpoint Handlers ───────────────────────────────────────────────
    const handleSelectStatus = (pointId: number, status: 'PASS' | 'FAIL') => {
        setCheckpoints(prev =>
            prev.map(c => {
                if (c.id !== pointId) return c;
                return {
                    ...c,
                    selectedStatus: status,
                    remark: status === 'FAIL' && !c.remark && c.previousFailureRemark ? c.previousFailureRemark : c.remark,
                    confirmed: false,
                    confirmedStatus: null
                };
            })
        );
    };

    const handleRemarkChange = (pointId: number, remark: string) => {
        setCheckpoints(prev =>
            prev.map(c => (c.id === pointId ? { ...c, remark } : c))
        );
    };

    const handleConfirmPoint = (pointId: number, status: 'PASS' | 'FAIL') => {
        const item = checkpoints.find(c => c.id === pointId);
        if (!item) return;

        if (status === 'FAIL' && (!item.remark || !item.remark.trim())) {
            addToast(`Please enter a failure remark for checkpoint #${pointId}.`, 'warning');
            return;
        }

        setCheckpoints(prev =>
            prev.map(c => {
                if (c.id !== pointId) return c;
                return {
                    ...c,
                    confirmed: true,
                    confirmedStatus: status
                };
            })
        );

        addToast(`Checkpoint #${pointId} confirmed as ${status}.`, 'info');
    };

    // ─── 9. Submit Inspection ────────────────────────────────────────────────
    const handleSubmitInspection = async () => {
        if (!activeSession) return;

        if (!loadedUnit) {
            addToast('Please scan or select a unit first.', 'warning');
            return;
        }

        if (!pamTpn.trim()) {
            addToast('1. PAM TPN is required (*). Please scan or type it.', 'warning');
            return;
        }
        if (!pam1.trim()) {
            addToast('2. PAM 1 is required (*). Please scan or type it.', 'warning');
            return;
        }
        if (!pam2.trim()) {
            addToast('3. PAM 2 is required (*). Please scan or type it.', 'warning');
            return;
        }
        if (!pam3.trim()) {
            addToast('4. PAM 3 is required (*). Please scan or type it.', 'warning');
            return;
        }
        if (!pam4.trim()) {
            addToast('5. PAM 4 is required (*). Please scan or type it.', 'warning');
            return;
        }
        if (!rfpcTpn.trim()) {
            addToast('6. RFPC TPN is required (*). Please scan or type it.', 'warning');
            return;
        }
        if (!rfpcSlNo.trim()) {
            addToast('7. RFPC Sl No. is required (*). Please scan or type it.', 'warning');
            return;
        }

        const unconfirmed = checkpoints.filter(c => !c.confirmed);
        if (unconfirmed.length > 0) {
            addToast(`Please confirm all 7 checkpoints. Remaining: ${unconfirmed.map(c => `#${c.id}`).join(', ')}`, 'warning');
            return;
        }

        const missingRemarks = checkpoints.filter(c => c.confirmedStatus === 'FAIL' && (!c.remark || !c.remark.trim()));
        if (missingRemarks.length > 0) {
            addToast(`Please provide failure remarks for checkpoints: ${missingRemarks.map(c => `#${c.id}`).join(', ')}`, 'warning');
            return;
        }

        setIsSubmittingInspection(true);
        try {
            const formattedCheckpoints = checkpoints.map(c => ({
                id: c.id,
                title: c.title,
                status: c.confirmedStatus,
                remark: c.remark || '',
                confirmed: true,
                previousFailureRemark: c.previousFailureRemark
            }));

            const payload = {
                work_order_id: activeSession.work_order_id,
                serial_number: loadedUnit.band_serial_no || loadedUnit.serial_number,
                band_serial_no: loadedUnit.band_serial_no,
                physical_serial_number: loadedUnit.band_serial_no || loadedUnit.serial_number,
                physical_tpn: loadedUnit.physical_tpn,
                band: loadedUnit.band,
                inspection_date: inspectionDate,
                e_label: eLabel,
                pam_tpn: pamTpn,
                pam1,
                pam2,
                pam3,
                pam4,
                rfpc_tpn: rfpcTpn,
                rfpc_sl_no: rfpcSlNo,
                remarks: generalRemarks,
                ivi_inspection_id: loadedUnit.ivi_id,
                sl_no: loadedUnit.sl_no,
                checkpoints: formattedCheckpoints
            };

            const data = await apiFetch(`/api/rrh/ecn/ipqc/sessions/${activeSession.id}/inspections`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            const resultStatus = data.inspection?.status || 'COMPLETED';
            addToast(`Inspection submitted successfully (${resultStatus}) for ${loadedUnit.band_serial_no}!`, 'success');

            handleClear();
            loadActiveSessionDetails(activeSession.id);

            setTimeout(() => {
                scannerInputRef.current?.focus();
            }, 300);
        } catch (err: any) {
            addToast(err.message || 'Error submitting inspection.', 'error');
        } finally {
            setIsSubmittingInspection(false);
        }
    };

    const handleClear = () => {
        setLoadedUnit(null);
        setScannerInput('');
        setInspectionDate(getTodayLocalDate());
        setELabel('');
        setPamTpn('');
        setPam1('');
        setPam2('');
        setPam3('');
        setPam4('');
        setRfpcTpn('');
        setRfpcSlNo('');
        setGeneralRemarks('');
        setReinspectionInfo(null);
        setCheckpoints(createInitialCheckpoints());
        scannerInputRef.current?.focus();
    };

    // ─── 10. Excel Export Handlers ─────────────────────────────────────────────
    const handleExportSessionExcel = async (session: any) => {
        if (!session?.id) {
            addToast('No session selected to export.', 'warning');
            return;
        }
        try {
            const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
            const res = await fetch(`/api/rrh/ecn/ipqc/sessions/${session.id}/export`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });

            if (!res.ok) {
                let errText = 'Failed to export session report.';
                try {
                    const errJson = await res.json();
                    if (errJson?.message) errText = errJson.message;
                } catch { }
                throw new Error(errText);
            }

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `RRH_IPQC_Session_Report_${session.work_order_id || session.id}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            addToast('IPQC session report downloaded successfully.', 'success');
        } catch (err: any) {
            addToast(err.message || 'Failed to export session report.', 'error');
        }
    };

    const handleExportExcel = async (type?: 'PASS' | 'FAIL') => {
        if (!activeSession) return;
        try {
            const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
            const urlPath = type === 'FAIL'
                ? `/api/rrh/ecn/ipqc/sessions/${activeSession.id}/export?type=FAIL`
                : `/api/rrh/ecn/ipqc/sessions/${activeSession.id}/export`;
            const res = await fetch(urlPath, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });

            if (!res.ok) throw new Error('Failed to export Excel.');

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = type === 'FAIL'
                ? `RRH_IPQC_Failed_Inspections_${activeSession.work_order_id}.xlsx`
                : `RRH_IPQC_Recent_Inspections_${activeSession.work_order_id}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            addToast(`${type === 'FAIL' ? 'Failed' : 'Recent'} inspections Excel downloaded.`, 'success');
        } catch (err: any) {
            addToast(err.message || 'Export failed.', 'error');
        }
    };

    const handleExportUnscannedExcel = async (customSessionId?: string | number, customWoId?: string) => {
        const sId = customSessionId || activeSession?.id;
        const woId = customWoId || activeSession?.work_order_id || 'Unknown';
        if (!sId) return;

        try {
            const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
            const res = await fetch(`/api/rrh/ecn/ipqc/sessions/${sId}/export-unscanned`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });

            if (!res.ok) {
                let errText = 'Failed to export unscanned master data.';
                try {
                    const errJson = await res.json();
                    if (errJson?.message) errText = errJson.message;
                } catch { }
                throw new Error(errText);
            }

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `RRH_IPQC_Unscanned_Master_${woId}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            addToast('Excel downloaded successfully.', 'success');
        } catch (err: any) {
            addToast(err.message || 'Export failed.', 'error');
        }
    };

    // ─── 11. Session Delete Handler ───────────────────────────────────────────
    const handleDeleteSession = async (sessionId: string | number, woId: string) => {
        if (!window.confirm(`Are you sure you want to delete IPQC session for Work Order "${woId}"?`)) {
            return;
        }

        try {
            await apiFetch(`/api/rrh/ecn/ipqc/sessions/${sessionId}`, { method: 'DELETE' });
            addToast(`Session for ${woId} deleted successfully.`, 'success');
            fetchActiveSessions();
            fetchCompletedSessions();
            fetchEligibleWorkOrders();
        } catch (err: any) {
            addToast(err.message || 'Error deleting session.', 'error');
        }
    };

    // ─── 12. Complete Session ─────────────────────────────────────────────────
    const handleCompleteSession = async () => {
        if (!activeSession) return;
        if (!window.confirm(`Mark session for Work Order "${activeSession.work_order_id}" as Completed?`)) {
            return;
        }

        try {
            await apiFetch(`/api/rrh/ecn/ipqc/sessions/${activeSession.id}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status: 'Completed' })
            });

            addToast(`Session for ${activeSession.work_order_id} marked as Completed.`, 'success');
            setActiveSession(null);
            fetchActiveSessions();
            fetchCompletedSessions();
            fetchEligibleWorkOrders();
        } catch (err: any) {
            addToast(err.message || 'Error completing session.', 'error');
        }
    };

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

    // ─── RENDER VIEW 1: Session Setup & Work Order Selection (EXACT IVI LAYOUT) ───
    if (!activeSession) {
        return (
            <div className={styles.container}>
                <Toaster toasts={toasts} onRemove={removeToast} />

                {/* Page Title & Subtitle (Exact IVI style) */}
                <div className={styles.header}>
                    <h2>RRH IPQC (In-Process Quality Control)</h2>
                    <p>Perform and record in-process quality control inspections for RRH mechanical parts and assemblies.</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
                    {/* Card 1: Select Work Order */}
                    <div className={styles.card} style={{ marginBottom: '0' }}>
                        <h3>Select Work Order</h3>
                        <div className={styles.inputGroup} style={{ maxWidth: '480px' }}>
                            <WorkOrderSelector
                                options={availableWorkOrders}
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
                                                {selectedWoDetails.work_order_id}
                                            </span>
                                        </div>
                                        <div className={styles.infoItem}>
                                            <span className={styles.infoLabel}>Work Order Date</span>
                                            <span className={styles.infoValue} style={{ fontSize: '1.05rem' }}>
                                                {formatWoDateTime(selectedWoDetails.work_order_date)}
                                            </span>
                                        </div>
                                        <div className={styles.infoItem}>
                                            <span className={styles.infoLabel}>Lot Quantity</span>
                                            <span className={styles.infoValue} style={{ fontSize: '1.25rem', fontWeight: 800, color: '#4f46e5' }}>
                                                {selectedWoDetails.lot_quantity}
                                            </span>
                                        </div>
                                        <div className={styles.infoItem}>
                                            <span className={styles.infoLabel}>IVI Passed Units</span>
                                            <span className={styles.infoValue} style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981' }}>
                                                {selectedWoDetails.ivi_passed_count ?? 0}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                                <button
                                    onClick={() => handleStartSession(selectedWoId)}
                                    className={styles.button}
                                    style={{ padding: '0.85rem 3rem', fontSize: '1.05rem', letterSpacing: '0.5px' }}
                                >
                                    Start IPQC Session
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className={styles.card} style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b', border: '1px dashed #cbd5e1' }}>
                            Please select an eligible RRH Work Order to view Lot Quantity and start an IPQC session.
                        </div>
                    )}

                    {/* Card 2: Active IPQC Sessions (Exact IVI Columns, Buttons & Badges) */}
                    <div className={styles.card}>
                        <h3>Active IPQC Sessions</h3>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1, maxWidth: '400px' }}>
                                <input
                                    type="text"
                                    className={styles.input}
                                    placeholder="Search active sessions by WO ID.."
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
                                                <th>WORK ORDER NUMBER</th>
                                                <th>STARTED BY</th>
                                                <th>STARTED AT</th>
                                                <th>STATUS</th>
                                                <th>ACTION</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {activeSessions.map(session => (
                                                <tr key={session.id}>
                                                    <td style={{ fontWeight: 700, color: '#4f46e5' }}>{session.work_order_id}</td>
                                                    <td>{session.created_by_name || session.created_by || 'System Admin'}</td>
                                                    <td style={{ fontSize: '0.85rem', color: '#64748b' }}>{formatTimestamp(session.created_at)}</td>
                                                    <td>{getStatusBadge(session.status)}</td>
                                                    <td style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                        <button
                                                            className={styles.secondaryButton}
                                                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', backgroundColor: '#eef2ff', color: '#4338ca', borderColor: '#c7d2fe', fontWeight: 600 }}
                                                            onClick={() => loadActiveSessionDetails(session.id)}
                                                        >
                                                            View Details / Resume
                                                        </button>
                                                        <button
                                                            className={styles.secondaryButton}
                                                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                            onClick={() => handleExportSessionExcel(session)}
                                                            title="Download Session Report Excel"
                                                        >
                                                            Download Excel
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
                                            {activeSessions.length === 0 && (
                                                <tr>
                                                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                                        No active IPQC sessions found. Select a Work Order above to begin.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', fontSize: '0.85rem', color: '#64748b' }}>
                                    <span>Showing {activeSessions.length} of {activeTotal} sessions</span>
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

                    {/* Card 3: Completed IPQC Sessions History */}
                    <div className={styles.card}>
                        <h3>Completed IPQC Sessions History</h3>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1, maxWidth: '400px' }}>
                                <input
                                    type="text"
                                    className={styles.input}
                                    placeholder="Search completed sessions..."
                                    value={completedSearch}
                                    onChange={e => setCompletedSearch(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            setCompletedPage(1);
                                            fetchCompletedSessions(1, completedLimit, completedSearch);
                                        }
                                    }}
                                    style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                                />
                                <button
                                    className={styles.button}
                                    onClick={() => {
                                        setCompletedPage(1);
                                        fetchCompletedSessions(1, completedLimit, completedSearch);
                                    }}
                                    style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                                >
                                    Search
                                </button>
                                {completedSearch && (
                                    <button
                                        className={styles.secondaryButton}
                                        onClick={() => {
                                            setCompletedSearch('');
                                            setCompletedPage(1);
                                            fetchCompletedSessions(1, completedLimit, '');
                                        }}
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
                                        <th>WORK ORDER NUMBER</th>
                                        <th>STARTED BY</th>
                                        <th>COMPLETED AT</th>
                                        <th>STATUS</th>
                                        <th>ACTION</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {completedSessions.map(session => (
                                        <tr key={session.id}>
                                            <td style={{ fontWeight: 600, color: '#334155' }}>{session.work_order_id}</td>
                                            <td>{session.created_by_name || session.created_by || 'System Admin'}</td>
                                            <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                                {formatTimestamp(session.created_at)}
                                            </td>
                                            <td>
                                                {getStatusBadge(session.status)}
                                            </td>
                                            <td style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                <button
                                                    className={styles.secondaryButton}
                                                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                                                    onClick={() => loadActiveSessionDetails(session.id)}
                                                >
                                                    View Details
                                                </button>
                                                <button
                                                    className={styles.secondaryButton}
                                                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                    onClick={() => handleExportSessionExcel(session)}
                                                    title="Download Session Report Excel"
                                                >
                                                    Download Excel
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {completedSessions.length === 0 && (
                                        <tr>
                                            <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                                No completed IPQC sessions found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', fontSize: '0.85rem', color: '#64748b' }}>
                            <span>Showing {completedSessions.length} of {completedTotal} sessions</span>
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
            </div>
        );
    }

    // ─── RENDER VIEW 2: Active Inspection Session Page (Photos 1 & 2) ────────
    return (
        <div className={styles.container}>
            <Toaster toasts={toasts} onRemove={removeToast} />

            {/* Top Navigation & Info (SMT Pre-AOI detailHeaderCard style matching IVI) */}
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
                            RRH In-Process Quality Control — Active Session
                        </h3>
                        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', marginTop: '0.75rem', color: '#374151', fontSize: '0.95rem', flexWrap: 'wrap' }}>
                            <span>Work Order: <strong style={{ color: '#4f46e5' }}>{activeSession.work_order_id}</strong></span>
                            <span>Session ID: <strong>{activeSession.id}</strong></span>
                            <span>Date: <strong>{formatWoDateTime(activeSession.work_order_date || activeSession.date || selectedWoDetails?.date || selectedWoDetails?.work_order_date || activeSession.created_at)}</strong></span>
                            <span>Status: {getStatusBadge(activeSession.status)}</span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <button
                            className={styles.secondaryButton}
                            onClick={handleCompleteSession}
                            style={{
                                padding: '0.5rem 1rem',
                                fontSize: '0.85rem',
                                borderRadius: '0.5rem',
                                backgroundColor: '#ffffff',
                                border: '1px solid #cbd5e1',
                                cursor: 'pointer',
                                fontWeight: 600,
                                color: '#1e293b'
                            }}
                            disabled={activeSession.status === 'Completed'}
                        >
                            Complete Session
                        </button>
                        <button
                            className={styles.downloadMasterButton}
                            onClick={() => handleExportUnscannedExcel()}
                            style={{
                                padding: '0.5rem 1rem',
                                fontSize: '0.85rem',
                                borderRadius: '0.5rem',
                                backgroundColor: '#ffffff',
                                border: '1px solid #cbd5e1',
                                cursor: 'pointer',
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                color: '#1e293b'
                            }}
                            title="Download master unscanned data Excel"
                        >
                            <Download size={14} /> Download Master File
                        </button>
                        <button
                            className={styles.detailBackButton}
                            onClick={() => { setActiveSession(null); fetchActiveSessions(); fetchCompletedSessions(); }}
                        >
                            ← Back to Session Setup
                        </button>
                    </div>
                </div>
            </div>

            {/* Summary Statistics Dashboard Cards (SMT Pre-AOI Card style) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                <div className={styles.card} style={{ margin: 0, padding: '1.25rem', borderLeft: '5px solid #2563eb', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>Lot Quantity</p>
                    <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.8rem', color: '#1e293b', fontWeight: 800 }}>{stats.lotQuantity || activeSession.lot_quantity || selectedWoDetails?.lot_quantity || 0}</h2>
                </div>
                <div className={styles.card} style={{ margin: 0, padding: '1.25rem', borderLeft: '5px solid #8b5cf6', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>Remaining Lot Quantity</p>
                    <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.8rem', color: '#6d28d9', fontWeight: 800 }}>{stats.pending ?? Math.max(0, (stats.lotQuantity || activeSession.lot_quantity || selectedWoDetails?.lot_quantity || 0) - stats.passed)}</h2>
                </div>
                <div className={styles.card} style={{ margin: 0, padding: '1.25rem', borderLeft: '5px solid #0ea5e9', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>IVI Passed</p>
                    <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.8rem', color: '#0284c7', fontWeight: 800 }}>{stats.iviPassed ?? 0}</h2>
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

            {/* ─── MAIN INSPECTION CARD (High-Speed Scanner Feature Matching IVI) ────── */}
            <div ref={inspectionFormRef} className={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '8px' }}>
                    <h3 className={styles.inspectionTitle} style={{ margin: 0 }}>
                        RRH IPQC (In-Process Quality Control)
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#16a34a', fontWeight: 600 }}>
                        <span className={styles.blinkingDot} style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16a34a', display: 'inline-block' }}></span>
                        Scanner Ready
                    </div>
                </div>

                {/* Scanner Row (Autofill disabled to prevent browser Save Vehicle prompts) */}
                <div className={styles.detailScanForm} style={{ marginBottom: '1.25rem' }}>
                    <div className={styles.detailScanRow}>
                        <input
                            ref={scannerInputRef}
                            type="text"
                            name="rrh_ipqc_scanner_input"
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck={false}
                            data-lpignore="true"
                            data-form-type="other"
                            className={styles.detailScanInput}
                            placeholder="Scan Barcode or enter Serial Number to load Band Serial..."
                            value={scannerInput}
                            onChange={e => {
                                const val = e.target.value;
                                setScannerInput(val);
                                if (loadedUnit && val.trim().toUpperCase() !== loadedUnit.band_serial_no?.toUpperCase() && val.trim().toUpperCase() !== loadedUnit.serial_number?.toUpperCase()) {
                                    setLoadedUnit(null);
                                }
                            }}
                            onKeyDown={e => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSerialLookup();
                                }
                            }}
                            disabled={isSearchingSerial || isSubmittingInspection}
                            autoFocus
                        />
                        <button
                            type="button"
                            className={styles.detailScanButton}
                            onClick={() => handleSerialLookup()}
                            disabled={isSearchingSerial || isSubmittingInspection || !scannerInput.trim()}
                        >
                            {isSearchingSerial ? 'Scanning...' : 'Submit Scan'}
                        </button>
                        <button
                            type="button"
                            className={styles.clearButton}
                            style={{ height: '52px', padding: '0 1.5rem' }}
                            onClick={handleClear}
                            title="Clear Barcode / Serial Number and Form"
                        >
                            Clear
                        </button>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                        Scan barcode directly using scanner gun or enter manually to retrieve Band Serial and Work Order details automatically. You can also click "Inspect Unit" in the Remaining Master Data table below.
                    </p>
                </div>

                {!loadedUnit && (
                    <div style={{
                        padding: '2.5rem 1.5rem',
                        textAlign: 'center',
                        background: '#f8fafc',
                        border: '2px dashed #cbd5e1',
                        borderRadius: '0.75rem',
                        color: '#64748b',
                        marginTop: '1rem'
                    }}>
                        <p style={{ fontSize: '1.05rem', fontWeight: 600, color: '#334155', margin: '0 0 0.5rem 0' }}>
                            Ready for Unit Inspection
                        </p>
                        <p style={{ fontSize: '0.9rem', margin: 0 }}>
                            Scan a barcode gun, enter a Serial / Band Serial number above, or click <strong style={{ color: '#0ea5e9' }}>"Inspect Unit"</strong> in the Remaining Master Data table below.
                        </p>
                    </div>
                )}

                {loadedUnit && (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '1.5rem 0 1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
                            <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#111827' }}>
                                Unit Readout & Master Data
                            </h4>
                            <button
                                type="button"
                                className={styles.cancelClearButton}
                                onClick={handleClear}
                            >
                                Cancel / Clear Form
                            </button>
                        </div>

                        {/* Unit Readout Info Box (Photo 2) */}
                        <div className={styles.scannedInfoPanel}>
                            <div className={styles.scannedInfoGridRow1}>
                                <div className={styles.scannedInfoItem}>
                                    <span className={styles.scannedInfoLabel}>Band Serial No</span>
                                    <span className={styles.scannedInfoValue}>{loadedUnit.band_serial_no}</span>
                                </div>
                                <div className={styles.scannedInfoItem}>
                                    <span className={styles.scannedInfoLabel}>Physical TPN</span>
                                    <span className={styles.scannedInfoValue}>{loadedUnit.physical_tpn}</span>
                                </div>
                                <div className={styles.scannedInfoItem}>
                                    <span className={styles.scannedInfoLabel}>Band</span>
                                    <span className={`${styles.scannedInfoValue} ${styles.bandText}`}>{loadedUnit.band}</span>
                                </div>
                                <div className={styles.scannedInfoItem}>
                                    <span className={styles.scannedInfoLabel}>BAT Lot No</span>
                                    <span className={styles.scannedInfoValue}>{loadedUnit.bat_lot_no}</span>
                                </div>
                                <div className={styles.scannedInfoItem}>
                                    <span className={styles.scannedInfoLabel}>Tejas DC No</span>
                                    <span className={styles.scannedInfoValue}>{loadedUnit.tejas_dc_no}</span>
                                </div>
                                <div className={styles.scannedInfoItem}>
                                    <span className={styles.scannedInfoLabel}>Tejas OBD No</span>
                                    <span className={styles.scannedInfoValue}>{loadedUnit.tejas_obd_no}</span>
                                </div>
                                <div className={styles.scannedInfoItem}>
                                    <span className={styles.scannedInfoLabel}>Duplexer Main (from IVI)</span>
                                    <span className={`${styles.scannedInfoValue} ${styles.duplexerText}`}>{loadedUnit.duplexer_main}</span>
                                </div>
                                <div className={styles.scannedInfoItem}>
                                    <span className={styles.scannedInfoLabel}>Duplexer Part No (from IVI)</span>
                                    <span className={`${styles.scannedInfoValue} ${styles.duplexerText}`}>{loadedUnit.duplexer_part_no}</span>
                                </div>
                            </div>

                            <div className={styles.scannedInfoGridRow2}>
                                <div className={styles.scannedInfoItem}>
                                    <span className={styles.scannedInfoLabel}>RRH Unit (from IVI)</span>
                                    <span className={styles.scannedInfoValue} style={{ color: loadedUnit.ivi_status === 'FAIL' ? '#2563eb' : undefined, fontWeight: loadedUnit.ivi_status === 'FAIL' ? 700 : undefined }}>
                                        {cleanDefectDescription(loadedUnit.rrh_unit) || (loadedUnit.ivi_status === 'FAIL' ? 'Defect noted' : 'no defect')}
                                    </span>
                                </div>
                                <div className={styles.scannedInfoItem}>
                                    <span className={styles.scannedInfoLabel}>IVI Status</span>
                                    <div>
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '0.2rem 0.6rem',
                                            borderRadius: '4px',
                                            fontSize: '0.8rem',
                                            fontWeight: 700,
                                            backgroundColor: loadedUnit.ivi_status === 'FAIL' ? '#eff6ff' : '#dcfce7',
                                            color: loadedUnit.ivi_status === 'FAIL' ? '#1d4ed8' : '#15803d',
                                            border: loadedUnit.ivi_status === 'FAIL' ? '1px solid #bfdbfe' : '1px solid #86efac'
                                        }}>
                                            {loadedUnit.ivi_status === 'FAIL' ? '✓ FAIL (Passed to IPQC)' : `✓ ${loadedUnit.ivi_status || 'PASS'}`}
                                        </span>
                                    </div>
                                </div>
                                <div className={styles.scannedInfoItem}>
                                    <span className={styles.scannedInfoLabel}>IVI Inspected By</span>
                                    <span className={styles.scannedInfoValue}>{loadedUnit.ivi_inspected_by || 'System Admin'}</span>
                                </div>
                            </div>
                        </div>

                        {/* IVI Defect Notice if unit failed in IVI */}
                        {loadedUnit.ivi_status === 'FAIL' && (
                            <div style={{
                                margin: '0.75rem 0 1rem',
                                padding: '0.85rem 1.25rem',
                                borderRadius: '0.5rem',
                                backgroundColor: '#eff6ff',
                                border: '1.5px solid #bfdbfe',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                color: '#1d4ed8'
                            }}>
                                <span style={{ fontSize: '1.35rem' }}>ℹ️</span>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e40af' }}>
                                        Unit Passed from IVI with FAIL Status
                                    </div>
                                    <div style={{ fontSize: '0.85rem', marginTop: '2px', color: '#1d4ed8' }}>
                                        IVI Stage Defect: <strong style={{ color: '#1e40af' }}>"{cleanDefectDescription(loadedUnit.rrh_unit) || (loadedUnit as any).ivi_remarks || 'Visual inspection defect recorded'}"</strong>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Re-inspection Notice */}
                        {reinspectionInfo?.isReinspected && (
                            <div className={styles.reinspectionBanner}>
                                <AlertCircle size={20} />
                                <div>
                                    <strong>RE-INSPECTION MODE:</strong> This unit previously failed IPQC inspection. Review the previously failed checkpoints and confirm resolution.
                                    {reinspectionInfo.previousFailureRemarks && (
                                        <div style={{ fontSize: '0.85rem', marginTop: '0.2rem' }}>
                                            <em>Previous Remark:</em> {reinspectionInfo.previousFailureRemarks}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Unit & Component Tracking (Scan / Type) (Photo 1) */}
                        <div className={styles.trackingSection}>
                            <div className={styles.trackingHeaderRow}>
                                <h4 className={styles.trackingTitle}>
                                    🔍 Unit & Component Tracking (Scan / Type)
                                </h4>
                                <span className={styles.trackingBadge}>Barcode / Manual Entry</span>
                            </div>
                            <p className={styles.trackingSubtitle}>
                                Scan barcode labels directly into each field or manually type and press Enter before proceeding to inspection.
                            </p>

                            {/* Row 1 (2 Columns: Inspection Date, E-Label) */}
                            <div className={styles.formGrid2}>
                                <div className={styles.inputGroup}>
                                    <label className={styles.fieldLabel}>Inspection Date *</label>
                                    <input
                                        type="date"
                                        value={inspectionDate}
                                        onChange={e => setInspectionDate(e.target.value)}
                                        className={styles.formInput}
                                        autoComplete="off"
                                    />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label className={styles.fieldLabel}>E-Label (Scan / Type)</label>
                                    <input
                                        type="text"
                                        value={eLabel}
                                        onChange={e => setELabel(e.target.value)}
                                        placeholder="Scan or type E-Label..."
                                        className={styles.formInput}
                                        autoComplete="off"
                                        autoCorrect="off"
                                        autoCapitalize="off"
                                        spellCheck={false}
                                        data-lpignore="true"
                                    />
                                </div>
                            </div>

                            {/* Row 2 (6 Columns: PAM TPN, PAM 1-4, RFPC TPN) */}
                            <div className={styles.formGrid6}>
                                <div className={styles.inputGroup}>
                                    <label className={styles.fieldLabel}>1. PAM TPN *</label>
                                    <input
                                        type="text"
                                        value={pamTpn}
                                        onChange={e => setPamTpn(e.target.value)}
                                        placeholder="Scan or type PAM TPN..."
                                        className={styles.formInput}
                                        autoComplete="off"
                                        autoCorrect="off"
                                        autoCapitalize="off"
                                        spellCheck={false}
                                        data-lpignore="true"
                                    />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label className={styles.fieldLabel}>2. PAM 1 *</label>
                                    <input
                                        type="text"
                                        value={pam1}
                                        onChange={e => setPam1(e.target.value)}
                                        placeholder="Scan or type PAM 1..."
                                        className={styles.formInput}
                                        autoComplete="off"
                                        autoCorrect="off"
                                        autoCapitalize="off"
                                        spellCheck={false}
                                        data-lpignore="true"
                                    />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label className={styles.fieldLabel}>3. PAM 2 *</label>
                                    <input
                                        type="text"
                                        value={pam2}
                                        onChange={e => setPam2(e.target.value)}
                                        placeholder="Scan or type PAM 2..."
                                        className={styles.formInput}
                                        autoComplete="off"
                                        autoCorrect="off"
                                        autoCapitalize="off"
                                        spellCheck={false}
                                        data-lpignore="true"
                                    />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label className={styles.fieldLabel}>4. PAM 3 *</label>
                                    <input
                                        type="text"
                                        value={pam3}
                                        onChange={e => setPam3(e.target.value)}
                                        placeholder="Scan or type PAM 3..."
                                        className={styles.formInput}
                                        autoComplete="off"
                                        autoCorrect="off"
                                        autoCapitalize="off"
                                        spellCheck={false}
                                        data-lpignore="true"
                                    />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label className={styles.fieldLabel}>5. PAM 4 *</label>
                                    <input
                                        type="text"
                                        value={pam4}
                                        onChange={e => setPam4(e.target.value)}
                                        placeholder="Scan or type PAM 4..."
                                        className={styles.formInput}
                                        autoComplete="off"
                                        autoCorrect="off"
                                        autoCapitalize="off"
                                        spellCheck={false}
                                        data-lpignore="true"
                                    />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label className={styles.fieldLabel}>6. RFPC TPN *</label>
                                    <input
                                        type="text"
                                        value={rfpcTpn}
                                        onChange={e => setRfpcTpn(e.target.value)}
                                        placeholder="Scan or type RFPC TPN..."
                                        className={styles.formInput}
                                        autoComplete="off"
                                        autoCorrect="off"
                                        autoCapitalize="off"
                                        spellCheck={false}
                                        data-lpignore="true"
                                    />
                                </div>
                            </div>

                            {/* Row 3 (RFPC Sl No. + General Remarks) */}
                            <div className={styles.formGrid2}>
                                <div className={styles.inputGroup}>
                                    <label className={styles.fieldLabel}>7. RFPC Sl No. *</label>
                                    <input
                                        type="text"
                                        value={rfpcSlNo}
                                        onChange={e => setRfpcSlNo(e.target.value)}
                                        placeholder="Scan or type RFPC Sl No...."
                                        className={styles.formInput}
                                        autoComplete="off"
                                        autoCorrect="off"
                                        autoCapitalize="off"
                                        spellCheck={false}
                                        data-lpignore="true"
                                    />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label className={styles.fieldLabel}>Remarks</label>
                                    <input
                                        type="text"
                                        value={generalRemarks}
                                        onChange={e => setGeneralRemarks(e.target.value)}
                                        placeholder="General remarks (optional)..."
                                        className={styles.formInput}
                                        autoComplete="off"
                                        autoCorrect="off"
                                        autoCapitalize="off"
                                        spellCheck={false}
                                        data-lpignore="true"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Inspection Checklist (7 Items) (Photo 1) */}
                        <div className={styles.checklistSection}>
                            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#111827', margin: '0 0 1rem 0' }}>
                                Inspection Checklist
                            </h4>

                            {checkpoints.map(cp => {
                                const isPassActive = cp.selectedStatus === 'PASS';
                                const isFailActive = cp.selectedStatus === 'FAIL';

                                return (
                                    <div key={cp.id} className={styles.checklistItem}>
                                        <div className={styles.checklistItemHeader}>
                                            <h5 className={styles.checkpointTitle}>{cp.title}</h5>
                                            <div>
                                                {cp.confirmed ? (
                                                    cp.confirmedStatus === 'PASS' ? (
                                                        <span className={styles.badgeConfirmedPass}>✓ Confirmed PASS</span>
                                                    ) : (
                                                        <span className={styles.badgeConfirmedFail}>✕ Confirmed FAIL</span>
                                                    )
                                                ) : cp.previousFailureRemark ? (
                                                    <span style={{
                                                        backgroundColor: '#fee2e2',
                                                        color: '#991b1b',
                                                        border: '1px solid #fca5a5',
                                                        padding: '0.2rem 0.55rem',
                                                        borderRadius: '4px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 700,
                                                        textTransform: 'uppercase'
                                                    }}>
                                                        Previously Failed
                                                    </span>
                                                ) : (
                                                    <span className={styles.badgeInitial}>initial</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Checkpoint Selection Buttons & Defect Noted Directly Aside Fail Button */}
                                        <div className={styles.checkpointButtonsRow} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                <button
                                                    type="button"
                                                    className={`${styles.passSelectButton} ${isPassActive ? styles.passSelectButtonActive : ''}`}
                                                    onClick={() => handleSelectStatus(cp.id, 'PASS')}
                                                >
                                                    ✓ PASS
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`${styles.failSelectButton} ${isFailActive ? styles.failSelectButtonActive : ''}`}
                                                    onClick={() => handleSelectStatus(cp.id, 'FAIL')}
                                                >
                                                    ✕ FAIL
                                                </button>
                                            </div>

                                            {/* Defect entered by inspector shown directly aside the FAIL button */}
                                            {(cp.previousFailureRemark || (cp.confirmed && cp.confirmedStatus === 'FAIL' && cp.remark)) && (
                                                <div style={{
                                                    backgroundColor: isPassActive ? '#f0fdf4' : '#fef2f2',
                                                    border: isPassActive ? '1px solid #86efac' : '1px solid #fecaca',
                                                    borderRadius: '6px',
                                                    padding: '0.35rem 0.75rem',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    fontSize: '0.85rem'
                                                }}>
                                                    <span style={{
                                                        fontWeight: 700,
                                                        color: isPassActive ? '#15803d' : '#b91c1c'
                                                    }}>
                                                        {isPassActive ? 'Rectified Defect:' : 'Defect Noted:'}
                                                    </span>
                                                    <span style={{
                                                        color: '#1e293b',
                                                        fontWeight: 600,
                                                        textDecoration: isPassActive ? 'line-through' : 'none',
                                                        fontFamily: 'monospace'
                                                    }}>
                                                        "{isPassActive ? (cp.previousFailureRemark || cp.remark) : (cp.confirmed && cp.confirmedStatus === 'FAIL' && cp.remark ? cp.remark : cp.previousFailureRemark)}"
                                                    </span>
                                                    {isPassActive && (
                                                        <span style={{
                                                            marginLeft: '4px',
                                                            color: '#16a34a',
                                                            fontWeight: 700,
                                                            fontSize: '0.78rem'
                                                        }}>
                                                            (Resolved / Passing)
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Confirmation Box (Left aligned matching Confirm FAIL button) */}
                                        {isPassActive && !cp.confirmed && (
                                            <div className={styles.confirmBox} style={{ alignItems: 'flex-start', marginTop: '0.75rem' }}>
                                                <button
                                                    type="button"
                                                    className={styles.confirmPassButton}
                                                    onClick={() => handleConfirmPoint(cp.id, 'PASS')}
                                                >
                                                    ✓ Confirm PASS
                                                </button>
                                            </div>
                                        )}

                                        {/* Failure Remark Box (Closes upon confirming FAIL, matching Confirm PASS) */}
                                        {isFailActive && !cp.confirmed && (
                                            <div className={styles.confirmBox} style={{ alignItems: 'flex-start', marginTop: '0.75rem' }}>
                                                <textarea
                                                    rows={2}
                                                    placeholder="Enter remark for initial failure..."
                                                    value={cp.remark}
                                                    onChange={e => handleRemarkChange(cp.id, e.target.value)}
                                                    className={styles.checkpointRemarkTextarea}
                                                />
                                                <button
                                                    type="button"
                                                    className={styles.confirmFailButton}
                                                    onClick={() => handleConfirmPoint(cp.id, 'FAIL')}
                                                >
                                                    ✕ Confirm FAIL
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Submit Button (Final Status box strictly omitted as requested) */}
                            <button
                                className={styles.submitInspectionFullButton}
                                onClick={handleSubmitInspection}
                                disabled={isSubmittingInspection}
                            >
                                {isSubmittingInspection ? 'Submitting Inspection...' : 'Submit Inspection'}
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* ─── FAILED INSPECTIONS TABLE CARD (ONLY FAILED STATUS) ─────────────── */}
            <div className={styles.card} style={{ borderColor: '#fca5a5' }}>
                <div className={styles.recentHeader} style={{ marginBottom: '0.4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h3 className={styles.recentTitle} style={{ color: '#991b1b', margin: 0, paddingBottom: 0, borderBottom: 'none' }}>
                            Failed Inspections
                        </h3>
                        <span style={{
                            backgroundColor: '#fee2e2',
                            color: '#991b1b',
                            border: '1px solid #fca5a5',
                            padding: '0.2rem 0.65rem',
                            borderRadius: '9999px',
                            fontSize: '0.8rem',
                            fontWeight: 700
                        }}>
                            {failedInspections.length} Failed {failedInspections.length === 1 ? 'Unit' : 'Units'}
                        </span>
                    </div>

                    {/* Export Excel button for Failed Inspections */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                            type="button"
                            className={styles.secondaryButton}
                            style={{
                                backgroundColor: '#fef2f2',
                                color: '#991b1b',
                                borderColor: '#fca5a5',
                                fontWeight: 600,
                                fontSize: '0.85rem',
                                padding: '0.45rem 1rem'
                            }}
                            onClick={() => handleExportExcel('FAIL')}
                            disabled={failedInspections.length === 0}
                            title="Export failed inspections to Excel"
                        >
                            Export Excel
                        </button>
                    </div>
                </div>

                <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#64748b' }}>
                    Dedicated log for failed IPQC inspections. Use the <strong>Action</strong> buttons to view stage failure remarks or jump to failed checkpoints to correct and re-inspect.
                </p>

                {/* Search Bar for Failed Inspections */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem', maxWidth: '460px' }}>
                    <input
                        type="text"
                        className={styles.input}
                        placeholder="Search failed inspections (Serial, Defect, TPN, etc.)..."
                        value={failedSearch}
                        onChange={e => setFailedSearch(e.target.value)}
                        style={{ padding: '0.55rem 0.85rem', fontSize: '0.9rem', width: '100%' }}
                    />
                    {failedSearch && (
                        <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={() => setFailedSearch('')}
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
                                <th style={{ textAlign: 'center' }}>S.NO.</th>
                                <th>INSPECTED BY</th>
                                <th>DATE & TIME</th>
                                <th>BAND SERIAL NUMBER</th>
                                <th>PHYSICAL SERIAL NUMBER</th>
                                <th>PHYSICAL TPN</th>
                                <th>BAND</th>
                                <th>INSPECTION DATE</th>
                                <th>E-LABEL</th>
                                <th>PAM TPN</th>
                                <th>PAM 1</th>
                                <th>PAM 2</th>
                                <th>PAM 3</th>
                                <th>PAM 4</th>
                                <th>RFPC TPN</th>
                                <th>RFPC SL NO.</th>
                                <th style={{ minWidth: '180px' }}>FAILED STAGE REMARKS</th>
                                <th>STATUS</th>
                                <th>REMARKS</th>
                                <th style={{ minWidth: '180px', textAlign: 'center' }}>ACTION</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedFailedInspections.map((row, idx) => (
                                <tr key={`fail-${row.id || idx}`}>
                                    <td style={{ fontWeight: 600, color: '#64748b', textAlign: 'center' }}>
                                        {row.sl_no || (failedPage - 1) * failedLimit + idx + 1}
                                    </td>
                                    <td>{row.scanned_by || '—'}</td>
                                    <td style={{ fontSize: '0.85rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                                        {formatTimestamp(row.scanned_at)}
                                    </td>
                                    <td style={{ fontWeight: 700, color: '#0f766e', fontFamily: 'monospace' }}>
                                        {row.band_serial_no || row.serial_number}
                                    </td>
                                    <td style={{ fontWeight: 700, color: '#c2410c', fontFamily: 'monospace' }}>
                                        {row.physical_serial_number || row.band_serial_no || row.serial_number}
                                    </td>
                                    <td style={{ fontFamily: 'monospace' }}>{row.physical_tpn || '—'}</td>
                                    <td style={{ fontWeight: 700, color: '#2563eb' }}>
                                        {row.band || getBandFromTpn(row.physical_tpn)}
                                    </td>
                                    <td style={{ whiteSpace: 'nowrap' }}>
                                        {formatTableDate(row.inspection_date)}
                                    </td>
                                    <td>{row.e_label || '—'}</td>
                                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{row.pam_tpn || '—'}</td>
                                    <td style={{ fontFamily: 'monospace' }}>{row.pam1 || '—'}</td>
                                    <td style={{ fontFamily: 'monospace' }}>{row.pam2 || '—'}</td>
                                    <td style={{ fontFamily: 'monospace' }}>{row.pam3 || '—'}</td>
                                    <td style={{ fontFamily: 'monospace' }}>{row.pam4 || '—'}</td>
                                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{row.rfpc_tpn || '—'}</td>
                                    <td style={{ fontFamily: 'monospace' }}>{row.rfpc_sl_no || '—'}</td>
                                    <td style={{ color: '#b91c1c', fontWeight: 600, maxWidth: '240px' }}>
                                        {(() => {
                                            let cps: any[] = [];
                                            if (row.checkpoints) {
                                                try {
                                                    cps = typeof row.checkpoints === 'string' ? JSON.parse(row.checkpoints) : row.checkpoints;
                                                    if (typeof cps === 'string') cps = JSON.parse(cps);
                                                } catch { }
                                            }
                                            const fails = Array.isArray(cps) ? cps.filter((c: any) => c.status === 'FAIL') : [];
                                            if (fails.length > 0) {
                                                return (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                        {fails.map((f, i) => (
                                                            <span key={i} style={{ fontSize: '0.82rem' }}>
                                                                <strong>Point {f.id}:</strong> {f.remark || 'Defect noted'}
                                                            </span>
                                                        ))}
                                                    </div>
                                                );
                                            }
                                            return row.remarks || 'Defect noted';
                                        })()}
                                    </td>
                                    <td>
                                        <span className={styles.badgeFail}>FAIL</span>
                                    </td>
                                    <td style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.remarks || ''}>
                                        {row.remarks || '—'}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                                            <button
                                                type="button"
                                                className={styles.secondaryButton}
                                                style={{
                                                    padding: '0.35rem 0.65rem',
                                                    fontSize: '0.8rem',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    whiteSpace: 'nowrap'
                                                }}
                                                onClick={() => setFailedModalRecord(row)}
                                                title="View failed stage remarks and all S.No details"
                                            >
                                                Details
                                            </button>
                                            <button
                                                type="button"
                                                className={styles.button}
                                                style={{
                                                    padding: '0.35rem 0.75rem',
                                                    fontSize: '0.8rem',
                                                    backgroundColor: '#dc2626',
                                                    borderColor: '#b91c1c',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    whiteSpace: 'nowrap'
                                                }}
                                                onClick={() => handleReinspectFailedRecord(row)}
                                                title="Take to failed checkpoint to re-inspect and correct"
                                                disabled={activeSession.status === 'Completed'}
                                            >
                                                Re-inspect / Fix
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {failedLoading ? (
                                <tr>
                                    <td colSpan={20} style={{ textAlign: 'center', padding: '1.75rem', color: '#64748b' }}>
                                        Loading failed inspections...
                                    </td>
                                </tr>
                            ) : filteredFailedInspections.length === 0 ? (
                                <tr>
                                    <td colSpan={20} style={{ textAlign: 'center', padding: '1.75rem', color: '#16a34a', fontWeight: 600 }}>
                                        {failedSearch ? 'No matching failed inspections found for this search.' : 'No failed inspections recorded in this session.'}
                                    </td>
                                </tr>
                            ) : null}
                        </tbody>
                    </table>
                </div>

                {/* Failed Table Pagination */}
                {filteredFailedInspections.length > failedLimit && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                            Showing {(failedPage - 1) * failedLimit + 1} to {Math.min(failedPage * failedLimit, filteredFailedInspections.length)} of {filteredFailedInspections.length} failed entries
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                                type="button"
                                className={styles.secondaryButton}
                                onClick={() => setFailedPage(p => Math.max(1, p - 1))}
                                disabled={failedPage <= 1}
                                style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem', opacity: failedPage <= 1 ? 0.5 : 1, cursor: failedPage <= 1 ? 'not-allowed' : 'pointer' }}
                            >
                                Previous
                            </button>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                                Page {failedPage} of {failedTotalPages}
                            </span>
                            <button
                                type="button"
                                className={styles.secondaryButton}
                                onClick={() => setFailedPage(p => Math.min(failedTotalPages, p + 1))}
                                disabled={failedPage >= failedTotalPages}
                                style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem', opacity: failedPage >= failedTotalPages ? 0.5 : 1, cursor: failedPage >= failedTotalPages ? 'not-allowed' : 'pointer' }}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ─── RECENT INSPECTIONS TABLE CARD ─────────────────────── */}
            <div className={styles.card}>
                <div className={styles.recentHeader} style={{ marginBottom: '0.4rem' }}>
                    <h3 className={styles.recentTitle}>
                        Recent Inspections ({scannedTotal})
                    </h3>

                    {/* Export Excel button */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                            type="button"
                            className={styles.exportExcelButton}
                            onClick={() => handleExportExcel('PASS')}
                            disabled={scannedTotal === 0}
                        >
                            Export Excel
                        </button>
                    </div>
                </div>

                {/* Search Bar directly under Recent Inspections */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem', maxWidth: '460px' }}>
                    <input
                        type="text"
                        className={styles.input}
                        placeholder="Search recent inspections (Serial, TPN, Status, etc.)..."
                        value={scannedSearch}
                        onChange={e => setScannedSearch(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && fetchScannedLogs(activeSession.id, scannedSearch, 1)}
                        style={{ padding: '0.55rem 0.85rem', fontSize: '0.9rem', width: '100%' }}
                    />
                    <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={() => fetchScannedLogs(activeSession.id, scannedSearch, 1)}
                        style={{ padding: '0.55rem 1rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                    >
                        Search
                    </button>
                    {scannedSearch && (
                        <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={() => {
                                setScannedSearch('');
                                fetchScannedLogs(activeSession.id, '', 1);
                            }}
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
                                <th style={{ textAlign: 'center' }}>S.NO.</th>
                                <th>INSPECTED BY</th>
                                <th>DATE & TIME</th>
                                <th>BAND SERIAL NUMBER</th>
                                <th>PHYSICAL SERIAL NUMBER</th>
                                <th>PHYSICAL TPN</th>
                                <th>BAND</th>
                                <th>INSPECTION DATE</th>
                                <th>E-LABEL</th>
                                <th>PAM TPN</th>
                                <th>PAM 1</th>
                                <th>PAM 2</th>
                                <th>PAM 3</th>
                                <th>PAM 4</th>
                                <th>RFPC TPN</th>
                                <th>RFPC SL NO.</th>
                                <th style={{ textAlign: 'center' }}>DEFECT FIXED</th>
                                <th>STATUS</th>
                                <th>REMARKS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {scannedLogs.map((row, idx) => (
                                <tr key={row.id}>
                                    <td style={{ fontWeight: 600, color: '#64748b', textAlign: 'center' }}>
                                        {row.sl_no || (scannedPage - 1) * scannedLimit + idx + 1}
                                    </td>
                                    <td>{row.scanned_by || '—'}</td>
                                    <td style={{ fontSize: '0.85rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                                        {formatTimestamp(row.scanned_at)}
                                    </td>
                                    <td style={{ fontWeight: 700, color: '#0f766e', fontFamily: 'monospace' }}>
                                        {row.band_serial_no || row.serial_number}
                                    </td>
                                    <td style={{ fontWeight: 700, color: '#c2410c', fontFamily: 'monospace' }}>
                                        {row.physical_serial_number || row.band_serial_no || row.serial_number}
                                    </td>
                                    <td style={{ fontFamily: 'monospace' }}>{row.physical_tpn || '—'}</td>
                                    <td style={{ fontWeight: 700, color: '#2563eb' }}>
                                        {row.band || getBandFromTpn(row.physical_tpn)}
                                    </td>
                                    <td style={{ whiteSpace: 'nowrap' }}>
                                        {formatTableDate(row.inspection_date)}
                                    </td>
                                    <td>{row.e_label || '—'}</td>
                                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{row.pam_tpn || '—'}</td>
                                    <td style={{ fontFamily: 'monospace' }}>{row.pam1 || '—'}</td>
                                    <td style={{ fontFamily: 'monospace' }}>{row.pam2 || '—'}</td>
                                    <td style={{ fontFamily: 'monospace' }}>{row.pam3 || '—'}</td>
                                    <td style={{ fontFamily: 'monospace' }}>{row.pam4 || '—'}</td>
                                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{row.rfpc_tpn || '—'}</td>
                                    <td style={{ fontFamily: 'monospace' }}>{row.rfpc_sl_no || '—'}</td>
                                    <td style={{ textAlign: 'center' }}>
                                        {row.is_reinspected || row.defect_fixed ? (
                                            <button
                                                type="button"
                                                className={styles.secondaryButton}
                                                style={{
                                                    padding: '0.25rem 0.6rem',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 600,
                                                    color: '#c2410c',
                                                    backgroundColor: '#fff7ed',
                                                    borderColor: '#fed7aa',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}
                                                onClick={() => setFixedDefectModalRecord(row)}
                                                title="View defect fixed details"
                                            >
                                                Details
                                            </button>
                                        ) : (
                                            <span style={{ color: '#94a3b8' }}>—</span>
                                        )}
                                    </td>
                                    <td>
                                        {row.status === 'PASS' || row.status === 'COMPLETED' ? (
                                            row.is_reinspected ? (
                                                <span className={styles.badgeReinspectedPass} title="Passed after re-inspection/fix">COMPLETED</span>
                                            ) : (
                                                <span style={{
                                                    background: '#f1f5f9',
                                                    color: '#0f172a',
                                                    border: '1px solid #cbd5e1',
                                                    borderRadius: '4px',
                                                    padding: '0.2rem 0.55rem',
                                                    fontWeight: 700,
                                                    fontSize: '0.78rem',
                                                    letterSpacing: '0.04em'
                                                }}>
                                                    COMPLETED
                                                </span>
                                            )
                                        ) : (
                                            <span className={styles.badgeFail}>FAIL</span>
                                        )}
                                    </td>
                                    <td style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.remarks || ''}>
                                        {row.remarks || '—'}
                                    </td>
                                </tr>
                            ))}
                            {scannedLogs.length === 0 && (
                                <tr>
                                    <td colSpan={19} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                        {scannedSearch ? 'No matching inspections found for this search.' : 'No passed inspections recorded yet in this IPQC session.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Recent Inspections Pagination */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                        Showing {scannedLogs.length === 0 ? 0 : (scannedPage - 1) * scannedLimit + 1} to {Math.min(scannedPage * scannedLimit, scannedTotal)} of {scannedTotal} entries
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={() => {
                                const newP = Math.max(1, scannedPage - 1);
                                setScannedPage(newP);
                                fetchScannedLogs(activeSession.id, scannedSearch, newP);
                            }}
                            disabled={scannedPage <= 1}
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem', opacity: scannedPage <= 1 ? 0.5 : 1, cursor: scannedPage <= 1 ? 'not-allowed' : 'pointer' }}
                        >
                            Previous
                        </button>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                            Page {scannedPage} of {Math.max(1, Math.ceil(scannedTotal / scannedLimit))}
                        </span>
                        <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={() => {
                                const totalPages = Math.max(1, Math.ceil(scannedTotal / scannedLimit));
                                const newP = Math.min(totalPages, scannedPage + 1);
                                setScannedPage(newP);
                                fetchScannedLogs(activeSession.id, scannedSearch, newP);
                            }}
                            disabled={scannedPage >= Math.max(1, Math.ceil(scannedTotal / scannedLimit))}
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem', opacity: scannedPage >= Math.max(1, Math.ceil(scannedTotal / scannedLimit)) ? 0.5 : 1, cursor: scannedPage >= Math.max(1, Math.ceil(scannedTotal / scannedLimit)) ? 'not-allowed' : 'pointer' }}
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {/* Remaining Master Data Table (Exact IVI Match - Photo 2) */}
            <div className={styles.tableCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
                    <div>
                        <h3 className={styles.tableTitle} style={{ margin: 0, paddingBottom: 0, borderBottom: 'none' }}>
                            Remaining Master Data ({remainingTotal} items remaining)
                        </h3>
                        <p className={styles.tableSubtitle} style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                            Live session view: Passed units from RRH IVI recent inspections ready for IPQC. Successfully inspected units are deducted immediately.
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.85rem', color: '#64748b' }}>
                            <span>Show</span>
                            <select
                                className={styles.select}
                                value={remainingLimit}
                                onChange={e => {
                                    const newL = Number(e.target.value);
                                    setRemainingLimit(newL);
                                    setRemainingPage(1);
                                    fetchRemainingMaster(activeSession.id, remainingSearch, 1, newL);
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
                            placeholder="Search remaining master seria..."
                            value={remainingSearch}
                            onChange={e => setRemainingSearch(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && fetchRemainingMaster(activeSession.id, remainingSearch, 1, remainingLimit)}
                            className={styles.input}
                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', width: '220px' }}
                        />
                        <button
                            className={styles.button}
                            onClick={() => fetchRemainingMaster(activeSession.id, remainingSearch, 1, remainingLimit)}
                            style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                        >
                            Filter
                        </button>
                        {remainingSearch && (
                            <button
                                className={styles.secondaryButton}
                                onClick={() => {
                                    setRemainingSearch('');
                                    setRemainingPage(1);
                                    fetchRemainingMaster(activeSession.id, '', 1, remainingLimit);
                                }}
                                style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                            >
                                Clear
                            </button>
                        )}
                        <button
                            className={styles.cyanExportButton}
                            onClick={() => handleExportUnscannedExcel()}
                            title="Export Unscanned Master Data to Excel"
                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                            <Download size={14} /> Export Unscanned (Excel)
                        </button>
                    </div>
                </div>

                <div className={styles.tableContainer}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th style={{ width: '50px', textAlign: 'center' }}>S.NO.</th>
                                <th>PHYSICAL TPN</th>
                                <th>BAND SERIAL NUMBER</th>
                                <th>DUPLEXER MAIN (IVI)</th>
                                <th>DUPLEXER PART NO (IVI)</th>
                                <th>RRH UNIT (IVI)</th>
                                <th>IVI STATUS</th>
                                <th>TEJAS DC NO</th>
                                <th>LOT</th>
                                <th>REMARKS</th>
                                <th style={{ textAlign: 'center' }}>ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {remainingLoading ? (
                                <tr>
                                    <td colSpan={11} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                                        Loading remaining master data...
                                    </td>
                                </tr>
                            ) : remainingList.length === 0 ? (
                                <tr>
                                    <td colSpan={11} style={{ textAlign: 'center', padding: '2.5rem', background: '#f0fdf4', color: '#166534', fontWeight: 600 }}>
                                        All IVI passed units for this Work Order have been inspected in IPQC for this session!
                                    </td>
                                </tr>
                            ) : (
                                remainingList.map((item, idx) => (
                                    <tr key={item.ivi_id}>
                                        <td style={{ textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
                                            {item.sl_no ?? ((remainingPage - 1) * remainingLimit + idx + 1)}
                                        </td>
                                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                                            {item.physical_tpn || '—'}
                                        </td>
                                        <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f766e' }}>
                                            {item.band_serial_no || item.serial_number}
                                        </td>
                                        <td>{item.duplexer_main || '—'}</td>
                                        <td style={{ fontFamily: 'monospace' }}>{item.duplexer_part_no || '—'}</td>
                                        <td style={{ color: item.ivi_status === 'FAIL' ? '#2563eb' : undefined, fontWeight: item.ivi_status === 'FAIL' ? 600 : undefined }}>
                                            {cleanDefectDescription(item.rrh_unit) || (item.ivi_status === 'FAIL' ? 'Defect noted' : 'no defect')}
                                        </td>
                                        <td>
                                            <span style={{
                                                backgroundColor: item.ivi_status === 'FAIL' ? '#eff6ff' : '#dcfce7',
                                                color: item.ivi_status === 'FAIL' ? '#1d4ed8' : '#15803d',
                                                border: item.ivi_status === 'FAIL' ? '1px solid #bfdbfe' : '1px solid #86efac',
                                                borderRadius: '4px',
                                                padding: '0.15rem 0.5rem',
                                                fontWeight: 700,
                                                fontSize: '0.75rem',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {item.ivi_status === 'FAIL' ? 'FAIL' : 'PASS'}
                                            </span>
                                        </td>
                                        <td>{item.tejas_dc_no || '—'}</td>
                                        <td>{item.lot || item.bat_lot_no || '—'}</td>
                                        <td>{item.remarks || '—'}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <button
                                                className={styles.button}
                                                style={{
                                                    padding: '0.35rem 0.85rem',
                                                    fontSize: '0.8rem',
                                                    backgroundImage: 'none',
                                                    backgroundColor: '#0284c7',
                                                    color: '#ffffff',
                                                    borderRadius: '5px',
                                                    fontWeight: 600,
                                                    border: 'none',
                                                    cursor: 'pointer'
                                                }}
                                                onClick={() => handleInspectRemainingUnit(item.band_serial_no || item.serial_number || '')}
                                                title="Inspect this unit in IPQC"
                                                disabled={activeSession.status === 'Completed'}
                                            >
                                                Inspect Unit
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', fontSize: '0.85rem', color: '#64748b' }}>
                    <div>
                        Showing {remainingList.length > 0 ? (remainingPage - 1) * remainingLimit + 1 : 0} to{' '}
                        {Math.min(remainingPage * remainingLimit, remainingTotal)} of {remainingTotal} items
                    </div>
                    <div className={styles.paginationButtons}>
                        <button
                            className={styles.secondaryButton}
                            disabled={remainingPage <= 1}
                            onClick={() => {
                                const newP = remainingPage - 1;
                                setRemainingPage(newP);
                                fetchRemainingMaster(activeSession.id, remainingSearch, newP, remainingLimit);
                            }}
                        >
                            Previous
                        </button>
                        <span style={{ padding: '0.35rem 0.5rem' }}>
                            Page {remainingPage} of {Math.ceil(remainingTotal / remainingLimit) || 1}
                        </span>
                        <button
                            className={styles.secondaryButton}
                            disabled={remainingPage * remainingLimit >= remainingTotal}
                            onClick={() => {
                                const newP = remainingPage + 1;
                                setRemainingPage(newP);
                                fetchRemainingMaster(activeSession.id, remainingSearch, newP, remainingLimit);
                            }}
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {/* ─── MODAL: FAILED INSPECTION DETAILS ───────────────── */}
            {failedModalRecord && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.75)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 99999,
                    padding: '1.5rem'
                }} onClick={() => setFailedModalRecord(null)}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '12px',
                        width: '100%',
                        maxWidth: '800px',
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
                            borderBottom: '1px solid #fee2e2',
                            backgroundColor: '#fef2f2',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div>
                                <h3 style={{ margin: 0, color: '#991b1b', fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    Failed Inspection Details — S.No: {failedModalRecord.sl_no || '—'}
                                </h3>
                                <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#7f1d1d', fontFamily: 'monospace' }}>
                                    Band Serial No: {failedModalRecord.band_serial_no || failedModalRecord.serial_number}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setFailedModalRecord(null)}
                                style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#991b1b', padding: '0.25rem', lineHeight: 1 }}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            {/* Failed Stage Remarks Highlight Box */}
                            <div style={{
                                backgroundColor: '#fef2f2',
                                border: '1px solid #fecaca',
                                borderRadius: '8px',
                                padding: '1.25rem'
                            }}>
                                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#991b1b', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    Failed Stage(s) & Defect Remarks:
                                </div>
                                <div style={{ backgroundColor: '#ffffff', border: '1px solid #fca5a5', borderRadius: '6px', padding: '0.85rem', fontSize: '0.95rem', color: '#1e293b', fontWeight: 600 }}>
                                    {failedModalRecord.remarks || 'No specific defect remark provided.'}
                                </div>

                                {/* Checkpoints breakdown if available */}
                                {(() => {
                                    let cps: any[] = [];
                                    if (failedModalRecord.checkpoints) {
                                        try {
                                            cps = typeof failedModalRecord.checkpoints === 'string'
                                                ? JSON.parse(failedModalRecord.checkpoints)
                                                : failedModalRecord.checkpoints;
                                        } catch { }
                                    }
                                    const fails = Array.isArray(cps) ? cps.filter((c: any) => c.status === 'FAIL') : [];
                                    if (fails.length > 0) {
                                        return (
                                            <div style={{ marginTop: '0.85rem' }}>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#991b1b', marginBottom: '0.4rem' }}>
                                                    Detailed Checkpoint Breakdown:
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                    {fails.map((cp: any, idx: number) => (
                                                        <div key={idx} style={{ backgroundColor: '#fff5f5', border: '1px solid #fecaca', borderRadius: '4px', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}>
                                                            <span style={{ fontWeight: 700, color: '#dc2626' }}>Point {cp.id} ({cp.title}): </span>
                                                            <span style={{ color: '#1e293b' }}>{cp.remark || 'Failed'}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}
                            </div>

                            {/* Full S.No Details Grid */}
                            <div>
                                <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>
                                    Unit Information (S.No: {failedModalRecord.sl_no || '—'})
                                </h4>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                                    gap: '0.75rem',
                                    backgroundColor: '#f8fafc',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '8px',
                                    padding: '1rem'
                                }}>
                                    <div>
                                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>S.No</span>
                                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>{failedModalRecord.sl_no || '—'}</span>
                                    </div>
                                    <div>
                                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Band Serial No</span>
                                        <span style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'monospace', color: '#1e293b' }}>{failedModalRecord.band_serial_no || failedModalRecord.serial_number}</span>
                                    </div>
                                    <div>
                                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Work Order</span>
                                        <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>{failedModalRecord.work_order_id}</span>
                                    </div>
                                    <div>
                                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Tejas DC No</span>
                                        <span style={{ fontSize: '0.95rem' }}>{failedModalRecord.tejas_dc_no || '—'}</span>
                                    </div>
                                    <div>
                                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Tejas OBD No</span>
                                        <span style={{ fontSize: '0.95rem' }}>{failedModalRecord.tejas_obd_no || '—'}</span>
                                    </div>
                                    <div>
                                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Physical TPN</span>
                                        <span style={{ fontSize: '0.95rem', fontFamily: 'monospace' }}>{failedModalRecord.physical_tpn || '—'}</span>
                                    </div>
                                    <div>
                                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Band</span>
                                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#2563eb' }}>{failedModalRecord.band || getBandFromTpn(failedModalRecord.physical_tpn)}</span>
                                    </div>
                                    <div>
                                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>PAM TPN</span>
                                        <span style={{ fontSize: '0.95rem', fontFamily: 'monospace' }}>{failedModalRecord.pam_tpn || '—'}</span>
                                    </div>
                                    <div>
                                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>RFPC TPN</span>
                                        <span style={{ fontSize: '0.95rem', fontFamily: 'monospace' }}>{failedModalRecord.rfpc_tpn || '—'}</span>
                                    </div>
                                    <div>
                                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Status</span>
                                        <span className={styles.badgeFail}>FAIL</span>
                                    </div>
                                    <div>
                                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>General Remarks</span>
                                        <span style={{ fontSize: '0.95rem' }}>{failedModalRecord.remarks || 'None'}</span>
                                    </div>
                                    <div>
                                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Scanned By</span>
                                        <span style={{ fontSize: '0.95rem' }}>{failedModalRecord.scanned_by}</span>
                                    </div>
                                    <div>
                                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Inspection Timestamp</span>
                                        <span style={{ fontSize: '0.95rem', color: '#64748b' }}>{formatTimestamp(failedModalRecord.scanned_at)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div style={{
                            padding: '1rem 1.5rem',
                            borderTop: '1px solid #e2e8f0',
                            backgroundColor: '#f8fafc',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <button
                                type="button"
                                className={styles.secondaryButton}
                                onClick={() => setFailedModalRecord(null)}
                                style={{ padding: '0.5rem 1.25rem' }}
                            >
                                Close
                            </button>
                            <button
                                type="button"
                                className={styles.button}
                                style={{ padding: '0.5rem 1.5rem', backgroundColor: '#dc2626', borderColor: '#b91c1c', display: 'flex', alignItems: 'center', gap: '6px' }}
                                onClick={() => handleReinspectFailedRecord(failedModalRecord)}
                            >
                                Re-inspect / Fix This Unit
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── MODAL: VIEW DEFECT FIXED DETAILS ──────────────── */}
            {fixedDefectModalRecord && (
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
                }} onClick={() => setFixedDefectModalRecord(null)}>
                    <div style={{
                        background: '#ffffff',
                        borderRadius: '12px',
                        maxWidth: '650px',
                        width: '100%',
                        maxHeight: '90vh',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        border: '1px solid #e2e8f0'
                    }} onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div style={{
                            padding: '1.25rem 1.5rem',
                            borderBottom: '1px solid #e5e7eb',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: '#fff7ed'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '50%',
                                    backgroundColor: '#ffedd5',
                                    color: '#c2410c',
                                    fontWeight: 700,
                                    fontSize: '0.95rem'
                                }}>
                                    ✓
                                </span>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#9a3412', fontWeight: 700 }}>
                                        Fixed Defect Details
                                    </h3>
                                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#c2410c' }}>
                                        Serial: <strong>{fixedDefectModalRecord.band_serial_no || fixedDefectModalRecord.serial_number}</strong> (S.No: {fixedDefectModalRecord.sl_no || '—'})
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setFixedDefectModalRecord(null)}
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

                        {/* Body */}
                        <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div>
                                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', fontWeight: 700, color: '#334155' }}>
                                    Defects Resolved During Re-inspection
                                </h4>
                                {(() => {
                                    let cps: any[] = [];
                                    if (Array.isArray(fixedDefectModalRecord.checkpoints)) {
                                        cps = fixedDefectModalRecord.checkpoints;
                                    } else if (typeof fixedDefectModalRecord.checkpoints === 'string') {
                                        try {
                                            cps = JSON.parse(fixedDefectModalRecord.checkpoints);
                                        } catch {
                                            cps = [];
                                        }
                                    }
                                    const fixedCps = cps.filter((c: any) => c.previousFailureRemark || (c.remark && c.remark !== 'no defect' && c.remark !== 'Pass'));

                                    if (fixedCps.length > 0) {
                                        return (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                                {fixedCps.map((cp: any, idx: number) => (
                                                    <div key={idx} style={{
                                                        backgroundColor: '#fff7ed',
                                                        border: '1px solid #fed7aa',
                                                        borderRadius: '6px',
                                                        padding: '0.75rem 1rem',
                                                        fontSize: '0.88rem'
                                                    }}>
                                                        <div style={{ fontWeight: 700, color: '#c2410c', marginBottom: '0.25rem' }}>
                                                            Point {cp.id} ({cp.title || `Checkpoint ${cp.id}`}):
                                                        </div>
                                                        <div style={{ color: '#1e293b' }}>
                                                            <strong>Initial Defect Remark:</strong> {cp.previousFailureRemark || cp.remark}
                                                        </div>
                                                        <div style={{ color: '#15803d', fontSize: '0.8rem', marginTop: '0.25rem', fontWeight: 600 }}>
                                                            Status: Rectified & Passed
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    }

                                    return (
                                        <div style={{
                                            backgroundColor: '#fff7ed',
                                            border: '1px solid #fed7aa',
                                            borderRadius: '6px',
                                            padding: '0.85rem 1rem',
                                            fontSize: '0.9rem',
                                            color: '#c2410c'
                                        }}>
                                            Defect rectification was recorded for this unit.
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* Footer */}
                        <div style={{
                            padding: '1rem 1.5rem',
                            borderTop: '1px solid #e5e7eb',
                            backgroundColor: '#f9fafb',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                Inspected by: <strong>{fixedDefectModalRecord.scanned_by}</strong> on {formatTimestamp(fixedDefectModalRecord.scanned_at)}
                            </span>
                            <button
                                type="button"
                                className={styles.secondaryButton}
                                onClick={() => setFixedDefectModalRecord(null)}
                                style={{ padding: '0.45rem 1.25rem' }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RrhIpqc;
