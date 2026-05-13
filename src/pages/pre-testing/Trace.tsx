import React, { useState, useRef, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import styles from './Trace.module.css';
import { useToast } from '../../components/Toast';

interface TraceSummary {
    current_stage: string;
    last_status: string;
    operator: string;
    batch_id: number | null;
    last_updated_at: string;
}

interface TimelineItem {
    stage: string;
    order: number;
    status: string;
    operator: string;
    timestamp: string;
    source: string;
    remarks: string;
}

interface TraceData {
    barcode: string;
    summary: TraceSummary;
    timeline: TimelineItem[];
}

interface StageSummary {
    scanned: number;
    passed: number;
    rework?: number;
    rework_passed: number;
    failed: number;
    scrap?: number;
    moving_to_next: number;
    final_output?: number;
}

interface BatchData {
    batch: string;
    warehouse: {
        total_created: number;
        total_scanned: number;
    };
    pre_iqc: StageSummary;
    pre_impedance: StageSummary;
    pre_calibration: StageSummary;
    pre_aclr: StageSummary;
}

const STAGE_ORDER = [
    'Warehouse',
    'Pre-IQC',
    'Pre-Impedance',
    'Pre-Calibration',
    'Pre-ACLR'
];

const StageFlow: React.FC<{ timeline: TimelineItem[] }> = ({ timeline }) => {
    let stopFlow = false;

    const stages = STAGE_ORDER.map((stageName) => {
        const stageEntries = timeline
            .filter(t => t.stage === stageName)
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        let status = 'NOT_REACHED';
        if (stageEntries.length > 0) {
            const latest = stageEntries[stageEntries.length - 1];
            status = latest.status.toUpperCase();

            // Detect rework_PASSED: Had failure/rework earlier, then Passed
            const hadFailure = stageEntries.some(e => e.status.toUpperCase() === 'FAILED' || e.status.toUpperCase() === 'rework');
            if (hadFailure && status === 'PASSED') {
                status = 'rework_PASSED';
            }
        }

        const currentStageStatus = stopFlow ? 'INACTIVE' : status;

        // If this stage is the final FAILED one, it stops the flow for NEXT stages
        if (!stopFlow && status === 'FAILED') {
            stopFlow = true;
        }

        return {
            name: stageName,
            status: currentStageStatus,
            isCritical: stageName === 'Pre-Calibration'
        };
    });

    const getIcon = (status: string) => {
        switch (status) {
            case 'PASSED': return '✅';
            case 'rework_PASSED': return '🔁✅';
            case 'FAILED': return '❌';
            case 'IN_PROGRESS': return '⚙️';
            default: return '';
        }
    };

    const getNodeClass = (status: string, isCritical: boolean) => {
        let baseClass = styles.node;
        if (isCritical) baseClass += ` ${styles.criticalNode}`;

        switch (status) {
            case 'PASSED': return `${baseClass} ${styles.nodePassed}`;
            case 'rework_PASSED': return `${baseClass} ${styles.nodePassed}`;
            case 'FAILED': return `${baseClass} ${styles.nodeFailed}`;
            case 'INACTIVE': return `${baseClass} ${styles.nodeInactive}`;
            default: return `${baseClass} ${styles.nodeInactive}`;
        }
    };

    return (
        <div className={styles.flowContainer}>
            {stages.map((stage, idx) => (
                <React.Fragment key={stage.name}>
                    <div className={getNodeClass(stage.status, stage.isCritical)}>
                        <div className={styles.circle}>
                            {getIcon(stage.status)}
                            {stage.status === 'FAILED' && <span className={styles.failAlert}>!</span>}
                        </div>
                        <div className={styles.stageLabel}>
                            <div className={styles.stageName}>{stage.name}</div>
                            <div className={styles.statusText}>{stage.status.replace('_', ' ')}</div>
                        </div>
                    </div>
                    {idx < stages.length - 1 && (
                        <div className={`${styles.connector} ${stages[idx].status === 'PASSED' || stages[idx].status === 'rework_PASSED'
                            ? styles.connectorActive
                            : stages[idx].status === 'FAILED'
                                ? styles.connectorStop
                                : styles.connectorInactive
                            }`} />
                    )}
                </React.Fragment>
            ))}
        </div>
    );
};

export const Trace: React.FC = () => {
    const [barcode, setBarcode] = useState('');
    const [batchInput, setBatchInput] = useState('');
    const [traceData, setTraceData] = useState<TraceData | null>(null);
    const [batchData, setBatchData] = useState<BatchData | null>(null);
    const [loading, setLoading] = useState(false);
    const [hasAttempted, setHasAttempted] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);
    const { showToast } = useToast();

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleTrace = async (e?: React.FormEvent, type: 'unit' | 'batch' = 'unit') => {
        if (e) e.preventDefault();

        let input = type === 'unit' ? barcode.trim() : batchInput.trim();
        if (!input) {
            showToast(`Please enter a ${type === 'unit' ? 'barcode' : 'batch number'}`, 'error');
            return;
        }

        if (type === 'unit') {
            let coreBarcode = input.toUpperCase();
            if (coreBarcode.startsWith('SN:')) {
                coreBarcode = coreBarcode.substring(3).trim();
            }

            const BARCODE_REGEX = /^[A-Z]{2}-[A-Z0-9]{4}-[A-Z0-9]{2}-[A-Z0-9]{4}$/;
            if (!BARCODE_REGEX.test(coreBarcode)) {
                showToast('Invalid Barcode format. Must be 15 characters (e.g. AO-4734-34-2344)', 'error');
                return;
            }
            input = coreBarcode; // Use sanitized barcode
        }

        setLoading(true);
        setHasAttempted(true);

        try {
            if (type === 'unit') {
                const data = await apiFetch(`/api/pretest/trace/${encodeURIComponent(input)}`);
                setTraceData(data);
                showToast('Unit history retrieved', 'success');
            } else {
                const bData = await apiFetch(`/api/pretest/trace/batch-summary/${encodeURIComponent(input)}`);
                setBatchData(bData);
                showToast('Batch summary retrieved', 'success');
            }
        } catch (error: any) {
            console.error('Trace error:', error);
            if (error.message.includes('404') || error.status === 404) {
                showToast(`No data found for this ${type}`, 'info');
                if (type === 'unit') setTraceData(null);
                else setBatchData(null);
            } else {
                showToast(error.message || 'Failed to retrieve data', 'error');
            }
        } finally {
            setLoading(false);
            if (type === 'unit') inputRef.current?.focus();
        }
    };

    const getStatusClass = (status: string) => {
        switch (status.toLowerCase()) {
            case 'passed': return styles.passed;
            case 'failed': return styles.failed;
            case 'rework': return styles.rework;
            case 'scrap': return styles.scrap;
            default: return '';
        }
    };

    const getStageIcon = (stage: string) => {
        switch (stage) {
            case 'Warehouse': return '•';
            case 'Pre-IQC': return '•';
            case 'Pre-Impedance': return '•';
            case 'Pre-Calibration': return '•';
            case 'Pre-ACLR': return '•';
            default: return '•';
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.headerRow}>
                <div className={styles.headerContent}>
                    <h2>PRODUCTION TRACEABILITY</h2>
                </div>
                <div className={styles.fixedInfoItem}>
                    System: <strong>PRE-TESTING (E2E)</strong>
                </div>
            </div>

            <div className={styles.mainContent}>
                {/* Left Panel: Batch Summary */}
                <div className={styles.leftPanel}>
                    <div className={styles.panelHeader}>
                        <h3>Batch Tracking</h3>
                    </div>

                    <div className={styles.card}>
                        <form onSubmit={(e) => handleTrace(e, 'batch')} className={styles.scanningSection}>
                            <div className={styles.inputGroup}>
                                <label>Batch Number Scan</label>
                                <div className={styles.barcodeRow}>
                                    <input
                                        type="text"
                                        className={styles.barcodeInput}
                                        placeholder="Scan or enter batch..."
                                        value={batchInput}
                                        onChange={(e) => setBatchInput(e.target.value)}
                                        disabled={loading}
                                    />
                                    <button
                                        type="submit"
                                        className={styles.traceBtn}
                                        disabled={loading || !batchInput.trim()}
                                    >
                                        Trace Batch
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>

                    <div className={styles.batchResultsArea}>
                        {batchData ? (
                            <div className={styles.batchSummaryContainer}>
                                <div className={styles.batchHeaderCard}>
                                    <span className={styles.batchLabel}>Active Batch:</span>
                                    <span className={styles.batchValue}>{batchData.batch}</span>
                                </div>

                                <div className={styles.stageCardsGrid}>
                                    {/* Warehouse Card */}
                                    <div className={styles.stageCard}>
                                        <div className={styles.stageCardHeader}>1. Warehouse</div>
                                        <div className={styles.stageMetrics}>
                                            <div className={styles.metricRow}>
                                                <span>Total Created:</span>
                                                <span className={styles.metricValue}>{batchData.warehouse.total_created}</span>
                                            </div>
                                            <div className={styles.metricRow}>
                                                <span>Total Scanned:</span>
                                                <span className={styles.metricValue}>{batchData.warehouse.total_scanned}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Pre-IQC Card */}
                                    <div className={styles.stageCard}>
                                        <div className={styles.stageCardHeader}>2. Pre-IQC</div>
                                        <div className={styles.stageMetrics}>
                                            <div className={styles.metricRow}><span>Scanned:</span> <strong>{batchData.pre_iqc.scanned}</strong></div>
                                            <div className={styles.metricRow}><span className={styles.labelGreen}>Passed:</span> <strong className={styles.textGreen}>{batchData.pre_iqc.passed}</strong></div>
                                            <div className={styles.metricRow}><span className={styles.labelGreen}>rework Pass:</span> <strong className={styles.textGreen}>{batchData.pre_iqc.rework_passed}</strong></div>
                                            <div className={styles.metricRow}><span className={styles.labelRed}>Failed:</span> <strong className={styles.textRed}>{batchData.pre_iqc.failed}</strong></div>
                                            <div className={styles.metricRow}><span className={styles.labelRed}>Scrap:</span> <strong className={styles.textRed}>{batchData.pre_iqc.scrap}</strong></div>
                                        </div>
                                        <div className={styles.movementHighlight}>
                                            Moving Forward: <strong>{batchData.pre_iqc.moving_to_next}</strong>
                                        </div>
                                    </div>

                                    {/* Pre-Impedance Card */}
                                    <div className={styles.stageCard}>
                                        <div className={styles.stageCardHeader}>3. Pre-Impedance</div>
                                        <div className={styles.stageMetrics}>
                                            <div className={styles.metricRow}><span>Scanned:</span> <strong>{batchData.pre_impedance.scanned}</strong></div>
                                            <div className={styles.metricRow}><span className={styles.labelGreen}>Passed:</span> <strong className={styles.textGreen}>{batchData.pre_impedance.passed}</strong></div>
                                            <div className={styles.metricRow}><span className={styles.labelGreen}>rework Pass:</span> <strong className={styles.textGreen}>{batchData.pre_impedance.rework_passed}</strong></div>
                                            <div className={styles.metricRow}><span className={styles.labelRed}>Failed:</span> <strong className={styles.textRed}>{batchData.pre_impedance.failed}</strong></div>
                                        </div>
                                        <div className={styles.movementHighlight}>
                                            Moving Forward: <strong>{batchData.pre_impedance.moving_to_next}</strong>
                                        </div>
                                    </div>

                                    {/* Pre-Calibration Card */}
                                    <div className={styles.stageCard}>
                                        <div className={styles.stageCardHeader}>4. Pre-Calibration</div>
                                        <div className={styles.stageMetrics}>
                                            <div className={styles.metricRow}><span>Scanned:</span> <strong>{batchData.pre_calibration.scanned}</strong></div>
                                            <div className={styles.metricRow}><span className={styles.labelGreen}>Passed:</span> <strong className={styles.textGreen}>{batchData.pre_calibration.passed}</strong></div>
                                            <div className={styles.metricRow}><span className={styles.labelGreen}>rework Pass:</span> <strong className={styles.textGreen}>{batchData.pre_calibration.rework_passed}</strong></div>
                                            <div className={styles.metricRow}><span className={styles.labelRed}>Failed:</span> <strong className={styles.textRed}>{batchData.pre_calibration.failed}</strong></div>
                                        </div>
                                        <div className={styles.movementHighlight}>
                                            Moving Forward: <strong>{batchData.pre_calibration.moving_to_next}</strong>
                                        </div>
                                    </div>

                                    {/* Pre-ACLR Card */}
                                    <div className={styles.stageCard}>
                                        <div className={styles.stageCardHeader}>5. Pre-ACLR</div>
                                        <div className={styles.stageMetrics}>
                                            <div className={styles.metricRow}><span>Scanned:</span> <strong>{batchData.pre_aclr.scanned}</strong></div>
                                            <div className={styles.metricRow}><span className={styles.labelGreen}>Passed:</span> <strong className={styles.textGreen}>{batchData.pre_aclr.passed}</strong></div>
                                            <div className={styles.metricRow}><span className={styles.labelGreen}>rework Pass:</span> <strong className={styles.textGreen}>{batchData.pre_aclr.rework_passed}</strong></div>
                                            <div className={styles.metricRow}><span className={styles.labelRed}>Failed:</span> <strong className={styles.textRed}>{batchData.pre_aclr.failed}</strong></div>
                                        </div>
                                        <div className={styles.finalOutputCard}>
                                            Final Good Output: <strong>{batchData.pre_aclr.final_output}</strong>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className={styles.batchEmptyState}>
                                <span>No batch summary loaded</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel: Unit History */}
                <div className={styles.rightPanel}>
                    <div className={styles.panelHeader}>
                        <h3>Unit Trace</h3>
                    </div>

                    <div className={styles.card}>
                        <form onSubmit={(e) => handleTrace(e, 'unit')} className={styles.scanningSection}>
                            <div className={styles.inputGroup}>
                                <label>Unit Barcode Scan *</label>
                                <div className={styles.barcodeRow}>
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        className={styles.barcodeInput}
                                        placeholder="Scan unit barcode..."
                                        value={barcode}
                                        onChange={(e) => setBarcode(e.target.value)}
                                        disabled={loading}
                                    />
                                    <button
                                        type="submit"
                                        className={styles.traceBtn}
                                        disabled={loading || !barcode.trim()}
                                    >
                                        Trace Unit
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>

                    <div className={styles.unitResultsArea}>
                        {!loading && traceData && (
                            <div className={styles.unitFlowWrapper}>
                                <StageFlow timeline={traceData.timeline} />

                                <div className={styles.timelineSection}>
                                    <div className={styles.timelineContainer}>
                                        <div className={styles.timelineLine}></div>
                                        {traceData.timeline.map((item, idx) => (
                                            <div key={idx} className={styles.timelineItem}>
                                                <div className={styles.timelineDot}>
                                                    {item.status.toLowerCase() === 'passed' ? '✓' : '!'}
                                                </div>
                                                <div className={styles.timelineContent}>
                                                    <div className={styles.timelineMain}>
                                                        <h4>
                                                            {getStageIcon(item.stage)} {item.stage}
                                                        </h4>
                                                        <div className={styles.timelineTimestamp}>
                                                            {new Date(item.timestamp).toLocaleString()}
                                                        </div>
                                                        {item.remarks && item.remarks !== '-' && (
                                                            <div className={styles.reworks}>{item.remarks}</div>
                                                        )}
                                                    </div>
                                                    <div className={styles.timelineRight}>
                                                        <span className={`${styles.statusBadge} ${getStatusClass(item.status)}`}>
                                                            {item.status}
                                                        </span>
                                                        <div className={styles.detailRow}>Op: <strong>{item.operator}</strong></div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {!loading && !traceData && hasAttempted && (
                            <div className={styles.emptyState}>
                                <h3>No History Found</h3>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
