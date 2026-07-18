import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiFetch } from '../../utils/api';
import styles from './AdminPanel.module.css';
import { useAuth } from '../../hooks/useAuth';
import type { User } from '../../hooks/useAuth';
import { useToast } from '../../components/Toast';

interface UserWithRole extends User {
    role: string;
    created_at: string;
    status: string;
    employeeCode?: string;
    isCustom?: boolean;
}

interface Department {
    id: string;
    name: string;
    pages: string[];
    users: { id?: string; name?: string; email: string; employeeCode?: string }[];
    createdAt?: string;
}


const POSITIONS = ['Admin', 'Manager', 'User', 'Operator'];

const SYSTEM_PAGES = [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Admin Panel', path: '/admin-panel' },
    { name: 'QC Inspection', path: '/qc-inspection' },
    { name: 'Shift Management', path: '/qc-inspection/shifts' },
    { name: 'Purchase Order', path: '/purchase-order' },
    { name: 'WIP Stack', path: '/wip-stack' },
    { name: 'Return WIP', path: '/return-wip' },
    { name: 'Report', path: '/report' },
    { name: 'Warehouse', path: '/pre-testing/warehouse' },
    { name: 'IQC', path: '/pre-testing/iqc' },
    { name: 'Impedance', path: '/pre-testing/impedance' },
    { name: 'Pre Calibration', path: '/pre-testing/calibration' },
    { name: 'Pre ACLR', path: '/pre-testing/pre-aclr' },
    { name: 'Trace', path: '/pre-testing/trace' },
    { name: 'Vacuum Leak Test', path: '/vacuum-leak-test' },
    { name: 'Backend Work Order', path: '/backend/work-order' },
    { name: 'Backend PTH', path: '/backend/pth' },
    { name: 'Backend VI', path: '/backend/vi' },
    { name: 'Backend QA', path: '/backend/qa' },
    { name: 'Backend Flashing', path: '/backend/flashing' },
    { name: 'Backend PCBA FCT', path: '/backend/pcba-fct' },
    { name: 'Backend Assembly', path: '/backend/assembly' },
    { name: 'Backend Unit Testing', path: '/backend/unit-testing' },
    { name: 'Backend QI', path: '/backend/qi' },
    { name: 'Backend Packing', path: '/backend/packing' },
    { name: 'Backend Rework', path: '/backend/rework' },
    { name: 'Backend Debug', path: '/backend/debug' },
    { name: 'Backend Track Items', path: '/backend/track-items' },
    { name: 'SMT Work Order', path: '/smt/work-order' },
    { name: 'SMT Work Order History', path: '/smt/workorder-history' },
    { name: 'SMT Serial Number', path: '/smt/serial-number' },
    { name: 'SMT Printing', path: '/smt/printing' },
    { name: 'SMT Solder Paste', path: '/smt/solder-paste' },
    { name: 'SMT Pre-AOI', path: '/smt/pre-aoi' },
    { name: 'SMT Post-AOI', path: '/smt/post-aoi' },
    { name: 'SMT Rework', path: '/smt/rework' },
    { name: 'SMT FG', path: '/smt/smt-fg' },
    { name: 'SMT Track Items', path: '/smt/track-items' },
    { name: 'SMT Downtime Tracker', path: '/smt/downtime-tracker' },
    { name: 'SMT QMS', path: '/smt/qms' },
    { name: 'SMT Material Management', path: '/smt/material-management' },
    { name: 'SMT MSD Tracker', path: '/smt/msd-tracker' },
    { name: 'SMT Stencil Master', path: '/smt/stencil/master' },
    { name: 'SMT Stencil Lifecycle', path: '/smt/stencil/lifecycle' },
    { name: 'SMT Baking Tracking', path: '/smt/baking-tracking' }
];

