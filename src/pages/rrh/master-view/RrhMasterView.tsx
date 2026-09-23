import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../../utils/api';
import styles from './RrhMasterView.module.css';
import { 
    ArrowLeft, Search, RefreshCw, ChevronLeft, ChevronRight, Download, AlertCircle, FileSpreadsheet
} from 'lucide-react';

interface ParsedCell {
    columnNumber: number;
    columnLetter: string;
    rawValue: string | null;
    displayValue: string | null;
    dataType: string;
    isMerged: boolean;
    mergeType: 'MASTER' | 'SLAVE' | 'NONE';
    rowSpan: number;
    colSpan: number;
}

interface ParsedRow {
    rowNumber: number;
    rowType: string;
    cells: ParsedCell[];
}

interface ParsedMerge {
    rangeReference: string;
    startRow: number;
    startColumn: number;
    endRow: number;
    endColumn: number;
    rowSpan: number;
    colSpan: number;
}

interface ExcelStructure {
    sheetName: string;
    totalRows: number;
    totalColumns: number;
    merges: ParsedMerge[];
    headerRows: ParsedRow[];
    dataRows: ParsedRow[];
    rows: ParsedRow[];
}

interface PaginationMeta {
    page: number;
    limit: number;
    isAll: boolean;
    totalDataRows: number;
    filteredDataRows: number;
    totalPages: number;
}

interface WorkOrderMasterViewData {
    id: number;
    work_order_id: string;
    work_order_date: string | null;
    lot_quantity: number | null;
    status: string;
    excel_filename: string | null;
    excel_file_size: number | null;
    total_excel_rows: number | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    pagination: PaginationMeta;
    excel_structure: ExcelStructure | null;
}

const getColumnLetter = (colIndex: number): string => {
    let temp = colIndex;
    let letter = '';
    while (temp > 0) {
        const mod = (temp - 1) % 26;
        letter = String.fromCharCode(65 + mod) + letter;
        temp = Math.floor((temp - mod) / 26);
    }
    return letter;
};

const formatBytes = (bytes: number | null | undefined): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
        return dateStr;
    }
};

