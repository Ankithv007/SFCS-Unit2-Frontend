import React, { useState, useEffect } from 'react';
import styles from './AdminPanel.module.css';
import { useAuth } from '../../hooks/useAuth';
import type { User } from '../../hooks/useAuth';
import { useToast } from '../../components/Toast';

interface UserWithRole extends User {
    role: string;
    created_at: string;
    status: string;
}

const ROLES = ['Super Admin', 'Admin', 'Manager', 'Supervisor', 'User'];

export const AdminPanel: React.FC = () => {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState<UserWithRole[]>([]);
    const [loading, setLoading] = useState(true);
    const { showToast } = useToast();

    useEffect(() => {
        fetchUsers();
    }, []);

    const isFetching = React.useRef(false);

    const fetchUsers = async () => {
        // Prevent multiple simultaneous fetch requests
        if (isFetching.current) return;
        isFetching.current = true;

        try {
            const token = localStorage.getItem('auth_token');
            const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

            // Fetch users from the admin API
            const response = await fetch(`${baseUrl}/api/admin/users`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                setUsers(data);
            } else {
                const errorText = await response.text();
                console.error('Fetch users failed:', response.status, errorText);

                // If unauthorized (401), it means the session has expired
                if (response.status === 401) {
                    showToast('Session expired. Please login again.', 'error');
                } else {
                    showToast(`Failed to fetch users: ${response.status} ${response.statusText}`, 'error');
                }
            }
        } catch (error) {
            console.error('Error fetching users:', error);
            showToast('Network error', 'error');
        } finally {
            setLoading(false);
            isFetching.current = false;
        }
    };

    const handleRoleChange = async (targetUserId: string, newRole: string) => {
        if (!currentUser) return;

        // Frontend Permission Check
        if (!canAssignRole(currentUser.role, newRole)) {
            showToast(`You do not have permission to assign the role: ${newRole}`, 'error');
            return;
        }

        try {
            const token = localStorage.getItem('auth_token');
            const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
            const response = await fetch(`${baseUrl}/api/admin/users/${targetUserId}/role`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ role: newRole })
            });

            if (response.ok) {
                showToast('User role updated successfully', 'success');
                fetchUsers(); // Refresh list
            } else {
                const error = await response.json();
                showToast(error.message || 'Failed to update role', 'error');
            }
        } catch (error) {
            console.error('Error updating role:', error);
            showToast('Network error', 'error');
        }
    };

    const canAssignRole = (myRole: string, targetRole: string): boolean => {
        const hierarchy: { [key: string]: number } = {
            'Super Admin': 4,
            'Admin': 3,
            'Manager': 2,
            'Supervisor': 1,
            'User': 0
        };

        if (myRole === 'Super Admin') return true;

        // Cannot assign role higher or equal to self
        if (hierarchy[myRole] <= hierarchy[targetRole]) return false;

        return true;
    };

    const getRoleBadgeClass = (role: string) => {
        switch (role) {
            case 'Super Admin': return styles.badgeAdmin;
            case 'Admin': return styles.badgeAdmin;
            case 'Manager': return styles.badgeManager;
            case 'Supervisor': return styles.badgeSupervisor;
            default: return styles.badgeUser;
        }
    };

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
                <p>Manage users and assign roles based on your permissions.</p>
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
                                <th>Current Role</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.length > 0 ? (
                                filteredUsers.map(user => (
                                    <tr key={user.id}>
                                        <td style={{ fontWeight: 500 }}>{user.name}</td>
                                        <td>{user.email}</td>
                                        <td>
                                            <span className={`${styles.badge} ${getRoleBadgeClass(user.role)}`}>
                                                {user.role || 'User'}
                                            </span>
                                        </td>
                                        <td>{user.status}</td>
                                        <td>
                                            <select
                                                className={styles.roleSelect}
                                                value={user.role || 'User'}
                                                onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                                disabled={!currentUser || currentUser.id === user.id} // Cannot change own role
                                            >
                                                {ROLES.map(role => (
                                                    <option key={role} value={role}>
                                                        {role}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>
                                        No users found matching "{searchQuery}"
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
