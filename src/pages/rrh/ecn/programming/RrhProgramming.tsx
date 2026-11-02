import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import styles from './Programming.module.css';
import { WorkOrderSelector } from '../../../../components/WorkOrderSelector';
import { apiFetch } from '../../../../utils/api';
import {
    Download,
    AlertCircle,
    CheckCircle,
    XCircle,
    RotateCcw,
    Sparkles
} from 'lucide-react';

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

// ─── IPQC Master Data Model ──────────────────────────────────────────────────
export interface IpqcMasterRecord {
    id: number;
    band: string;
    rrhSkuLevel?: string;
    rrh_sku_level?: string;
    eLevel: string;
    pam1_2: string;
    pam3_4: string;
    createdAt?: string;
    updatedAt?: string;
}

// ─── Single Band Detection Helper ───────────────────────────────────────────
export const isSingleBand = (bandStr?: string | null): boolean => {
    if (!bandStr || bandStr === '—' || bandStr === '-') return false;
    const clean = bandStr.trim().toUpperCase();
    if (clean.includes('+') || clean.includes('/') || clean.includes('&') || clean.includes('AND') || clean.includes(',')) {
        return false;
    }
    const bandMatches = clean.match(/B\d+/g);
    if (bandMatches && bandMatches.length > 1) {
        return false;
    }
    return true;
};

const getBandFromTpn = (tpn: string | null | undefined): string => {
    if (!tpn) return '—';
    const clean = tpn.trim().toUpperCase();
    return SKU_TO_BAND_MAP[clean] || SKU_TO_BAND_MAP[tpn.trim()] || '—';
};

