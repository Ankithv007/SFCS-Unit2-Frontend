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

// ─── Helper to clean defect text (removes 'Point 1:', 'Point 1 -', 'point2:', etc.) ─────────
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
    lot_number?: string;
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
    lot_number?: string;
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
    duplexer_sl_no?: string;
    rrh_unit: string | null;
    image_urls?: string[];
    status: 'PASS' | 'FAIL' | 'SCRAP';
    remarks: string | null;
    scanned_by: string;
    scanned_at: string;
    checkpoints?: any;
    is_reinspected?: boolean;
    defect_fixed?: string | null;
    route?: string;
    passed_to_next_stage?: boolean;
    passed_to_next_stage_at?: string;
    passed_to_next_stage_by?: string;
}

interface SessionStats {
    lotQuantity: number;
    totalInwarded?: number;
    remainingInward?: number;
    passed: number;
    failed: number;
    scrapped?: number;
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
    previousFailureRemark?: string;
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

    // ─── Process Routing / Stage Selection State (ECN or Non-ECN, single selection) ───
    const [selectedRoute, setSelectedRoute] = useState<'ECN' | 'NON_ECN'>('ECN');

    // ─── Session Setup State ─────────────────────────────────────────────────
    const [eligibleWos, setEligibleWos] = useState<EligibleWorkOrder[]>([]);
    const [selectedWoId, setSelectedWoId] = useState('');
    const [selectedWoDetails, setSelectedWoDetails] = useState<{
        workOrderNumber: string;
        dateTime: string | null;
        lotQuantity: number;
        remainingLotQuantity?: number;
        lotNumber?: string;
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

    // Filter out active or completed work orders from the dropdown
    const availableWorkOrders = useMemo(() => {
        const activeWoIds = new Set(activeSessionsList.map((s: any) => String(s.work_order_id || '').trim().toUpperCase()));
        const completedWoIds = new Set(completedSessionsList.map((s: any) => String(s.work_order_id || '').trim().toUpperCase()));
        return eligibleWos.filter((w: any) => {
            const woId = String(w.work_order_id || '').trim().toUpperCase();
            if (activeWoIds.has(woId)) return false;
            if (completedWoIds.has(woId)) return false;
            return true;
        });
    }, [eligibleWos, activeSessionsList, completedSessionsList]);

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
    const [duplexerSlNo, setDuplexerSlNo] = useState('');
    const [rrhUnit, setRrhUnit] = useState('');
    const [statusVal, setStatusVal] = useState<'PASS' | 'FAIL' | 'SCRAP'>('PASS');
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
        } else {
            const prevRem = checkpoints[activeCpIndex]?.previousFailureRemark;
            if (prevRem && !currentCpRemark) {
                setCurrentCpRemark(prevRem);
            }
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
                    confirmed: true,
                    previousFailureRemark: cp.previousFailureRemark || (currentCpStatus === 'FAIL' ? currentCpRemark.trim() : undefined)
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
            const defectText = failedCps.map(c => c.remark?.trim() ? cleanDefectDescription(c.remark.trim()) : '').filter(Boolean).join('; ');
            setRrhUnit(defectText || 'Defect noted');
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

    // Recent inspections table state & pagination (10 per page)
    const [recentInspections, setRecentInspections] = useState<InspectionRecord[]>([]);
    const [inspectionSearch, setInspectionSearch] = useState('');
    const [recentPage, setRecentPage] = useState(1);
    const recentLimit = 10;
    const [exportingType, setExportingType] = useState<'RECENT' | 'FAILED' | 'SCRAP' | null>(null);
    const [viewingImages, setViewingImages] = useState<{ serial: string; images: string[] } | null>(null);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);

    // Failed inspections table state, search, pagination & details modal
    const [failedSearch, setFailedSearch] = useState('');
    const [failedPage, setFailedPage] = useState(1);
    const failedLimit = 10;
    const [failedModalRecord, setFailedModalRecord] = useState<InspectionRecord | null>(null);
    const [fixedDefectModalRecord, setFixedDefectModalRecord] = useState<InspectionRecord | null>(null);

    // Recent inspections table (strictly status === 'PASS' only, failed units go to Failed Inspections)
    const passedInspections = useMemo(() => {
        return recentInspections.filter(r => r.status === 'PASS');
    }, [recentInspections]);

    // Filter recent inspections by search query
    const filteredRecentInspections = useMemo(() => {
        if (!inspectionSearch.trim()) return passedInspections;
        const q = inspectionSearch.trim().toLowerCase();
        return passedInspections.filter(item => {
            return (
                (item.band_serial_no && item.band_serial_no.toLowerCase().includes(q)) ||
                (item.serial_number && item.serial_number.toLowerCase().includes(q)) ||
                (item.physical_tpn && item.physical_tpn.toLowerCase().includes(q)) ||
                (item.tejas_dc_no && item.tejas_dc_no.toLowerCase().includes(q)) ||
                (item.tejas_obd_no && item.tejas_obd_no.toLowerCase().includes(q)) ||
                (item.band && item.band.toLowerCase().includes(q)) ||
                (item.duplexer_main && item.duplexer_main.toLowerCase().includes(q)) ||
                (item.duplexer_part_no && item.duplexer_part_no.toLowerCase().includes(q)) ||
                (item.duplexer_sl_no && item.duplexer_sl_no.toLowerCase().includes(q)) ||
                (item.rrh_unit && item.rrh_unit.toLowerCase().includes(q)) ||
                (item.defect_fixed && item.defect_fixed.toLowerCase().includes(q)) ||
                (item.status && item.status.toLowerCase().includes(q)) ||
                (item.remarks && item.remarks.toLowerCase().includes(q)) ||
                (item.scanned_by && item.scanned_by.toLowerCase().includes(q))
            );
        });
    }, [passedInspections, inspectionSearch]);

    useEffect(() => {
        setRecentPage(1);
    }, [inspectionSearch]);

    const recentTotalPages = Math.max(1, Math.ceil(filteredRecentInspections.length / recentLimit));
    const paginatedRecentInspections = useMemo(() => {
        const start = (recentPage - 1) * recentLimit;
        return filteredRecentInspections.slice(start, start + recentLimit);
    }, [filteredRecentInspections, recentPage, recentLimit]);

    // Dedicated Failed Inspections list (strictly status === 'FAIL' AND not subsequently passed)
    const failedInspections = useMemo(() => {
        const passedSerials = new Set<string>();
        recentInspections.forEach(r => {
            if (r.status === 'PASS') {
                if (r.serial_number) passedSerials.add(r.serial_number.trim().toUpperCase());
                if (r.band_serial_no) passedSerials.add(r.band_serial_no.trim().toUpperCase());
            }
        });

        const seenFailedSerials = new Set<string>();
        return recentInspections.filter(r => {
            if (r.status !== 'FAIL') return false;
            const sn = (r.serial_number || '').trim().toUpperCase();
            const bsn = (r.band_serial_no || '').trim().toUpperCase();
            if (passedSerials.has(sn) || (bsn && passedSerials.has(bsn))) {
                return false;
            }
            const key = bsn || sn;
            if (key && seenFailedSerials.has(key)) {
                return false;
            }
            if (key) seenFailedSerials.add(key);
            return true;
        });
    }, [recentInspections]);

