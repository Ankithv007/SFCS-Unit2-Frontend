import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../utils/api';
import styles from './BomView.module.css';
import { 
    ArrowLeft, Search, RefreshCw, ChevronLeft, ChevronRight, ArrowUpDown
} from 'lucide-react';

interface BomItem {
    id: number;
    sl_no: string;
    vepl_part_no: string;
    description: string;
    manufacturer: string;
    manufacturer_part_no: string;
    qty_per_product: number;
}

interface Metadata {
    workOrderNumber: string;
    productName: string;
    poNumber: string | null;
    revision: string;
    uploadedBy: string;
    uploadedDate: string;
    totalComponents: number;
}

const BomView: React.FC = () => {
    const { revisionId } = useParams<{ revisionId: string }>();
    const navigate = useNavigate();

    // Data State
    const [items, setItems] = useState<BomItem[]>([]);
    const [metadata, setMetadata] = useState<Metadata | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filter, Pagination & Sort States
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [page, setPage] = useState(1);
    const limit = 50;
    const [totalItems, setTotalItems] = useState(0);
    const [sortBy, setSortBy] = useState<string>('id');
    const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');

    // Debounce search input
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setPage(1); // Reset to page 1 on new search
        }, 300);

        return () => {
            clearTimeout(handler);
        };
    }, [searchTerm]);

    // Fetch items
    const fetchItems = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const queryParams = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                search: debouncedSearch,
                sortBy,
                sortOrder
            });

            const res = await apiFetch(`/api/smt/qms/bom-items/${revisionId}?${queryParams.toString()}`);
            if (res && res.success) {
                setItems(res.items);
                setMetadata(res.metadata);
                setTotalItems(res.totalItems);
            } else {
                throw new Error(res?.error || 'Failed to fetch BOM items');
            }
        } catch (err: any) {
            setError(err.message || 'Error occurred while loading data.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (revisionId) {
            fetchItems();
        }
    }, [revisionId, page, limit, debouncedSearch, sortBy, sortOrder]);

    const handleSort = (field: string) => {
        if (sortBy === field) {
            setSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC');
        } else {
            setSortBy(field);
            setSortOrder('ASC');
        }
        setPage(1);
    };

    const handlePageChange = (newPage: number) => {
        setPage(newPage);
    };

    const totalPages = Math.ceil(totalItems / limit);

    return (
        <div className={styles.container}>
            {/* Back Button */}
            <button className={styles.backBtn} onClick={() => navigate('/smt/qms')}>
                <ArrowLeft size={16} />
                Back to Document Process Dashboard
            </button>

            {/* Header Metadata */}
            {metadata && (
                <>
                    <div className={styles.header}>
                        <div className={styles.titleArea}>
                            <h2>BOM Component Viewer</h2>
                            <p>Work Order: <strong>{metadata.workOrderNumber}</strong> | Product: <strong>{metadata.productName}</strong></p>
                        </div>
                    </div>

                    <div className={styles.metaGrid}>
                        <div className={styles.metaCard}>
                            <span className={styles.metaLabel}>PO Number</span>
                            <span className={styles.metaValue}>{metadata.poNumber || '—'}</span>
                        </div>
                        <div className={styles.metaCard}>
                            <span className={styles.metaLabel}>BOM Revision</span>
                            <span className={styles.metaValue} style={{ color: '#0f766e' }}>{metadata.revision}</span>
                        </div>
                        <div className={styles.metaCard}>
                            <span className={styles.metaLabel}>Uploaded By</span>
                            <span className={styles.metaValue}>{metadata.uploadedBy}</span>
                        </div>
                        <div className={styles.metaCard}>
                            <span className={styles.metaLabel}>Total Unique Components</span>
                            <span className={styles.metaValue}>{metadata.totalComponents}</span>
                        </div>
                    </div>
                </>
            )}

            {/* Data Grid Card */}
            <div className={styles.card}>
                <div className={styles.searchActions}>
                    <div className={styles.searchBar}>
                        <Search className={styles.searchIcon} size={16} />
                        <input
                            type="text"
                            placeholder="Search by part number, description, manufacturer..."
                            className={styles.searchInput}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div>
                        <button className={`${styles.paginationBtn}`} onClick={fetchItems} title="Refresh Table">
                            <RefreshCw size={14} />
                        </button>
                    </div>
                </div>

                {isLoading ? (
                    <div className={styles.loadingWrapper}>
                        <RefreshCw className={styles.spinner} size={32} />
                        <p style={{ color: '#64748b', margin: 0 }}>Loading BOM components...</p>
                    </div>
                ) : error ? (
                    <div className={styles.noData} style={{ color: '#ef4444' }}>
                        Error: {error}
                    </div>
                ) : items.length === 0 ? (
                    <div className={styles.noData}>
                        No components found in this BOM revision.
                    </div>
                ) : (
                    <>
                        <div className={styles.tableContainer}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th onClick={() => handleSort('sl_no')} style={{ width: '80px' }}>
                                            Sl No
                                            <ArrowUpDown size={12} className={styles.sortIcon} />
                                        </th>
                                        <th onClick={() => handleSort('vepl_part_no')}>
                                            VEPL Part No
                                            <ArrowUpDown size={12} className={styles.sortIcon} />
                                        </th>
                                        <th onClick={() => handleSort('description')}>
                                            Description
                                            <ArrowUpDown size={12} className={styles.sortIcon} />
                                        </th>
                                        <th onClick={() => handleSort('manufacturer')}>
                                            Manufacturer
                                            <ArrowUpDown size={12} className={styles.sortIcon} />
                                        </th>
                                        <th onClick={() => handleSort('manufacturer_part_no')}>
                                            Mfr. Part No
                                            <ArrowUpDown size={12} className={styles.sortIcon} />
                                        </th>
                                        <th onClick={() => handleSort('qty_per_product')}>
                                            Qty / Product
                                            <ArrowUpDown size={12} className={styles.sortIcon} />
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map(item => (
                                        <tr key={item.id}>
                                            <td style={{ textAlign: 'center', fontWeight: '500' }}>{item.sl_no}</td>
                                            <td className={styles.partNoCol}>{item.vepl_part_no}</td>
                                            <td className={styles.preLineCol}>{item.description}</td>
                                            <td className={styles.preLineCol}>{item.manufacturer}</td>
                                            <td className={styles.preLineCol}>{item.manufacturer_part_no}</td>
                                            <td className={styles.qtyCol}>{Number(item.qty_per_product)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Controls */}
                        <div className={styles.pagination}>
                            <div className={styles.pageInfo}>
                                Showing <strong>{((page - 1) * limit) + 1}</strong> to <strong>{Math.min(page * limit, totalItems)}</strong> of <strong>{totalItems}</strong> entries
                            </div>
                            <div className={styles.paginationControls}>
                                <button
                                    className={styles.paginationBtn}
                                    disabled={page === 1}
                                    onClick={() => handlePageChange(page - 1)}
                                >
                                    <ChevronLeft size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                                    Previous
                                </button>
                                
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    // Calculate page index centered around the current page
                                    let pageNum = page;
                                    if (page <= 3) {
                                        pageNum = i + 1;
                                    } else if (page > totalPages - 2) {
                                        pageNum = totalPages - 4 + i;
                                    } else {
                                        pageNum = page - 2 + i;
                                    }

                                    // Filter out invalid page numbers
                                    if (pageNum < 1 || pageNum > totalPages) return null;

                                    return (
                                        <button
                                            key={pageNum}
                                            className={`${styles.paginationBtn} ${page === pageNum ? styles.activePage : ''}`}
                                            onClick={() => handlePageChange(pageNum)}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}

                                <button
                                    className={styles.paginationBtn}
                                    disabled={page === totalPages}
                                    onClick={() => handlePageChange(page + 1)}
                                >
                                    Next
                                    <ChevronRight size={14} style={{ verticalAlign: 'middle', marginLeft: '4px' }} />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default BomView;
