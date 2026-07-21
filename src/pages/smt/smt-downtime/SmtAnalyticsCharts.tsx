import React, { useState } from 'react';
import type { ChartDataPoint, TrendDataPoint } from './smtDowntime.types';
import styles from './SmtDowntimeTracker.module.css';
import { CHART_PALETTE } from './smtDowntime.constants';

interface SmtAnalyticsChartsProps {
    categoryCharts: ChartDataPoint[];
    machineCharts: ChartDataPoint[];
    shiftCharts: ChartDataPoint[];
    statusCharts: ChartDataPoint[];
    reasonCharts?: ChartDataPoint[];
    dailyTrendCharts?: TrendDataPoint[];
}

export const SmtAnalyticsCharts: React.FC<SmtAnalyticsChartsProps> = ({
    categoryCharts,
    machineCharts,
    shiftCharts,
    statusCharts,
    reasonCharts = [],
    dailyTrendCharts = []
}) => {
    const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);
    const [tooltipData, setTooltipData] = useState<{ x: number; y: number; text: string } | null>(null);

    const renderDoughnutChart = (
        title: string,
        data: ChartDataPoint[],
        palette: string[],
        chartId: string,
        unit: string = 'Mins'
    ) => {
        const total = data.reduce((sum, item) => sum + Number(item.value), 0);

        if (total === 0 || data.length === 0) {
            return (
                <div className={styles.chartCard}>
                    <div className={styles.chartHeader}>
                        <h4>{title}</h4>
                    </div>
                    <div className={styles.chartEmptyState}>
                        No downtime data recorded
                    </div>
                </div>
            );
        }

        let cumulativeAngle = 0;
        const radius = 60;
        const holeRadius = 38;
        const cx = 85;
        const cy = 85;

        const slices = data.map((item, index) => {
            const value = Number(item.value);
            const percentage = ((value / total) * 100).toFixed(1);
            const angle = (value / total) * 360;
            const startAngle = cumulativeAngle;
            const endAngle = cumulativeAngle + angle;
            cumulativeAngle += angle;

            const startRad = (startAngle - 90) * (Math.PI / 180);
            const endRad = (endAngle - 90) * (Math.PI / 180);

            const x1Outer = cx + radius * Math.cos(startRad);
            const y1Outer = cy + radius * Math.sin(startRad);
            const x2Outer = cx + radius * Math.cos(endRad);
            const y2Outer = cy + radius * Math.sin(endRad);

            const x1Inner = cx + holeRadius * Math.cos(endRad);
            const y1Inner = cy + holeRadius * Math.sin(endRad);
            const x2Inner = cx + holeRadius * Math.cos(startRad);
            const y2Inner = cy + holeRadius * Math.sin(startRad);

            const largeArcFlag = angle > 180 ? 1 : 0;

            const pathD = [
                `M ${x1Outer} ${y1Outer}`,
                `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2Outer} ${y2Outer}`,
                `L ${x1Inner} ${y1Inner}`,
                `A ${holeRadius} ${holeRadius} 0 ${largeArcFlag} 0 ${x2Inner} ${y2Inner}`,
                'Z'
            ].join(' ');

            const sliceKey = `${chartId}-${index}`;
            const isHovered = hoveredSlice === sliceKey;
            const color = palette[index % palette.length];

            return (
                <path
                    key={index}
                    d={pathD}
                    fill={color}
                    opacity={isHovered ? 1 : 0.9}
                    style={{
                        transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                        transformOrigin: `${cx}px ${cy}px`,
                        transition: 'transform 0.2s ease, opacity 0.2s ease',
                        cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                        setHoveredSlice(sliceKey);
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltipData({
                            x: rect.left + rect.width / 2,
                            y: rect.top - 10,
                            text: `${item.name}: ${value} ${unit} (${percentage}%)`
                        });
                    }}
                    onMouseLeave={() => {
                        setHoveredSlice(null);
                        setTooltipData(null);
                    }}
                />
            );
        });

        return (
            <div className={styles.chartCard}>
                <div className={styles.chartHeader}>
                    <h4>{title}</h4>
                    <span className={styles.chartBadge}>{total.toFixed(0)} {unit}</span>
                </div>
                <div className={styles.chartContentFlex}>
                    <div className={styles.svgContainer}>
                        <svg width="170" height="170" viewBox="0 0 170 170">
                            {slices}
                            <text x={cx} y={cy - 4} textAnchor="middle" fill="#0f172a" fontSize="15" fontWeight="800">
                                {total.toFixed(0)}
                            </text>
                            <text x={cx} y={cy + 13} textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="600">
                                Total {unit}
                            </text>
                        </svg>
                    </div>
                    <div className={styles.legendContainer}>
                        {data.map((item, idx) => {
                            const val = Number(item.value);
                            const pct = ((val / total) * 100).toFixed(1);
                            const color = palette[idx % palette.length];
                            return (
                                <div key={idx} className={styles.legendItem}>
                                    <span className={styles.legendDot} style={{ backgroundColor: color }} />
                                    <span className={styles.legendName} title={item.name}>{item.name}</span>
                                    <span className={styles.legendVal}>{val} {unit}</span>
                                    <span className={styles.legendPct}>({pct}%)</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    const renderBarChart = (title: string, data: ChartDataPoint[], unit: string = 'Mins') => {
        const maxVal = Math.max(1, ...data.map(d => Number(d.value)));

        return (
            <div className={styles.chartCard}>
                <div className={styles.chartHeader}>
                    <h4>{title}</h4>
                </div>
                <div className={styles.barList}>
                    {data.slice(0, 5).map((item, idx) => {
                        const val = Number(item.value);
                        const pct = ((val / maxVal) * 100).toFixed(0);
                        return (
                            <div key={idx} className={styles.barRow}>
                                <div className={styles.barLabelRow}>
                                    <span className={styles.barName}>{item.name}</span>
                                    <span className={styles.barValue}>{val} {unit}</span>
                                </div>
                                <div className={styles.barTrack}>
                                    <div
                                        className={styles.barFill}
                                        style={{
                                            width: `${pct}%`,
                                            backgroundColor: CHART_PALETTE.machine[idx % CHART_PALETTE.machine.length]
                                        }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderTrendChart = (title: string, trends: TrendDataPoint[]) => {
        if (trends.length === 0) return null;
        const maxVal = Math.max(1, ...trends.map(t => t.total));

        return (
            <div className={`${styles.chartCard} ${styles.fullWidthChart}`}>
                <div className={styles.chartHeader}>
                    <h4>{title}</h4>
                    <div className={styles.trendLegendHeader}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#3b82f6' }} /> Planned
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#ef4444' }} /> Unplanned
                        </span>
                    </div>
                </div>
                <div className={styles.trendGrid}>
                    {trends.map((t, idx) => {
                        const plannedPct = ((t.planned / maxVal) * 100).toFixed(0);
                        const unplannedPct = ((t.unplanned / maxVal) * 100).toFixed(0);

                        return (
                            <div key={idx} className={styles.trendColumn}>
                                <div className={styles.trendBarsStack}>
                                    <div
                                        className={styles.trendBarSegment}
                                        style={{ height: `${unplannedPct}%`, backgroundColor: '#ef4444' }}
                                        title={`Unplanned: ${t.unplanned} mins`}
                                    />
                                    <div
                                        className={styles.trendBarSegment}
                                        style={{ height: `${plannedPct}%`, backgroundColor: '#3b82f6' }}
                                        title={`Planned: ${t.planned} mins`}
                                    />
                                </div>
                                <span className={styles.trendDateLabel}>{t.date.split('-').slice(1).join('/')}</span>
                                <span className={styles.trendTotalLabel}>{t.total}m</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className={styles.analyticsSection}>
            <h3 className={styles.sectionHeading}>📊 Enterprise Analytics & Incident Breakdown</h3>

            <div className={styles.chartsGrid}>
                {renderDoughnutChart('Downtime by Category', categoryCharts, CHART_PALETTE.category, 'cat', 'Mins')}
                {renderDoughnutChart('Downtime by Machine', machineCharts, CHART_PALETTE.machine, 'mach', 'Mins')}
                {renderDoughnutChart('Shift Downtime Analysis', shiftCharts, CHART_PALETTE.shift, 'shft', 'Mins')}
                {renderDoughnutChart('Incident Status Distribution', statusCharts, CHART_PALETTE.status, 'stat', 'Logs')}
            </div>

            <div className={styles.chartsGridSub}>
                {reasonCharts.length > 0 && renderBarChart('Top Downtime Reasons Breakdown', reasonCharts, 'Mins')}
                {dailyTrendCharts.length > 0 && renderTrendChart('Daily Downtime Duration Trend (Mins)', dailyTrendCharts)}
            </div>

            {tooltipData && (
                <div
                    style={{
                        position: 'fixed',
                        left: `${tooltipData.x}px`,
                        top: `${tooltipData.y}px`,
                        transform: 'translate(-50%, -100%)',
                        backgroundColor: '#0f172a',
                        color: '#ffffff',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        pointerEvents: 'none',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                        zIndex: 9999
                    }}
                >
                    {tooltipData.text}
                </div>
            )}
        </div>
    );
};