    useEffect(() => {
        setFailedPage(1);
    }, [failedSearch]);

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
                (item.duplexer_main && item.duplexer_main.toLowerCase().includes(q)) ||
                (item.duplexer_part_no && item.duplexer_part_no.toLowerCase().includes(q)) ||
                (item.duplexer_sl_no && item.duplexer_sl_no.toLowerCase().includes(q)) ||
                (item.rrh_unit && item.rrh_unit.toLowerCase().includes(q)) ||
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

    // Dedicated Scrap Inspections table state, search & pagination
    const [scrapSearch, setScrapSearch] = useState('');
    const [scrapPage, setScrapPage] = useState(1);
    const scrapLimit = 10;

    const scrapInspections = useMemo(() => {
        return recentInspections.filter(r => r.status === 'SCRAP');
    }, [recentInspections]);

    useEffect(() => {
        setScrapPage(1);
    }, [scrapSearch]);

    const filteredScrapInspections = useMemo(() => {
        if (!scrapSearch.trim()) return scrapInspections;
        const q = scrapSearch.trim().toLowerCase();
        return scrapInspections.filter(item => {
            return (
                (item.band_serial_no && item.band_serial_no.toLowerCase().includes(q)) ||
                (item.serial_number && item.serial_number.toLowerCase().includes(q)) ||
                (item.physical_tpn && item.physical_tpn.toLowerCase().includes(q)) ||
                (item.tejas_dc_no && item.tejas_dc_no.toLowerCase().includes(q)) ||
                (item.tejas_obd_no && item.tejas_obd_no.toLowerCase().includes(q)) ||
                (item.band && item.band.toLowerCase().includes(q)) ||
                (item.duplexer_main && item.duplexer_main.toLowerCase().includes(q)) ||
                (item.duplexer_part_no && item.duplexer_part_no.toLowerCase().includes(q)) ||
                (item.duplexer_sl_no && item.duplexer_sl_no.toLowerCase().includes(q)) ||
                (item.remarks && item.remarks.toLowerCase().includes(q)) ||
                (item.scanned_by && item.scanned_by.toLowerCase().includes(q))
            );
        });
    }, [scrapInspections, scrapSearch]);

    const scrapTotalPages = Math.max(1, Math.ceil(filteredScrapInspections.length / scrapLimit));
    const paginatedScrapInspections = useMemo(() => {
        const start = (scrapPage - 1) * scrapLimit;
        return filteredScrapInspections.slice(start, start + scrapLimit);
    }, [filteredScrapInspections, scrapPage, scrapLimit]);

    // Re-inspect a failed unit: loads serial, Duplexer data, restores checkpoints with previous failure remark, and jumps to the failed checkpoint
    const handleReinspectFailedRecord = (row: InspectionRecord) => {
        const serial = row.band_serial_no || row.serial_number;
        setSerialInput(serial);
        handleLookupSerial(serial);
        setDuplexerMain(row.duplexer_main || '');
        setDuplexerPartNo(row.duplexer_part_no || '');
        setDuplexerSlNo(row.duplexer_sl_no || '');
        setRemarksVal(row.remarks || '');

        let savedCps: any[] = [];
        if (row.checkpoints) {
            try {
                savedCps = typeof row.checkpoints === 'string' ? JSON.parse(row.checkpoints) : row.checkpoints;
                if (typeof savedCps === 'string') {
                    savedCps = JSON.parse(savedCps);
                }
            } catch {
                savedCps = [];
            }
        }

        // Build a fallback point map from rrh_unit if checkpoints array is not populated or empty
        const defectText = row.rrh_unit || '';
        const pointDefectMap = new Map<number, string>();
        if (defectText && defectText !== 'no defect') {
            const parts = defectText.split(/[;\n]+/);
            for (const part of parts) {
                const trimmed = part.trim();
                if (!trimmed) continue;
                const pointMatch = trimmed.match(/(?:\[?\s*Point\s*(\d+)\s*\]?)\s*[:\-–]?\s*(.*)/i);
                if (pointMatch) {
                    const pNum = parseInt(pointMatch[1], 10);
                    const pRem = pointMatch[2]?.trim() || trimmed;
                    pointDefectMap.set(pNum, pRem);
                } else {
                    const lower = trimmed.toLowerCase();
                    if (lower.includes('cap')) {
                        pointDefectMap.set(1, trimmed);
                    } else if (lower.includes('port') || lower.includes('connector') || lower.includes('opt') || lower.includes('pwr') || lower.includes('ant')) {
                        pointDefectMap.set(2, trimmed);
                    } else if (lower.includes('screw') && !lower.includes('hardware')) {
                        pointDefectMap.set(3, trimmed);
                    } else if (lower.includes('hardware') || lower.includes('nut') || lower.includes('washer')) {
                        pointDefectMap.set(4, trimmed);
                    } else if (lower.includes('paint') || lower.includes('chassis') || lower.includes('clean') || lower.includes('scratch') || lower.includes('dent') || lower.includes('dust')) {
                        pointDefectMap.set(5, trimmed);
                    } else if (lower.includes('label') || lower.includes('qr') || lower.includes('barcode') || lower.includes('sticker')) {
                        pointDefectMap.set(6, trimmed);
                    }
                }
            }
            if (pointDefectMap.size === 0) {
                const lower = defectText.toLowerCase();
                if (lower.includes('cap')) pointDefectMap.set(1, defectText);
                else if (lower.includes('port') || lower.includes('connector') || lower.includes('opt') || lower.includes('pwr') || lower.includes('ant')) pointDefectMap.set(2, defectText);
                else if (lower.includes('screw') && !lower.includes('hardware')) pointDefectMap.set(3, defectText);
                else if (lower.includes('hardware') || lower.includes('nut')) pointDefectMap.set(4, defectText);
                else if (lower.includes('paint') || lower.includes('chassis') || lower.includes('clean')) pointDefectMap.set(5, defectText);
                else if (lower.includes('label') || lower.includes('qr') || lower.includes('barcode')) pointDefectMap.set(6, defectText);
                else {
                    pointDefectMap.set(1, defectText);
                }
            }
        }

        const newCheckpoints: CheckpointRecord[] = IVI_CHECKPOINTS.map((def) => {
            const match = Array.isArray(savedCps) ? savedCps.find((c: any) => c.id === def.id || c.title === def.title) : null;
            if (match) {
                if (match.status === 'FAIL') {
                    const rem = match.remark || pointDefectMap.get(def.id) || row.rrh_unit || '';
                    return {
                        ...def,
                        status: 'FAIL' as const,
                        remark: rem,
                        confirmed: true,
                        previousFailureRemark: rem
                    };
                } else if (match.status === 'PASS') {
                    return {
                        ...def,
                        status: 'PASS' as const,
                        remark: 'no defect',
                        confirmed: true,
                        previousFailureRemark: match.previousFailureRemark
                    };
                }
            }

            if (pointDefectMap.has(def.id)) {
                const rem = pointDefectMap.get(def.id)!;
                return {
                    ...def,
                    status: 'FAIL' as const,
                    remark: rem,
                    confirmed: true,
                    previousFailureRemark: rem
                };
            }

            return {
                ...def,
                status: 'PASS' as const,
                remark: 'no defect',
                confirmed: true
            };
        });

        setCheckpoints(newCheckpoints);

        // Find the first failed checkpoint
        const firstFailIdx = newCheckpoints.findIndex(c => c.status === 'FAIL');
        const targetIdx = firstFailIdx >= 0 ? firstFailIdx : 0;
        setActiveCpIndex(targetIdx);
        setCurrentCpStatus(newCheckpoints[targetIdx].status);
        setCurrentCpRemark(newCheckpoints[targetIdx].status === 'FAIL' ? newCheckpoints[targetIdx].remark : '');

        // Recalculate RRH unit defect and overall status
        const failedCps = newCheckpoints.filter(c => c.status === 'FAIL');
        if (failedCps.length > 0) {
            const defectText = failedCps.map(c => c.remark?.trim() ? cleanDefectDescription(c.remark.trim()) : '').filter(Boolean).join('; ');
            setRrhUnit(defectText || 'Defect noted');
            setStatusVal('FAIL');
        } else {
            setRrhUnit('no defect');
            setStatusVal('PASS');
        }

        // Close details modal if open
        setFailedModalRecord(null);

        // Scroll smoothly to checkpoints section
        setTimeout(() => {
            const cpSection = document.getElementById('ivi-checkpoints-section');
            if (cpSection) {
                cpSection.scrollIntoView({ behavior: 'smooth' });
            } else {
                window.scrollTo({ top: 380, behavior: 'smooth' });
            }
        }, 120);

        addToast(`Loaded failed serial ${serial}. Navigated to failed Checkpoint ${targetIdx + 1}: ${newCheckpoints[targetIdx].title}.`, 'info');
    };

