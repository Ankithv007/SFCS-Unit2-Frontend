export interface SystemPageRoute {
    permission_key: string;
    module_name: string;
    page_name: string;
    route_path: string;
    display_order: number;
    icon?: string;
    page_type: 'PAGE' | 'ACTION' | 'MODULE';
    parent_module?: string;
}

export const systemPagesConfig: SystemPageRoute[] = [
    // Dashboard & Admin
    { permission_key: 'dashboard', module_name: 'Dashboard', page_name: 'Dashboard', route_path: '/dashboard', display_order: 1, page_type: 'PAGE', icon: 'LayoutDashboard' },
    { permission_key: 'admin_panel', module_name: 'Administration', page_name: 'Admin Panel', route_path: '/admin-panel', display_order: 2, page_type: 'PAGE', icon: 'Settings' },

    // Work Order
    { permission_key: 'smt_work_order', module_name: 'Work Order', page_name: 'Work Order', route_path: '/smt/work-order', display_order: 3, page_type: 'PAGE', icon: 'Clipboard' },

    // QC Inspection
    { permission_key: 'qc_inspection', module_name: 'QC Inspection', page_name: 'QC Inspection', route_path: '/qc-inspection', display_order: 10, page_type: 'PAGE', icon: 'ClipboardCheck', parent_module: 'QC Inspection' },
    { permission_key: 'qc_shifts', module_name: 'QC Inspection', page_name: 'Shift Management', route_path: '/qc-inspection/shifts', display_order: 11, page_type: 'PAGE', icon: 'Clock', parent_module: 'QC Inspection' },

    // Inventory
    { permission_key: 'inv_purchase_order', module_name: 'Inventory', page_name: 'Purchase Order', route_path: '/purchase-order', display_order: 20, page_type: 'PAGE', icon: 'FileText', parent_module: 'Inventory' },
    { permission_key: 'inv_wip_stack', module_name: 'Inventory', page_name: 'WIP Stack', route_path: '/wip-stack', display_order: 21, page_type: 'PAGE', icon: 'Layers', parent_module: 'Inventory' },
    { permission_key: 'inv_return_wip', module_name: 'Inventory', page_name: 'Return WIP', route_path: '/return-wip', display_order: 22, page_type: 'PAGE', icon: 'RotateCcw', parent_module: 'Inventory' },
    { permission_key: 'inv_report', module_name: 'Inventory', page_name: 'Report', route_path: '/report', display_order: 23, page_type: 'PAGE', icon: 'BarChart2', parent_module: 'Inventory' },

    // Pre Testing
    { permission_key: 'pre_warehouse', module_name: 'Pre Testing', page_name: 'Warehouse', route_path: '/pre-testing/warehouse', display_order: 30, page_type: 'PAGE', icon: 'Home', parent_module: 'Pre Testing' },
    { permission_key: 'pre_iqc', module_name: 'Pre Testing', page_name: 'IQC', route_path: '/pre-testing/iqc', display_order: 31, page_type: 'PAGE', icon: 'CheckSquare', parent_module: 'Pre Testing' },
    { permission_key: 'pre_impedance', module_name: 'Pre Testing', page_name: 'Impedance', route_path: '/pre-testing/impedance', display_order: 32, page_type: 'PAGE', icon: 'Activity', parent_module: 'Pre Testing' },
    { permission_key: 'pre_calibration', module_name: 'Pre Testing', page_name: 'Calibration', route_path: '/pre-testing/calibration', display_order: 33, page_type: 'PAGE', icon: 'Sliders', parent_module: 'Pre Testing' },
    { permission_key: 'pre_aclr', module_name: 'Pre Testing', page_name: 'Pre-ACLR', route_path: '/pre-testing/pre-aclr', display_order: 34, page_type: 'PAGE', icon: 'Radio', parent_module: 'Pre Testing' },
    { permission_key: 'pre_trace', module_name: 'Pre Testing', page_name: 'Trace', route_path: '/pre-testing/trace', display_order: 35, page_type: 'PAGE', icon: 'GitCommit', parent_module: 'Pre Testing' },

    // Vacuum Leak Test
    { permission_key: 'vacuum_leak_test', module_name: 'Vacuum Leak Test', page_name: 'Vacuum Leak Test', route_path: '/vacuum-leak-test', display_order: 40, page_type: 'PAGE', icon: 'Wind' },

    // BOM Split
    { permission_key: 'bom_split', module_name: 'BOM Split', page_name: 'BOM Split', route_path: '/bom-split', display_order: 45, page_type: 'PAGE', icon: 'Split' },

    // SMT Module
    { permission_key: 'smt_dashboard', module_name: 'SMT', page_name: 'SMT Dashboard', route_path: '/smt', display_order: 50, page_type: 'PAGE', icon: 'Cpu', parent_module: 'SMT' },
    { permission_key: 'smt_work_order_history', module_name: 'SMT', page_name: 'Work Order History', route_path: '/smt/workorder-history', display_order: 52, page_type: 'PAGE', icon: 'History', parent_module: 'SMT' },
    { permission_key: 'smt_serial_number', module_name: 'SMT', page_name: 'Serial Number', route_path: '/smt/serial-number', display_order: 53, page_type: 'PAGE', icon: 'Barcode', parent_module: 'SMT' },
    { permission_key: 'smt_printing', module_name: 'SMT', page_name: 'Printing', route_path: '/smt/printing', display_order: 54, page_type: 'PAGE', icon: 'Printer', parent_module: 'SMT' },
    { permission_key: 'smt_solder_paste', module_name: 'SMT', page_name: 'Solder Paste Management', route_path: '/smt/solder-paste', display_order: 55, page_type: 'PAGE', icon: 'Database', parent_module: 'SMT' },
    { permission_key: 'smt_spi', module_name: 'SMT', page_name: 'SPI', route_path: '/smt/spi', display_order: 55, page_type: 'PAGE', icon: 'Eye', parent_module: 'SMT' },
    { permission_key: 'smt_pre_aoi', module_name: 'SMT', page_name: 'Pre AOI', route_path: '/smt/pre-aoi', display_order: 56, page_type: 'PAGE', icon: 'Eye', parent_module: 'SMT' },
    { permission_key: 'smt_post_aoi', module_name: 'SMT', page_name: 'Post AOI', route_path: '/smt/post-aoi', display_order: 57, page_type: 'PAGE', icon: 'CheckCircle', parent_module: 'SMT' },
    { permission_key: 'smt_rework', module_name: 'SMT', page_name: 'Rework', route_path: '/smt/rework', display_order: 58, page_type: 'PAGE', icon: 'Wrench', parent_module: 'SMT' },
    { permission_key: 'smt_fg', module_name: 'SMT', page_name: 'SMT FG', route_path: '/smt/smt-fg', display_order: 59, page_type: 'PAGE', icon: 'Package', parent_module: 'SMT' },
    { permission_key: 'smt_track_items', module_name: 'SMT', page_name: 'Track Items', route_path: '/smt/track-items', display_order: 60, page_type: 'PAGE', icon: 'List', parent_module: 'SMT' },
    { permission_key: 'smt_downtime', module_name: 'SMT', page_name: 'Downtime Tracker', route_path: '/smt/downtime-tracker', display_order: 61, page_type: 'PAGE', icon: 'AlertTriangle', parent_module: 'SMT' },
    { permission_key: 'smt_qms', module_name: 'SMT', page_name: 'Document Process', route_path: '/smt/qms', display_order: 62, page_type: 'PAGE', icon: 'File', parent_module: 'SMT' },
    { permission_key: 'smt_material_mgmt', module_name: 'SMT', page_name: 'Material Management', route_path: '/smt/material-management', display_order: 63, page_type: 'PAGE', icon: 'Box', parent_module: 'SMT' },
    { permission_key: 'smt_msd_tracker', module_name: 'SMT', page_name: 'MSD Tracker', route_path: '/smt/msd-tracker', display_order: 64, page_type: 'PAGE', icon: 'Thermometer', parent_module: 'SMT' },
    { permission_key: 'smt_stencil_lifecycle', module_name: 'SMT', page_name: 'Stencil Lifecycle', route_path: '/smt/stencil/lifecycle', display_order: 66, page_type: 'PAGE', icon: 'RefreshCw', parent_module: 'SMT' },
    { permission_key: 'smt_baking_tracking', module_name: 'SMT', page_name: 'Baking Tracking Record', route_path: '/smt/baking-tracking', display_order: 67, page_type: 'PAGE', icon: 'Flame', parent_module: 'SMT' },
    { permission_key: 'smt_stencil_rack', module_name: 'SMT', page_name: 'Stencil Rack Management', route_path: '/smt/stencil/rack', display_order: 68, page_type: 'PAGE', icon: 'Grid', parent_module: 'SMT' },
    { permission_key: 'smt_stencil_scan', module_name: 'SMT', page_name: 'Stencil Scan', route_path: '/smt/stencil/scan', display_order: 69, page_type: 'PAGE', icon: 'Scan', parent_module: 'SMT' },

    // Backend Module
    { permission_key: 'backend_dashboard', module_name: 'Backend', page_name: 'Backend Dashboard', route_path: '/backend', display_order: 80, page_type: 'PAGE', icon: 'Cpu', parent_module: 'Backend' },
    { permission_key: 'backend_work_order', module_name: 'Backend', page_name: 'Work Order', route_path: '/backend/work-order', display_order: 81, page_type: 'PAGE', icon: 'Clipboard', parent_module: 'Backend' },
    { permission_key: 'backend_pth', module_name: 'Backend', page_name: 'PTH', route_path: '/backend/pth', display_order: 82, page_type: 'PAGE', icon: 'Anchor', parent_module: 'Backend' },
    { permission_key: 'backend_vi', module_name: 'Backend', page_name: 'VI', route_path: '/backend/vi', display_order: 83, page_type: 'PAGE', icon: 'Eye', parent_module: 'Backend' },
    { permission_key: 'backend_qa', module_name: 'Backend', page_name: 'QA', route_path: '/backend/qa', display_order: 84, page_type: 'PAGE', icon: 'CheckCircle', parent_module: 'Backend' },
    { permission_key: 'backend_flashing', module_name: 'Backend', page_name: 'Flashing', route_path: '/backend/flashing', display_order: 85, page_type: 'PAGE', icon: 'Zap', parent_module: 'Backend' },
    { permission_key: 'backend_pcba_fct', module_name: 'Backend', page_name: 'PCBA-FCT', route_path: '/backend/pcba-fct', display_order: 86, page_type: 'PAGE', icon: 'Trello', parent_module: 'Backend' },
    { permission_key: 'backend_assembly', module_name: 'Backend', page_name: 'Assembly', route_path: '/backend/assembly', display_order: 87, page_type: 'PAGE', icon: 'Box', parent_module: 'Backend' },
    { permission_key: 'backend_unit_testing', module_name: 'Backend', page_name: 'Unit Testing', route_path: '/backend/unit-testing', display_order: 88, page_type: 'PAGE', icon: 'Play', parent_module: 'Backend' },
    { permission_key: 'backend_qi', module_name: 'Backend', page_name: 'QI', route_path: '/backend/qi', display_order: 89, page_type: 'PAGE', icon: 'ShieldCheck', parent_module: 'Backend' },
    { permission_key: 'backend_packing', module_name: 'Backend', page_name: 'Packing', route_path: '/backend/packing', display_order: 90, page_type: 'PAGE', icon: 'Package', parent_module: 'Backend' },
    { permission_key: 'backend_rework', module_name: 'Backend', page_name: 'Rework', route_path: '/backend/rework', display_order: 91, page_type: 'PAGE', icon: 'Wrench', parent_module: 'Backend' },
    { permission_key: 'backend_debug', module_name: 'Backend', page_name: 'Debug', route_path: '/backend/debug', display_order: 92, page_type: 'PAGE', icon: 'Bug', parent_module: 'Backend' },
    { permission_key: 'backend_track_items', module_name: 'Backend', page_name: 'Track Items', route_path: '/backend/track-items', display_order: 93, page_type: 'PAGE', icon: 'List', parent_module: 'Backend' },

    // RRH Module
    { permission_key: 'rrh_work_order', module_name: 'RRH', page_name: 'Work Order', route_path: '/rrh/work-order', display_order: 94, page_type: 'PAGE', icon: 'Clipboard', parent_module: 'RRH' },
    { permission_key: 'rrh_inward', module_name: 'RRH', page_name: 'Inward', route_path: '/rrh/inward', display_order: 95, page_type: 'PAGE', icon: 'ArrowDownRight', parent_module: 'RRH' },
    { permission_key: 'rrh_ivi', module_name: 'RRH', page_name: 'IVI', route_path: '/rrh/ivi', display_order: 96, page_type: 'PAGE', icon: 'Eye', parent_module: 'RRH' },
    { permission_key: 'rrh_ipqc', module_name: 'RRH', page_name: 'IPQC', route_path: '/rrh/ipqc', display_order: 97, page_type: 'PAGE', icon: 'ShieldCheck', parent_module: 'RRH' },
    { permission_key: 'rrh_debug', module_name: 'RRH', page_name: 'Debug', route_path: '/rrh/debug', display_order: 98, page_type: 'PAGE', icon: 'Bug', parent_module: 'RRH' },
    { permission_key: 'rrh_testing', module_name: 'RRH', page_name: 'Testing', route_path: '/rrh/testing', display_order: 99, page_type: 'PAGE', icon: 'Play', parent_module: 'RRH' },
    { permission_key: 'rrh_fqc', module_name: 'RRH', page_name: 'FQC', route_path: '/rrh/fqc', display_order: 100, page_type: 'PAGE', icon: 'Award', parent_module: 'RRH' },
    { permission_key: 'rrh_oba', module_name: 'RRH', page_name: 'OBA', route_path: '/rrh/oba', display_order: 101, page_type: 'PAGE', icon: 'PackageSearch', parent_module: 'RRH' },
    { permission_key: 'rrh_packaging_outgoing_data', module_name: 'RRH', page_name: 'Packaging Outgoing Data', route_path: '/rrh/packaging-outgoing-data', display_order: 102, page_type: 'PAGE', icon: 'Package', parent_module: 'RRH' },

    // RRH ECN Stages
    { permission_key: 'rrh_ecn_programming', module_name: 'RRH', page_name: 'ECN Programming', route_path: '/rrh/ecn/programming', display_order: 103, page_type: 'PAGE', icon: 'Cpu', parent_module: 'RRH' },
    { permission_key: 'rrh_ecn_pre_burn_in', module_name: 'RRH', page_name: 'ECN Pre-Burn-in Test', route_path: '/rrh/ecn/pre-burn-in', display_order: 104, page_type: 'PAGE', icon: 'Flame', parent_module: 'RRH' },
    { permission_key: 'rrh_ecn_hipot', module_name: 'RRH', page_name: 'ECN Hipot Test', route_path: '/rrh/ecn/hipot', display_order: 105, page_type: 'PAGE', icon: 'Zap', parent_module: 'RRH' },
    { permission_key: 'rrh_ecn_post_burn_in', module_name: 'RRH', page_name: 'ECN Post-Burn-in Test', route_path: '/rrh/ecn/post-burn-in', display_order: 106, page_type: 'PAGE', icon: 'Thermometer', parent_module: 'RRH' },
    { permission_key: 'rrh_ecn_fqc', module_name: 'RRH', page_name: 'ECN FQC', route_path: '/rrh/ecn/fqc', display_order: 107, page_type: 'PAGE', icon: 'Award', parent_module: 'RRH' },
    { permission_key: 'rrh_ecn_oba', module_name: 'RRH', page_name: 'ECN OBA', route_path: '/rrh/ecn/oba', display_order: 108, page_type: 'PAGE', icon: 'PackageSearch', parent_module: 'RRH' },
    { permission_key: 'rrh_ecn_packing', module_name: 'RRH', page_name: 'ECN Packing', route_path: '/rrh/ecn/packing', display_order: 109, page_type: 'PAGE', icon: 'Package', parent_module: 'RRH' },
    { permission_key: 'rrh_ecn_shipment', module_name: 'RRH', page_name: 'ECN Shipment', route_path: '/rrh/ecn/shipment', display_order: 110, page_type: 'PAGE', icon: 'Truck', parent_module: 'RRH' },

    // RRH Non-ECN Stages
    { permission_key: 'rrh_non_ecn_post_burn_in_initial', module_name: 'RRH', page_name: 'Non-ECN Post-Burn-in (Initial)', route_path: '/rrh/non-ecn/post-burn-in-initial', display_order: 111, page_type: 'PAGE', icon: 'Thermometer', parent_module: 'RRH' },
    { permission_key: 'rrh_non_ecn_programming', module_name: 'RRH', page_name: 'Non-ECN Programming', route_path: '/rrh/non-ecn/programming', display_order: 112, page_type: 'PAGE', icon: 'Cpu', parent_module: 'RRH' },
    { permission_key: 'rrh_non_ecn_pre_burn_in', module_name: 'RRH', page_name: 'Non-ECN Pre-Burn-in Test', route_path: '/rrh/non-ecn/pre-burn-in', display_order: 113, page_type: 'PAGE', icon: 'Flame', parent_module: 'RRH' },
    { permission_key: 'rrh_non_ecn_hipot', module_name: 'RRH', page_name: 'Non-ECN Hipot Test', route_path: '/rrh/non-ecn/hipot', display_order: 114, page_type: 'PAGE', icon: 'Zap', parent_module: 'RRH' },
    { permission_key: 'rrh_non_ecn_post_burn_in', module_name: 'RRH', page_name: 'Non-ECN Post-Burn-in Test', route_path: '/rrh/non-ecn/post-burn-in', display_order: 115, page_type: 'PAGE', icon: 'Thermometer', parent_module: 'RRH' },
    { permission_key: 'rrh_non_ecn_fqc', module_name: 'RRH', page_name: 'Non-ECN FQC', route_path: '/rrh/non-ecn/fqc', display_order: 116, page_type: 'PAGE', icon: 'Award', parent_module: 'RRH' },
    { permission_key: 'rrh_non_ecn_oba', module_name: 'RRH', page_name: 'Non-ECN OBA', route_path: '/rrh/non-ecn/oba', display_order: 117, page_type: 'PAGE', icon: 'PackageSearch', parent_module: 'RRH' },
    { permission_key: 'rrh_non_ecn_packing', module_name: 'RRH', page_name: 'Non-ECN Packing', route_path: '/rrh/non-ecn/packing', display_order: 118, page_type: 'PAGE', icon: 'Package', parent_module: 'RRH' },
    { permission_key: 'rrh_non_ecn_shipment', module_name: 'RRH', page_name: 'Non-ECN Shipment', route_path: '/rrh/non-ecn/shipment', display_order: 119, page_type: 'PAGE', icon: 'Truck', parent_module: 'RRH' }
];
