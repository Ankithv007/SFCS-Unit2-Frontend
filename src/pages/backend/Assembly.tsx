import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import styles from './Assembly.module.css';
import { useToast } from '../../components/Toast';
import { Settings } from 'lucide-react';

interface Item {
    id: number;
    name: string;
    created_at: string;
}

const Assembly: React.FC = () => {
    const [items, setItems] = useState<Item[]>([]);
    const [name, setName] = useState('');
    const { showToast } = useToast();

    useEffect(() => {
        fetchItems();
    }, []);

    const fetchItems = async () => {
        try {
            const data = await apiFetch('/api/backend/assembly');
            if (data) setItems(data);
        } catch (error) {
            showToast('Failed to load items', 'error');
        }
    };

    const handleCreate = async () => {
        if (!name) {
            showToast('Name is required', 'error');
            return;
        }
        try {
            await apiFetch('/api/backend/assembly', {
                method: 'POST',
                body: JSON.stringify({ name })
            });
            showToast('Item created successfully', 'success');
            setName('');
            fetchItems();
        } catch (error) {
            showToast('Failed to create item', 'error');
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.headerRow}>
                <div className={styles.headerContent}>
                    <h2><Settings size={24} /> Assembly</h2>
                    <p>Manage Assembly for Backend Processing</p>
                </div>
            </div>

            <div className={styles.card}>
                <h3>Create New Item</h3>
                <div className={styles.formGrid}>
                    <div className={styles.inputGroup}>
                        <label>Item Name</label>
                        <input 
                            type="text" 
                            className={styles.input} 
                            value={name} 
                            onChange={(e) => setName(e.target.value)} 
                            placeholder="Enter name"
                        />
                    </div>
                </div>
                <button className={styles.button} onClick={handleCreate}>Create</button>
            </div>

            <div className={styles.card}>
                <h3>Items List</h3>
                <div className={styles.tableContainer}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>NAME</th>
                                <th>CREATED AT</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.length > 0 ? (
                                items.map((item) => (
                                    <tr key={item.id}>
                                        <td>{item.id}</td>
                                        <td>{item.name}</td>
                                        <td>{new Date(item.created_at).toLocaleString()}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={3} style={{ textAlign: 'center' }}>No items found</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Assembly;
