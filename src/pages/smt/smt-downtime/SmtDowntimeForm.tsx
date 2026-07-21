import React from 'react';
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
    };
    onSave: (e: React.FormEvent) => void;
    onClear: () => void;
}

export const SmtDowntimeForm: React.FC<SmtDowntimeFormProps> = ({ formState, onSave, onClear }) => {
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
        status, setStatus,
        remarks, setRemarks,
        editingId, saving
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
                    </div>
                </div>

                <div className={styles.formSectionGroup}>
                    <h4 className={styles.formGroupHeading}>3. Details & Resolution</h4>
                    <div className={styles.formGrid}>
                        <div className={styles.inputGroup}>
                            <label className={styles.inputLabel}>Status <span className={styles.requiredStar}>*</span></label>
                            <select value={status} onChange={(e) => setStatus(e.target.value)} className={styles.input} required>
                                <option value="Open">Open</option>
                                <option value="Closed">Closed</option>
                            </select>
                        </div>

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
