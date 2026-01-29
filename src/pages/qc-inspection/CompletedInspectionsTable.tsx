import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import { useToast } from '../../components/Toast';
import { Pagination } from '../../components/Pagination';

interface Inspection {
    id: number;
    unit_serial_no: string;
    inspected_by: string;
    inspection_date_time: string;
    passed: string;
    failed: string;
    good_count: number;
    bad_count: number;
    status: string;
}

interface Props {
    refreshTrigger?: number;
}

export const CompletedInspectionsTable: React.FC<Props> = ({ refreshTrigger = 0 }) => {
    const { showToast } = useToast();
    const [inspections, setInspections] = useState<Inspection[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchInspections(currentPage);
    }, [currentPage, refreshTrigger]);

    const fetchInspections = async (page: number) => {
        setLoading(true);
        try {
            const data = await apiFetch(`/api/qc/completed?page=${page}&limit=10`);
            setInspections(data.data);
            setTotalPages(data.pagination.totalPages);
        } catch (error) {
            console.error('Error fetching inspections:', error);
            showToast('Failed to load completed inspections', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async (id: number) => {
        try {
            const blob = await apiFetch(`/api/qc/export?id=${id}`, {
                headers: { 'Accept': 'application/blob' }
            });

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `QC_Inspection_${id}.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            showToast('Download started', 'success');
        } catch (error) {
            console.error('Error downloading file:', error);
            showToast('Failed to download file', 'error');
        }
    };

    return (
        <div style={{ marginTop: '2rem', background: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#111827', marginBottom: '1rem' }}>Completed Batches</h3>

            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                        <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Unit Serial No</th>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Inspected By</th>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Date & Time</th>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: '600', color: '#374151' }}>Passed</th>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: '600', color: '#374151' }}>Failed</th>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: '600', color: '#374151' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center' }}>Loading...</td></tr>
                        ) : inspections.length === 0 ? (
                            <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>No completed inspections found</td></tr>
                        ) : (
                            inspections.map(item => (
                                <tr key={item.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                    <td style={{ padding: '0.75rem 1rem' }}>{item.unit_serial_no}</td>
                                    <td style={{ padding: '0.75rem 1rem' }}>{item.inspected_by}</td>
                                    <td style={{ padding: '0.75rem 1rem' }}>{new Date(item.inspection_date_time).toLocaleString()}</td>
                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                        <span style={{
                                            padding: '2px 8px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '500',
                                            backgroundColor: item.passed === 'YES' ? '#d1fae5' : '#f3f4f6',
                                            color: item.passed === 'YES' ? '#065f46' : '#374151'
                                        }}>
                                            {item.passed}
                                        </span>
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                        <span style={{
                                            padding: '2px 8px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '500',
                                            backgroundColor: item.failed === 'YES' ? '#fee2e2' : '#f3f4f6',
                                            color: item.failed === 'YES' ? '#991b1b' : '#374151'
                                        }}>
                                            {item.failed}
                                        </span>
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                        <button
                                            onClick={() => handleDownload(item.id)}
                                            style={{
                                                padding: '4px 12px',
                                                background: '#4f46e5',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontSize: '0.75rem'
                                            }}
                                        >
                                            Download
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                />
            </div>
        </div>
    );
};
