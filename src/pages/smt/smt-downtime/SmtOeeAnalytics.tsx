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

            {/* OEE Parameters Filter Card */}
            <div className={styles.card}>
                <div className={styles.cardSubHeader}>
                    <h4>⚙️ Production & Shift Parameters</h4>
                    <span className={styles.subtext}>Enter shift targets to calculate real-time Availability, Performance, Quality & OEE</span>
                </div>

                <div className={styles.oeeInputGrid}>
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
                    <div className={styles.inputGroup}>
                        <label className={styles.inputLabel}>Scheduled Time (Mins)</label>
                        <input
                            type="number"
                            value={totalTimeAvailable}
                            onChange={(e) => setTotalTimeAvailable(e.target.value ? Number(e.target.value) : '')}
                            className={styles.input}
                            placeholder="e.g. 480"
                        />
                    </div>
                    <div className={styles.inputGroup}>
                        <label className={styles.inputLabel}>Total Production (Units)</label>
                        <input
                            type="number"
                            value={totalProduction}
                            onChange={(e) => setTotalProduction(e.target.value ? Number(e.target.value) : '')}
                            className={styles.input}
                            placeholder="e.g. 1000"
                        />
                    </div>
                    <div className={styles.inputGroup}>
                        <label className={styles.inputLabel}>Target Speed (Units/Min)</label>
                        <input
                            type="number"
                            value={idealCycleTime}
                            onChange={(e) => setIdealCycleTime(e.target.value ? Number(e.target.value) : '')}
                            className={styles.input}
                            placeholder="e.g. 2.5"
                        />
                    </div>
                    <div className={styles.inputGroup}>
                        <label className={styles.inputLabel}>Scrap Produced (Units)</label>
                        <input
                            type="number"
                            value={scrapProduced}
                            onChange={(e) => setScrapProduced(e.target.value ? Number(e.target.value) : '')}
                            className={styles.input}
                            placeholder="e.g. 15"
                        />
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
