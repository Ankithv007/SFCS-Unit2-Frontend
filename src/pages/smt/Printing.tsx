import React, { useState, useEffect } from 'react';
import styles from './Printing.module.css';

export const Printing: React.FC = () => {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [loggedInUser, setLoggedInUser] = useState<any>(null);
    const [userId, setUserId] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [activeBatch, setActiveBatch] = useState<any | null>(null);

    const [isAdminMode, setIsAdminMode] = useState(false);
    const [employees, setEmployees] = useState<any[]>([]);
    const [batches, setBatches] = useState<any[]>([]);
    const [empName, setEmpName] = useState('');
    const [empUserId, setEmpUserId] = useState('');
    const [empPassword, setEmpPassword] = useState('');
    const [editingEmpId, setEditingEmpId] = useState<string | null>(null);

    useEffect(() => {
        const fetchEmployees = async () => {
            try {
                const res = await fetch('/api/smt/employees');
                if (res.ok) {
                    const data = await res.json();
                    setEmployees(data.map((emp: any) => ({
                        id: emp.id.toString(),
                        name: emp.name,
                        userId: emp.user_id,
                        password: emp.password,
                        active: emp.is_active
                    })));
                }
            } catch (err) {
                console.error("Employee fetch error:", err);
            }
        };
        fetchEmployees();
    }, []);

    const handleCreateOrUpdateEmployee = (e: React.FormEvent) => {
        e.preventDefault();
        if (!empName || !empUserId || !empPassword) {
            setError('Please fill all employee fields.');
            return;
        }
        if (editingEmpId) {
            fetch(`/api/smt/employees/${editingEmpId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: empName, user_id: empUserId, password: empPassword })
            }).then(res => {
                if (res.ok) {
                    setEmployees(employees.map(emp => emp.id === editingEmpId ? { ...emp, name: empName, userId: empUserId, password: empPassword } : emp));
                    setEditingEmpId(null);
                }
            });
        } else {
            fetch('/api/smt/employees', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: empName, user_id: empUserId, password: empPassword })
            }).then(res => res.json()).then(data => {
                setEmployees([...employees, { 
                    id: data.id.toString(), 
                    name: data.name, 
                    userId: data.user_id, 
                    password: data.password, 
                    active: data.is_active 
                }]);
            });
        }
        setEmpName('');
        setEmpUserId('');
        setEmpPassword('');
        setError('');
    };

    const handleEditEmployee = (emp: any) => {
        setEmpName(emp.name);
        setEmpUserId(emp.userId);
        setEmpPassword(emp.password);
        setEditingEmpId(emp.id);
    };

    const handleToggleEmployeeStatus = (id: string) => {
        fetch(`/api/smt/employees/${id}/status`, { method: 'PATCH' }).then(res => {
            if (res.ok) setEmployees(employees.map(emp => emp.id === id ? { ...emp, active: !emp.active } : emp));
        });
    };

    const handleDeleteEmployee = (id: string) => {
        if (window.confirm("Are you sure you want to delete this employee?")) {
            fetch(`/api/smt/employees/${id}`, { method: 'DELETE' }).then(res => {
                if (res.ok) setEmployees(employees.filter(emp => emp.id !== id));
            });
        }
    };
    const getShift = () => {
        const hour = new Date().getHours();
        if (hour >= 23 || hour < 7) return 'C (11PM - 07AM)';
        if (hour >= 15 && hour < 23) return 'B (03PM - 11PM)';
        if (hour >= 8 && hour < 17) return 'G (08AM - 05PM)';
        if (hour >= 6 && hour < 15) return 'A (06AM - 03PM)';
        return 'N/A';
    };
    useEffect(() => {
        const fetchBatches = async () => {
            try {
                const res = await fetch('/api/smt/serial-numbers');
                if (res.ok) {
                    const data = await res.json();
                    // Process raw serials into batches for the UI
                    const grouped = data.reduce((acc: any, curr: any) => {
                        const woId = curr.work_order_id;
                        if (!acc[woId]) acc[woId] = {
                            id: woId,
                            work_order_id: woId,
                            product_name: "Loading...", // We don't have this in serial_numbers table, but we can fetch it later or ignore
                            starting_number: curr.serial_number,
                            end_number: curr.serial_number,
                            created_by: "API",
                            panel_qty: 0
                        };
                        // Simplified batch logic for display
                        acc[woId].end_number = curr.serial_number;
                        return acc;
                    }, {});
                    setBatches(Object.values(grouped));
                }
            } catch (err) {
                console.error("Batch fetch error:", err);
            }
        };
        fetchBatches();
    }, []);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (userId.trim() === '' || password.trim() === '') {
            setError('Please enter both User ID and Password.');
            return;
        }

        if (userId.toUpperCase() === 'ADMIN' && password === '1234') {
            setIsLoggedIn(true);
            setLoggedInUser({ name: 'System Admin', userId: 'ADMIN' });
            setError('');
            return;
        }

        const validEmp = employees.find(emp => emp.userId === userId && emp.password === password);
        if (validEmp) {
            if (!validEmp.active) {
                setError('This account is deactivated. Please contact an admin.');
            } else {
                setIsLoggedIn(true);
                setLoggedInUser(validEmp);
                setError('');
            }
        } else {
            setError('Invalid credentials.');
        }
    };

    const handleLogout = () => {
        setIsLoggedIn(false);
        setLoggedInUser(null);
        setUserId('');
        setPassword('');
        setActiveBatch(null);
    };

    const handlePrint = (batch: any) => {
        alert(`Printing Serial Numbers ${batch.starting_number} to ${batch.end_number}\nFor Work Order: ${batch.work_order_id}\n\nSending to Zebra Printer...`);
    };

    if (!isLoggedIn) {
        if (isAdminMode) {
            return (
                <div className={styles.container} style={{ minHeight: '80vh', padding: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.8rem', color: '#111827' }}>Admin - Manage Printing Employees</h2>
                        <button className={styles.secondaryButton} onClick={() => setIsAdminMode(false)}>
                            Back to Login
                        </button>
                    </div>

                    {error && (
                        <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1.5rem', fontWeight: 'bold' }}>
                            {error}
                        </div>
                    )}

                    <div className={styles.card} style={{ marginBottom: '2rem' }}>
                        <h3 style={{ marginBottom: '1rem', color: '#3730a3' }}>{editingEmpId ? 'Edit Employee' : 'Create Employee'}</h3>
                        <form onSubmit={handleCreateOrUpdateEmployee} style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            <div className={styles.inputGroup} style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
                                <label style={{ fontSize: '0.9rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.5rem' }}>Name *</label>
                                <input type="text" className={styles.input} value={empName} onChange={e => setEmpName(e.target.value)} placeholder="e.g. John Doe" />
                            </div>
                            <div className={styles.inputGroup} style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
                                <label style={{ fontSize: '0.9rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.5rem' }}>User ID *</label>
                                <input type="text" className={styles.input} value={empUserId} onChange={e => setEmpUserId(e.target.value)} placeholder="e.g. emp001" />
                            </div>
                            <div className={styles.inputGroup} style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
                                <label style={{ fontSize: '0.9rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.5rem' }}>Password *</label>
                                <input type="text" className={styles.input} value={empPassword} onChange={e => setEmpPassword(e.target.value)} placeholder="Enter password" />
                            </div>
                            <button type="submit" className={styles.button} style={{ height: '42px', padding: '0 2rem' }}>
                                {editingEmpId ? 'Update Employee' : 'Register Employee'}
                            </button>
                        </form>
                    </div>

                    <div className={styles.card}>
                        <h3 style={{ marginBottom: '1.5rem', color: '#3730a3' }}>Employee Directory</h3>
                        <div className={styles.tableContainer}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>NAME</th>
                                        <th>USER ID</th>
                                        <th>STATUS</th>
                                        <th style={{ textAlign: 'center' }}>ACTIONS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {employees.map(emp => (
                                        <tr key={emp.id}>
                                            <td style={{ fontWeight: 500 }}>{emp.name}</td>
                                            <td>{emp.userId}</td>
                                            <td>
                                                <span style={{ 
                                                    padding: '4px 8px', 
                                                    borderRadius: '4px', 
                                                    fontSize: '0.85rem', 
                                                    fontWeight: 'bold',
                                                    backgroundColor: emp.active ? '#d1fae5' : '#fee2e2',
                                                    color: emp.active ? '#065f46' : '#991b1b'
                                                }}>
                                                    {emp.active ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>
                                                    <button onClick={() => handleToggleEmployeeStatus(emp.id)} title={emp.active ? "Deactivate" : "Activate"} style={{ background: 'none', border: 'none', cursor: 'pointer', color: emp.active ? '#ef4444' : '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>
                                                    </button>
                                                    <button onClick={() => handleEditEmployee(emp)} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                                    </button>
                                                    <button onClick={() => handleDeleteEmployee(emp.id)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {employees.length === 0 && (
                                        <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>No employees registered.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className={styles.container} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
                <div className={styles.card} style={{ maxWidth: '400px', width: '100%', position: 'relative' }}>
                    <button 
                        onClick={() => {
                            const pwd = prompt("Enter Admin Password:");
                            if (pwd === "admin123") setIsAdminMode(true);
                            else if (pwd) alert("Incorrect Password");
                        }} 
                        style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#9ca3af' }}
                        title="Admin Mode"
                    >
                        🔒
                    </button>
                    <div style={{ textAlign: 'center', marginBottom: '2rem', marginTop: '1rem' }}>
                        <h2 style={{ fontSize: '1.8rem', color: '#111827', marginBottom: '0.5rem' }}>🖨️ Printing Auth</h2>
                        <p style={{ color: '#6b7280' }}>Please log in to access the printer controls.</p>
                    </div>
                    
                    {error && (
                        <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1.5rem', fontSize: '0.9rem', textAlign: 'center', fontWeight: 'bold' }}>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div className={styles.inputGroup}>
                            <label>User ID *</label>
                            <input 
                                type="text" 
                                className={styles.input}
                                placeholder="Enter your User ID"
                                value={userId}
                                onChange={(e) => setUserId(e.target.value)}
                            />
                        </div>
                        
                        <div className={styles.inputGroup} style={{ position: 'relative' }}>
                            <label>Password *</label>
                            <input 
                                type={showPassword ? "text" : "password"} 
                                className={styles.input}
                                placeholder="Enter password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                style={{ paddingRight: '2.5rem' }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute',
                                    right: '0.75rem',
                                    top: '2.4rem',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#6b7280',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '0'
                                }}
                            >
                                {showPassword ? (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                ) : (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                )}
                            </button>
                        </div>

                        <button type="submit" className={styles.button} style={{ width: '100%', marginTop: '0.5rem' }}>
                            Login to Printer Station
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2>🖨️ Printing Station</h2>
                    <p>Manage SMT Printing tasks. Logged in as: <strong>{loggedInUser?.name} ({loggedInUser?.userId})</strong> | Shift: <strong>{getShift()}</strong></p>
                </div>
                <button 
                    onClick={handleLogout} 
                    className={styles.secondaryButton}
                    style={{ borderColor: '#ef4444', color: '#ef4444' }}
                >
                    Logout
                </button>
            </div>
            
            {activeBatch && (
                <div className={styles.card} style={{ backgroundColor: '#e0e7ff', border: '1px solid #c7d2fe', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h3 style={{ margin: 0, color: '#3730a3', borderBottom: 'none', paddingBottom: 0 }}>Print Preview Details</h3>
                            <p style={{ margin: '0.5rem 0 0 0', color: '#4338ca', fontSize: '1.1rem' }}>
                                Total Labels to Print: <strong>{activeBatch.end_number - activeBatch.starting_number + 1}</strong>
                            </p>
                            <p style={{ margin: '0.25rem 0 0 0', color: '#4f46e5', fontSize: '0.95rem' }}>
                                Range: {activeBatch.starting_number} to {activeBatch.end_number} | WO: {activeBatch.work_order_id}
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button 
                                className={styles.secondaryButton}
                                style={{ backgroundColor: 'transparent', borderColor: '#818cf8', color: '#4f46e5' }}
                                onClick={() => setActiveBatch(null)}
                            >
                                Close
                            </button>
                            <button 
                                className={styles.button}
                                onClick={() => handlePrint(activeBatch)}
                            >
                                Print Now
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className={styles.card}>
                <h3>Ready for Printing</h3>
                <p style={{ color: '#6b7280', marginTop: '1rem', marginBottom: '2rem' }}>
                    Select a generated batch below to view details or print the serial number labels.
                </p>
                
                <div className={styles.tableContainer}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>WO NUMBER</th>
                                <th>PRODUCT NAME</th>
                                <th>PANEL QTY</th>
                                <th>SERIAL RANGE</th>
                                <th>GENERATED BY</th>
                                <th>ACTION</th>
                            </tr>
                        </thead>
                        <tbody>
                            {batches.map((batch) => (
                                <tr key={batch.id} style={{ backgroundColor: activeBatch?.id === batch.id ? '#f3f4f6' : 'transparent' }}>
                                    <td style={{ color: '#2563eb', fontWeight: 600 }}>{batch.work_order_id}</td>
                                    <td style={{ fontWeight: 600 }}>{batch.product_name}</td>
                                    <td>{batch.panel_qty}</td>
                                    <td>{batch.starting_number} - {batch.end_number}</td>
                                    <td>{batch.created_by}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button 
                                                className={styles.secondaryButton}
                                                style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                                                onClick={() => setActiveBatch(batch)}
                                            >
                                                View
                                            </button>
                                            <button 
                                                className={styles.button}
                                                style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                                                onClick={() => handlePrint(batch)}
                                            >
                                                Print
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {batches.length === 0 && (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                                        No serial number batches have been generated yet.
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
