import React from 'react';
import type { ChartDataPoint, TrendDataPoint } from './smtDowntime.types';
import { SmtOeeGauges } from './SmtOeeGauges';
import { SmtAnalyticsCharts } from './SmtAnalyticsCharts';
import styles from './SmtDowntimeTracker.module.css';

interface SmtOeeAnalyticsProps {
    categoryCharts: ChartDataPoint[];
    machineCharts: ChartDataPoint[];
    shiftCharts: ChartDataPoint[];
    statusCharts: ChartDataPoint[];
    reasonCharts?: ChartDataPoint[];
    dailyTrendCharts?: TrendDataPoint[];
    oeeState: {
        fromDate: string;
        setFromDate: (v: string) => void;
        toDate: string;
        setToDate: (v: string) => void;
        totalTimeAvailable: number | '';
        setTotalTimeAvailable: (v: number | '') => void;
        totalProduction: number | '';
        setTotalProduction: (v: number | '') => void;
        idealCycleTime: number | '';
        setIdealCycleTime: (v: number | '') => void;
        scrapProduced: number | '';
        setScrapProduced: (v: number | '') => void;
        plannedDowntime: number;
        unplannedDowntime: number;
        plannedProductionTime: number;
        operatingTime: number;
        availabilityRate: number;
        performanceRate: number;
        qualityRate: number;
        oee: number;
    };
}

export const SmtOeeAnalytics: React.FC<SmtOeeAnalyticsProps> = ({
    categoryCharts,
    machineCharts,
    shiftCharts,
    statusCharts,
    reasonCharts = [],
    dailyTrendCharts = [],
    oeeState
}) => {
    const {
        fromDate, setFromDate,
        toDate, setToDate,
        totalTimeAvailable, setTotalTimeAvailable,
        totalProduction, setTotalProduction,
        idealCycleTime, setIdealCycleTime,
        scrapProduced, setScrapProduced,
        plannedProductionTime,
        operatingTime,
        availabilityRate,
        performanceRate,
        qualityRate,
        oee
    } = oeeState;

    return (
        <div className={styles.oeeContainer}>
            <div className={styles.sectionHeaderRow}>
                <h3 className={styles.sectionHeading}>📈 OEE Analytics Engine & Performance Metrics</h3>
                <span className={styles.lastUpdatedText}>ISO 22400 / TPM Verified Model</span>
            </div>

            {/* Date Filters Card */}
            <div className={styles.card} style={{ marginBottom: '1.5rem' }}>
                <div className={styles.cardSubHeader}>
                    <h4>📅 Date Range Selection</h4>
                    <span className={styles.subtext}>Filter OEE Analytics and Downtime metrics by production period</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
                    <div className={styles.inputGroup}>
                        <label className={styles.inputLabel}>From Date</label>
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            className={styles.input}
                        />
                    </div>
                    <div className={styles.inputGroup}>
                        <label className={styles.inputLabel}>To Date</label>
                        <input
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            className={styles.input}
                        />
                    </div>
                </div>
            </div>

            {/* Section-wise Calculation Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                {/* Section 1 - Availability */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem', backgroundColor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                        <h4 style={{ margin: '0 0 1rem 0', color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem', fontWeight: '700', fontSize: '1rem' }}>Section 1 – Availability</h4>
                        <div className={styles.inputGroup}>
                            <label className={styles.inputLabel}>Scheduled Time (Minutes)</label>
                            <input
                                type="number"
                                value={totalTimeAvailable}
                                onChange={(e) => setTotalTimeAvailable(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                                className={styles.input}
                                placeholder="e.g. 480"
                            />
                        </div>
                    </div>
                    <div style={{ marginTop: '1.5rem', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#475569' }}>Availability Rate:</span>
                        <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#2563eb' }}>{availabilityRate.toFixed(2)}%</span>
                    </div>
                </div>

                {/* Section 2 - Performance */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem', backgroundColor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                        <h4 style={{ margin: '0 0 1rem 0', color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem', fontWeight: '700', fontSize: '1rem' }}>Section 2 – Performance</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div className={styles.inputGroup}>
                                <label className={styles.inputLabel}>Total Production (Units)</label>
                                <input
                                    type="number"
                                    value={totalProduction}
                                    onChange={(e) => setTotalProduction(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                                    className={styles.input}
                                    placeholder="e.g. 1000"
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label className={styles.inputLabel}>Target Speed (Units/Min)</label>
                                <input
                                    type="number"
                                    value={idealCycleTime}
                                    onChange={(e) => setIdealCycleTime(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                                    className={styles.input}
                                    placeholder="e.g. 2.5"
                                />
                            </div>
                        </div>
                    </div>
                    <div style={{ marginTop: '1.5rem', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#475569' }}>Performance Rate:</span>
                        <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#d97706' }}>{performanceRate.toFixed(2)}%</span>
                    </div>
                </div>

                {/* Section 3 - Quality */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem', backgroundColor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                        <h4 style={{ margin: '0 0 1rem 0', color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem', fontWeight: '700', fontSize: '1rem' }}>Section 3 – Quality</h4>
                        <div className={styles.inputGroup}>
                            <label className={styles.inputLabel}>Scrap Produced (Units)</label>
                            <input
                                type="number"
                                value={scrapProduced}
                                onChange={(e) => setScrapProduced(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                                className={styles.input}
                                placeholder="e.g. 15"
                            />
                        </div>
                    </div>
                    <div style={{ marginTop: '1.5rem', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#475569' }}>Quality Rate:</span>
                        <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#0891b2' }}>{qualityRate.toFixed(2)}%</span>
                    </div>
                </div>
            </div>

            {/* Dedicated Circular OEE Progress Gauges */}
            <SmtOeeGauges
                availabilityRate={availabilityRate}
                performanceRate={performanceRate}
                qualityRate={qualityRate}
                oee={oee}
                plannedProductionTime={plannedProductionTime}
                operatingTime={operatingTime}
            />

            {/* Enterprise Analytics & Charts Visualizations */}
            <SmtAnalyticsCharts
                categoryCharts={categoryCharts}
                machineCharts={machineCharts}
                shiftCharts={shiftCharts}
                statusCharts={statusCharts}
                reasonCharts={reasonCharts}
                dailyTrendCharts={dailyTrendCharts}
            />
        </div>
    );
};
