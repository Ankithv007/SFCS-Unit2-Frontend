import React from 'react';
import { getOeeBenchmark } from './smtDowntime.constants';
import styles from './SmtDowntimeTracker.module.css';

interface SmtOeeGaugesProps {
    availabilityRate: number;
    performanceRate: number;
    qualityRate: number;
    oee: number;
    plannedProductionTime: number;
    operatingTime: number;
}

export const SmtOeeGauges: React.FC<SmtOeeGaugesProps> = ({
    availabilityRate,
    performanceRate,
    qualityRate,
    oee,
    plannedProductionTime,
    operatingTime
}) => {
    const renderGaugeCard = (
        title: string,
        value: number,
        subtitle: string,
        helpText: string,
        primaryColor: string
    ) => {
        const benchmark = getOeeBenchmark(value);
        const radius = 52;
        const circumference = 2 * Math.PI * radius;
        const clampedValue = Math.min(100, Math.max(0, value));
        const strokeDashoffset = circumference - (clampedValue / 100) * circumference;

        return (
            <div className={styles.gaugeCard}>
                <div className={styles.gaugeCardHeader}>
                    <span className={styles.gaugeTitle}>{title}</span>
                    <span
                        className={styles.benchmarkBadge}
                        style={{
                            color: benchmark.color,
                            backgroundColor: benchmark.bg,
                            borderColor: benchmark.border
                        }}
                        title={benchmark.description}
                    >
                        {benchmark.badge}
                    </span>
                </div>

                <div className={styles.gaugeBody}>
                    <svg className={styles.gaugeSvg} width="140" height="140" viewBox="0 0 140 140">
                        {/* Background Ring */}
                        <circle
                            cx="70"
                            cy="70"
                            r={radius}
                            fill="none"
                            stroke="#e2e8f0"
                            strokeWidth="10"
                        />
                        {/* Progress Ring */}
                        <circle
                            cx="70"
                            cy="70"
                            r={radius}
                            fill="none"
                            stroke={primaryColor}
                            strokeWidth="10"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            transform="rotate(-90 70 70)"
                            style={{
                                transition: 'stroke-dashoffset 0.8s ease-in-out'
                            }}
                        />
                        {/* Center Value */}
                        <text
                            x="70"
                            y="65"
                            textAnchor="middle"
                            fill="#0f172a"
                            fontSize="20"
                            fontWeight="800"
                        >
                            {value.toFixed(2)}%
                        </text>
                        <text
                            x="70"
                            y="84"
                            textAnchor="middle"
                            fill="#64748b"
                            fontSize="11"
                            fontWeight="600"
                        >
                            {subtitle}
                        </text>
                    </svg>
                </div>

                <div className={styles.gaugeFooter}>
                    <span className={styles.gaugeHelpText}>{helpText}</span>
                </div>
            </div>
        );
    };

    return (
        <div className={styles.oeeGaugesGrid}>
            {renderGaugeCard(
                'Availability Rate',
                availabilityRate,
                'Uptime',
                `Operating: ${operatingTime.toFixed(0)}m / ${plannedProductionTime.toFixed(0)}m`,
                '#2563eb'
            )}
            {renderGaugeCard(
                'Performance Rate',
                performanceRate,
                'Speed',
                'Actual Output / Target Speed',
                '#d97706'
            )}
            {renderGaugeCard(
                'Quality Rate',
                qualityRate,
                'Yield',
                'Good Units / Total Units',
                '#0891b2'
            )}
            {renderGaugeCard(
                'Overall OEE Score',
                oee,
                'OEE Metric',
                'Availability × Performance × Quality',
                '#10b981'
            )}
        </div>
    );
};
