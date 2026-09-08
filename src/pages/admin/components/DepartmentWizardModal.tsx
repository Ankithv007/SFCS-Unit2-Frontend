import React, { useState, useEffect } from 'react';
import styles from '../AdminPanel.module.css';
import type { AdminDepartment, AdminUser, PermissionItem } from '../services/adminService';

interface DepartmentWizardModalProps {
    isOpen: boolean;
    department: AdminDepartment | null;
    allUsers: AdminUser[];
    systemPages: any[];
    onSave: (payload: any) => Promise<void>;
    onClose: () => void;
    initialStep?: 1 | 2 | 3;
}

export const DepartmentWizardModal: React.FC<DepartmentWizardModalProps> = ({
    isOpen,
    department,
    allUsers,
    systemPages,
    onSave,
    onClose,
    initialStep
}) => {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
    const [permissions, setPermissions] = useState<Record<number, PermissionItem>>({});
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [userSearch, setUserSearch] = useState('');
    const [pageSearch, setPageSearch] = useState('');

    useEffect(() => {
        if (department) {
            setName(department.name || '');
            setDescription(department.description || '');
            setSelectedUserIds(department.users ? department.users.map(u => u.user_id) : []);

            // Map existing permissions or defaults dynamically
            const pMap: Record<number, PermissionItem> = {};
            systemPages.forEach((sp) => {
                const existing = department.permissions?.find(
                    p => p.system_page_id === sp.id || p.permission_key === sp.permission_key
                );
                pMap[sp.id] = {
                    id: existing?.id,
                    system_page_id: sp.id,
                    module: sp.module_name,
                    page: sp.route_path,
                    permission_key: sp.permission_key,
                    can_view: existing ? existing.can_view : false,
                    can_create: existing ? existing.can_create : false,
                    can_edit: existing ? existing.can_edit : false,
                    can_delete: existing ? existing.can_delete : false,
                    can_export: existing ? existing.can_export : false
                };
            });
            setPermissions(pMap);
        } else {
            setName('');
            setDescription('');
            setSelectedUserIds([]);
            const pMap: Record<number, PermissionItem> = {};
            systemPages.forEach((sp) => {
                pMap[sp.id] = {
                    system_page_id: sp.id,
                    module: sp.module_name,
                    page: sp.route_path,
                    permission_key: sp.permission_key,
                    can_view: false,
                    can_create: false,
                    can_edit: false,
                    can_delete: false,
                    can_export: false
                };
            });
            setPermissions(pMap);
        }
        setStep(initialStep || 1);
        setErrorMsg('');
        setPageSearch('');
    }, [department, isOpen, initialStep, systemPages]);

    if (!isOpen) return null;

    const togglePermission = (systemPageId: number, field: 'can_view' | 'can_create' | 'can_edit' | 'can_delete' | 'can_export') => {
        setPermissions(prev => ({
            ...prev,
            [systemPageId]: {
                ...prev[systemPageId],
                [field]: !prev[systemPageId]?.[field]
            }
        }));
    };

    const toggleUser = (userId: number) => {
        if (selectedUserIds.includes(userId)) {
            setSelectedUserIds(selectedUserIds.filter(id => id !== userId));
        } else {
            setSelectedUserIds([...selectedUserIds, userId]);
        }
    };

    const handleNext = () => {
        if (step === 1 && !name.trim()) {
            setErrorMsg('Department Name is required');
            return;
        }
        setErrorMsg('');
        setStep((step + 1) as 2 | 3);
    };

    const handlePrev = () => {
        setErrorMsg('');
        setStep((step - 1) as 1 | 2);
    };

    const handleSubmit = async () => {
        setErrorMsg('');
        try {
            setSubmitting(true);
            const permArray = Object.values(permissions).filter(
                p => p.can_view || p.can_create || p.can_edit || p.can_delete || p.can_export
            );
            await onSave({
                name: name.trim(),
                description: description.trim(),
                userIds: selectedUserIds,
                permissions: permArray,
                updated_at: department?.updated_at
            });
            onClose();
        } catch (err: any) {
            setErrorMsg(err.message || 'Failed to save department');
        } finally {
            setSubmitting(false);
        }
    };

    const filteredUsers = allUsers.filter(u => 
        String(u?.name ?? '').toLowerCase().includes(String(userSearch ?? '').toLowerCase()) || 
        String(u?.email ?? '').toLowerCase().includes(String(userSearch ?? '').toLowerCase()) ||
        String(u?.employee_code ?? '').toLowerCase().includes(String(userSearch ?? '').toLowerCase())
    );

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalContent} style={{ maxWidth: '820px' }} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <div>
                        <h3 className={styles.modalTitle}>
                            {department ? `✏️ Edit Department: ${department.name}` : '📁 Create New Department'}
                        </h3>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                            Step {step} of 3 — {step === 1 ? 'Department Details' : step === 2 ? 'Permission Matrix' : 'Assign Members'}
                        </div>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>&times;</button>
                </div>

                <div className={styles.modalBody}>
                    {errorMsg && (
                        <div style={{ padding: '0.65rem 0.85rem', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                            ⚠️ {errorMsg}
                        </div>
                    )}

                    {/* Step 1: Department Info */}
                    {step === 1 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>
                                    Department Name <span className={styles.reqStar}>*</span>
                                </label>
                                <input
                                    type="text"
                                    className={styles.formInput}
                                    placeholder="e.g. SMT Line Operators, Quality Control, Store Inventory"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>Description</label>
                                <textarea
                                    className={styles.formInput}
                                    rows={4}
                                    placeholder="Enter a brief summary of team responsibilities..."
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    {/* Step 2: Permission Matrix */}
                    {step === 2 && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    Grant granular permissions for each system module. Check appropriate boxes:
                                </div>
                                <input
                                    type="text"
                                    className={styles.formInput}
                                    style={{ width: '220px', padding: '0.35rem 0.65rem' }}
                                    placeholder="Search pages..."
                                    value={pageSearch}
                                    onChange={(e) => setPageSearch(e.target.value)}
                                />
                            </div>
                            <div className={styles.tableContainer} style={{ maxHeight: '380px' }}>
                                <table className={styles.dataTable}>
                                    <thead>
                                        <tr>
                                            <th>Module / Page</th>
                                            <th style={{ textAlign: 'center' }}>View</th>
                                            <th style={{ textAlign: 'center' }}>Create</th>
                                            <th style={{ textAlign: 'center' }}>Edit</th>
                                            <th style={{ textAlign: 'center' }}>Delete</th>
                                            <th style={{ textAlign: 'center' }}>Export</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {systemPages.filter((sp) => 
                                            String(sp?.route_path ?? '').toLowerCase().includes(String(pageSearch ?? '').toLowerCase()) ||
                                            String(sp?.module_name ?? '').toLowerCase().includes(String(pageSearch ?? '').toLowerCase()) ||
                                            String(sp?.page_name ?? '').toLowerCase().includes(String(pageSearch ?? '').toLowerCase())
                                        ).map((sp) => {
                                            const perm = permissions[sp.id] || {
                                                system_page_id: sp.id,
                                                module: sp.module_name,
                                                page: sp.route_path,
                                                permission_key: sp.permission_key,
                                                can_view: false,
                                                can_create: false,
                                                can_edit: false,
                                                can_delete: false,
                                                can_export: false
                                            };
                                            return (
                                                <tr key={sp.id}>
                                                    <td>
                                                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{sp.page_name}</div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                            {sp.module_name} &bull; <code style={{ fontSize: '0.7rem', color: 'var(--accent)' }}>{sp.permission_key}</code>
                                                        </div>
                                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{sp.route_path}</div>
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <input type="checkbox" className={styles.checkbox} checked={perm.can_view} onChange={() => togglePermission(sp.id, 'can_view')} />
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <input type="checkbox" className={styles.checkbox} checked={perm.can_create} onChange={() => togglePermission(sp.id, 'can_create')} />
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <input type="checkbox" className={styles.checkbox} checked={perm.can_edit} onChange={() => togglePermission(sp.id, 'can_edit')} />
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <input type="checkbox" className={styles.checkbox} checked={perm.can_delete} onChange={() => togglePermission(sp.id, 'can_delete')} />
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <input type="checkbox" className={styles.checkbox} checked={perm.can_export} onChange={() => togglePermission(sp.id, 'can_export')} />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Member Users Assignment */}
                    {step === 3 && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    Select users to assign to <strong>{name || 'Department'}</strong> ({selectedUserIds.length} selected):
                                </div>
                                <input
                                    type="text"
                                    className={styles.formInput}
                                    style={{ width: '220px', padding: '0.35rem 0.65rem' }}
                                    placeholder="Search users..."
                                    value={userSearch}
                                    onChange={(e) => setUserSearch(e.target.value)}
                                />
                            </div>

                            <div className={styles.tableContainer} style={{ maxHeight: '340px' }}>
                                <table className={styles.dataTable}>
                                    <thead>
                                        <tr>
                                            <th style={{ width: '40px' }}>Select</th>
                                            <th>Employee</th>
                                            <th>Email</th>
                                            <th>Role</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredUsers.map((user) => {
                                            const isSelected = selectedUserIds.includes(user.id);
                                            return (
                                                <tr key={user.id} onClick={() => toggleUser(user.id)} style={{ cursor: 'pointer' }}>
                                                    <td>
                                                        <input
                                                            type="checkbox"
                                                            className={styles.checkbox}
                                                            checked={isSelected}
                                                            onChange={() => {}}
                                                        />
                                                    </td>
                                                    <td>
                                                        <div style={{ fontWeight: 600 }}>{user.name}</div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{user.employee_code || 'No Code'}</div>
                                                    </td>
                                                    <td>{user.email}</td>
                                                    <td>
                                                        <span className={`${styles.badge} ${styles.roleUser}`}>{user.role}</span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                <div className={styles.modalFooter}>
                    {step > 1 && (
                        <button type="button" className={styles.pageBtn} onClick={handlePrev} disabled={submitting}>
                            ← Previous
                        </button>
                    )}
                    <div style={{ flex: 1 }} />
                    <button type="button" className={styles.pageBtn} onClick={onClose} disabled={submitting}>
                        Cancel
                    </button>
                    {step < 3 ? (
                        <button type="button" className={styles.primaryActionBtn} onClick={handleNext}>
                            Next →
                        </button>
                    ) : (
                        <button type="button" className={styles.primaryActionBtn} onClick={handleSubmit} disabled={submitting}>
                            {submitting ? 'Saving...' : (department ? 'Save Department' : 'Create Department')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
