export interface DowntimeRecord {
    id?: string;
    shift: string;
    line: string;
    machine_name: string;
    start_time: string;
    end_time: string;
    duration?: number;
    downtime_category: string;
    downtime_description: string;
    action_taken: string;
    responsible_person: string;
    status?: string;
    remarks?: string;
    created_by?: string;
    created_by_name?: string;
    created_at?: string;
    updated_by?: string;
    updated_by_name?: string;
    updated_at?: string;
    work_order_id?: string | null;
    po_id?: string | null;
    product_name?: string | null;
    work_order_sides?: string | null;
    work_order_quantity?: number | null;
    panel_quantity?: number | null;
    product_description?: string | null;
}

export interface DashboardSummary {
    total_records: number;
    total_duration: number;
    avg_duration: number;
    open_issues: number;
    closed_issues: number;
    most_affected_machine: string;
    most_frequent_category: string;
    mttr?: number;
    mtbf?: number;
}

export interface ChartDataPoint {
    name: string;
    value: number;
    count?: number;
}

export interface TrendDataPoint {
    date: string;
    planned: number;
    unplanned: number;
    total: number;
}

export interface DashboardCharts {
    category: ChartDataPoint[];
    machine: ChartDataPoint[];
    shift: ChartDataPoint[];
    status: ChartDataPoint[];
    reasons?: ChartDataPoint[];
    dailyTrend?: TrendDataPoint[];
}

export interface DashboardMetrics {
    summary: DashboardSummary;
    charts: DashboardCharts;
}

export interface DowntimeFormState {
    shift: string;
    line: string;
    machineName: string;
    startTime: string;
    endTime: string;
    duration: number;
    downtimeCategory: string;
    reasonCode: string;
    downtimeDescription: string;
    actionTaken: string;
    responsiblePerson: string;
    status: string;
    remarks: string;
    editingId: string | null;
    workOrderId: string;
    manualWorkOrder: string;
}

