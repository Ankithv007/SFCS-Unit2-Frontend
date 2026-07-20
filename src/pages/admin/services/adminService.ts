import { apiFetch } from '../../../utils/api';

export interface UserDeptRef {
    id: number;
    name: string;
}

export interface AdminUser {
    id: number;
    name: string;
    email: string;
    role: string;
    status: 'active' | 'inactive';
    employee_code?: string | null;
    created_at?: string;
    updated_at?: string;
    deleted_at?: string | null;
    departments?: UserDeptRef[];
}

export interface PermissionItem {
    id?: number;
    module: string;
    page: string;
    can_view: boolean;
    can_create: boolean;
    can_edit: boolean;
    can_delete: boolean;
    can_export: boolean;
}

export interface DepartmentUserRef {
    user_id: number;
    name: string;
    email: string;
    employee_code?: string;
    role?: string;
}

export interface AdminDepartment {
    id: number;
    name: string;
    description: string;
    created_at: string;
    updated_at: string;
    users?: DepartmentUserRef[];
    permissions?: PermissionItem[];
}

export interface AuditLogItem {
    id: number;
    performed_by: number | null;
    performer_name: string | null;
    performer_email: string | null;
    action: string;
    target_type: string;
    target_id: string | null;
    old_values: any;
    new_values: any;
    ip_address: string | null;
    user_agent: string | null;
    success: boolean;
    error_message: string | null;
    created_at: string;
}

export interface PaginatedResult<T> {
    success: boolean;
    data: T[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

export const adminService = {
    // User APIs
    getUsers: async (params: {
        page?: number;
        limit?: number;
        q?: string;
        role?: string;
        status?: string;
        departmentId?: number | null;
        includeDeleted?: boolean;
        sortBy?: string;
        sortOrder?: string;
    }): Promise<PaginatedResult<AdminUser>> => {
        const query = new URLSearchParams();
        if (params.page) query.append('page', String(params.page));
        if (params.limit) query.append('limit', String(params.limit));
        if (params.q) query.append('q', params.q);
        if (params.role) query.append('role', params.role);
        if (params.status) query.append('status', params.status);
        if (params.departmentId) query.append('departmentId', String(params.departmentId));
        if (params.includeDeleted) query.append('includeDeleted', 'true');
        if (params.sortBy) query.append('sortBy', params.sortBy);
        if (params.sortOrder) query.append('sortOrder', params.sortOrder);

        return apiFetch(`/api/auth/admin/users?${query.toString()}`);
    },

    createUser: async (payload: {
        name: string;
        email: string;
        password?: string;
        role?: string;
        employee_code?: string;
        status?: string;
        departmentIds?: number[];
    }): Promise<{ success: boolean; data: AdminUser; message?: string }> => {
        return apiFetch('/api/auth/admin/users', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    },

    updateUser: async (
        userId: number,
        payload: {
            name?: string;
            email?: string;
            employee_code?: string;
            role?: string;
            status?: string;
            password?: string;
            updated_at?: string;
            departmentIds?: number[];
        }
    ): Promise<{ success: boolean; data: AdminUser; message?: string }> => {
        return apiFetch(`/api/auth/admin/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });
    },

    softDeleteUser: async (userId: number): Promise<{ success: boolean; message: string }> => {
        return apiFetch(`/api/auth/admin/users/${userId}`, {
            method: 'DELETE'
        });
    },

    restoreUser: async (userId: number): Promise<{ success: boolean; message: string }> => {
        return apiFetch(`/api/auth/admin/users/${userId}/restore`, {
            method: 'PATCH'
        });
    },

    setUserStatus: async (userId: number, status: 'active' | 'inactive'): Promise<{ success: boolean; message: string }> => {
        return apiFetch(`/api/auth/admin/users/${userId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
        });
    },

    resetUserPassword: async (userId: number, newPassword: string): Promise<{ success: boolean; message: string }> => {
        return apiFetch(`/api/auth/admin/users/${userId}/reset-password`, {
            method: 'POST',
            body: JSON.stringify({ newPassword })
        });
    },

    // Department APIs
    getDepartments: async (): Promise<{ success: boolean; data: AdminDepartment[] }> => {
        return apiFetch('/api/auth/admin/departments');
    },

    createDepartment: async (payload: {
        name: string;
        description?: string;
        userIds?: number[];
        permissions?: PermissionItem[];
    }): Promise<{ success: boolean; data: AdminDepartment; message?: string }> => {
        return apiFetch('/api/auth/admin/departments', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    },

    updateDepartment: async (
        deptId: number,
        payload: {
            name?: string;
            description?: string;
            userIds?: number[];
            permissions?: PermissionItem[];
            updated_at?: string;
        }
    ): Promise<{ success: boolean; data: AdminDepartment; message?: string }> => {
        return apiFetch(`/api/auth/admin/departments/${deptId}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });
    },

    deleteDepartment: async (deptId: number): Promise<{ success: boolean; message: string }> => {
        return apiFetch(`/api/auth/admin/departments/${deptId}`, {
            method: 'DELETE'
        });
    },

    // Audit Logs API
    getAuditLogs: async (params: {
        page?: number;
        limit?: number;
        q?: string;
        action?: string;
        startDate?: string;
        endDate?: string;
    }): Promise<PaginatedResult<AuditLogItem>> => {
        const query = new URLSearchParams();
        if (params.page) query.append('page', String(params.page));
        if (params.limit) query.append('limit', String(params.limit));
        if (params.q) query.append('q', params.q);
        if (params.action) query.append('action', params.action);
        if (params.startDate) query.append('startDate', params.startDate);
        if (params.endDate) query.append('endDate', params.endDate);

        return apiFetch(`/api/auth/admin/audit-logs?${query.toString()}`);
    },

    // Legacy Migration API
    migrateLegacyData: async (payload: {
        customUsers?: any[];
        departments?: any[];
    }): Promise<{ success: boolean; message: string; data: { usersMigrated: number; deptsMigrated: number } }> => {
        return apiFetch('/api/auth/admin/migrate-legacy', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    }
};
