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
    const [expandedModule, setExpandedModule] = useState<string | null>(null);

    const toggleModule = (module: string) => {
        setExpandedModule(expandedModule === module ? null : module);
    };

    const isActive = (path: string) => location.pathname === path;

    const handleMouseLeave = () => {
        onMouseLeave();
        setExpandedModule(null);
    };

    return (
        <div
            className={`${styles.sidebar} ${isExpanded ? styles.expanded : ''}`}
            onMouseEnter={onMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <div
                className={`${styles.menuItem} ${isActive('/dashboard') ? styles.active : ''}`}
                onClick={() => navigate('/dashboard')}
                title="Home"
            >
                <span className={styles.menuIcon}>🏠</span>
                <span className={styles.menuText}>Home</span>
            </div>

            {/* Inventory & Report Module */}
            <div className={styles.moduleWrapper}>
                <div
                    className={`${styles.menuItem} ${expandedModule === 'inventory-report' ? styles.active : ''}`}
                    onClick={() => toggleModule('inventory-report')}
                    onMouseEnter={() => setExpandedModule('inventory-report')}
                    title="Inventory & Report"
                >
                    <span className={styles.menuIcon}>📦</span>
                    <span className={styles.menuText}>Inventory & Report</span>
                    <span className={styles.arrow}>{expandedModule === 'inventory-report' ? '▼' : '▶'}</span>
                </div>

                {expandedModule === 'inventory-report' && (
                    <div className={styles.submenu}>

                        <div
                            className={`${styles.submenuItem} ${isActive('/purchase-order') ? styles.activeSubmenu : ''}`}
                            onClick={() => navigate('/purchase-order')}
                        >
                            <span className={styles.menuIcon}>📝</span> Purchase Order (PO)
                        </div>
                        <div
                            className={`${styles.submenuItem} ${isActive('/wip-stack') ? styles.activeSubmenu : ''}`}
                            onClick={() => navigate('/wip-stack')}
                        >
                            <span className={styles.menuIcon}>🏭</span> WIP Stack [Prod]
                        </div>
                        <div
                            className={`${styles.submenuItem} ${isActive('/return-wip') ? styles.activeSubmenu : ''}`}
                            onClick={() => navigate('/return-wip')}
                        >
                            <span className={styles.menuIcon}>↩️</span> Return From WIP
                        </div>
                    </div>
                )}
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
