import React from 'react';
import styles from './SmtDowntimeTracker.module.css';
import { useSmtDowntime } from './useSmtDowntime';
import { SmtDowntimeForm } from './SmtDowntimeForm';
import { SmtDowntimeTable } from './SmtDowntimeTable';
import { SmtDowntimeDashboard } from './SmtDowntimeDashboard';
import { SmtOeeAnalytics } from './SmtOeeAnalytics';
import { SmtDowntimeModal } from './SmtDowntimeModal';
import { SmtDeleteConfirmModal } from './SmtDeleteConfirmModal';

export const SmtDowntimeTracker: React.FC = () => {
    const {
        formState,
        handleClear,
        handleSave,
        handleEdit,

        records,
        search, setSearch,
        sortBy, sortOrder, handleSort,
        page, setPage,
        totalPages, totalRecords,
        loading,

        metrics,

        viewRecord, setViewRecord,
        deleteTargetId, setDeleteTargetId,
        deleting, confirmDelete,

        oeeState,
        eligibleWos
    } = useSmtDowntime();

    return (
        <div className={styles.container}>
            {/* 1. Header & Status Bar */}
            <div className={styles.headerRow}>
                <div className={styles.headerContent}>
                    <h2>⏱️ SMT Line Downtime Tracker & Analytics</h2>
                    <p>Executive manufacturing dashboard for real-time downtime logging, OEE performance analysis, and incident resolution.</p>
                </div>
                <div className={styles.headerStatsBadge}>
                    <span>🏭 SFCS Unit 2 Production Line</span>
                </div>
            </div>

            {/* 2. Executive Summary KPI Dashboard Cards */}
            <SmtDowntimeDashboard metrics={metrics} />

            {/* 3. OEE Analytics Engine, Radial Gauges & Charts */}
            <SmtOeeAnalytics
                categoryCharts={metrics.charts.category}
                machineCharts={metrics.charts.machine}
                shiftCharts={metrics.charts.shift}
                statusCharts={metrics.charts.status}
                reasonCharts={metrics.charts.reasons}
                dailyTrendCharts={metrics.charts.dailyTrend}
                oeeState={oeeState}
            />

            {/* 4. Incident Log & Edit Form */}
            <SmtDowntimeForm
                formState={formState}
                eligibleWos={eligibleWos}
                onSave={handleSave}
                onClear={handleClear}
            />

            {/* 5. Sticky Header Downtime Data Table with Search & Pagination */}
            <SmtDowntimeTable
                records={records}
                search={search}
                onSearchChange={setSearch}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={handleSort}
                page={page}
                totalPages={totalPages}
                totalRecords={totalRecords}
                onPageChange={setPage}
                loading={loading}
                onView={setViewRecord}
                onEdit={handleEdit}
                onDelete={(id?: string) => setDeleteTargetId(id || null)}
            />

            {/* Detail Modal */}
            <SmtDowntimeModal
                record={viewRecord}
                onClose={() => setViewRecord(null)}
            />

            {/* Super Admin Delete Guard Modal */}
            <SmtDeleteConfirmModal
                targetId={deleteTargetId}
                deleting={deleting}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteTargetId(null)}
            />
        </div>
    );
};

export default SmtDowntimeTracker;
