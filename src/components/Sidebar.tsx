import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSmtAuth } from '../context/SmtAuthContext';
import { useToast } from './Toast';
import styles from './Sidebar.module.css';

interface SidebarProps {
    isExpanded: boolean;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isExpanded, onMouseEnter, onMouseLeave }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { smtUser } = useSmtAuth();
    const { showToast } = useToast();
    const [expandedModule, setExpandedModule] = useState<string | null>(null);

    const isSmtAdmin = smtUser && ['Super Admin', 'Admin', 'Manager'].includes(smtUser.role);

    useEffect(() => {
        if (location.pathname.startsWith('/pre-testing')) setExpandedModule('pre-testing');
        else if (location.pathname.startsWith('/smt')) setExpandedModule('smt');
        else if (location.pathname.startsWith('/backend')) setExpandedModule('backend');
        else if (location.pathname === '/purchase-order' || location.pathname === '/wip-stack' || location.pathname === '/return-wip' || location.pathname === '/report') setExpandedModule('inventory-report');
    }, [location.pathname]);

    useEffect(() => {
        if (location.state?.accessError) {
            showToast(location.state.accessError, 'error');
            // Clear history state immediately to prevent toast from reappearing on refresh
            window.history.replaceState({}, document.title);
        }
    }, [location.state, showToast]);

    const toggleModule = (module: string) => {
        setExpandedModule(expandedModule === module ? null : module);
    };

    const isActive = (path: string) => location.pathname === path;

    const handleMouseLeave = () => {
        onMouseLeave();
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
{/* SMT Module */}
            <div className={styles.moduleWrapper}>
                <div
                    className={`${styles.menuItem} ${expandedModule === 'smt' ? styles.active : ''}`}
                    onClick={() => toggleModule('smt')}
                    title="SMT"
                >
                    <span className={styles.menuIcon}>
                        <img 
                            src="https://img.icons8.com/?size=100&id=T0drIznsJmCi&format=png&color=000000" 
                            alt="SMT" 
                            className={styles.imageIcon}
                        />
                    </span>
                    <span className={styles.menuText}>SMT</span>
                    <span className={styles.arrow}>{expandedModule === 'smt' ? '▼' : '▶'}</span>
                </div>

                {expandedModule === 'smt' && (
                    <div className={styles.submenu}>
                        <div
                            className={`${styles.submenuItem} ${isActive('/smt/work-order') ? styles.activeSubmenu : ''}`}
                            onClick={() => {
                                if (isSmtAdmin) {
                                    navigate('/smt/work-order');
                                } else {
                                    showToast('Access Denied: Only Admins or Managers can access this page.', 'error');
                                }
                            }}
                        >
                            <span className={styles.menuIcon}>
                                <img src="https://img.icons8.com/?size=100&id=cjZ5daEtmKUc&format=png&color=000000" alt="icon" className={styles.imageIcon} />
                            </span> Work Order
                        </div>
                        <div
                            className={`${styles.submenuItem} ${isActive('/smt/workorder-history') ? styles.activeSubmenu : ''}`}
                            onClick={() => {
                                if (isSmtAdmin) {
                                    navigate('/smt/workorder-history', { state: { areaId: 'SMT' } });
                                } else {
                                    showToast('Access Denied: Only Admins or Managers can access this page.', 'error');
                                }
                            }}
                        >
                            <span className={styles.menuIcon}>
                                <img src="https://img.icons8.com/?size=100&id=cjZ5daEtmKUc&format=png&color=000000" alt="icon" className={styles.imageIcon} />
                            </span> Work Order History
                        </div>
                        <div
                            className={`${styles.submenuItem} ${isActive('/smt/serial-number') ? styles.activeSubmenu : ''}`}
                            onClick={() => navigate('/smt/serial-number')}
                        >
                            <span className={styles.menuIcon}>
                                <img src="https://img.icons8.com/?size=100&id=cjZ5daEtmKUc&format=png&color=000000" alt="icon" className={styles.imageIcon} />
                            </span> Serial Number
                        </div>
                        <div
                            className={`${styles.submenuItem} ${isActive('/smt/pcb-generation') ? styles.activeSubmenu : ''}`}
                            onClick={() => navigate('/smt/pcb-generation')}
                        >
                            <span className={styles.menuIcon}>
                                <img src="https://img.icons8.com/?size=100&id=cjZ5daEtmKUc&format=png&color=000000" alt="icon" className={styles.imageIcon} />
                            </span> PCB Registration
                        </div>
                        <div
                            className={`${styles.submenuItem} ${isActive('/smt/solder-paste') ? styles.activeSubmenu : ''}`}
                            onClick={() => navigate('/smt/solder-paste')}
                        >
                            <span className={styles.menuIcon}>
                                <img src="https://img.icons8.com/?size=100&id=cjZ5daEtmKUc&format=png&color=000000" alt="icon" className={styles.imageIcon} />
                            </span> Solder Paste Mgmt
                        </div>
                        <div
                            className={`${styles.submenuItem} ${isActive('/smt/printing') ? styles.activeSubmenu : ''}`}
                            onClick={() => navigate('/smt/printing')}
                        >
                            <span className={styles.menuIcon}>
                                <img src="https://img.icons8.com/?size=100&id=cjZ5daEtmKUc&format=png&color=000000" alt="icon" className={styles.imageIcon} />
                            </span> Printing
                        </div>
                        <div
                            className={`${styles.submenuItem} ${isActive('/smt/spi') ? styles.activeSubmenu : ''}`}
                            onClick={() => navigate('/smt/spi')}
                        >
                            <span className={styles.menuIcon}>
                                <img src="https://img.icons8.com/?size=100&id=cjZ5daEtmKUc&format=png&color=000000" alt="icon" className={styles.imageIcon} />
                            </span> SPI
                        </div>
                        <div
                            className={`${styles.submenuItem} ${isActive('/smt/pre-aoi') ? styles.activeSubmenu : ''}`}
                            onClick={() => navigate('/smt/pre-aoi')}
                        >
                            <span className={styles.menuIcon}>
                                <img src="https://img.icons8.com/?size=100&id=cjZ5daEtmKUc&format=png&color=000000" alt="icon" className={styles.imageIcon} />
                            </span> Pre AOI
                        </div>
                        <div
                            className={`${styles.submenuItem} ${isActive('/smt/post-aoi') ? styles.activeSubmenu : ''}`}
                            onClick={() => navigate('/smt/post-aoi')}
                        >
                            <span className={styles.menuIcon}>
                                <img src="https://img.icons8.com/?size=100&id=cjZ5daEtmKUc&format=png&color=000000" alt="icon" className={styles.imageIcon} />
                            </span> Post AOI
                        </div>
                        <div
                            className={`${styles.submenuItem} ${isActive('/smt/rework') ? styles.activeSubmenu : ''}`}
                            onClick={() => navigate('/smt/rework')}
                        >
                            <span className={styles.menuIcon}>
                                <img src="https://img.icons8.com/?size=100&id=cjZ5daEtmKUc&format=png&color=000000" alt="icon" className={styles.imageIcon} />
                            </span> Rework
                        </div>
                        <div
                            className={`${styles.submenuItem} ${isActive('/smt/smt-fg') ? styles.activeSubmenu : ''}`}
                            onClick={() => navigate('/smt/smt-fg')}
                        >
                            <span className={styles.menuIcon}>
                                <img src="https://img.icons8.com/?size=100&id=cjZ5daEtmKUc&format=png&color=000000" alt="icon" className={styles.imageIcon} />
                            </span> SMT FG
                        </div>
                        <div
                            className={`${styles.submenuItem} ${isActive('/smt/track-items') ? styles.activeSubmenu : ''}`}
                            onClick={() => navigate('/smt/track-items')}
                        >
                            <span className={styles.menuIcon}>
                                <img src="https://img.icons8.com/?size=100&id=cjZ5daEtmKUc&format=png&color=000000" alt="Track Items" className={styles.imageIcon} />
                            </span> Track Items
                        </div>

                    </div>
                )}
            </div>

            {/* Backend Module */}
            <div className={styles.moduleWrapper}>
                <div
                    className={`${styles.menuItem} ${expandedModule === 'backend' ? styles.active : ''}`}
                    onClick={() => toggleModule('backend')}
                    title="Backend"
                >
                    <span className={styles.menuIcon}>
                        <img 
                            src="https://img.icons8.com/?size=100&id=NPLWj1T8aEjW&format=png&color=000000" 
                            alt="Backend" 
                            className={styles.imageIcon}
                        />
                    </span>
                    <span className={styles.menuText}>Backend</span>
                    <span className={styles.arrow}>{expandedModule === 'backend' ? '▼' : '▶'}</span>
                </div>

                {expandedModule === 'backend' && (
                    <div className={styles.submenu}>
                        <div
                            className={`${styles.submenuItem} ${isActive('/backend/work-order') ? styles.activeSubmenu : ''}`}
                            onClick={() => navigate('/backend/work-order')}
                        >
                            <span className={styles.menuIcon}>
                                <img src="https://img.icons8.com/?size=100&id=cjZ5daEtmKUc&format=png&color=000000" alt="Work Order" className={styles.imageIcon} />
                            </span> Work Order
                        </div>
                        <div
                            className={`${styles.submenuItem} ${isActive('/backend/pth') ? styles.activeSubmenu : ''}`}
                            onClick={() => navigate('/backend/pth')}
                        >
                            <span className={styles.menuIcon}>
                                <img src="https://img.icons8.com/?size=100&id=cjZ5daEtmKUc&format=png&color=000000" alt="PTH" className={styles.imageIcon} />
                            </span> PTH
                        </div>
                        <div
                            className={`${styles.submenuItem} ${isActive('/backend/vi') ? styles.activeSubmenu : ''}`}
                            onClick={() => navigate('/backend/vi')}
                        >
                            <span className={styles.menuIcon}>
                                <img src="https://img.icons8.com/?size=100&id=cjZ5daEtmKUc&format=png&color=000000" alt="VI" className={styles.imageIcon} />
                            </span> VI
                        </div>
                        <div
                            className={`${styles.submenuItem} ${isActive('/backend/qa') ? styles.activeSubmenu : ''}`}
                            onClick={() => navigate('/backend/qa')}
                        >
                            <span className={styles.menuIcon}>
                                <img src="https://img.icons8.com/?size=100&id=cjZ5daEtmKUc&format=png&color=000000" alt="QA" className={styles.imageIcon} />
                            </span> QA
                        </div>
                        <div
                            className={`${styles.submenuItem} ${isActive('/backend/flashing') ? styles.activeSubmenu : ''}`}
                            onClick={() => navigate('/backend/flashing')}
                        >
                            <span className={styles.menuIcon}>
                                <img src="https://img.icons8.com/?size=100&id=cjZ5daEtmKUc&format=png&color=000000" alt="Flashing" className={styles.imageIcon} />
                            </span> Flashing
                        </div>
                        <div
                            className={`${styles.submenuItem} ${isActive('/backend/pcba-fct') ? styles.activeSubmenu : ''}`}
                            onClick={() => navigate('/backend/pcba-fct')}
                        >
                            <span className={styles.menuIcon}>
                                <img src="https://img.icons8.com/?size=100&id=cjZ5daEtmKUc&format=png&color=000000" alt="PCBA-FCT" className={styles.imageIcon} />
                            </span> PCBA-FCT
                        </div>
                        <div
                            className={`${styles.submenuItem} ${isActive('/backend/assembly') ? styles.activeSubmenu : ''}`}
                            onClick={() => navigate('/backend/assembly')}
                        >
                            <span className={styles.menuIcon}>
                                <img src="https://img.icons8.com/?size=100&id=cjZ5daEtmKUc&format=png&color=000000" alt="Assembly" className={styles.imageIcon} />
                            </span> Assembly
                        </div>
                        <div
                            className={`${styles.submenuItem} ${isActive('/backend/unit-testing') ? styles.activeSubmenu : ''}`}
                            onClick={() => navigate('/backend/unit-testing')}
                        >
                            <span className={styles.menuIcon}>
                                <img src="https://img.icons8.com/?size=100&id=cjZ5daEtmKUc&format=png&color=000000" alt="Unit Testing" className={styles.imageIcon} />
                            </span> Unit Testing
                        </div>
                        <div
                            className={`${styles.submenuItem} ${isActive('/backend/qi') ? styles.activeSubmenu : ''}`}
                            onClick={() => navigate('/backend/qi')}
                        >
                            <span className={styles.menuIcon}>
                                <img src="https://img.icons8.com/?size=100&id=cjZ5daEtmKUc&format=png&color=000000" alt="QI" className={styles.imageIcon} />
                            </span> QI
                        </div>
                        <div
                            className={`${styles.submenuItem} ${isActive('/backend/packing') ? styles.activeSubmenu : ''}`}
                            onClick={() => navigate('/backend/packing')}
                        >
                            <span className={styles.menuIcon}>
                                <img src="https://img.icons8.com/?size=100&id=cjZ5daEtmKUc&format=png&color=000000" alt="Packing" className={styles.imageIcon} />
                            </span> Packing
                        </div>
                        <div
                            className={`${styles.submenuItem} ${isActive('/backend/rework') ? styles.activeSubmenu : ''}`}
                            onClick={() => navigate('/backend/rework')}
                        >
                            <span className={styles.menuIcon}>
                                <img src="https://img.icons8.com/?size=100&id=cjZ5daEtmKUc&format=png&color=000000" alt="Rework" className={styles.imageIcon} />
                            </span> Rework
                        </div>
                        <div
                            className={`${styles.submenuItem} ${isActive('/backend/debug') ? styles.activeSubmenu : ''}`}
                            onClick={() => navigate('/backend/debug')}
                        >
                            <span className={styles.menuIcon}>
                                <img src="https://img.icons8.com/?size=100&id=cjZ5daEtmKUc&format=png&color=000000" alt="Debug" className={styles.imageIcon} />
                            </span> Debug
                        </div>
                        <div
                            className={`${styles.submenuItem} ${isActive('/backend/track-items') ? styles.activeSubmenu : ''}`}
                            onClick={() => navigate('/backend/track-items')}
                        >
                            <span className={styles.menuIcon}>
                                <img src="https://img.icons8.com/?size=100&id=cjZ5daEtmKUc&format=png&color=000000" alt="Track Items" className={styles.imageIcon} />
                            </span> Track Items
                        </div>
                    </div>
                )}
            </div>
            {/* Pre testing Module */}
            <div className={styles.moduleWrapper}>
                <div
                    className={`${styles.menuItem} ${expandedModule === 'pre-testing' ? styles.active : ''}`}
                    onClick={() => toggleModule('pre-testing')}
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
                            <span className={styles.menuIcon}>
                                <img src="https://img.icons8.com/?size=100&id=cjZ5daEtmKUc&format=png&color=000000" alt="icon" className={styles.imageIcon} />
                            </span> Warehouse
                        </div>
                        <div
                            className={`${styles.submenuItem} ${isActive('/pre-testing/iqc') ? styles.activeSubmenu : ''}`}
                            onClick={() => navigate('/pre-testing/iqc')}
                        >
                            <span className={styles.menuIcon}>
                                <img src="https://img.icons8.com/?size=100&id=cjZ5daEtmKUc&format=png&color=000000" alt="icon" className={styles.imageIcon} />
                            </span> Pre-IQC
                        </div>
                        <div
                            className={`${styles.submenuItem} ${isActive('/pre-testing/impedance') ? styles.activeSubmenu : ''}`}
                            onClick={() => navigate('/pre-testing/impedance')}
                        >
                            <span className={styles.menuIcon}>
                                <img src="https://img.icons8.com/?size=100&id=cjZ5daEtmKUc&format=png&color=000000" alt="icon" className={styles.imageIcon} />
                            </span> Pre-Impedance
                        </div>
                        <div
                            className={`${styles.submenuItem} ${isActive('/pre-testing/calibration') ? styles.activeSubmenu : ''}`}
                            onClick={() => navigate('/pre-testing/calibration')}
                        >
                            <span className={styles.menuIcon}>
                                <img src="https://img.icons8.com/?size=100&id=cjZ5daEtmKUc&format=png&color=000000" alt="icon" className={styles.imageIcon} />
                            </span> Pre-Calibration
                        </div>
                        <div
                            className={`${styles.submenuItem} ${isActive('/pre-testing/pre-aclr') ? styles.activeSubmenu : ''}`}
                            onClick={() => navigate('/pre-testing/pre-aclr')}
                        >
                            <span className={styles.menuIcon}>
                                <img src="https://img.icons8.com/?size=100&id=cjZ5daEtmKUc&format=png&color=000000" alt="icon" className={styles.imageIcon} />
                            </span> Pre-ACLR
                        </div>
                        <div
                            className={`${styles.submenuItem} ${isActive('/pre-testing/trace') ? styles.activeSubmenu : ''}`}
                            onClick={() => navigate('/pre-testing/trace')}
                        >
                            <span className={styles.menuIcon}>
                                <img src="https://img.icons8.com/?size=100&id=cjZ5daEtmKUc&format=png&color=000000" alt="icon" className={styles.imageIcon} />
                            </span> Trace
                        </div>
                    </div>
                )}
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
                            <span className={styles.menuIcon}>
                                <img src="https://img.icons8.com/?size=100&id=cjZ5daEtmKUc&format=png&color=000000" alt="icon" className={styles.imageIcon} />
                            </span> Purchase Order (PO)
                        </div>
                        <div
                            className={`${styles.submenuItem} ${isActive('/wip-stack') ? styles.activeSubmenu : ''}`}
                            onClick={() => navigate('/wip-stack')}
                        >
                            <span className={styles.menuIcon}>
                                <img src="https://img.icons8.com/?size=100&id=cjZ5daEtmKUc&format=png&color=000000" alt="icon" className={styles.imageIcon} />
                            </span> WIP Stack [Prod]
                        </div>
                        <div
                            className={`${styles.submenuItem} ${isActive('/return-wip') ? styles.activeSubmenu : ''}`}
                            onClick={() => navigate('/return-wip')}
                        >
                            <span className={styles.menuIcon}>
                                <img src="https://img.icons8.com/?size=100&id=cjZ5daEtmKUc&format=png&color=000000" alt="icon" className={styles.imageIcon} />
                            </span> Return From WIP
                        </div>
                        <div
                            className={`${styles.submenuItem} ${isActive('/report') ? styles.activeSubmenu : ''}`}
                            onClick={() => navigate('/report')}
                        >
                            <span className={styles.menuIcon}>
                                <img src="https://img.icons8.com/?size=100&id=cjZ5daEtmKUc&format=png&color=000000" alt="icon" className={styles.imageIcon} />
                            </span> Report
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
