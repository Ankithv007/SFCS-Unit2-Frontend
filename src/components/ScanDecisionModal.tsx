import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, MessageSquare, AlertTriangle, X } from 'lucide-react';
import styles from './ScanDecisionModal.module.css';

interface ScanDecisionModalProps {
    barcode: string;
    onFinalize: (status: string, remarks?: string) => void;
    onClose: () => void;
    repairMode?: boolean;
}

const ScanDecisionModal: React.FC<ScanDecisionModalProps> = ({ barcode, onFinalize, onClose, repairMode = false }) => {
    const [mode, setMode] = useState<'select' | 'input'>(repairMode ? 'input' : 'select');
    const [status, setStatus] = useState<'ACCEPTED' | 'REWORK' | 'DEBUG'>(repairMode ? 'ACCEPTED' : 'ACCEPTED');
    const [text, setText] = useState('');
    const [focusedIndex, setFocusedIndex] = useState(0);

    const bufferRef = useRef('');
    const actions: ('ACCEPTED' | 'REWORK' | 'DEBUG')[] = ['ACCEPTED', 'REWORK', 'DEBUG'];

    // Sanitize barcode for display (max 30 chars to avoid UI break)
    const displayBarcode = barcode.length > 30 ? barcode.substring(0, 27) + '...' : barcode;

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (mode === 'select') {
                if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    setFocusedIndex(prev => (prev + 1) % 3);
                } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    setFocusedIndex(prev => (prev - 1 + 3) % 3);
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if ((bufferRef.current || '').toUpperCase() === 'RESOLVED') {
                        handleAction('ACCEPTED');
                    } else if (bufferRef.current === '') {
                        handleAction(actions[focusedIndex]);
                    }
                    bufferRef.current = '';
                } else if (e.key.length === 1) {
                    bufferRef.current += e.key;
                    if (bufferRef.current.length > 20) bufferRef.current = '';
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [mode, focusedIndex]);

    const handleAction = (selectedStatus: 'ACCEPTED' | 'REWORK' | 'DEBUG') => {
        if (selectedStatus === 'ACCEPTED') {
            onFinalize('ACCEPTED');
        } else {
            setStatus(selectedStatus);
            setMode('input');
        }
    };

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
                <div className={styles.modalHeader}>
                    <h3>Scan Action - <span title={barcode}>{displayBarcode}</span></h3>
                    <button className={styles.closeBtn} onClick={onClose}><X size={24} /></button>
                </div>
                <div className={styles.modalBody}>
                    {mode === 'select' ? (
                        <div className={styles.decisionGrid}>
                            <button
                                className={`${styles.decisionBtn} ${focusedIndex === 0 ? styles.defaultAction : ''}`}
                                onClick={() => handleAction('ACCEPTED')}
                                onMouseEnter={() => setFocusedIndex(0)}
                            >
                                <CheckCircle size={32} className={styles.passIcon} />
                                Pass
                            </button>
                            <button
                                className={`${styles.decisionBtn} ${focusedIndex === 1 ? styles.defaultAction : ''}`}
                                onClick={() => handleAction('REWORK')}
                                onMouseEnter={() => setFocusedIndex(1)}
                            >
                                <MessageSquare size={32} className={styles.reworkIcon} />
                                Rework
                            </button>
                            <button
                                className={`${styles.decisionBtn} ${focusedIndex === 2 ? styles.defaultAction : ''}`}
                                onClick={() => handleAction('DEBUG')}
                                onMouseEnter={() => setFocusedIndex(2)}
                            >
                                <AlertTriangle size={32} className={styles.debugIcon} />
                                Debug
                            </button>
                        </div>
                    ) : (
                        <div className={styles.inputGroup}>
                            <label className={styles.inputLabel}>
                                {repairMode ? 'Repair Remark (Mandatory) *' : (status === 'REWORK' ? 'Rework Details *' : 'Debug Reason *')}
                            </label>
                            <textarea
                                autoFocus
                                className={styles.textarea}
                                placeholder={repairMode ? "Enter repair steps taken..." : `Enter ${status} details...`}
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        if (text.trim()) {
                                            onFinalize(status, text.trim());
                                        }
                                    }
                                }}
                            />
                            <div className={styles.modalFooter}>
                                {!repairMode && <button className={styles.secondaryBtn} onClick={() => setMode('select')}>Back</button>}
                                <button
                                    className={styles.primaryBtn}
                                    onClick={() => onFinalize(status, text)}
                                    disabled={!text.trim()}
                                >
                                    {repairMode ? 'Complete & Pass' : 'Submit'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ScanDecisionModal;
