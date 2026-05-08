import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../components/Toast';
import styles from './VacuumLeakTest.module.css';
import { ROLES } from '../../constants/roles';
import { ShiftManagement } from '../qc-inspection/ShiftManagement';
import { formatIST } from '../../utils/dateUtils';
import { VLTCompletedTable } from './VLTCompletedTable';

export const VacuumLeakTest: React.FC = () => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [currentTime, setCurrentTime] = useState(new Date());

    // Form State
    const [inspectorName, setInspectorName] = useState('');
    const [shift, setShift] = useState('');
    const [unitTpn, setUnitTpn] = useState('');
    const [unitPn, setUnitPn] = useState('');
    const [unitSerial, setUnitSerial] = useState('');
    const [band, setBand] = useState('');
    const [measuredValue, setMeasuredValue] = useState('');
    const [finalStatus, setFinalStatus] = useState<'PASS' | 'FAIL' | 'rework' | null>(null);
    const [failureReason, setFailureReason] = useState('');

    // Data from API
    const [shifts, setShifts] = useState<{ name: string, start_time: string, end_time: string }[]>([]);
    const [unitTpns, setUnitTpns] = useState<string[]>([]);
    const [unitPns, setUnitPns] = useState<string[]>([]);
    const [mappings, setMappings] = useState<Record<string, { unitTpn: string, band: string }>>({});

    const [isShiftManagementOpen, setIsShiftManagementOpen] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const authorizedRoles = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER].map(r => r.toLowerCase());
    const userRole = (user?.role || '').toLowerCase().trim();
    const isAuthorized = authorizedRoles.includes(userRole);
    const isManager = isAuthorized;

    const fetchFormData = useCallback(async () => {
        try {
            const data = await apiFetch('/api/vacuum-leak-test/form-data');
            setShifts(data.shifts);
            setUnitTpns(data.unitTpns);
            setUnitPns(data.unitPns);
            setMappings(data.mappings || {});
        } catch (error) {
            console.error('Error fetching VLT form data:', error);
            showToast('Failed to load form data: ' + String(error), 'error');
        }
    }, [showToast]);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        fetchFormData();
        return () => clearInterval(timer);
    }, [fetchFormData]);

    // Auto-select shift based on time
    useEffect(() => {
        if (shifts.length > 0) {
            const now = new Date();
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();
            const currentTimeVal = currentHour * 60 + currentMinute;

            const matchingShift = shifts.find(s => {
                const [startH, startM] = s.start_time.split(':').map(Number);
                const [endH, endM] = s.end_time.split(':').map(Number);

                const startVal = startH * 60 + startM;
                const endVal = endH * 60 + endM;

                if (endVal < startVal) { // Crosses midnight
                    return currentTimeVal >= startVal || currentTimeVal < endVal;
                } else {
                    return currentTimeVal >= startVal && currentTimeVal < endVal;
                }
            });

            if (!shift && matchingShift) {
                setShift(matchingShift.name);
            }
        }
    }, [shifts, shift]);

    const handleScanTpn = async () => {
        let value = unitTpn.trim();
        if (!value) return showToast('Please enter a TPN', 'error');

        if (value.startsWith('TPN:')) {
            value = value.replace('TPN:', '').trim();
            setUnitTpn(value);
        }

        const tpnRegex = /^\d+-SKU\d+-[A-Z]$/;
        if (!tpnRegex.test(value)) {
            return showToast('Invalid TPN format. Expected: 611-SKU000176-P', 'error');
        }

        try {
            const data = await apiFetch('/api/vacuum-leak-test/tpn', {
                method: 'POST',
                body: JSON.stringify({ value })
            });
            if (data.created) {
                setUnitTpns(prev => [...prev, data.value].sort());
                showToast('TPN added to list', 'success');
            } else {
                showToast('Value already exists', 'info');
            }
            // Mapping check
            const mapping = mappings[value];
            if (mapping) {
                setUnitTpn(mapping.unitTpn);
                setBand(mapping.band);
            }
        } catch (error) {
            console.error('Error scanning VLT TPN:', error);
            showToast('Failed to scan TPN', 'error');
        }
    };

    const handleScanPn = async () => {
        let value = unitPn.trim();
        if (!value) return showToast('Please enter a PN', 'error');

        if (value.startsWith('SN:')) {
            value = value.replace('SN:', '').trim();
            setUnitPn(value);
        }

        const pnRegex = /^\d+-PCA\d+-[A-Z]$/;
        if (!pnRegex.test(value)) {
            return showToast('Invalid PN format. Expected: 611-PCA000211-E', 'error');
        }

        try {
            const data = await apiFetch('/api/vacuum-leak-test/pn', {
                method: 'POST',
                body: JSON.stringify({ value })
            });
            if (data.created) {
                setUnitPns(prev => [...prev, data.value].sort());
                showToast('PN added to list', 'success');
            } else {
                showToast('Value already exists', 'info');
            }
            // Mapping check
            const mapping = mappings[value];
            if (mapping) {
                setUnitTpn(mapping.unitTpn);
                setBand(mapping.band);
            }
        } catch (error) {
            console.error('Error scanning VLT PN:', error);
            showToast('Failed to scan PN', 'error');
        }
    };

    const handleScanSerial = async () => {
        if (!unitSerial) return showToast('Please enter a Serial Number', 'error');
        try {
            const data = await apiFetch('/api/vacuum-leak-test/validate-serial', {
                method: 'POST',
                body: JSON.stringify({ unit_serial_no: unitSerial })
            });

            if (data.status === 'success') {
                showToast(data.message, 'success');
                if (data.existingData) {
                    const ed = data.existingData;
                    setUnitTpn(ed.unit_tpn || '');
                    setUnitPn(ed.unit_pn || '');
                    setBand(ed.band || '');
                    setMeasuredValue(ed.measured_value || '');
                    // For retest, we don't necessarily clear or set finalStatus yet
                }
            } else {
                showToast(data.message || 'Validation Failed', 'error');
                setUnitSerial('');
            }
        } catch (error: any) {
            console.error('Error validating VLT SN:', error);
            showToast(error.message || 'Network error', 'error');
        }
    };

    const handleSubmit = async () => {
        if (!inspectorName) return showToast('Inspector Name is required', 'error');
        if (!shift) return showToast('Shift is required', 'error');
        if (!unitSerial) return showToast('Unit Serial Number is required', 'error');
        if (!finalStatus) return showToast('Final Status is required', 'error');
        if ((finalStatus === 'FAIL' || finalStatus === 'rework') && !failureReason.trim()) {
            return showToast('Reason for failure is mandatory', 'error');
        }

        const payload = {
            inspector_name: inspectorName,
            shift,
            unit_tpn: unitTpn,
            unit_pn: unitPn,
            unit_serial_no: unitSerial,
            band,
            measured_value: measuredValue,
            final_status: finalStatus,
            failure_reason: failureReason
        };

        try {
            await apiFetch('/api/vacuum-leak-test/submit', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            showToast('VLT Inspection submitted successfully', 'success');
            setRefreshTrigger(prev => prev + 1);

            // Reset Form (except some fields like inspector/shift if desired, but QC resets mostly)
            setUnitSerial('');
            setMeasuredValue('');
            setFinalStatus(null);
            setFailureReason('');
            setBand('');
            setUnitPn('');
            setUnitTpn('');
        } catch (error: any) {
            console.error('Error submitting VLT inspection:', error);
            showToast(error.message || 'Network error', 'error');
        }
    };

    // Final Status Section
    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1><span role="img" aria-label="vacuum">🔬</span> Vacuum Leak Test</h1>
                <p>Vacuum Leak Testing Module</p>
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
                            value={formatIST(currentTime)}
                            readOnly
                            className={styles.input}
                            style={{ backgroundColor: '#f3f4f6' }}
                        />
                    </div>

                    <div className={styles.inputGroup}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label>Shift *</label>
                            {isAuthorized && (
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

            {/* Shift Management Section */}
            {isAuthorized && isShiftManagementOpen && (
                <ShiftManagement
                    isStandalone={true}
                    onUpdate={fetchFormData}
                    onClose={() => setIsShiftManagementOpen(false)}
                />
            )}

            {/* Part Details Card (PN on left, TPN on right) */}
            <div className={styles.card}>
                <h3>Part Details</h3>
                <div className={styles.formGrid}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', gridColumn: 'span 2' }}>
                        <div className={styles.inputGroup}>
                            <label>Unit PN</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    list="unitPns"
                                    value={unitPn}
                                    onChange={e => {
                                        const val = e.target.value;
                                        setUnitPn(val);
                                        const mapping = mappings[val];
                                        if (mapping) {
                                            setUnitTpn(mapping.unitTpn);
                                            setBand(mapping.band);
                                        } else if (!val) {
                                            setUnitTpn('');
                                            setBand('');
                                        }
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleScanPn();
                                    }}
                                    className={styles.input}
                                    placeholder="Scan or Select PN"
                                />
                                <datalist id="unitPns">{unitPns.map(p => <option key={p} value={p} />)}</datalist>
                                <button
                                    onClick={handleScanPn}
                                    style={{ padding: '0 1rem', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                                >
                                    Scan
                                </button>
                            </div>
                        </div>
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
                                    readOnly={!!mappings[unitPn]}
                                    style={mappings[unitPn] ? { backgroundColor: '#f3f4f6', cursor: 'not-allowed' } : {}}
                                />
                                <datalist id="unitTpns">{unitTpns.map(t => <option key={t} value={t} />)}</datalist>
                                <button
                                    onClick={handleScanTpn}
                                    disabled={!!mappings[unitPn]}
                                    style={{ padding: '0 1rem', background: mappings[unitPn] ? '#9ca3af' : '#4f46e5', color: 'white', border: 'none', borderRadius: '6px', cursor: mappings[unitPn] ? 'not-allowed' : 'pointer' }}
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
                                    style={{ padding: '0 1rem', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                                >
                                    Scan
                                </button>
                            </div>
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Band</label>
                            <select
                                value={band}
                                onChange={e => setBand(e.target.value)}
                                className={styles.select}
                                disabled={!!mappings[unitPn]}
                                style={mappings[unitPn] ? { backgroundColor: '#f3f4f6', cursor: 'not-allowed' } : {}}
                            >
                                <option value="">Select Band</option>
                                <option value="B1">Band-1 (B1)</option>
                                <option value="DB">DB</option>
                            </select>
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Stage</label>
                            <input
                                type="text"
                                value="Vacuum Leak Test"
                                readOnly
                                className={styles.input}
                                style={{ backgroundColor: '#f3f4f6' }}
                            />
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Measured Value</label>
                            <input
                                type="number"
                                value={measuredValue}
                                onChange={e => setMeasuredValue(e.target.value)}
                                className={styles.input}
                                placeholder="Enter Numeric Value"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Final Status Section */}
            <div className={styles.footer} style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div className={styles.finalStatus}>
                        <label><b>Final Status</b></label>
                        <div className={styles.statusButtons}>
                            <button
                                className={`${styles.finalBtn} ${finalStatus === 'PASS' ? styles.passActive : ''}`}
                                onClick={() => setFinalStatus('PASS')}
                            >
                                PASS
                            </button>
                            <button
                                className={`${styles.finalBtn} ${finalStatus === 'FAIL' ? styles.failActive : ''}`}
                                onClick={() => setFinalStatus('FAIL')}
                            >
                                FAIL
                            </button>
                            <button
                                className={`${styles.finalBtn} ${finalStatus === 'rework' ? styles.reworkActive : ''}`}
                                onClick={() => setFinalStatus('rework')}
                            >
                                rework
                            </button>
                        </div>
                    </div>

                    {finalStatus && (
                        <button
                            className={styles.submitBtn}
                            onClick={handleSubmit}
                        >
                            Submit Inspection
                        </button>
                    )}
                </div>

                {(finalStatus === 'FAIL' || finalStatus === 'rework') && (
                    <div className={styles.reworkBox}>
                        <label>Reason for {finalStatus} *</label>
                        <textarea
                            value={failureReason}
                            onChange={e => setFailureReason(e.target.value)}
                            placeholder={`Mandatory rework for ${finalStatus.toLowerCase()}`}
                            className={styles.textarea}
                        />
                    </div>
                )}
            </div>

            <div className={styles.tableContainer}>
                <VLTCompletedTable refreshTrigger={refreshTrigger} />
            </div>
        </div>
    );
};
