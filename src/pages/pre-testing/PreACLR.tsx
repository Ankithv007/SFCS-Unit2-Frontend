import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../../utils/api';
import styles from './PreACLR.module.css';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../hooks/useAuth';

interface YieldSummary {
    date: string;
    pass: number;
    fail: number;
    total: number;
    yield: number;
}

interface ScanRecord {
    id: number;
    barcode: string;
    operator_name: string;
    measured_value: number;
    aclr_result: 'PASS' | 'FAIL';
    retest_result: 'PASS' | null;
    retest_datetime: string | null;
    test_case_number: number | null;
    test_case_name?: string;
    shift: string;
    tpn: string;
    stage: string;
    jig_id: string;
    scanned_at: string;
}

interface TestCase {
    test_case_number: number;
    test_case_name: string;
    reason: string;
}

const JIG_OPTIONS = [
    'VB_999-MISC05038-C_0015',
    'VB_999-MISC05038-C_0023',
    'VB_999-MISC05038-C_0028',
    'VB_999-MISC05038-C_0039',
    'VB_999-MISC05038-C_0045'
];

const ALLOWED_DOWNLOAD_ROLES = ['Super Admin', 'Admin', 'Manager'];

export const PreACLR: React.FC = () => {
    // Session State
    const [operatorName, setOperatorName] = useState<string>(localStorage.getItem('pre_aclr_operator') || '');
    const [isOperatorLocked, setIsOperatorLocked] = useState<boolean>(!!localStorage.getItem('pre_aclr_operator'));
    const [selectedJig, setSelectedJig] = useState<string>(localStorage.getItem('pre_aclr_jig') || '');

    // Scan State
    const [barcode, setBarcode] = useState<string>('');
    const [isVerified, setIsVerified] = useState<boolean>(false);
    const [measuredValue, setMeasuredValue] = useState<string>('');
    const [result, setResult] = useState<'PASS' | 'FAIL'>('PASS');

    // Data State
    const [yieldSummary, setYieldSummary] = useState<YieldSummary[]>([]);
    const [completedScans, setCompletedScans] = useState<ScanRecord[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [barcodeFilter, setBarcodeFilter] = useState('');
    const [showBarcodeFilter, setShowBarcodeFilter] = useState(false);
    const [testCases, setTestCases] = useState<TestCase[]>([]);

    const barcodeInputRef = useRef<HTMLInputElement>(null);
    const { showToast } = useToast();
    const { user } = useAuth();
    const scanLock = useRef(false);

    // Fixed Values
    const TPN = '611-PCA000117-L';
    const STAGE = 'PRE-ACLR';

    const isDownloadAllowed = user && ALLOWED_DOWNLOAD_ROLES.includes(user.role);

    // Auto-Verify when barcode is scanned
    useEffect(() => {
        const trimmed = barcode.trim().toUpperCase();
        if (barcode === '') {
            setIsVerified(false);
            return;
        }

        let coreBarcode = trimmed;
        if (coreBarcode.startsWith('SN:')) {
            coreBarcode = coreBarcode.substring(3).trim();
        }

        const BARCODE_REGEX = /^[A-Z]{2}-[A-Z0-9]{4}-[A-Z0-9]{2}-[A-Z0-9]{4}$/;
        if (BARCODE_REGEX.test(coreBarcode) && !isVerified) {
            handleVerifyBarcode(coreBarcode);
        }
    }, [barcode, isVerified]);

    useEffect(() => {
        fetchSummary();
        fetchScans();
        fetchTestCases();
        if (isOperatorLocked) {
            barcodeInputRef.current?.focus();
        }
    }, [isOperatorLocked, currentPage]);

    // Refetch scans when barcode filter changes
    useEffect(() => {
        const timeout = setTimeout(() => {
            if (currentPage !== 1) {
                setCurrentPage(1);
            } else {
                fetchScans();
            }
        }, 500);
        return () => clearTimeout(timeout);
    }, [barcodeFilter]);

    const fetchTestCases = async () => {
        try {
            const data = await apiFetch('/api/pretest/pre-aclr/test-cases');
            setTestCases(data);
        } catch (error) {
            console.error('Error fetching test cases:', error);
        }
    };

    const fetchSummary = async () => {
        try {
            const data = await apiFetch('/api/pretest/pre-aclr/summary');
            setYieldSummary(data);
        } catch (error) {
            console.error('Error fetching summary:', error);
        }
    };

    const fetchScans = async () => {
        try {
            const data = await apiFetch(`/api/pretest/pre-aclr/scans?page=${currentPage}&limit=20&barcode=${encodeURIComponent(barcodeFilter)}`);
            setCompletedScans(data.data);
            setTotalPages(data.pagination.pages);
        } catch (error) {
            console.error('Error fetching scans:', error);
        }
    };

    const handleLockOperator = () => {
        if (!operatorName.trim()) {
            showToast('Please enter Operator Name', 'error');
            return;
        }
        if (!selectedJig) {
            showToast('Please select a Jig ID', 'error');
            return;
        }
        localStorage.setItem('pre_aclr_operator', operatorName);
        localStorage.setItem('pre_aclr_jig', selectedJig);
        setIsOperatorLocked(true);
        showToast('Operator and Jig locked', 'success');
    };

    const handleResetOperator = async () => {
        if (window.confirm('Are you sure you want to reset the operator and next batch?')) {
            localStorage.removeItem('pre_aclr_operator');
            localStorage.removeItem('pre_aclr_jig');
            setOperatorName('');
            setSelectedJig('');
            setIsOperatorLocked(false);
            setIsVerified(false);
            await apiFetch('/api/pretest/pre-aclr/reset-session', { method: 'POST' });
            showToast('Session reset', 'info');
        }
    };

    const allowedCodes = testCases.map(tc => tc.test_case_number);
    const isFail = result === 'FAIL';
    const isValidFailCode = allowedCodes.includes(Number(measuredValue));
    const isSubmitDisabled = !isVerified || (isFail && !isValidFailCode) || !selectedJig;

    const handleVerifyBarcode = async (barcodeToVerify?: string) => {
        let trimmedBarcode = (barcodeToVerify || barcode).trim();
        if (!trimmedBarcode) return;

        if (trimmedBarcode.toUpperCase().startsWith('SN:')) {
            trimmedBarcode = trimmedBarcode.substring(3).trim();
        }

        const BARCODE_REGEX = /^[A-Z]{2}-[A-Z0-9]{4}-[A-Z0-9]{2}-[A-Z0-9]{4}$/;
        if (!BARCODE_REGEX.test(trimmedBarcode.toUpperCase())) {
            showToast('Invalid barcode format. Must be 15 characters (e.g. AO-4734-34-2344)', 'error');
            return;
        }

        try {
            await apiFetch(`/api/pretest/pre-aclr/verify-barcode?barcode=${encodeURIComponent(trimmedBarcode)}`);
            setIsVerified(true);
            showToast('Barcode verified successfully.', 'success');
        } catch (error: any) {
            if (error.message && error.message.toLowerCase().includes('duplicate')) {
                // Silent
            } else {
                showToast(error.message || 'Error verifying barcode.', 'error');
            }
            setIsVerified(false);
        }
    };

    const handleSubmitScan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!barcode.trim() || isSubmitDisabled || scanLock.current) return;

        scanLock.current = true;
        setTimeout(() => { scanLock.current = false; }, 2000);

        if (!operatorName) {
            showToast('Please enter Operator Name before scanning.', 'error');
            return;
        }

        if (!selectedJig) {
            showToast('Please select a Jig ID.', 'error');
            return;
        }

        try {
            const response = await apiFetch('/api/pretest/pre-aclr/scan', {
                method: 'POST',
                body: JSON.stringify({
                    barcode: barcode.trim(),
                    operator_name: operatorName,
                    measured_value: result === 'PASS' ? null : parseInt(measuredValue),
                    aclr_result: result,
                    jig_id: selectedJig
                })
            });

            showToast(response.message, 'success');

            // Reset UI state
            setBarcode('');
            setIsVerified(false);
            setMeasuredValue('');
            setResult('PASS');
            fetchSummary();
            fetchScans();
            barcodeInputRef.current?.focus();
        } catch (error: any) {
            if (error.message && error.message.toLowerCase().includes('duplicate')) {
                setBarcode('');
            } else {
                showToast(error.message || 'Error recording scan', 'error');
            }
            barcodeInputRef.current?.focus();
        }
    };

    const handleDownload = async () => {
        if (!isDownloadAllowed) {
            showToast('Access Denied – You do not have permission to download', 'error');
            return;
        }

        try {
            const blob = await apiFetch('/api/pretest/pre-aclr/download');
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Pre_ACLR_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            showToast('Download failed', 'error');
        }
    };

    return (
        <div className={styles.container}>
            {/* Header Area */}
            <div className={styles.headerRow}>
                <div className={styles.headerContent}>
                    <h2>📡 PRE-ACLR</h2>
                </div>

                <div className={styles.headerOperator}>
                    <div className={styles.headerInputGroup}>
                        <label>Operator *</label>
                        <div className={styles.headerBarcodeRow}>
                            <input
                                type="text"
                                className={styles.headerInput}
                                placeholder="Enter operator..."
                                value={operatorName}
                                onChange={(e) => setOperatorName(e.target.value)}
                                disabled={isOperatorLocked}
                            />
                        </div>
                    </div>
                    <div className={styles.headerInputGroup} style={{ marginLeft: '1rem' }}>
                        <label>Jig ID *</label>
                        <div className={styles.headerBarcodeRow}>
                            <select
                                className={styles.headerInput}
                                value={selectedJig}
                                onChange={(e) => setSelectedJig(e.target.value)}
                                disabled={isOperatorLocked}
                                style={{ width: '220px' }}
                            >
                                <option value="">Select Jig ID</option>
                                {JIG_OPTIONS.map(id => (
                                    <option key={id} value={id}>{id}</option>
                                ))}
                            </select>
                            {!isOperatorLocked ? (
                                <button className={styles.headerLockBtn} onClick={handleLockOperator}>Lock</button>
                            ) : (
                                <button className={styles.headerResetBtn} onClick={handleResetOperator}>Reset</button>
                            )}
                        </div>
                    </div>
                </div>

                <div className={styles.headerFixedValues}>
                    <div className={styles.fixedInfoItem}>TPN: <strong>{TPN}</strong></div>
                    <div className={styles.fixedInfoItem}>Stage: <strong>{STAGE}</strong></div>
                </div>
            </div>

            {/* Section 2: Barcode Scan */}
            <div className={styles.card}>
                <form onSubmit={handleSubmitScan} className={styles.scanningSection}>
                    <div className={styles.barcodeRow}>
                        <div className={styles.inputGroup} style={{ flex: 2 }}>
                            <label>Barcode Scan *</label>
                            <div className={styles.barcodeRow} style={{ gap: '0.5rem' }}>
                                <input
                                    ref={barcodeInputRef}
                                    type="text"
                                    className={`${styles.input} ${styles.barcodeInput}`}
                                    placeholder={isOperatorLocked ? "Scan Barcode..." : "Lock operator first"}
                                    value={barcode}
                                    onChange={(e) => setBarcode(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleVerifyBarcode();
                                        }
                                    }}
                                    disabled={!isOperatorLocked}
                                />
                                <button
                                    type="button"
                                    className={styles.scanBtn}
                                    onClick={() => handleVerifyBarcode()}
                                    disabled={!isOperatorLocked || !barcode.trim() || isVerified}
                                >
                                    {isVerified ? '✓' : 'Scan'}
                                </button>
                            </div>
                        </div>
                        <div className={styles.inputGroup} style={{ flex: 1 }}>
                            <label>Measured Value {result === 'FAIL' ? '*' : ''}</label>
                            <input
                                type="number"
                                step="1"
                                className={styles.input}
                                placeholder={result === 'PASS' ? "Disabled for PASS" : "Enter Code (50, 51...)"}
                                value={measuredValue}
                                onChange={(e) => setMeasuredValue(e.target.value)}
                                disabled={!isOperatorLocked || result === 'PASS'}
                            />
                            {result === 'FAIL' && measuredValue && (
                                <div style={{ fontSize: '10px', color: '#666', marginTop: '2px', fontStyle: 'italic' }}>
                                    {testCases.find(tc => tc.test_case_number === Number(measuredValue))?.test_case_name || 'Invalid Code'}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className={styles.resultPanel}>
                        <div className={styles.resultButtons}>
                            <button
                                type="button"
                                className={`${styles.passBtn} ${result === 'PASS' ? styles.active : ''}`}
                                onClick={() => {
                                    setResult('PASS');
                                    setMeasuredValue('');
                                }}
                                disabled={!isOperatorLocked}
                            >
                                PASS
                            </button>
                            <button
                                type="button"
                                className={`${styles.failBtn} ${result === 'FAIL' ? styles.active : ''}`}
                                onClick={() => setResult('FAIL')}
                                disabled={!isOperatorLocked}
                            >
                                FAIL
                            </button>
                        </div>

                        <button
                            type="submit"
                            className={styles.submitBtn}
                            disabled={isSubmitDisabled}
                        >
                            Submit
                        </button>
                    </div>
                </form>
            </div>

            {/* Bottom Split Section */}
            <div className={styles.splitSection}>
                <div className={styles.yieldColumn}>
                    <div className={styles.columnHeader}>
                        <h3>Last 5 Days Summary</h3>
                    </div>
                    <div className={styles.columnContent}>
                        <table className={styles.yieldTable}>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Pass</th>
                                    <th>Fail</th>
                                    <th>Total</th>
                                    <th>Yield %</th>
                                </tr>
                            </thead>
                            <tbody>
                                {yieldSummary.map((s, i) => (
                                    <tr key={i}>
                                        <td>{s.date.split('T')[0]}</td>
                                        <td className={styles.statusPass}>{s.pass}</td>
                                        <td className={styles.statusFail}>{s.fail}</td>
                                        <td>{s.total}</td>
                                        <td style={{ fontWeight: 700 }}>{s.yield}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className={styles.batchColumn}>
                    <div className={styles.columnHeader}>
                        <h3>Completed Scans</h3>
                        <button
                            className={styles.downloadBtn}
                            onClick={handleDownload}
                            title={isDownloadAllowed ? "Download Excel" : "Access Denied – You do not have permission to download"}
                        >
                            📥
                        </button>
                    </div>
                    <div className={styles.columnContent}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>S.No</th>
                                    <th>Date & Time</th>
                                    <th style={{ position: 'relative' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            Barcode
                                            <button
                                                type="button"
                                                onClick={() => setShowBarcodeFilter(!showBarcodeFilter)}
                                                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.9rem' }}
                                                title="Filter Barcode"
                                            >
                                                🔍
                                            </button>
                                        </div>
                                        {showBarcodeFilter && (
                                            <div style={{ marginTop: '0.5rem' }}>
                                                <input
                                                    type="text"
                                                    placeholder="Search..."
                                                    value={barcodeFilter}
                                                    onChange={(e) => setBarcodeFilter(e.target.value)}
                                                    autoFocus
                                                    className={styles.input}
                                                    style={{
                                                        padding: '0.25rem 0.5rem',
                                                        fontSize: '0.8rem',
                                                        width: '100%',
                                                        boxSizing: 'border-box'
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Escape') {
                                                            setShowBarcodeFilter(false);
                                                            setBarcodeFilter('');
                                                        }
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </th>
                                    <th>Result</th>
                                    <th>Failed Case NO</th>
                                    <th>FAILURE CASE</th>
                                </tr>
                            </thead>
                            <tbody>
                                {completedScans.map((s, i) => (
                                    <tr key={s.id}>
                                        <td>{(currentPage - 1) * 20 + i + 1}</td>
                                        <td>{new Date(new Date(s.scanned_at).getTime() + (5.5 * 60 * 60 * 1000)).toISOString().replace('T', ' ').substring(0, 19)}</td>
                                        <td style={{ fontWeight: 600 }}>{s.barcode}</td>
                                        <td>
                                            {s.retest_result ? (
                                                <span className={styles.statusRetest}>RETEST</span>
                                            ) : (
                                                <span className={s.aclr_result === 'PASS' ? styles.statusPass : styles.statusFail}>
                                                    {s.aclr_result}
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            {s.aclr_result === 'FAIL' ? (s.test_case_number || '-') : '-'}
                                        </td>
                                        <td>
                                            {s.aclr_result === 'FAIL' ? (s.test_case_name || '-') : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {totalPages > 1 && (
                            <div className={styles.pagination}>
                                <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className={styles.pageBtn}>Prev</button>
                                {[...Array(totalPages)].map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setCurrentPage(i + 1)}
                                        className={`${styles.pageBtn} ${currentPage === i + 1 ? styles.active : ''}`}
                                    >
                                        {i + 1}
                                    </button>
                                ))}
                                <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p - 1)} className={styles.pageBtn}>Next</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
