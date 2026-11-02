import React, { useState } from 'react';
import styles from './SmtDowntimeTracker.module.css';
import { SHIFTS, LINES, MACHINES, DOWNTIME_CATEGORIES, REASON_CODES } from './smtDowntime.constants';

interface SmtDowntimeFormProps {
    formState: {
        shift: string;
        setShift: (v: string) => void;
        line: string;
        setLine: (v: string) => void;
        machineName: string;
        setMachineName: (v: string) => void;
        startTime: string;
        setStartTime: (v: string) => void;
        endTime: string;
        setEndTime: (v: string) => void;
        duration: number;
        downtimeCategory: string;
        setDowntimeCategory: (v: string) => void;
        reasonCode: string;
        setReasonCode: (v: string) => void;
        downtimeDescription: string;
        setDowntimeDescription: (v: string) => void;
        actionTaken: string;
        setActionTaken: (v: string) => void;
        responsiblePerson: string;
        setResponsiblePerson: (v: string) => void;
        status: string;
        setStatus: (v: string) => void;
        remarks: string;
        setRemarks: (v: string) => void;
        editingId: string | null;
        saving: boolean;
        workOrderId: string;
        setWorkOrderId: (v: string) => void;
        manualWorkOrder: string;
        setManualWorkOrder: (v: string) => void;
    };
    eligibleWos: any[];
    onSave: (e: React.FormEvent) => void;
    onClear: () => void;
}

