import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from './Toast';
import {
    Home,
    Shield,
    Clipboard,
    Cpu,
    ClipboardList,
    FileCheck,
    Package,
    Droplets,
    Layers,
    RefreshCw,
    Thermometer,
    Flame,
    Activity,
    Barcode,
    Printer,
    Eye,
    Wrench,
    PackageCheck,
    ScanLine,
    Clock,
    Server,
    Grid,
    ShieldCheck,
    Zap,
    CircuitBoard,
    Hammer,
    PlayCircle,
    SearchCheck,
    Bug,
    FlaskConical,
    Warehouse,
    ClipboardCheck,
    Sliders,
    Radio,
    Route,
    Split,
    Wind,
    Boxes,
    ShoppingCart,
    RotateCcw,
    BarChart3,
    ArrowDownRight,
    Award,
    PackageSearch,
    Truck
} from 'lucide-react';
import styles from './Sidebar.module.css';

interface SidebarProps {
    isExpanded: boolean;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isExpanded, onMouseEnter, onMouseLeave }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, permissions = [] } = useAuth();
    const { showToast } = useToast();
    const [expandedModule, setExpandedModule] = useState<string | null>(null);
    const [isStencilMgmtExpanded, setIsStencilMgmtExpanded] = useState(false);
    const [isSmtLineExpanded, setIsSmtLineExpanded] = useState(false);
    const [isRrhEcnExpanded, setIsRrhEcnExpanded] = useState(false);
    const [isRrhNonEcnExpanded, setIsRrhNonEcnExpanded] = useState(false);

    const isSuperAdmin = user?.role === 'Super Admin';

    const hasPermission = (permissionKey: string) => {
        if (isSuperAdmin) return true;
        // Stencil Scan is accessible to all authenticated operators and users
        if (permissionKey === 'smt_stencil_scan') return true;
        const perm = permissions.find(p => p.permission_key === permissionKey);
        return !!(perm && perm.can_view);
    };

    // Module visibility checks
    const canViewAdminPanel = hasPermission('admin_panel');
    
    const canViewSmtModule = isSuperAdmin || hasPermission('smt_stencil_scan') || permissions.some(p => p.permission_key.startsWith('smt_') && p.permission_key !== 'smt_work_order' && p.can_view);
    const canViewBackendModule = isSuperAdmin || permissions.some(p => p.permission_key.startsWith('backend_') && p.can_view);
    const canViewRrhModule = isSuperAdmin || permissions.some(p => p.permission_key.startsWith('rrh_') && p.can_view);
    const canViewPreTestingModule = isSuperAdmin || permissions.some(p => p.permission_key.startsWith('pre_') && p.can_view);
    const canViewInventoryModule = isSuperAdmin || permissions.some(p => p.permission_key.startsWith('inv_') && p.can_view);

    useEffect(() => {
        if (location.pathname.startsWith('/pre-testing')) setExpandedModule('pre-testing');
        else if (location.pathname.startsWith('/rrh')) {
            setExpandedModule('rrh');
            if (location.pathname.startsWith('/rrh/ipqc') || location.pathname.startsWith('/rrh/ecn')) {
                setIsRrhEcnExpanded(true);
            }
            if (location.pathname.startsWith('/rrh/non-ecn')) {
                setIsRrhNonEcnExpanded(true);
            }
        }
        else if (location.pathname.startsWith('/smt')) {
            if (location.pathname !== '/smt/work-order') {
                setExpandedModule('smt');
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
            {(isSuperAdmin || hasPermission('dashboard')) && (
                <div
                    className={`${styles.menuItem} ${isActive('/dashboard') ? styles.active : ''}`}
                    onClick={() => navigate('/dashboard')}
                    title="Home"
                >
                    <span className={styles.menuIcon}>
                        <Home size={20} />
                    </span>
                    <span className={styles.menuText}>Home</span>
                </div>
            )}

            {canViewAdminPanel && (
                <div
                    className={`${styles.menuItem} ${isActive('/admin-panel') ? styles.active : ''}`}
                    onClick={() => navigate('/admin-panel')}
                    title="Admin Panel"
                >
                    <span className={styles.menuIcon}>
                        <Shield size={20} />
                    </span>
                    <span className={styles.menuText}>Admin Panel</span>
                </div>
            )}

            {hasPermission('smt_work_order') && (
                <div
                    className={`${styles.menuItem} ${isActive('/smt/work-order') ? styles.active : ''}`}
                    onClick={() => navigate('/smt/work-order')}
                    title="Work Order"
                >
                    <span className={styles.menuIcon}>
                        <ClipboardList size={20} />
                    </span>
                    <span className={styles.menuText}>Work Order</span>
                </div>
            )}

            {/* SMT Module */}
            {canViewSmtModule && (
                <div className={styles.moduleWrapper}>
                    <div
                        className={`${styles.menuItem} ${expandedModule === 'smt' ? styles.active : ''}`}
                        onClick={() => toggleModule('smt')}
                        title="SMT"
                    >
                        <span className={styles.menuIcon}>
                            <Cpu size={20} />
                        </span>
                        <span className={styles.menuText}>SMT</span>
                        <span className={styles.arrow}>{expandedModule === 'smt' ? '▼' : '▶'}</span>
                    </div>

                    {expandedModule === 'smt' && isExpanded && (
                        <div className={styles.submenu}>
                            {hasPermission('smt_qms') && (
                                <div
                                    className={`${styles.submenuItem} ${isActive('/smt/qms') ? styles.activeSubmenu : ''}`}
                                    onClick={() => navigate('/smt/qms')}
                                >
                                    <span className={styles.menuIcon}>
                                        <FileCheck size={18} />
                                    </span> Document Process
                                </div>
                            )}
                            {hasPermission('smt_material_mgmt') && (
                                <div
                                    className={`${styles.submenuItem} ${isActive('/smt/material-management') ? styles.activeSubmenu : ''}`}
                                    onClick={() => navigate('/smt/material-management')}
                                >
                                    <span className={styles.menuIcon}>
                                        <Package size={18} />
                                    </span> Material Mgmt
                                </div>
                            )}
                            {hasPermission('smt_solder_paste') && (
                                <div
                                    className={`${styles.submenuItem} ${isActive('/smt/solder-paste') ? styles.activeSubmenu : ''}`}
                                    onClick={() => navigate('/smt/solder-paste')}
                                >
                                    <span className={styles.menuIcon}>
                                        <Droplets size={18} />
                                    </span> Solder Paste Management
                                </div>
                            )}
                            {(hasPermission('smt_stencil_lifecycle') || hasPermission('smt_stencil_rack') || hasPermission('smt_stencil_scan')) && (
                                <div
                                    className={`${styles.submenuItem} ${isStencilMgmtExpanded ? styles.activeSubmenuParent : ''}`}
                                    onClick={() => setIsStencilMgmtExpanded(!isStencilMgmtExpanded)}
                                >
                                    <span className={styles.menuIcon}>
                                        <Layers size={18} />
                                    </span> Stencil Management
                                </div>
                            )}
                            {isStencilMgmtExpanded && isExpanded && (
                                <div className={styles.subSubmenu}>
                                    {hasPermission('smt_stencil_lifecycle') && (
                                        <div
                                            className={`${styles.subSubmenuItem} ${isActive('/smt/stencil/lifecycle') ? styles.activeSubSubmenu : ''}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate('/smt/stencil/lifecycle');
                                            }}
                                        >
                                            <span className={styles.menuIcon}>
                                                <RefreshCw size={16} />
                                            </span> Life Cycle Management
                                        </div>
                                    )}
                                    {hasPermission('smt_stencil_rack') && (
                                        <div
                                            className={`${styles.subSubmenuItem} ${isActive('/smt/stencil/rack') ? styles.activeSubSubmenu : ''}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate('/smt/stencil/rack');
                                            }}
                                        >
                                            <span className={styles.menuIcon}>
                                                <Grid size={16} />
                                            </span> Stencil Rack Management
                                        </div>
                                    )}
                                    {hasPermission('smt_stencil_scan') && (
                                        <div
                                            className={`${styles.subSubmenuItem} ${isActive('/smt/stencil/scan') ? styles.activeSubSubmenu : ''}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate('/smt/stencil/scan');
                                            }}
                                        >
                                            <span className={styles.menuIcon}>
                                                <ScanLine size={16} />
                                            </span> Stencil Scan
                                        </div>
                                    )}
                                </div>
                            )}
                            {hasPermission('smt_msd_tracker') && (
                                <div
                                    className={`${styles.submenuItem} ${isActive('/smt/msd-tracker') ? styles.activeSubmenu : ''}`}
                                    onClick={() => navigate('/smt/msd-tracker')}
                                >
                                    <span className={styles.menuIcon}>
                                        <Thermometer size={18} />
                                    </span> MSD Tracker
                                </div>
                            )}
                            {hasPermission('smt_baking_tracking') && (
                                <div
                                    className={`${styles.submenuItem} ${isActive('/smt/baking-tracking') ? styles.activeSubmenu : ''}`}
                                    onClick={() => navigate('/smt/baking-tracking')}
                                >
                                    <span className={styles.menuIcon}>
                                        <Flame size={18} />
                                    </span> Baking Tracking Record
                                </div>
                            )}
                            {(hasPermission('smt_serial_number') ||
                              hasPermission('smt_printing') ||
                              hasPermission('smt_pre_aoi') ||
                              hasPermission('smt_post_aoi') ||
                              hasPermission('smt_rework') ||
                              hasPermission('smt_fg') ||
                              hasPermission('smt_track_items') ||
                              hasPermission('smt_downtime')) && (
                                <div
                                    className={`${styles.submenuItem} ${isSmtLineExpanded ? styles.activeSubmenuParent : ''}`}
                                    onClick={() => setIsSmtLineExpanded(!isSmtLineExpanded)}
                                >
                                    <span className={styles.menuIcon}>
                                        <Activity size={18} />
                                    </span> SMT Line
                                </div>
                            )}
                            {isSmtLineExpanded && isExpanded && (
                                <div className={styles.subSubmenu}>
                                    {hasPermission('smt_serial_number') && (
                                        <div
                                            className={`${styles.subSubmenuItem} ${isActive('/smt/serial-number') ? styles.activeSubSubmenu : ''}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate('/smt/serial-number');
                                            }}
                                        >
                                            <span className={styles.menuIcon}>
                                                <Barcode size={16} />
                                            </span> Serial Generation
                                        </div>
                                    )}
                                    {hasPermission('smt_printing') && (
                                        <div
                                            className={`${styles.subSubmenuItem} ${isActive('/smt/printing') ? styles.activeSubSubmenu : ''}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate('/smt/printing');
                                            }}
                                        >
                                            <span className={styles.menuIcon}>
                                                <Printer size={16} />
                                            </span> Printing
                                        </div>
                                    )}
                                    {hasPermission('smt_spi') && (
                                        <div
                                            className={`${styles.subSubmenuItem} ${isActive('/smt/spi') ? styles.activeSubSubmenu : ''}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate('/smt/spi');
                                            }}
                                        >
                                            <span className={styles.menuIcon}>
                                                <Eye size={16} />
                                            </span> SPI
                                        </div>
                                    )}
                                    {hasPermission('smt_pre_aoi') && (
                                        <div
                                            className={`${styles.subSubmenuItem} ${isActive('/smt/pre-aoi') ? styles.activeSubSubmenu : ''}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate('/smt/pre-aoi');
                                            }}
                                        >
                                            <span className={styles.menuIcon}>
                                                <Eye size={16} />
                                            </span> Pre AOI
                                        </div>
                                    )}
                                    {hasPermission('smt_post_aoi') && (
                                        <div
                                            className={`${styles.subSubmenuItem} ${isActive('/smt/post-aoi') ? styles.activeSubSubmenu : ''}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate('/smt/post-aoi');
                                            }}
                                        >
                                            <span className={styles.menuIcon}>
                                                <Eye size={16} />
                                            </span> Post AOI
                                        </div>
                                    )}
                                    {hasPermission('smt_rework') && (
                                        <div
                                            className={`${styles.subSubmenuItem} ${isActive('/smt/rework') ? styles.activeSubSubmenu : ''}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate('/smt/rework');
                                            }}
                                        >
                                            <span className={styles.menuIcon}>
                                                <Wrench size={16} />
                                            </span> Rework
                                        </div>
                                    )}
                                    {hasPermission('smt_fg') && (
                                        <div
                                            className={`${styles.subSubmenuItem} ${isActive('/smt/smt-fg') ? styles.activeSubSubmenu : ''}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate('/smt/smt-fg');
                                            }}
                                        >
                                            <span className={styles.menuIcon}>
                                                <PackageCheck size={16} />
                                            </span> SMT FG
                                        </div>
                                    )}
                                    {hasPermission('smt_track_items') && (
                                        <div
                                            className={`${styles.subSubmenuItem} ${isActive('/smt/track-items') ? styles.activeSubSubmenu : ''}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate('/smt/track-items');
                                            }}
                                        >
                                            <span className={styles.menuIcon}>
                                                <ScanLine size={16} />
                                            </span> Track Items
                                        </div>
                                    )}
                                    {hasPermission('smt_downtime') && (
                                        <div
                                            className={`${styles.subSubmenuItem} ${isActive('/smt/downtime-tracker') ? styles.activeSubSubmenu : ''}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate('/smt/downtime-tracker');
                                            }}
                                        >
                                            <span className={styles.menuIcon}>
                                                <Clock size={16} />
                                            </span> Downtime Tracker
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Backend Module */}
            {canViewBackendModule && (
                <div className={styles.moduleWrapper}>
                    <div
                        className={`${styles.menuItem} ${expandedModule === 'backend' ? styles.active : ''}`}
                        onClick={() => toggleModule('backend')}
                        title="Backend"
                    >
                        <span className={styles.menuIcon}>
                            <Server size={20} />
                        </span>
                        <span className={styles.menuText}>Backend</span>
                        <span className={styles.arrow}>{expandedModule === 'backend' ? '▼' : '▶'}</span>
                    </div>

                    {expandedModule === 'backend' && isExpanded && (
                        <div className={styles.submenu}>
                            {hasPermission('backend_work_order') && (
                                <div
                                    className={`${styles.submenuItem} ${isActive('/backend/work-order') ? styles.activeSubmenu : ''}`}
                                    onClick={() => navigate('/backend/work-order')}
                                >
                                    <span className={styles.menuIcon}>
                                        <ClipboardList size={18} />
                                    </span> Work Order
                                </div>
                            )}
                            {hasPermission('backend_pth') && (
                                <div
                                    className={`${styles.submenuItem} ${isActive('/backend/pth') ? styles.activeSubmenu : ''}`}
                                    onClick={() => navigate('/backend/pth')}
                                >
                                    <span className={styles.menuIcon}>
                                        <Grid size={18} />
                                    </span> PTH
                                </div>
                            )}
                            {hasPermission('backend_vi') && (
                                <div
                                    className={`${styles.submenuItem} ${isActive('/backend/vi') ? styles.activeSubmenu : ''}`}
                                    onClick={() => navigate('/backend/vi')}
                                >
                                    <span className={styles.menuIcon}>
                                        <Eye size={18} />
                                    </span> VI
                                </div>
                            )}
                            {hasPermission('backend_qa') && (
                                <div
                                    className={`${styles.submenuItem} ${isActive('/backend/qa') ? styles.activeSubmenu : ''}`}
                                    onClick={() => navigate('/backend/qa')}
                                >
                                    <span className={styles.menuIcon}>
                                        <ShieldCheck size={18} />
                                    </span> QA
                                </div>
                            )}
                            {hasPermission('backend_flashing') && (
                                <div
                                    className={`${styles.submenuItem} ${isActive('/backend/flashing') ? styles.activeSubmenu : ''}`}
                                    onClick={() => navigate('/backend/flashing')}
                                >
                                    <span className={styles.menuIcon}>
                                        <Zap size={18} />
                                    </span> Flashing
                                </div>
                            )}
                            {hasPermission('backend_pcba_fct') && (
                                <div
                                    className={`${styles.submenuItem} ${isActive('/backend/pcba-fct') ? styles.activeSubmenu : ''}`}
                                    onClick={() => navigate('/backend/pcba-fct')}
                                >
                                    <span className={styles.menuIcon}>
                                        <CircuitBoard size={18} />
                                    </span> PCBA-FCT
                                </div>
                            )}
                            {hasPermission('backend_assembly') && (
                                <div
                                    className={`${styles.submenuItem} ${isActive('/backend/assembly') ? styles.activeSubmenu : ''}`}
                                    onClick={() => navigate('/backend/assembly')}
                                >
                                    <span className={styles.menuIcon}>
                                        <Hammer size={18} />
                                    </span> Assembly
                                </div>
                            )}
                            {hasPermission('backend_unit_testing') && (
                                <div
                                    className={`${styles.submenuItem} ${isActive('/backend/unit-testing') ? styles.activeSubmenu : ''}`}
                                    onClick={() => navigate('/backend/unit-testing')}
                                >
                                    <span className={styles.menuIcon}>
                                        <PlayCircle size={18} />
                                    </span> Unit Testing
                                </div>
                            )}
                            {hasPermission('backend_qi') && (
                                <div
                                    className={`${styles.submenuItem} ${isActive('/backend/qi') ? styles.activeSubmenu : ''}`}
                                    onClick={() => navigate('/backend/qi')}
                                >
                                    <span className={styles.menuIcon}>
                                        <SearchCheck size={18} />
                                    </span> QI
                                </div>
                            )}
                            {hasPermission('backend_packing') && (
                                <div
                                    className={`${styles.submenuItem} ${isActive('/backend/packing') ? styles.activeSubmenu : ''}`}
                                    onClick={() => navigate('/backend/packing')}
                                >
                                    <span className={styles.menuIcon}>
                                        <PackageCheck size={18} />
                                    </span> Packing
                                </div>
                            )}
                            {hasPermission('backend_rework') && (
                                <div
                                    className={`${styles.submenuItem} ${isActive('/backend/rework') ? styles.activeSubmenu : ''}`}
                                    onClick={() => navigate('/backend/rework')}
                                >
                                    <span className={styles.menuIcon}>
                                        <Wrench size={18} />
                                    </span> Rework
                                </div>
                            )}
                            {hasPermission('backend_debug') && (
                                <div
                                    className={`${styles.submenuItem} ${isActive('/backend/debug') ? styles.activeSubmenu : ''}`}
                                    onClick={() => navigate('/backend/debug')}
                                >
                                    <span className={styles.menuIcon}>
                                        <Bug size={18} />
                                    </span> Debug
                                </div>
                            )}
                            {hasPermission('backend_track_items') && (
                                <div
                                    className={`${styles.submenuItem} ${isActive('/backend/track-items') ? styles.activeSubmenu : ''}`}
                                    onClick={() => navigate('/backend/track-items')}
                                >
                                    <span className={styles.menuIcon}>
                                        <ScanLine size={18} />
                                    </span> Track Items
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* RRH Module */}
            {canViewRrhModule && (
                <div className={styles.moduleWrapper}>
                    <div
                        className={`${styles.menuItem} ${expandedModule === 'rrh' ? styles.active : ''}`}
                        onClick={() => toggleModule('rrh')}
                        title="RRH"
                    >
                        <span className={styles.menuIcon}>
                            <Radio size={20} />
                        </span>
                        <span className={styles.menuText}>RRH</span>
                        <span className={styles.arrow}>{expandedModule === 'rrh' ? '▼' : '▶'}</span>
                    </div>

                    {expandedModule === 'rrh' && isExpanded && (
                        <div className={styles.submenu}>
                            {hasPermission('rrh_work_order') && (
                                <div
                                    className={`${styles.submenuItem} ${isActive('/rrh/work-order') ? styles.activeSubmenu : ''}`}
                                    onClick={() => navigate('/rrh/work-order')}
                                >
                                    <span className={styles.menuIcon}>
                                        <Clipboard size={18} />
                                    </span> Work Order
                                </div>
                            )}
                            {hasPermission('rrh_inward') && (
                                <div
                                    className={`${styles.submenuItem} ${isActive('/rrh/inward') ? styles.activeSubmenu : ''}`}
                                    onClick={() => navigate('/rrh/inward')}
                                >
                                    <span className={styles.menuIcon}>
                                        <ArrowDownRight size={18} />
                                    </span> Inward
                                </div>
                            )}
                            {hasPermission('rrh_ivi') && (
                                <div
                                    className={`${styles.submenuItem} ${isActive('/rrh/ivi') ? styles.activeSubmenu : ''}`}
                                    onClick={() => navigate('/rrh/ivi')}
                                >
                                    <span className={styles.menuIcon}>
                                        <Eye size={18} />
                                    </span> IVI
                                </div>
                            )}
                            {(isSuperAdmin || canViewRrhModule || hasPermission('rrh_ipqc')) && (
                                <div
                                    className={`${styles.submenuItem} ${isRrhEcnExpanded ? styles.activeSubmenuParent : ''}`}
                                    onClick={() => setIsRrhEcnExpanded(!isRrhEcnExpanded)}
                                >
                                    <span className={styles.menuIcon}>
                                        <FileCheck size={18} />
                                    </span> ECN
                                </div>
                            )}
                            {isRrhEcnExpanded && isExpanded && (
                                <div className={styles.subSubmenu}>
                                    <div
                                        className={`${styles.subSubmenuItem} ${(isActive('/rrh/ipqc') || isActive('/rrh/ecn/ipqc')) ? styles.activeSubSubmenu : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate('/rrh/ecn/ipqc');
                                        }}
                                    >
                                        <span className={styles.menuIcon}>
                                            <ShieldCheck size={16} />
                                        </span> IPQC
                                    </div>
                                    <div
                                        className={`${styles.subSubmenuItem} ${isActive('/rrh/ecn/programming') ? styles.activeSubSubmenu : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate('/rrh/ecn/programming');
                                        }}
                                    >
                                        <span className={styles.menuIcon}>
                                            <Cpu size={16} />
                                        </span> Programming
                                    </div>
                                    <div
                                        className={`${styles.subSubmenuItem} ${isActive('/rrh/ecn/pre-burn-in') ? styles.activeSubSubmenu : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate('/rrh/ecn/pre-burn-in');
                                        }}
                                    >
                                        <span className={styles.menuIcon}>
                                            <Flame size={16} />
                                        </span> Pre-Burn-in Test
                                    </div>
                                    <div
                                        className={`${styles.subSubmenuItem} ${isActive('/rrh/ecn/hipot') ? styles.activeSubSubmenu : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate('/rrh/ecn/hipot');
                                        }}
                                    >
                                        <span className={styles.menuIcon}>
                                            <Zap size={16} />
                                        </span> Hipot Test
                                    </div>
                                    <div
                                        className={`${styles.subSubmenuItem} ${isActive('/rrh/ecn/post-burn-in') ? styles.activeSubSubmenu : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate('/rrh/ecn/post-burn-in');
                                        }}
                                    >
                                        <span className={styles.menuIcon}>
                                            <Thermometer size={16} />
                                        </span> Post-Burn-in Test
                                    </div>
                                    <div
                                        className={`${styles.subSubmenuItem} ${isActive('/rrh/ecn/fqc') ? styles.activeSubSubmenu : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate('/rrh/ecn/fqc');
                                        }}
                                    >
                                        <span className={styles.menuIcon}>
                                            <Award size={16} />
                                        </span> FQC
                                    </div>
                                    <div
                                        className={`${styles.subSubmenuItem} ${isActive('/rrh/ecn/oba') ? styles.activeSubSubmenu : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate('/rrh/ecn/oba');
                                        }}
                                    >
                                        <span className={styles.menuIcon}>
                                            <PackageSearch size={16} />
                                        </span> OBA
                                    </div>
                                    <div
                                        className={`${styles.subSubmenuItem} ${isActive('/rrh/ecn/packing') ? styles.activeSubSubmenu : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate('/rrh/ecn/packing');
                                        }}
                                    >
                                        <span className={styles.menuIcon}>
                                            <Package size={16} />
                                        </span> Packing
                                    </div>
                                    <div
                                        className={`${styles.subSubmenuItem} ${isActive('/rrh/ecn/shipment') ? styles.activeSubSubmenu : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate('/rrh/ecn/shipment');
                                        }}
                                    >
                                        <span className={styles.menuIcon}>
                                            <Truck size={16} />
                                        </span> Shipment
                                    </div>
                                </div>
                            )}
                            {(isSuperAdmin || canViewRrhModule || hasPermission('rrh_inward') || hasPermission('rrh_ivi')) && (
                                <div
                                    className={`${styles.submenuItem} ${isRrhNonEcnExpanded ? styles.activeSubmenuParent : ''}`}
                                    onClick={() => setIsRrhNonEcnExpanded(!isRrhNonEcnExpanded)}
                                >
                                    <span className={styles.menuIcon}>
                                        <Layers size={18} />
                                    </span> Non-ECN
                                </div>
                            )}
                            {isRrhNonEcnExpanded && isExpanded && (
                                <div className={styles.subSubmenu}>
                                    <div
                                        className={`${styles.subSubmenuItem} ${isActive('/rrh/non-ecn/post-burn-in-initial') ? styles.activeSubSubmenu : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate('/rrh/non-ecn/post-burn-in-initial');
                                        }}
                                    >
                                        <span className={styles.menuIcon}>
                                            <Thermometer size={16} />
                                        </span> Post-Burn-in Test
                                    </div>
                                    <div
                                        className={`${styles.subSubmenuItem} ${isActive('/rrh/non-ecn/programming') ? styles.activeSubSubmenu : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate('/rrh/non-ecn/programming');
                                        }}
                                    >
                                        <span className={styles.menuIcon}>
                                            <Cpu size={16} />
                                        </span> Programming
                                    </div>
                                    <div
                                        className={`${styles.subSubmenuItem} ${isActive('/rrh/non-ecn/pre-burn-in') ? styles.activeSubSubmenu : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate('/rrh/non-ecn/pre-burn-in');
                                        }}
                                    >
                                        <span className={styles.menuIcon}>
                                            <Flame size={16} />
                                        </span> Pre-Burn-in Test
                                    </div>
                                    <div
                                        className={`${styles.subSubmenuItem} ${isActive('/rrh/non-ecn/hipot') ? styles.activeSubSubmenu : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate('/rrh/non-ecn/hipot');
                                        }}
                                    >
                                        <span className={styles.menuIcon}>
                                            <Zap size={16} />
                                        </span> Hipot Test
                                    </div>
                                    <div
                                        className={`${styles.subSubmenuItem} ${isActive('/rrh/non-ecn/post-burn-in') ? styles.activeSubSubmenu : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate('/rrh/non-ecn/post-burn-in');
                                        }}
                                    >
                                        <span className={styles.menuIcon}>
                                            <Thermometer size={16} />
                                        </span> Post-Burn-in Test
                                    </div>
                                    <div
                                        className={`${styles.subSubmenuItem} ${isActive('/rrh/non-ecn/fqc') ? styles.activeSubSubmenu : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate('/rrh/non-ecn/fqc');
                                        }}
                                    >
                                        <span className={styles.menuIcon}>
                                            <Award size={16} />
                                        </span> FQC
                                    </div>
                                    <div
                                        className={`${styles.subSubmenuItem} ${isActive('/rrh/non-ecn/oba') ? styles.activeSubSubmenu : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate('/rrh/non-ecn/oba');
                                        }}
                                    >
                                        <span className={styles.menuIcon}>
                                            <PackageSearch size={16} />
                                        </span> OBA
                                    </div>
                                    <div
                                        className={`${styles.subSubmenuItem} ${isActive('/rrh/non-ecn/packing') ? styles.activeSubSubmenu : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate('/rrh/non-ecn/packing');
                                        }}
                                    >
                                        <span className={styles.menuIcon}>
                                            <Package size={16} />
                                        </span> Packing
                                    </div>
                                    <div
                                        className={`${styles.subSubmenuItem} ${isActive('/rrh/non-ecn/shipment') ? styles.activeSubSubmenu : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate('/rrh/non-ecn/shipment');
                                        }}
                                    >
                                        <span className={styles.menuIcon}>
                                            <Truck size={16} />
                                        </span> Shipment
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Pre testing Module */}
            {canViewPreTestingModule && (
                <div className={styles.moduleWrapper}>
                    <div
                        className={`${styles.menuItem} ${expandedModule === 'pre-testing' ? styles.active : ''}`}
                        onClick={() => toggleModule('pre-testing')}
                        title="Pre testing (E2E)"
                    >
                        <span className={styles.menuIcon}>
                            <FlaskConical size={20} />
                        </span>
                        <span className={styles.menuText}>Pre testing (E2E)</span>
                        <span className={styles.arrow}>{expandedModule === 'pre-testing' ? '▼' : '▶'}</span>
                    </div>

                    {expandedModule === 'pre-testing' && isExpanded && (
                        <div className={styles.submenu}>
                            {hasPermission('pre_warehouse') && (
                                <div
                                    className={`${styles.submenuItem} ${isActive('/pre-testing/warehouse') ? styles.activeSubmenu : ''}`}
                                    onClick={() => navigate('/pre-testing/warehouse')}
                                >
                                    <span className={styles.menuIcon}>
                                        <Warehouse size={18} />
                                    </span> Warehouse
                                </div>
                            )}
                            {hasPermission('pre_iqc') && (
                                <div
                                    className={`${styles.submenuItem} ${isActive('/pre-testing/iqc') ? styles.activeSubmenu : ''}`}
                                    onClick={() => navigate('/pre-testing/iqc')}
                                >
                                    <span className={styles.menuIcon}>
                                        <ClipboardCheck size={18} />
                                    </span> Pre-IQC
                                </div>
                            )}
                            {hasPermission('pre_impedance') && (
                                <div
                                    className={`${styles.submenuItem} ${isActive('/pre-testing/impedance') ? styles.activeSubmenu : ''}`}
                                    onClick={() => navigate('/pre-testing/impedance')}
                                >
                                    <span className={styles.menuIcon}>
                                        <Activity size={18} />
                                    </span> Pre-Impedance
                                </div>
                            )}
                            {hasPermission('pre_calibration') && (
                                <div
                                    className={`${styles.submenuItem} ${isActive('/pre-testing/calibration') ? styles.activeSubmenu : ''}`}
                                    onClick={() => navigate('/pre-testing/calibration')}
                                >
                                    <span className={styles.menuIcon}>
                                        <Sliders size={18} />
                                    </span> Pre-Calibration
                                </div>
                            )}
                            {hasPermission('pre_aclr') && (
                                <div
                                    className={`${styles.submenuItem} ${isActive('/pre-testing/pre-aclr') ? styles.activeSubmenu : ''}`}
                                    onClick={() => navigate('/pre-testing/pre-aclr')}
                                >
                                    <span className={styles.menuIcon}>
                                        <Radio size={18} />
                                    </span> Pre-ACLR
                                </div>
                            )}
                            {hasPermission('pre_trace') && (
                                <div
                                    className={`${styles.submenuItem} ${isActive('/pre-testing/trace') ? styles.activeSubmenu : ''}`}
                                    onClick={() => navigate('/pre-testing/trace')}
                                >
                                    <span className={styles.menuIcon}>
                                        <Route size={18} />
                                    </span> Trace
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
            
            {hasPermission('bom_split') && (
                <div
                    className={`${styles.menuItem} ${isActive('/bom-split') ? styles.active : ''}`}
                    onClick={() => navigate('/bom-split')}
                    title="BOM Split"
                >
                    <span className={styles.menuIcon}>
                        <Split size={20} />
                    </span>
                    <span className={styles.menuText}>BOM Split</span>
                </div>
            )}
            
            {hasPermission('qc_inspection') && (
                <div
                    className={`${styles.menuItem} ${isActive('/qc-inspection') ? styles.active : ''}`}
                    onClick={() => navigate('/qc-inspection')}
                    title="QC Inspection"
                >
                    <span className={styles.menuIcon}>
                        <ClipboardCheck size={20} />
                    </span>
                    <span className={styles.menuText}>QC Inspection</span>
                </div>
            )}

            {hasPermission('vacuum_leak_test') && (
                <div
                    className={`${styles.menuItem} ${isActive('/vacuum-leak-test') ? styles.active : ''}`}
                    onClick={() => navigate('/vacuum-leak-test')}
                    title="Vacuum Leak Test"
                >
                    <span className={styles.menuIcon}>
                        <Wind size={20} />
                    </span>
                    <span className={styles.menuText}>Vacuum Leak Test</span>
                </div>
            )}

            {/* Inventory & Report Module */}
            {canViewInventoryModule && (
                <div className={styles.moduleWrapper}>
                    <div
                        className={`${styles.menuItem} ${expandedModule === 'inventory-report' ? styles.active : ''}`}
                        onClick={() => toggleModule('inventory-report')}
                        title="Inventory & Report"
                    >
                        <span className={styles.menuIcon}>
                            <Boxes size={20} />
                        </span>
                        <span className={styles.menuText}>Inventory & Report</span>
                        <span className={styles.arrow}>{expandedModule === 'inventory-report' ? '▼' : '▶'}</span>
                    </div>

                    {expandedModule === 'inventory-report' && isExpanded && (
                        <div className={styles.submenu}>
                            {hasPermission('inv_purchase_order') && (
                                <div
                                    className={`${styles.submenuItem} ${isActive('/purchase-order') ? styles.activeSubmenu : ''}`}
                                    onClick={() => navigate('/purchase-order')}
                                >
                                    <span className={styles.menuIcon}>
                                        <ShoppingCart size={18} />
                                    </span> Purchase Order (PO)
                                </div>
                            )}
                            {hasPermission('inv_wip_stack') && (
                                <div
                                    className={`${styles.submenuItem} ${isActive('/wip-stack') ? styles.activeSubmenu : ''}`}
                                    onClick={() => navigate('/wip-stack')}
                                >
                                    <span className={styles.menuIcon}>
                                        <Layers size={18} />
                                    </span> WIP Stack [Prod]
                                </div>
                            )}
                            {hasPermission('inv_return_wip') && (
                                <div
                                    className={`${styles.submenuItem} ${isActive('/return-wip') ? styles.activeSubmenu : ''}`}
                                    onClick={() => navigate('/return-wip')}
                                >
                                    <span className={styles.menuIcon}>
                                        <RotateCcw size={18} />
                                    </span> Return From WIP
                                </div>
                            )}
                            {hasPermission('inv_report') && (
                                <div
                                    className={`${styles.submenuItem} ${isActive('/report') ? styles.activeSubmenu : ''}`}
                                    onClick={() => navigate('/report')}
                                >
                                    <span className={styles.menuIcon}>
                                        <BarChart3 size={18} />
                                    </span> Report
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
