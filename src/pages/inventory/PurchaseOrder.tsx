import React, { useState, useMemo, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import styles from './PurchaseOrder.module.css';
import { Button } from '../../components/Button';
import { FormField } from '../../components/FormField';
import { useToast } from '../../components/Toast';

interface POItem {
    item_name: string;
    description: string;
    vepl_part_no: string;
    mpn: string;
    ordered_qty: number;
    unit_price: number;
    tax_rate: number;
    hsn_sac?: string;
    sku?: string;
    mfr?: string;
    location?: string;
}

interface PurchaseOrderData {
    po_number: string;
    date: string;
    vendor: {
        name: string;
        address: string;
        gstin: string;
        email: string;
        phone?: string;
    };
    items: POItem[];
    total: number;
    sub_total: number;
    tax_total: number;
    adjustment: number;
    organization?: string;
}

type SortField = 'po_number' | 'date' | 'vendor' | 'total' | null;
type SortOrder = 'asc' | 'desc';

export const PurchaseOrder: React.FC = () => {
    const [searchPo, setSearchPo] = useState('');
    const [poList, setPoList] = useState<PurchaseOrderData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const { showToast } = useToast();

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(12);

    // Sorting state
    const [sortField, setSortField] = useState<SortField>(null);
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

    // Expanded rows state
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    // Organization state
    const [selectedOrg, setSelectedOrg] = useState<'VEAPL' | 'VISPL'>('VEAPL');

    // Fetch Saved POs on Mount
    useEffect(() => {
        const fetchSavedPOs = async () => {
            setIsLoading(true);
            try {
                const data = await apiFetch('/api/inventory/po');
                setPoList(data);
            } catch (error) {
                console.error('Error fetching saved POs:', error);
                showToast('Failed to load saved Purchase Orders', 'error');
            } finally {
                setIsLoading(false);
            }
        };

        fetchSavedPOs();
    }, []);

    const handleFetchPO = async () => {
        if (!searchPo) {
            showToast('Please enter a PO Number', 'error');
            return;
        }

        setIsLoading(true);
        try {
            const data = await apiFetch(`/api/inventory/zoho/po/${encodeURIComponent(searchPo)}?org=${selectedOrg}`);

            setPoList(prev => {
                // Remove existing if present to update it
                const filtered = prev.filter(p => p.po_number !== data.po_number);
                return [data, ...filtered];
            });

            showToast('PO details fetched successfully', 'success');
            setSearchPo('');
            setSortField(null);
        } catch (error) {
            console.error('Error fetching PO:', error);
            showToast('Failed to fetch PO details. Please check the PO Number and Organization.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('asc');
        }
    };

    const toggleRow = (poNumber: string) => {
        setExpandedRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(poNumber)) {
                newSet.delete(poNumber);
            } else {
                newSet.add(poNumber);
            }
            return newSet;
        });
    };

    const handleQuantityChange = (poNumber: string, itemIndex: number, newQty: string) => {
        setPoList(prev => prev.map(po => {
            if (po.po_number === poNumber) {
                const newItems = [...po.items];
                newItems[itemIndex] = { ...newItems[itemIndex], ordered_qty: Number(newQty) };
                return { ...po, items: newItems };
            }
            return po;
        }));
    };

    const handleLocationChange = (poNumber: string, itemIndex: number, newLocation: string) => {
        setPoList(prev => prev.map(po => {
            if (po.po_number === poNumber) {
                const newItems = [...po.items];
                newItems[itemIndex] = { ...newItems[itemIndex], location: newLocation };
                return { ...po, items: newItems };
            }
            return po;
        }));
    };

    const handleSavePO = async (po: PurchaseOrderData) => {
        try {
            await apiFetch('/api/inventory/po', {
                method: 'POST',
                body: JSON.stringify({
                    po_number: po.po_number,
                    date: po.date,
                    vendor: po.vendor,
                    items: po.items,
                    organization: selectedOrg // Save with selected Org
                }),
            });

            showToast('Purchase Order saved successfully!', 'success');

            // Refresh list to ensure we have the latest state (including ID)
            const data = await apiFetch('/api/inventory/po');
            setPoList(data);

        } catch (error: any) {
            console.error('Error saving PO:', error);
            showToast(error.message || 'Failed to save PO', 'error');
        }
    };

    // Sorted and paginated data
    const sortedData = useMemo(() => {
        // Filter by selected Organization
        const filteredByOrg = poList.filter(po => po.organization === selectedOrg || (!po.organization && selectedOrg === 'VEAPL')); // Default to VEAPL if undefined for legacy

        const sorted = [...filteredByOrg].sort((a, b) => {
            let aValue: any;
            let bValue: any;

            switch (sortField) {
                case null:
                    return 0;
                case 'po_number':
                    aValue = a.po_number;
                    bValue = b.po_number;
                    break;
                case 'date':
                    aValue = new Date(a.date).getTime();
                    bValue = new Date(b.date).getTime();
                    break;
                case 'vendor':
                    aValue = a.vendor.name.toLowerCase();
                    bValue = b.vendor.name.toLowerCase();
                    break;
                case 'total':
                    aValue = a.items.reduce((sum, item) => sum + (item.ordered_qty * item.unit_price), 0);
                    bValue = b.items.reduce((sum, item) => sum + (item.ordered_qty * item.unit_price), 0);
                    break;
            }

            if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        return sorted;
    }, [poList, sortField, sortOrder, selectedOrg]);

    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        return sortedData.slice(startIndex, startIndex + pageSize);
    }, [sortedData, currentPage, pageSize]);

    const totalPages = Math.ceil(sortedData.length / pageSize);

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <span className={styles.sortIcon}>⇅</span>;
        return <span className={`${styles.sortIcon} ${styles.active}`}>{sortOrder === 'asc' ? '↑' : '↓'}</span>;
    };

    return (
        <div className={styles.container}>
            <h2>Purchase Order (PO)</h2>
            <p>Import and manage Purchase Orders from Zoho.</p>

            <div className={styles.searchSection}>
                <div className={styles.searchControls}>
                    <div className={styles.orgSelector}>
                        <label>Organization:</label>
                        <select
                            value={selectedOrg}
                            onChange={(e) => setSelectedOrg(e.target.value as 'VEAPL' | 'VISPL')}
                            className={styles.orgDropdown}
                        >
                            <option value="VEAPL">VEAPL (Zoho Books)</option>
                            <option value="VISPL">VISPL (Zoho Inventory)</option>
                        </select>
                    </div>

                    <div className={styles.searchInputWrapper}>
                        <div className={styles.searchInput}>
                            <FormField
                                id="poSearch"
                                label="Search PO Number"
                                value={searchPo}
                                onChange={(e) => setSearchPo(e.target.value)}
                                placeholder={`Search ${selectedOrg} PO...`}
                                disabled={isLoading}
                                className={styles.searchField}
                            />
                        </div>
                        <div className={styles.fetchButtonWrapper}>
                            <Button onClick={handleFetchPO} isLoading={isLoading}>
                                Fetch from {selectedOrg}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {poList.length > 0 ? (
                <>
                    <div className={styles.tableContainer}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th onClick={() => handleSort('po_number')}>
                                        <div className={styles.sortable}>
                                            PO Number <SortIcon field="po_number" />
                                        </div>
                                    </th>
                                    <th onClick={() => handleSort('date')}>
                                        <div className={styles.sortable}>
                                            Date <SortIcon field="date" />
                                        </div>
                                    </th>
                                    <th onClick={() => handleSort('vendor')}>
                                        <div className={styles.sortable}>
                                            Vendor <SortIcon field="vendor" />
                                        </div>
                                    </th>
                                    <th>Items</th>
                                    <th onClick={() => handleSort('total')}>
                                        <div className={styles.sortable}>
                                            Total Cost (incl. GST) <SortIcon field="total" />
                                        </div>
                                    </th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedData.map((po) => {
                                    // const totalValue = po.items.reduce((acc, item) => acc + (item.ordered_qty * item.unit_price), 0);
                                    const isExpanded = expandedRows.has(po.po_number);

                                    return (
                                        <React.Fragment key={po.po_number}>
                                            <tr>
                                                <td>{po.po_number}</td>
                                                <td>{new Date(po.date).toLocaleDateString()}</td>
                                                <td>
                                                    <div className={styles.vendorCell}>
                                                        <span className={styles.vendorName}>{po.vendor.name}</span>
                                                        <span className={styles.vendorGstin}>GSTIN: {po.vendor.gstin}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className={styles.itemsCell}>
                                                        <span className={styles.itemCount}>{po.items.length} Items</span>
                                                        <span className={styles.itemPreview}>
                                                            {po.items.map(i => i.item_name).join(', ').slice(0, 40)}...
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className={styles.totalCell}>
                                                    ₹{po.total?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
                                                </td>
                                                <td>
                                                    <button
                                                        className={styles.expandButton}
                                                        onClick={() => toggleRow(po.po_number)}
                                                    >
                                                        {isExpanded ? '▼ Hide' : '▶ View Items'}
                                                    </button>
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr className={styles.expandedRow}>
                                                    <td colSpan={6}>
                                                        <div className={styles.expandedContent}>
                                                            <h4>Item Details</h4>
                                                            <div className={styles.itemTableContainer}>
                                                                <table className={styles.itemTable}>
                                                                    <thead>
                                                                        <tr>
                                                                            <th>VEPL Part No</th>
                                                                            <th>SKU</th>
                                                                            <th>MPN</th>
                                                                            <th>Item & Description</th>
                                                                            <th>MFR</th>
                                                                            <th>Qty</th>
                                                                            <th>Location</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {po.items.map((item, idx) => (
                                                                            <tr key={idx}>
                                                                                <td>{item.vepl_part_no}</td>
                                                                                <td>{item.sku || '-'}</td>
                                                                                <td>{item.mpn || '-'}</td>
                                                                                <td>
                                                                                    <div className={styles.itemName}>{item.item_name}</div>
                                                                                    <div className={styles.itemDesc}>{item.description}</div>
                                                                                </td>
                                                                                <td>{item.mfr || '-'}</td>
                                                                                <td>
                                                                                    <div className={styles.qtyControl}>
                                                                                        <button
                                                                                            className={styles.qtyBtn}
                                                                                            onClick={() => handleQuantityChange(po.po_number, idx, String(Math.max(0, item.ordered_qty - 1)))}
                                                                                        >
                                                                                            -
                                                                                        </button>
                                                                                        <input
                                                                                            type="number"
                                                                                            className={styles.qtyInputInner}
                                                                                            value={item.ordered_qty}
                                                                                            onChange={(e) => handleQuantityChange(po.po_number, idx, e.target.value)}
                                                                                        />
                                                                                        <button
                                                                                            className={styles.qtyBtn}
                                                                                            onClick={() => handleQuantityChange(po.po_number, idx, String(item.ordered_qty + 1))}
                                                                                        >
                                                                                            +
                                                                                        </button>
                                                                                    </div>
                                                                                </td>
                                                                                <td>
                                                                                    <input
                                                                                        type="text"
                                                                                        className={styles.locationInput}
                                                                                        value={item.location || ''}
                                                                                        onChange={(e) => handleLocationChange(po.po_number, idx, e.target.value)}
                                                                                        placeholder="Add Location"
                                                                                    />
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                            <div className={styles.actionRow}>
                                                                <button
                                                                    className={styles.saveButton}
                                                                    onClick={() => handleSavePO(po)}
                                                                >
                                                                    💾 Save to Database
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div >

                    <div className={styles.paginationContainer}>
                        <div className={styles.pageSizeSelector}>
                            <label>Page Size:</label>
                            <select
                                value={pageSize}
                                onChange={(e) => {
                                    setPageSize(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                            >
                                <option value={12}>12</option>
                                <option value={24}>24</option>
                                <option value={48}>48</option>
                            </select>
                        </div>

                        <div className={styles.pageInfo}>
                            {sortedData.length > 0 && (
                                <>
                                    {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length}
                                </>
                            )}
                        </div>

                        <div className={styles.paginationButtons}>
                            <button
                                className={styles.pageButton}
                                onClick={() => setCurrentPage(1)}
                                disabled={currentPage === 1}
                            >
                                ⟨⟨
                            </button>
                            <button
                                className={styles.pageButton}
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                            >
                                ⟨
                            </button>
                            <span className={styles.pageInfo}>
                                Page {currentPage} of {totalPages}
                            </span>
                            <button
                                className={styles.pageButton}
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                            >
                                ⟩
                            </button>
                            <button
                                className={styles.pageButton}
                                onClick={() => setCurrentPage(totalPages)}
                                disabled={currentPage === totalPages}
                            >
                                ⟩⟩
                            </button>
                        </div>
                    </div>
                </>
            ) : (
                <div className={styles.emptyState}>
                    <h3>No Purchase Orders</h3>
                    <p>Search and fetch PO details from Zoho to get started.</p>
                </div>
            )}
        </div >
    );
};
