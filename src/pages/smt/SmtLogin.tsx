import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSmtAuth } from '../../context/SmtAuthContext';
import styles from './SmtLogin.module.css';

export const SmtLogin: React.FC = () => {
    const { smtLogin } = useSmtAuth();
    const navigate = useNavigate();
    const location = useLocation();
    
    // Login State
    const [userId, setUserId] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Admin State
    const [isAdminMode, setIsAdminMode] = useState(false);
    const [employees, setEmployees] = useState<any[]>([]);
    const [empName, setEmpName] = useState('');
    const [empUserId, setEmpUserId] = useState('');
    const [empPassword, setEmpPassword] = useState('');
    const [editingEmpId, setEditingEmpId] = useState<string | null>(null);

    const from = location.state?.from?.pathname || '/smt/work-order';

    useEffect(() => {
        if (isAdminMode) {
            fetchEmployees();
        }
    }, [isAdminMode]);

    const fetchEmployees = async () => {
        try {
            const res = await fetch('/api/smt/employees');
            if (res.ok) {
                const data = await res.json();
                setEmployees(data);
            }
        } catch (err) {
            console.error("Employee fetch error:", err);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userId || !password) {
            setError('Please enter both Employee Code and Password.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            if (userId.toUpperCase() === 'ADMIN' && password === '1234') {
                smtLogin({ id: 'admin', name: 'System Admin', userId: 'ADMIN' });
                navigate(from, { replace: true });
                return;
            }

            const res = await fetch('/api/smt/employees/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: userId, password })
            });

            if (res.ok) {
                const data = await res.json();
                const validEmp = data.employee;
                if (!validEmp.is_active) {
                    setError('This account is deactivated. Please contact an admin.');
                } else {
                    smtLogin({ 
                        id: validEmp.id.toString(), 
                        name: validEmp.name, 
                        userId: validEmp.user_id 
                    });
                    navigate(from, { replace: true });
                }
                return;
            }

            // --- Step 3: Try Central Auth Login (Super Admin, Admin, Manager) ---
            // We treat the "userId" field as the email for central accounts
            const authRes = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: userId, password })
            });

            if (authRes.ok) {
                const authData = await authRes.json();
                const globalUser = authData.user;
                
                // Allow only authorized roles
                const authorizedRoles = ['Super Admin', 'Admin', 'Manager'];
                if (authorizedRoles.includes(globalUser.role)) {
                    smtLogin({
                        id: globalUser.id.toString(),
                        name: globalUser.name,
                        userId: globalUser.email
                    });
                    navigate(from, { replace: true });
                } else {
                    setError('Access Denied: Only Admins or Managers can access SMT tools.');
                }
            } else {
                const errData = await authRes.json();
                setError(errData.message || 'Invalid credentials.');
            }
        } catch (err) {
            setError('Connection error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateOrUpdateEmployee = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!empName || !empUserId || !empPassword) {
            alert('Please fill all employee fields.');
            return;
        }

        try {
            const method = editingEmpId ? 'PUT' : 'POST';
            const url = editingEmpId ? `/api/smt/employees/${editingEmpId}` : '/api/smt/employees';
            
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: empName, user_id: empUserId, password: empPassword })
            });

            if (res.ok) {
                fetchEmployees();
                setEmpName('');
                setEmpUserId('');
                setEmpPassword('');
                setEditingEmpId(null);
            }
        } catch (err) {
            console.error("Save error:", err);
        }
    };

    const handleToggleStatus = async (id: string) => {
        try {
            const res = await fetch(`/api/smt/employees/${id}/status`, { method: 'PATCH' });
            if (res.ok) fetchEmployees();
        } catch (err) {
            console.error("Status toggle error:", err);
        }
    };

    const handleDeleteEmployee = async (id: string) => {
        if (window.confirm("Are you sure you want to delete this employee?")) {
            try {
                const res = await fetch(`/api/smt/employees/${id}`, { method: 'DELETE' });
                if (res.ok) fetchEmployees();
            } catch (err) {
                console.error("Delete error:", err);
            }
        }
    };

    const handleAdminIconClick = () => {
        const pwd = prompt("Enter Admin Password:");
        if (pwd === "admin123") {
            setIsAdminMode(true);
        } else if (pwd !== null) {
            alert("Incorrect Password");
        }
    };

    if (isAdminMode) {
        return (
            <div className={styles.container}>
                <div className={styles.adminCard}>
                    <div className={styles.adminHeader}>
                        <div>
                            <h2 className={styles.title}>SMT Admin Panel</h2>
                            <p className={styles.subtitle}>Manage employee access and credentials</p>
                        </div>
                        <button className={styles.secondaryButton} onClick={() => setIsAdminMode(false)}>
                            Back to Login
                        </button>
                    </div>

                    <form onSubmit={handleCreateOrUpdateEmployee} className={styles.adminForm}>
                        <div className={styles.inputGroup}>
                            <label>Full Name</label>
                            <input type="text" className={styles.input} value={empName} onChange={e => setEmpName(e.target.value)} placeholder="e.g. John Doe" />
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Employee Code</label>
                            <input type="text" className={styles.input} value={empUserId} onChange={e => setEmpUserId(e.target.value)} placeholder="e.g. EMP001" />
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Password</label>
                            <input type="text" className={styles.input} value={empPassword} onChange={e => setEmpPassword(e.target.value)} placeholder="Enter password" />
                        </div>
                        <button type="submit" className={styles.loginButton}>
                            {editingEmpId ? 'Update User' : 'Register User'}
                        </button>
                    </form>

                    <div className={styles.tableContainer}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Employee Code</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: 'center' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {employees.map(emp => (
                                    <tr key={emp.id}>
                                        <td style={{ fontWeight: 600 }}>{emp.name}</td>
                                        <td>{emp.user_id}</td>
                                        <td>
                                            <span className={`${styles.statusBadge} ${emp.is_active ? styles.statusActive : styles.statusInactive}`}>
                                                {emp.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className={styles.actions}>
                                                <button 
                                                    className={`${styles.iconButton} ${styles.statusButton} ${emp.is_active ? styles.deactivate : ''}`}
                                                    onClick={() => handleToggleStatus(emp.id)}
                                                    title={emp.is_active ? "Deactivate" : "Activate"}
                                                >
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>
                                                </button>
                                                <button 
                                                    className={`${styles.iconButton} ${styles.editButton}`}
                                                    onClick={() => {
                                                        setEditingEmpId(emp.id);
                                                        setEmpName(emp.name);
                                                        setEmpUserId(emp.user_id);
                                                        setEmpPassword(emp.password);
                                                    }}
                                                    title="Edit"
                                                >
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                                </button>
                                                <button 
                                                    className={`${styles.iconButton} ${styles.deleteButton}`}
                                                    onClick={() => handleDeleteEmployee(emp.id)}
                                                    title="Delete"
                                                >
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {employees.length === 0 && (
                                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>No users found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.loginCard}>
                <button className={styles.adminLock} onClick={handleAdminIconClick} title="Admin Access">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                </button>
                <div className={styles.header}>
                    <span className={styles.logo}>⚙️</span>
                    <h2 className={styles.title}>SMT Portal Login</h2>
                    <p className={styles.subtitle}>Please enter your credentials to access SMT tools</p>
                </div>

                {error && <div className={styles.error}>{error}</div>}

                <form onSubmit={handleLogin} className={styles.form}>
                    <div className={styles.inputGroup}>
                        <label htmlFor="userId">Employee Code</label>
                        <input
                            id="userId"
                            type="text"
                            className={styles.input}
                            placeholder="Enter your Employee Code"
                            value={userId}
                            onChange={(e) => setUserId(e.target.value)}
                            autoFocus
                        />
                    </div>

                    <div className={styles.inputGroup}>
                        <label htmlFor="password">Password</label>
                        <div className={styles.inputWrapper}>
                            <input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                className={styles.input}
                                placeholder="Enter password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <button
                                type="button"
                                className={styles.passwordToggle}
                                onClick={() => setShowPassword(!showPassword)}
                                tabIndex={-1}
                            >
                                {showPassword ? (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                ) : (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                )}
                            </button>
                        </div>
                    </div>

                    <button type="submit" className={styles.loginButton} disabled={loading}>
                        {loading ? 'Authenticating...' : 'Login to SMT Station'}
                    </button>
                </form>
            </div>
        </div>
    );
};