    // Pass failed inspection unit to next stage (IPQC for ECN, Post Burn-in for Non-ECN)
    const [passingStageId, setPassingStageId] = useState<number | string | null>(null);
    const handlePassToNextStage = async (record: InspectionRecord) => {
        const dest = record.route === 'NON_ECN' ? 'Post Burn-in Test' : 'IPQC';
        if (!window.confirm(`Are you sure you want to pass failed unit "${record.band_serial_no || record.serial_number}" to ${dest}?`)) {
            return;
        }

        setPassingStageId(record.id);
        try {
            await apiFetch(`/api/rrh/ivi/inspections/${record.id}/pass-to-next-stage`, {
                method: 'PATCH'
            });
            addToast(`Unit "${record.band_serial_no || record.serial_number}" passed to ${dest} successfully.`, 'success');
            if (activeSession) {
                fetchSessionData(activeSession.id);
            }
        } catch (err: any) {
            addToast(err.message || 'Failed to pass unit to next stage.', 'error');
        } finally {
            setPassingStageId(null);
        }
    };

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

    // ─── 1. Load Work Orders for Dropdown (Excludes active and completed IVI sessions) ──────
    const fetchEligibleWorkOrders = useCallback(async () => {
        try {
            const response = await apiFetch('/api/rrh/ivi/eligible-work-orders');
            const list: EligibleWorkOrder[] = response?.data || (Array.isArray(response) ? response : []);
            setEligibleWos(list);
        } catch (err: any) {
            console.error('Failed to load eligible RRH work orders:', err);
            try {
                const fb = await apiFetch('/api/rrh/work-orders?limit=all');
                const list: EligibleWorkOrder[] = fb?.data || (Array.isArray(fb) ? fb : []);
                setEligibleWos(list);
            } catch {
                addToast('Failed to load eligible work orders.', 'error');
            }
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
        let lotNum = localWo?.lot_number || (localWo as any)?.lot || null;

        if (localWo && lotQty > 0) {
            setSelectedWoDetails({
                workOrderNumber: woNum,
                dateTime: woDate,
                lotQuantity: lotQty,
                lotNumber: lotNum || '—'
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
                remainingLotQuantity: remQty !== undefined ? remQty : lotQty,
                lotNumber: lotNum || '—'
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
                serialInputRef.current?.focus({ preventScroll: true });
            }, 100);
        }
    }, [activeSession?.id]);

    const wasModalOpen = useRef(false);
    useEffect(() => {
        const isModalOpen = !!failedModalRecord || !!viewingImages;
        if (wasModalOpen.current && !isModalOpen) {
            setTimeout(() => {
                serialInputRef.current?.focus({ preventScroll: true });
            }, 100);
        }
        wasModalOpen.current = isModalOpen;
    }, [failedModalRecord, viewingImages]);

    // ─── 6. Lookup Scanned Serial Number / Barcode Details (From RRH Inward Scanned Logs) ────
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
                // Automatically populate the resolved Band Serial Number
                const resolvedBandSerial = (data.band_serial_no || clean).toUpperCase();
                setSerialInput(resolvedBandSerial);
                setFetchedSerial(data);
                if (data.already_inspected) {
                    addToast(`Warning: Serial "${resolvedBandSerial}" was already inspected in IVI (${data.previous_inspection?.status || 'recorded'}).`, 'warning');
                } else {
                    addToast(`Barcode scanned: Band Serial "${resolvedBandSerial}" retrieved from RRH Inward.`, 'success');
                }
            } else {
                setFetchedSerial(null);
                addToast(data.message || `Barcode / Serial "${clean}" not found in RRH Inward scanned logs.`, 'warning');
            }
        } catch (err: any) {
            setFetchedSerial(null);
            addToast(err.message || `Barcode / Serial "${clean}" not found in RRH Inward scanned logs.`, 'error');
        } finally {
            setIsFetchingSerial(false);
            serialInputRef.current?.focus({ preventScroll: true });
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
        setDuplexerSlNo('');
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
        setTimeout(() => {
            serialInputRef.current?.focus({ preventScroll: true });
        }, 100);
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

        let cleanPartNo = duplexerPartNo.trim();
        let cleanSlNo = duplexerSlNo.trim();
        if (statusVal !== 'SCRAP') {
            if (!duplexerMain.trim()) {
                addToast('Duplexer Make is required.', 'warning');
                return;
            }

            if (!duplexerPartNo.trim()) {
                addToast('Duplexer Part No. is required.', 'warning');
                return;
            }

            if (!duplexerSlNo.trim()) {
                addToast('Duplexer SL.No is required.', 'warning');
                return;
            }

            // Validate: number and alphabets mix
            const hasLetter = /[a-zA-Z]/.test(cleanPartNo);
            const hasNumber = /[0-9]/.test(cleanPartNo);
            if (!hasLetter || !hasNumber) {
                addToast('Duplexer Part No. must contain a mix of numbers and alphabets.', 'error');
                return;
            }
        } else {
            if (!cleanPartNo) cleanPartNo = '—';
            if (!cleanSlNo) cleanSlNo = '—';
        }

        // Checkpoints verification check (only required for PASS and FAIL, bypassed for SCRAP)
        if (statusVal !== 'SCRAP') {
            const allCpConfirmed = checkpoints.every(c => c.confirmed);
            if (!allCpConfirmed) {
                addToast('Please complete and confirm all 6 inspection checkpoints before submitting.', 'warning');
                return;
            }
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
            formData.append('duplexer_make', duplexerMain.trim() || '—');
            formData.append('duplexer_main', duplexerMain.trim() || '—');
            formData.append('duplexer_part_no', cleanPartNo);
            formData.append('duplexer_sl_no', cleanSlNo);
            if (rrhUnit.trim()) {
                formData.append('rrh_unit', rrhUnit.trim());
                formData.append('rrh_unit_defect', rrhUnit.trim());
            }
            formData.append('status', statusVal);
            if (remarksVal.trim()) formData.append('remarks', remarksVal.trim());
            formData.append('checkpoints', JSON.stringify(checkpoints));

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

            // Append route destination
            formData.append('route', selectedRoute);
            formData.append('selected_route', selectedRoute);

            await apiFetch(`/api/rrh/ivi/sessions/${activeSession.id}/inspections`, {
                method: 'POST',
                body: formData
            });

            addToast(statusVal === 'SCRAP' 
                ? `Unit ${serialInput.trim().toUpperCase()} marked as SCRAP successfully and saved in Scrap Inspections.` 
                : `Inspection submitted successfully with status: ${statusVal} (Route: ${selectedRoute === 'ECN' ? 'ECN -> IPQC' : 'Non-ECN'})`, 'success');

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
    const handleExportExcel = async (customSessionId?: string | number, customWoId?: string, statusFilter?: 'PASS' | 'FAIL' | 'SCRAP') => {
        const sId = customSessionId || activeSession?.id;
        const woId = customWoId || activeSession?.work_order_id || 'Unknown';
        if (!sId) return;

        const isFailed = statusFilter === 'FAIL';
        const isScrap = statusFilter === 'SCRAP';
        setExportingType(isFailed ? 'FAILED' : (isScrap ? 'SCRAP' : 'RECENT'));
        try {
            const token = localStorage.getItem('auth_token');
            const queryParams = new URLSearchParams();
            if (statusFilter) queryParams.set('status', statusFilter);
            if (isFailed && failedInspections.length > 0) {
                const ids = failedInspections.map(r => r.id).filter(Boolean);
                if (ids.length > 0) queryParams.set('ids', ids.join(','));
            }
            const queryStr = queryParams.toString() ? `?${queryParams.toString()}` : '';
            const res = await fetch(`/api/rrh/ivi/sessions/${sId}/export${queryStr}`, {
                headers: {
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                }
            });

            if (!res.ok) throw new Error('Failed to export inspections.');

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = isFailed 
                ? `RRH_IVI_Failed_Inspections_${woId}.xlsx` 
                : (isScrap ? `RRH_IVI_Scrap_Inspections_${woId}.xlsx` : `RRH_IVI_Inspections_${woId}.xlsx`);
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            addToast(`${isFailed ? 'Failed' : (isScrap ? 'Scrap' : 'Recent')} inspections Excel downloaded successfully.`, 'success');
        } catch (err: any) {
            addToast(err.message || 'Failed to export Excel.', 'error');
        } finally {
            setExportingType(null);
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
        } else if (s === 'SCRAP') {
            return <span className={styles.badgeScrap}>{status}</span>;
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
                                        <div className={styles.infoItem}>
                                            <span className={styles.infoLabel}>Lot Number / Batch</span>
                                            <span className={styles.infoValue} style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0d9488' }}>
                                                {selectedWoDetails.lotNumber || '—'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
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
                                                <th>Lot Number</th>
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
                                                    <td style={{ fontWeight: 600, color: '#0f766e' }}>{session.lot_number || (session as any).lot || '—'}</td>
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
                                            {activeSessionsList.length === 0 && (
                                                <tr>
                                                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
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
                                                <th>Lot Number</th>
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
                                             <td style={{ fontWeight: 600, color: '#0f766e' }}>{session.lot_number || (session as any).lot || '—'}</td>
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
                                    {completedSessionsList.length === 0 && (
                                        <tr>
                                            <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
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
                                    <span>Lot Number: <strong style={{ color: '#0d9488' }}>{activeSession.lot_number || (activeSession as any).lot || selectedWoDetails?.lotNumber || '—'}</strong></span>
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
                            <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.8rem', color: '#6d28d9', fontWeight: 800 }}>{stats.pending ?? Math.max(0, (stats.lotQuantity || activeSession.lot_quantity || selectedWoDetails?.lotQuantity || 0) - stats.passed - (stats.scrapped || 0))}</h2>
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
                        <div className={styles.card} style={{ margin: 0, padding: '1.25rem', borderLeft: '5px solid #64748b', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>Scrapped</p>
                            <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.8rem', color: '#475569', fontWeight: 800 }}>{stats.scrapped ?? 0}</h2>
                        </div>
                        <div className={styles.card} style={{ margin: 0, padding: '1.25rem', borderLeft: '5px solid #0d9488', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>Yield (%)</p>
                            <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.8rem', color: '#0f766e', fontWeight: 800 }}>{stats.yield}%</h2>
                        </div>
                    </div>

                    {/* ─── MAIN INSPECTION CARD (High-Speed Scanner Feature Matching Inward RRH) ────── */}
                    <div className={styles.card}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '8px' }}>
                            <h3 className={styles.inspectionTitle} style={{ margin: 0 }}>
                                RRH IVI (Initial Visual Inspection)
                            </h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#16a34a', fontWeight: 600 }}>
                                <span className={styles.blinkingDot} style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16a34a', display: 'inline-block' }}></span>
                                Scanner Ready
                            </div>
                        </div>

                        {/* Scanner Form Row (Matches Inward RRH scan feature) */}
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            handleLookupSerial(serialInput);
                        }} className={styles.detailScanForm} style={{ marginBottom: '1.25rem' }}>
                            <div className={styles.detailScanRow}>
                                <input
                                    ref={serialInputRef}
                                    type="text"
                                    className={styles.detailScanInput}
                                    placeholder="Scan Barcode or enter Serial Number to get Band Serial..."
                                    value={serialInput}
                                    onChange={e => {
                                        setSerialInput(e.target.value);
                                        if (fetchedSerial) setFetchedSerial(null);
                                    }}
                                    disabled={isFetchingSerial || isSubmitting}
                                    autoFocus
                                />
                                <button
                                    type="submit"
                                    className={styles.detailScanButton}
                                    disabled={isFetchingSerial || isSubmitting || !serialInput.trim()}
                                >
                                    {isFetchingSerial ? 'Scanning...' : 'Submit Scan'}
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
                                Scan barcode directly using scanner gun or enter manually to retrieve Band Serial and Work Order details automatically.
                            </p>
                        </form>

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
                            <div className={styles.formGrid3Col}>
                                <div className={styles.fieldGroup}>
                                    <label className={styles.fieldLabel}>Duplexer Make {statusVal !== 'SCRAP' ? '*' : '(Optional)'}</label>
                                    <input
                                        type="text"
                                        className={styles.fieldInput}
                                        value={duplexerMain}
                                        onChange={e => setDuplexerMain(e.target.value)}
                                        placeholder="Enter Duplexer Make"
                                        required={statusVal !== 'SCRAP'}
                                    />
                                </div>
                                <div className={styles.fieldGroup}>
                                    <label className={styles.fieldLabel}>Duplexer Part No. {statusVal !== 'SCRAP' ? '*' : '(Optional)'}</label>
                                    <input
                                        type="text"
                                        className={styles.fieldInput}
                                        value={duplexerPartNo}
                                        onChange={e => setDuplexerPartNo(e.target.value)}
                                        placeholder="Enter Duplexer Part No. (mix of letters & numbers)"
                                        required={statusVal !== 'SCRAP'}
                                    />
                                </div>
                                <div className={styles.fieldGroup}>
                                    <label className={styles.fieldLabel}>Duplexer SL.No {statusVal !== 'SCRAP' ? '*' : '(Optional)'}</label>
                                    <input
                                        type="text"
                                        className={styles.fieldInput}
                                        value={duplexerSlNo}
                                        onChange={e => setDuplexerSlNo(e.target.value)}
                                        placeholder="Enter Duplexer SL.No"
                                        required={statusVal !== 'SCRAP'}
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
                                            Compressing images to minimum size...
                                        </div>
                                    )}
                                    {selectedImages.length > 0 && (
                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                                            {selectedImages.map((img, idx) => (
                                                <span key={idx} style={{
                                                    background: '#e2e8f0', color: '#1e293b', fontSize: '0.75rem',
                                                    padding: '0.2rem 0.5rem', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px'
                                                }}>
                                                    {img.name} ({Math.round(img.size / 1024)}KB)
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
                                        onChange={e => setStatusVal(e.target.value as 'PASS' | 'FAIL' | 'SCRAP')}
                                        required
                                    >
                                        <option value="PASS">PASS</option>
                                        <option value="FAIL">FAIL</option>
                                        <option value="SCRAP">SCRAP</option>
                                    </select>
                                    <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem', display: 'block' }}>
                                        {statusVal === 'SCRAP' ? 'Unit will be permanently scrapped and logged in Scrap Inspections.' : 'Automatically updated by inspection checkpoints.'}
                                    </span>
                                </div>
                                <div className={styles.fieldGroup}>
                                    <label className={styles.fieldLabel}>Remarks {statusVal === 'SCRAP' ? '(Scrap Reason)' : ''}</label>
                                    <input
                                        type="text"
                                        className={styles.fieldInput}
                                        value={remarksVal}
                                        onChange={e => setRemarksVal(e.target.value)}
                                        placeholder={statusVal === 'SCRAP' ? "Enter reason for scrap..." : "Enter optional additional remarks..."}
                                    />
                                </div>
                            </div>

                            {/* --- SCRAP BANNER WHEN SCRAP IS SELECTED --- */}
                            {statusVal === 'SCRAP' && (
                                <div style={{
                                    backgroundColor: '#f8fafc',
                                    border: '1.5px dashed #94a3b8',
                                    borderRadius: '0.75rem',
                                    padding: '1.25rem',
                                    marginTop: '1.25rem',
                                    marginBottom: '1.25rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.85rem'
                                }}>
                                    <span style={{ fontSize: '1.75rem' }}>🗑️</span>
                                    <div>
                                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#334155' }}>
                                            Unit Marked as SCRAP
                                        </h4>
                                        <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                                            RRH Process Routing and Visual Inspection Checkpoints are hidden. This unit will be recorded in the dedicated Scrap Inspections table and permanently excluded from further production stages.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* --- PROCESS ROUTING / STAGE SELECTION CARD (HIDDEN WHEN SCRAP) --- */}
                            {statusVal !== 'SCRAP' && (
                                <div style={{
                                    backgroundColor: '#ffffff',
                                    borderRadius: '0.75rem',
                                    border: '1px solid #e2e8f0',
                                    padding: '1.25rem',
                                    marginTop: '1.25rem',
                                    marginBottom: '1.25rem',
                                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                                    boxSizing: 'border-box'
                                }}>
                                    {/* Card Header */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                                        <span style={{ fontSize: '1.2rem' }}>🔀</span>
                                        <div>
                                            <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#1e293b' }}>
                                                RRH Process Routing / Stage Selection
                                            </h4>
                                            <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>
                                                Select the quality check and production stages required for this Work Order. Process steps execute strictly in ascending order.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Stage Pills / Chips (Strictly Single Selection at a time) */}
                                    <div style={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: '0.75rem',
                                        marginTop: '0.75rem',
                                        alignItems: 'center'
                                    }}>
                                        {/* ECN Pill */}
                                        <label
                                            onClick={() => setSelectedRoute('ECN')}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                padding: '0.5rem 0.85rem',
                                                borderRadius: '0.5rem',
                                                fontSize: '0.875rem',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                userSelect: 'none',
                                                transition: 'all 0.15s ease-in-out',
                                                backgroundColor: selectedRoute === 'ECN' ? '#eff6ff' : '#f8fafc',
                                                color: selectedRoute === 'ECN' ? '#1d4ed8' : '#475569',
                                                border: selectedRoute === 'ECN' ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                                                boxShadow: selectedRoute === 'ECN' ? '0 1px 2px rgba(37, 99, 235, 0.12)' : 'none'
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedRoute === 'ECN'}
                                                onChange={() => setSelectedRoute('ECN')}
                                                style={{
                                                    width: '16px',
                                                    height: '16px',
                                                    accentColor: '#2563eb',
                                                    cursor: 'pointer'
                                                }}
                                            />
                                            <span>ECN</span>
                                        </label>

                                        {/* Non-ECN Pill */}
                                        <label
                                            onClick={() => setSelectedRoute('NON_ECN')}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                padding: '0.5rem 0.85rem',
                                                borderRadius: '0.5rem',
                                                fontSize: '0.875rem',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                userSelect: 'none',
                                                transition: 'all 0.15s ease-in-out',
                                                backgroundColor: selectedRoute === 'NON_ECN' ? '#eff6ff' : '#f8fafc',
                                                color: selectedRoute === 'NON_ECN' ? '#1d4ed8' : '#475569',
                                                border: selectedRoute === 'NON_ECN' ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                                                boxShadow: selectedRoute === 'NON_ECN' ? '0 1px 2px rgba(37, 99, 235, 0.12)' : 'none'
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedRoute === 'NON_ECN'}
                                                onChange={() => setSelectedRoute('NON_ECN')}
                                                style={{
                                                    width: '16px',
                                                    height: '16px',
                                                    accentColor: '#2563eb',
                                                    cursor: 'pointer'
                                                }}
                                            />
                                            <span>Non-ECN</span>
                                        </label>
                                    </div>
                                </div>
                            )}

                            {/* Visual Inspection Checkpoints (HIDDEN WHEN SCRAP) */}
                            {statusVal !== 'SCRAP' && (
                                <div id="ivi-checkpoints-section" className={styles.checkpointSection}>
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
                                                    statusIcon = '✓ ';
                                                } else if (cp.status === 'FAIL') {
                                                    statusClass = styles.stepNavPillFail;
                                                    statusIcon = '✕ ';
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
                                                <div className={styles.statusButtons} style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                                                    <button
                                                        type="button"
                                                        className={`${styles.statusBtn} ${currentCpStatus === 'PASS' ? styles.passActive : ''}`}
                                                        onClick={() => handleSelectCpStatus('PASS')}
                                                    >
                                                        Pass
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`${styles.statusBtn} ${currentCpStatus === 'FAIL' ? styles.failActive : ''}`}
                                                        onClick={() => handleSelectCpStatus('FAIL')}
                                                    >
                                                        Fail
                                                    </button>

                                                    {/* When that defect is passed, show what will be the remark just aside the pass/fail checkpoint */}
                                                    {(currentCpStatus === 'PASS' || checkpoints[activeCpIndex]?.status === 'PASS') && checkpoints[activeCpIndex]?.previousFailureRemark && (
                                                        <div style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '8px',
                                                            padding: '0.4rem 0.85rem',
                                                            borderRadius: '6px',
                                                            backgroundColor: '#fef2f2',
                                                            border: '1px solid #fecaca',
                                                            color: '#991b1b',
                                                            fontSize: '0.85rem',
                                                            fontWeight: 600,
                                                            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                                                        }}>
                                                            <span>Previous Defect Remark:</span>
                                                            <span style={{
                                                                fontStyle: 'italic',
                                                                fontWeight: 700,
                                                                color: '#b91c1c',
                                                                textDecoration: currentCpStatus === 'PASS' ? 'line-through' : 'none',
                                                                backgroundColor: '#ffffff',
                                                                padding: '0.15rem 0.4rem',
                                                                borderRadius: '4px',
                                                                border: '1px solid #fee2e2'
                                                            }}>
                                                                "{checkpoints[activeCpIndex]?.previousFailureRemark}"
                                                            </span>
                                                            {currentCpStatus === 'PASS' && (
                                                                <span style={{
                                                                    color: '#15803d',
                                                                    fontWeight: 700,
                                                                    backgroundColor: '#dcfce7',
                                                                    padding: '0.15rem 0.45rem',
                                                                    borderRadius: '4px',
                                                                    marginLeft: '4px'
                                                                }}>
                                                                    Defect Resolved / Passed
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
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
                                                    <span>Checkpoints verified with failure(s). Inspection status set to <strong>FAIL</strong> and defect remarks saved in RRH Unit Defect.</span>
                                                ) : (
                                                    <span>All 6 checkpoints verified and passed! RRH Unit Defect set to <strong>"no defect"</strong> and status set to <strong>PASS</strong>.</span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

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
                                    onClick={() => handleExportExcel(undefined, undefined, 'FAIL')}
                                    disabled={exportingType !== null || failedInspections.length === 0}
                                    title="Export failed inspections to Excel without action column"
                                >
                                    {exportingType === 'FAILED' ? 'Exporting...' : 'Export Excel'}
                                </button>
                            </div>
                        </div>

                        <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#64748b' }}>
                            Dedicated log for failed IVI inspections. Use the <strong>Action</strong> buttons to view stage failure remarks or jump to failed checkpoints to correct and re-inspect.
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
                                        <th>S.No</th>
                                        <th>Band Serial No</th>
                                        <th>Tejas DC No</th>
                                        <th>Tejas OBD No</th>
                                        <th>Physical TPN</th>
                                        <th>Band</th>
                                        <th>Duplexer Make</th>
                                        <th>Duplexer Part No</th>
                                        <th>Duplexer SL.No</th>
                                        <th style={{ minWidth: '180px' }}>Failed Stage Remarks</th>
                                        <th>Status</th>
                                        <th>Process Type</th>
                                        <th>Images</th>
                                        <th>Scanned By</th>
                                        <th>Date & Time</th>
                                        <th style={{ minWidth: '340px', textAlign: 'center', whiteSpace: 'nowrap' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedFailedInspections.map((row) => (
                                        <tr key={`fail-${row.id}`}>
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
                                            <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{row.duplexer_sl_no || '—'}</td>
                                            <td style={{ color: '#b91c1c', fontWeight: 600, maxWidth: '240px' }}>
                                                {cleanDefectDescription(row.rrh_unit) || 'Defect noted'}
                                            </td>
                                            <td>
                                                <span className={styles.badgeFail}>FAIL</span>
                                            </td>
                                            <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                <span style={{
                                                    display: 'inline-block',
                                                    padding: '0.2rem 0.6rem',
                                                    borderRadius: '9999px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700,
                                                    backgroundColor: row.route === 'NON_ECN' ? '#f3e8ff' : '#eff6ff',
                                                    color: row.route === 'NON_ECN' ? '#7e22ce' : '#1d4ed8',
                                                    border: row.route === 'NON_ECN' ? '1px solid #d8b4fe' : '1px solid #bfdbfe',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    {row.route === 'NON_ECN' ? 'Non-ECN' : 'ECN'}
                                                </span>
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
                                                                    backgroundColor: '#fef2f2',
                                                                    color: '#991b1b',
                                                                    borderColor: '#fca5a5',
                                                                    fontWeight: 600
                                                                }}
                                                                onClick={() => {
                                                                    setViewingImages({ serial: row.band_serial_no || row.serial_number, images: imgs });
                                                                    setSelectedImageIndex(0);
                                                                }}
                                                                title="View inspection photos"
                                                            >
                                                                Photos ({imgs.length})
                                                            </button>
                                                        </div>
                                                    );
                                                })()}
                                            </td>
                                            <td>{row.scanned_by || '—'}</td>
                                            <td style={{ fontSize: '0.85rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                                                {formatTimestamp(row.scanned_at)}
                                            </td>
                                            <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                <div style={{ display: 'inline-flex', gap: '8px', justifyContent: 'center', alignItems: 'center', flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
                                                    <button
                                                        type="button"
                                                        className={styles.secondaryButton}
                                                        style={{
                                                            padding: '0.35rem 0.65rem',
                                                            fontSize: '0.8rem',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                            whiteSpace: 'nowrap',
                                                            flexShrink: 0
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
                                                            whiteSpace: 'nowrap',
                                                            flexShrink: 0
                                                        }}
                                                        onClick={() => handleReinspectFailedRecord(row)}
                                                        title="Take to failed checkpoint to re-inspect and correct"
                                                    >
                                                        Re-inspect / Fix
                                                    </button>
                                                    {row.passed_to_next_stage ? (
                                                        <span style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            gap: '4px',
                                                            padding: '0.35rem 0.75rem',
                                                            borderRadius: '6px',
                                                            fontSize: '0.8rem',
                                                            fontWeight: 700,
                                                            backgroundColor: '#eff6ff',
                                                            color: '#1d4ed8',
                                                            border: '1px solid #bfdbfe',
                                                            whiteSpace: 'nowrap',
                                                            flexShrink: 0
                                                        }} title={`Passed to ${row.route === 'NON_ECN' ? 'Post Burn-in' : 'IPQC'} by ${row.passed_to_next_stage_by || 'Operator'}`}>
                                                            ✓ Passed to {row.route === 'NON_ECN' ? 'Post Burn-in' : 'IPQC'}
                                                        </span>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            className={styles.secondaryButton}
                                                            style={{
                                                                padding: '0.35rem 0.75rem',
                                                                fontSize: '0.8rem',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                gap: '4px',
                                                                backgroundColor: '#eff6ff',
                                                                color: '#1d4ed8',
                                                                borderColor: '#93c5fd',
                                                                fontWeight: 600,
                                                                whiteSpace: 'nowrap',
                                                                flexShrink: 0
                                                            }}
                                                            onClick={() => handlePassToNextStage(row)}
                                                            disabled={passingStageId === row.id}
                                                            title={`Pass this failed unit to ${row.route === 'NON_ECN' ? 'Post Burn-in Test' : 'IPQC'}`}
                                                        >
                                                            {passingStageId === row.id ? 'Passing...' : `Pass to Next Stage`}
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredFailedInspections.length === 0 && (
                                        <tr>
                                            <td colSpan={15} style={{ textAlign: 'center', padding: '1.75rem', color: '#16a34a', fontWeight: 600 }}>
                                                {failedSearch ? 'No matching failed inspections found for this search.' : 'No failed inspections recorded in this session.'}
                                            </td>
                                        </tr>
                                    )}
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

                    {/* ─── SCRAP INSPECTIONS TABLE CARD (ONLY SCRAP STATUS) ─────────────── */}
                    <div className={styles.card} style={{ borderColor: '#cbd5e1' }}>
                        <div className={styles.recentHeader} style={{ marginBottom: '0.4rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <h3 className={styles.recentTitle} style={{ color: '#475569', margin: 0, paddingBottom: 0, borderBottom: 'none' }}>
                                    Scrap Inspections
                                </h3>
                                <span style={{
                                    backgroundColor: '#f1f5f9',
                                    color: '#475569',
                                    border: '1px solid #cbd5e1',
                                    padding: '0.2rem 0.65rem',
                                    borderRadius: '9999px',
                                    fontSize: '0.8rem',
                                    fontWeight: 700
                                }}>
                                    {scrapInspections.length} Scrapped {scrapInspections.length === 1 ? 'Unit' : 'Units'}
                                </span>
                            </div>

                            {/* Export Excel button for Scrap Inspections */}
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <button
                                    type="button"
                                    className={styles.secondaryButton}
                                    style={{
                                        backgroundColor: '#f8fafc',
                                        color: '#475569',
                                        borderColor: '#cbd5e1',
                                        fontWeight: 600,
                                        fontSize: '0.85rem',
                                        padding: '0.45rem 1rem'
                                    }}
                                    onClick={() => handleExportExcel(undefined, undefined, 'SCRAP')}
                                    disabled={exportingType !== null || scrapInspections.length === 0}
                                    title="Export scrapped inspections to Excel"
                                >
                                    {exportingType === 'SCRAP' ? 'Exporting...' : 'Export Excel'}
                                </button>
                            </div>
                        </div>

                        <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#64748b' }}>
                            Dedicated log for units marked as <strong>SCRAP</strong> during IVI. These serials are permanently recorded with their scrap reasons and barred from downstream production stages.
                        </p>

                        {/* Search Bar for Scrap Inspections */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem', maxWidth: '460px' }}>
                            <input
                                type="text"
                                className={styles.input}
                                placeholder="Search scrap inspections (Serial, TPN, Remarks, etc.)..."
                                value={scrapSearch}
                                onChange={e => setScrapSearch(e.target.value)}
                                style={{ padding: '0.55rem 0.85rem', fontSize: '0.9rem', width: '100%' }}
                            />
                            {scrapSearch && (
                                <button
                                    type="button"
                                    className={styles.secondaryButton}
                                    onClick={() => setScrapSearch('')}
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
                                        <th style={{ width: '80px', textAlign: 'center' }}>S.No</th>
                                        <th style={{ minWidth: '180px' }}>Band S.No</th>
                                        <th style={{ minWidth: '160px' }}>TPN</th>
                                        <th style={{ minWidth: '240px' }}>Remark</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedScrapInspections.map((row) => (
                                        <tr key={`scrap-${row.id}`}>
                                            <td style={{ fontWeight: 600, color: '#64748b', textAlign: 'center' }}>{row.sl_no || '-'}</td>
                                            <td style={{ fontWeight: 700, color: '#1e293b', fontFamily: 'monospace' }}>{row.band_serial_no || row.serial_number}</td>
                                            <td style={{ fontFamily: 'monospace' }}>{row.physical_tpn || '—'}</td>
                                            <td style={{ color: '#475569', fontWeight: 600 }}>
                                                {row.remarks || 'Scrapped unit'}
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredScrapInspections.length === 0 && (
                                        <tr>
                                            <td colSpan={4} style={{ textAlign: 'center', padding: '1.75rem', color: '#94a3b8' }}>
                                                {scrapSearch ? 'No matching scrap inspections found for this search.' : 'No scrap inspections recorded in this session.'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Scrap Table Pagination */}
                        {filteredScrapInspections.length > scrapLimit && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                    Showing {(scrapPage - 1) * scrapLimit + 1} to {Math.min(scrapPage * scrapLimit, filteredScrapInspections.length)} of {filteredScrapInspections.length} scrap entries
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <button
                                        type="button"
                                        className={styles.secondaryButton}
                                        onClick={() => setScrapPage(p => Math.max(1, p - 1))}
                                        disabled={scrapPage <= 1}
                                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem', opacity: scrapPage <= 1 ? 0.5 : 1, cursor: scrapPage <= 1 ? 'not-allowed' : 'pointer' }}
                                    >
                                        Previous
                                    </button>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                                        Page {scrapPage} of {scrapTotalPages}
                                    </span>
                                    <button
                                        type="button"
                                        className={styles.secondaryButton}
                                        onClick={() => setScrapPage(p => Math.min(scrapTotalPages, p + 1))}
                                        disabled={scrapPage >= scrapTotalPages}
                                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem', opacity: scrapPage >= scrapTotalPages ? 0.5 : 1, cursor: scrapPage >= scrapTotalPages ? 'not-allowed' : 'pointer' }}
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
                                Recent Inspections ({filteredRecentInspections.length}{filteredRecentInspections.length !== passedInspections.length ? ` of ${passedInspections.length}` : ''})
                            </h3>

                            {/* Export Excel button */}
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <button
                                    type="button"
                                    className={styles.exportExcelButton}
                                    onClick={() => handleExportExcel(undefined, undefined, 'PASS')}
                                    disabled={exportingType !== null || passedInspections.length === 0}
                                >
                                    {exportingType === 'RECENT' ? 'Exporting...' : 'Export Excel'}
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
                                        <th>Duplexer SL.No</th>
                                        <th>RRH Unit Defect</th>
                                        <th>Defect Fixed</th>
                                        <th>Status</th>
                                        <th>Process Type</th>
                                        <th>Images</th>
                                        <th>Remarks</th>
                                        <th>Scanned By</th>
                                        <th>Date & Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedRecentInspections.map((row) => (
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
                                            <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{row.duplexer_sl_no || '—'}</td>
                                            <td>{row.rrh_unit || '—'}</td>
                                            <td style={{ textAlign: 'center' }}>
                                                {row.is_reinspected ? (
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
                                                    <span style={{ color: '#94a3b8' }}>-</span>
                                                )}
                                            </td>
                                            <td>
                                                {row.status === 'PASS' ? (
                                                    row.is_reinspected ? (
                                                        <span className={styles.badgeReinspectedPass} title="Passed after re-inspection/fix">PASS</span>
                                                    ) : (
                                                        <span className={styles.badgePass}>PASS</span>
                                                    )
                                                ) : (
                                                    <span className={styles.badgeFail}>FAIL</span>
                                                )}
                                            </td>
                                            <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                <span style={{
                                                    display: 'inline-block',
                                                    padding: '0.2rem 0.6rem',
                                                    borderRadius: '9999px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700,
                                                    backgroundColor: row.route === 'NON_ECN' ? '#f3e8ff' : '#eff6ff',
                                                    color: row.route === 'NON_ECN' ? '#7e22ce' : '#1d4ed8',
                                                    border: row.route === 'NON_ECN' ? '1px solid #d8b4fe' : '1px solid #bfdbfe',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    {row.route === 'NON_ECN' ? 'Non-ECN' : 'ECN'}
                                                </span>
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
                                                                View ({imgs.length})

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
                                                                Download
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
                                            <td colSpan={16} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                                {inspectionSearch ? 'No matching inspections found for this search.' : 'No passed inspections recorded yet in this IVI session.'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Recent Inspections Pagination (10 entries per page) */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                Showing {filteredRecentInspections.length === 0 ? 0 : (recentPage - 1) * recentLimit + 1} to {Math.min(recentPage * recentLimit, filteredRecentInspections.length)} of {filteredRecentInspections.length} entries
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button
                                    type="button"
                                    className={styles.secondaryButton}
                                    onClick={() => setRecentPage(p => Math.max(1, p - 1))}
                                    disabled={recentPage <= 1}
                                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem', opacity: recentPage <= 1 ? 0.5 : 1, cursor: recentPage <= 1 ? 'not-allowed' : 'pointer' }}
                                >
                                    Previous
                                </button>
                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                                    Page {recentPage} of {recentTotalPages}
                                </span>
                                <button
                                    type="button"
                                    className={styles.secondaryButton}
                                    onClick={() => setRecentPage(p => Math.min(recentTotalPages, p + 1))}
                                    disabled={recentPage >= recentTotalPages}
                                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem', opacity: recentPage >= recentTotalPages ? 0.5 : 1, cursor: recentPage >= recentTotalPages ? 'not-allowed' : 'pointer' }}
                                >
                                    Next
                                </button>
                            </div>
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
                                All inwarded units for this Work Order have been inspected for this session!
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
                                    Download Photo
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
                                        Download All ({viewingImages.images.length})
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── MODAL: FAILED INSPECTION DETAILS & STAGE REMARKS ──────────── */}
            {failedModalRecord && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
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
                                    {failedModalRecord.rrh_unit || 'No specific defect remark provided.'}
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
                                    if (fails.length === 0) return null;
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
                                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>BAT Lot No</span>
                                        <span style={{ fontSize: '0.95rem' }}>{failedModalRecord.bat_lot_no || '—'}</span>
                                    </div>
                                    <div>
                                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Duplexer Make</span>
                                        <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>{failedModalRecord.duplexer_main}</span>
                                    </div>
                                    <div>
                                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Duplexer Part No</span>
                                        <span style={{ fontSize: '0.95rem', fontFamily: 'monospace', fontWeight: 600 }}>{failedModalRecord.duplexer_part_no}</span>
                                    </div>
                                    <div>
                                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Duplexer SL.No</span>
                                        <span style={{ fontSize: '0.95rem', fontFamily: 'monospace', fontWeight: 600 }}>{failedModalRecord.duplexer_sl_no || '—'}</span>
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

                            {/* Inspection Photos (if attached) */}
                            {(() => {
                                const imgs = parseImages(failedModalRecord.image_urls);
                                if (imgs.length === 0) return null;
                                return (
                                    <div>
                                        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>
                                            Defect Photos ({imgs.length})
                                        </h4>
                                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                            {imgs.map((img, i) => (
                                                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                                                    <img
                                                        src={img}
                                                        alt={`Defect photo ${i + 1}`}
                                                        style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1', cursor: 'pointer' }}
                                                        onClick={() => {
                                                            setViewingImages({ serial: failedModalRecord.band_serial_no || failedModalRecord.serial_number, images: imgs });
                                                            setSelectedImageIndex(i);
                                                        }}
                                                    />
                                                    <button
                                                        type="button"
                                                        className={styles.secondaryButton}
                                                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                                                        onClick={() => handleDownloadImage(img, `IVI_${failedModalRecord.band_serial_no || failedModalRecord.serial_number}_photo_${i + 1}.jpg`)}
                                                    >
                                                        Download
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}
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
                                    // Extract checkpoint remarks if available
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

                                    // Fallback to defect_fixed text or rrh_unit
                                    const defectText = fixedDefectModalRecord.defect_fixed || fixedDefectModalRecord.rrh_unit || fixedDefectModalRecord.remarks;
                                    if (defectText && defectText !== 'no defect') {
                                        return (
                                            <div style={{
                                                backgroundColor: '#fff7ed',
                                                border: '1px solid #fed7aa',
                                                borderRadius: '6px',
                                                padding: '0.85rem 1rem',
                                                fontSize: '0.9rem',
                                                color: '#9a3412',
                                                lineHeight: 1.5
                                            }}>
                                                {defectText}
                                            </div>
                                        );
                                    }

                                    return (
                                        <div style={{ color: '#64748b', fontStyle: 'italic', fontSize: '0.88rem' }}>
                                            No specific defect remark recorded.
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* S.No info */}
                            <div style={{
                                backgroundColor: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                padding: '1rem',
                                display: 'grid',
                                gridTemplateColumns: 'repeat(2, 1fr)',
                                gap: '0.75rem',
                                fontSize: '0.85rem'
                            }}>
                                <div>
                                    <span style={{ display: 'block', color: '#64748b', fontWeight: 600, fontSize: '0.75rem' }}>Work Order</span>
                                    <span style={{ fontWeight: 600, color: '#1e293b' }}>{fixedDefectModalRecord.work_order_id}</span>
                                </div>
                                <div>
                                    <span style={{ display: 'block', color: '#64748b', fontWeight: 600, fontSize: '0.75rem' }}>Band</span>
                                    <span style={{ fontWeight: 700, color: '#2563eb' }}>{fixedDefectModalRecord.band || getBandFromTpn(fixedDefectModalRecord.physical_tpn)}</span>
                                </div>
                                <div>
                                    <span style={{ display: 'block', color: '#64748b', fontWeight: 600, fontSize: '0.75rem' }}>Physical TPN</span>
                                    <span style={{ fontFamily: 'monospace' }}>{fixedDefectModalRecord.physical_tpn || '—'}</span>
                                </div>
                                <div>
                                    <span style={{ display: 'block', color: '#64748b', fontWeight: 600, fontSize: '0.75rem' }}>Passed Date & Time</span>
                                    <span style={{ color: '#64748b' }}>{formatTimestamp(fixedDefectModalRecord.scanned_at)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div style={{
                            padding: '0.85rem 1.5rem',
                            borderTop: '1px solid #e2e8f0',
                            backgroundColor: '#f8fafc',
                            display: 'flex',
                            justifyContent: 'flex-end'
                        }}>
                            <button
                                type="button"
                                className={styles.secondaryButton}
                                onClick={() => setFixedDefectModalRecord(null)}
                                style={{ padding: '0.5rem 1.25rem' }}
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
