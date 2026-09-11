import { useState, useEffect, useCallback } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import styles from './Dashboard.module.css';
import { WorkOrderCombobox } from '../../components/WorkOrderCombobox';
import { apiFetch } from '../../utils/api';
import jsPDF from 'jspdf';

interface LiveWorkOrder {
  id: string;
  product_name?: string;
  quantity: number;
  created_at: string;
  status: string;
  model_name?: string;
}

export interface SmtStageMetrics {
  pass: number;
  fail: number;
  pending: number;
  yield: number;
  passed?: number;
  failed?: number;
  percentage?: number;
}

export interface SmtSideMetrics {
  printing: SmtStageMetrics;
  spi?: SmtStageMetrics;
  preAOI: SmtStageMetrics;
  postAOI: SmtStageMetrics;
}

interface DashboardMetrics {
  workOrderId: string;
  totalQuantity: number;
  startDate: string;
  overallStatus: string;
  productName?: string;
  modelName?: string;
  selectedDate?: string;
  availableDates?: string[];
  isDoubleSided?: boolean;
  sides?: string;
  top?: SmtSideMetrics;
  bottom?: SmtSideMetrics;
  actualStatus: {
    labelled: number;
    passed?: number;
    failed?: number;
    pending: number;
    percentage: number;
  };
  spi?: SmtStageMetrics;
  yieldSPI: number;
  preAOI: {
    passed: number;
    failed: number;
    pending: number;
    percentage: number;
  };
  postAOI: {
    passed: number;
    failed: number;
    pending: number;
    percentage: number;
  };
  smtFG?: SmtStageMetrics;
}

export function Dashboard() {
  return <SFCSDashboard />;
}

