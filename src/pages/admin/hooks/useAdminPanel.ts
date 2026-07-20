import { useState, useEffect, useCallback } from 'react';
import { adminService, type AdminUser, type AdminDepartment, type AuditLogItem } from '../services/adminService';
import { useToast } from '../../../components/Toast';
import { sessionPasswords } from '../components/UserModal';

export function useAdminPanel() {
    const { showToast } = useToast();

    // Tab state
    const [activeTab, setActiveTab] = useState<'users' | 'departments' | 'permissions' | 'audit'>('users');

    // Users state
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [totalUsers, setTotalUsers] = useState(0);
    const [userPage, setUserPage] = useState(1);
    const [userLimit, setUserLimit] = useState(10);
    const [userTotalPages, setUserTotalPages] = useState(1);
    const [userSearch, setUserSearch] = useState('');
    const [userRoleFilter, setUserRoleFilter] = useState('ALL');
    const [userStatusFilter, setUserStatusFilter] = useState('ALL');
    const [includeDeleted, setIncludeDeleted] = useState(false);
    const [loadingUsers, setLoadingUsers] = useState(false);

    // Departments state
    const [departments, setDepartments] = useState<AdminDepartment[]>([]);
    const [loadingDepts, setLoadingDepts] = useState(false);

    // Audit Logs state
    const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
    const [totalAuditLogs, setTotalAuditLogs] = useState(0);
    const [auditPage, setAuditPage] = useState(1);
    const [auditLimit, setAuditLimit] = useState(15);
    const [auditTotalPages, setAuditTotalPages] = useState(1);
    const [auditSearch, setAuditSearch] = useState('');
    const [auditActionFilter, setAuditActionFilter] = useState('ALL');
    const [auditStartDate, setAuditStartDate] = useState('');
    const [auditEndDate, setAuditEndDate] = useState('');
    const [loadingAudit, setLoadingAudit] = useState(false);

    // Modals state
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [selectedUserForEdit, setSelectedUserForEdit] = useState<AdminUser | null>(null);

    const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
    const [selectedDeptForEdit, setSelectedDeptForEdit] = useState<AdminDepartment | null>(null);

    const [selectedDeptForView, setSelectedDeptForView] = useState<AdminDepartment | null>(null);
    const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLogItem | null>(null);

    // Confirmation Modal state
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        confirmText?: string;
        isDanger?: boolean;
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {}
    });

    // Fetch Users
    const fetchUsers = useCallback(async () => {
        setLoadingUsers(true);
        try {
            const res = await adminService.getUsers({
                page: userPage,
                limit: userLimit,
                q: userSearch,
                role: userRoleFilter,
                status: userStatusFilter,
                includeDeleted
            });
            setUsers(res.data);
            setTotalUsers(res.pagination.total);
            setUserTotalPages(res.pagination.totalPages);
        } catch (err: any) {
            showToast(err.message || 'Failed to fetch users', 'error');
        } finally {
            setLoadingUsers(false);
        }
    }, [userPage, userLimit, userSearch, userRoleFilter, userStatusFilter, includeDeleted, showToast]);

    // Fetch Departments
    const fetchDepartments = useCallback(async () => {
        setLoadingDepts(true);
        try {
            const res = await adminService.getDepartments();
            setDepartments(res.data);
        } catch (err: any) {
            showToast(err.message || 'Failed to fetch departments', 'error');
        } finally {
            setLoadingDepts(false);
        }
    }, [showToast]);

    // Fetch Audit Logs
    const fetchAuditLogs = useCallback(async () => {
        setLoadingAudit(true);
        try {
            const res = await adminService.getAuditLogs({
                page: auditPage,
                limit: auditLimit,
                q: auditSearch,
                action: auditActionFilter,
                startDate: auditStartDate || undefined,
                endDate: auditEndDate || undefined
            });
            setAuditLogs(res.data);
            setTotalAuditLogs(res.pagination.total);
            setAuditTotalPages(res.pagination.totalPages);
        } catch (err: any) {
            showToast(err.message || 'Failed to fetch audit logs', 'error');
        } finally {
            setLoadingAudit(false);
        }
    }, [auditPage, auditLimit, auditSearch, auditActionFilter, auditStartDate, auditEndDate, showToast]);

    // Triggers based on tab
    useEffect(() => {
        if (activeTab === 'users') {
            fetchUsers();
            fetchDepartments(); // needed for user modal department checkboxes
        } else if (activeTab === 'departments' || activeTab === 'permissions') {
            fetchDepartments();
            fetchUsers(); // needed for department member user checkboxes
        } else if (activeTab === 'audit') {
            fetchAuditLogs();
        }
    }, [activeTab, fetchUsers, fetchDepartments, fetchAuditLogs]);

    // Refresh active data
    const refreshAll = () => {
        fetchUsers();
        fetchDepartments();
        fetchAuditLogs();
        showToast('Admin data refreshed', 'info');
    };

    // User Operations
    const handleSaveUser = async (payload: any) => {
        if (selectedUserForEdit) {
            await adminService.updateUser(selectedUserForEdit.id, payload);
            showToast('User updated successfully', 'success');
        } else {
            await adminService.createUser(payload);
            showToast('User created successfully', 'success');
        }
        fetchUsers();
    };

    const handleResetPassword = (user: AdminUser) => {
        const newPass = prompt(`Enter new password for ${user.name}:`);
        if (newPass && newPass.trim().length >= 6) {
            const trimmedPass = newPass.trim();
            adminService.resetUserPassword(user.id, trimmedPass)
                .then(() => {
                    showToast(`Password for ${user.name} reset successfully`, 'success');
                    sessionPasswords[user.id] = trimmedPass;
                })
                .catch((err) => {
                    showToast(err.message || 'Failed to reset password', 'error');
                });
        } else if (newPass !== null) {
            showToast('Password must be at least 6 characters long', 'error');
        }
    };

    const handleToggleUserStatus = (user: AdminUser) => {
        const newStatus = user.status === 'active' ? 'inactive' : 'active';
        setConfirmModal({
            isOpen: true,
            title: `${newStatus === 'active' ? 'Activate' : 'Deactivate'} User Account`,
            message: `Are you sure you want to ${newStatus === 'active' ? 'activate' : 'deactivate'} account for ${user.name} (${user.email})?`,
            confirmText: newStatus === 'active' ? 'Activate' : 'Deactivate',
            isDanger: newStatus === 'inactive',
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                try {
                    await adminService.setUserStatus(user.id, newStatus);
                    showToast(`User account ${newStatus}d`, 'success');
                    fetchUsers();
                } catch (err: any) {
                    showToast(err.message || 'Status update failed', 'error');
                }
            }
        });
    };

    const handleSoftDeleteUser = (user: AdminUser) => {
        setConfirmModal({
            isOpen: true,
            title: 'Soft-Delete User Account',
            message: `Are you sure you want to soft-delete ${user.name} (${user.email})? The account will be deactivated but can be restored later.`,
            confirmText: 'Soft Delete',
            isDanger: true,
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                try {
                    await adminService.softDeleteUser(user.id);
                    showToast('User soft-deleted successfully', 'success');
                    fetchUsers();
                } catch (err: any) {
                    showToast(err.message || 'Failed to soft delete user', 'error');
                }
            }
        });
    };

    const handleRestoreUser = async (user: AdminUser) => {
        try {
            await adminService.restoreUser(user.id);
            showToast('User account restored successfully', 'success');
            fetchUsers();
        } catch (err: any) {
            showToast(err.message || 'Failed to restore user', 'error');
        }
    };

    // Department Operations
    const handleSaveDepartment = async (payload: any) => {
        if (selectedDeptForEdit) {
            await adminService.updateDepartment(selectedDeptForEdit.id, payload);
            showToast('Department updated successfully', 'success');
        } else {
            await adminService.createDepartment(payload);
            showToast('Department created successfully', 'success');
        }
        fetchDepartments();
    };

    const handleDeleteDepartment = (dept: AdminDepartment) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Department',
            message: `Are you sure you want to permanently delete department "${dept.name}"? Assigned users will lose their department association.`,
            confirmText: 'Delete Department',
            isDanger: true,
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                try {
                    await adminService.deleteDepartment(dept.id);
                    showToast('Department deleted successfully', 'success');
                    fetchDepartments();
                } catch (err: any) {
                    showToast(err.message || 'Failed to delete department', 'error');
                }
            }
        });
    };

    return {
        // Tab
        activeTab,
        setActiveTab,
        refreshAll,

        // User Tab state & handlers
        users,
        totalUsers,
        userPage,
        userLimit,
        userTotalPages,
        userSearch,
        userRoleFilter,
        userStatusFilter,
        includeDeleted,
        loadingUsers,
        setUserPage,
        setUserLimit,
        setUserSearch,
        setUserRoleFilter,
        setUserStatusFilter,
        setIncludeDeleted,
        handleResetPassword,
        handleToggleUserStatus,
        handleSoftDeleteUser,
        handleRestoreUser,

        // Department Tab state & handlers
        departments,
        loadingDepts,
        handleDeleteDepartment,

        // Audit Log Tab state & handlers
        auditLogs,
        totalAuditLogs,
        auditPage,
        auditLimit,
        auditTotalPages,
        auditSearch,
        auditActionFilter,
        auditStartDate,
        auditEndDate,
        loadingAudit,
        setAuditPage,
        setAuditLimit,
        setAuditSearch,
        setAuditActionFilter,
        setAuditStartDate,
        setAuditEndDate,

        // Modals State
        isUserModalOpen,
        setIsUserModalOpen,
        selectedUserForEdit,
        setSelectedUserForEdit,
        handleSaveUser,

        isDeptModalOpen,
        setIsDeptModalOpen,
        selectedDeptForEdit,
        setSelectedDeptForEdit,
        handleSaveDepartment,

        selectedDeptForView,
        setSelectedDeptForView,

        selectedAuditLog,
        setSelectedAuditLog,

        confirmModal,
        setConfirmModal
    };
}