export const RrhMasterView: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    // Data States
    const [data, setData] = useState<WorkOrderMasterViewData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isDownloading, setIsDownloading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filter & Pagination States
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState<number>(50);

    // Debounce search input (300ms)
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setPage(1); // Reset to page 1 on search
        }, 300);

        return () => clearTimeout(handler);
    }, [searchTerm]);

    // Fetch Master View Data
    const fetchMasterData = async () => {
        if (!id) return;
        setIsLoading(true);
        setError(null);
        try {
            const queryParams = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                search: debouncedSearch
            });

            const res = await apiFetch(`/api/rrh/work-orders/${id}/master-view?${queryParams.toString()}`);
            if (res && res.success && res.data) {
                setData(res.data);
            } else {
                throw new Error(res?.error || 'Failed to fetch RRH Master Excel data.');
            }
        } catch (err: any) {
            setError(err.message || 'Error occurred while loading RRH Master Excel.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchMasterData();
    }, [id, page, limit, debouncedSearch]);

    // Download Current Master Excel
    const handleDownload = async () => {
        if (!id || !data) return;
        setIsDownloading(true);
        try {
            const blob = await apiFetch(`/api/rrh/work-orders/${id}/download`);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = data.excel_filename || `${data.work_order_id}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (err: any) {
            alert(`Download failed: ${err.message || 'Server error'}`);
        } finally {
            setIsDownloading(false);
        }
    };

    const handlePageChange = (newPage: number) => {
        setPage(newPage);
    };

    const pagination = data?.pagination;
    const structure = data?.excel_structure;
    const totalPages = pagination?.totalPages || 1;
    const totalDataRows = pagination?.totalDataRows || 0;
    const filteredDataRows = pagination?.filteredDataRows || 0;

    // Derived dimensions
    const totalColumns = structure?.totalColumns || 32;
    const headerRows = structure?.headerRows || [];
    const dataRows = structure?.dataRows || [];

    return (
        <div className={styles.container}>
            {/* Top Back Navigation Button */}
            <button
                type="button"
                className={styles.backBtn}
                onClick={() => navigate('/rrh/work-order')}
                title="Return to RRH Work Order Dashboard"
            >
                <ArrowLeft size={16} />
                Back to RRH Work Order Dashboard
            </button>

            {/* Header Metadata Section */}
            {data && (
                <>
                    <div className={styles.header}>
                        <div className={styles.titleArea}>
                            <h2>RRH Master Excel Viewer</h2>
                            <p>
                                Work Order: <strong>{data.work_order_id}</strong>
                                {' '}| Date: <strong>{formatDate(data.work_order_date)}</strong>
                                {' '}| Status: <strong style={{ color: '#0f766e' }}>{data.status}</strong>
                            </p>
                        </div>
                        <div className={styles.headerActions}>
                            <button
                                type="button"
                                className={styles.downloadBtn}
                                onClick={handleDownload}
                                disabled={isDownloading || !structure}
                                title="Download the current active Excel file"
                            >
                                <Download size={15} />
                                {isDownloading ? 'Downloading...' : 'Download Current Master Excel'}
                            </button>
                        </div>
                    </div>

                    {/* 4 Metadata Cards */}
                    <div className={styles.metaGrid}>
                        <div className={styles.metaCard}>
                            <span className={styles.metaLabel}>Work Order ID</span>
                            <span className={styles.metaValue} style={{ color: '#0f766e' }}>
                                {data.work_order_id}
                            </span>
                        </div>
                        <div className={styles.metaCard}>
                            <span className={styles.metaLabel}>Lot Quantity</span>
                            <span className={styles.metaValue}>
                                {data.lot_quantity?.toLocaleString() ?? 0}
                            </span>
                        </div>
                        <div className={styles.metaCard}>
                            <span className={styles.metaLabel}>Excel File Name & Size</span>
                            <span className={styles.metaValue} title={data.excel_filename || 'N/A'}>
                                {data.excel_filename || 'N/A'} ({formatBytes(data.excel_file_size)})
                            </span>
                        </div>
                        <div className={styles.metaCard}>
                            <span className={styles.metaLabel}>Total Dimensions & Sheet</span>
                            <span className={styles.metaValue}>
                                {structure ? `${structure.totalRows} Rows | ${structure.totalColumns} Cols (${structure.sheetName})` : '—'}
                            </span>
                        </div>
                    </div>
                </>
            )}

            {/* Main Data Grid Card */}
            <div className={styles.card}>
                <div className={styles.searchActions}>
                    <div className={styles.searchBar}>
                        <Search className={styles.searchIcon} size={16} />
                        <input
                            type="text"
                            placeholder="Search across all Excel cells (Serials, DC, OBD, TPN...)"
                            className={styles.searchInput}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className={styles.controlsRight}>
                        <select
                            className={styles.pageSizeSelect}
                            value={limit}
                            onChange={(e) => {
                                setLimit(Number(e.target.value));
                                setPage(1);
                            }}
                            title="Rows per page"
                        >
                            <option value={25}>25 rows / page</option>
                            <option value={50}>50 rows / page</option>
                            <option value={100}>100 rows / page</option>
                            <option value={200}>200 rows / page</option>
                            <option value={10000}>All rows</option>
                        </select>
                        <button
                            type="button"
                            className={styles.paginationBtn}
                            onClick={fetchMasterData}
                            title="Refresh Master Data"
                        >
                            <RefreshCw size={14} className={isLoading ? styles.spinner : ''} />
                            Refresh
                        </button>
                    </div>
                </div>

                {isLoading ? (
                    <div className={styles.loadingWrapper}>
                        <RefreshCw className={styles.spinner} size={32} />
                        <p style={{ color: '#64748b', margin: 0, fontWeight: 500 }}>
                            Loading RRH Master Excel data from database...
                        </p>
                    </div>
                ) : error ? (
                    <div className={styles.noData} style={{ color: '#ef4444' }}>
                        <AlertCircle size={32} style={{ marginBottom: '0.5rem', display: 'inline-block' }} />
                        <div><strong>Error:</strong> {error}</div>
                    </div>
                ) : !structure || !structure.rows || structure.rows.length === 0 ? (
                    <div className={styles.noData}>
                        <FileSpreadsheet size={32} style={{ color: '#94a3b8', marginBottom: '0.5rem', display: 'inline-block' }} />
                        <div>No Master Excel data found for this Work Order.</div>
                    </div>
                ) : (
                    <>
                        {/* Horizontal Scroll Excel Table Container */}
                        <div className={styles.tableContainer}>
                            <table className={styles.excelTable}>
                                <thead>
                                    {/* 1. Coordinate Header Row: # | A | B | C ... AF */}
                                    <tr className={styles.coordinateHeader}>
                                        <th className={styles.rowCornerCell}>#</th>
                                        {Array.from({ length: totalColumns }, (_, idx) => (
                                            <th key={`coord-${idx + 1}`} className={styles.coordinateCell}>
                                                {getColumnLetter(idx + 1)}
                                            </th>
                                        ))}
                                    </tr>

                                    {/* 2. Header Rows (Row 1 & Row 2 separated with exact merges) */}
                                    {headerRows.map((row) => (
                                        <tr
                                            key={`hdr-row-${row.rowNumber}`}
                                            className={row.rowNumber === 1 ? styles.headerRow1 : styles.headerRow2}
                                        >
                                            <th className={styles.rowCornerCell} style={{ background: row.rowNumber === 1 ? '#e0e7ff' : '#f1f5f9' }}>
                                                {row.rowNumber}
                                            </th>
                                            {row.cells.map((cell) => {
                                                // Suppress slave cells covered by a master merge
                                                if (cell.mergeType === 'SLAVE') {
                                                    return null;
                                                }

                                                const isMaster = cell.mergeType === 'MASTER';
                                                const rowSpan = isMaster && cell.rowSpan ? cell.rowSpan : 1;
                                                const colSpan = isMaster && cell.colSpan ? cell.colSpan : 1;
                                                const val = cell.displayValue ?? cell.rawValue ?? '';

                                                return (
                                                    <th
                                                        key={`hdr-cell-${row.rowNumber}-${cell.columnNumber}`}
                                                        rowSpan={rowSpan}
                                                        colSpan={colSpan}
                                                        className={row.rowNumber === 1 ? styles.headerCell1 : styles.headerCell2}
                                                        style={{
                                                            textAlign: colSpan > 1 || isMaster ? 'center' : 'left'
                                                        }}
                                                        title={String(val)}
                                                    >
                                                        {val}
                                                    </th>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </thead>
                                <tbody>
                                    {dataRows.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={totalColumns + 1}
                                                style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}
                                            >
                                                No data records match your search filter.
                                            </td>
                                        </tr>
                                    ) : (
                                        dataRows.map((row) => {
                                            const isEven = row.rowNumber % 2 === 0;
                                            return (
                                                <tr
                                                    key={`data-row-${row.rowNumber}`}
                                                    className={isEven ? styles.dataRowEven : styles.dataRowOdd}
                                                >
                                                    {/* Sticky Physical Excel Row Number */}
                                                    <td
                                                        className={styles.rowIndexCell}
                                                        style={{ background: isEven ? '#ffffff' : '#f8fafc' }}
                                                    >
                                                        {row.rowNumber}
                                                    </td>
                                                    {/* Data Cells */}
                                                    {row.cells.map((cell) => {
                                                        if (cell.mergeType === 'SLAVE') {
                                                            return null;
                                                        }

                                                        const isMaster = cell.mergeType === 'MASTER';
                                                        const rowSpan = isMaster && cell.rowSpan ? cell.rowSpan : 1;
                                                        const colSpan = isMaster && cell.colSpan ? cell.colSpan : 1;
                                                        const val = cell.displayValue ?? cell.rawValue ?? '';

                                                        return (
                                                            <td
                                                                key={`cell-${row.rowNumber}-${cell.columnNumber}`}
                                                                rowSpan={rowSpan}
                                                                colSpan={colSpan}
                                                                className={styles.dataCell}
                                                                style={{
                                                                    textAlign: colSpan > 1 ? 'center' : 'left'
                                                                }}
                                                                title={String(val)}
                                                            >
                                                                {val}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Controls */}
                        <div className={styles.pagination}>
                            <div className={styles.pageInfo}>
                                Showing <strong>{filteredDataRows > 0 ? (page - 1) * limit + 1 : 0}</strong> to{' '}
                                <strong>{Math.min(page * limit, filteredDataRows)}</strong> of{' '}
                                <strong>{filteredDataRows}</strong> filtered data rows
                                {filteredDataRows !== totalDataRows && (
                                    <span style={{ color: '#64748b', marginLeft: '0.35rem' }}>
                                        (out of {totalDataRows} total data rows)
                                    </span>
                                )}
                            </div>

                            <div className={styles.paginationControls}>
                                <button
                                    type="button"
                                    className={styles.paginationBtn}
                                    disabled={page <= 1 || isLoading}
                                    onClick={() => handlePageChange(page - 1)}
                                >
                                    <ChevronLeft size={14} />
                                    Previous
                                </button>

                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let pageNum = page;
                                    if (page <= 3) {
                                        pageNum = i + 1;
                                    } else if (page > totalPages - 2) {
                                        pageNum = totalPages - 4 + i;
                                    } else {
                                        pageNum = page - 2 + i;
                                    }

                                    if (pageNum < 1 || pageNum > totalPages) return null;

                                    return (
                                        <button
                                            key={pageNum}
                                            type="button"
                                            className={`${styles.paginationBtn} ${page === pageNum ? styles.activePage : ''}`}
                                            onClick={() => handlePageChange(pageNum)}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}

                                <button
                                    type="button"
                                    className={styles.paginationBtn}
                                    disabled={page >= totalPages || isLoading}
                                    onClick={() => handlePageChange(page + 1)}
                                >
                                    Next
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default RrhMasterView;
