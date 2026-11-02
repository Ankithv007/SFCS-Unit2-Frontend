import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import styles from './AdminPanel.module.css';
import { useAdminPanel } from './hooks/useAdminPanel';

import { UserManagementTab } from './components/UserManagementTab';
import { DepartmentManagementTab } from './components/DepartmentManagementTab';
import { PermissionMatrixTab } from './components/PermissionMatrixTab';
import { AuditLogsTab } from './components/AuditLogsTab';

import { UserModal } from './components/UserModal';
import { DepartmentWizardModal } from './components/DepartmentWizardModal';
import { DepartmentViewModal } from './components/DepartmentViewModal';
import { AuditDetailDrawer } from './components/AuditDetailDrawer';
import { ConfirmModal } from './components/ConfirmModal';

export const AdminPanel: React.FC = () => {
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();

    const {
        activeTab,
        setActiveTab,
        refreshAll,

        // Users
        users,
        allUsersList,
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

        // Departments
        departments,
        loadingDepts,
        handleDeleteDepartment,

        // Audit Logs
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

        // Modals
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
        setConfirmModal,

        // System Pages
        systemPages,
        handleSyncSystemPages
    } = useAdminPanel();

    const [initialDeptStep, setInitialDeptStep] = React.useState<1 | 2 | 3>(1);

    // Calculated KPI metrics
    const activeUsersCount = users.filter(u => u.status === 'active' && !u.deleted_at).length;
    const inactiveUsersCount = users.filter(u => u.status === 'inactive' || u.deleted_at).length;

    return (
        <div className={styles.container}>
            {/* Top Header & Breadcrumbs */}
            <div className={styles.topBar}>
                <div>
                    <div className={styles.breadcrumb}>
                        <span className={styles.breadcrumbLink} onClick={() => navigate('/dashboard')}>Dashboard</span>
                        <span>/</span>
                        <span>Administration</span>
                    </div>
                    <div className={styles.titleArea}>
                        <h1 className={styles.pageTitle}>🛡️ Enterprise Admin Control Center</h1>
                    </div>
                </div>

                <div className={styles.topActions}>
                    {currentUser?.role === 'Super Admin' && (
                        <button className={styles.refreshBtn} style={{ backgroundColor: 'var(--accent, #6366f1)', color: 'white' }} onClick={handleSyncSystemPages} title="Sync System Pages">
                            ⚙️ Sync System Pages
                        </button>
                    )}
                    <button className={styles.refreshBtn} onClick={refreshAll} title="Refresh All Data">
                        🔄 Refresh Data
                    </button>
                    <div className={styles.userBadge}>
                        👤 {currentUser?.name || 'Administrator'} ({currentUser?.role || 'Admin'})
                    </div>
                </div>
            </div>

            {/* KPI Metric Cards */}
            <div className={styles.kpiGrid}>
                <div className={styles.kpiCard}>
                    <div className={styles.kpiInfo}>
                        <span className={styles.kpiLabel}>Total Accounts</span>
                        <span className={styles.kpiValue}>{totalUsers}</span>
                    </div>
                    <div className={`${styles.kpiIcon} ${styles.iconBlue}`}>👥</div>
                </div>

                <div className={styles.kpiCard}>
                    <div className={styles.kpiInfo}>
                        <span className={styles.kpiLabel}>Active Users</span>
                        <span className={styles.kpiValue}>{activeUsersCount}</span>
                    </div>
                    <div className={`${styles.kpiIcon} ${styles.iconGreen}`}>🟢</div>
                </div>

                <div className={styles.kpiCard}>
                    <div className={styles.kpiInfo}>
                        <span className={styles.kpiLabel}>Inactive / Soft-Deleted</span>
                        <span className={styles.kpiValue}>{inactiveUsersCount}</span>
                    </div>
                    <div className={`${styles.kpiIcon} ${styles.iconOrange}`}>🔴</div>
                </div>

                <div className={styles.kpiCard}>
                    <div className={styles.kpiInfo}>
                        <span className={styles.kpiLabel}>Departments</span>
                        <span className={styles.kpiValue}>{departments.length}</span>
                    </div>
                    <div className={`${styles.kpiIcon} ${styles.iconPurple}`}>📁</div>
                </div>

                <div className={styles.kpiCard}>
                    <div className={styles.kpiInfo}>
                        <span className={styles.kpiLabel}>Audit Events</span>
                        <span className={styles.kpiValue}>{totalAuditLogs}</span>
                    </div>
                    <div className={`${styles.kpiIcon} ${styles.iconTeal}`}>📜</div>
                </div>
            </div>

            {/* Dashboard Tabs & Primary Actions */}
            <div className={styles.tabHeader}>
                <div className={styles.tabList}>
                    <button
                        className={`${styles.tabItem} ${activeTab === 'users' ? styles.tabItemActive : ''}`}
                        onClick={() => setActiveTab('users')}
                    >
                        👥 User Management
                    </button>
                    <button
                        className={`${styles.tabItem} ${activeTab === 'departments' ? styles.tabItemActive : ''}`}
                        onClick={() => setActiveTab('departments')}
                    >
                        📁 Department Roster
                    </button>
                    <button
                        className={`${styles.tabItem} ${activeTab === 'permissions' ? styles.tabItemActive : ''}`}
                        onClick={() => setActiveTab('permissions')}
                    >
                        🔐 Permission Matrix
                    </button>
                    <button
                        className={`${styles.tabItem} ${activeTab === 'audit' ? styles.tabItemActive : ''}`}
                        onClick={() => setActiveTab('audit')}
                    >
                        📜 Audit Trail
                    </button>
                </div>

                {activeTab === 'users' && (
                    <button
                        className={styles.primaryActionBtn}
                        onClick={() => {
                            setSelectedUserForEdit(null);
                            setIsUserModalOpen(true);
                        }}
                    >
                        ➕ Add New User
                    </button>
                )}

                {(activeTab === 'departments' || activeTab === 'permissions') && (
                    <button
                        className={styles.primaryActionBtn}
                        onClick={() => {
                            setSelectedDeptForEdit(null);
                            setInitialDeptStep(1);
                            setIsDeptModalOpen(true);
                        }}
                    >
                        ➕ Create Department
                    </button>
                )}
            </div>

            {/* Main Content Area based on Active Tab */}
            {activeTab === 'users' && (
                <UserManagementTab
                    users={users}
                    totalUsers={totalUsers}
                    page={userPage}
                    limit={userLimit}
                    totalPages={userTotalPages}
                    loading={loadingUsers}
                    departments={departments}
                    searchQuery={userSearch}
                    roleFilter={userRoleFilter}
                    statusFilter={userStatusFilter}
                    includeDeleted={includeDeleted}
                    onSearchChange={setUserSearch}
                    onRoleChange={setUserRoleFilter}
                    onStatusChange={setUserStatusFilter}
                    onIncludeDeletedToggle={setIncludeDeleted}
                    onPageChange={setUserPage}
                    onLimitChange={setUserLimit}
                    onEditUser={(u) => {
                        setSelectedUserForEdit(u);
                        setIsUserModalOpen(true);
                    }}
                    onResetPassword={handleResetPassword}
                    onToggleStatus={handleToggleUserStatus}
                    onRestoreUser={handleRestoreUser}
                    onDeleteUser={handleSoftDeleteUser}
                />
            )}

            {activeTab === 'departments' && (
                <DepartmentManagementTab
                    departments={departments}
                    loading={loadingDepts}
                    onViewDepartment={(d) => setSelectedDeptForView(d)}
                    onEditDepartment={(d) => {
                        setSelectedDeptForEdit(d);
                        setInitialDeptStep(1);
                        setIsDeptModalOpen(true);
                    }}
                    onAddUsers={(d) => {
                        setSelectedDeptForEdit(d);
                        setInitialDeptStep(3);
                        setIsDeptModalOpen(true);
                    }}
                    onAddPages={(d) => {
                        setSelectedDeptForEdit(d);
                        setInitialDeptStep(2);
                        setIsDeptModalOpen(true);
                    }}
                    onDeleteDepartment={handleDeleteDepartment}
                />
            )}

            {activeTab === 'permissions' && (
                <PermissionMatrixTab
                    departments={departments}
                    loading={loadingDepts}
                />
            )}

            {activeTab === 'audit' && (
                <AuditLogsTab
                    logs={auditLogs}
                    totalLogs={totalAuditLogs}
                    page={auditPage}
                    limit={auditLimit}
                    totalPages={auditTotalPages}
                    loading={loadingAudit}
                    searchQuery={auditSearch}
                    actionFilter={auditActionFilter}
                    startDate={auditStartDate}
                    endDate={auditEndDate}
                    onSearchChange={setAuditSearch}
                    onActionChange={setAuditActionFilter}
                    onStartDateChange={setAuditStartDate}
                    onEndDateChange={setAuditEndDate}
                    onPageChange={setAuditPage}
                    onLimitChange={setAuditLimit}
                    onViewDetail={(log) => setSelectedAuditLog(log)}
                />
            )}

            {/* Modals & Slide-out Drawers */}
            <UserModal
                isOpen={isUserModalOpen}
                user={selectedUserForEdit}
                departments={departments}
                onSave={handleSaveUser}
                onClose={() => setIsUserModalOpen(false)}
            />

            <DepartmentWizardModal
                isOpen={isDeptModalOpen}
                department={selectedDeptForEdit}
                allUsers={allUsersList}
                systemPages={systemPages}
                onSave={handleSaveDepartment}
                onClose={() => setIsDeptModalOpen(false)}
                initialStep={initialDeptStep}
            />

            <DepartmentViewModal
                isOpen={!!selectedDeptForView}
                department={selectedDeptForView}
                onClose={() => setSelectedDeptForView(null)}
            />

            <AuditDetailDrawer
                isOpen={!!selectedAuditLog}
                log={selectedAuditLog}
                onClose={() => setSelectedAuditLog(null)}
            />

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText={confirmModal.confirmText}
                isDanger={confirmModal.isDanger}
                onConfirm={confirmModal.onConfirm}
                onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
            />
        </div>
    );
};
