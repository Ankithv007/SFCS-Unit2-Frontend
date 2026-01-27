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

            <div
                className={`${styles.menuItem} ${isActive('/admin-panel') ? styles.active : ''}`}
                onClick={() => navigate('/admin-panel')}
                title="Admin Panel"
            >
                <span className={styles.menuIcon}>🛡️</span>
                <span className={styles.menuText}>Admin Panel</span>
            </div>

            <div
                className={`${styles.menuItem} ${isActive('/qc-inspection') ? styles.active : ''}`}
                onClick={() => navigate('/qc-inspection')}
                title="QC Inspection"
            >
                <span className={styles.menuIcon}>📋</span>
                <span className={styles.menuText}>QC Inspection</span>
            </div>

            <div
                className={`${styles.menuItem} ${isActive('/vacuum-leak-test') ? styles.active : ''}`}
                onClick={() => navigate('/vacuum-leak-test')}
                title="Vacuum Leak Test"
            >
                <span className={styles.menuIcon}>🔬</span>
                <span className={styles.menuText}>Vacuum Leak Test</span>
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
                        <div
                            className={`${styles.submenuItem} ${isActive('/report') ? styles.activeSubmenu : ''}`}
                            onClick={() => navigate('/report')}
                        >
                            <span className={styles.menuIcon}>📊</span> Report
                        </div>
                    </div>
                )}
            </div>

            {/* Pre testing Module */}
            <div className={styles.moduleWrapper}>
                <div
                    className={`${styles.menuItem} ${expandedModule === 'pre-testing' ? styles.active : ''}`}
                    onClick={() => toggleModule('pre-testing')}
                    onMouseEnter={() => setExpandedModule('pre-testing')}
                    title="Pre testing (E2E)"
                >
                    <span className={styles.menuIcon}>🧪</span>
                    <span className={styles.menuText}>Pre testing (E2E)</span>
                    <span className={styles.arrow}>{expandedModule === 'pre-testing' ? '▼' : '▶'}</span>
                </div>

                {expandedModule === 'pre-testing' && (
                    <div className={styles.submenu}>
                        <div
                            className={`${styles.submenuItem} ${isActive('/pre-testing/warehouse') ? styles.activeSubmenu : ''}`}
                            onClick={() => navigate('/pre-testing/warehouse')}
                        >
                            <span className={styles.menuIcon}>🏭</span> Warehouse
                        </div>
                        <div
                            className={`${styles.submenuItem} ${isActive('/pre-testing/iqc') ? styles.activeSubmenu : ''}`}
                            onClick={() => navigate('/pre-testing/iqc')}
                        >
                            <span className={styles.menuIcon}>🔍</span> Pre-IQC
                        </div>
                        <div
                            className={`${styles.submenuItem} ${isActive('/pre-testing/impedance') ? styles.activeSubmenu : ''}`}
                            onClick={() => navigate('/pre-testing/impedance')}
                        >
                            <span className={styles.menuIcon}>⚡</span> Pre-Impedance
                        </div>
                        <div
                            className={`${styles.submenuItem} ${isActive('/pre-testing/calibration') ? styles.activeSubmenu : ''}`}
                            onClick={() => navigate('/pre-testing/calibration')}
                        >
                            <span className={styles.menuIcon}>⚖️</span> Pre-Calibration
                        </div>
                        <div
                            className={`${styles.submenuItem} ${isActive('/pre-testing/aclr') ? styles.activeSubmenu : ''}`}
                            onClick={() => navigate('/pre-testing/aclr')}
                        >
                            <span className={styles.menuIcon}>📶</span> Pre-ACLR
                        </div>
                        <div
                            className={`${styles.submenuItem} ${isActive('/pre-testing/final-qc') ? styles.activeSubmenu : ''}`}
                            onClick={() => navigate('/pre-testing/final-qc')}
                        >
                            <span className={styles.menuIcon}>🛡️</span> Pre-Rework
                        </div>
                    </div>
                )}
            </div>
            <div className={styles.menuItem} title="Post testing">
                <span className={styles.menuIcon}>✅</span>
                <span className={styles.menuText}>Post testing</span>
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
