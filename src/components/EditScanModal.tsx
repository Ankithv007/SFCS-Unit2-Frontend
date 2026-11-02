import React, { useState } from 'react';
import { X, Save, ShieldAlert } from 'lucide-react';
import { apiFetch } from '../utils/api';
import { useToast } from './Toast';
import styles from './EditScanModal.module.css';

interface EditScanModalProps {
    scanId: string | number;
    initialBarcode: string;
    initialUnitSerialNo: string;
    onClose: () => void;
    onSaveSuccess: () => void;
    hideUnitSerial?: boolean;
}

const EditScanModal: React.FC<EditScanModalProps> = ({
    scanId,
    initialBarcode,
    initialUnitSerialNo,
    onClose,
    onSaveSuccess,
    hideUnitSerial = false
}) => {
    const { showToast } = useToast();
    const [barcode, setBarcode] = useState(initialBarcode);
    const [unitSerialNo, setUnitSerialNo] = useState(initialUnitSerialNo || '');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!barcode.trim()) {
            showToast('Barcode cannot be empty', 'error');
            return;
        }

        const finalUnitSerialNo = hideUnitSerial ? (initialUnitSerialNo || '') : unitSerialNo.trim();

        if (!hideUnitSerial && !finalUnitSerialNo) {
            showToast('Unit Serial Number cannot be empty', 'error');
            return;
        }

        setLoading(true);
        try {
            await apiFetch(`/api/backend/scans/${scanId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    barcode: barcode.trim(),
                    unit_serial_no: finalUnitSerialNo
                })
            });
            showToast('Scan record updated successfully', 'success');
            onSaveSuccess();
            onClose();
        } catch (err: any) {
            showToast(err.message || 'Failed to update scan record', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
                <div className={styles.modalHeader}>
                    <h3>✏️ Edit Scan Record</h3>
                    <button className={styles.closeBtn} onClick={onClose} disabled={loading} type="button">
                        <X size={20} />
                     </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className={styles.modalBody}>
                        <div className={styles.adminWarning}>
                            <ShieldAlert size={18} className={styles.warningIcon} />
                            <span>This action requires Administrator privileges. Changes will be audited.</span>
                        </div>
                        
                        <div className={styles.inputGroup}>
                            <label className={styles.inputLabel}>Barcode</label>
                            <input
                                type="text"
                                className={styles.textInput}
                                value={barcode}
                                onChange={(e) => setBarcode(e.target.value)}
                                disabled={loading}
                                autoFocus
                                required
                            />
                        </div>

                        {!hideUnitSerial && (
                            <div className={styles.inputGroup} style={{ marginTop: '1.25rem' }}>
                                <label className={styles.inputLabel}>Unit Serial Number</label>
                                <input
                                    type="text"
                                    className={styles.textInput}
                                    value={unitSerialNo}
                                    onChange={(e) => setUnitSerialNo(e.target.value)}
                                    disabled={loading}
                                    required
                                />
                            </div>
                        )}
                    </div>
                    <div className={styles.modalFooter}>
                        <button type="button" className={styles.secondaryBtn} onClick={onClose} disabled={loading}>
                            Cancel
                        </button>
                        <button type="submit" className={styles.primaryBtn} disabled={loading}>
                            {loading ? 'Saving...' : <><Save size={16} style={{ marginRight: '0.5rem' }} /> Save Changes</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditScanModal;
