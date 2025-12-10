import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from './Sidebar.module.css';

interface SidebarProps {
    isExpanded: boolean;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isExpanded, onMouseEnter, onMouseLeave }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [expandedModule, setExpandedModule] = useState<string | null>('sales-purchase');

    const toggleModule = (module: string) => {
        setExpandedModule(expandedModule === module ? null : module);
    };

    const isActive = (path: string) => location.pathname === path;

    return (
        <div
            className={`${styles.sidebar} ${isExpanded ? styles.expanded : ''}`}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            <div
                className={`${styles.menuItem} ${isActive('/dashboard') ? styles.active : ''}`}
                onClick={() => navigate('/dashboard')}
                title="Home"
            >
                <span className={styles.menuIcon}>🏠</span>
                <span className={styles.menuText}>Home</span>
            </div>

            {/* Sales & Purchase Module */}
            <div
                className={`${styles.menuItem} ${expandedModule === 'sales-purchase' ? styles.active : ''}`}
                onClick={() => toggleModule('sales-purchase')}
                title="Sales & Purchase"
            >
                <span className={styles.menuIcon}>📋</span>
                <span className={styles.menuText}>Sales & Purchase</span>
                <span className={styles.arrow}>{expandedModule === 'sales-purchase' ? '▼' : '▶'}</span>
            </div>

            {expandedModule === 'sales-purchase' && (
                <div className={styles.submenu}>
                    <a href="#" className={styles.exploreLink}>Explore Sales & Purchase ›</a>

                    <div className={styles.submenuHeader}>PAGES</div>
                    <div className={`${styles.submenuItem} ${styles.greenHover}`}>
                        <span className={styles.menuIcon}>🧾</span> Sales Transactions (Active) ↗
                    </div>
                    <div className={styles.submenuItem}>
                        <span className={styles.menuIcon}>🛍️</span> Purchase Transactions ↗
                    </div>
                    <div className={styles.submenuItem}>
                        <span className={styles.menuIcon}>➤</span> View Sales Quotations ↗
                    </div>
                    <div className={styles.submenuItem}>
                        <span className={styles.menuIcon}>📁</span> All Documents ↗
                    </div>
                    <div className={styles.submenuItem}>
                        <span className={styles.menuIcon}>🔔</span> All Reminders ↗
                    </div>

                    <div className={styles.submenuHeader}>ACTIONS</div>
                    <div className={styles.actionItem}>
                        + Create Order Confirmation ↗
                    </div>
                    <div className={styles.actionItem}>
                        + Create Purchase Order ↗
                    </div>
                    <div className={styles.actionItem}>
                        + Create Invoice ↗
                    </div>
                    <div className={styles.actionItem}>
                        + Create Sales Quotation ↗
                    </div>
                </div>
            )}

            <div className={styles.menuItem} title="Inventory">
                <span className={styles.menuIcon}>📦</span>
                <span className={styles.menuText}>Inventory</span>
                <span className={styles.arrow}>▶</span>
            </div>
            <div className={styles.menuItem} title="Production">
                <span className={styles.menuIcon}>🏭</span>
                <span className={styles.menuText}>Production</span>
                <span className={styles.arrow}>▶</span>
            </div>
            <div className={styles.menuItem} title="Payments">
                <span className={styles.menuIcon}>₹</span>
                <span className={styles.menuText}>Payments</span>
                <span className={styles.arrow}>▶</span>
            </div>
            <div className={styles.menuItem} title="Reports & Intelligence">
                <span className={styles.menuIcon}>📈</span>
                <span className={styles.menuText}>Reports & Intelligence</span>
                <span className={styles.arrow}>▶</span>
            </div>
            <div className={styles.menuItem} title="Resource planning">
                <span className={styles.menuIcon}>💡</span>
                <span className={styles.menuText}>Resource planning</span>
                <span className={styles.arrow}>▶</span>
            </div>
            <div className={styles.menuItem} title="Approvals">
                <span className={styles.menuIcon}>✅</span>
                <span className={styles.menuText}>Approvals</span>
                <span className={styles.arrow}>▶</span>
            </div>
            <div className={styles.menuItem} title="Accounting Integration">
                <span className={styles.menuIcon}>💵</span>
                <span className={styles.menuText}>Accounting Integration</span>
                <span className={styles.arrow}>▶</span>
            </div>
            <div className={styles.menuItem} title="Buyers & Suppliers">
                <span className={styles.menuIcon}>👥</span>
                <span className={styles.menuText}>Buyers & Suppliers</span>
                <span className={styles.arrow}>▶</span>
            </div>
            <div className={styles.menuItem} title="Task Dashboard">
                <span className={styles.menuIcon}>📋</span>
                <span className={styles.menuText}>Task Dashboard</span>
                <span className={styles.arrow}>▶</span>
            </div>
        </div>
    );
};
