import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../components/Toast';
import styles from './QCInspection.module.css';
import { CompletedInspectionsTable } from './CompletedInspectionsTable';
import { ShiftManagement } from './ShiftManagement';

interface ChecklistHistory {
    status: 'PASS' | 'FAIL' | 'REJECTED';
    remark: string;
    timestamp: string;
    attempt: number;
}

interface ChecklistItem {
    id: number;
    text: string;
    level: 'FIRST_LEVEL' | 'FINAL_LEVEL';
    status: 'PASS' | 'FAIL' | 'REJECTED' | null;
    remarks: string;
    temp_remark: string;
    rework_count: number;
    is_confirmed: boolean;
    history: ChecklistHistory[];
}

const INITIAL_CHECKLIST: ChecklistItem[] = [
    { id: 1, text: "Check the Solderability of the C441 & C442 (No Solderability issues, solder splashes issue & solder balls issues near C441 & C442)", level: 'FIRST_LEVEL', status: null, remarks: '', temp_remark: '', rework_count: 0, is_confirmed: false, history: [] },
    { id: 2, text: "Check the Bullet 8no's Presence & Damage", level: 'FIRST_LEVEL', status: null, remarks: '', temp_remark: '', rework_count: 0, is_confirmed: false, history: [] },
    { id: 3, text: "Check and scan the Unit Slno, PAM Slno with RAN Bar code (Week code)", level: 'FIRST_LEVEL', status: null, remarks: '', temp_remark: '', rework_count: 0, is_confirmed: false, history: [] },
    { id: 4, text: "Ensure all Labels and Stickers are free from Damage, Misalignment, Print cut, Barcode erased", level: 'FIRST_LEVEL', status: null, remarks: '', temp_remark: '', rework_count: 0, is_confirmed: false, history: [] },
    { id: 5, text: "Check Enclosure / PAM Gasket Orientation as per WI and no Damage / Missing", level: 'FIRST_LEVEL', status: null, remarks: '', temp_remark: '', rework_count: 0, is_confirmed: false, history: [] },
    { id: 6, text: "PAM Shield with 8 (Screw) × 4 PAM Shield – No Damage", level: 'FIRST_LEVEL', status: null, remarks: '', temp_remark: '', rework_count: 0, is_confirmed: false, history: [] },
    { id: 7, text: "Check J39 Connectors Orientation are properly connected, no Misalignment / Missing / Damage", level: 'FIRST_LEVEL', status: null, remarks: '', temp_remark: '', rework_count: 0, is_confirmed: false, history: [] },
    { id: 8, text: "Check the Unit Level Screw (14 no's)", level: 'FINAL_LEVEL', status: null, remarks: '', temp_remark: '', rework_count: 0, is_confirmed: false, history: [] },
    { id: 9, text: "Check the RAN Number Located in Enclosure (RAN-000222)", level: 'FINAL_LEVEL', status: null, remarks: '', temp_remark: '', rework_count: 0, is_confirmed: false, history: [] }
];