export const AdminPanel: React.FC = () => {
    const { user: currentUser } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const currentUserRole = currentUser?.role;

    const [users, setUsers] = useState<UserWithRole[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);
    const { showToast } = useToast();

    // Modals
    const [showUserModal, setShowUserModal] = useState(false);
    const [showDeptModal, setShowDeptModal] = useState(false);
    const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    // Edit/View/Update Department States
    const [showEditDeptModal, setShowEditDeptModal] = useState(false);
    const [showAddUsersModal, setShowAddUsersModal] = useState(false);
    const [showAddPagesModal, setShowAddPagesModal] = useState(false);
    const [showViewDeptModal, setShowViewDeptModal] = useState(false);
    const [editingDept, setEditingDept] = useState<Department | null>(null);
    const [editDeptName, setEditDeptName] = useState('');
    const [editSelectedPages, setEditSelectedPages] = useState<string[]>([]);
    const [editSelectedUsers, setEditSelectedUsers] = useState<{ id?: string; name?: string; email: string; employeeCode?: string }[]>([]);
    const [editPageSearch, setEditPageSearch] = useState('');
    const [editUserSearch, setEditUserSearch] = useState('');

    // Form fields - User
    const [userName, setUserName] = useState('');
    const [userEmail, setUserEmail] = useState('');
    const [employeeCode, setEmployeeCode] = useState('');
    const [password, setPassword] = useState('');
    const [position, setPosition] = useState('User');
    const [status, setStatus] = useState('Active');

    // Form fields - Department Wizard
    const [deptStep, setDeptStep] = useState(1);
    const [deptName, setDeptName] = useState('');
    const [selectedPages, setSelectedPages] = useState<string[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<{ id?: string; name?: string; email: string; employeeCode?: string }[]>([]);
    const [pageSearch, setPageSearch] = useState('');
    const [userSearch, setUserSearch] = useState('');

    useEffect(() => {
        fetchUsers();
        loadDepartments();
    }, []);

    useEffect(() => {
        if (!currentUser) return;
        
        const role = currentUser.role;
        const path = location.pathname.toLowerCase();
        
        if (role === 'User' || role === 'Operator') {
            if (path.endsWith('/create-user') || path.endsWith('/create-department')) {
                showToast("⚠️ You don't have permission to access this page.", 'error');
                navigate('/dashboard', { replace: true });
            }
        } else {
            // Super Admin, Admin, Manager
            if (path.endsWith('/create-user')) {
                setShowUserModal(true);
            } else if (path.endsWith('/create-department')) {
                setShowDeptModal(true);
            }
        }
    }, [currentUser, location.pathname, navigate, showToast]);

    const handleOpenUserModal = () => {
        if (currentUserRole === 'User' || currentUserRole === 'Operator') {
            showToast("⚠️ You don't have permission to access this page.", 'error');
            navigate('/dashboard', { replace: true });
            return;
        }
        setShowUserModal(true);
    };

    const handleOpenDeptModal = () => {
        if (currentUserRole === 'User' || currentUserRole === 'Operator') {
            showToast("⚠️ You don't have permission to access this page.", 'error');
            navigate('/dashboard', { replace: true });
            return;
        }
        setShowDeptModal(true);
    };

    const isFetching = React.useRef(false);

    const fetchUsers = async () => {
        if (isFetching.current) return;
        isFetching.current = true;

        try {
            const data = await apiFetch('/api/auth/admin/users');
            
            // Get custom users
            const stored = localStorage.getItem('custom_users');
            const customUsers: any[] = stored ? JSON.parse(stored) : [];
            let cleaned = false;
            const cleanedCustomUsers = customUsers.map(cu => {
                if (cu.email && cu.email.toLowerCase().endsWith('@sfcs.local')) {
                    cleaned = true;
                    return { ...cu, email: '' };
                }
                return cu;
            });
            if (cleaned) {
                localStorage.setItem('custom_users', JSON.stringify(cleanedCustomUsers));
            }

            const formattedCustom: UserWithRole[] = cleanedCustomUsers.map(cu => ({
                id: cu.id || cu.employeeCode || cu.email || Date.now().toString(),
                name: cu.name,
                email: cu.email || '',
                role: cu.position,
                status: cu.status,
                employeeCode: cu.employeeCode,
                created_at: new Date().toISOString(),
                isCustom: true
            }));

            // Merge backend and custom users (custom overrides backend if same email or employee code)
            const merged = [...data];
            formattedCustom.forEach(cu => {
                const idx = merged.findIndex(u => {
                    const cuEmail = cu.email ? cu.email.toLowerCase() : '';
                    const uEmail = u.email ? u.email.toLowerCase() : '';
                    if (cuEmail && uEmail) {
                        return cuEmail === uEmail;
                    }
                    return u.employeeCode && cu.employeeCode && u.employeeCode.toLowerCase() === cu.employeeCode.toLowerCase();
                });
                if (idx !== -1) {
                    merged[idx] = { ...merged[idx], ...cu };
                } else {
                    merged.push(cu);
                }
            });

            setUsers(merged);
        } catch (error: any) {
            console.error('Error fetching users:', error);
            showToast(error.message || 'Failed to fetch users', 'error');
        } finally {
            setLoading(false);
            isFetching.current = false;
        }
    };

    const loadDepartments = () => {
        const stored = localStorage.getItem('departments');
        if (stored) {
            setDepartments(JSON.parse(stored));
        }
    };



    const getRoleBadgeClass = (role: string) => {
        switch (role) {
            case 'Super Admin': return styles.badgeAdmin;
            case 'Admin': return styles.badgeAdmin;
            case 'Manager': return styles.badgeManager;
            case 'Supervisor': return styles.badgeSupervisor;
            case 'Operator': return styles.badgeOperator;
            default: return styles.badgeUser;
        }
    };

    // User Create / Edit Submission
    const handleSaveUser = (e: React.FormEvent) => {
        e.preventDefault();

        if (!userName.trim() || !employeeCode.trim()) {
            showToast('Please fill in all required fields.', 'error');
            return;
        }

        const enteredEmail = userEmail.trim();

        const stored = localStorage.getItem('custom_users');
        const customUsers: any[] = stored ? JSON.parse(stored) : [];

        if (editingUser) {
            // Edit mode
            // Check if the edited email or employee code already exists under another user
            if (enteredEmail) {
                const emailLower = enteredEmail.toLowerCase();
                const originalEmailLower = editingUser.email ? editingUser.email.toLowerCase() : '';
                if (emailLower !== originalEmailLower) {
                    const emailExists = customUsers.some(u => u.email && u.email.toLowerCase() === emailLower) || 
                                        users.some(u => u.email && u.email.toLowerCase() === emailLower && u.email.toLowerCase() !== originalEmailLower);
                    if (emailExists) {
                        showToast('A user with this email already exists.', 'error');
                        return;
                    }
                }
            }

            const codeLower = employeeCode.trim().toLowerCase();
            const originalCodeLower = editingUser.employeeCode ? editingUser.employeeCode.toLowerCase() : '';
            if (codeLower !== originalCodeLower) {
                const codeExists = customUsers.some(u => u.employeeCode && u.employeeCode.toLowerCase() === codeLower) ||
                                   users.some(u => u.employeeCode && u.employeeCode.toLowerCase() === codeLower && u.employeeCode.toLowerCase() !== originalCodeLower);
                if (codeExists) {
                    showToast('A user with this employee code already exists.', 'error');
                    return;
                }
            }

            if (editingUser.isCustom) {
                const updated = customUsers.map(u => {
                    const uId = u.id || u.employeeCode || u.email;
                    const editingId = editingUser.id || editingUser.employeeCode || editingUser.email;
                    if (uId && editingId && uId.toLowerCase() === editingId.toLowerCase()) {
                        return {
                            ...u,
                            name: userName.trim(),
                            email: enteredEmail,
                            employeeCode: employeeCode.trim(),
                            password: password || u.password,
                            position,
                            status
                        };
                    }
                    return u;
                });
                localStorage.setItem('custom_users', JSON.stringify(updated));
            } else {
                // Override backend user
                const updatedUsers = customUsers.filter(u => {
                    const uId = u.id || u.employeeCode || u.email;
                    const editingId = editingUser.id || editingUser.employeeCode || editingUser.email;
                    return !(uId && editingId && uId.toLowerCase() === editingId.toLowerCase());
                });
                updatedUsers.push({
                    id: editingUser.id,
                    name: userName.trim(),
                    email: enteredEmail,
                    employeeCode: employeeCode.trim(),
                    password: password || '123456',
                    position,
                    status
                });
                localStorage.setItem('custom_users', JSON.stringify(updatedUsers));
            }
            showToast('User updated successfully', 'success');
        } else {
            // Create mode
            if (enteredEmail) {
                const emailLower = enteredEmail.toLowerCase();
                if (customUsers.some(u => u.email && u.email.toLowerCase() === emailLower) || users.some(u => u.email && u.email.toLowerCase() === emailLower)) {
                    showToast('User with this email already exists.', 'error');
                    return;
                }
            }

            const codeLower = employeeCode.trim().toLowerCase();
            if (customUsers.some(u => u.employeeCode && u.employeeCode.toLowerCase() === codeLower) || users.some(u => u.employeeCode && u.employeeCode.toLowerCase() === codeLower)) {
                showToast('User with this employee code already exists.', 'error');
                return;
            }

            const newUser = {
                id: Date.now().toString(),
                name: userName.trim(),
                email: enteredEmail,
                employeeCode: employeeCode.trim(),
                password: password || '123456',
                position,
                status
            };
            customUsers.push(newUser);
            localStorage.setItem('custom_users', JSON.stringify(customUsers));
            showToast('User created successfully', 'success');
        }

        resetUserForm();
        fetchUsers();
    };

    const handleEditClick = (user: UserWithRole) => {
        if (user.isCustom) {
            // Custom user: load full details from localStorage
            const stored = localStorage.getItem('custom_users');
            const customUsers: any[] = stored ? JSON.parse(stored) : [];
            const detail = customUsers.find(u => {
                const uId = u.id || u.employeeCode || u.email;
                const userId = user.id || user.employeeCode || user.email;
                return uId && userId && uId.toLowerCase() === userId.toLowerCase();
            });
            if (detail) {
                setEditingUser(user);
                setUserName(detail.name || '');
                setUserEmail(detail.email || '');
                setEmployeeCode(detail.employeeCode || '');
                setPassword('');
                setPosition(detail.position || 'User');
                setStatus(detail.status || 'Active');
                setShowUserModal(true);
            }
        } else {
            // Backend user: pre-fill from displayed data (read-only for non-custom fields)
            setEditingUser(user);
            setUserName(user.name || '');
            setUserEmail(user.email || '');
            setEmployeeCode(user.employeeCode || '');
            setPassword('');
            setPosition(user.role || 'User');
            setStatus(user.status || 'Active');
            setShowUserModal(true);
        }
    };

    const resetUserForm = () => {
        setEditingUser(null);
        setUserName('');
        setUserEmail('');
        setEmployeeCode('');
        setPassword('');
        setPosition('User');
        setStatus('Active');
        setShowUserModal(false);
        if (location.pathname.toLowerCase().endsWith('/create-user')) {
            navigate('/admin-panel', { replace: true });
        }
    };

    // Department Create Submission
    const handleSaveDepartment = () => {
        if (!deptName.trim()) {
            showToast('Department Name is required.', 'error');
            return;
        }

        const stored = localStorage.getItem('departments');
        const depts: Department[] = stored ? JSON.parse(stored) : [];

        const formatDeptDate = (date: Date) => {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const day = String(date.getDate()).padStart(2, '0');
            const month = months[date.getMonth()];
            const year = date.getFullYear();
            return `${day}-${month}-${year}`;
        };

        const newDept: Department = {
            id: Date.now().toString(),
            name: deptName.trim(),
            pages: selectedPages,
            users: selectedUsers,
            createdAt: formatDeptDate(new Date())
        };

        depts.push(newDept);
        localStorage.setItem('departments', JSON.stringify(depts));
        showToast('Department created successfully', 'success');

        resetDeptForm();
        loadDepartments();
    };

    const handleDeleteDept = (id: string) => {
        if (!window.confirm('Are you sure you want to delete this department?')) return;
        const stored = localStorage.getItem('departments');
        const depts: Department[] = stored ? JSON.parse(stored) : [];
        const filtered = depts.filter(d => d.id !== id);
        localStorage.setItem('departments', JSON.stringify(filtered));
        showToast('Department deleted successfully', 'success');
        loadDepartments();
    };

    const resetDeptForm = () => {
        setDeptStep(1);
        setDeptName('');
        setSelectedPages([]);
        setSelectedUsers([]);
        setPageSearch('');
        setUserSearch('');
        setShowDeptModal(false);
        if (location.pathname.toLowerCase().endsWith('/create-department')) {
            navigate('/admin-panel', { replace: true });
        }
    };

    const handleViewDeptClick = (dept: Department) => {
        setEditingDept(dept);
        setShowViewDeptModal(true);
    };




    const handleUpdateDepartment = () => {
        if (!editDeptName.trim()) {
            showToast('Department Name is required.', 'error');
            return;
        }

        const stored = localStorage.getItem('departments');
        const depts: Department[] = stored ? JSON.parse(stored) : [];

        const updated = depts.map(d => {
            if (d.id === editingDept?.id) {
                return {
                    ...d,
                    name: editDeptName.trim(),
                    pages: editSelectedPages,
                    users: editSelectedUsers
                };
            }
            return d;
        });

        localStorage.setItem('departments', JSON.stringify(updated));
        showToast('Department updated successfully', 'success');
        setShowEditDeptModal(false);
        setEditingDept(null);
        loadDepartments();
    };

    const handleAddUsersClick = (dept: Department) => {
        setEditingDept(dept);
        setEditSelectedUsers(dept.users);
        setEditUserSearch('');
        setShowAddUsersModal(true);
    };

    const handleSaveDeptUsers = () => {
        const stored = localStorage.getItem('departments');
        const depts: Department[] = stored ? JSON.parse(stored) : [];

        const updated = depts.map(d => {
            if (d.id === editingDept?.id) {
                return {
                    ...d,
                    users: editSelectedUsers
                };
            }
            return d;
        });

        localStorage.setItem('departments', JSON.stringify(updated));
        showToast('Department users updated successfully', 'success');
        setShowAddUsersModal(false);
        setEditingDept(null);
        loadDepartments();
    };

    const handleAddPagesClick = (dept: Department) => {
        setEditingDept(dept);
        setEditSelectedPages(dept.pages);
        setEditPageSearch('');
        setShowAddPagesModal(true);
    };

    const handleSaveDeptPages = () => {
        const stored = localStorage.getItem('departments');
        const depts: Department[] = stored ? JSON.parse(stored) : [];

        const updated = depts.map(d => {
            if (d.id === editingDept?.id) {
                return {
                    ...d,
                    pages: editSelectedPages
                };
            }
            return d;
        });

        localStorage.setItem('departments', JSON.stringify(updated));
        showToast('Department pages updated successfully', 'success');
        setShowAddPagesModal(false);
        setEditingDept(null);
        loadDepartments();
    };

    const filteredEditSystemPages = useMemo(() => {
        return SYSTEM_PAGES.filter(p => 
            p.name.toLowerCase().includes(editPageSearch.toLowerCase()) || 
            p.path.toLowerCase().includes(editPageSearch.toLowerCase())
        );
    }, [editPageSearch]);

    const filteredEditDeptUsers = useMemo(() => {
        return users.filter(u => 
            u.name?.toLowerCase().includes(editUserSearch.toLowerCase()) || 
            u.email.toLowerCase().includes(editUserSearch.toLowerCase())
        );
    }, [users, editUserSearch]);

    // Searches inside Wizard
    const filteredSystemPages = useMemo(() => {
        return SYSTEM_PAGES.filter(p => 
            p.name.toLowerCase().includes(pageSearch.toLowerCase()) || 
            p.path.toLowerCase().includes(pageSearch.toLowerCase())
        );
    }, [pageSearch]);

    const filteredDeptUsers = useMemo(() => {
        return users.filter(u => 
            u.name?.toLowerCase().includes(userSearch.toLowerCase()) || 
            u.email.toLowerCase().includes(userSearch.toLowerCase())
        );
    }, [users, userSearch]);

    const [searchQuery, setSearchQuery] = useState('');

    const filteredUsers = users.filter(user =>
        user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) return <div className={styles.container}>Loading...</div>;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2><span role="img" aria-label="shield">🛡️</span> Admin Panel</h2>
                <p>Manage users, assign roles, create departments, and configure system permissions.</p>
            </div>

            <div className={styles.btnGroup}>
                {!(currentUserRole === 'User' || currentUserRole === 'Operator') && (
                    <>
                        <button className={styles.primaryBtn} onClick={handleOpenDeptModal}>
                            Create Department
                        </button>
                        <button className={styles.primaryBtn} onClick={handleOpenUserModal}>
                            Create User
                        </button>
                    </>
                )}
            </div>

            <div className={styles.searchContainer} style={{ marginBottom: '1rem' }}>
                <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                        padding: '0.75rem',
                        width: '100%',
                        maxWidth: '400px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-input)',
                        color: 'var(--text-primary)',
                        fontSize: '1rem'
                    }}
                />
            </div>

            <div className={styles.card}>
                <div className={styles.tableContainer}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Current Role / Position</th>
                                <th>Employee Code</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.length > 0 ? (
                                filteredUsers.map(user => (
                                    <tr key={user.id}>
                                        <td style={{ fontWeight: 500 }}>{user.name}</td>
                                        <td>{user.email || <span style={{ opacity: 0.4, fontSize: '0.8rem' }}>—</span>}</td>
                                        <td>
                                            <span className={`${styles.badge} ${getRoleBadgeClass(user.role)}`}>
                                                {user.role || 'User'}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: '0.88rem', color: '#4b5563', fontFamily: 'monospace' }}>
                                            {user.employeeCode || <span style={{ opacity: 0.4, fontSize: '0.8rem' }}>—</span>}
                                        </td>
                                        <td>{user.status || 'Active'}</td>
                                        <td>
                                            <button
                                                className={styles.editBtn}
                                                onClick={() => handleEditClick(user)}
                                            >
                                                Edit User
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>
                                        No users found matching "{searchQuery}"
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create/Edit User Modal */}
            {showUserModal && (
                <div className={styles.modalOverlay}>
                    <div className={`${styles.modal} ${styles.largeLightModal}`} style={{ maxWidth: '680px', width: '95%' }}>
                        {/* Modal Header */}
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '1.5rem 1.75rem', borderBottom: '1px solid #e5e7eb',
                            background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
                            borderRadius: '12px 12px 0 0'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{
                                    width: '36px', height: '36px', borderRadius: '8px',
                                    background: 'rgba(255,255,255,0.2)', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                                        <circle cx="12" cy="7" r="4" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600', color: '#ffffff' }}>
                                        {editingUser ? 'Edit User' : 'Create New User'}
                                    </h3>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.75)' }}>
                                        {editingUser ? 'Update user account details' : 'Add a new user to the system'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={resetUserForm}
                                style={{
                                    background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
                                    color: '#ffffff', width: '32px', height: '32px', borderRadius: '8px',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', fontSize: '1.2rem', lineHeight: 1
                                }}
                            >&times;</button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleSaveUser} style={{ padding: '1.75rem' }}>
                            {/* Row 1: User Name + Employee Code */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#374151', marginBottom: '0.45rem', letterSpacing: '0.02em' }}>
                                        USER NAME <span style={{ color: '#ef4444' }}>*</span>
                                    </label>
                                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                        <input
                                            type="text"
                                            value={userName}
                                            onChange={(e) => setUserName(e.target.value)}
                                            required
                                            placeholder="Full name"
                                            style={{
                                                width: '100%', paddingLeft: '0.75rem', paddingRight: '0.75rem',
                                                paddingTop: '0.625rem', paddingBottom: '0.625rem',
                                                border: '1.5px solid #d1d5db', borderRadius: '8px',
                                                fontSize: '0.9rem', color: '#111827', background: '#f9fafb',
                                                outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s'
                                            }}
                                            onFocus={e => e.target.style.borderColor = '#3b82f6'}
                                            onBlur={e => e.target.style.borderColor = '#d1d5db'}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#374151', marginBottom: '0.45rem', letterSpacing: '0.02em' }}>
                                        EMPLOYEE CODE <span style={{ color: '#ef4444' }}>*</span>
                                    </label>
                                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                        <input
                                            type="text"
                                            value={employeeCode}
                                            onChange={(e) => setEmployeeCode(e.target.value)}
                                            required
                                            placeholder="e.g. EMP-001"
                                            style={{
                                                width: '100%', paddingLeft: '0.75rem', paddingRight: '0.75rem',
                                                paddingTop: '0.625rem', paddingBottom: '0.625rem',
                                                border: '1.5px solid #d1d5db', borderRadius: '8px',
                                                fontSize: '0.9rem', color: '#111827', background: '#f9fafb',
                                                outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s'
                                            }}
                                            onFocus={e => e.target.style.borderColor = '#3b82f6'}
                                            onBlur={e => e.target.style.borderColor = '#d1d5db'}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Row 2: Email (full width) */}
                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#374151', marginBottom: '0.45rem', letterSpacing: '0.02em' }}>
                                    EMAIL ADDRESS (OPTIONAL)
                                </label>
                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                    <input
                                        type="email"
                                        value={userEmail}
                                        onChange={(e) => setUserEmail(e.target.value)}
                                        placeholder="user@example.com"
                                        style={{
                                            width: '100%', paddingLeft: '0.75rem', paddingRight: '0.75rem',
                                            paddingTop: '0.625rem', paddingBottom: '0.625rem',
                                            border: '1.5px solid #d1d5db', borderRadius: '8px',
                                            fontSize: '0.9rem', color: '#111827',
                                            background: '#f9fafb',
                                            outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s',
                                            cursor: 'text'
                                        }}
                                        onFocus={e => { e.target.style.borderColor = '#3b82f6'; }}
                                        onBlur={e => e.target.style.borderColor = '#d1d5db'}
                                    />
                                </div>
                            </div>

                            {/* Row 3: Password (full width) */}
                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#374151', marginBottom: '0.45rem', letterSpacing: '0.02em' }}>
                                    PASSWORD {editingUser ? <span style={{ fontWeight: 400, fontSize: '0.78rem', color: '#6b7280' }}>(leave blank to keep unchanged)</span> : <span style={{ color: '#ef4444' }}>*</span>}
                                </label>
                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required={!editingUser}
                                        placeholder={editingUser ? 'Enter new password (optional)' : 'Create a password'}
                                        style={{
                                            width: '100%', paddingLeft: '0.75rem', paddingRight: '2.75rem',
                                            paddingTop: '0.625rem', paddingBottom: '0.625rem',
                                            border: '1.5px solid #d1d5db', borderRadius: '8px',
                                            fontSize: '0.9rem', color: '#111827', background: '#f9fafb',
                                            outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s'
                                        }}
                                        onFocus={e => e.target.style.borderColor = '#3b82f6'}
                                        onBlur={e => e.target.style.borderColor = '#d1d5db'}
                                    />
                                    {/* SVG Eye icon matching the Login page */}
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        style={{
                                            position: 'absolute', right: '0.75rem', top: '50%',
                                            transform: 'translateY(-50%)', background: 'none', border: 'none',
                                            cursor: 'pointer', color: '#6b7280', padding: '2px',
                                            display: 'flex', alignItems: 'center'
                                        }}
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showPassword ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                                                <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                                                <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                                                <line x1="2" x2="22" y1="2" y2="22" />
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                                                <circle cx="12" cy="12" r="3" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Row 4: Position + Status */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.75rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#374151', marginBottom: '0.45rem', letterSpacing: '0.02em' }}>
                                        POSITION <span style={{ color: '#ef4444' }}>*</span>
                                    </label>
                                    <select
                                        value={position}
                                        onChange={(e) => setPosition(e.target.value)}
                                        style={{
                                            width: '100%', padding: '0.625rem 0.75rem',
                                            border: '1.5px solid #d1d5db', borderRadius: '8px',
                                            fontSize: '0.9rem', color: '#111827', background: '#f9fafb',
                                            outline: 'none', boxSizing: 'border-box', cursor: 'pointer'
                                        }}
                                    >
                                        {POSITIONS.map(p => (
                                            <option key={p} value={p}>{p}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#374151', marginBottom: '0.45rem', letterSpacing: '0.02em' }}>
                                        STATUS <span style={{ color: '#ef4444' }}>*</span>
                                    </label>
                                    <select
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value)}
                                        style={{
                                            width: '100%', padding: '0.625rem 0.75rem',
                                            border: '1.5px solid #d1d5db', borderRadius: '8px',
                                            fontSize: '0.9rem', color: '#111827', background: '#f9fafb',
                                            outline: 'none', boxSizing: 'border-box', cursor: 'pointer'
                                        }}
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Inactive">Inactive</option>
                                    </select>
                                </div>
                            </div>

                            {/* Footer buttons */}
                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
                                <button
                                    type="button"
                                    onClick={resetUserForm}
                                    style={{
                                        padding: '0.625rem 1.5rem', borderRadius: '8px', fontSize: '0.9rem',
                                        fontWeight: '500', border: '1.5px solid #d1d5db', background: '#ffffff',
                                        color: '#374151', cursor: 'pointer', transition: 'all 0.2s'
                                    }}
                                >Cancel</button>
                                <button
                                    type="submit"
                                    style={{
                                        padding: '0.625rem 1.75rem', borderRadius: '8px', fontSize: '0.9rem',
                                        fontWeight: '600', border: 'none',
                                        background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
                                        color: '#ffffff', cursor: 'pointer', transition: 'all 0.2s',
                                        boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)'
                                    }}
                                >{editingUser ? 'Save Changes' : 'Create User'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Create Department Wizard Modal */}
            {showDeptModal && (
                <div className={styles.modalOverlay}>
                    <div className={`${styles.modal} ${styles.largeLightModal} ${styles.hugeDeptModal}`}>
                        <div className={styles.modalHeader}>
                            <h3>Create Department</h3>
                            <button className={styles.closeBtn} onClick={resetDeptForm}>&times;</button>
                        </div>

                        {/* Step progress indicator */}
                        <div className={styles.stepsContainer}>
                            <div className={styles.stepsLine}></div>
                            <div className={`${styles.stepItem} ${deptStep === 1 ? styles.stepItemActive : (deptStep > 1 ? styles.stepItemCompleted : '')}`}>
                                <div className={styles.stepBadge}>1</div>
                                <span className={styles.stepLabel}>Details</span>
                            </div>
                            <div className={`${styles.stepItem} ${deptStep === 2 ? styles.stepItemActive : (deptStep > 2 ? styles.stepItemCompleted : '')}`}>
                                <div className={styles.stepBadge}>2</div>
                                <span className={styles.stepLabel}>Assign Pages</span>
                            </div>
                            <div className={`${styles.stepItem} ${deptStep === 3 ? styles.stepItemActive : ''}`}>
                                <div className={styles.stepBadge}>3</div>
                                <span className={styles.stepLabel}>Assign Users</span>
                            </div>
                        </div>

                        {/* Step 1: Department Name */}
                        {deptStep === 1 && (
                            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                                <div className={styles.inputCard}>
                                    <div className={styles.formGroup}>
                                        <label style={{ fontSize: '1rem', fontWeight: 600 }}>Department Name *</label>
                                        <input 
                                            type="text" 
                                            className={styles.formInput} 
                                            value={deptName} 
                                            onChange={(e) => setDeptName(e.target.value)}
                                            placeholder="e.g. Quality Assurance, SMT Production..."
                                            style={{ width: '100%', marginTop: '0.5rem' }}
                                        />
                                    </div>
                                </div>
                                <div className={styles.footerActions}>
                                    <button type="button" className={styles.secondaryBtn} onClick={resetDeptForm}>Cancel</button>
                                    <button 
                                        type="button" 
                                        className={styles.primaryBtn} 
                                        onClick={() => {
                                            if (!deptName.trim()) {
                                                showToast('Department Name is required.', 'error');
                                            } else {
                                                setDeptStep(2);
                                            }
                                        }}
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Add Pages */}
                        {deptStep === 2 && (
                            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, justifyContent: 'space-between' }}>
                                <div className={styles.twoColGrid}>
                                    <div className={styles.leftCol}>
                                        <div className={styles.columnHeader}>
                                            <span>Available Pages ({filteredSystemPages.length})</span>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', fontWeight: 'normal', cursor: 'pointer' }}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={filteredSystemPages.length > 0 && filteredSystemPages.every(p => selectedPages.includes(p.path))}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            const toAdd = filteredSystemPages.map(p => p.path);
                                                            setSelectedPages(prev => Array.from(new Set([...prev, ...toAdd])));
                                                        } else {
                                                            const toRemove = filteredSystemPages.map(p => p.path);
                                                            setSelectedPages(prev => prev.filter(p => !toRemove.includes(p)));
                                                        }
                                                    }}
                                                />
                                                Select All
                                            </label>
                                        </div>
                                        <input 
                                            type="text" 
                                            placeholder="Search pages by name or path..." 
                                            value={pageSearch} 
                                            onChange={(e) => setPageSearch(e.target.value)} 
                                            className={styles.searchBox}
                                        />
                                        <div className={styles.selectionList}>
                                            {filteredSystemPages.map(page => (
                                                <div key={page.path} className={styles.multiSelectItem}>
                                                    <input 
                                                        type="checkbox" 
                                                        id={`page-${page.path}`}
                                                        checked={selectedPages.includes(page.path)}
                                                        onChange={() => {
                                                            if (selectedPages.includes(page.path)) {
                                                                setSelectedPages(selectedPages.filter(p => p !== page.path));
                                                            } else {
                                                                setSelectedPages([...selectedPages, page.path]);
                                                            }
                                                        }}
                                                    />
                                                    <label htmlFor={`page-${page.path}`} style={{ cursor: 'pointer', flex: 1, fontSize: '0.85rem' }}>
                                                        {page.name} <span style={{ opacity: 0.6, fontSize: '0.75rem' }}>({page.path})</span>
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    <div className={styles.rightCol}>
                                        <div className={styles.columnHeader}>
                                            <span>Selected ({selectedPages.length} Pages)</span>
                                        </div>
                                        <div className={styles.chipList}>
                                            {selectedPages.length > 0 ? (
                                                selectedPages.map(pagePath => {
                                                    const pageName = SYSTEM_PAGES.find(p => p.path === pagePath)?.name || pagePath;
                                                    return (
                                                        <span key={pagePath} className={styles.removableChip}>
                                                            {pageName}
                                                            <button 
                                                                type="button" 
                                                                className={styles.chipRemoveBtn}
                                                                onClick={() => setSelectedPages(selectedPages.filter(p => p !== pagePath))}
                                                            >
                                                                &times;
                                                            </button>
                                                        </span>
                                                    );
                                                })
                                            ) : (
                                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', padding: '1rem' }}>No pages selected yet.</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className={styles.footerActions}>
                                    <button type="button" className={styles.secondaryBtn} onClick={resetDeptForm}>Cancel</button>
                                    <button type="button" className={styles.secondaryBtn} onClick={() => setDeptStep(1)}>Previous</button>
                                    <button type="button" className={styles.primaryBtn} onClick={() => setDeptStep(3)}>Next</button>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Add Users */}
                        {deptStep === 3 && (
                            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, justifyContent: 'space-between' }}>
                                <div className={styles.twoColGrid}>
                                    <div className={styles.leftCol}>
                                        <div className={styles.columnHeader}>
                                            <span>Available Users ({filteredDeptUsers.length})</span>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', fontWeight: 'normal', cursor: 'pointer' }}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={filteredDeptUsers.length > 0 && filteredDeptUsers.every(u => selectedUsers.some(su => su.email === u.email))}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            const toAdd = filteredDeptUsers.map(u => ({ name: u.name, email: u.email }));
                                                            setSelectedUsers(prev => {
                                                                const merged = [...prev];
                                                                toAdd.forEach(item => {
                                                                    if (!merged.some(m => m.email === item.email)) {
                                                                        merged.push(item);
                                                                    }
                                                                });
                                                                return merged;
                                                            });
                                                        } else {
                                                            const emailsToRemove = filteredDeptUsers.map(u => u.email);
                                                            setSelectedUsers(prev => prev.filter(u => !emailsToRemove.includes(u.email)));
                                                        }
                                                    }}
                                                />
                                                Select All
                                            </label>
                                        </div>
                                        <input 
                                            type="text" 
                                            placeholder="Search users by name or email..." 
                                            value={userSearch} 
                                            onChange={(e) => setUserSearch(e.target.value)} 
                                            className={styles.searchBox}
                                        />
                                        <div className={styles.selectionList}>
                                            {filteredDeptUsers.map(user => {
                                                const userId = user.id || user.employeeCode || user.email;
                                                const isSelected = selectedUsers.some(u => (u.id && u.id === user.id) || (u.employeeCode && u.employeeCode === user.employeeCode) || (u.email && u.email === user.email));
                                                return (
                                                    <div key={userId} className={styles.multiSelectItem}>
                                                        <input 
                                                            type="checkbox" 
                                                            id={`user-${userId}`}
                                                            checked={isSelected}
                                                            onChange={() => {
                                                                if (isSelected) {
                                                                    setSelectedUsers(selectedUsers.filter(u => !((u.id && u.id === user.id) || (u.employeeCode && u.employeeCode === user.employeeCode) || (u.email && u.email === user.email))));
                                                                } else {
                                                                    setSelectedUsers([...selectedUsers, { id: user.id, name: user.name, email: user.email, employeeCode: user.employeeCode }]);
                                                                }
                                                            }}
                                                        />
                                                        <label htmlFor={`user-${userId}`} style={{ cursor: 'pointer', flex: 1, fontSize: '0.85rem' }}>
                                                            {user.name} {user.email ? <span style={{ opacity: 0.6, fontSize: '0.75rem' }}>({user.email})</span> : ''}
                                                        </label>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    
                                    <div className={styles.rightCol}>
                                        <div className={styles.columnHeader}>
                                            <span>Selected ({selectedUsers.length} Users)</span>
                                        </div>
                                        <div className={styles.chipList}>
                                            {selectedUsers.length > 0 ? (
                                                selectedUsers.map(u => {
                                                    const chipKey = u.id || u.employeeCode || u.email;
                                                    return (
                                                        <span key={chipKey} className={styles.removableChip}>
                                                            {u.name || u.email || u.employeeCode || '—'}
                                                            <button 
                                                                type="button" 
                                                                className={styles.chipRemoveBtn}
                                                                onClick={() => setSelectedUsers(selectedUsers.filter(item => !((item.id && item.id === u.id) || (item.employeeCode && item.employeeCode === u.employeeCode) || (item.email && item.email === u.email))))}
                                                            >
                                                                &times;
                                                            </button>
                                                        </span>
                                                    );
                                                })
                                            ) : (
                                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', padding: '1rem' }}>No users selected yet.</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className={styles.footerActions}>
                                    <button type="button" className={styles.secondaryBtn} onClick={resetDeptForm}>Cancel</button>
                                    <button type="button" className={styles.secondaryBtn} onClick={() => setDeptStep(2)}>Previous</button>
                                    <button type="button" className={styles.primaryBtn} onClick={handleSaveDepartment}>Create Department</button>
                                </div>
                            </div>
                        )}

                        {/* Departments Table rendered below the wizard steps inside the popup */}
                        <div style={{ marginTop: '2.5rem', paddingTop: '2rem', borderTop: '2px solid #e2e8f0' }}>
                            <h3 style={{ color: '#0f172a', fontSize: '1.25rem', fontWeight: '600', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                📁 Departments & Permissions List
                            </h3>
                            {departments.length > 0 ? (
                                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', backgroundColor: '#ffffff' }}>
                                    <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                                        <table className={styles.table} style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                            <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 1, boxShadow: '0 1px 0 #e2e8f0' }}>
                                                <tr>
                                                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: '600', color: '#475569', backgroundColor: '#f8fafc', width: '20%' }}>Department Name</th>
                                                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: '600', color: '#475569', backgroundColor: '#f8fafc', width: '35%' }}>Assigned Pages</th>
                                                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: '600', color: '#475569', backgroundColor: '#f8fafc', width: '25%' }}>Assigned Users</th>
                                                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: '600', color: '#475569', backgroundColor: '#f8fafc', textAlign: 'center', width: '20%' }}>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {departments.map((dept) => (
                                                    <tr key={dept.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                        <td style={{ padding: '1rem', fontWeight: '600', color: '#4f46e5', fontSize: '0.9rem' }}>{dept.name}</td>
                                                        <td style={{ padding: '1rem' }}>
                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', maxWidth: '300px' }}>
                                                                {dept.pages.map(pagePath => {
                                                                    const pageName = SYSTEM_PAGES.find(p => p.path === pagePath)?.name || pagePath;
                                                                    return (
                                                                        <span key={pagePath} className={styles.deptTag} style={{ margin: 0, display: 'inline-flex', padding: '0.2rem 0.5rem', background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '500' }} title={pagePath}>
                                                                            {pageName}
                                                                        </span>
                                                                    );
                                                                })}
                                                                {dept.pages.length === 0 && <span style={{ opacity: 0.5, fontSize: '0.8rem' }}>None</span>}
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '1rem' }}>
                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', maxWidth: '300px' }}>
                                                                {dept.users.map(u => (
                                                                    <span key={u.email} className={styles.deptTag} style={{ margin: 0, display: 'inline-flex', padding: '0.2rem 0.5rem', background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '500' }} title={u.email}>
                                                                        {u.name || u.email}
                                                                    </span>
                                                                ))}
                                                                {dept.users.length === 0 && <span style={{ opacity: 0.5, fontSize: '0.8rem' }}>None</span>}
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', alignItems: 'center' }}>
                                                                <button
                                                                    className={styles.deptActionBtn}
                                                                    style={{ background: '#059669', width: '90px' }}
                                                                    onClick={() => handleViewDeptClick(dept)}
                                                                >
                                                                    View
                                                                </button>
                                                                <button
                                                                    className={styles.deptActionBtn}
                                                                    style={{ background: '#4f46e5', width: '90px' }}
                                                                    onClick={() => handleAddUsersClick(dept)}
                                                                >
                                                                    Add Users
                                                                </button>
                                                                <button
                                                                    className={styles.deptActionBtn}
                                                                    style={{ background: '#7c3aed', width: '90px' }}
                                                                    onClick={() => handleAddPagesClick(dept)}
                                                                >
                                                                    Add Pages
                                                                </button>
                                                                <button
                                                                    className={styles.deptActionBtn}
                                                                    style={{ background: '#dc2626', width: '90px' }}
                                                                    onClick={() => handleDeleteDept(dept.id)}
                                                                >
                                                                    Delete
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '2rem', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#64748b', fontSize: '0.9rem' }}>
                                    No departments created yet. Fill the wizard above to create your first department.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* View Department Modal */}
            {showViewDeptModal && editingDept && (
                <div className={styles.modalOverlay}>
                    <div className={`${styles.modal} ${styles.largeLightModal}`}>
                        <div className={styles.modalHeader}>
                            <h3>View Department: {editingDept.name}</h3>
                            <button className={styles.closeBtn} onClick={() => { setShowViewDeptModal(false); setEditingDept(null); }}>&times;</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
                            <div>
                                <h4 style={{ color: '#1f2937', marginBottom: '0.5rem' }}>Assigned Pages ({editingDept.pages.length})</h4>
                                <div className={styles.chipList} style={{ background: '#f9fafb', padding: '1rem', borderRadius: '8px', border: '1px solid #e5e7eb', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', minHeight: '60px' }}>
                                    {editingDept.pages.map(pagePath => {
                                        const pageName = SYSTEM_PAGES.find(p => p.path === pagePath)?.name || pagePath;
                                        return (
                                            <span key={pagePath} className={styles.deptTag} style={{ display: 'inline-flex', padding: '0.25rem 0.5rem', background: '#e0f2fe', color: '#0369a1', borderRadius: '6px', fontSize: '0.85rem' }}>
                                                {pageName}
                                            </span>
                                        );
                                    })}
                                    {editingDept.pages.length === 0 && <div style={{ color: '#6b7280' }}>No pages assigned.</div>}
                                </div>
                            </div>
                            <div>
                                <h4 style={{ color: '#1f2937', marginBottom: '0.5rem' }}>Assigned Users ({editingDept.users.length})</h4>
                                <div className={styles.chipList} style={{ background: '#f9fafb', padding: '1rem', borderRadius: '8px', border: '1px solid #e5e7eb', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', minHeight: '60px' }}>
                                    {editingDept.users.map(u => (
                                        <span key={u.email} className={styles.deptTag} style={{ display: 'inline-flex', padding: '0.25rem 0.5rem', background: '#eef2ff', borderColor: '#c7d2fe', color: '#3730a3', borderRadius: '6px', fontSize: '0.85rem' }}>
                                            {u.name || u.email || '—'} {u.email ? <span style={{ opacity: 0.6, fontSize: '0.75rem', marginLeft: '0.25rem' }}>({u.email})</span> : ''}
                                        </span>
                                    ))}
                                    {editingDept.users.length === 0 && <div style={{ color: '#6b7280' }}>No users assigned.</div>}
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
                            <button type="button" className={styles.secondaryBtn} onClick={() => { setShowViewDeptModal(false); setEditingDept(null); }}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Department Modal */}
            {showEditDeptModal && editingDept && (
                <div className={styles.modalOverlay}>
                    <div className={`${styles.modal} ${styles.largeLightModal} ${styles.deptWizardModal}`}>
                        <div className={styles.modalHeader}>
                            <h3>Edit Department: {editingDept.name}</h3>
                            <button className={styles.closeBtn} onClick={() => { setShowEditDeptModal(false); setEditingDept(null); }}>&times;</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
                            <div className={styles.formGroup}>
                                <label>Department Name *</label>
                                <input 
                                    type="text" 
                                    className={styles.formInput} 
                                    value={editDeptName} 
                                    onChange={(e) => setEditDeptName(e.target.value)} 
                                    required 
                                />
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', minHeight: '300px' }}>
                                {/* Pages Col */}
                                <div className={styles.leftCol}>
                                    <div className={styles.columnHeader}>
                                        <span>Pages ({editSelectedPages.length} Selected)</span>
                                    </div>
                                    <input 
                                        type="text" 
                                        placeholder="Search pages..." 
                                        value={editPageSearch} 
                                        onChange={(e) => setEditPageSearch(e.target.value)} 
                                        className={styles.searchBox}
                                        style={{ margin: '0.5rem', width: 'calc(100% - 1rem)' }}
                                    />
                                    <div className={styles.selectionList} style={{ height: '220px' }}>
                                        {filteredEditSystemPages.map(page => (
                                            <div key={page.path} className={styles.multiSelectItem}>
                                                <input 
                                                    type="checkbox" 
                                                    id={`edit-page-${page.path}`}
                                                    checked={editSelectedPages.includes(page.path)}
                                                    onChange={() => {
                                                        if (editSelectedPages.includes(page.path)) {
                                                            setEditSelectedPages(editSelectedPages.filter(p => p !== page.path));
                                                        } else {
                                                            setEditSelectedPages([...editSelectedPages, page.path]);
                                                        }
                                                    }}
                                                />
                                                <label htmlFor={`edit-page-${page.path}`} style={{ cursor: 'pointer', flex: 1, fontSize: '0.85rem' }}>
                                                    {page.name}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                {/* Users Col */}
                                <div className={styles.leftCol}>
                                    <div className={styles.columnHeader}>
                                        <span>Users ({editSelectedUsers.length} Selected)</span>
                                    </div>
                                    <input 
                                        type="text" 
                                        placeholder="Search users..." 
                                        value={editUserSearch} 
                                        onChange={(e) => setEditUserSearch(e.target.value)} 
                                        className={styles.searchBox}
                                        style={{ margin: '0.5rem', width: 'calc(100% - 1rem)' }}
                                    />
                                    <div className={styles.selectionList} style={{ height: '220px' }}>
                                        {filteredEditDeptUsers.map(user => (
                                            <div key={user.email} className={styles.multiSelectItem}>
                                                <input 
                                                    type="checkbox" 
                                                    id={`edit-user-${user.email}`}
                                                    checked={editSelectedUsers.some(u => u.email === user.email)}
                                                    onChange={() => {
                                                        if (editSelectedUsers.some(u => u.email === user.email)) {
                                                            setEditSelectedUsers(editSelectedUsers.filter(u => u.email !== user.email));
                                                        } else {
                                                            setEditSelectedUsers([...editSelectedUsers, { name: user.name, email: user.email }]);
                                                        }
                                                    }}
                                                />
                                                <label htmlFor={`edit-user-${user.email}`} style={{ cursor: 'pointer', flex: 1, fontSize: '0.85rem' }}>
                                                    {user.name || user.email}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className={styles.footerActions} style={{ marginTop: '1.5rem' }}>
                            <button type="button" className={styles.secondaryBtn} onClick={() => { setShowEditDeptModal(false); setEditingDept(null); }}>Cancel</button>
                            <button type="button" className={styles.primaryBtn} onClick={handleUpdateDepartment}>Save Changes</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Users Modal */}
            {showAddUsersModal && editingDept && (
                <div className={styles.modalOverlay}>
                    <div className={`${styles.modal} ${styles.largeLightModal} ${styles.deptWizardModal}`}>
                        <div className={styles.modalHeader}>
                            <h3>Add/Manage Users: {editingDept.name}</h3>
                            <button className={styles.closeBtn} onClick={() => { setShowAddUsersModal(false); setEditingDept(null); }}>&times;</button>
                        </div>
                        <div className={styles.twoColGrid} style={{ flex: 1, minHeight: 0 }}>
                            <div className={styles.leftCol}>
                                <div className={styles.columnHeader}>
                                    <span>Available Users ({filteredEditDeptUsers.length})</span>
                                </div>
                                <input 
                                    type="text" 
                                    placeholder="Search users..." 
                                    value={editUserSearch} 
                                    onChange={(e) => setEditUserSearch(e.target.value)} 
                                    className={styles.searchBox}
                                />
                                <div className={styles.selectionList}>
                                    {filteredEditDeptUsers.map(user => (
                                        <div key={user.email} className={styles.multiSelectItem}>
                                            <input 
                                                type="checkbox" 
                                                id={`add-user-${user.email}`}
                                                checked={editSelectedUsers.some(u => u.email === user.email)}
                                                onChange={() => {
                                                    if (editSelectedUsers.some(u => u.email === user.email)) {
                                                        setEditSelectedUsers(editSelectedUsers.filter(u => u.email !== user.email));
                                                    } else {
                                                        setEditSelectedUsers([...editSelectedUsers, { name: user.name, email: user.email }]);
                                                    }
                                                }}
                                            />
                                            <label htmlFor={`add-user-${user.email}`} style={{ cursor: 'pointer', flex: 1, fontSize: '0.85rem' }}>
                                                {user.name} <span style={{ opacity: 0.6, fontSize: '0.75rem' }}>({user.email})</span>
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            <div className={styles.rightCol}>
                                <div className={styles.columnHeader}>
                                    <span>Selected ({editSelectedUsers.length} Users)</span>
                                </div>
                                <div className={styles.chipList}>
                                    {editSelectedUsers.map(u => (
                                        <span key={u.email} className={styles.removableChip}>
                                            {u.name || u.email}
                                            <button 
                                                type="button" 
                                                className={styles.chipRemoveBtn}
                                                onClick={() => setEditSelectedUsers(editSelectedUsers.filter(item => item.email !== u.email))}
                                            >
                                                &times;
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className={styles.footerActions} style={{ marginTop: '1.5rem' }}>
                            <button type="button" className={styles.secondaryBtn} onClick={() => { setShowAddUsersModal(false); setEditingDept(null); }}>Cancel</button>
                            <button type="button" className={styles.primaryBtn} onClick={handleSaveDeptUsers}>Update Users</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Pages Modal */}
            {showAddPagesModal && editingDept && (
                <div className={styles.modalOverlay}>
                    <div className={`${styles.modal} ${styles.largeLightModal} ${styles.deptWizardModal}`}>
                        <div className={styles.modalHeader}>
                            <h3>Add/Manage Pages: {editingDept.name}</h3>
                            <button className={styles.closeBtn} onClick={() => { setShowAddPagesModal(false); setEditingDept(null); }}>&times;</button>
                        </div>
                        <div className={styles.twoColGrid} style={{ flex: 1, minHeight: 0 }}>
                            <div className={styles.leftCol}>
                                <div className={styles.columnHeader}>
                                    <span>Available Pages ({filteredEditSystemPages.length})</span>
                                </div>
                                <input 
                                    type="text" 
                                    placeholder="Search pages..." 
                                    value={editPageSearch} 
                                    onChange={(e) => setEditPageSearch(e.target.value)} 
                                    className={styles.searchBox}
                                />
                                <div className={styles.selectionList}>
                                    {filteredEditSystemPages.map(page => (
                                        <div key={page.path} className={styles.multiSelectItem}>
                                            <input 
                                                type="checkbox" 
                                                id={`add-page-${page.path}`}
                                                checked={editSelectedPages.includes(page.path)}
                                                onChange={() => {
                                                    if (editSelectedPages.includes(page.path)) {
                                                        setEditSelectedPages(editSelectedPages.filter(p => p !== page.path));
                                                    } else {
                                                        setEditSelectedPages([...editSelectedPages, page.path]);
                                                    }
                                                }}
                                            />
                                            <label htmlFor={`add-page-${page.path}`} style={{ cursor: 'pointer', flex: 1, fontSize: '0.85rem' }}>
                                                {page.name} <span style={{ opacity: 0.6, fontSize: '0.75rem' }}>({page.path})</span>
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            <div className={styles.rightCol}>
                                <div className={styles.columnHeader}>
                                    <span>Selected ({editSelectedPages.length} Pages)</span>
                                </div>
                                <div className={styles.chipList}>
                                    {editSelectedPages.map(pagePath => {
                                        const pageName = SYSTEM_PAGES.find(p => p.path === pagePath)?.name || pagePath;
                                        return (
                                            <span key={pagePath} className={styles.removableChip}>
                                                {pageName}
                                                <button 
                                                    type="button" 
                                                    className={styles.chipRemoveBtn}
                                                    onClick={() => setEditSelectedPages(editSelectedPages.filter(p => p !== pagePath))}
                                                >
                                                    &times;
                                                </button>
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                        <div className={styles.footerActions} style={{ marginTop: '1.5rem' }}>
                            <button type="button" className={styles.secondaryBtn} onClick={() => { setShowAddPagesModal(false); setEditingDept(null); }}>Cancel</button>
                            <button type="button" className={styles.primaryBtn} onClick={handleSaveDeptPages}>Update Pages</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

