import React, { useState, useEffect } from 'react';
import styles from './ShiftManagement.module.css';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../hooks/useAuth';
import { apiFetch } from '../../utils/api';

interface Shift {
    id: number;
    name: string;
    start_time: string;
    end_time: string;
    status: string;
}

interface ShiftManagementProps {
    isOpen?: boolean;
    onClose?: () => void;
    onUpdate?: () => void;
    isStandalone?: boolean;
}

export const ShiftManagement: React.FC<ShiftManagementProps> = ({ isOpen = true, onClose, onUpdate, isStandalone = false }) => {
    const { showToast } = useToast();
    const { user } = useAuth();
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [editingShift, setEditingShift] = useState<Shift | null>(null);
    const [formData, setFormData] = useState({ name: '', start_time: '', end_time: '', status: 'active' });

    useEffect(() => {
        console.log('ShiftManagement component mounted. isStandalone:', isStandalone, 'isOpen:', isOpen);
    }, []);

    useEffect(() => {
        if (isOpen || isStandalone) {
            fetchShifts();
        }
    }, [isOpen, isStandalone]);

    const fetchShifts = async () => {
        try {
            const data = await apiFetch('/api/qc/shifts');
            setShifts(data);
        } catch (error) {
            console.error('Error fetching shifts:', error);
            showToast('Failed to load shifts', 'error');
        }
    };

    const handleEdit = (shift: Shift) => {
        setEditingShift(shift);
        setFormData({
            name: shift.name,
            start_time: shift.start_time,
            end_time: shift.end_time,
            status: shift.status
        });
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Are you sure you want to delete this shift?')) return;

        try {
            await apiFetch(`/api/qc/shifts/${id}`, {
                method: 'DELETE'
            });

            showToast('Shift deleted successfully', 'success');
            fetchShifts();
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Error deleting shift:', error);
            showToast('Network error', 'error');
        }
    };

    const handleSave = async () => {
        console.log('Saving shift:', formData);
        if (!formData.name || !formData.start_time || !formData.end_time) {
            return showToast('Please fill all fields', 'error');
        }

        try {
            const url = editingShift
                ? `/api/qc/shifts/${editingShift.id}`
                : '/api/qc/shifts';

            const method = editingShift ? 'PUT' : 'POST';

            await apiFetch(url, {
                method,
                body: JSON.stringify({ ...formData, created_by: user?.name || 'Admin' })
            });

            showToast(`Shift ${editingShift ? 'updated' : 'created'} successfully`, 'success');
            fetchShifts();
            setEditingShift(null);
            setFormData({ name: '', start_time: '', end_time: '', status: 'active' });
            if (onUpdate) onUpdate();
        } catch (error: any) {
            console.error('Error saving shift:', error);
            showToast('Failed to save shift: ' + (error.message || 'Unknown error'), 'error');
        }
    };

    if (!isOpen && !isStandalone) return null;

    const content = (
        <div className={isStandalone ? styles.standaloneContent : styles.content}>
            <div className={styles.form}>
                <h3>{editingShift ? 'Edit Shift' : 'Create New Shift'}</h3>
                <div className={styles.formGroup}>
                    <input
                        type="text"
                        placeholder="Shift Name (e.g. Shift A)"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        className={styles.input}
                    />
                    <input
                        type="time"
                        value={formData.start_time}
                        onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                        className={styles.input}
                    />
                    <input
                        type="time"
                        value={formData.end_time}
                        onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                        className={styles.input}
                    />
                    <select
                        value={formData.status}
                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                        className={styles.select}
                    >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                    <button onClick={handleSave} className={styles.saveBtn}>
                        {editingShift ? 'Update' : 'Create'}
                    </button>
                    {editingShift && (
                        <button
                            onClick={() => {
                                setEditingShift(null);
                                setFormData({ name: '', start_time: '', end_time: '', status: 'active' });
                            }}
                            className={styles.cancelBtn}
                        >
                            Cancel Edit
                        </button>
                    )}
                </div>
            </div>

            <div className={styles.list}>
                <h3>Existing Shifts</h3>
                <div style={{ overflowX: 'auto' }}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Start</th>
                                <th>End</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {shifts.map(shift => (
                                <tr key={shift.id}>
                                    <td>{shift.name}</td>
                                    <td>{shift.start_time}</td>
                                    <td>{shift.end_time}</td>
                                    <td>
                                        <span className={shift.status === 'active' ? styles.active : styles.inactive}>
                                            {shift.status}
                                        </span>
                                    </td>
                                    <td>
                                        <button onClick={() => handleEdit(shift)} className={styles.editBtn}>Edit</button>
                                        <button
                                            onClick={() => handleDelete(shift.id)}
                                            className={styles.deleteBtn}
                                            style={{ marginLeft: '0.5rem', background: '#ef4444', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    if (isStandalone) {
        return (
            <div className={styles.standaloneContainer}>
                <div className={styles.header}>
                    <h2>Manage Shifts</h2>
                    {onClose && <button onClick={onClose} className={styles.closeBtn}>&times;</button>}
                </div>
                {content}
            </div>
        );
    }

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h2>Manage Shifts</h2>
                    {onClose && <button onClick={onClose} className={styles.closeBtn}>&times;</button>}
                </div>
                {content}
            </div>
        </div>
    );
};