export const QCInspection: React.FC = () => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [currentTime, setCurrentTime] = useState(new Date());

    // Form State
    const [inspectorName, setInspectorName] = useState('');
    const [shift, setShift] = useState('');
    const [unitTpn, setUnitTpn] = useState('');
    const [unitPn, setUnitPn] = useState('');
    const [unitSerial, setUnitSerial] = useState('');
    const [pamTpn, setPamTpn] = useState('611-PCA000146-L');
    const [pam1, setPam1] = useState('');
    const [pam2, setPam2] = useState('');
    const [pam3, setPam3] = useState('');
    const [pam4, setPam4] = useState('');
    const [ranBarcode, setRanBarcode] = useState('');
    const [band, setBand] = useState('');

    const [checklist, setChecklist] = useState<ChecklistItem[]>(INITIAL_CHECKLIST);
    const [finalStatus, setFinalStatus] = useState<'PASS' | 'FAIL' | 'WAITING_FOR_REWORK' | 'REJECTED' | null>(null);

    // De-Assembly State
    const [deAssemblyStatus, setDeAssemblyStatus] = useState<'PASS' | 'FAIL' | 'REJECTED' | null>(null);
    const [reworkCount, setReworkCount] = useState<0 | 1 | 2>(0);
    const [combinedRemarks, setCombinedRemarks] = useState('');
    const [currentDeAssemblyRemark, setCurrentDeAssemblyRemark] = useState('');
    const [isDeAssemblyConfirmed, setIsDeAssemblyConfirmed] = useState(false);

    // Data from API
    const [shifts, setShifts] = useState<{ name: string, start_time: string, end_time: string }[]>([]);
    const [unitTpns, setUnitTpns] = useState<string[]>([]);
    const [unitPns, setUnitPns] = useState<string[]>([]);

    const [isShiftManagementOpen, setIsShiftManagementOpen] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const isManager = ['admin', 'super admin', 'superadmin', 'manager'].includes((user?.role || '').toLowerCase().trim());

    const fetchFormData = useCallback(async () => {
        try {
            const data = await apiFetch('/api/qc/form-data');
            setShifts(data.shifts);
            setUnitTpns(data.unitTpns);
            setUnitPns(data.unitPns);
        } catch (error) {
            console.error('Error fetching form data:', error);
            showToast('Failed to load form data: ' + String(error), 'error');
        }
    }, [showToast]);

    useEffect(() => {
        console.log('QCInspection mounted. User:', user);
        console.log('Is Manager:', isManager);
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchFormData();
        return () => clearInterval(timer);
    }, [user, isManager, fetchFormData]);

    // Auto-select shift based on time if user is not manager
    useEffect(() => {
        if (shifts.length > 0) {
            const now = new Date();
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();
            const currentTimeVal = currentHour * 60 + currentMinute;

            // Find matching shift
            const matchingShift = shifts.find(s => {
                const [startH, startM] = s.start_time.split(':').map(Number);
                const [endH, endM] = s.end_time.split(':').map(Number);

                const startVal = startH * 60 + startM;
                const endVal = endH * 60 + endM;

                if (endVal < startVal) { // Crosses midnight (e.g. 20:00 to 04:00)
                    return currentTimeVal >= startVal || currentTimeVal < endVal;
                } else {
                    return currentTimeVal >= startVal && currentTimeVal < endVal;
                }
            });

            // Auto-select shift if not already set
            if (!shift && matchingShift) {
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setShift(matchingShift.name);
            }
        }
    }, [shifts, shift]);

    /**
     * Handles the initial selection of a checklist item's status.
     * Implements a toggle behavior: if the same status is clicked again, it resets to null.
     */
    const handleChecklistUpdate = (id: number, status: 'PASS' | 'FAIL' | 'REJECTED') => {
        setChecklist(prev => prev.map(item => {
            if (item.id === id) {
                // Toggle Logic: If clicking the same status, reset to null
                // UNLESS it was already confirmed as FAIL/REJECTED, then we allow changing it
                if (item.status === status && !item.is_confirmed) {
                    return { ...item, status: null };
                }
                // Allow changing status if not confirmed OR if confirmed as FAIL/REJECTED
                if (!item.is_confirmed || item.status === 'FAIL' || item.status === 'REJECTED') {
                    return { ...item, status, is_confirmed: false }; // Reset confirmation when changing status
                }
            }
            return item;
        }));
    };

    /**
     * Finalizes the status of a checklist item.
     * This is called when the user clicks the "Confirm" button.
     * It handles:
     * 1. Recording the history of the attempt.
     * 2. Incrementing the rework count if it's a failure.
     * 3. Transitioning to 'REJECTED' if the maximum rework attempts (2) are reached.
     * 4. Updating the overall final status of the inspection.
     */
    const handleChecklistConfirm = (id: number) => {
        setChecklist(prev => {
            const newChecklist = prev.map(item => {
                if (item.id === id) {
                    const now = new Date().toISOString();
                    const label = item.rework_count === 0 ? 'Initial' : `Rework ${item.rework_count}`;

                    if (item.status === 'PASS') {
                        return {
                            ...item,
                            is_confirmed: true,
                            history: [...item.history, { status: 'PASS' as const, remark: '', timestamp: now, attempt: item.rework_count }]
                        };
                    }

                    if (item.status === 'FAIL') {
                        if (!item.temp_remark.trim()) {
                            showToast('Remark is mandatory for failure', 'error');
                            return item;
                        }

                        const newRemarks = item.remarks + (item.remarks ? '\n' : '') + `${label} Fail: ${item.temp_remark.trim()}`;
                        const newHistory = [...item.history, { status: 'FAIL' as const, remark: item.temp_remark.trim(), timestamp: now, attempt: item.rework_count }];

                        if (item.rework_count < 2) {
                            return {
                                ...item,
                                status: 'FAIL' as const,
                                is_confirmed: true,
                                remarks: newRemarks,
                                temp_remark: '',
                                rework_count: item.rework_count + 1,
                                history: newHistory
                            };
                        } else {
                            return {
                                ...item,
                                status: 'REJECTED' as const,
                                is_confirmed: true,
                                remarks: newRemarks,
                                temp_remark: '',
                                history: newHistory
                            };
                        }
                    }

                    if (item.status === 'REJECTED') {
                        if (!item.temp_remark.trim()) {
                            showToast('Remark is mandatory for rejection', 'error');
                            return item;
                        }
                        const newRemarks = item.remarks + (item.remarks ? '\n' : '') + `${label} Reject: ${item.temp_remark.trim()}`;
                        return {
                            ...item,
                            status: 'REJECTED' as const,
                            is_confirmed: true,
                            remarks: newRemarks,
                            temp_remark: '',
                            history: [...item.history, { status: 'REJECTED' as const, remark: item.temp_remark.trim(), timestamp: now, attempt: item.rework_count }]
                        };
                    }
                }
                return item;
            });

            // Update final status based on checklist state
            if (newChecklist.some(item => item.status === 'REJECTED' && item.is_confirmed)) {
                setFinalStatus('REJECTED');
            } else {
                const allPassed = newChecklist.every(item => item.status === 'PASS' && item.is_confirmed);
                if (allPassed) {
                    setFinalStatus('PASS');
                } else if (newChecklist.some(item => item.status === 'FAIL' && item.is_confirmed)) {
                    setFinalStatus('WAITING_FOR_REWORK');
                } else if (newChecklist.some(item => item.rework_count > 0)) {
                    setFinalStatus('WAITING_FOR_REWORK');
                } else {
                    setFinalStatus(null);
                }
            }

            return newChecklist;
        });
    };

    /**
     * Updates the final status of the entire inspection.
     * This is the status that will be submitted to the backend.
     * It also implements toggle behavior for the final status buttons.
     */
    const handleFinalStatusUpdate = (status: 'PASS' | 'FAIL' | 'WAITING_FOR_REWORK') => {
        // Prevent setting PASS if any checklist item has failed or is rejected, or if De-Assembly failed
        const hasChecklistFailures = checklist.some(item => item.status === 'FAIL' || item.status === 'REJECTED');
        const hasDeAssemblyFailure = deAssemblyStatus === 'FAIL' || deAssemblyStatus === 'REJECTED';

        if (status === 'PASS' && (hasChecklistFailures || hasDeAssemblyFailure)) {
            const reason = hasDeAssemblyFailure ? 'De-Assembly failure' : 'checklist failures';
            showToast(`Cannot set PASS while there are ${reason}`, 'error');
            return;
        }
        setFinalStatus(prev => prev === status ? null : status);
    };

    const validateRanBarcode = (code: string) => {
        const regex = /^RAN-\d{6}_BO_\d{4}$/;
        return regex.test(code);
    };

    const handleScanTpn = async () => {
        let value = unitTpn.trim();
        if (!value) return showToast('Please enter a TPN', 'error');

        // Prefix Handling
        if (value.startsWith('TPN:')) {
            value = value.replace('TPN:', '').trim();
            setUnitTpn(value); // Update input with clean value
        }

        // Regex Validation
        const tpnRegex = /^\d+-SKU\d+-[A-Z]$/;
        if (!tpnRegex.test(value)) {
            return showToast('Invalid TPN format. Expected: 611-SKU000176-P', 'error');
        }

        try {
            const data = await apiFetch('/api/qc/tpn', {
                method: 'POST',
                body: JSON.stringify({ value })
            });
            if (data.created) {
                setUnitTpns(prev => [...prev, data.value].sort());
                showToast('TPN added to list', 'success');
            } else {
                showToast('Value already exists', 'info');
            }
        } catch (error) {
            console.error('Error scanning TPN:', error);
            showToast('Failed to scan TPN', 'error');
        }
    };

    const handleScanPn = async () => {
        let value = unitPn.trim();
        if (!value) return showToast('Please enter a PN', 'error');

        // Prefix Handling
        if (value.startsWith('SN:')) {
            value = value.replace('SN:', '').trim();
            setUnitPn(value); // Update input with clean value
        }

        // Regex Validation
        const pnRegex = /^\d+-PCA\d+-[A-Z]$/;
        if (!pnRegex.test(value)) {
            return showToast('Invalid PN format. Expected: 611-PCA000211-E', 'error');
        }

        try {
            const data = await apiFetch('/api/qc/pn', {
                method: 'POST',
                body: JSON.stringify({ value })
            });
            if (data.created) {
                setUnitPns(prev => [...prev, data.value].sort());
                showToast('PN added to list', 'success');
            } else {
                showToast('Value already exists', 'info');
            }
        } catch (error) {
            console.error('Error scanning PN:', error);
            showToast('Failed to scan PN', 'error');
        }
    };

    const handleScanSerial = async () => {
        if (!unitSerial) return showToast('Please enter a Serial Number', 'error');

        try {
            const data = await apiFetch('/api/qc/validate-sn', {
                method: 'POST',
                body: JSON.stringify({ serial_number: unitSerial })
            });

            if (data.status === 'success') {
                showToast(data.message, 'success');

                if (data.existingData) {
                    const ed = data.existingData;
                    // Auto-populate unit information from the existing record
                    setUnitTpn(ed.unit_tpn || '');
                    setUnitPn(ed.unit_pn || '');
                    setPamTpn(ed.pam_tpn || '');
                    setPam1(ed.pam_1 || '');
                    setPam2(ed.pam_2 || '');
                    setPam3(ed.pam_3 || '');
                    setPam4(ed.pam_4 || '');
                    setRanBarcode(ed.ran_barcode || '');
                    setBand(ed.band || '');
                    setReworkCount(ed.rework_count || 0);
                    setCombinedRemarks(ed.combined_remarks || '');
                    setDeAssemblyStatus(ed.de_assembly_status || null);

                    // If De-Assembly was already passed, mark it as confirmed
                    setIsDeAssemblyConfirmed(ed.de_assembly_status === 'PASS');

                    // Map the saved checklist results back to the frontend state
                    if (ed.checklist && ed.checklist.length > 0) {
                        const newChecklist = INITIAL_CHECKLIST.map(item => {
                            // Find the matching result from the database by description
                            const match = ed.checklist.find((c: any) => c.checkpoint_description === item.text);
                            if (match) {
                                return {
                                    ...item,
                                    status: match.result,
                                    // CRITICAL: We only auto-confirm items that were previously 'PASS'.
                                    // If an item was 'FAIL' or 'REJECTED', we leave it unconfirmed 
                                    // so the user can change it to 'PASS' during this rework session.
                                    is_confirmed: match.result === 'PASS',
                                    remarks: match.remark,
                                    rework_count: match.rework_count,
                                    history: match.history || []
                                };
                            }
                            return item;
                        });
                        setChecklist(newChecklist);
                    }
                }
            } else {
                showToast(data.error || 'Validation Failed', 'error');
                setUnitSerial(''); // Clear invalid input
            }
        } catch (error: any) {
            console.error('Error validating SN:', error);
            showToast(error.message || 'Network error', 'error');
        }
    };

    const handleScanPam = async (value: string, setter: (val: string) => void, fieldName: string) => {
        if (!value) return showToast(`Please enter ${fieldName}`, 'error');

        // Local Duplicate Check
        const otherPams = [
            { name: 'PAM 1', val: pam1 },
            { name: 'PAM 2', val: pam2 },
            { name: 'PAM 3', val: pam3 },
            { name: 'PAM 4', val: pam4 }
        ].filter(p => p.name !== fieldName); // Exclude current field

        const duplicate = otherPams.find(p => p.val === value);
        if (duplicate) {
            showToast(`Duplicate! This value is already used in ${duplicate.name}`, 'error');
            setter(''); // Clear duplicate input
            return;
        }

        try {
            const data = await apiFetch('/api/qc/validate-pam', {
                method: 'POST',
                body: JSON.stringify({ pam_value: value })
            });

            if (data.status === 'success') {
                showToast(`${fieldName} Verified`, 'success');
            } else {
                showToast(data.error || 'Validation Failed', 'error');
                setter(''); // Clear invalid input
            }
        } catch (error: any) {
            console.error(`Error validating ${fieldName}:`, error);
            showToast(error.message || 'Network error', 'error');
        }
    };

    const handleScanRanBarcode = async () => {
        if (!ranBarcode) return showToast('Please enter a RAN Barcode', 'error');

        try {
            const data = await apiFetch('/api/qc/validate-ran', {
                method: 'POST',
                body: JSON.stringify({ ran_barcode: ranBarcode })
            });

            if (data.status === 'success') {
                showToast(data.message, 'success');
            } else {
                showToast(data.error || 'Validation Failed', 'error');
                setRanBarcode(''); // Clear invalid input
            }
        } catch (error: any) {
            console.error('Error validating RAN Barcode:', error);
            showToast(error.message || 'Network error', 'error');
        }
    };

    const handleDeAssemblyConfirm = () => {
        if (deAssemblyStatus === 'FAIL' || deAssemblyStatus === 'REJECTED') {
            if (!currentDeAssemblyRemark.trim()) {
                return showToast('Remark is mandatory for Fail/Reject', 'error');
            }

            let label = '';
            if (reworkCount === 0) label = '1st Fail – De-Assembly';
            else if (reworkCount === 1) label = '2nd Fail – Rework 1';
            else if (deAssemblyStatus === 'REJECTED') label = 'Rejected – Rework 2';

            const now = new Date().toLocaleString();
            const newRemark = `[De-Assembly] [${label}] [${now}]: ${currentDeAssemblyRemark.trim()}`;
            setCombinedRemarks(prev => prev ? `${prev}\n${newRemark}` : newRemark);
            setCurrentDeAssemblyRemark('');

            if (deAssemblyStatus === 'FAIL') {
                if (reworkCount < 2) {
                    setReworkCount(prev => (prev + 1) as 0 | 1 | 2);
                    setDeAssemblyStatus(null);
                    setChecklist(INITIAL_CHECKLIST);
                    setFinalStatus('WAITING_FOR_REWORK');
                } else {
                    setDeAssemblyStatus('REJECTED');
                    setFinalStatus('REJECTED');
                }
            } else if (deAssemblyStatus === 'REJECTED') {
                setFinalStatus('REJECTED');
            }
        } else if (deAssemblyStatus === 'PASS') {
            setIsDeAssemblyConfirmed(true);
            showToast('De-Assembly Passed. Proceed to Checklist.', 'success');
        }
    };

    const handleSubmit = async () => {
        // Validation: Ensure mandatory fields are present
        if (!inspectorName) return showToast('Inspector Name is required', 'error');
        if (!shift) return showToast('Shift is required', 'error');
        if (!unitSerial) return showToast('Unit Serial Number is required', 'error');

        // Validate RAN Barcode format before submission
        if (!validateRanBarcode(ranBarcode)) return showToast('Invalid RAN Barcode format', 'error');

        // Checklist completion check:
        // If the unit is intended to PASS, all checklist items MUST be confirmed.
        // However, if the unit has FAILED or is REJECTED, we allow submission 
        // even if the checklist is incomplete, so the rework can be recorded.
        if (finalStatus === 'PASS') {
            const allConfirmed = checklist.every(item => item.is_confirmed);
            if (!allConfirmed) {
                return showToast('All checklist items must be confirmed to PASS the unit', 'error');
            }
        }

        const payload = {
            inspector_name: inspectorName,
            shift,
            unit_tpn: unitTpn,
            unit_pn: unitPn,
            unit_serial_number: unitSerial,
            pam_tpn: pamTpn,
            pam_1: pam1,
            pam_2: pam2,
            pam_3: pam3,
            pam_4: pam4,
            ran_barcode: ranBarcode,
            band,
            checklist_results: checklist,
            final_status: finalStatus || (deAssemblyStatus === 'REJECTED' ? 'REJECTED' : null),
            process_confirmation: true,
            de_assembly_status: deAssemblyStatus,
            rework_count: reworkCount,
            combined_remarks: combinedRemarks
        };

        try {
            await apiFetch('/api/qc/submit', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            showToast('Inspection submitted successfully', 'success');

            // Trigger table refresh
            setRefreshTrigger(prev => prev + 1);

            // Reset Form
            setUnitSerial('');
            setPamTpn('611-PCA000146-L');
            setPam1('');
            setPam2('');
            setPam3('');
            setPam4('');
            setRanBarcode('');
            setBand('');
            setChecklist(INITIAL_CHECKLIST);
            setFinalStatus(null);
            setDeAssemblyStatus(null);
            setReworkCount(0);
            setCombinedRemarks('');
            setCurrentDeAssemblyRemark('');
            setIsDeAssemblyConfirmed(false);
        } catch (error: any) {
            console.error('Error submitting inspection:', error);
            showToast(error.message || 'Network error', 'error');
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1><span role="img" aria-label="inspection">📋</span> QC Inspection</h1>
                <p>Quality Control Inspection Module</p>
            </div>

            {/* Inspection Details Card */}
            <div className={styles.card}>
                <h3>Inspection Details</h3>
                <div className={styles.formGrid}>
                    <div className={styles.inputGroup}>
                        <label>Inspector Name *</label>
                        <input
                            type="text"
                            value={inspectorName}
                            onChange={e => setInspectorName(e.target.value)}
                            placeholder="Enter Name"
                            className={styles.input}
                        />
                    </div>

                    <div className={styles.inputGroup}>
                        <label>Date & Time</label>
                        <input
                            type="text"
                            value={currentTime.toLocaleString()}
                            readOnly
                            className={styles.input}
                            style={{ backgroundColor: '#f3f4f6' }}
                        />
                    </div>

                    <div className={styles.inputGroup}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label>Shift *</label>
                            {isManager && (
                                <button
                                    onClick={() => setIsShiftManagementOpen(!isShiftManagementOpen)}
                                    style={{
                                        fontSize: '0.8rem',
                                        padding: '2px 8px',
                                        background: '#e0e7ff',
                                        color: '#4338ca',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Manage
                                </button>
                            )}
                        </div>
                        <select
                            value={shift}
                            onChange={e => setShift(e.target.value)}
                            className={styles.select}
                        >
                            <option value="">Select Shift</option>
                            {shifts.map(s => (
                                <option key={s.name} value={s.name}>{s.name} ({s.start_time}-{s.end_time})</option>
                            ))}
                        </select>
                        {!isManager && !shift && shifts.length > 0 && (
                            <span style={{ color: 'red', fontSize: '0.8rem' }}>No active shift for current time</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Shift Management Section (For Managers) */}
            {isManager && isShiftManagementOpen && (
                <ShiftManagement
                    isStandalone={true}
                    onUpdate={fetchFormData}
                    onClose={() => setIsShiftManagementOpen(false)}
                />
            )}

            {/* Part Details Card (TPN & PN) */}
            <div className={styles.card}>
                <h3>Part Details</h3>
                <div className={styles.formGrid}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', gridColumn: 'span 2' }}>
                        <div className={styles.inputGroup}>
                            <label>Unit TPN</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    list="unitTpns"
                                    value={unitTpn}
                                    onChange={e => setUnitTpn(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleScanTpn();
                                    }}
                                    className={styles.input}
                                    placeholder="Scan or Select TPN"
                                />
                                <datalist id="unitTpns">{unitTpns.map(t => <option key={t} value={t} />)}</datalist>
                                <button
                                    onClick={handleScanTpn}
                                    style={{
                                        padding: '0 1rem',
                                        background: '#4f46e5',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Scan
                                </button>
                            </div>
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Unit PN</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    list="unitPns"
                                    value={unitPn}
                                    onChange={e => setUnitPn(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleScanPn();
                                    }}
                                    className={styles.input}
                                    placeholder="Scan or Select PN"
                                />
                                <datalist id="unitPns">{unitPns.map(p => <option key={p} value={p} />)}</datalist>
                                <button
                                    onClick={handleScanPn}
                                    style={{
                                        padding: '0 1rem',
                                        background: '#4f46e5',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Scan
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Unit Information Card */}
            <div className={styles.card}>
                <h3>Unit Information</h3>
                <div className={styles.formGrid}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', gridColumn: '1 / -1' }}>
                        <div className={styles.inputGroup}>
                            <label>Unit Serial No *</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    type="text"
                                    value={unitSerial}
                                    onChange={e => setUnitSerial(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleScanSerial();
                                    }}
                                    className={styles.input}
                                    placeholder="Scan or Type"
                                />
                                <button
                                    onClick={handleScanSerial}
                                    style={{
                                        padding: '0 1rem',
                                        background: '#4f46e5',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Scan
                                </button>
                            </div>
                        </div>
                        <div className={styles.inputGroup}>
                            <label>PAM TPN</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    type="text"
                                    value={pamTpn}
                                    readOnly
                                    className={styles.input}
                                    style={{ backgroundColor: '#f3f4f6' }}
                                />
                            </div>
                        </div>

                        <div className={styles.inputGroup}>
                            <label>PAM 1</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    type="text"
                                    value={pam1}
                                    onChange={e => setPam1(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleScanPam(pam1, setPam1, 'PAM 1');
                                    }}
                                    className={styles.input}
                                    placeholder="Scan or Type"
                                />
                                <button
                                    onClick={() => handleScanPam(pam1, setPam1, 'PAM 1')}
                                    style={{
                                        padding: '0 1rem',
                                        background: '#4f46e5',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Scan
                                </button>
                            </div>
                        </div>
                        <div className={styles.inputGroup}>
                            <label>PAM 2</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    type="text"
                                    value={pam2}
                                    onChange={e => setPam2(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleScanPam(pam2, setPam2, 'PAM 2');
                                    }}
                                    className={styles.input}
                                    placeholder="Scan or Type"
                                />
                                <button
                                    onClick={() => handleScanPam(pam2, setPam2, 'PAM 2')}
                                    style={{
                                        padding: '0 1rem',
                                        background: '#4f46e5',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Scan
                                </button>
                            </div>
                        </div>
                        <div className={styles.inputGroup}>
                            <label>PAM 3</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    type="text"
                                    value={pam3}
                                    onChange={e => setPam3(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleScanPam(pam3, setPam3, 'PAM 3');
                                    }}
                                    className={styles.input}
                                    placeholder={band === 'DB' ? "Disabled for DB" : "Scan or Type"}
                                    disabled={band === 'DB'}
                                    style={band === 'DB' ? { backgroundColor: '#e5e7eb', cursor: 'not-allowed' } : {}}
                                />
                                <button
                                    onClick={() => handleScanPam(pam3, setPam3, 'PAM 3')}
                                    disabled={band === 'DB'}
                                    style={{
                                        padding: '0 1rem',
                                        background: band === 'DB' ? '#9ca3af' : '#4f46e5',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: band === 'DB' ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    Scan
                                </button>
                            </div>
                        </div>
                        <div className={styles.inputGroup}>
                            <label>PAM 4</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    type="text"
                                    value={pam4}
                                    onChange={e => setPam4(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleScanPam(pam4, setPam4, 'PAM 4');
                                    }}
                                    className={styles.input}
                                    placeholder={band === 'DB' ? "Disabled for DB" : "Scan or Type"}
                                    disabled={band === 'DB'}
                                    style={band === 'DB' ? { backgroundColor: '#e5e7eb', cursor: 'not-allowed' } : {}}
                                />
                                <button
                                    onClick={() => handleScanPam(pam4, setPam4, 'PAM 4')}
                                    disabled={band === 'DB'}
                                    style={{
                                        padding: '0 1rem',
                                        background: band === 'DB' ? '#9ca3af' : '#4f46e5',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: band === 'DB' ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    Scan
                                </button>
                            </div>
                        </div>

                        <div className={styles.inputGroup}>
                            <label>RAN Barcode * (Format: RAN-XXXXXX_BO_XXXX)</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    type="text"
                                    value={ranBarcode}
                                    onChange={e => setRanBarcode(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleScanRanBarcode();
                                    }}
                                    className={`${styles.input} ${ranBarcode && !validateRanBarcode(ranBarcode) ? styles.errorInput : ''}`}
                                    placeholder="Scan or Type"
                                />
                                <button
                                    onClick={handleScanRanBarcode}
                                    style={{
                                        padding: '0 1rem',
                                        background: '#4f46e5',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Scan
                                </button>
                            </div>
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Band *</label>
                            <select
                                value={band}
                                onChange={e => {
                                    const val = e.target.value;
                                    setBand(val);
                                    if (val === 'DB') {
                                        setPam3('');
                                        setPam4('');
                                    }
                                }}
                                className={styles.select}
                            >
                                <option value="">Select Band</option>
                                <option value="B1">B1</option>
                                <option value="DB">DB</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* De-Assembly Section */}
            <div className={styles.card}>
                <h3>De-Assembly</h3>
                <div className={styles.deAssemblyContent}>
                    <div className={styles.reworkInfo}>
                        <strong>Status:</strong> {reworkCount === 0 ? 'Initial De-Assembly' : `Rework Attempt ${reworkCount}`}
                    </div>

                    <div className={styles.statusButtons} style={{ marginTop: '1rem' }}>
                        <button
                            className={`${styles.statusBtn} ${deAssemblyStatus === 'PASS' ? styles.passActive : ''}`}
                            onClick={() => {
                                const newStatus = deAssemblyStatus === 'PASS' ? null : 'PASS';
                                setDeAssemblyStatus(newStatus);
                                setIsDeAssemblyConfirmed(false);
                                setChecklist(INITIAL_CHECKLIST);
                                setFinalStatus(null);
                            }}
                            disabled={deAssemblyStatus === 'REJECTED'}
                        >
                            ✅ Pass
                        </button>
                        <button
                            className={`${styles.statusBtn} ${deAssemblyStatus === 'FAIL' ? styles.failActive : ''}`}
                            onClick={() => {
                                const newStatus = deAssemblyStatus === 'FAIL' ? null : 'FAIL';
                                setDeAssemblyStatus(newStatus);
                                setIsDeAssemblyConfirmed(false);
                                setChecklist(INITIAL_CHECKLIST);
                                setFinalStatus(null);
                            }}
                            disabled={reworkCount >= 2 || deAssemblyStatus === 'REJECTED'}
                        >
                            ❌ Fail
                        </button>
                        {reworkCount === 2 && (
                            <button
                                className={`${styles.statusBtn} ${deAssemblyStatus === 'REJECTED' ? styles.failActive : ''}`}
                                onClick={() => {
                                    const newStatus = deAssemblyStatus === 'REJECTED' ? null : 'REJECTED';
                                    setDeAssemblyStatus(newStatus);
                                    setIsDeAssemblyConfirmed(false);
                                    setChecklist(INITIAL_CHECKLIST);
                                    setFinalStatus(null);
                                }}
                            >
                                🚫 Reject
                            </button>
                        )}
                    </div>

                    {(deAssemblyStatus === 'FAIL' || deAssemblyStatus === 'REJECTED') && !isDeAssemblyConfirmed && (
                        <div className={styles.inputGroup} style={{ marginTop: '1rem' }}>
                            <label>Remark *</label>
                            <textarea
                                value={currentDeAssemblyRemark}
                                onChange={e => setCurrentDeAssemblyRemark(e.target.value)}
                                placeholder="Explain why De-Assembly failed..."
                                className={styles.textarea}
                                rows={3}
                            />
                        </div>
                    )}

                    {!isDeAssemblyConfirmed && deAssemblyStatus && (
                        <button
                            onClick={handleDeAssemblyConfirm}
                            className={styles.confirmBtn}
                            style={{ marginTop: '1rem' }}
                        >
                            Confirm De-Assembly
                        </button>
                    )}

                    {combinedRemarks && (
                        <div className={styles.remarksDisplay} style={{ marginTop: '1rem', padding: '1rem', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fee2e2' }}>
                            <h4 style={{ margin: '0 0 0.5rem 0', color: '#991b1b' }}>Remarks History</h4>
                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '0.9rem', color: '#b91c1c' }}>{combinedRemarks}</pre>
                        </div>
                    )}
                </div>
            </div>

            {/* Checklist Card */}
            <div className={`${styles.card} ${(!isDeAssemblyConfirmed || deAssemblyStatus !== 'PASS') ? styles.disabledCard : ''}`}>
                <div className={styles.cardHeader}>
                    <h3>Inspection Checklist</h3>
                    {(!isDeAssemblyConfirmed || deAssemblyStatus !== 'PASS') && (
                        <span className={styles.lockBadge}>🔒 Complete De-Assembly to Unlock</span>
                    )}
                </div>
                <div className={styles.checklist}>
                    {[
                        { title: '1st Level Inspection', level: 'FIRST_LEVEL' },
                        { title: 'Final Level Inspection', level: 'FINAL_LEVEL' }
                    ].map(section => (
                        <div key={section.level}>
                            <h4 style={{ margin: '1rem 0 0.5rem', color: '#4b5563', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.25rem' }}>
                                {section.title}
                            </h4>
                            {checklist.filter(item => item.level === section.level).map(item => {
                                const itemIndex = checklist.findIndex(i => i.id === item.id);
                                const prevItem = itemIndex > 0 ? checklist[itemIndex - 1] : null;
                                // Strict Sequential Locking:
                                // 1. De-Assembly must be PASS
                                // 2. Previous item must be confirmed AND status must be PASS
                                // 3. Current item must not be confirmed
                                const isLocked = !isDeAssemblyConfirmed ||
                                    deAssemblyStatus !== 'PASS' ||
                                    (prevItem && (!prevItem.is_confirmed || prevItem.status !== 'PASS')) ||
                                    item.is_confirmed;

                                const currentAttemptLabel = item.rework_count === 0 ? 'Initial' : `Rework ${item.rework_count}`;

                                return (
                                    <div key={item.id} className={`${styles.checklistItem} ${item.is_confirmed ? styles.confirmedItem : ''}`} style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                            <div className={styles.itemLabel} style={{ fontWeight: '500', flex: 1 }}>{item.text}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#6b7280', background: '#f3f4f6', padding: '2px 6px', borderRadius: '4px' }}>
                                                {currentAttemptLabel}
                                            </div>
                                        </div>

                                        {/* Status Selection Buttons with Toggle Behavior */}
                                        <div className={styles.itemActions} style={{ display: 'flex', gap: '0.5rem', marginBottom: item.status === null && !item.is_confirmed ? '0.5rem' : '0' }}>
                                            <button
                                                className={`${styles.statusBtn} ${item.status === 'PASS' ? styles.passActive : ''}`}
                                                onClick={() => handleChecklistUpdate(item.id, 'PASS')}
                                                disabled={isLocked || item.is_confirmed}
                                            >PASS</button>

                                            {item.rework_count < 2 ? (
                                                <button
                                                    className={`${styles.statusBtn} ${item.status === 'FAIL' ? styles.failActive : ''}`}
                                                    onClick={() => handleChecklistUpdate(item.id, 'FAIL')}
                                                    disabled={isLocked || item.is_confirmed}
                                                >FAIL</button>
                                            ) : (
                                                <button
                                                    className={`${styles.statusBtn} ${item.status === 'REJECTED' ? styles.failActive : ''}`}
                                                    onClick={() => handleChecklistUpdate(item.id, 'REJECTED')}
                                                    disabled={isLocked || item.is_confirmed}
                                                >REJECT</button>
                                            )}
                                        </div>

                                        {/* Remark Input: Appears only when FAIL or REJECTED is selected but not yet confirmed */}
                                        {(item.status === 'FAIL' || item.status === 'REJECTED') && !item.is_confirmed && (
                                            <div className={styles.inputGroup} style={{ marginTop: '0.5rem' }}>
                                                <textarea
                                                    value={item.temp_remark}
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        setChecklist(prev => prev.map(i => i.id === item.id ? { ...i, temp_remark: val } : i));
                                                    }}
                                                    placeholder={`Enter remark for ${currentAttemptLabel} ${item.status === 'FAIL' ? 'failure' : 'rejection'}...`}
                                                    className={styles.textarea}
                                                    rows={2}
                                                    style={{ fontSize: '0.85rem' }}
                                                />
                                            </div>
                                        )}

                                        {/* Confirmation Button: Finalizes the selected status */}
                                        {item.status && !item.is_confirmed && (
                                            <button
                                                onClick={() => handleChecklistConfirm(item.id)}
                                                className={styles.confirmBtn}
                                                style={{ marginTop: '0.5rem' }}
                                            >
                                                Confirm {item.status}
                                            </button>
                                        )}

                                        {item.remarks && (
                                            <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#b91c1c', background: '#fef2f2', padding: '0.5rem', borderRadius: '4px' }}>
                                                <strong>Remarks:</strong>
                                                <pre style={{ margin: '0.25rem 0 0', whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{item.remarks}</pre>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {/* Process Confirmation Card */}
            <div className={styles.card}>
                <h3>Process Confirmation (Non-ROHS)</h3>
                <div className={styles.processBox}>
                    <p style={{ margin: 0, fontWeight: '500', color: '#374151' }}>
                        C441 & C442 mounting using leaded
                    </p>
                </div>
            </div>

            {/* Footer & Submit */}
            <div className={styles.footer}>
                {/* Final Status Selection: Only visible when the checklist is complete or rejected */}
                <div className={styles.finalStatus}>
                    <label>Final Status</label>
                    <div className={styles.statusButtons}>
                        {deAssemblyStatus === 'REJECTED' ? (
                            <button className={`${styles.finalBtn} ${styles.failActive}`}>REJECTED</button>
                        ) : (
                            <>
                                <button
                                    className={`${styles.finalBtn} ${finalStatus === 'PASS' ? styles.passActive : ''}`}
                                    onClick={() => handleFinalStatusUpdate('PASS')}
                                    disabled={checklist.some(item => item.status === 'FAIL' || item.status === 'REJECTED') || deAssemblyStatus === 'FAIL'}
                                    style={{
                                        opacity: (checklist.some(item => item.status === 'FAIL' || item.status === 'REJECTED') || deAssemblyStatus === 'FAIL') ? 0.5 : 1,
                                        cursor: (checklist.some(item => item.status === 'FAIL' || item.status === 'REJECTED') || deAssemblyStatus === 'FAIL') ? 'not-allowed' : 'pointer'
                                    }}
                                >PASS</button>
                                <button
                                    className={`${styles.finalBtn} ${finalStatus === 'WAITING_FOR_REWORK' ? styles.reworkActive : ''}`}
                                    onClick={() => handleFinalStatusUpdate('WAITING_FOR_REWORK')}
                                >REWORK</button>
                            </>
                        )}
                    </div>
                </div>
                <button className={styles.submitBtn} onClick={handleSubmit}>
                    Submit Inspection
                </button>
            </div >

            <CompletedInspectionsTable refreshTrigger={refreshTrigger} />
        </div >
    );
};