export const SmtDowntimeForm: React.FC<SmtDowntimeFormProps> = ({ formState, eligibleWos, onSave, onClear }) => {
    const {
        shift, setShift,
        line, setLine,
        machineName, setMachineName,
        startTime, setStartTime,
        endTime, setEndTime,
        duration,
        downtimeCategory, setDowntimeCategory,
        reasonCode, setReasonCode,
        downtimeDescription, setDowntimeDescription,
        actionTaken, setActionTaken,
        responsiblePerson, setResponsiblePerson,
        remarks, setRemarks,
        editingId, saving,
        workOrderId, setWorkOrderId,
        manualWorkOrder, setManualWorkOrder
    } = formState;

    return (
        <div className={styles.card}>
            <div className={styles.cardHeaderRow}>
                <h3>{editingId ? '✏️ Edit Downtime Incident' : '📝 Log New Downtime Incident'}</h3>
                {duration > 0 && (
                    <span className={styles.calculatedDurationPill}>
                        ⏱ Calculated Duration: <strong>{duration} mins</strong>
                    </span>
                )}
            </div>

            <form onSubmit={onSave}>
                <div className={styles.formSectionGroup}>
                    <h4 className={styles.formGroupHeading}>1. Shift & Station Identification</h4>
                    <div className={styles.formGrid}>
                        <div className={styles.inputGroup}>
                            <label className={styles.inputLabel}>Shift <span className={styles.requiredStar}>*</span></label>
                            <select value={shift} onChange={(e) => setShift(e.target.value)} className={styles.input} required>
                                <option value="">Select Shift</option>
                                {SHIFTS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>

                        <div className={styles.inputGroup}>
                            <label className={styles.inputLabel}>Line <span className={styles.requiredStar}>*</span></label>
                            <select value={line} onChange={(e) => setLine(e.target.value)} className={styles.input} required>
                                <option value="">Select Line</option>
                                {LINES.map(l => <option key={l} value={l}>{l}</option>)}
                            </select>
                        </div>

                        <div className={styles.inputGroup}>
                            <label className={styles.inputLabel}>Machine Name <span className={styles.requiredStar}>*</span></label>
                            <select value={machineName} onChange={(e) => setMachineName(e.target.value)} className={styles.input} required>
                                <option value="">Select Machine</option>
                                {MACHINES.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                <div className={styles.formSectionGroup}>
                    <h4 className={styles.formGroupHeading}>2. Timing & Classification</h4>
                    <div className={styles.formGrid}>
                        <div className={styles.inputGroup}>
                            <label className={styles.inputLabel}>Start Time <span className={styles.requiredStar}>*</span></label>
                            <input
                                type="datetime-local"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                                className={styles.input}
                                required
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label className={styles.inputLabel}>End Time <span className={styles.requiredStar}>*</span></label>
                            <input
                                type="datetime-local"
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                                className={styles.input}
                                required
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label className={styles.inputLabel}>Duration (Minutes)</label>
                            <input
                                type="number"
                                value={duration}
                                className={`${styles.input} ${styles.readOnlyInput}`}
                                disabled
                                readOnly
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label className={styles.inputLabel}>Downtime Category <span className={styles.requiredStar}>*</span></label>
                            <select value={downtimeCategory} onChange={(e) => setDowntimeCategory(e.target.value)} className={styles.input} required>
                                <option value="">Select Category</option>
                                {DOWNTIME_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        <div className={styles.inputGroup}>
                            <label className={styles.inputLabel}>Reason Code <span className={styles.requiredStar}>*</span></label>
                            <select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)} className={styles.input} required>
                                <option value="">Select Reason Code</option>
                                {REASON_CODES.map(rc => <option key={rc} value={rc}>{rc}</option>)}
                            </select>
                        </div>

                        <div className={styles.inputGroup}>
                            <label className={styles.inputLabel}>Responsible Person <span className={styles.requiredStar}>*</span></label>
                            <input
                                type="text"
                                value={responsiblePerson}
                                onChange={(e) => setResponsiblePerson(e.target.value)}
                                className={styles.input}
                                placeholder="Enter Engineer / Operator Name"
                                required
                            />
                        </div>

                        {/* Searchable Autocomplete/Combobox Work Order Field */}
                        <div className={styles.inputGroup} style={{ position: 'relative' }}>
                            <label className={styles.inputLabel}>Work Order (Searchable / Manual Entry)</label>
                            <input
                                type="text"
                                value={workOrderId || manualWorkOrder}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setManualWorkOrder(val);
                                    setWorkOrderId(val);
                                }}
                                className={styles.input}
                                placeholder="Type or select a pending Work Order..."
                                onFocus={() => (window as any)._setWoDropdownOpen?.(true)}
                                onBlur={() => {
                                    // Slight delay to allow clicking on dropdown items
                                    setTimeout(() => (window as any)._setWoDropdownOpen?.(false), 200);
                                }}
                            />
                            <WoSuggestions 
                                query={workOrderId || manualWorkOrder} 
                                eligibleWos={eligibleWos} 
                                onSelect={(val) => {
                                    setWorkOrderId(val);
                                    setManualWorkOrder(val);
                                }} 
                            />
                        </div>
                    </div>
                </div>

                <div className={styles.formSectionGroup}>
                    <h4 className={styles.formGroupHeading}>3. Details & Resolution</h4>
                    <div className={styles.formGrid}>
                        <div className={`${styles.inputGroup} ${styles.formGridFull}`}>
                            <label className={styles.inputLabel}>Downtime Description <span className={styles.requiredStar}>*</span></label>
                            <textarea
                                value={downtimeDescription}
                                onChange={(e) => setDowntimeDescription(e.target.value)}
                                className={styles.input}
                                rows={2}
                                placeholder="Detail what triggered the downtime event..."
                                required
                            />
                        </div>

                        <div className={`${styles.inputGroup} ${styles.formGridFull}`}>
                            <label className={styles.inputLabel}>Action Taken <span className={styles.requiredStar}>*</span></label>
                            <textarea
                                value={actionTaken}
                                onChange={(e) => setActionTaken(e.target.value)}
                                className={styles.input}
                                rows={2}
                                placeholder="Enter corrective actions executed..."
                                required
                            />
                        </div>

                        <div className={`${styles.inputGroup} ${styles.formGridFull}`}>
                            <label className={styles.inputLabel}>Remarks</label>
                            <textarea
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                className={styles.input}
                                rows={2}
                                placeholder="Additional reference notes or component IDs..."
                            />
                        </div>
                    </div>
                </div>

                <div className={styles.buttonRow}>
                    <button type="button" onClick={onClear} className={styles.secondaryButton} disabled={saving}>
                        Clear Form
                    </button>
                    <button type="submit" className={styles.button} disabled={saving}>
                        {saving ? 'Saving...' : editingId ? 'Update Incident Record' : 'Save Incident Record'}
                    </button>
                </div>
            </form>
        </div>
    );
};

interface WoSuggestionsProps {
    query: string;
    eligibleWos: any[];
    onSelect: (val: string) => void;
}

const WoSuggestions: React.FC<WoSuggestionsProps> = ({ query, eligibleWos, onSelect }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    // Bind state toggle handler globally so input focus/blur events can reach it
    React.useEffect(() => {
        (window as any)._setWoDropdownOpen = setIsOpen;
        return () => {
            delete (window as any)._setWoDropdownOpen;
        };
    }, []);

    if (!isOpen) return null;

    const filtered = eligibleWos.filter(wo => 
        !query || 
        wo.id.toLowerCase().includes(query.toLowerCase()) ||
        (wo.product_name || '').toLowerCase().includes(query.toLowerCase())
    );

    if (filtered.length === 0) return null;

    return (
        <div 
            style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                maxHeight: '200px',
                overflowY: 'auto',
                zIndex: 9999,
                marginTop: '4px'
            }}
        >
            {filtered.map(wo => (
                <div
                    key={wo.id}
                    onMouseDown={() => onSelect(wo.id)}
                    style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                >
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>{wo.id}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {wo.product_name} &bull; Qty: {wo.quantity}
                    </div>
                </div>
            ))}
        </div>
    );
};

