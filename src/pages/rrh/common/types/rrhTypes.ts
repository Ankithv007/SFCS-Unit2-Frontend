/**
 * SFCS RRH Common MES Frontend Types
 */

export type RouteType = 'ECN' | 'Non-ECN';

export interface StationSession {
    id: number;
    work_order_id: string;
    status: string;
    created_by: string;
    created_by_name: string;
    created_at: string;
    updated_at?: string;
    work_order_date?: string;
    lot_quantity?: number;
    route?: string;
    post_burn_in_type?: 'INITIAL' | 'FINAL';
}

export interface WorkOrderSummary {
    id: number;
    work_order_id: string;
    work_order_date: string;
    lot_quantity: number;
    status: string;
    ipqc_passed_count?: number;
}

export interface ScannedInspectionRecord {
    id: number;
    session_id: number;
    work_order_id: string;
    serial_number: string;
    band_serial_no?: string;
    physical_serial_number?: string;
    physical_tpn?: string;
    band?: string;
    inspection_date: string;
    status: string;
    remarks?: string;
    scanned_by: string;
    scanned_at: string;
    defect_fixed?: string;
    checkpoints?: any[];
    sl_no?: string;
    route?: string;
    post_burn_in_type?: string;
}
