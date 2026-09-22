export interface RrhWorkOrderRecord {
    id: number;
    work_order_id: string;
    work_order_date: string;
    lot_quantity: number;
    excel_filename: string;
    excel_file_size: number;
    total_excel_rows: number;
    created_by: string;
    created_at: string;
    updated_at: string;
}

export interface RrhWorkOrderDetail extends RrhWorkOrderRecord {
    excel_columns: string[];
    excel_data: Record<string, any>[];
}
