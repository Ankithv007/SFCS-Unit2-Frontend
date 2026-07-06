import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSmtAuth } from '../context/SmtAuthContext';
import { useAuth } from '../hooks/useAuth';
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
    const { user } = useAuth();
    const { showToast } = useToast();
    const [expandedModule, setExpandedModule] = useState<string | null>(null);
    const [isSolderPasteMgmtExpanded, setIsSolderPasteMgmtExpanded] = useState(false);
    const [isStencilMgmtExpanded, setIsStencilMgmtExpanded] = useState(false);
    const [isSmtLineExpanded, setIsSmtLineExpanded] = useState(false);

    const isSmtAdmin = (smtUser && ['Super Admin', 'Admin', 'Manager'].includes(smtUser.role)) || 
                       (user && ['Super Admin', 'Admin', 'Manager'].includes(user.role));


    useEffect(() => {
        if (location.pathname.startsWith('/pre-testing')) setExpandedModule('pre-testing');
        else if (location.pathname.startsWith('/smt')) {
            setExpandedModule('smt');

            if (location.pathname.startsWith('/smt/solder-paste')) {
                setIsSolderPasteMgmtExpanded(true);
            }
            if (location.pathname.startsWith('/smt/stencil')) {
                setIsStencilMgmtExpanded(true);
            }
            if (
                location.pathname.startsWith('/smt/serial-number') ||
                location.pathname.startsWith('/smt/printing') ||
                location.pathname.startsWith('/smt/spi') ||
                location.pathname.startsWith('/smt/pre-aoi') ||
                location.pathname.startsWith('/smt/post-aoi') ||
                location.pathname.startsWith('/smt/rework') ||
                location.pathname.startsWith('/smt/smt-fg') ||
                location.pathname.startsWith('/smt/track-items')
            ) {
                setIsSmtLineExpanded(true);
            }
        }
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
                            className={`${styles.submenuItem} ${isActive('/smt/qms') ? styles.activeSubmenu : ''}`}
                            onClick={() => navigate('/smt/qms')}
                        >
                            <span className={styles.menuIcon}>
                                <img src="https://img.icons8.com/?size=100&id=cjZ5daEtmKUc&format=png&color=000000" alt="Document Process" className={styles.imageIcon} />
                            </span> Document Process
                        </div>
                        <div
                            className={`${styles.submenuItem} ${isActive('/smt/material-management') ? styles.activeSubmenu : ''}`}
                            onClick={() => navigate('/smt/material-management')}
                        >
                            <span className={styles.menuIcon}>
                                <img src="https://img.icons8.com/?size=100&id=cjZ5daEtmKUc&format=png&color=000000" alt="Material Management" className={styles.imageIcon} />
                            </span> Material Mgmt
                        </div>
                        <div
                            className={`${styles.submenuItem} ${isSolderPasteMgmtExpanded ? styles.activeSubmenuParent : ''}`}
                            onClick={() => setIsSolderPasteMgmtExpanded(!isSolderPasteMgmtExpanded)}
                        >
                            <span className={styles.menuIcon}>
                                <img src="https://img.icons8.com/?size=100&id=cjZ5daEtmKUc&format=png&color=000000" alt="Solder Paste Management" className={styles.imageIcon} />
                            </span> Solder Paste Management
                        </div>
                        {isSolderPasteMgmtExpanded && (
                            <div className={styles.subSubmenu}>
                                <div
                                    className={`${styles.subSubmenuItem} ${isActive('/smt/solder-paste/removal') ? styles.activeSubSubmenu : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigate('/smt/solder-paste/removal');
                                    }}
                                >
                                    <span className={styles.menuIcon} style={{ fontSize: '10px', minWidth: '14px', marginRight: '8px' }}>•</span> Removal from Refrigerator
                                </div>
                                <div
                                    className={`${styles.subSubmenuItem} ${isActive('/smt/solder-paste/thawing') ? styles.activeSubSubmenu : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigate('/smt/solder-paste/thawing');
                                    }}
                                >
                                    <span className={styles.menuIcon} style={{ fontSize: '10px', minWidth: '14px', marginRight: '8px' }}>•</span> Thawing
                                </div>
                                <div
                                    className={`${styles.subSubmenuItem} ${isActive('/smt/solder-paste/mixing') ? styles.activeSubSubmenu : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigate('/smt/solder-paste/mixing');
                                    }}
                                >
                                    <span className={styles.menuIcon} style={{ fontSize: '10px', minWidth: '14px', marginRight: '8px' }}>•</span> Solder Paste Mixing
                                </div>
                            </div>
                        )}
                        <div
                            className={`${styles.submenuItem} ${isStencilMgmtExpanded ? styles.activeSubmenuParent : ''}`}
                            onClick={() => setIsStencilMgmtExpanded(!isStencilMgmtExpanded)}
                        >
                            <span className={styles.menuIcon}>
                                <img src="https://img.icons8.com/?size=100&id=cjZ5daEtmKUc&format=png&color=000000" alt="Stencil Management" className={styles.imageIcon} />
                            </span> Stencil Management
                        </div>
                        {isStencilMgmtExpanded && (
                            <div className={styles.subSubmenu}>
                                <div
                                    className={`${styles.subSubmenuItem} ${isActive('/smt/stencil/master') ? styles.activeSubSubmenu : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigate('/smt/stencil/master');
                                    }}
                                >
                                    <span className={styles.menuIcon} style={{ fontSize: '10px', minWidth: '14px', marginRight: '8px' }}>•</span> Stencil Master Record
                                </div>
                                <div
                                    className={`${styles.subSubmenuItem} ${isActive('/smt/stencil/lifecycle') ? styles.activeSubSubmenu : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigate('/smt/stencil/lifecycle');
                                    }}
                                >
                                    <span className={styles.menuIcon} style={{ fontSize: '10px', minWidth: '14px', marginRight: '8px' }}>•</span> Life Cycle Management
                                </div>
                            </div>
                        )}
                        <div
                            className={`${styles.submenuItem} ${isActive('/smt/msd-tracker') ? styles.activeSubmenu : ''}`}
                            onClick={() => navigate('/smt/msd-tracker')}
                        >
                            <span className={styles.menuIcon}>
                                <img src="https://img.icons8.com/?size=100&id=cjZ5daEtmKUc&format=png&color=000000" alt="MSD Tracker" className={styles.imageIcon} />
                            </span> MSD Tracker
                        </div>
                        <div
                            className={`${styles.submenuItem} ${isActive('/smt/baking-tracking') ? styles.activeSubmenu : ''}`}
                            onClick={() => navigate('/smt/baking-tracking')}
                        >
                            <span className={styles.menuIcon}>
                                <img src="https://img.icons8.com/?size=100&id=cjZ5daEtmKUc&format=png&color=000000" alt="Baking Tracking Record" className={styles.imageIcon} />
                            </span> Baking Tracking Record
                        </div>
                        <div
                            className={`${styles.submenuItem} ${isSmtLineExpanded ? styles.activeSubmenuParent : ''}`}
                            onClick={() => setIsSmtLineExpanded(!isSmtLineExpanded)}
                        >
                            <span className={styles.menuIcon}>
                                <img src="https://img.icons8.com/?size=100&id=cjZ5daEtmKUc&format=png&color=000000" alt="SMT Line" className={styles.imageIcon} />
                            </span> SMT Line
                        </div>
                        {isSmtLineExpanded && (
                            <div className={styles.subSubmenu}>

                                <div
                                    className={`${styles.subSubmenuItem} ${isActive('/smt/serial-number') ? styles.activeSubSubmenu : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigate('/smt/serial-number');
                                    }}
                                >
                                    <span className={styles.menuIcon} style={{ fontSize: '10px', minWidth: '14px', marginRight: '8px' }}>•</span> Serial Generation
                                </div>
                                <div
                                    className={`${styles.subSubmenuItem} ${isActive('/smt/printing') ? styles.activeSubSubmenu : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigate('/smt/printing');
                                    }}
                                >
                                    <span className={styles.menuIcon} style={{ fontSize: '10px', minWidth: '14px', marginRight: '8px' }}>•</span> Printing
                                </div>
                                <div
                                    className={`${styles.subSubmenuItem} ${isActive('/smt/spi') ? styles.activeSubSubmenu : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigate('/smt/spi');
                                    }}
                                >
                                    <span className={styles.menuIcon} style={{ fontSize: '10px', minWidth: '14px', marginRight: '8px' }}>•</span> SPI
                                </div>
                                <div
                                    className={`${styles.subSubmenuItem} ${isActive('/smt/pre-aoi') ? styles.activeSubSubmenu : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigate('/smt/pre-aoi');
                                    }}
                                >
                                    <span className={styles.menuIcon} style={{ fontSize: '10px', minWidth: '14px', marginRight: '8px' }}>•</span> Pre AOI
                                </div>
                                <div
                                    className={`${styles.subSubmenuItem} ${isActive('/smt/post-aoi') ? styles.activeSubSubmenu : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigate('/smt/post-aoi');
                                    }}
                                >
                                    <span className={styles.menuIcon} style={{ fontSize: '10px', minWidth: '14px', marginRight: '8px' }}>•</span> Post AOI
                                </div>
                                <div
                                    className={`${styles.subSubmenuItem} ${isActive('/smt/rework') ? styles.activeSubSubmenu : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigate('/smt/rework');
                                    }}
                                >
                                    <span className={styles.menuIcon} style={{ fontSize: '10px', minWidth: '14px', marginRight: '8px' }}>•</span> Rework
                                </div>
                                <div
                                    className={`${styles.subSubmenuItem} ${isActive('/smt/smt-fg') ? styles.activeSubSubmenu : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigate('/smt/smt-fg');
                                    }}
                                >
                                    <span className={styles.menuIcon} style={{ fontSize: '10px', minWidth: '14px', marginRight: '8px' }}>•</span> SMT FG
                                </div>
                                <div
                                    className={`${styles.subSubmenuItem} ${isActive('/smt/track-items') ? styles.activeSubSubmenu : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigate('/smt/track-items');
                                    }}
                                >
                                    <span className={styles.menuIcon} style={{ fontSize: '10px', minWidth: '14px', marginRight: '8px' }}>•</span> Track Items
                                </div>
                            </div>
                        )}
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
