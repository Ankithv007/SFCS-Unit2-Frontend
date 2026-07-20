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

// Keep track of plain text passwords set during the session since they are hashed in the DB
export const sessionPasswords: Record<number, string> = {};

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
            setPassword(sessionPasswords[user.id] || '');
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
        if (email.trim() && !email.includes('@')) {
            setErrorMsg('Valid Email address is required');
            return;
        }
        if (!employeeCode.trim()) {
            setErrorMsg('Employee Code is required');
            return;
        }
        if (!user && !password.trim()) {
            setErrorMsg('Password is required for new users');
            return;
        }

        try {
            setSubmitting(true);
            const plainPassword = password.trim();
            await onSave({
                name: name.trim(),
                email: email.trim() ? email.trim().toLowerCase() : undefined,
                employee_code: employeeCode.trim(),
                role,
                status,
                password: plainPassword || undefined,
                departmentIds: selectedDeptIds,
                updated_at: user?.updated_at
            });
            if (user && plainPassword) {
                sessionPasswords[user.id] = plainPassword;
            }
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
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    className={styles.formInput}
                                    placeholder="e.g. john@sfcs.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>
                                    Employee Code <span className={styles.reqStar}>*</span>
                                </label>
                                <input
                                    type="text"
                                    className={styles.formInput}
                                    placeholder="e.g. EMP-1042"
                                    value={employeeCode}
                                    onChange={(e) => setEmployeeCode(e.target.value)}
                                    required
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
                                        {showPassword ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '20px', height: '20px' }}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '20px', height: '20px' }}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                                            </svg>
                                        )}
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
