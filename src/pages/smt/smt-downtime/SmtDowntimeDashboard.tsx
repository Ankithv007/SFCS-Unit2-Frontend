import React from 'react';
import type { DashboardMetrics } from './smtDowntime.types';
import styles from './SmtDowntimeTracker.module.css';

interface SmtDowntimeDashboardProps {
    metrics: DashboardMetrics;
}

export const SmtDowntimeDashboard: React.FC<SmtDowntimeDashboardProps> = ({ metrics }) => {
    const { summary } = metrics;

    return (
        <div className={styles.dashboardSection}>
            <div className={styles.sectionHeaderRow}>
                <h3 className={styles.sectionHeading}>⏱️ Executive Production KPI Summary</h3>
                <span className={styles.lastUpdatedText}>Live SFCS Synchronization</span>
            </div>

            <div className={styles.kpiGrid}>
                <div className={`${styles.kpiCard} ${styles.borderBlue}`}>
                    <div className={styles.kpiHeader}>
                        <span className={styles.kpiIcon}>📋</span>
                        <span className={styles.kpiTitle}>Total Logged Incidents</span>
                    </div>
                    <div className={styles.kpiBody}>
                        <span className={styles.kpiValue}>{summary.total_records}</span>
                        <span className={styles.kpiSubtext}>Downtime events recorded</span>
                    </div>
                </div>

                <div className={`${styles.kpiCard} ${styles.borderRed}`}>
                    <div className={styles.kpiHeader}>
                        <span className={styles.kpiIcon}>⏳</span>
                        <span className={styles.kpiTitle}>Total Line Downtime</span>
                    </div>
                    <div className={styles.kpiBody}>
                        <span className={styles.kpiValue} style={{ color: '#dc2626' }}>
                            {Number(summary.total_duration).toFixed(1)} <span className={styles.kpiUnit}>mins</span>
                        </span>
                        <span className={styles.kpiSubtext}>Cumulative production loss</span>
                    </div>
                </div>

                <div className={`${styles.kpiCard} ${styles.borderRed}`}>
                    <div className={styles.kpiHeader}>
                        <span className={styles.kpiIcon}>🚨</span>
                        <span className={styles.kpiTitle}>Open Incidents</span>
                    </div>
                    <div className={styles.kpiBody}>
                        <span className={styles.kpiValue} style={{ color: '#dc2626' }}>{summary.open_issues}</span>
                        <span className={styles.kpiSubtext}>Pending resolution</span>
                    </div>
                </div>

                <div className={`${styles.kpiCard} ${styles.borderGreen}`}>
                    <div className={styles.kpiHeader}>
                        <span className={styles.kpiIcon}>✅</span>
                        <span className={styles.kpiTitle}>Closed Incidents</span>
                    </div>
                    <div className={styles.kpiBody}>
                        <span className={styles.kpiValue} style={{ color: '#16a34a' }}>{summary.closed_issues}</span>
                        <span className={styles.kpiSubtext}>Resolved & verified</span>
                    </div>
                </div>

                <div className={`${styles.kpiCard} ${styles.borderPurple}`}>
                    <div className={styles.kpiHeader}>
                        <span className={styles.kpiIcon}>🛠️</span>
                        <span className={styles.kpiTitle}>Most Affected Machine</span>
                    </div>
                    <div className={styles.kpiBody}>
                        <span className={styles.kpiTextValue}>{summary.most_affected_machine}</span>
                        <span className={styles.kpiSubtext}>Highest downtime impact</span>
                    </div>
                </div>

                <div className={`${styles.kpiCard} ${styles.borderTeal}`}>
                    <div className={styles.kpiHeader}>
                        <span className={styles.kpiIcon}>🏷️</span>
                        <span className={styles.kpiTitle}>Top Category</span>
                    </div>
                    <div className={styles.kpiBody}>
                        <span className={styles.kpiTextValue}>{summary.most_frequent_category}</span>
                        <span className={styles.kpiSubtext}>Primary loss driver</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
