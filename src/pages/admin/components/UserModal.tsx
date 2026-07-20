import React, { useState, useEffect } from 'react';
import styles from '../AdminPanel.module.css';
import type { AdminUser, AdminDepartment } from '../services/adminService';

interface UserModalProps {
    isOpen: boolean;
    user: AdminUser | null; // null if creating
    departments: AdminDepartment[];
    onSave: (payload: any) => Promise<void>;
    onClose: () => void;
}

export const UserModal: React.FC<UserModalProps> = ({
    isOpen,
    user,
    departments,
    onSave,
    onClose
}) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [employeeCode, setEmployeeCode] = useState('');
    const [role, setRole] = useState('User');
    const [status, setStatus] = useState<'active' | 'inactive'>('active');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [selectedDeptIds, setSelectedDeptIds] = useState<number[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        if (user) {
            setName(user.name || '');
            setEmail(user.email || '');
            setEmployeeCode(user.employee_code || '');
            setRole(user.role || 'User');
            setStatus(user.status || 'active');
            setPassword('');
            setSelectedDeptIds(user.departments ? user.departments.map(d => d.id) : []);
        } else {
            setName('');
            setEmail('');
            setEmployeeCode('');
            setRole('User');
            setStatus('active');
            setPassword('');
            setSelectedDeptIds([]);
        }
        setErrorMsg('');
    }, [user, isOpen]);

    if (!isOpen) return null;

    const toggleDept = (deptId: number) => {
        if (selectedDeptIds.includes(deptId)) {
            setSelectedDeptIds(selectedDeptIds.filter(id => id !== deptId));
        } else {
            setSelectedDeptIds([...selectedDeptIds, deptId]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');

        if (!name.trim()) {
            setErrorMsg('Full Name is required');
            return;
        }
        if (!email.trim() || !email.includes('@')) {
            setErrorMsg('Valid Email address is required');
            return;
        }
        if (!user && !password.trim()) {
            setErrorMsg('Password is required for new users');
            return;
        }

        try {
            setSubmitting(true);
            await onSave({
                name: name.trim(),
                email: email.trim().toLowerCase(),
                employee_code: employeeCode.trim() || undefined,
                role,
                status,
                password: password.trim() || undefined,
                departmentIds: selectedDeptIds,
                updated_at: user?.updated_at
            });
            onClose();
        } catch (err: any) {
            setErrorMsg(err.message || 'Failed to save user');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalContent} style={{ maxWidth: '560px' }} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h3 className={styles.modalTitle}>
                        {user ? `✏️ Edit User: ${user.name}` : '➕ Add New User'}
                    </h3>
                    <button className={styles.closeBtn} onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className={styles.modalBody}>
                        {errorMsg && (
                            <div style={{ padding: '0.65rem 0.85rem', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                                ⚠️ {errorMsg}
                            </div>
                        )}

                        <div className={styles.formGrid}>
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>
                                    Full Name <span className={styles.reqStar}>*</span>
                                </label>
                                <input
                                    type="text"
                                    className={styles.formInput}
                                    placeholder="e.g. John Doe"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>
                                    Email Address <span className={styles.reqStar}>*</span>
                                </label>
                                <input
                                    type="email"
                                    className={styles.formInput}
                                    placeholder="e.g. john@sfcs.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>
                                    Employee Code <span style={{ fontSize: '0.75rem', color: '#6c757d' }}>(Manual Unique ID)</span>
                                </label>
                                <input
                                    type="text"
                                    className={styles.formInput}
                                    placeholder="e.g. EMP-1042"
                                    value={employeeCode}
                                    onChange={(e) => setEmployeeCode(e.target.value)}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>
                                    System Role <span className={styles.reqStar}>*</span>
                                </label>
                                <select
                                    className={styles.selectInput}
                                    style={{ width: '100%' }}
                                    value={role}
                                    onChange={(e) => setRole(e.target.value)}
                                >
                                    <option value="User">User</option>
                                    <option value="Operator">Operator</option>
                                    <option value="Supervisor">Supervisor</option>
                                    <option value="Manager">Manager</option>
                                    <option value="Admin">Admin</option>
                                    <option value="Super Admin">Super Admin</option>
                                </select>
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>
                                    Account Status
                                </label>
                                <select
                                    className={styles.selectInput}
                                    style={{ width: '100%' }}
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
                                >
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>
                                    Password {!user && <span className={styles.reqStar}>*</span>}
                                    {user && <span style={{ fontSize: '0.75rem', color: '#6c757d' }}> (Leave blank to keep unchanged)</span>}
                                </label>
                                <div className={styles.passInputWrapper}>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        className={styles.formInput}
                                        placeholder={user ? '••••••••' : 'Enter password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required={!user}
                                    />
                                    <button
                                        type="button"
                                        className={styles.eyeBtn}
                                        onClick={() => setShowPassword(!showPassword)}
                                        title={showPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showPassword ? '👁️' : '🙈'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {departments.length > 0 && (
                            <div className={styles.formGroup} style={{ marginTop: '0.75rem' }}>
                                <label className={styles.formLabel}>Assign to Departments</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.35rem' }}>
                                    {departments.map((dept) => {
                                        const isSelected = selectedDeptIds.includes(dept.id);
                                        return (
                                            <button
                                                type="button"
                                                key={dept.id}
                                                className={styles.pageBtn}
                                                style={{
                                                    backgroundColor: isSelected ? '#eff6ff' : 'var(--bg-paper)',
                                                    borderColor: isSelected ? '#3b82f6' : 'var(--border-color)',
                                                    color: isSelected ? '#1d4ed8' : 'var(--text-primary)',
                                                    fontWeight: isSelected ? 600 : 400
                                                }}
                                                onClick={() => toggleDept(dept.id)}
                                            >
                                                {isSelected ? '✓ ' : '+ '}{dept.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className={styles.modalFooter}>
                        <button type="button" className={styles.pageBtn} onClick={onClose} disabled={submitting}>
                            Cancel
                        </button>
                        <button type="submit" className={styles.primaryActionBtn} disabled={submitting}>
                            {submitting ? 'Saving...' : (user ? 'Save Changes' : 'Create User')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