const cleanDefectDescription = (text: string | null | undefined): string => {
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

const formatTimestamp = (dStr: string | null | undefined) => {
    if (!dStr) return '—';
    try {
        const d = new Date(dStr);
        if (isNaN(d.getTime())) return String(dStr);
        return d.toLocaleString('en-IN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    } catch {
        return String(dStr);
    }
};

const formatWoDateTime = (rawDateTime?: string | null) => {
    if (!rawDateTime) return '—';
    try {
        const cleanStr = typeof rawDateTime === 'string' && rawDateTime.includes(' ') && !rawDateTime.includes('T')
            ? rawDateTime.replace(' ', 'T')
            : rawDateTime;
        const d = new Date(cleanStr);
        if (!isNaN(d.getTime())) {
            return d.toLocaleDateString('en-GB');
        }
    } catch { }
    return String(rawDateTime);
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

// ─── Interfaces ──────────────────────────────────────────────────────────────
interface ProgrammingSession {
    id: number;
    work_order_id: string;
    status: string;
    created_by: string;
    created_by_name?: string;
    created_at: string;
    updated_at: string;
    lot_quantity?: number;
    work_order_date?: string;
    date?: string;
    lot_number?: string;
}

interface WorkOrderDetails {
    work_order_id: string;
    work_order_date?: string;
    lot_quantity: number;
    ipqc_passed_count: number;
}

interface ScannedUnitDetails {
    serial_number: string;
    band_serial_no: string;
    physical_tpn: string;
    band: string;
    bat_lot_no?: string;
    tejas_dc_no?: string;
    tejas_obd_no?: string;
    duplexer_main?: string;
    duplexer_part_no?: string;
    duplexer_sno?: string;
    duplexer_sl_no?: string;
    rrh_unit?: string;
    ipqc_status: string;
    ipqc_inspected_by?: string;
    ipqc_remarks?: string;
    work_order_id: string;
    sl_no?: number | string;
    ipqc_id?: number;
    ivi_id?: number;
    inspection_date?: string;
    // Component & E-Level Verification and PAM Swap Audit fields
    e_level?: string;
    pam1_2_tpn?: string;
    pam3_4_tpn?: string;
    previous_band?: string;
    previous_e_level?: string;
    previous_pam1_2?: string;
    previous_pam3_4?: string;
    is_pam_changed?: boolean;
    pam_change_remarks?: string;
    changed_component?: string;
}

interface ScannedInspectionLog {
    id: number;
    session_id: number;
    work_order_id: string;
    serial_number: string;
    band_serial_no: string;
    physical_tpn: string;
    band: string;
    status: 'PASS' | 'FAIL' | 'COMPLETED' | string;
    remarks?: string;
    inspection_date?: string;
    scanned_by: string;
    scanned_at: string;
    is_reinspected?: boolean;
    defect_fixed?: string;
    sl_no?: number | string;
    debug_status?: string;
    // Component & E-Level Verification and PAM Swap Audit fields
    e_level?: string;
    pam1_2_tpn?: string;
    pam3_4_tpn?: string;
    is_pam_changed?: boolean;
    pam_change_remarks?: string;
    changed_component?: string;
    previous_band?: string;
    previous_e_level?: string;
    previous_pam1_2?: string;
    previous_pam3_4?: string;
    new_band?: string;
    new_e_level?: string;
    new_pam1_2?: string;
    new_pam3_4?: string;
}

interface DebugInspectionItem {
    id: number;
    session_id: number;
    work_order_id: string;
    serial_number: string;
    band_serial_no: string;
    physical_tpn: string;
    band: string;
    status: string;
    remarks?: string;
    debug_status?: string;
    debug_remarks?: string;
    debugged_by?: string;
    debugged_at?: string;
    scanned_by: string;
    scanned_at: string;
    inspection_date?: string;
    sl_no?: number | string;
}

interface RemainingMasterItem {
    ipqc_id: number;
    work_order_id: string;
    serial_number: string;
    band_serial_no: string;
    physical_tpn: string;
    band: string;
    duplexer_main?: string;
    duplexer_part_no?: string;
    duplexer_sno?: string;
    duplexer_sl_no?: string;
    rrh_unit?: string;
    ipqc_status: string;
    ipqc_scanned_at?: string;
    bat_lot_no?: string;
    lot?: string;
    remarks?: string;
    tejas_dc_no?: string;
    tejas_obd_no?: string;
    sl_no?: number | string;
}

interface InspectionStats {
    totalScanned: number;
    passed: number;
    failed: number;
    debug: number;
    remaining: number;
    ipqcPassed: number;
}

// ─── Component ───────────────────────────────────────────────────────────────
export const RrhProgramming: React.FC<{ routeType?: string }> = () => {
    // ─── Toasts ───────────────────────────────────────────────────────────────
    const [toasts, setToasts] = useState<Toast[]>([]);
    const toastId = useRef(0);
    const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
        const id = ++toastId.current;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
    }, []);

    // ─── View 1 State: Work Order Selection & Session History ─────────────────
    const [eligibleWorkOrders, setEligibleWorkOrders] = useState<any[]>([]);
    const [selectedWoId, setSelectedWoId] = useState<string>('');
    const [selectedWoDetails, setSelectedWoDetails] = useState<WorkOrderDetails | null>(null);
    const [detailsLoading, setDetailsLoading] = useState<boolean>(false);

    // Active Sessions
    const [activeSessions, setActiveSessions] = useState<ProgrammingSession[]>([]);
    const [activeSearch, setActiveSearch] = useState<string>('');
    const [activePage, setActivePage] = useState<number>(1);
    const [activeLimit, setActiveLimit] = useState<number>(5);
    const [activeTotal, setActiveTotal] = useState<number>(0);
    const [sessionsLoading, setSessionsLoading] = useState<boolean>(false);

    // Completed Sessions
    const [completedSessions, setCompletedSessions] = useState<ProgrammingSession[]>([]);
    const [completedSearch, setCompletedSearch] = useState<string>('');
    const [completedPage, setCompletedPage] = useState<number>(1);
    const [completedLimit, setCompletedLimit] = useState<number>(5);
    const [completedTotal, setCompletedTotal] = useState<number>(0);

    // Filter out active or completed work orders from the dropdown
    const availableWorkOrders = useMemo(() => {
        const activeWoIds = new Set(activeSessions.map((s: any) => String(s.work_order_id || '').trim().toUpperCase()));
        const completedWoIds = new Set(completedSessions.map((s: any) => String(s.work_order_id || '').trim().toUpperCase()));
        return eligibleWorkOrders.filter((w: any) => {
            const woId = String(w.work_order_id || '').trim().toUpperCase();
            if (activeWoIds.has(woId)) return false;
            if (completedWoIds.has(woId)) return false;
            return true;
        });
    }, [eligibleWorkOrders, activeSessions, completedSessions]);

    // ─── View 2 State: Inside Active Programming Session ──────────────────────
    const [activeSession, setActiveSession] = useState<ProgrammingSession | null>(null);
    const [isCreatingSession, setIsCreatingSession] = useState<boolean>(false);

    // Stats
    const [stats, setStats] = useState<InspectionStats>({
        totalScanned: 0,
        passed: 0,
        failed: 0,
        debug: 0,
        remaining: 0,
        ipqcPassed: 0,
    });

    // Scanner & Form State
    const [scannerInput, setScannerInput] = useState<string>('');
    const [isSearchingSerial, setIsSearchingSerial] = useState<boolean>(false);
    const [loadedUnit, setLoadedUnit] = useState<ScannedUnitDetails | null>(null);
    const [selectedDecision, setSelectedDecision] = useState<'PASS' | 'FAIL' | null>(null);
    const [failureRemarks, setFailureRemarks] = useState<string>('');
    const [isSubmittingInspection, setIsSubmittingInspection] = useState<boolean>(false);
    const [reinspectionInfo, setReinspectionInfo] = useState<{ isReinspected: boolean; previousFailureRemarks?: string } | null>(null);

    const scannerInputRef = useRef<HTMLInputElement>(null);
    const scannerSectionRef = useRef<HTMLDivElement>(null);

    // Failed Inspections State
    const [failedInspections, setFailedInspections] = useState<ScannedInspectionLog[]>([]);
    const [failedSearch, setFailedSearch] = useState<string>('');
    const [failedPage, setFailedPage] = useState<number>(1);
    const [isExportingFailed, setIsExportingFailed] = useState<boolean>(false);
    const failedLimit = 10;

    // Debug & Rework Table State
    const [debugInspections, setDebugInspections] = useState<DebugInspectionItem[]>([]);
    const [debugSearch, setDebugSearch] = useState<string>('');
    const [debugStatusFilter, setDebugStatusFilter] = useState<string>('ALL');
    const [debugPage, setDebugPage] = useState<number>(1);
    const debugLimit = 10;
    const [isLoadingDebug, setIsLoadingDebug] = useState<boolean>(false);
    const [isExportingDebug, setIsExportingDebug] = useState<boolean>(false);

    // Debug Action Modal State
    const [debugModalItem, setDebugModalItem] = useState<DebugInspectionItem | null>(null);
    const [debugModalStatus, setDebugModalStatus] = useState<string>('PENDING');
    const [debugModalRemarks, setDebugModalRemarks] = useState<string>('');
    const [isSavingDebugAction, setIsSavingDebugAction] = useState<boolean>(false);

    // Scanned Inspections Log State
    const [scannedLogs, setScannedLogs] = useState<ScannedInspectionLog[]>([]);
    const [scannedTotal, setScannedTotal] = useState<number>(0);
    const [scannedSearch, setScannedSearch] = useState<string>('');
    const [scannedPage, setScannedPage] = useState<number>(1);
    const scannedLimit = 10;
    const [isLoadingScannedLogs, setIsLoadingScannedLogs] = useState<boolean>(false);
    const [isExportingScanned, setIsExportingScanned] = useState<boolean>(false);

    // Remaining Master Data State
    const [remainingItems, setRemainingItems] = useState<RemainingMasterItem[]>([]);
    const [remainingTotal, setRemainingTotal] = useState<number>(0);
    const [remainingSearch, setRemainingSearch] = useState<string>('');
    const [remainingPage, setRemainingPage] = useState<number>(1);
    const remainingLimit = 10;
    const [isLoadingRemaining, setIsLoadingRemaining] = useState<boolean>(false);
    const [isExportingRemaining, setIsExportingRemaining] = useState<boolean>(false);

    // ─── Master Data & Dual-Index O(1) Maps ──────────────────────────────────
    const [masterDataList, setMasterDataList] = useState<IpqcMasterRecord[]>([]);

    const fetchMasterData = useCallback(async () => {
        try {
            const res = await apiFetch('/api/rrh/ecn/programming/master-data')
                .catch(() => apiFetch('/api/rrh/ecn/ipqc/master-data'))
                .catch(() => apiFetch('/api/ipqc/master-data'));
            if (res && res.data) {
                setMasterDataList(res.data);
            }
        } catch (err: any) {
            console.error('Failed to fetch Programming master data:', err);
        }
    }, []);

    useEffect(() => {
        fetchMasterData();
    }, [fetchMasterData]);

    // 1. BY_ELEVEL_MAP: Keyed by normalized eLevel -> { band, eLevel, pam1_2, pam3_4, rrhSku }
    const byELevelMap = useMemo(() => {
        const map = new Map<string, IpqcMasterRecord>();
        masterDataList.forEach(m => {
            if (m.eLevel) {
                map.set(m.eLevel.trim().toUpperCase(), m);
            }
        });
        return map;
    }, [masterDataList]);

    // 2. BY_PAM_COMBO_MAP: Keyed by `${pam1_2}|${pam3_4}` -> { band, eLevel, pam1_2, pam3_4, rrhSku }
    const byPamComboMap = useMemo(() => {
        const map = new Map<string, IpqcMasterRecord>();
        masterDataList.forEach(m => {
            const p12 = (m.pam1_2 || '').trim().toUpperCase();
            const p34 = (m.pam3_4 || (isSingleBand(m.band) ? m.pam1_2 : '') || '').trim().toUpperCase();
            if (p12) {
                map.set(`${p12}|${p34}`, m);
                if (isSingleBand(m.band)) {
                    map.set(`${p12}|${p12}`, m);
                    if (!p34) map.set(`${p12}|`, m);
                }
            }
        });
        return map;
    }, [masterDataList]);

    // ─── Component & E-Level Verification and PAM Swap State ─────────────────
    const [eLevel, setELevel] = useState<string>('');
    const [pam12Tpn, setPam12Tpn] = useState<string>('');
    const [pam34Tpn, setPam34Tpn] = useState<string>('');
    const [isVerified, setIsVerified] = useState<boolean>(false);
    const [verificationError, setVerificationError] = useState<string | null>(null);
    const [mismatchedFields, setMismatchedFields] = useState<{
        eLevel?: boolean;
        band?: boolean;
        pam12?: boolean;
        pam34?: boolean;
    } | null>(null);

    // PAM Swap Audit Trail State
    const [isPamSwapped, setIsPamSwapped] = useState<boolean>(false);
    const [changedComponent, setChangedComponent] = useState<string>('None');
    const [pamChangeRemarks, setPamChangeRemarks] = useState<string>('');
    const [previousConfig, setPreviousConfig] = useState<{
        previousBand: string;
        previousELevel: string;
        previousPam1_2: string;
        previousPam3_4: string;
    } | null>(null);

    // Swap Modal State
    const [swapModalOpen, setSwapModalOpen] = useState<boolean>(false);
    const [swapTarget, setSwapTarget] = useState<'PAM12' | 'PAM34' | null>(null);
    const [swapInputTpn, setSwapInputTpn] = useState<string>('');
    const [swapModalError, setSwapModalError] = useState<string | null>(null);
    const [showPamSwapToggle, setShowPamSwapToggle] = useState<boolean>(false);

    const eLevelRef = useRef<HTMLInputElement>(null);
    const pam12TpnRef = useRef<HTMLInputElement>(null);
    const pam34TpnRef = useRef<HTMLInputElement>(null);
    const swapInputRef = useRef<HTMLInputElement>(null);

    // Manual input change handlers with automatic verification reset
    const handleELevelChange = useCallback((raw: string) => {
        setELevel(raw);
        setIsVerified(false);
        setVerificationError(null);
        setMismatchedFields(null);
    }, []);

    const handlePam12Change = useCallback((raw: string) => {
        setPam12Tpn(raw);
        setIsVerified(false);
        setVerificationError(null);
        setMismatchedFields(null);
        const activeBand = loadedUnit?.band || (eLevel ? byELevelMap.get(eLevel.trim().toUpperCase())?.band : '');
        if (isSingleBand(activeBand)) {
            setPam34Tpn(raw);
        }
    }, [loadedUnit?.band, eLevel, byELevelMap]);

    const handlePam34Change = useCallback((raw: string) => {
        setPam34Tpn(raw);
        setIsVerified(false);
        setVerificationError(null);
        setMismatchedFields(null);
    }, []);

    // Change / Swap Toggle Handler: clears fields to blank on click for entering new details, restores IPQC values on cancel
    const handleTogglePamSwap = useCallback(() => {
        setShowPamSwapToggle(prev => {
            const next = !prev;
            if (next) {
                // Toggled ON: User clicked Change / Swap. Show blank fields to enter new details.
                setELevel('');
                setPam12Tpn('');
                setPam34Tpn('');
                setIsVerified(false);
                setVerificationError(null);
                setMismatchedFields(null);
                setTimeout(() => {
                    eLevelRef.current?.focus();
                }, 80);
            } else {
                // Toggled OFF: User cancelled swap. Restore IPQC values if not permanently swapped.
                if (!isPamSwapped && loadedUnit) {
                    const origE = (loadedUnit.e_level || '').trim();
                    const origP12 = (loadedUnit.pam1_2_tpn || '').trim();
                    const origP34 = (loadedUnit.pam3_4_tpn || (isSingleBand(loadedUnit.band) ? origP12 : '')).trim();
                    setELevel(origE);
                    setPam12Tpn(origP12);
                    setPam34Tpn(origP34);
                    setIsVerified(true);
                    setVerificationError(null);
                    setMismatchedFields(null);
                }
            }
            return next;
        });
    }, [isPamSwapped, loadedUnit]);

    // Strict Cross-Verification Rule against Master Data
    const verifyAgainstMasterData = useCallback((
        checkELevelVal?: string,
        checkPam12Val?: string,
        checkPam34Val?: string,
        overrideBand?: string
    ) => {
        const checkE = (checkELevelVal !== undefined ? checkELevelVal : eLevel).trim().toUpperCase();
        const checkP12 = (checkPam12Val !== undefined ? checkPam12Val : pam12Tpn).trim().toUpperCase();
        const checkP34 = (checkPam34Val !== undefined ? checkPam34Val : pam34Tpn).trim().toUpperCase();
        const currentBand = (overrideBand || loadedUnit?.band || '').trim().toUpperCase();

        if (!checkE || !checkP12 || !checkP34) {
            setIsVerified(false);
            return false;
        }

        const match = byELevelMap.get(checkE);
        if (!match) {
            setIsVerified(false);
            const errMsg = "E-Level, Band, PAM 1&2, PAM 3&4 does not match Master Data. Use the Change TPN button if PAM plates were swapped.";
            setVerificationError(errMsg);
            setMismatchedFields({ eLevel: true, band: true, pam12: true, pam34: true });
            return false;
        }

        // Compare Band (support exact match or normalized alphanumeric match)
        const normMasterBand = match.band.trim().toUpperCase().replace(/[^A-Z0-9+]/g, '');
        const normUnitBand = currentBand.replace(/[^A-Z0-9+]/g, '');
        const bandMatches = normMasterBand === normUnitBand ||
                            match.band.trim().toUpperCase() === currentBand ||
                            (normUnitBand.length > 0 && normMasterBand.includes(normUnitBand)) ||
                            (normMasterBand.length > 0 && normUnitBand.includes(normMasterBand));

        const pam12Matches = match.pam1_2.trim().toUpperCase() === checkP12;
        const masterPam34 = (match.pam3_4 || (isSingleBand(match.band) ? match.pam1_2 : '')).trim().toUpperCase();
        const pam34Matches = masterPam34 === checkP34;

        if (bandMatches && pam12Matches && pam34Matches) {
            setIsVerified(true);
            setVerificationError(null);
            setMismatchedFields(null);
            return true;
        } else {
            setIsVerified(false);
            const errMsg = "E-Level, Band, PAM 1&2, PAM 3&4 does not match Master Data. Use the Change TPN button if PAM plates were swapped.";
            setVerificationError(errMsg);
            setMismatchedFields({
                band: !bandMatches,
                pam12: !pam12Matches,
                pam34: !pam34Matches
            });
            return false;
        }
    }, [eLevel, pam12Tpn, pam34Tpn, loadedUnit?.band, byELevelMap]);

    // Open Swap Modal
    const handleOpenSwapModal = useCallback((target: 'PAM12' | 'PAM34') => {
        setSwapTarget(target);
        setSwapInputTpn('');
        setSwapModalError(null);
        setSwapModalOpen(true);
        setTimeout(() => {
            swapInputRef.current?.focus();
        }, 80);
    }, []);

    // Apply Dynamic PAM Plate Swap via Reverse Lookup
    const handleApplyPamSwap = useCallback(() => {
        const newTpn = swapInputTpn.trim().toUpperCase();
        if (!newTpn) {
            setSwapModalError('Please enter or scan the new PAM TPN.');
            return;
        }

        const target = swapTarget;
        const currentPam12 = target === 'PAM12' ? newTpn : pam12Tpn.trim().toUpperCase();
        const currentPam34 = target === 'PAM34' ? newTpn : pam34Tpn.trim().toUpperCase();

        if (!currentPam12 || !currentPam34) {
            setSwapModalError('Both PAM 1&2 and PAM 3&4 must be specified to perform combo re-mapping.');
            return;
        }

        const comboKey = `${currentPam12}|${currentPam34}`;
        let match = byPamComboMap.get(comboKey);

        // Fallback for single-band if partner wasn't auto-synced yet
        if (!match && target === 'PAM12' && isSingleBand(loadedUnit?.band)) {
            match = byPamComboMap.get(`${newTpn}|${newTpn}`);
        }

        if (!match) {
            const err = `No matching E-Level / Band found in Master Data for PAM 1&2 (${currentPam12}) + PAM 3&4 (${currentPam34})!`;
            setSwapModalError(err);
            addToast(err, 'error');
            return;
        }

        // Apply new PAM values
        if (target === 'PAM12') {
            setPam12Tpn(newTpn);
            if (isSingleBand(match.band)) {
                setPam34Tpn(newTpn);
            }
        } else {
            setPam34Tpn(newTpn);
        }

        // 1. Automatically update E-Level
        setELevel(match.eLevel);

        // 2. Automatically update unit's FREQUENCY BAND in header
        setLoadedUnit(prev => prev ? { ...prev, band: match!.band } : null);

        // 3. Mark isPamSwapped = true & record which PAM was changed
        const origP12 = previousConfig?.previousPam1_2?.trim().toUpperCase();
        const origP34 = previousConfig?.previousPam3_4?.trim().toUpperCase();
        const p12Changed = origP12 && currentPam12 !== origP12;
        const p34Changed = origP34 && currentPam34 !== origP34;

        let changedText = target === 'PAM12' ? 'PAM 1&2 Changed' : 'PAM 3&4 Changed';
        if (p12Changed && p34Changed) {
            changedText = 'Both PAM 1&2 & 3&4 Changed';
        } else if (p12Changed) {
            changedText = 'PAM 1&2 Changed';
        } else if (p34Changed) {
            changedText = 'PAM 3&4 Changed';
        }

        setIsPamSwapped(true);
        setChangedComponent(changedText);

        const remark = target === 'PAM12'
            ? `PAM 1&2 changed from ${previousConfig?.previousPam1_2 || 'N/A'} to ${newTpn}. Re-mapped to Band: ${match.band}, E-Level: ${match.eLevel}`
            : `PAM 3&4 changed from ${previousConfig?.previousPam3_4 || 'N/A'} to ${newTpn}. Re-mapped to Band: ${match.band}, E-Level: ${match.eLevel}`;
        setPamChangeRemarks(remark);

        // 4. Mark verification as MATCHED and clear errors
        setIsVerified(true);
        setVerificationError(null);
        setMismatchedFields(null);

        setSwapModalOpen(false);
        setSwapInputTpn('');
        setSwapModalError(null);

        addToast(`PAM Plate Swapped & Re-mapped! New Band: ${match.band}, E-Level: ${match.eLevel}`, 'success');
    }, [swapInputTpn, swapTarget, pam12Tpn, pam34Tpn, loadedUnit?.band, byPamComboMap, previousConfig, addToast]);

    // Revert Swap back to previous snapshot
    const handleRevertPamSwap = useCallback(() => {
        if (!previousConfig) return;
        setELevel(previousConfig.previousELevel);
        setPam12Tpn(previousConfig.previousPam1_2);
        setPam34Tpn(previousConfig.previousPam3_4);
        setLoadedUnit(prev => prev ? { ...prev, band: previousConfig.previousBand } : null);
        setIsPamSwapped(false);
        setChangedComponent('None');
        setPamChangeRemarks('');
        setShowPamSwapToggle(false);
        verifyAgainstMasterData(
            previousConfig.previousELevel,
            previousConfig.previousPam1_2,
            previousConfig.previousPam3_4,
            previousConfig.previousBand
        );
        addToast('PAM Plate Swap reverted to initial configuration.', 'info');
    }, [previousConfig, verifyAgainstMasterData, addToast]);

    // Reset verification state helper
    const resetVerificationState = useCallback(() => {
        setELevel('');
        setPam12Tpn('');
        setPam34Tpn('');
        setIsVerified(false);
        setVerificationError(null);
        setMismatchedFields(null);
        setIsPamSwapped(false);
        setChangedComponent('None');
        setPamChangeRemarks('');
        setPreviousConfig(null);
        setShowPamSwapToggle(false);
    }, []);

    // ─── 1. Load Eligible Work Orders ────────────────────────────────────────
    const fetchEligibleWorkOrders = useCallback(async () => {
        try {
            const res = await apiFetch('/api/rrh/ecn/programming/eligible-work-orders');
            const list = Array.isArray(res) ? res : res?.data || [];
            setEligibleWorkOrders(list);
        } catch (err: any) {
            console.error('Failed to load eligible work orders for Programming:', err);
            addToast('Failed to load eligible work orders for Programming.', 'error');
        }
    }, [addToast]);

    // ─── 2. Fetch Active & Completed Sessions ─────────────────────────────────
    const fetchActiveSessions = useCallback(async (page = activePage, limit = activeLimit, search = activeSearch) => {
        setSessionsLoading(true);
        try {
            const params = new URLSearchParams({
                status: 'In Progress,Pending,Paused',
                page: String(page),
                limit: String(limit),
                search
            });
            const res = await apiFetch(`/api/rrh/ecn/programming/sessions?${params}`);
            setActiveSessions(res?.sessions || []);
            setActiveTotal(res?.total || 0);
        } catch (err: any) {
            console.error('Failed to fetch active Programming sessions:', err);
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
            const res = await apiFetch(`/api/rrh/ecn/programming/sessions?${params}`);
            setCompletedSessions(res?.sessions || []);
            setCompletedTotal(res?.total || 0);
        } catch (err: any) {
            console.error('Failed to fetch completed Programming sessions:', err);
        }
    }, [completedPage, completedLimit, completedSearch]);

    useEffect(() => {
        if (!activeSession) {
            fetchEligibleWorkOrders();
            fetchActiveSessions();
            fetchCompletedSessions();
        }
    }, [activeSession, fetchEligibleWorkOrders, fetchActiveSessions, fetchCompletedSessions]);

    // ─── 3. Handle Work Order Selection ───────────────────────────────────────
    const handleWorkOrderSelect = async (woId: string) => {
        setSelectedWoId(woId);
        if (!woId) {
            setSelectedWoDetails(null);
            return;
        }

        setDetailsLoading(true);
        let woNum = woId;
        let woDate: string | null = null;
        let lotQty = 0;
        let ipqcPassedCount = 0;

        const localWo = eligibleWorkOrders.find((w: any) =>
            String(w.work_order_id || '').toUpperCase() === woId.toUpperCase()
        );

        if (localWo) {
            woDate = localWo.work_order_date || localWo.date || null;
            lotQty = Number(localWo.lot_quantity) || 0;
            ipqcPassedCount = Number(localWo.ipqc_passed_count) || 0;
        }

        if (localWo && lotQty > 0 && ipqcPassedCount > 0) {
            setSelectedWoDetails({
                work_order_id: woNum,
                work_order_date: woDate || undefined,
                lot_quantity: lotQty,
                ipqc_passed_count: ipqcPassedCount
            });
            setDetailsLoading(false);
            return;
        }

        try {
            const ipqcRes = await apiFetch(`/api/rrh/ecn/programming/work-orders/${encodeURIComponent(woNum)}/ipqc-details`);
            const ipqcData = ipqcRes?.data || ipqcRes;
            if (ipqcData) {
                woNum = ipqcData.work_order_id || woNum;
                woDate = ipqcData.work_order_date || woDate;
                lotQty = Number(ipqcData.lot_quantity) || lotQty;
                ipqcPassedCount = Number(ipqcData.ipqc_passed_count) || ipqcPassedCount;
            }

            setSelectedWoDetails({
                work_order_id: woNum,
                work_order_date: woDate || undefined,
                lot_quantity: lotQty,
                ipqc_passed_count: ipqcPassedCount
            });
        } catch (err: any) {
            console.error('Failed to load IPQC details:', err);
        } finally {
            setDetailsLoading(false);
        }
    };

    // ─── 4. Start Session ────────────────────────────────────────────────────
    const handleStartSession = async (woId: string) => {
        if (!woId) {
            addToast('Please select a Work Order first.', 'warning');
            return;
        }

        setIsCreatingSession(true);
        try {
            const res = await apiFetch('/api/rrh/ecn/programming/sessions', {
                method: 'POST',
                body: JSON.stringify({ work_order_id: woId })
            });

            const session: ProgrammingSession = res?.data || res;
            setActiveSession(session);
            handleWorkOrderSelect(session.work_order_id);
            addToast(`Programming session started for Work Order ${session.work_order_id}.`, 'success');
        } catch (err: any) {
            addToast(err.message || 'Failed to start Programming session.', 'error');
        } finally {
            setIsCreatingSession(false);
        }
    };

    // ─── 5. Complete Session ─────────────────────────────────────────────────
    const handleCompleteSession = async () => {
        if (!activeSession) return;
        if (!window.confirm(`Are you sure you want to mark session for Work Order "${activeSession.work_order_id}" as COMPLETED?`)) {
            return;
        }

        try {
            await apiFetch(`/api/rrh/ecn/programming/sessions/${activeSession.id}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status: 'Completed' })
            });

            addToast(`Programming session for Work Order ${activeSession.work_order_id} marked as Completed.`, 'success');
            setActiveSession(null);
            fetchActiveSessions();
            fetchCompletedSessions();
            fetchEligibleWorkOrders();
        } catch (err: any) {
            addToast(err.message || 'Failed to complete session.', 'error');
        }
    };

    // ─── 6. Delete Session ───────────────────────────────────────────────────
    const handleDeleteSession = async (sessionId: number, woId: string) => {
        if (!window.confirm(`Are you sure you want to delete the Programming session for Work Order "${woId}"?`)) {
            return;
        }

        try {
            await apiFetch(`/api/rrh/ecn/programming/sessions/${sessionId}`, {
                method: 'DELETE'
            });
            addToast(`Session for Work Order ${woId} deleted successfully.`, 'success');
            fetchActiveSessions();
            fetchCompletedSessions();
            fetchEligibleWorkOrders();
        } catch (err: any) {
            addToast(err.message || 'Failed to delete session.', 'error');
        }
    };

    // ─── 7. Load Active Session Details ──────────────────────────────────────
    const loadActiveSessionDetails = useCallback(async (sessionId: number) => {
        if (!sessionId) return;

        // A. Scanned Logs
        setIsLoadingScannedLogs(true);
        try {
            const query = new URLSearchParams({
                page: String(scannedPage),
                limit: String(scannedLimit),
                search: scannedSearch,
                status: 'PASS'
            });
            const res = await apiFetch(`/api/rrh/ecn/programming/sessions/${sessionId}/inspections?${query.toString()}`);
            setScannedLogs(res?.data || []);
            setScannedTotal(res?.total || 0);
        } catch (err: any) {
            // Ignore
        } finally {
            setIsLoadingScannedLogs(false);
        }

        // B. Failed Inspections
        try {
            const failRes = await apiFetch(`/api/rrh/ecn/programming/sessions/${sessionId}/failed-inspections`);
            setFailedInspections(failRes?.data || []);
        } catch (err: any) {
            // Ignore
        }

        // C. Debug Inspections
        setIsLoadingDebug(true);
        try {
            const debugQuery = new URLSearchParams({
                search: debugSearch,
                status: debugStatusFilter
            });
            const debugRes = await apiFetch(`/api/rrh/ecn/programming/sessions/${sessionId}/debug-inspections?${debugQuery.toString()}`);
            setDebugInspections(debugRes?.data || []);
        } catch (err: any) {
            // Ignore
        } finally {
            setIsLoadingDebug(false);
        }

        // D. Remaining Master Data (from IPQC Passed Units)
        setIsLoadingRemaining(true);
        try {
            const remQuery = new URLSearchParams({
                page: String(remainingPage),
                limit: String(remainingLimit),
                search: remainingSearch
            });
            const remRes = await apiFetch(`/api/rrh/ecn/programming/sessions/${sessionId}/remaining-master-data?${remQuery.toString()}`);
            setRemainingItems(remRes?.data || []);
            setRemainingTotal(remRes?.total || 0);
        } catch (err: any) {
            // Ignore
        } finally {
            setIsLoadingRemaining(false);
        }

        // E. Live Session Stats from Server
        try {
            const sRes = await apiFetch(`/api/rrh/ecn/programming/sessions/${sessionId}`);
            if (sRes?.stats) {
                setStats(sRes.stats);
            }
        } catch (err: any) {
            // Ignore
        }
    }, [scannedPage, scannedLimit, scannedSearch, debugSearch, debugStatusFilter, remainingPage, remainingLimit, remainingSearch]);

    useEffect(() => {
        if (activeSession?.id) {
            loadActiveSessionDetails(activeSession.id);
        }
    }, [activeSession?.id, loadActiveSessionDetails]);

    // ─── 9. Serial Lookup / Scan ─────────────────────────────────────────────
    const handleSerialLookup = async (serialToSearch?: string, isAutoLookup = false) => {
        if (!activeSession) {
            addToast('Please select or start a Programming session first.', 'warning');
            return;
        }

        const serial = (serialToSearch || scannerInput).trim().toUpperCase();
        if (!serial) {
            if (!isAutoLookup) addToast('Please enter or scan a Serial Number.', 'warning');
            return;
        }

        setIsSearchingSerial(true);
        try {
            const res = await apiFetch(
                `/api/rrh/ecn/programming/lookup?serial=${encodeURIComponent(serial)}&work_order_id=${encodeURIComponent(activeSession.work_order_id)}&session_id=${activeSession.id}`
            );

            const data = res?.data || res;
            if (!data || !data.found) {
                addToast(data.message || `Serial "${serial}" not found in passed IPQC units.`, 'error');
                return;
            }

            const resolvedSerial = data.band_serial_no || data.serial_number;

            const initialBand = data.band || getBandFromTpn(data.physical_tpn) || '';
            const initialELevel = (data.e_level || data.e_label || '').trim();
            const initialPam12 = (data.pam1_2_tpn || data.pam_tpn || '').trim();
            const masterMatch = byELevelMap.get(initialELevel.toUpperCase());
            const initialPam34 = (
                data.pam3_4_tpn ||
                masterMatch?.pam3_4 ||
                (isSingleBand(initialBand) ? initialPam12 : initialPam12)
            ).trim();

            setLoadedUnit({
                serial_number: data.serial_number,
                band_serial_no: resolvedSerial,
                physical_tpn: data.physical_tpn,
                band: initialBand,
                bat_lot_no: data.bat_lot_no || '—',
                tejas_dc_no: data.tejas_dc_no || '—',
                tejas_obd_no: data.tejas_obd_no || '—',
                duplexer_main: data.duplexer_main || '—',
                duplexer_part_no: data.duplexer_part_no || '—',
                duplexer_sno: data.duplexer_sno || data.duplexer_sl_no || '—',
                duplexer_sl_no: data.duplexer_sl_no || data.duplexer_sno || '—',
                rrh_unit: data.rrh_unit || 'no defect',
                ipqc_status: data.ipqc_status || 'COMPLETED',
                ipqc_inspected_by: data.ipqc_inspected_by || 'System Admin',
                ipqc_remarks: data.ipqc_remarks,
                work_order_id: data.work_order_id,
                sl_no: data.sl_no,
                ipqc_id: data.ipqc_id,
                ivi_id: data.ivi_id,
                inspection_date: getTodayLocalDate(),
                e_level: initialELevel,
                pam1_2_tpn: initialPam12,
                pam3_4_tpn: initialPam34,
                previous_band: data.previous_band || initialBand,
                previous_e_level: data.previous_e_level || initialELevel,
                previous_pam1_2: data.previous_pam1_2 || initialPam12,
                previous_pam3_4: data.previous_pam3_4 || initialPam34,
                is_pam_changed: !!data.is_pam_changed,
                pam_change_remarks: data.pam_change_remarks || '',
                changed_component: data.changed_component || 'None'
            });

            // Ensure Change/Swap toggle is reset so fields are filled with IPQC values by default
            setShowPamSwapToggle(false);

            // Populate verification inputs with IPQC values
            setELevel(initialELevel);
            setPam12Tpn(initialPam12);
            setPam34Tpn(initialPam34);

            // Snapshot immutable previous config
            const snapshot = {
                previousBand: (data.previous_band || initialBand).trim(),
                previousELevel: (data.previous_e_level || initialELevel).trim(),
                previousPam1_2: (data.previous_pam1_2 || initialPam12).trim(),
                previousPam3_4: (data.previous_pam3_4 || initialPam34).trim()
            };
            setPreviousConfig(snapshot);

            // Auto-verify from IPQC so operator does not have to scan or type them again
            if (data.is_pam_changed) {
                setIsPamSwapped(true);
                setChangedComponent(data.changed_component || 'PAM Changed');
                setPamChangeRemarks(data.pam_change_remarks || '');
            } else {
                setIsPamSwapped(false);
                setChangedComponent('None');
                setPamChangeRemarks('');
            }
            setIsVerified(true);
            setVerificationError(null);
            setMismatchedFields(null);

            setSelectedDecision('PASS');
            setFailureRemarks('');

            if (data.already_inspected) {
                const prev = data.previous_inspection;
                setReinspectionInfo({
                    isReinspected: true,
                    previousFailureRemarks: prev?.remarks || ''
                });
                if (prev?.status === 'FAIL') {
                    setSelectedDecision('PASS');
                }
                addToast(`Unit "${resolvedSerial}" was previously inspected. Loaded in Re-Inspection mode.`, 'info');
            } else {
                setReinspectionInfo(null);
                addToast(`Unit "${resolvedSerial}" loaded successfully from IPQC.`, 'success');
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

    // Auto-lookup serial without pressing enter (debounced 300ms)
    useEffect(() => {
        if (!activeSession) return;
        const clean = scannerInput.trim().toUpperCase();
        if (!clean) return;

        if (loadedUnit && (loadedUnit.serial_number?.toUpperCase() === clean || loadedUnit.band_serial_no?.toUpperCase() === clean)) {
            return;
        }

        if (clean.length < 3) return;

        const timer = setTimeout(() => {
            handleSerialLookup(clean, true);
        }, 300);

        return () => clearTimeout(timer);
    }, [scannerInput, activeSession, loadedUnit]);

    // ─── 10. Inspect Unit from Remaining Table ───────────────────────────────
    const handleInspectRemainingUnit = (item: RemainingMasterItem) => {
        const serial = item.band_serial_no || item.serial_number;
        setScannerInput(serial);
        handleSerialLookup(serial);
        scannerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // ─── 11. Outcome Decision Selection ──────────────────────────────────────
    const handleSelectDecision = (status: 'PASS' | 'FAIL') => {
        if (!isVerified) {
            addToast('Verification with Master Data is required before selecting an outcome.', 'warning');
            return;
        }
        setSelectedDecision(status);
        if (status === 'PASS') {
            setFailureRemarks('');
        }
    };

    // ─── 12. Submit Inspection ───────────────────────────────────────────────
    const handleSubmitInspection = async () => {
        if (!activeSession) {
            addToast('No active session found.', 'error');
            return;
        }

        if (!loadedUnit) {
            addToast('Please scan or lookup a unit before submitting inspection.', 'warning');
            return;
        }

        if (!isVerified) {
            addToast('Master Data Verification is required before submitting inspection.', 'error');
            return;
        }

        if (!selectedDecision) {
            addToast('Please select either PASS or FAIL before submitting.', 'warning');
            return;
        }

        if (selectedDecision === 'FAIL' && !failureRemarks.trim()) {
            addToast('Please enter defect remarks / failure reason.', 'warning');
            return;
        }

        setIsSubmittingInspection(true);
        try {
            const resultStatus = selectedDecision;
            const payload = {
                work_order_id: activeSession.work_order_id,
                serial_number: loadedUnit.serial_number || loadedUnit.band_serial_no,
                band_serial_no: loadedUnit.band_serial_no || loadedUnit.serial_number,
                physical_tpn: loadedUnit.physical_tpn,
                band: loadedUnit.band,
                status: resultStatus,
                remarks: resultStatus === 'FAIL' ? failureRemarks.trim() : (reinspectionInfo?.isReinspected ? 'Passed re-inspection in Programming' : null),
                inspection_date: getTodayLocalDate(),
                ipqc_inspection_id: loadedUnit.ipqc_id || null,
                ivi_inspection_id: loadedUnit.ivi_id || null,
                sl_no: loadedUnit.sl_no || null,
                is_reinspected: !!reinspectionInfo?.isReinspected,
                defect_fixed: reinspectionInfo?.isReinspected && selectedDecision === 'PASS' ? 'Defect resolved and verified in Programming.' : null,
                // Component & E-Level Verification and PAM Swap Audit fields
                e_level: eLevel.trim().toUpperCase(),
                pam1_2_tpn: pam12Tpn.trim().toUpperCase(),
                pam3_4_tpn: pam34Tpn.trim().toUpperCase(),
                is_pam_changed: isPamSwapped,
                isPamChanged: isPamSwapped,
                pam_change_remarks: isPamSwapped ? pamChangeRemarks : null,
                pamChangeRemarks: isPamSwapped ? pamChangeRemarks : null,
                changed_component: isPamSwapped ? changedComponent : 'None',
                changedComponent: isPamSwapped ? changedComponent : 'None',
                previous_band: previousConfig?.previousBand || loadedUnit.band,
                previousBand: previousConfig?.previousBand || loadedUnit.band,
                previous_e_level: previousConfig?.previousELevel || eLevel.trim().toUpperCase(),
                previousELevel: previousConfig?.previousELevel || eLevel.trim().toUpperCase(),
                previous_pam1_2: previousConfig?.previousPam1_2 || pam12Tpn.trim().toUpperCase(),
                previousPam1_2: previousConfig?.previousPam1_2 || pam12Tpn.trim().toUpperCase(),
                previous_pam3_4: previousConfig?.previousPam3_4 || pam34Tpn.trim().toUpperCase(),
                previousPam3_4: previousConfig?.previousPam3_4 || pam34Tpn.trim().toUpperCase(),
                new_band: loadedUnit.band,
                newBand: loadedUnit.band,
                new_e_level: eLevel.trim().toUpperCase(),
                newELevel: eLevel.trim().toUpperCase(),
                new_pam1_2: pam12Tpn.trim().toUpperCase(),
                newPam1_2: pam12Tpn.trim().toUpperCase(),
                new_pam3_4: pam34Tpn.trim().toUpperCase(),
                newPam3_4: pam34Tpn.trim().toUpperCase()
            };

            const data = await apiFetch(`/api/rrh/ecn/programming/sessions/${activeSession.id}/inspections`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            addToast(`Programming inspection submitted successfully (${resultStatus}) for ${loadedUnit.band_serial_no}!`, 'success');

            // Reset form
            setLoadedUnit(null);
            setSelectedDecision(null);
            setFailureRemarks('');
            setScannerInput('');
            setReinspectionInfo(null);
            resetVerificationState();

            // Refresh logs
            loadActiveSessionDetails(activeSession.id);
            if (data?.session) {
                setActiveSession(data.session);
            }
        } catch (err: any) {
            addToast(err.message || 'Failed to submit inspection.', 'error');
        } finally {
            setIsSubmittingInspection(false);
            scannerInputRef.current?.focus({ preventScroll: true });
        }
    };

    // ─── 13. Debug Actions ───────────────────────────────────────────────────
    const handleSaveDebugStatus = async () => {
        if (!debugModalItem || !activeSession) return;

        setIsSavingDebugAction(true);
        try {
            await apiFetch(`/api/rrh/ecn/programming/inspections/${debugModalItem.id}/debug-action`, {
                method: 'PATCH',
                body: JSON.stringify({
                    debug_status: debugModalStatus,
                    debug_remarks: debugModalRemarks
                })
            });

            addToast(`Debug status updated to "${debugModalStatus}" for unit ${debugModalItem.band_serial_no || debugModalItem.serial_number}.`, 'success');
            setDebugModalItem(null);
            setDebugModalRemarks('');
            loadActiveSessionDetails(activeSession.id);
        } catch (err: any) {
            addToast(err.message || 'Failed to update debug status.', 'error');
        } finally {
            setIsSavingDebugAction(false);
        }
    };

    const handlePassInProgramming = async (item: DebugInspectionItem) => {
        if (!activeSession) return;

        if (!window.confirm(`Are you sure you want to mark unit "${item.band_serial_no || item.serial_number}" as PASSED in Programming?`)) {
            return;
        }

        try {
            await apiFetch(`/api/rrh/ecn/programming/inspections/${item.id}/debug-action`, {
                method: 'PATCH',
                body: JSON.stringify({
                    debug_status: 'DEBUG_PASS',
                    debug_remarks: 'Rectified and verified directly in Debug Station'
                })
            });

            addToast(`Unit "${item.band_serial_no || item.serial_number}" rectified & passed in Programming!`, 'success');
            loadActiveSessionDetails(activeSession.id);
        } catch (err: any) {
            addToast(err.message || 'Failed to pass unit from debug.', 'error');
        }
    };

    // ─── 14. Excel Exports ───────────────────────────────────────────────────
    const getAuthToken = () => localStorage.getItem('auth_token') || localStorage.getItem('token') || '';

    const downloadExcel = async (
        url: string,
        filename: string,
        successMsg: string,
        errorMsg: string,
        setLoading?: (v: boolean) => void
    ) => {
        setLoading?.(true);
        try {
            const token = getAuthToken();
            const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
            if (!res.ok) throw new Error(errorMsg);
            const blob = await res.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(blobUrl);
            addToast(successMsg, 'success');
        } catch (err: any) {
            addToast(err.message || 'Export failed.', 'error');
        } finally {
            setLoading?.(false);
        }
    };

    const handleExportRecentExcel = () => {
        if (!activeSession) return addToast('No active session selected to export.', 'warning');
        return downloadExcel(
            `/api/rrh/ecn/programming/sessions/${activeSession.id}/export?status=PASS`,
            `RRH_Programming_Recent_Report_${activeSession.work_order_id}.xlsx`,
            'Recent inspections exported successfully.',
            'Failed to export recent records.',
            setIsExportingScanned
        );
    };

    const handleExportSessionExcel = (session: any) => {
        if (!session?.id) return addToast('No session selected to export.', 'warning');
        return downloadExcel(
            `/api/rrh/ecn/programming/sessions/${session.id}/export`,
            `RRH_Programming_Session_Report_${session.work_order_id}.xlsx`,
            'Programming session report downloaded successfully.',
            'Failed to export session report.'
        );
    };

    const handleExportFailedExcel = () => {
        if (!activeSession) return addToast('No active session selected to export.', 'warning');
        return downloadExcel(
            `/api/rrh/ecn/programming/sessions/${activeSession.id}/export?status=FAIL`,
            `RRH_Programming_Failed_Report_${activeSession.work_order_id}.xlsx`,
            'Failed inspections exported successfully.',
            'Failed to export failed records.',
            setIsExportingFailed
        );
    };

    const handleExportDebugExcel = () => {
        if (!activeSession) return addToast('No active session selected to export.', 'warning');
        return downloadExcel(
            `/api/rrh/ecn/programming/sessions/${activeSession.id}/export-debug`,
            `RRH_Programming_Debug_Report_${activeSession.work_order_id}.xlsx`,
            'Debug report exported successfully.',
            'Failed to export debug records.',
            setIsExportingDebug
        );
    };

    const handleExportRemainingExcel = (sessionId?: number, woId?: string) => {
        const targetSessionId = (typeof sessionId === 'number' && sessionId) ? sessionId : activeSession?.id;
        const targetWoId = (typeof woId === 'string' && woId) ? woId : activeSession?.work_order_id;
        if (!targetSessionId) return addToast('No session selected to export unscanned data.', 'warning');
        return downloadExcel(
            `/api/rrh/ecn/programming/sessions/${targetSessionId}/export-unscanned`,
            `RRH_Programming_Unscanned_${targetWoId || 'Report'}.xlsx`,
            'Remaining master data exported successfully.',
            'Failed to export remaining records.',
            setIsExportingRemaining
        );
    };

    const getStatusBadge = (status: string) => {
        const s = (status || '').toUpperCase();
        const cls = (s === 'PASS' || s === 'COMPLETED') ? styles.badgePass
            : (s === 'FAIL' || s === 'ABORTED' || s === 'CANCELLED') ? styles.badgeFail
            : styles.badgeProgress;
        return <span className={cls}>{status}</span>;
    };

    // ═════════════════════════════════════════════════════════════════════════
    // ─── RENDER VIEW 1: Session Setup & Work Order Selection (When No Session Active)
    // ═════════════════════════════════════════════════════════════════════════
    if (!activeSession) {
        return (
            <div className={styles.container}>
                <Toaster toasts={toasts} onRemove={id => setToasts(prev => prev.filter(t => t.id !== id))} />

                <div className={styles.header}>
                    <h2>RRH Programming Station (ECN)</h2>
                    <p>Firmware flashing, FPGA bitstream configuration, and post-IPQC parameter verification.</p>
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
                                            <span className={styles.infoLabel}>IPQC Passed Units</span>
                                            <span className={styles.infoValue} style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981' }}>
                                                {selectedWoDetails.ipqc_passed_count ?? 0}
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
                                    disabled={isCreatingSession}
                                >
                                    {isCreatingSession ? 'Starting Session...' : 'Start Programming Session'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className={styles.card} style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b', border: '1px dashed #cbd5e1' }}>
                            Please select an eligible RRH Work Order to view IPQC Passed Units and start a Programming session.
                        </div>
                    )}

                    {/* Card 2: Active Programming Sessions */}
                    <div className={styles.card}>
                        <h3>Active Programming Sessions</h3>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1, maxWidth: '400px' }}>
                                <input
                                    type="text"
                                    className={styles.input}
                                    placeholder="Search active sessions by WO ID..."
                                    value={activeSearch}
                                    onChange={e => setActiveSearch(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            setActivePage(1);
                                            fetchActiveSessions(1, activeLimit, activeSearch);
                                        }
                                    }}
                                    style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                                />
                                <button
                                    className={styles.button}
                                    onClick={() => {
                                        setActivePage(1);
                                        fetchActiveSessions(1, activeLimit, activeSearch);
                                    }}
                                    style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                                >
                                    Search
                                </button>
                                {activeSearch && (
                                    <button
                                        className={styles.secondaryButton}
                                        onClick={() => {
                                            setActiveSearch('');
                                            setActivePage(1);
                                            fetchActiveSessions(1, activeLimit, '');
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
                                                            onClick={() => {
                                                                setActiveSession(session);
                                                                handleWorkOrderSelect(session.work_order_id);
                                                            }}
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
                                                        No active Programming sessions found. Select a Work Order above to begin.
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

                    {/* Card 3: Completed Programming Sessions History */}
                    <div className={styles.card}>
                        <h3>Completed Programming Sessions History</h3>
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
                                            <td style={{ fontWeight: 700, color: '#4f46e5' }}>{session.work_order_id}</td>
                                            <td>{session.created_by_name || session.created_by || 'System Admin'}</td>
                                            <td style={{ fontSize: '0.85rem', color: '#64748b' }}>{formatTimestamp(session.updated_at || session.created_at)}</td>
                                            <td>{getStatusBadge(session.status)}</td>
                                            <td style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                <button
                                                    className={styles.secondaryButton}
                                                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', backgroundColor: '#eef2ff', color: '#4338ca', borderColor: '#c7d2fe', fontWeight: 600 }}
                                                    onClick={() => {
                                                        setActiveSession(session);
                                                        handleWorkOrderSelect(session.work_order_id);
                                                    }}
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
                                                No completed Programming sessions yet.
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

    // ═════════════════════════════════════════════════════════════════════════
    // ─── RENDER VIEW 2: Inside Active Programming Inspection Session
    // ═════════════════════════════════════════════════════════════════════════
    return (
        <div className={styles.container}>
            <Toaster toasts={toasts} onRemove={id => setToasts(prev => prev.filter(t => t.id !== id))} />

            {/* Top Navigation & Info (SMT Pre-AOI detailHeaderCard style matching IVI & IPQC) */}
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
                            RRH Programming — Active Session
                        </h3>
                        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', marginTop: '0.75rem', color: '#374151', fontSize: '0.95rem', flexWrap: 'wrap' }}>
                            <span>Work Order: <strong style={{ color: '#4f46e5' }}>{activeSession.work_order_id}</strong></span>
                            <span>Session ID: <strong>{activeSession.id}</strong></span>
                            <span>Date: <strong>{formatWoDateTime(activeSession.work_order_date || activeSession.date || selectedWoDetails?.work_order_date || activeSession.created_at)}</strong></span>
                            <span>Status: {getStatusBadge(activeSession.status)}</span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <button
                            type="button"
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
                            type="button"
                            className={styles.downloadMasterButton}
                            onClick={() => handleExportRemainingExcel()}
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
                            type="button"
                            className={styles.detailBackButton}
                            onClick={() => {
                                setActiveSession(null);
                                setLoadedUnit(null);
                                setSelectedDecision(null);
                                setScannerInput('');
                                resetVerificationState();
                                fetchActiveSessions();
                                fetchCompletedSessions();
                            }}
                        >
                            ← Back to Session Setup
                        </button>
                    </div>
                </div>
            </div>

            {/* Summary Statistics Dashboard Cards (Single Row layout matching IPQC) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                <div className={styles.card} style={{ margin: 0, padding: '1.25rem', borderLeft: '5px solid #2563eb', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>Lot Quantity</p>
                    <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.8rem', color: '#1e293b', fontWeight: 800 }}>{selectedWoDetails?.lot_quantity || activeSession.lot_quantity || 0}</h2>
                </div>
                <div className={styles.card} style={{ margin: 0, padding: '1.25rem', borderLeft: '5px solid #8b5cf6', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>Remaining Lot Quantity</p>
                    <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.8rem', color: '#6d28d9', fontWeight: 800 }}>{Math.max(0, (selectedWoDetails?.lot_quantity || activeSession.lot_quantity || 0) - stats.totalScanned)}</h2>
                </div>
                <div className={styles.card} style={{ margin: 0, padding: '1.25rem', borderLeft: '5px solid #0ea5e9', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>IPQC Passed</p>
                    <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.8rem', color: '#0284c7', fontWeight: 800 }}>{stats.ipqcPassed ?? 0}</h2>
                </div>
                <div className={styles.card} style={{ margin: 0, padding: '1.25rem', borderLeft: '5px solid #16a34a', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>Passed</p>
                    <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.8rem', color: '#15803d', fontWeight: 800 }}>{stats.passed}</h2>
                </div>
                <div className={styles.card} style={{ margin: 0, padding: '1.25rem', borderLeft: '5px solid #dc2626', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>Failed</p>
                    <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.8rem', color: '#b91c1c', fontWeight: 800 }}>{stats.failed}</h2>
                </div>
                <div className={styles.card} style={{ margin: 0, padding: '1.25rem', borderLeft: '5px solid #f59e0b', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>Debug</p>
                    <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.8rem', color: '#b45309', fontWeight: 800 }}>{stats.debug}</h2>
                </div>
            </div>

            {/* ─── BARCODE SCANNER & PROGRAMMING INSPECTION CARD ───────────────── */}
            <div ref={scannerSectionRef} className={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '8px' }}>
                    <h3 style={{ margin: 0, border: 'none', padding: 0 }}>
                        Barcode Scanner & Programming Inspection
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {/* Change / Swap Toggle Button */}
                        <button
                            type="button"
                            onClick={handleTogglePamSwap}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '0.35rem 0.75rem',
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                borderRadius: '6px',
                                border: showPamSwapToggle ? '1.5px solid #7c3aed' : '1px solid #cbd5e1',
                                backgroundColor: showPamSwapToggle ? '#7c3aed' : '#ffffff',
                                color: showPamSwapToggle ? '#ffffff' : '#475569',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                boxShadow: showPamSwapToggle ? '0 2px 4px rgba(124, 58, 237, 0.25)' : 'none'
                            }}
                            title={showPamSwapToggle ? 'Click to cancel swap and restore IPQC details' : 'Click to enter swapped plate details'}
                        >
                            <span>Change/Swap</span>
                            <span style={{
                                display: 'inline-block',
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: showPamSwapToggle ? '#4ade80' : '#cbd5e1'
                            }} />
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#16a34a', fontWeight: 600 }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16a34a', display: 'inline-block' }}></span>
                            Scanner Ready
                        </div>
                    </div>
                </div>

                {/* Scanner Input Row */}
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                    <div style={{ flex: '1 1 320px' }}>
                        <label className={styles.label} style={{ marginBottom: '0.35rem', display: 'block', fontWeight: 600 }}>
                            Scan / Enter Serial Number or Barcode *
                        </label>
                        <input
                            ref={scannerInputRef}
                            type="text"
                            className={styles.input}
                            placeholder="Scan or enter Serial No / Band Serial No..."
                            value={scannerInput}
                            onChange={e => setScannerInput(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') {
                                    handleSerialLookup();
                                }
                            }}
                            autoFocus
                        />
                    </div>

                    <button
                        type="button"
                        className={styles.button}
                        onClick={() => handleSerialLookup()}
                        disabled={isSearchingSerial || !scannerInput.trim()}
                    >
                        {isSearchingSerial ? 'Searching...' : 'Lookup Serial'}
                    </button>

                    {loadedUnit && (
                        <button
                            type="button"
                            className={styles.cancelClearButton}
                            onClick={() => {
                                setLoadedUnit(null);
                                setSelectedDecision(null);
                                setFailureRemarks('');
                                setScannerInput('');
                                setReinspectionInfo(null);
                                resetVerificationState();
                            }}
                        >
                            <RotateCcw size={14} /> Clear Loaded Unit
                        </button>
                    )}
                </div>

                {/* Loaded Unit Details & Decision Box */}
                {loadedUnit ? (
                    <div className={styles.scannedInfoPanel}>
                        <div className={styles.scannedInfoHeader}>
                            <span className={styles.scannedInfoTitle}>
                                Unit Information — <strong style={{ color: '#4f46e5' }}>{loadedUnit.band_serial_no || loadedUnit.serial_number}</strong>
                            </span>
                            <span className={styles.badgeSuccess}>
                                Ready for Programming & Verification
                            </span>
                        </div>

                        <div className={styles.scannedInfoGridRow1}>
                            <div className={styles.scannedInfoItem}>
                                <span className={styles.scannedInfoLabel}>Physical TPN</span>
                                <span className={styles.scannedInfoValue}>{loadedUnit.physical_tpn || '—'}</span>
                            </div>
                            <div className={styles.scannedInfoItem}>
                                <span className={styles.scannedInfoLabel}>Band Serial No</span>
                                <span className={styles.scannedInfoValue} style={{ color: '#4f46e5', fontWeight: 700 }}>
                                    {loadedUnit.band_serial_no || '—'}
                                </span>
                            </div>
                            <div className={styles.scannedInfoItem}>
                                <span className={styles.scannedInfoLabel}>Physical Serial No</span>
                                <span className={styles.scannedInfoValue}>{loadedUnit.serial_number || '—'}</span>
                            </div>
                            <div className={styles.scannedInfoItem}>
                                <span className={styles.scannedInfoLabel}>Frequency Band</span>
                                <span className={styles.scannedInfoValue}>
                                    <span style={{
                                        backgroundColor: '#e0f2fe',
                                        color: '#0369a1',
                                        padding: '0.15rem 0.5rem',
                                        borderRadius: '4px',
                                        fontWeight: 700,
                                        fontSize: '0.82rem'
                                    }}>
                                        {loadedUnit.band || '—'}
                                    </span>
                                </span>
                            </div>
                            <div className={styles.scannedInfoItem}>
                                <span className={styles.scannedInfoLabel}>BAT Lot Number</span>
                                <span className={styles.scannedInfoValue}>{loadedUnit.bat_lot_no || '—'}</span>
                            </div>
                            <div className={styles.scannedInfoItem}>
                                <span className={styles.scannedInfoLabel}>Tejas DC No</span>
                                <span className={styles.scannedInfoValue}>{loadedUnit.tejas_dc_no || '—'}</span>
                            </div>
                            <div className={styles.scannedInfoItem}>
                                <span className={styles.scannedInfoLabel}>Tejas OBD No</span>
                                <span className={styles.scannedInfoValue}>{loadedUnit.tejas_obd_no || '—'}</span>
                            </div>
                            <div className={styles.scannedInfoItem}>
                                <span className={styles.scannedInfoLabel}>Duplexer Main</span>
                                <span className={styles.scannedInfoValue}>{loadedUnit.duplexer_main || '—'}</span>
                            </div>
                            <div className={styles.scannedInfoItem}>
                                <span className={styles.scannedInfoLabel}>Duplexer Part No</span>
                                <span className={styles.scannedInfoValue}>{loadedUnit.duplexer_part_no || '—'}</span>
                            </div>
                            <div className={styles.scannedInfoItem}>
                                <span className={styles.scannedInfoLabel}>Duplexer SL.No</span>
                                <span className={styles.scannedInfoValue}>{loadedUnit.duplexer_sno || loadedUnit.duplexer_sl_no || '—'}</span>
                            </div>
                        </div>

                        {/* Extra Details Row */}
                        <div className={styles.scannedInfoGridRow2}>
                            <div className={styles.scannedInfoItem}>
                                <span className={styles.scannedInfoLabel}>RRH Unit (from IVI)</span>
                                <span className={styles.scannedInfoValue}>
                                    {cleanDefectDescription(loadedUnit.rrh_unit) || 'no defect'}
                                </span>
                            </div>
                            <div className={styles.scannedInfoItem}>
                                <span className={styles.scannedInfoLabel}>IPQC Status</span>
                                <div>
                                    <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '0.2rem 0.6rem',
                                        borderRadius: '4px',
                                        fontSize: '0.8rem',
                                        fontWeight: 700,
                                        backgroundColor: '#dcfce7',
                                        color: '#15803d',
                                        border: '1px solid #86efac'
                                    }}>
                                        {loadedUnit.ipqc_status || 'COMPLETED'}
                                    </span>
                                </div>
                            </div>
                            <div className={styles.scannedInfoItem}>
                                <span className={styles.scannedInfoLabel}>IPQC Inspected By</span>
                                <span className={styles.scannedInfoValue}>{loadedUnit.ipqc_inspected_by || 'System Admin'}</span>
                            </div>
                        </div>

                        {/* Re-inspection Notice */}
                        {reinspectionInfo?.isReinspected && (
                            <div className={styles.reinspectionBanner}>
                                <AlertCircle size={20} />
                                <div>
                                    <strong>RE-INSPECTION MODE:</strong> This unit previously failed programming verification.
                                    {reinspectionInfo.previousFailureRemarks && (
                                        <div style={{ fontSize: '0.85rem', marginTop: '0.2rem' }}>
                                            <em>Previous Defect:</em> {reinspectionInfo.previousFailureRemarks}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ─── COMPONENT & E-LEVEL VERIFICATION CARD ────────────────────────── */}
                        <div style={{
                            background: '#ffffff',
                            border: isVerified 
                                ? (isPamSwapped ? '1.5px solid #a855f7' : '1.5px solid #10b981') 
                                : verificationError 
                                    ? '1.5px solid #ef4444' 
                                    : '1.5px solid #e2e8f0',
                            borderRadius: '10px',
                            padding: '1.25rem 1.5rem',
                            marginTop: '1.25rem',
                            marginBottom: '1.25rem',
                            boxShadow: isVerified 
                                ? (isPamSwapped ? '0 4px 12px rgba(168, 85, 247, 0.12)' : '0 4px 12px rgba(16, 185, 129, 0.12)') 
                                : '0 2px 4px rgba(0, 0, 0, 0.04)',
                            transition: 'all 0.25s ease'
                        }}>
                            {/* Header */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: '0.75rem',
                                marginBottom: '1rem',
                                paddingBottom: '0.75rem',
                                borderBottom: '1px solid #f1f5f9'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontSize: '1.02rem', fontWeight: 700, color: '#0f172a' }}>
                                        Component & E-Level Verification
                                    </span>
                                    {loadedUnit && (
                                        <button
                                            type="button"
                                            onClick={handleTogglePamSwap}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '0.25rem 0.65rem',
                                                fontSize: '0.78rem',
                                                fontWeight: 700,
                                                borderRadius: '6px',
                                                border: showPamSwapToggle ? '1.5px solid #7c3aed' : '1px solid #cbd5e1',
                                                backgroundColor: showPamSwapToggle ? '#7c3aed' : '#ffffff',
                                                color: showPamSwapToggle ? '#ffffff' : '#475569',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease',
                                                boxShadow: showPamSwapToggle ? '0 2px 4px rgba(124, 58, 237, 0.2)' : 'none'
                                            }}
                                            title={showPamSwapToggle ? 'Click to cancel swap and restore IPQC details' : 'Click to swap PAM plates and enter new details'}
                                        >
                                            <span>Change / Swap</span>
                                            <span style={{
                                                display: 'inline-block',
                                                width: '7px',
                                                height: '7px',
                                                borderRadius: '50%',
                                                backgroundColor: showPamSwapToggle ? '#4ade80' : '#cbd5e1'
                                            }} />
                                        </button>
                                    )}
                                </div>

                                {/* Verification Status Badge */}
                                <div>
                                    {isVerified ? (
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '0.3rem 0.75rem',
                                            borderRadius: '9999px',
                                            fontSize: '0.82rem',
                                            fontWeight: 700,
                                            backgroundColor: isPamSwapped ? '#f5f3ff' : '#ecfdf5',
                                            color: isPamSwapped ? '#6b21a8' : '#047857',
                                            border: isPamSwapped ? '1px solid #c084fc' : '1px solid #86efac'
                                        }}>
                                            {isPamSwapped ? 'PAM Plate Swapped & Re-Mapped' : 'Verified from IPQC'}
                                        </span>
                                    ) : verificationError ? (
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '0.3rem 0.75rem',
                                            borderRadius: '9999px',
                                            fontSize: '0.82rem',
                                            fontWeight: 700,
                                            backgroundColor: '#fef2f2',
                                            color: '#b91c1c',
                                            border: '1px solid #fca5a5'
                                        }}>
                                            Verification Mismatch
                                        </span>
                                    ) : (
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '0.3rem 0.75rem',
                                            borderRadius: '9999px',
                                            fontSize: '0.82rem',
                                            fontWeight: 700,
                                            backgroundColor: '#f8fafc',
                                            color: '#64748b',
                                            border: '1px solid #cbd5e1'
                                        }}>
                                            Verification Pending (Decision Locked)
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* 3 Inputs Grid */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
                                gap: '1rem',
                                marginBottom: '1rem'
                            }}>
                                {/* 1. E-Level */}
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                        <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                                            1. {showPamSwapToggle ? 'Scan / Enter E-Level *' : 'E-Level'}
                                        </label>
                                    </div>
                                    <input
                                        ref={eLevelRef}
                                        type="text"
                                        value={eLevel}
                                        readOnly={!showPamSwapToggle}
                                        onChange={e => handleELevelChange(e.target.value)}
                                        onKeyDown={e => {
                                             if (e.key === 'Enter') {
                                                 e.preventDefault();
                                                 const val = (e.target as HTMLInputElement).value;
                                                 handleELevelChange(val);
                                                 pam12TpnRef.current?.focus();
                                                 if (val && pam12Tpn && pam34Tpn) {
                                                     verifyAgainstMasterData(val, pam12Tpn, pam34Tpn);
                                                 }
                                             }
                                        }}
                                        onBlur={e => {
                                             const val = (e.target as HTMLInputElement).value;
                                             if (showPamSwapToggle && val && pam12Tpn && pam34Tpn && !isVerified) {
                                                 verifyAgainstMasterData(val, pam12Tpn, pam34Tpn);
                                             }
                                        }}
                                        placeholder={showPamSwapToggle ? "Scan or type E-Level (e.g. 611-PCA000215-E)..." : ""}
                                        style={{
                                            width: '100%',
                                            padding: '0.65rem 0.85rem',
                                            fontSize: '0.92rem',
                                            fontWeight: 600,
                                            borderRadius: '6px',
                                            border: mismatchedFields?.eLevel ? '1.5px solid #ef4444' : (!showPamSwapToggle ? '1.5px solid #86efac' : '1px solid #cbd5e1'),
                                            backgroundColor: mismatchedFields?.eLevel ? '#fef2f2' : (!showPamSwapToggle ? '#f0fdf4' : '#ffffff'),
                                            color: '#0f172a',
                                            outline: 'none',
                                            boxSizing: 'border-box',
                                            cursor: !showPamSwapToggle ? 'default' : 'text'
                                        }}
                                        autoComplete="off"
                                        spellCheck={false}
                                    />
                                </div>

                                {/* 2. PAM 1&2 TPN + Action Button */}
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                        <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                                            2. {showPamSwapToggle ? 'Scan / Enter PAM 1&2 TPN *' : 'PAM 1&2 TPN'}
                                        </label>
                                        {showPamSwapToggle && (
                                            <button
                                                type="button"
                                                onClick={() => handleOpenSwapModal('PAM12')}
                                                style={{
                                                    padding: '0.2rem 0.55rem',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700,
                                                    backgroundColor: '#f5f3ff',
                                                    color: '#6d28d9',
                                                    border: '1px solid #ddd6fe',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    transition: 'all 0.15s ease'
                                                }}
                                                title="Override or swap PAM 1&2 plate and auto re-map Band & E-Level"
                                            >
                                                <span>Change / Swap PAM 1&2</span>
                                            </button>
                                        )}
                                    </div>
                                    <input
                                        ref={pam12TpnRef}
                                        type="text"
                                        value={pam12Tpn}
                                        readOnly={!showPamSwapToggle}
                                        onChange={e => handlePam12Change(e.target.value)}
                                        onKeyDown={e => {
                                             if (e.key === 'Enter') {
                                                 e.preventDefault();
                                                 const val = (e.target as HTMLInputElement).value;
                                                 handlePam12Change(val);
                                                 const single = isSingleBand(loadedUnit?.band);
                                                 if (single) {
                                                     setPam34Tpn(val);
                                                     if (eLevel) verifyAgainstMasterData(eLevel, val, val);
                                                 } else {
                                                     pam34TpnRef.current?.focus();
                                                     if (eLevel && pam34Tpn) verifyAgainstMasterData(eLevel, val, pam34Tpn);
                                                 }
                                             }
                                        }}
                                        onBlur={e => {
                                             const val = (e.target as HTMLInputElement).value;
                                             const single = isSingleBand(loadedUnit?.band);
                                             const effectiveP34 = single && val ? val : pam34Tpn;
                                             if (single && val && !pam34Tpn) setPam34Tpn(val);
                                             if (showPamSwapToggle && eLevel && val && effectiveP34 && !isVerified) {
                                                 verifyAgainstMasterData(eLevel, val, effectiveP34);
                                             }
                                        }}
                                        placeholder={showPamSwapToggle ? "Scan or type PAM 1&2 TPN (e.g. 611-PCA000146-L)..." : ""}
                                        style={{
                                            width: '100%',
                                            padding: '0.65rem 0.85rem',
                                            fontSize: '0.92rem',
                                            fontWeight: 600,
                                            borderRadius: '6px',
                                            border: mismatchedFields?.pam12 ? '1.5px solid #ef4444' : (!showPamSwapToggle ? '1.5px solid #86efac' : '1px solid #cbd5e1'),
                                            backgroundColor: mismatchedFields?.pam12 ? '#fef2f2' : (!showPamSwapToggle ? '#f0fdf4' : '#ffffff'),
                                            color: '#0f172a',
                                            outline: 'none',
                                            boxSizing: 'border-box',
                                            cursor: !showPamSwapToggle ? 'default' : 'text'
                                        }}
                                        autoComplete="off"
                                        spellCheck={false}
                                    />
                                </div>

                                {/* 3. PAM 3&4 TPN + Action Button */}
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                        <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                                            3. {showPamSwapToggle ? 'Scan / Enter PAM 3&4 TPN *' : 'PAM 3&4 TPN'} {isSingleBand(loadedUnit?.band) && (
                                                <span style={{ fontSize: '0.72rem', color: '#6366f1', fontWeight: 600 }}>
                                                    (Single Band)
                                                </span>
                                            )}
                                        </label>
                                        {showPamSwapToggle && (
                                            <button
                                                type="button"
                                                onClick={() => handleOpenSwapModal('PAM34')}
                                                style={{
                                                    padding: '0.2rem 0.55rem',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700,
                                                    backgroundColor: '#f5f3ff',
                                                    color: '#6d28d9',
                                                    border: '1px solid #ddd6fe',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    transition: 'all 0.15s ease'
                                                }}
                                                title="Override or swap PAM 3&4 plate and auto re-map Band & E-Level"
                                            >
                                                <span>Change / Swap PAM 3&4</span>
                                            </button>
                                        )}
                                    </div>
                                    <input
                                        ref={pam34TpnRef}
                                        type="text"
                                        value={pam34Tpn}
                                        readOnly={!showPamSwapToggle}
                                        onChange={e => handlePam34Change(e.target.value)}
                                        onKeyDown={e => {
                                             if (e.key === 'Enter') {
                                                 e.preventDefault();
                                                 const val = (e.target as HTMLInputElement).value;
                                                 handlePam34Change(val);
                                                 if (eLevel && pam12Tpn && val) {
                                                     verifyAgainstMasterData(eLevel, pam12Tpn, val);
                                                 }
                                             }
                                        }}
                                        onBlur={e => {
                                             const val = (e.target as HTMLInputElement).value;
                                             if (showPamSwapToggle && eLevel && pam12Tpn && val && !isVerified) {
                                                 verifyAgainstMasterData(eLevel, pam12Tpn, val);
                                             }
                                        }}
                                        placeholder={showPamSwapToggle ? "Scan or type PAM 3&4 TPN (e.g. 611-PCA000124-L)..." : ""}
                                        style={{
                                            width: '100%',
                                            padding: '0.65rem 0.85rem',
                                            fontSize: '0.92rem',
                                            fontWeight: 600,
                                            borderRadius: '6px',
                                            border: mismatchedFields?.pam34 ? '1.5px solid #ef4444' : (!showPamSwapToggle ? '1.5px solid #86efac' : '1px solid #cbd5e1'),
                                            backgroundColor: mismatchedFields?.pam34 ? '#fef2f2' : (!showPamSwapToggle ? '#f0fdf4' : '#ffffff'),
                                            color: '#0f172a',
                                            outline: 'none',
                                            boxSizing: 'border-box',
                                            cursor: !showPamSwapToggle ? 'default' : 'text'
                                        }}
                                        autoComplete="off"
                                        spellCheck={false}
                                    />
                                </div>
                            </div>

                            {/* Verification / Swap Status & Transition Banner */}
                            {isPamSwapped ? (
                                <div style={{
                                    background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
                                    border: '1px solid #d8b4fe',
                                    borderRadius: '8px',
                                    padding: '0.85rem 1rem',
                                    color: '#581c87',
                                    fontSize: '0.85rem'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '6px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                                            <span>Dynamic PAM Plate Swap & Re-Mapping Applied ({changedComponent})</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleRevertPamSwap}
                                            style={{
                                                padding: '0.2rem 0.6rem',
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                backgroundColor: '#ffffff',
                                                color: '#6b21a8',
                                                border: '1px solid #c084fc',
                                                borderRadius: '4px',
                                                cursor: 'pointer'
                                            }}
                                            title="Revert swap back to initial configuration"
                                        >
                                            Revert to Previous Config
                                        </button>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.5rem', background: 'rgba(255,255,255,0.7)', padding: '0.6rem 0.85rem', borderRadius: '6px', border: '1px solid #e9d5ff' }}>
                                        <div>
                                            <span style={{ fontWeight: 700, color: '#7e22ce' }}>Previous Config: </span>
                                            <span style={{ color: '#4b5563' }}>
                                                Band: <strong>{previousConfig?.previousBand || '—'}</strong> | E-Level: <strong>{previousConfig?.previousELevel || '—'}</strong> | PAM 1&2: <strong>{previousConfig?.previousPam1_2 || '—'}</strong> | PAM 3&4: <strong>{previousConfig?.previousPam3_4 || '—'}</strong>
                                            </span>
                                        </div>
                                        <div>
                                            <span style={{ fontWeight: 700, color: '#15803d' }}>New Re-Mapped Config: </span>
                                            <span style={{ color: '#0f172a' }}>
                                                Band: <strong style={{ color: '#0369a1' }}>{loadedUnit.band}</strong> | E-Level: <strong style={{ color: '#4f46e5' }}>{eLevel}</strong> | PAM 1&2: <strong>{pam12Tpn}</strong> | PAM 3&4: <strong>{pam34Tpn}</strong>
                                            </span>
                                        </div>
                                    </div>
                                    {pamChangeRemarks && (
                                        <div style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: '#6b21a8', fontStyle: 'italic' }}>
                                            Remarks: {pamChangeRemarks}
                                        </div>
                                    )}
                                </div>
                            ) : verificationError ? (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '0.65rem 1rem',
                                    borderRadius: '8px',
                                    backgroundColor: '#fef2f2',
                                    border: '1px solid #fca5a5',
                                    color: '#991b1b',
                                    fontSize: '0.88rem',
                                    fontWeight: 600
                                }}>
                                    <span>{verificationError}</span>
                                </div>
                            ) : !isVerified && showPamSwapToggle ? (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '0.55rem 0.9rem',
                                    borderRadius: '8px',
                                    backgroundColor: '#f8fafc',
                                    border: '1px dashed #cbd5e1',
                                    color: '#64748b',
                                    fontSize: '0.85rem'
                                }}>
                                    <span>
                                        Scan or enter <strong>new E-Level</strong>, <strong>PAM 1&2 TPN</strong>, and <strong>PAM 3&4 TPN</strong> to verify with Master Data and unlock PASS / FAIL decisions. Use <strong>Change / Swap</strong> buttons if PAM plates were swapped.
                                    </span>
                                </div>
                            ) : null}
                        </div>

                        {/* ─── PASS & FAIL DECISION SECTION ────────────────────── */}
                        <div className={styles.decisionSection}>
                            <div className={styles.decisionHeader}>
                                <span>Inspection Outcome Decision</span>
                            </div>

                            <div className={styles.decisionButtonGrid}>
                                <button
                                    type="button"
                                    onClick={() => handleSelectDecision('PASS')}
                                    disabled={!isVerified}
                                    className={`${styles.decisionBtn} ${styles.decisionPassBtn} ${selectedDecision === 'PASS' ? styles.decisionPassBtnActive : ''}`}
                                    style={{
                                        opacity: !isVerified ? 0.45 : 1,
                                        cursor: !isVerified ? 'not-allowed' : 'pointer'
                                    }}
                                    title={!isVerified ? 'Verification required to enable PASS' : 'Mark unit as PASS'}
                                >
                                    <CheckCircle size={24} />
                                    <span>PASS {!isVerified && '(Locked)'}</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleSelectDecision('FAIL')}
                                    disabled={!isVerified}
                                    className={`${styles.decisionBtn} ${styles.decisionFailBtn} ${selectedDecision === 'FAIL' ? styles.decisionFailBtnActive : ''}`}
                                    style={{
                                        opacity: !isVerified ? 0.45 : 1,
                                        cursor: !isVerified ? 'not-allowed' : 'pointer'
                                    }}
                                    title={!isVerified ? 'Verification required to enable FAIL' : 'Mark unit as FAIL'}
                                >
                                    <XCircle size={24} />
                                    <span>FAIL {!isVerified && '(Locked)'}</span>
                                </button>
                            </div>

                            {/* Dynamic Defect Remarks Textbox (Shown ONLY when FAIL is selected) */}
                            {selectedDecision === 'FAIL' && (
                                <div className={styles.failRemarksBox}>
                                    <label className={styles.failRemarksLabel}>
                                        Defect Remarks / Failure Reason *
                                    </label>
                                    <textarea
                                        value={failureRemarks}
                                        onChange={e => setFailureRemarks(e.target.value)}
                                        placeholder="Enter detailed programming failure remarks (e.g., Firmware checksum mismatch, FPGA config timeout, power rail response failure)..."
                                        className={styles.failRemarksInput}
                                        rows={3}
                                        autoFocus
                                        required
                                    />
                                </div>
                            )}

                            {/* Submit Inspection Button Matching IVI/IPQC */}
                            <button
                                type="button"
                                onClick={handleSubmitInspection}
                                disabled={!isVerified || !selectedDecision || isSubmittingInspection || (selectedDecision === 'FAIL' && !failureRemarks.trim())}
                                className={styles.submitInspectionButton}
                                style={{
                                    opacity: (!isVerified || !selectedDecision) ? 0.5 : 1,
                                    cursor: (!isVerified || !selectedDecision) ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {isSubmittingInspection 
                                    ? 'Submitting Inspection...' 
                                    : !isVerified 
                                        ? 'Master Data Verification Required to Submit' 
                                        : !selectedDecision 
                                            ? 'Select PASS or FAIL to Submit' 
                                            : 'Submit Inspection'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div style={{
                        padding: '2.5rem',
                        textAlign: 'center',
                        color: '#64748b',
                        border: '2px dashed #e2e8f0',
                        borderRadius: '8px',
                        backgroundColor: '#f8fafc'
                    }}>
                        <Sparkles size={32} style={{ color: '#94a3b8', marginBottom: '0.5rem' }} />
                        <p style={{ margin: 0, fontWeight: 600, fontSize: '0.95rem' }}>
                            Scan a unit's barcode or enter its Serial Number above to begin Programming Inspection.
                        </p>
                    </div>
                )}
            </div>

            {/* ─── 1. FAILED INSPECTIONS TABLE ─────────────────────────────────── */}
            <div className={styles.card} style={{ borderColor: '#fca5a5' }}>
                <div className={styles.recentHeader} style={{ marginBottom: '0.4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h3 className={styles.recentTitle} style={{ color: '#991b1b', margin: 0, paddingBottom: 0, borderBottom: 'none' }}>
                            Failed Programming Inspections ({failedInspections.length})
                        </h3>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                            type="button"
                            className={styles.exportExcelButton}
                            onClick={() => handleExportFailedExcel()}
                            disabled={isExportingFailed || !activeSession}
                        >
                            {isExportingFailed ? 'Exporting...' : 'Export Failed'}
                        </button>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem', maxWidth: '460px' }}>
                    <input
                        type="text"
                        placeholder="Search failed units..."
                        value={failedSearch}
                        onChange={e => setFailedSearch(e.target.value)}
                        className={styles.input}
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
                                <th>SL NO</th>
                                <th>SERIAL NUMBER</th>
                                <th>BAND S.NO</th>
                                <th>PHYSICAL TPN</th>
                                <th>BAND</th>
                                <th>FAILED AT</th>
                                <th>FAILURE REASON</th>
                                <th>INSPECTED BY</th>
                                <th>ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {failedInspections
                                .filter(f => !failedSearch || (f.band_serial_no || f.serial_number || '').toLowerCase().includes(failedSearch.toLowerCase()) || (f.remarks || '').toLowerCase().includes(failedSearch.toLowerCase()))
                                .slice((failedPage - 1) * failedLimit, failedPage * failedLimit)
                                .map((item, idx) => (
                                    <tr key={item.id || idx}>
                                        <td style={{ textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
                                            {item.sl_no ?? ((failedPage - 1) * failedLimit + idx + 1)}
                                        </td>
                                        <td style={{ fontWeight: 600 }}>{item.serial_number || '—'}</td>
                                        <td style={{ fontWeight: 700, color: '#b91c1c' }}>{item.band_serial_no || '—'}</td>
                                        <td>{item.physical_tpn || '—'}</td>
                                        <td>
                                            <span style={{ backgroundColor: '#fef2f2', color: '#b91c1c', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 700, fontSize: '0.8rem' }}>
                                                {item.band || '—'}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: '0.82rem', color: '#64748b' }}>{formatTimestamp(item.scanned_at)}</td>
                                        <td style={{ color: '#b91c1c', fontWeight: 600 }}>
                                            {item.remarks || 'Programming Verification Failed'}
                                        </td>
                                        <td>{item.scanned_by || 'Operator'}</td>
                                        <td style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                            <button
                                                type="button"
                                                className={styles.secondaryButton}
                                                style={{
                                                    padding: '0.3rem 0.65rem',
                                                    fontSize: '0.78rem',
                                                    backgroundColor: '#dcfce7',
                                                    color: '#166534',
                                                    borderColor: '#86efac',
                                                    fontWeight: 700
                                                }}
                                                onClick={() => handlePassInProgramming(item as any)}
                                                title="Pass unit in Debug and mark completed"
                                            >
                                                Pass in Debug
                                            </button>
                                            <button
                                                type="button"
                                                className={styles.secondaryButton}
                                                style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }}
                                                onClick={() => {
                                                    setDebugModalItem(item as any);
                                                    setDebugModalStatus('DEBUG_PASS');
                                                    setDebugModalRemarks(item.remarks ? `Fixed: ${item.remarks}` : '');
                                                }}
                                                title="Open Debug Action Modal"
                                            >
                                                Debug Action
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            {failedInspections.length === 0 && (
                                <tr>
                                    <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                        No failed inspections in this session.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {failedInspections.length > failedLimit && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', fontSize: '0.85rem', color: '#64748b' }}>
                        <span>Showing {Math.min(failedInspections.length, (failedPage - 1) * failedLimit + 1)} to {Math.min(failedInspections.length, failedPage * failedLimit)} of {failedInspections.length} failed units</span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                                type="button"
                                className={styles.secondaryButton}
                                disabled={failedPage === 1}
                                onClick={() => setFailedPage(prev => Math.max(1, prev - 1))}
                            >
                                Previous
                            </button>
                            <span style={{ padding: '0.35rem 0.5rem' }}>Page {failedPage}</span>
                            <button
                                type="button"
                                className={styles.secondaryButton}
                                disabled={failedPage * failedLimit >= failedInspections.length}
                                onClick={() => setFailedPage(prev => prev + 1)}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ─── 2. DEBUG INSPECTION TABLE ───────────────────────────────────── */}
            <div className={styles.card} style={{ borderLeft: '4px solid #f59e0b' }}>
                <div className={styles.recentHeader} style={{ marginBottom: '0.4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h3 className={styles.recentTitle} style={{ color: '#b45309', margin: 0, paddingBottom: 0, borderBottom: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>Debug & Rectification Table ({debugInspections.length})</span>
                        </h3>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                            type="button"
                            className={styles.exportExcelButton}
                            onClick={() => handleExportDebugExcel()}
                            disabled={isExportingDebug || !activeSession}
                        >
                            {isExportingDebug ? 'Exporting...' : 'Export Debug'}
                        </button>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem', maxWidth: '560px', flexWrap: 'wrap' }}>
                    <select
                        className={styles.select}
                        value={debugStatusFilter}
                        onChange={e => {
                            setDebugStatusFilter(e.target.value);
                            setDebugPage(1);
                        }}
                        style={{ padding: '0.55rem 0.75rem', width: 'auto', fontSize: '0.9rem' }}
                    >
                        <option value="ALL">All Debug Statuses</option>
                        <option value="PENDING">Pending</option>
                        <option value="IN_DEBUG">In Debug</option>
                        <option value="DEBUG_PASS">Debug Pass</option>
                        <option value="REPAIRED">Repaired</option>
                        <option value="SCRAP">Scrap</option>
                    </select>

                    <input
                        type="text"
                        placeholder="Search debug units..."
                        value={debugSearch}
                        onChange={e => {
                            setDebugSearch(e.target.value);
                            setDebugPage(1);
                        }}
                        className={styles.input}
                        style={{ padding: '0.55rem 0.85rem', fontSize: '0.9rem', flex: 1, minWidth: '180px' }}
                    />

                    {debugSearch && (
                        <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={() => {
                                setDebugSearch('');
                                setDebugPage(1);
                            }}
                            style={{ padding: '0.55rem 1rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                        >
                            Clear
                        </button>
                    )}
                </div>

                {isLoadingDebug ? (
                    <div style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>Loading debug table...</div>
                ) : (
                    <div className={styles.tableContainer}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>SL NO</th>
                                    <th>SERIAL NUMBER</th>
                                    <th>BAND S.NO</th>
                                    <th>PHYSICAL TPN</th>
                                    <th>DEFECT / REMARKS</th>
                                    <th>DEBUG STATUS</th>
                                    <th>DEBUG REMARKS</th>
                                    <th>ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody>
                                    {debugInspections
                                        .slice((debugPage - 1) * debugLimit, debugPage * debugLimit)
                                        .map((item, idx) => (
                                            <tr key={item.id || idx}>
                                                <td style={{ textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
                                                    {item.sl_no ?? ((debugPage - 1) * debugLimit + idx + 1)}
                                                </td>
                                                <td style={{ fontWeight: 600 }}>{item.serial_number || '—'}</td>
                                            <td style={{ fontWeight: 700, color: '#4f46e5' }}>{item.band_serial_no || '—'}</td>
                                            <td>{item.physical_tpn || '—'}</td>
                                            <td style={{ color: '#b91c1c', fontWeight: 500 }}>
                                                {item.remarks || 'Programming Defect'}
                                            </td>
                                            <td>
                                                <span style={{
                                                    display: 'inline-block',
                                                    padding: '0.2rem 0.6rem',
                                                    borderRadius: '4px',
                                                    fontSize: '0.78rem',
                                                    fontWeight: 700,
                                                    backgroundColor: item.debug_status === 'DEBUG_PASS' || item.debug_status === 'REPAIRED' ? '#dcfce7' : item.debug_status === 'SCRAP' ? '#fee2e2' : '#fef3c7',
                                                    color: item.debug_status === 'DEBUG_PASS' || item.debug_status === 'REPAIRED' ? '#166534' : item.debug_status === 'SCRAP' ? '#991b1b' : '#92400e',
                                                    border: `1px solid ${item.debug_status === 'DEBUG_PASS' || item.debug_status === 'REPAIRED' ? '#86efac' : item.debug_status === 'SCRAP' ? '#fca5a5' : '#fcd34d'}`
                                                }}>
                                                    {item.debug_status || 'PENDING'}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: '0.85rem' }}>{item.debug_remarks || '—'}</td>
                                            <td style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                <button
                                                    type="button"
                                                    className={styles.secondaryButton}
                                                    style={{
                                                        padding: '0.3rem 0.65rem',
                                                        fontSize: '0.78rem',
                                                        backgroundColor: '#dcfce7',
                                                        color: '#166534',
                                                        borderColor: '#86efac',
                                                        fontWeight: 700
                                                    }}
                                                    onClick={() => handlePassInProgramming(item)}
                                                    title="Pass unit and mark completed in Programming"
                                                >
                                                    Pass in Programming
                                                </button>
                                                <button
                                                    type="button"
                                                    className={styles.secondaryButton}
                                                    style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }}
                                                    onClick={() => {
                                                        setDebugModalItem(item);
                                                        setDebugModalStatus(item.debug_status || 'IN_DEBUG');
                                                        setDebugModalRemarks(item.debug_remarks || '');
                                                    }}
                                                >
                                                    Update Status
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                {debugInspections.length === 0 && (
                                    <tr>
                                        <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                            No units currently in the Debug queue for this session.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ─── 3. RECENT INSPECTIONS TABLE ─────────────────────────────────── */}
            <div className={styles.card}>
                <div className={styles.recentHeader} style={{ marginBottom: '0.4rem' }}>
                    <h3 className={styles.recentTitle}>
                        Recent Inspections ({scannedTotal || scannedLogs.length})
                    </h3>

                    {/* Export Excel button */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                            type="button"
                            className={styles.exportExcelButton}
                            onClick={() => handleExportRecentExcel()}
                            disabled={isExportingScanned || !activeSession}
                        >
                            {isExportingScanned ? 'Exporting...' : 'Export Excel'}
                        </button>
                    </div>
                </div>

                {/* Search Bar directly under Recent Inspections matching screenshot */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem', maxWidth: '460px' }}>
                    <input
                        type="text"
                        className={styles.input}
                        placeholder="Search recent inspections (Serial, TPN, Status, etc.)..."
                        value={scannedSearch}
                        onChange={e => {
                            setScannedSearch(e.target.value);
                            setScannedPage(1);
                        }}
                        style={{ padding: '0.55rem 0.85rem', fontSize: '0.9rem', width: '100%' }}
                    />
                    <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={() => setScannedPage(1)}
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
                                setScannedPage(1);
                            }}
                            style={{ padding: '0.55rem 1rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                        >
                            Clear
                        </button>
                    )}
                </div>

                {isLoadingScannedLogs ? (
                    <div style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>Loading scanned log...</div>
                ) : (
                    <div className={styles.tableContainer}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>SL NO</th>
                                    <th>SERIAL NUMBER</th>
                                    <th>BAND S.NO</th>
                                    <th>PHYSICAL TPN</th>
                                    <th>BAND</th>
                                    <th>E-LEVEL</th>
                                    <th>PAM 1&2 TPN</th>
                                    <th>PAM 3&4 TPN</th>
                                    <th>PAM SWAPPED</th>
                                    <th>DEFECT FIXED</th>
                                    <th>STATUS</th>
                                    <th>INSPECTION DATE</th>
                                    <th>SCANNED BY</th>
                                </tr>
                            </thead>
                            <tbody>
                                {scannedLogs.map((item, idx) => {
                                    const isReinspected = Boolean(item.is_reinspected || item.debug_status === 'DEBUG_PASS' || item.defect_fixed);
                                    const isPass = item.status === 'PASS' || item.status === 'COMPLETED';

                                    return (
                                        <tr key={item.id || idx}>
                                            <td style={{ textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
                                                {item.sl_no ?? ((scannedPage - 1) * scannedLimit + idx + 1)}
                                            </td>
                                            <td style={{ fontWeight: 600 }}>{item.serial_number || '—'}</td>
                                            <td style={{ fontWeight: 700, color: item.status === 'PASS' || item.status === 'COMPLETED' ? '#047857' : '#b91c1c' }}>
                                                {item.band_serial_no || '—'}
                                            </td>
                                            <td>{item.physical_tpn || '—'}</td>
                                            <td>
                                                <span style={{ backgroundColor: '#f1f5f9', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 700, fontSize: '0.8rem' }}>
                                                    {item.band || '—'}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: '0.82rem', fontWeight: 600 }}>{item.e_level || item.new_e_level || '—'}</td>
                                            <td style={{ fontSize: '0.82rem' }}>{item.pam1_2_tpn || item.new_pam1_2 || '—'}</td>
                                            <td style={{ fontSize: '0.82rem' }}>{item.pam3_4_tpn || item.new_pam3_4 || '—'}</td>
                                            <td>
                                                {item.is_pam_changed ? (
                                                    <span style={{
                                                        backgroundColor: '#faf5ff',
                                                        color: '#7e22ce',
                                                        border: '1px solid #d8b4fe',
                                                        padding: '0.15rem 0.5rem',
                                                        borderRadius: '4px',
                                                        fontWeight: 700,
                                                        fontSize: '0.78rem',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }} title={item.pam_change_remarks || item.changed_component || 'PAM Plate Swapped'}>
                                                        {item.changed_component || 'YES'}
                                                    </span>
                                                ) : (
                                                    <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>NO</span>
                                                )}
                                            </td>
                                            <td style={{ maxWidth: '240px', fontSize: '0.85rem' }}>
                                                {item.defect_fixed || (item.is_reinspected ? item.remarks : null) ? (
                                                    <span style={{ 
                                                        color: '#c2410c', 
                                                        fontWeight: 600, 
                                                        backgroundColor: '#fff7ed', 
                                                        padding: '0.2rem 0.55rem', 
                                                        borderRadius: '4px',
                                                        border: '1px solid #fed7aa',
                                                        display: 'inline-block',
                                                        maxWidth: '100%',
                                                        wordBreak: 'break-word'
                                                    }}>
                                                        {item.defect_fixed || item.remarks}
                                                    </span>
                                                ) : (
                                                    <span style={{ color: '#94a3b8' }}>—</span>
                                                )}
                                            </td>
                                            <td>
                                                {isPass ? (
                                                    isReinspected ? (
                                                        <span 
                                                            className={styles.badgeReinspectedPass}
                                                            style={{ 
                                                                backgroundColor: '#ffedd5', 
                                                                color: '#c2410c', 
                                                                border: '1px solid #fdba74',
                                                                fontWeight: 700,
                                                                padding: '0.25rem 0.65rem',
                                                                borderRadius: '1rem',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '4px'
                                                            }}
                                                            title="Passed after Debug / Re-inspection"
                                                        >
                                                            COMPLETED
                                                        </span>
                                                    ) : (
                                                        <span className={styles.badgePass}>
                                                            COMPLETED
                                                        </span>
                                                    )
                                                ) : (
                                                    <span className={styles.badgeFail}>{item.status}</span>
                                                )}
                                            </td>
                                            <td style={{ fontSize: '0.85rem', color: '#64748b' }}>{formatTableDate(item.inspection_date || item.scanned_at)}</td>
                                            <td>{item.scanned_by || 'Operator'}</td>
                                        </tr>
                                    );
                                })}
                                {scannedLogs.length === 0 && (
                                    <tr>
                                        <td colSpan={13} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                            No scanned inspections recorded yet in this session.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ─── 4. REMAINING MASTER DATA TABLE (UNSCANNED IPQC UNITS) ────────── */}
            <div className={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h3 style={{ margin: 0, border: 'none', padding: 0, fontSize: '1.15rem', fontWeight: 700, color: '#1e293b' }}>
                            Remaining Master Data ({remainingTotal} items remaining)
                        </h3>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                            Live session view: Passed units from RRH IPQC recent inspections ready for Programming. Successfully inspected units are deducted immediately.
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.85rem', color: '#64748b' }}>
                            <span>Show</span>
                            <select
                                className={styles.select}
                                value={remainingLimit}
                                onChange={e => {
                                    const newLimit = parseInt(e.target.value);
                                    setRemainingPage(1);
                                    // reload
                                    if (activeSession) {
                                        const remQuery = new URLSearchParams({
                                            page: '1',
                                            limit: String(newLimit),
                                            search: remainingSearch
                                        });
                                        apiFetch(`/api/rrh/ecn/programming/sessions/${activeSession.id}/remaining-master-data?${remQuery.toString()}`)
                                            .then(res => {
                                                setRemainingItems(res?.data || []);
                                                setRemainingTotal(res?.total || 0);
                                            });
                                    }
                                }}
                                style={{ padding: '0.35rem 1.5rem 0.35rem 0.65rem', width: 'auto', fontSize: '0.85rem' }}
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
                            onKeyDown={e => {
                                if (e.key === 'Enter') {
                                    setRemainingPage(1);
                                    if (activeSession) loadActiveSessionDetails(activeSession.id);
                                }
                            }}
                            className={styles.input}
                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', width: '220px' }}
                        />

                        <button
                            type="button"
                            className={styles.button}
                            onClick={() => {
                                setRemainingPage(1);
                                if (activeSession) loadActiveSessionDetails(activeSession.id);
                            }}
                            style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                        >
                            Filter
                        </button>

                        {remainingSearch && (
                            <button
                                type="button"
                                className={styles.secondaryButton}
                                onClick={() => {
                                    setRemainingSearch('');
                                    setRemainingPage(1);
                                }}
                                style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                            >
                                Clear
                            </button>
                        )}

                        <button
                            type="button"
                            className={styles.cyanExportButton}
                            onClick={() => handleExportRemainingExcel()}
                            disabled={isExportingRemaining || !activeSession}
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
                                <th>DUPLEXER SL.NO (IVI)</th>
                                <th>RRH UNIT (IVI)</th>
                                <th>IPQC STATUS</th>
                                <th>TEJAS DC NO</th>
                                <th>LOT</th>
                                <th>REMARKS</th>
                                <th style={{ textAlign: 'center' }}>ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoadingRemaining ? (
                                <tr>
                                    <td colSpan={12} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                                        Loading remaining master data...
                                    </td>
                                </tr>
                            ) : remainingItems.length === 0 ? (
                                <tr>
                                    <td colSpan={12} style={{ textAlign: 'center', padding: '2.5rem', background: '#f0fdf4', color: '#166534', fontWeight: 600 }}>
                                        All passed IPQC units for this Work Order have been inspected in Programming!
                                    </td>
                                </tr>
                            ) : (
                                remainingItems.map((item, idx) => (
                                    <tr key={item.ipqc_id || idx}>
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
                                        <td style={{ fontFamily: 'monospace' }}>{item.duplexer_sno || item.duplexer_sl_no || '—'}</td>
                                        <td style={{ color: item.rrh_unit && item.rrh_unit !== 'no defect' ? '#2563eb' : undefined, fontWeight: item.rrh_unit && item.rrh_unit !== 'no defect' ? 600 : undefined }}>
                                            {cleanDefectDescription(item.rrh_unit) || 'no defect'}
                                        </td>
                                        <td>
                                            <span style={{
                                                backgroundColor: '#dcfce7',
                                                color: '#15803d',
                                                border: '1px solid #86efac',
                                                borderRadius: '4px',
                                                padding: '0.15rem 0.5rem',
                                                fontWeight: 700,
                                                fontSize: '0.75rem',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                PASS
                                            </span>
                                        </td>
                                        <td>{item.tejas_dc_no || '—'}</td>
                                        <td>{item.lot || item.bat_lot_no || '—'}</td>
                                        <td>{item.remarks || '—'}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <button
                                                type="button"
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
                                                onClick={() => handleInspectRemainingUnit(item)}
                                                title="Inspect this unit in Programming"
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
                        Showing {remainingItems.length > 0 ? (remainingPage - 1) * remainingLimit + 1 : 0} to{' '}
                        {Math.min(remainingPage * remainingLimit, remainingTotal)} of {remainingTotal} items
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                            type="button"
                            className={styles.secondaryButton}
                            disabled={remainingPage <= 1}
                            onClick={() => setRemainingPage(prev => Math.max(1, prev - 1))}
                        >
                            Previous
                        </button>
                        <span style={{ padding: '0.35rem 0.5rem' }}>
                            Page {remainingPage} of {Math.ceil(remainingTotal / remainingLimit) || 1}
                        </span>
                        <button
                            type="button"
                            className={styles.secondaryButton}
                            disabled={remainingPage * remainingLimit >= remainingTotal}
                            onClick={() => setRemainingPage(prev => prev + 1)}
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {/* ─── DEBUG UPDATE MODAL ─────────────────────────────────────────── */}
            {debugModalItem && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    backgroundColor: 'rgba(15, 23, 42, 0.65)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    backdropFilter: 'blur(4px)'
                }}>
                    <div style={{
                        background: '#ffffff',
                        borderRadius: '12px',
                        padding: '1.75rem',
                        width: '90%',
                        maxWidth: '520px',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
                    }}>
                        <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b' }}>
                            Update Debug Status: <span style={{ color: '#4f46e5' }}>{debugModalItem.band_serial_no || debugModalItem.serial_number}</span>
                        </h3>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem', color: '#475569' }}>
                                Debug Status *
                            </label>
                            <select
                                value={debugModalStatus}
                                onChange={e => setDebugModalStatus(e.target.value)}
                                className={styles.select}
                            >
                                <option value="PENDING">PENDING</option>
                                <option value="IN_DEBUG">IN_DEBUG</option>
                                <option value="DEBUG_PASS">DEBUG_PASS (Pass in Programming)</option>
                                <option value="REPAIRED">REPAIRED (Pass in Programming)</option>
                                <option value="SCRAP">SCRAP</option>
                            </select>
                        </div>

                        <div style={{ marginBottom: '1.25rem' }}>
                            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem', color: '#475569' }}>
                                Debug Action / Rectification Remarks
                            </label>
                            <textarea
                                value={debugModalRemarks}
                                onChange={e => setDebugModalRemarks(e.target.value)}
                                placeholder="Enter repair or debug actions taken..."
                                className={styles.failRemarksInput}
                                rows={3}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                            <button
                                type="button"
                                className={styles.secondaryButton}
                                onClick={() => setDebugModalItem(null)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className={styles.button}
                                onClick={handleSaveDebugStatus}
                                disabled={isSavingDebugAction}
                            >
                                {isSavingDebugAction ? 'Saving...' : 'Save Status'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── DYNAMIC PAM PLATE SWAP MODAL ───────────────────────── */}
            {swapModalOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    backgroundColor: 'rgba(15, 23, 42, 0.65)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    backdropFilter: 'blur(4px)'
                }}>
                    <div style={{
                        background: '#ffffff',
                        borderRadius: '12px',
                        padding: '1.75rem',
                        width: '90%',
                        maxWidth: '520px',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0, color: '#1e293b' }}>
                                Swap {swapTarget === 'PAM12' ? 'PAM 1&2' : 'PAM 3&4'} Plate
                            </h3>
                        </div>

                        {/* Current Configuration Summary */}
                        <div style={{
                            padding: '0.75rem 1rem',
                            backgroundColor: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            marginBottom: '1.25rem',
                            fontSize: '0.85rem'
                        }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', color: '#475569' }}>
                                <div><strong>Serial:</strong> {loadedUnit?.band_serial_no || loadedUnit?.serial_number || 'N/A'}</div>
                                <div><strong>Current Band:</strong> {loadedUnit?.band || 'N/A'}</div>
                                <div><strong>Current E-Level:</strong> {eLevel || 'N/A'}</div>
                                <div>
                                    <strong>{swapTarget === 'PAM12' ? 'Partner (PAM 3&4):' : 'Partner (PAM 1&2):'}</strong>{' '}
                                    <span style={{ fontFamily: 'monospace', color: '#0f172a' }}>
                                        {swapTarget === 'PAM12' ? (pam34Tpn || 'N/A') : (pam12Tpn || 'N/A')}
                                    </span>
                                </div>
                            </div>
                            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>
                                Entering a replacement PAM plate will check Master Data. If a valid match exists, the E-Level and Frequency Band will automatically re-map.
                            </div>
                        </div>

                        {swapModalError && (
                            <div style={{
                                padding: '0.65rem 0.85rem',
                                backgroundColor: '#fef2f2',
                                border: '1px solid #fecaca',
                                borderRadius: '6px',
                                color: '#991b1b',
                                fontSize: '0.82rem',
                                marginBottom: '1rem'
                            }}>
                                {swapModalError}
                            </div>
                        )}

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem', color: '#334155' }}>
                                Scan / Enter New {swapTarget === 'PAM12' ? 'PAM 1&2' : 'PAM 3&4'} TPN *
                            </label>
                            <input
                                ref={swapInputRef}
                                type="text"
                                value={swapInputTpn}
                                onChange={e => {
                                    setSwapInputTpn(e.target.value.toUpperCase());
                                    if (swapModalError) setSwapModalError(null);
                                }}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleApplyPamSwap();
                                    }
                                }}
                                placeholder="e.g. 611-PCA000145-L"
                                className={styles.input}
                                style={{ width: '100%', fontFamily: 'monospace', fontWeight: 600 }}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                            <button
                                type="button"
                                className={styles.secondaryButton}
                                onClick={() => {
                                    setSwapModalOpen(false);
                                    setSwapModalError(null);
                                    setSwapInputTpn('');
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className={styles.button}
                                onClick={handleApplyPamSwap}
                                disabled={!swapInputTpn.trim()}
                                style={{ backgroundColor: '#2563eb' }}
                            >
                                Apply & Re-Map
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