export default function SFCSDashboard() {
  const [activeTab, setActiveTab] = useState<'live' | 'search'>('live');

  // Live Work Orders List
  const [liveWorkOrders, setLiveWorkOrders] = useState<LiveWorkOrder[]>([]);
  const [currentLiveIndex, setCurrentLiveIndex] = useState<number>(0);

  // Selected Work Order ID for Search mode
  const [searchSelectedWoId, setSearchSelectedWoId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('all');

  // Detailed Dashboard Metrics state
  const [dashboardData, setDashboardData] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  const handleExportExcel = async () => {
    if (!activeWoId) return;
    try {
      setIsExportingExcel(true);
      const url = `/api/smt/admin/work-orders/${encodeURIComponent(activeWoId)}/export/excel?date=${encodeURIComponent(selectedDate)}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        throw new Error('Failed to export Excel report');
      }
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `SFCS_WO_${activeWoId}_${selectedDate || 'all'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      console.error('Error exporting Excel:', err);
      alert('Failed to export Excel report. Please try again.');
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExportPdf = async () => {
    if (!activeWoId) return;
    try {
      setIsExportingPdf(true);
      const res: any = await apiFetch(`/api/smt/admin/work-orders/${encodeURIComponent(activeWoId)}/export/pdf-data?date=${encodeURIComponent(selectedDate)}`);

      if (!res || !res.success) {
        throw new Error('Failed to fetch PDF report data');
      }

      generatePdfReport(res);
    } catch (err: any) {
      console.error('Error exporting PDF:', err);
      alert('Failed to export PDF report. Please try again.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const generatePdfReport = (data: any) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const PRIMARY_NAVY = [30, 58, 95];
    const SECONDARY_BLUE = [37, 99, 235];
    const BG_LIGHT = [248, 250, 252];
    const TEXT_DARK = [30, 41, 59];

    // Header Band
    doc.setFillColor(PRIMARY_NAVY[0], PRIMARY_NAVY[1], PRIMARY_NAVY[2]);
    doc.rect(0, 0, 210, 30, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(`SFCS WORK ORDER PRODUCTION REPORT`, 14, 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(203, 213, 225);
    doc.text(`Work Order: ${data.summary.workOrderId}  |  Date: ${data.summary.selectedDate}  |  Generated: ${data.summary.generatedAt}`, 14, 22);

    let currentY = 38;

    // Overview Section Header
    doc.setFillColor(BG_LIGHT[0], BG_LIGHT[1], BG_LIGHT[2]);
    doc.rect(14, currentY, 182, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(SECONDARY_BLUE[0], SECONDARY_BLUE[1], SECONDARY_BLUE[2]);
    doc.text('WORK ORDER OVERVIEW', 18, currentY + 5.5);
    currentY += 12;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);

    doc.text(`Work Order ID: ${data.summary.workOrderId}`, 18, currentY);
    doc.text(`Target Quantity: ${data.summary.totalQuantity}`, 110, currentY);
    currentY += 6;
    doc.text(`Product Name: ${data.summary.productName}`, 18, currentY);
    doc.text(`Overall Status: ${data.summary.overallStatus}`, 110, currentY);
    currentY += 6;
    doc.text(`Model Name: ${data.summary.modelName}`, 18, currentY);
    doc.text(`Selected Date: ${data.summary.selectedDate}`, 110, currentY);
    currentY += 12;

    // Stage Matrix Header
    doc.setFillColor(BG_LIGHT[0], BG_LIGHT[1], BG_LIGHT[2]);
    doc.rect(14, currentY, 182, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(SECONDARY_BLUE[0], SECONDARY_BLUE[1], SECONDARY_BLUE[2]);
    doc.text('PRODUCTION MATRIX & STAGE BREAKDOWN', 18, currentY + 5.5);
    currentY += 12;

    // Table Header
    doc.setFillColor(SECONDARY_BLUE[0], SECONDARY_BLUE[1], SECONDARY_BLUE[2]);
    doc.rect(14, currentY, 182, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text('Stage Name', 18, currentY + 5);
    doc.text('Passed', 75, currentY + 5);
    doc.text('Failed', 105, currentY + 5);
    doc.text('Pending', 135, currentY + 5);
    doc.text('Completed %', 164, currentY + 5);
    currentY += 7;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
    data.matrix.forEach((row: any) => {
      doc.text(row.stage, 18, currentY + 5);
      doc.text(String(row.passed), 75, currentY + 5);
      doc.text(String(row.failed), 105, currentY + 5);
      doc.text(String(row.pending), 135, currentY + 5);
      doc.text(`${row.percentage}%`, 168, currentY + 5);
      doc.setDrawColor(226, 232, 240);
      doc.line(14, currentY + 7, 196, currentY + 7);
      currentY += 7;
    });

    currentY += 8;

    // Inspection Logs Header
    doc.setFillColor(BG_LIGHT[0], BG_LIGHT[1], BG_LIGHT[2]);
    doc.rect(14, currentY, 182, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(SECONDARY_BLUE[0], SECONDARY_BLUE[1], SECONDARY_BLUE[2]);
    doc.text('INSPECTION & SCAN LOGS', 18, currentY + 5.5);
    currentY += 12;

    // Log Table Header
    doc.setFillColor(PRIMARY_NAVY[0], PRIMARY_NAVY[1], PRIMARY_NAVY[2]);
    doc.rect(14, currentY, 182, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text('#', 16, currentY + 5);
    doc.text('Barcode / Serial', 25, currentY + 5);
    doc.text('Stage', 80, currentY + 5);
    doc.text('Status', 110, currentY + 5);
    doc.text('Operator', 135, currentY + 5);
    doc.text('Time', 165, currentY + 5);
    currentY += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);

    if (data.logs.length === 0) {
      doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
      doc.text('No inspection scans recorded for this selection.', 18, currentY + 5);
    } else {
      data.logs.slice(0, 30).forEach((log: any, idx: number) => {
        if (currentY > 270) {
          doc.addPage();
          currentY = 20;
        }
        doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
        doc.text(String(idx + 1), 16, currentY + 4);
        doc.text(String(log.barcode).slice(0, 25), 25, currentY + 4);
        doc.text(String(log.process_step), 80, currentY + 4);

        if (log.status === 'PASS') {
          doc.setTextColor(22, 101, 52);
        } else {
          doc.setTextColor(220, 38, 38);
        }
        doc.text(String(log.status), 110, currentY + 4);

        doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
        doc.text(String(log.scanned_by || 'System').slice(0, 15), 135, currentY + 4);
        doc.text(String(log.scanned_at).slice(0, 18), 165, currentY + 4);

        doc.setDrawColor(241, 245, 249);
        doc.line(14, currentY + 5.5, 196, currentY + 5.5);
        currentY += 6;
      });

      if (data.logs.length > 30) {
        currentY += 2;
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(100, 116, 139);
        doc.text(`... plus ${data.logs.length - 30} more scan logs. Download Excel for full log dump.`, 18, currentY + 3);
      }
    }

    doc.save(`SFCS_WO_${data.summary.workOrderId}_${data.summary.selectedDate}.pdf`);
  };

  const activeWoId = activeTab === 'live'
    ? liveWorkOrders[currentLiveIndex]?.id || null
    : searchSelectedWoId;

  // 1. Fetch Live Work Orders list for Live Tab
  const fetchLiveWorkOrders = useCallback(async () => {
    try {
      const data = await apiFetch('/api/smt/admin/dashboard/live-work-orders');
      if (data && data.success && Array.isArray(data.workOrders)) {
        setLiveWorkOrders(data.workOrders);
        if (currentLiveIndex >= data.workOrders.length) {
          setCurrentLiveIndex(0);
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch live work orders:', err);
    }
  }, [currentLiveIndex]);

  // 2. Fetch Single Work Order Dashboard Stats
  const fetchDashboardStats = useCallback(async (woId: string, date = 'all', showRefreshing = false) => {
    if (!woId) return;

    if (showRefreshing) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      let endpoint = `/api/smt/admin/work-orders/${encodeURIComponent(woId)}/dashboard`;
      if (date && date !== 'all') {
        endpoint += `?date=${encodeURIComponent(date)}`;
      }
      const data = await apiFetch(endpoint);
      if (data && data.success) {
        setDashboardData(data);
        const now = new Date();
        setLastUpdated(now.toLocaleTimeString());
      } else {
        setError(data?.error || 'Failed to load Work Order metrics');
      }
    } catch (err: any) {
      console.error('Dashboard stats fetch error:', err);
      setError(err.message || 'Network error fetching Work Order metrics');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial load of live work orders
  useEffect(() => {
    fetchLiveWorkOrders();
  }, [fetchLiveWorkOrders]);

  // Load dashboard stats when active Work Order changes or tab or date changes
  useEffect(() => {
    if (activeWoId) {
      const dateToFetch = activeTab === 'search' ? selectedDate : 'all';
      fetchDashboardStats(activeWoId, dateToFetch);
    } else {
      setIsLoading(false);
      setDashboardData(null);
    }
  }, [activeWoId, activeTab, selectedDate, fetchDashboardStats]);

  // 20-Second Auto-Refresh Polling with unmount cleanup (fallback)
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeTab === 'live') {
        fetchLiveWorkOrders();
      }
      if (activeWoId) {
        const dateToFetch = activeTab === 'search' ? selectedDate : 'all';
        fetchDashboardStats(activeWoId, dateToFetch, true);
      }
    }, 20000); // 20 seconds

    return () => clearInterval(interval);
  }, [activeTab, activeWoId, selectedDate, fetchLiveWorkOrders, fetchDashboardStats]);

  // Real-time SMT Dashboard updates via Server-Sent Events (SSE) + BroadcastChannel fallback
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    let eventSource: EventSource | null = null;
    let bc: BroadcastChannel | null = null;

    try {
      eventSource = new EventSource(`/api/smt/admin/dashboard/events?token=${encodeURIComponent(token)}`);

      eventSource.onmessage = (event) => {
        try {
          if (!event.data) return;
          const payload = JSON.parse(event.data);
          if (payload && (payload.event === 'SMT_DASHBOARD_UPDATE' || payload.type === 'SMT_DASHBOARD_UPDATE')) {
            const affectedWoId = payload.workOrderId || payload.data?.workOrderId;
            if (!affectedWoId || affectedWoId === activeWoId) {
              const dateToFetch = activeTab === 'search' ? selectedDate : 'all';
              if (activeWoId) {
                fetchDashboardStats(activeWoId, dateToFetch, true);
              }
            }
            if (activeTab === 'live') {
              fetchLiveWorkOrders();
            }
          }
        } catch {
          // Ignore comments or heartbeat messages
        }
      };

      eventSource.onerror = () => {
        // EventSource will automatically attempt reconnection
      };
    } catch (sseErr) {
      console.warn('SSE connection failed to initialize:', sseErr);
    }

    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('smt-production-channel');
        bc.onmessage = (event) => {
          if (event.data?.type === 'SMT_DASHBOARD_UPDATE') {
            const affectedWoId = event.data?.workOrderId;
            if (!affectedWoId || affectedWoId === activeWoId) {
              const dateToFetch = activeTab === 'search' ? selectedDate : 'all';
              if (activeWoId) {
                fetchDashboardStats(activeWoId, dateToFetch, true);
              }
            }
            if (activeTab === 'live') {
              fetchLiveWorkOrders();
            }
          }
        };
      } catch {
        // BroadcastChannel optional
      }
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (bc) {
        bc.close();
      }
    };
  }, [activeWoId, activeTab, selectedDate, fetchDashboardStats, fetchLiveWorkOrders]);

  // Manual Refresh handler
  const handleManualRefresh = () => {
    if (activeTab === 'live') {
      fetchLiveWorkOrders();
    }
    if (activeWoId) {
      const dateToFetch = activeTab === 'search' ? selectedDate : 'all';
      fetchDashboardStats(activeWoId, dateToFetch, true);
    }
  };

  // Pagination controls for Live mode
  const handlePrevLive = () => {
    if (currentLiveIndex > 0) {
      setCurrentLiveIndex(prev => prev - 1);
    }
  };

  const handleNextLive = () => {
    if (currentLiveIndex < liveWorkOrders.length - 1) {
      setCurrentLiveIndex(prev => prev + 1);
    }
  };

  // Color constants for charts
  const COLOR_PASS = '#059669'; // Rich Emerald Green
  const COLOR_FAIL = '#dc2626'; // Red
  const COLOR_PENDING = '#cbd5e1'; // Light Grey/Slate
  const COLOR_LABELLED = '#0284c7'; // Blue
  const COLOR_TOP = '#2563eb'; // Blue
  const COLOR_BOTTOM = '#7c3aed'; // Purple
  const COLOR_SPI = '#0d9488'; // Teal

  // Single-Sided Chart 1: Actual Status (Labelled vs Pending)
  const actualChartData = dashboardData ? [
    { name: 'Labelled', value: dashboardData.actualStatus.labelled, color: COLOR_LABELLED },
    { name: 'Pending', value: dashboardData.actualStatus.pending, color: COLOR_PENDING }
  ] : [];

  // Single-Sided Chart 2: SPI (Passed, Failed, Pending)
  const spiChartData = dashboardData ? [
    { name: 'Passed', value: dashboardData.spi?.passed ?? dashboardData.spi?.pass ?? 0, color: COLOR_PASS },
    { name: 'Failed', value: dashboardData.spi?.failed ?? dashboardData.spi?.fail ?? 0, color: COLOR_FAIL },
    { name: 'Pending', value: dashboardData.spi?.pending ?? 0, color: COLOR_PENDING }
  ] : [];

  // Single-Sided Chart 3: Pre-AOI (Passed, Failed, Pending)
  const preAoiChartData = dashboardData ? [
    { name: 'Passed', value: dashboardData.preAOI.passed, color: COLOR_PASS },
    { name: 'Failed', value: dashboardData.preAOI.failed, color: COLOR_FAIL },
    { name: 'Pending', value: dashboardData.preAOI.pending, color: COLOR_PENDING }
  ] : [];

  // Single-Sided Chart 4: Post-AOI (Passed, Failed, Pending)
  const postAoiChartData = dashboardData ? [
    { name: 'Passed', value: dashboardData.postAOI.passed, color: COLOR_PASS },
    { name: 'Failed', value: dashboardData.postAOI.failed, color: COLOR_FAIL },
    { name: 'Pending', value: dashboardData.postAOI.pending, color: COLOR_PENDING }
  ] : [];

  // Double-Sided Chart 1: TOP Side Yield (Passed, Failed, Pending)
  const topYieldChartData = dashboardData?.top ? [
    { name: 'Passed', value: dashboardData.top.postAOI.pass ?? dashboardData.top.postAOI.passed ?? 0, color: COLOR_TOP },
    { name: 'Failed', value: dashboardData.top.postAOI.fail ?? dashboardData.top.postAOI.failed ?? 0, color: COLOR_FAIL },
    { name: 'Pending', value: dashboardData.top.postAOI.pending ?? 0, color: COLOR_PENDING }
  ] : [];

  // Double-Sided Chart 2: BOTTOM Side Yield (Passed, Failed, Pending)
  const bottomYieldChartData = dashboardData?.bottom ? [
    { name: 'Passed', value: dashboardData.bottom.postAOI.pass ?? dashboardData.bottom.postAOI.passed ?? 0, color: COLOR_BOTTOM },
    { name: 'Failed', value: dashboardData.bottom.postAOI.fail ?? dashboardData.bottom.postAOI.failed ?? 0, color: COLOR_FAIL },
    { name: 'Pending', value: dashboardData.bottom.postAOI.pending ?? 0, color: COLOR_PENDING }
  ] : [];

  // Double-Sided Chart 3: Shared SMT FG Yield (Passed, Failed, Pending)
  const smtFgChartData = dashboardData?.smtFG ? [
    { name: 'Passed', value: dashboardData.smtFG.pass ?? dashboardData.smtFG.passed ?? 0, color: COLOR_PASS },
    { name: 'Failed', value: dashboardData.smtFG.fail ?? dashboardData.smtFG.failed ?? 0, color: COLOR_FAIL },
    { name: 'Pending', value: dashboardData.smtFG.pending ?? 0, color: COLOR_PENDING }
  ] : [];

  return (
    <div className={styles.dashboardContainer}>
      {/* Top Header & Navigation Bar */}
      <div className={styles.topControlArea}>
        <div className={styles.topBar}>
          <div className={styles.titleSection}>
            <h1>Production Dashboard</h1>
            <p>
              Real-Time Work Order SMT Production, SPI & AOI Analytics
              {activeTab === 'search' && selectedDate !== 'all' && (
                <span className={styles.historicalBadge}>
                  📅 Day-Wise View: {selectedDate}
                </span>
              )}
            </p>
          </div>

          {/* Tab Selector */}
          <div className={styles.modeTabs}>
            <button
              type="button"
              className={`${styles.tabButton} ${activeTab === 'live' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('live')}
            >
              LIVE WORK ORDERS
            </button>
            <button
              type="button"
              className={`${styles.tabButton} ${activeTab === 'search' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('search')}
            >
              SEARCH WORK ORDERS
            </button>
          </div>

          {/* Refresh & Last Updated controls */}
          <div className={styles.refreshControls}>
            {lastUpdated && <span className={styles.lastUpdatedText}>Last Updated: {lastUpdated}</span>}
            <button
              type="button"
              className={styles.refreshButton}
              onClick={handleManualRefresh}
              disabled={isRefreshing}
            >
              {isRefreshing ? '🔄 Refreshing...' : '🔄 Refresh'}
            </button>
          </div>
        </div>

        {/* Mode 1: Live Work Orders Single WO Navigation Bar */}
        {activeTab === 'live' && (
          <div className={styles.liveNavSection}>
            <button
              type="button"
              className={styles.navButton}
              onClick={handlePrevLive}
              disabled={currentLiveIndex === 0 || liveWorkOrders.length === 0}
            >
              ◄ Previous
            </button>

            <span className={styles.navCounter}>
              {liveWorkOrders.length > 0
                ? `Work Order ${currentLiveIndex + 1} of ${liveWorkOrders.length}`
                : 'No Active Work Orders'}
            </span>

            <button
              type="button"
              className={styles.navButton}
              onClick={handleNextLive}
              disabled={currentLiveIndex >= liveWorkOrders.length - 1 || liveWorkOrders.length === 0}
            >
              Next ►
            </button>
          </div>
        )}

        {/* Mode 2: Search Work Orders Combobox & Day-Wise Date Selector */}
        {activeTab === 'search' && (
          <div className={styles.searchSection}>
            <div className={styles.searchControlsGroup}>
              <span className={styles.searchLabel}>Select or Search Work Order:</span>
              <WorkOrderCombobox
                selectedWorkOrderId={searchSelectedWoId}
                onSelectWorkOrder={woId => {
                  setSearchSelectedWoId(woId);
                  setSelectedDate('all');
                }}
                onClear={() => {
                  setSearchSelectedWoId(null);
                  setSelectedDate('all');
                }}
              />
            </div>

            {searchSelectedWoId && (
              <div className={styles.dateControlsGroup}>
                <span className={styles.dateLabel}>📅 Select Production Date:</span>
                <select
                  className={styles.dateDropdown}
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                >
                  <option value="all">📊 All Days (Overall Total)</option>
                  {dashboardData?.availableDates && dashboardData.availableDates.length > 0 ? (
                    dashboardData.availableDates.map(dateStr => (
                      <option key={dateStr} value={dateStr}>
                        📅 {dateStr}
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>No historical activity recorded</option>
                  )}
                </select>
                <input
                  type="date"
                  className={styles.customDatePicker}
                  value={selectedDate !== 'all' ? selectedDate : ''}
                  onChange={e => {
                    if (e.target.value) {
                      setSelectedDate(e.target.value);
                    }
                  }}
                  title="Select specific date"
                />

                <div className={styles.exportBtnGroup}>
                  <button
                    type="button"
                    className={styles.btnExportExcel}
                    onClick={handleExportExcel}
                    disabled={isExportingExcel || !dashboardData}
                    title="Export day details to Excel (.xlsx)"
                  >
                    📊 {isExportingExcel ? 'Exporting...' : 'Export Excel'}
                  </button>
                  <button
                    type="button"
                    className={styles.btnExportPdf}
                    onClick={handleExportPdf}
                    disabled={isExportingPdf || !dashboardData}
                    title="Export day details to PDF (.pdf)"
                  >
                    📕 {isExportingPdf ? 'Generating...' : 'Export PDF'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className={styles.skeletonContainer}>
          <div className={styles.skeletonCard} />
          <div className={styles.skeletonCard} />
          <div className={styles.skeletonCard} />
        </div>
      )}

      {/* Error Box */}
      {!isLoading && error && (
        <div className={styles.errorBox}>
          <div>⚠️ {error}</div>
          <button type="button" className={styles.retryBtn} onClick={handleManualRefresh}>
            Retry Loading
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && !activeWoId && (
        <div className={styles.emptyBox}>
          <h3>No Work Order Selected</h3>
          <p>
            {activeTab === 'live'
              ? 'There are currently no active Work Orders in production.'
              : 'Use the search combobox above to select a historical or active Work Order.'}
          </p>
        </div>
      )}

      {/* Detailed Dashboard Content for ONE Work Order */}
      {!isLoading && !error && dashboardData && (
        <div className={styles.dashboardBody}>
          {/* Work Order Summary Card (Single Horizontal Row with 4 Columns & Separators) */}
          <div className={styles.woHeaderCard}>
            <div className={styles.headerItem}>
              <span className={styles.headerLabel}>Work Order ID</span>
              <span className={`${styles.headerValue} ${styles.headerValueHighlight}`}>
                {dashboardData.workOrderId}
              </span>
            </div>

            <div className={styles.headerItem}>
              <span className={styles.headerLabel}>Work Order Quantity</span>
              <span className={styles.headerValue}>{dashboardData.totalQuantity}</span>
            </div>

            <div className={styles.headerItem}>
              <span className={styles.headerLabel}>Work Order Start Date</span>
              <span className={styles.headerValue}>{dashboardData.startDate}</span>
            </div>

            <div className={styles.headerItem}>
              <span className={styles.headerLabel}>Overall Status</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span
                  className={`${styles.statusBadge} ${dashboardData.overallStatus === 'NOT STARTED'
                    ? styles.statusNotStarted
                    : dashboardData.overallStatus === 'COMPLETED'
                      ? styles.statusCompleted
                      : styles.statusInProgress
                    }`}
                >
                  {dashboardData.overallStatus}
                </span>
                {dashboardData.sides && (
                  <span className={styles.historicalBadge} style={{ margin: 0 }}>
                    {dashboardData.sides}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* MAIN TWO-COLUMN DASHBOARD GRID */}
          <div className={styles.twoColumnGrid}>
            {/* LEFT COLUMN: Production Matrix & Process Flow OR Double-Sided Flow */}
            <div className={styles.leftColumn}>
              {dashboardData.isDoubleSided ? (
                <div className={styles.doubleSidedContainer}>
                  {/* TOP & BOTTOM INDEPENDENT SIDE PIPELINES (Side-by-side on desktop) */}
                  <div className={styles.sidesGrid}>
                    {/* TOP SIDE CARD */}
                    <div className={`${styles.sideCard} ${styles.sideCardTop}`}>
                      <div className={`${styles.sideCardHeader} ${styles.sideCardHeaderTop}`}>
                        <div className={`${styles.sideCardTitle} ${styles.sideCardTitleTop}`}>
                          <span>🔵</span> TOP SIDE
                        </div>
                        <span className={`${styles.sideBadge} ${styles.sideBadgeTop}`}>Side 1</span>
                      </div>
                      <div className={styles.sideTableWrapper}>
                        <table className={styles.sideTable}>
                          <thead>
                            <tr>
                              <th className={styles.thSideStage}>
                                <span className={styles.thHeaderContent}>STAGE</span>
                              </th>
                              <th className={`${styles.thSideSub} ${styles.thPass}`}>
                                <span className={styles.thHeaderContent}>PASS</span>
                              </th>
                              <th className={`${styles.thSideSub} ${styles.thFail}`}>
                                <span className={styles.thHeaderContent}>FAIL</span>
                              </th>
                              <th className={`${styles.thSideSub} ${styles.thPending}`}>
                                <span className={styles.thHeaderContent}>PENDING</span>
                              </th>
                              <th className={`${styles.thSideSub} ${styles.thCompleted}`}>
                                <span className={styles.thHeaderContent}>
                                  <span>COMPLETED</span>
                                  <span className={styles.thPercentSign}>%</span>
                                </span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {/* Row 1: Printing */}
                            <tr>
                              <td className={styles.tdSideStage}>
                                <span className={styles.stageContent}>
                                  <span className={styles.stageIcon}>🖨️</span> Printing
                                </span>
                              </td>
                              <td className={`${styles.tdCell} ${styles.cellGreen}`}>
                                {dashboardData.top?.printing.pass ?? dashboardData.top?.printing.passed ?? 0}
                              </td>
                              <td className={`${styles.tdCell} ${styles.cellRed}`}>
                                {dashboardData.top?.printing.fail ?? dashboardData.top?.printing.failed ?? 0}
                              </td>
                              <td className={`${styles.tdCell} ${styles.cellAmber}`}>
                                {dashboardData.top?.printing.pending ?? 0}
                              </td>
                              <td className={`${styles.tdCell} ${styles.cellBlue}`}>
                                {dashboardData.top?.printing.yield ?? dashboardData.top?.printing.percentage ?? 0}%
                              </td>
                            </tr>
                            {/* Row 2: SPI */}
                            <tr>
                              <td className={styles.tdSideStage}>
                                <span className={styles.stageContent}>
                                  <span className={styles.stageIcon}>🔬</span> SPI
                                </span>
                              </td>
                              <td className={`${styles.tdCell} ${styles.cellGreen}`}>
                                {dashboardData.top?.spi?.pass ?? dashboardData.top?.spi?.passed ?? 0}
                              </td>
                              <td className={`${styles.tdCell} ${styles.cellRed}`}>
                                {dashboardData.top?.spi?.fail ?? dashboardData.top?.spi?.failed ?? 0}
                              </td>
                              <td className={`${styles.tdCell} ${styles.cellAmber}`}>
                                {dashboardData.top?.spi?.pending ?? 0}
                              </td>
                              <td className={`${styles.tdCell} ${styles.cellBlue}`}>
                                {dashboardData.top?.spi?.yield ?? dashboardData.top?.spi?.percentage ?? 0}%
                              </td>
                            </tr>
                            {/* Row 3: Pre AOI */}
                            <tr>
                              <td className={styles.tdSideStage}>
                                <span className={styles.stageContent}>
                                  <span className={styles.stageIcon}>🔍</span> Pre AOI
                                </span>
                              </td>
                              <td className={`${styles.tdCell} ${styles.cellGreen}`}>
                                {dashboardData.top?.preAOI.pass ?? dashboardData.top?.preAOI.passed ?? 0}
                              </td>
                              <td className={`${styles.tdCell} ${styles.cellRed}`}>
                                {dashboardData.top?.preAOI.fail ?? dashboardData.top?.preAOI.failed ?? 0}
                              </td>
                              <td className={`${styles.tdCell} ${styles.cellAmber}`}>
                                {dashboardData.top?.preAOI.pending ?? 0}
                              </td>
                              <td className={`${styles.tdCell} ${styles.cellBlue}`}>
                                {dashboardData.top?.preAOI.yield ?? dashboardData.top?.preAOI.percentage ?? 0}%
                              </td>
                            </tr>
                            {/* Row 3: Post AOI */}
                            <tr>
                              <td className={styles.tdSideStage}>
                                <span className={styles.stageContent}>
                                  <span className={styles.stageIcon}>🔍</span> Post AOI
                                </span>
                              </td>
                              <td className={`${styles.tdCell} ${styles.cellGreen}`}>
                                {dashboardData.top?.postAOI.pass ?? dashboardData.top?.postAOI.passed ?? 0}
                              </td>
                              <td className={`${styles.tdCell} ${styles.cellRed}`}>
                                {dashboardData.top?.postAOI.fail ?? dashboardData.top?.postAOI.failed ?? 0}
                              </td>
                              <td className={`${styles.tdCell} ${styles.cellAmber}`}>
                                {dashboardData.top?.postAOI.pending ?? 0}
                              </td>
                              <td className={`${styles.tdCell} ${styles.cellBlue}`}>
                                {dashboardData.top?.postAOI.yield ?? dashboardData.top?.postAOI.percentage ?? 0}%
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* BOTTOM SIDE CARD */}
                    <div className={`${styles.sideCard} ${styles.sideCardBottom}`}>
                      <div className={`${styles.sideCardHeader} ${styles.sideCardHeaderBottom}`}>
                        <div className={`${styles.sideCardTitle} ${styles.sideCardTitleBottom}`}>
                          <span>🟣</span> BOTTOM SIDE
                        </div>
                        <span className={`${styles.sideBadge} ${styles.sideBadgeBottom}`}>Side 2</span>
                      </div>
                      <div className={styles.sideTableWrapper}>
                        <table className={styles.sideTable}>
                          <thead>
                            <tr>
                              <th className={styles.thSideStage}>
                                <span className={styles.thHeaderContent}>STAGE</span>
                              </th>
                              <th className={`${styles.thSideSub} ${styles.thPass}`}>
                                <span className={styles.thHeaderContent}>PASS</span>
                              </th>
                              <th className={`${styles.thSideSub} ${styles.thFail}`}>
                                <span className={styles.thHeaderContent}>FAIL</span>
                              </th>
                              <th className={`${styles.thSideSub} ${styles.thPending}`}>
                                <span className={styles.thHeaderContent}>PENDING</span>
                              </th>
                              <th className={`${styles.thSideSub} ${styles.thCompleted}`}>
                                <span className={styles.thHeaderContent}>
                                  <span>COMPLETED</span>
                                  <span className={styles.thPercentSign}>%</span>
                                </span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {/* Row 1: Printing */}
                            <tr>
                              <td className={styles.tdSideStage}>
                                <span className={styles.stageContent}>
                                  <span className={styles.stageIcon}>🖨️</span> Printing
                                </span>
                              </td>
                              <td className={`${styles.tdCell} ${styles.cellGreen}`}>
                                {dashboardData.bottom?.printing.pass ?? dashboardData.bottom?.printing.passed ?? 0}
                              </td>
                              <td className={`${styles.tdCell} ${styles.cellRed}`}>
                                {dashboardData.bottom?.printing.fail ?? dashboardData.bottom?.printing.failed ?? 0}
                              </td>
                              <td className={`${styles.tdCell} ${styles.cellAmber}`}>
                                {dashboardData.bottom?.printing.pending ?? 0}
                              </td>
                              <td className={`${styles.tdCell} ${styles.cellBlue}`}>
                                {dashboardData.bottom?.printing.yield ?? dashboardData.bottom?.printing.percentage ?? 0}%
                              </td>
                            </tr>
                            {/* Row 2: SPI */}
                            <tr>
                              <td className={styles.tdSideStage}>
                                <span className={styles.stageContent}>
                                  <span className={styles.stageIcon}>🔬</span> SPI
                                </span>
                              </td>
                              <td className={`${styles.tdCell} ${styles.cellGreen}`}>
                                {dashboardData.bottom?.spi?.pass ?? dashboardData.bottom?.spi?.passed ?? 0}
                              </td>
                              <td className={`${styles.tdCell} ${styles.cellRed}`}>
                                {dashboardData.bottom?.spi?.fail ?? dashboardData.bottom?.spi?.failed ?? 0}
                              </td>
                              <td className={`${styles.tdCell} ${styles.cellAmber}`}>
                                {dashboardData.bottom?.spi?.pending ?? 0}
                              </td>
                              <td className={`${styles.tdCell} ${styles.cellBlue}`}>
                                {dashboardData.bottom?.spi?.yield ?? dashboardData.bottom?.spi?.percentage ?? 0}%
                              </td>
                            </tr>
                            {/* Row 3: Pre AOI */}
                            <tr>
                              <td className={styles.tdSideStage}>
                                <span className={styles.stageContent}>
                                  <span className={styles.stageIcon}>🔍</span> Pre AOI
                                </span>
                              </td>
                              <td className={`${styles.tdCell} ${styles.cellGreen}`}>
                                {dashboardData.bottom?.preAOI.pass ?? dashboardData.bottom?.preAOI.passed ?? 0}
                              </td>
                              <td className={`${styles.tdCell} ${styles.cellRed}`}>
                                {dashboardData.bottom?.preAOI.fail ?? dashboardData.bottom?.preAOI.failed ?? 0}
                              </td>
                              <td className={`${styles.tdCell} ${styles.cellAmber}`}>
                                {dashboardData.bottom?.preAOI.pending ?? 0}
                              </td>
                              <td className={`${styles.tdCell} ${styles.cellBlue}`}>
                                {dashboardData.bottom?.preAOI.yield ?? dashboardData.bottom?.preAOI.percentage ?? 0}%
                              </td>
                            </tr>
                            {/* Row 3: Post AOI */}
                            <tr>
                              <td className={styles.tdSideStage}>
                                <span className={styles.stageContent}>
                                  <span className={styles.stageIcon}>🔍</span> Post AOI
                                </span>
                              </td>
                              <td className={`${styles.tdCell} ${styles.cellGreen}`}>
                                {dashboardData.bottom?.postAOI.pass ?? dashboardData.bottom?.postAOI.passed ?? 0}
                              </td>
                              <td className={`${styles.tdCell} ${styles.cellRed}`}>
                                {dashboardData.bottom?.postAOI.fail ?? dashboardData.bottom?.postAOI.failed ?? 0}
                              </td>
                              <td className={`${styles.tdCell} ${styles.cellAmber}`}>
                                {dashboardData.bottom?.postAOI.pending ?? 0}
                              </td>
                              <td className={`${styles.tdCell} ${styles.cellBlue}`}>
                                {dashboardData.bottom?.postAOI.yield ?? dashboardData.bottom?.postAOI.percentage ?? 0}%
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* COMPACT SHARED SMT FG RELEASE BAR */}
                  <div className={styles.sharedFgCardCompact}>
                    <div className={styles.sharedFgCompactHeader}>
                      <div className={styles.sharedFgTitle}>
                        <span>📦</span> SMT FG — Combined Final Release
                        <span className={styles.flowBadge}>TOP + BOTTOM ➔ SMT FG</span>
                      </div>
                      <div className={styles.sharedFgCompactSub}>
                        <span>Target: <strong>{dashboardData.totalQuantity}</strong></span>
                        <span className={styles.compactDot}>•</span>
                        <span>Completion: <strong>{Math.min(100, Math.round(((dashboardData.smtFG?.pass ?? dashboardData.smtFG?.passed ?? 0) / (dashboardData.totalQuantity || 1)) * 100))}%</strong></span>
                      </div>
                    </div>

                    <div className={styles.sharedFgCompactContent}>
                      <div className={styles.sharedFgMetricsInline}>
                        <div className={`${styles.compactMetricItem} ${styles.cellGreen}`}>
                          <span className={styles.compactMetricLabel}>PASS</span>
                          <span className={styles.compactMetricValue}>
                            {dashboardData.smtFG?.pass ?? dashboardData.smtFG?.passed ?? 0}
                          </span>
                        </div>
                        <div className={`${styles.compactMetricItem} ${styles.cellRed}`}>
                          <span className={styles.compactMetricLabel}>FAIL</span>
                          <span className={styles.compactMetricValue}>
                            {dashboardData.smtFG?.fail ?? dashboardData.smtFG?.failed ?? 0}
                          </span>
                        </div>
                        <div className={`${styles.compactMetricItem} ${styles.cellAmber}`}>
                          <span className={styles.compactMetricLabel}>PENDING</span>
                          <span className={styles.compactMetricValue}>
                            {dashboardData.smtFG?.pending ?? 0}
                          </span>
                        </div>
                        <div className={`${styles.compactMetricItem} ${styles.cellBlue}`}>
                          <span className={styles.compactMetricLabel}>YIELD</span>
                          <span className={styles.compactMetricValue}>
                            {dashboardData.smtFG?.yield ?? dashboardData.smtFG?.percentage ?? 0}%
                          </span>
                        </div>
                      </div>

                      <div className={styles.sharedFgProgressBarCompact}>
                        <div
                          className={styles.sharedFgProgressFill}
                          style={{
                            width: `${Math.min(100, Math.round(((dashboardData.smtFG?.pass ?? dashboardData.smtFG?.passed ?? 0) / (dashboardData.totalQuantity || 1)) * 100))}%`
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* PRODUCTION MATRIX (Placed ABOVE Process Flow) */}
                  <div className={styles.matrixSection}>
                    <div className={styles.matrixHeader}>
                      <div className={styles.matrixTitle}>PRODUCTION MATRIX</div>
                      <div className={styles.matrixSubtitle}>Stage progression & metric breakdown</div>
                    </div>

                    <div className={styles.matrixTableWrapper}>
                      <table className={styles.matrixTable}>
                        <thead>
                          <tr>
                            <th className={styles.thStage}>
                              <span className={styles.thHeaderContent}>STAGE</span>
                            </th>
                            <th className={`${styles.thSub} ${styles.thPass}`}>
                              <span className={styles.thHeaderContent}>PASS</span>
                            </th>
                            <th className={`${styles.thSub} ${styles.thFail}`}>
                              <span className={styles.thHeaderContent}>FAIL</span>
                            </th>
                            <th className={`${styles.thSub} ${styles.thPending}`}>
                              <span className={styles.thHeaderContent}>PENDING</span>
                            </th>
                            <th className={`${styles.thSub} ${styles.thCompleted}`}>
                              <span className={styles.thHeaderContent}>
                                <span>COMPLETED</span>
                                <span className={styles.thPercentSign}>%</span>
                              </span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* Row 1: Printing */}
                          <tr>
                            <td className={styles.tdStage}>
                              <span className={styles.stageContent}>
                                <span className={styles.stageIcon}>🖨️</span> Printing
                              </span>
                            </td>
                            <td className={`${styles.tdCell} ${styles.cellGreen}`}>
                              {dashboardData.actualStatus.passed ?? dashboardData.actualStatus.labelled}
                            </td>
                            <td className={`${styles.tdCell} ${styles.cellRed}`}>
                              {dashboardData.actualStatus.failed || 0}
                            </td>
                            <td className={`${styles.tdCell} ${styles.cellAmber}`}>
                              {dashboardData.actualStatus.pending}
                            </td>
                            <td className={`${styles.tdCell} ${styles.cellBlue}`}>
                              {dashboardData.actualStatus.percentage}%
                            </td>
                          </tr>

                          {/* Row 2: SPI */}
                          <tr>
                            <td className={styles.tdStage}>
                              <span className={styles.stageContent}>
                                <span className={styles.stageIcon}>🔬</span> SPI
                              </span>
                            </td>
                            <td className={`${styles.tdCell} ${styles.cellGreen}`}>
                              {dashboardData.spi?.passed ?? dashboardData.spi?.pass ?? 0}
                            </td>
                            <td className={`${styles.tdCell} ${styles.cellRed}`}>
                              {dashboardData.spi?.failed ?? dashboardData.spi?.fail ?? 0}
                            </td>
                            <td className={`${styles.tdCell} ${styles.cellAmber}`}>
                              {dashboardData.spi?.pending ?? 0}
                            </td>
                            <td className={`${styles.tdCell} ${styles.cellBlue}`}>
                              {dashboardData.spi?.percentage ?? dashboardData.spi?.yield ?? dashboardData.yieldSPI ?? 0}%
                            </td>
                          </tr>

                          {/* Row 3: Pre AOI */}
                          <tr>
                            <td className={styles.tdStage}>
                              <span className={styles.stageContent}>
                                <span className={styles.stageIcon}>🔍</span> Pre AOI
                              </span>
                            </td>
                            <td className={`${styles.tdCell} ${styles.cellGreen}`}>
                              {dashboardData.preAOI.passed}
                            </td>
                            <td className={`${styles.tdCell} ${styles.cellRed}`}>
                              {dashboardData.preAOI.failed}
                            </td>
                            <td className={`${styles.tdCell} ${styles.cellAmber}`}>
                              {dashboardData.preAOI.pending}
                            </td>
                            <td className={`${styles.tdCell} ${styles.cellBlue}`}>
                              {dashboardData.preAOI.percentage}%
                            </td>
                          </tr>

                          {/* Row 4: Post AOI */}
                          <tr>
                            <td className={styles.tdStage}>
                              <span className={styles.stageContent}>
                                <span className={styles.stageIcon}>🔍</span> Post AOI
                              </span>
                            </td>
                            <td className={`${styles.tdCell} ${styles.cellGreen}`}>
                              {dashboardData.postAOI.passed}
                            </td>
                            <td className={`${styles.tdCell} ${styles.cellRed}`}>
                              {dashboardData.postAOI.failed}
                            </td>
                            <td className={`${styles.tdCell} ${styles.cellAmber}`}>
                              {dashboardData.postAOI.pending}
                            </td>
                            <td className={`${styles.tdCell} ${styles.cellBlue}`}>
                              {dashboardData.postAOI.percentage}%
                            </td>
                          </tr>

                          {/* Row 5: SMT FG */}
                          <tr>
                            <td className={styles.tdStage}>
                              <span className={styles.stageContent}>
                                <span className={styles.stageIcon}>📦</span> SMT FG
                              </span>
                            </td>
                            <td className={`${styles.tdCell} ${styles.cellGreen}`}>
                              {dashboardData.smtFG ? (dashboardData.smtFG.pass ?? dashboardData.smtFG.passed) : dashboardData.postAOI.passed}
                            </td>
                            <td className={`${styles.tdCell} ${styles.cellRed}`}>
                              {dashboardData.smtFG ? (dashboardData.smtFG.fail ?? dashboardData.smtFG.failed) : 0}
                            </td>
                            <td className={`${styles.tdCell} ${styles.cellAmber}`}>
                              {dashboardData.smtFG
                                ? dashboardData.smtFG.pending
                                : Math.max(0, dashboardData.totalQuantity - dashboardData.postAOI.passed)}
                            </td>
                            <td className={`${styles.tdCell} ${styles.cellBlue}`}>
                              {dashboardData.smtFG
                                ? `${dashboardData.smtFG.yield ?? dashboardData.smtFG.percentage}%`
                                : `${dashboardData.totalQuantity > 0
                                  ? Math.round((dashboardData.postAOI.passed / dashboardData.totalQuantity) * 100)
                                  : 0
                                }%`}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* PRODUCTION PROCESS FLOW (Placed BELOW Matrix) */}
                  <div className={styles.flowSection}>
                    <div className={styles.flowHeader}>
                      <div className={styles.flowTitle}>PRODUCTION PROCESS FLOW</div>
                      <div className={styles.flowSubtitle}>Real-time production progression</div>
                    </div>

                    <div className={styles.flowDiagram}>
                      <div className={styles.flowNode}>
                        <span className={styles.nodeTitle}>Printing Stage</span>
                        <span className={styles.nodeMain} style={{ color: COLOR_PASS }}>
                          Passed: {dashboardData.actualStatus.passed ?? dashboardData.actualStatus.labelled}
                        </span>
                        <div className={styles.progressTrack}>
                          <div
                            className={styles.progressBar}
                            style={{
                              width: `${Math.min(100, Math.round(((dashboardData.actualStatus.passed ?? dashboardData.actualStatus.labelled) / (dashboardData.totalQuantity || 1)) * 100))}%`,
                              backgroundColor: COLOR_PASS
                            }}
                          />
                        </div>
                        <span className={styles.nodeSub}>
                          Failed: <strong style={{ color: '#b91c1c' }}>{dashboardData.actualStatus.failed || 0}</strong> | Pending:{' '}
                          <strong style={{ color: '#b45309' }}>{dashboardData.actualStatus.pending}</strong>
                        </span>
                      </div>

                      <span className={styles.flowArrow}>➔</span>

                      <div className={styles.flowNode}>
                        <span className={styles.nodeTitle}>SPI Stage</span>
                        <span className={styles.nodeMain} style={{ color: COLOR_PASS }}>
                          Passed: {dashboardData.spi?.passed ?? dashboardData.spi?.pass ?? 0}
                        </span>
                        <div className={styles.progressTrack}>
                          <div
                            className={styles.progressBar}
                            style={{
                              width: `${Math.min(100, Math.round(((dashboardData.spi?.passed ?? dashboardData.spi?.pass ?? 0) / (dashboardData.totalQuantity || 1)) * 100))}%`,
                              backgroundColor: COLOR_PASS
                            }}
                          />
                        </div>
                        <span className={styles.nodeSub}>
                          Failed: <strong style={{ color: '#b91c1c' }}>{dashboardData.spi?.failed ?? dashboardData.spi?.fail ?? 0}</strong> | Pending:{' '}
                          <strong style={{ color: '#b45309' }}>{dashboardData.spi?.pending ?? 0}</strong>
                        </span>
                      </div>

                      <span className={styles.flowArrow}>➔</span>

                      <div className={styles.flowNode}>
                        <span className={styles.nodeTitle}>Pre-AOI Stage</span>
                        <span className={styles.nodeMain} style={{ color: COLOR_PASS }}>
                          Passed: {dashboardData.preAOI.passed}
                        </span>
                        <div className={styles.progressTrack}>
                          <div
                            className={styles.progressBar}
                            style={{
                              width: `${Math.min(100, Math.round((dashboardData.preAOI.passed / (dashboardData.totalQuantity || 1)) * 100))}%`,
                              backgroundColor: COLOR_PASS
                            }}
                          />
                        </div>
                        <span className={styles.nodeSub}>
                          Failed: <strong style={{ color: '#b91c1c' }}>{dashboardData.preAOI.failed}</strong> | Pending:{' '}
                          <strong style={{ color: '#b45309' }}>{dashboardData.preAOI.pending}</strong>
                        </span>
                      </div>

                      <span className={styles.flowArrow}>➔</span>

                      <div className={styles.flowNode}>
                        <span className={styles.nodeTitle}>Post-AOI Stage</span>
                        <span className={styles.nodeMain} style={{ color: COLOR_PASS }}>
                          Passed: {dashboardData.postAOI.passed}
                        </span>
                        <div className={styles.progressTrack}>
                          <div
                            className={styles.progressBar}
                            style={{
                              width: `${Math.min(100, Math.round((dashboardData.postAOI.passed / (dashboardData.totalQuantity || 1)) * 100))}%`,
                              backgroundColor: COLOR_PASS
                            }}
                          />
                        </div>
                        <span className={styles.nodeSub}>
                          Failed: <strong style={{ color: '#b91c1c' }}>{dashboardData.postAOI.failed}</strong> | Pending:{' '}
                          <strong style={{ color: '#b45309' }}>{dashboardData.postAOI.pending}</strong>
                        </span>
                      </div>

                      <span className={styles.flowArrow}>➔</span>

                      <div className={styles.flowNode}>
                        <span className={styles.nodeTitle}>SMT FG Stage</span>
                        <span className={styles.nodeMain} style={{ color: COLOR_PASS }}>
                          Passed: {dashboardData.smtFG ? (dashboardData.smtFG.pass ?? dashboardData.smtFG.passed) : dashboardData.postAOI.passed}
                        </span>
                        <div className={styles.progressTrack}>
                          <div
                            className={styles.progressBar}
                            style={{
                              width: `${Math.min(100, Math.round(((dashboardData.smtFG ? (dashboardData.smtFG.pass ?? dashboardData.smtFG.passed) : dashboardData.postAOI.passed) / (dashboardData.totalQuantity || 1)) * 100))}%`,
                              backgroundColor: COLOR_PASS
                            }}
                          />
                        </div>
                        <span className={styles.nodeSub}>
                          Failed: <strong style={{ color: '#b91c1c' }}>{dashboardData.smtFG ? (dashboardData.smtFG.fail ?? dashboardData.smtFG.failed) : 0}</strong> | Pending:{' '}
                          <strong style={{ color: '#b45309' }}>
                            {dashboardData.smtFG
                              ? dashboardData.smtFG.pending
                              : Math.max(0, dashboardData.totalQuantity - dashboardData.postAOI.passed)}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* RIGHT ANALYTICS COLUMN (3 Vertically Stacked Compact Donut Charts) */}
            <div className={styles.rightColumn}>
              {dashboardData.isDoubleSided ? (
                <>
                  {/* Double-Sided Chart 1: TOP Side Yield */}
                  <div className={styles.chartCard}>
                    <div className={styles.chartHeaderRow}>
                      <span className={styles.chartTitle}>TOP Side Yield</span>
                      <span className={styles.chartDot} style={{ backgroundColor: '#3b82f6' }} />
                    </div>
                    <div className={styles.chartWrapper}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={topYieldChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={58}
                            outerRadius={80}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {topYieldChartData.map((entry, index) => (
                              <Cell key={`cell-top-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className={styles.chartCenterLabel}>
                        <div className={styles.chartCenterNumber}>
                          {dashboardData.top?.postAOI.yield ?? dashboardData.top?.postAOI.percentage ?? 0}%
                        </div>
                        <div className={styles.chartCenterSub}>Top Yield</div>
                      </div>
                    </div>
                  </div>

                  {/* Double-Sided Chart 2: BOTTOM Side Yield */}
                  <div className={styles.chartCard}>
                    <div className={styles.chartHeaderRow}>
                      <span className={styles.chartTitle}>BOTTOM Side Yield</span>
                      <span className={styles.chartDot} style={{ backgroundColor: '#8b5cf6' }} />
                    </div>
                    <div className={styles.chartWrapper}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={bottomYieldChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={58}
                            outerRadius={80}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {bottomYieldChartData.map((entry, index) => (
                              <Cell key={`cell-bottom-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className={styles.chartCenterLabel}>
                        <div className={styles.chartCenterNumber}>
                          {dashboardData.bottom?.postAOI.yield ?? dashboardData.bottom?.postAOI.percentage ?? 0}%
                        </div>
                        <div className={styles.chartCenterSub}>Bottom Yield</div>
                      </div>
                    </div>
                  </div>

                  {/* Double-Sided Chart 3: SMT FG Yield */}
                  <div className={styles.chartCard}>
                    <div className={styles.chartHeaderRow}>
                      <span className={styles.chartTitle}>SMT FG Yield</span>
                      <span className={styles.chartDot} style={{ backgroundColor: '#10b981' }} />
                    </div>
                    <div className={styles.chartWrapper}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={smtFgChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={58}
                            outerRadius={80}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {smtFgChartData.map((entry, index) => (
                              <Cell key={`cell-fg-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className={styles.chartCenterLabel}>
                        <div className={styles.chartCenterNumber}>
                          {dashboardData.smtFG?.yield ?? dashboardData.smtFG?.percentage ?? 0}%
                        </div>
                        <div className={styles.chartCenterSub}>FG Yield</div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Single-Sided Chart 1: Actual Status */}
                  <div className={styles.chartCard}>
                    <div className={styles.chartHeaderRow}>
                      <span className={styles.chartTitle}>Actual Status Distribution</span>
                      <span className={styles.chartDot} style={{ backgroundColor: '#0284c7' }} />
                    </div>
                    <div className={styles.chartWrapper}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={actualChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {actualChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className={styles.chartCenterLabel}>
                        <div className={styles.chartCenterNumber}>{dashboardData.actualStatus.percentage}%</div>
                        <div className={styles.chartCenterSub}>Labelled</div>
                      </div>
                    </div>
                  </div>

                  {/* Single-Sided Chart 2: SPI Pass Rate */}
                  <div className={styles.chartCard}>
                    <div className={styles.chartHeaderRow}>
                      <span className={styles.chartTitle}>SPI Pass Rate</span>
                      <span className={styles.chartDot} style={{ backgroundColor: COLOR_SPI }} />
                    </div>
                    <div className={styles.chartWrapper}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={spiChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {spiChartData.map((entry, index) => (
                              <Cell key={`cell-spi-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className={styles.chartCenterLabel}>
                        <div className={styles.chartCenterNumber}>
                          {dashboardData.spi?.percentage ?? dashboardData.spi?.yield ?? dashboardData.yieldSPI ?? 0}%
                        </div>
                        <div className={styles.chartCenterSub}>Pass %</div>
                      </div>
                    </div>
                  </div>

                  {/* Single-Sided Chart 3: Pre-AOI */}
                  <div className={styles.chartCard}>
                    <div className={styles.chartHeaderRow}>
                      <span className={styles.chartTitle}>Pre-AOI Pass Rate</span>
                      <span className={styles.chartDot} style={{ backgroundColor: '#16a34a' }} />
                    </div>
                    <div className={styles.chartWrapper}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={preAoiChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {preAoiChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className={styles.chartCenterLabel}>
                        <div className={styles.chartCenterNumber}>{dashboardData.preAOI.percentage}%</div>
                        <div className={styles.chartCenterSub}>Pass %</div>
                      </div>
                    </div>
                  </div>

                  {/* Single-Sided Chart 4: Post-AOI */}
                  <div className={styles.chartCard}>
                    <div className={styles.chartHeaderRow}>
                      <span className={styles.chartTitle}>Post-AOI Pass Rate</span>
                      <span className={styles.chartDot} style={{ backgroundColor: '#8b5cf6' }} />
                    </div>
                    <div className={styles.chartWrapper}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={postAoiChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {postAoiChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className={styles.chartCenterLabel}>
                        <div className={styles.chartCenterNumber}>{dashboardData.postAOI.percentage}%</div>
                        <div className={styles.chartCenterSub}>Pass %</div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
