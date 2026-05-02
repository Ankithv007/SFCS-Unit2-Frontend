import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { Login } from './pages/auth/Login';
import { Signup } from './pages/auth/Signup';
import { Forgot } from './pages/auth/Forgot';
import { Dashboard } from './pages/dashboard/Dashboard';
import { PurchaseOrder } from './pages/inventory/PurchaseOrder';
import { WipStack } from './pages/inventory/WipStack';
import { ReturnWip } from './pages/inventory/ReturnWip';
import { Report } from './pages/inventory/Report';
import { IQC } from './pages/pre-testing/IQC';
import { Warehouse } from './pages/pre-testing/Warehouse';
import { Impedance } from './pages/pre-testing/Impedance';
import { AdminPanel } from './pages/admin/AdminPanel';
import { PreCalibration } from './pages/pre-testing/PreCalibration';
import { PreACLR } from './pages/pre-testing/PreACLR';
import { Trace } from './pages/pre-testing/Trace';
import { QCInspection } from './pages/qc-inspection/QCInspection';
import { ShiftManagement } from './pages/qc-inspection/ShiftManagement';
import { VacuumLeakTest } from './pages/vacuum-leak-test/VacuumLeakTest';
import { WorkOrder } from './pages/smt/WorkOrder';
import { WorkOrderHistory } from './pages/smt/WorkOrderHistory';
import { SerialNumber } from './pages/smt/SerialNumber';
import { Printing } from './pages/smt/Printing';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';

import { SmtProtectedRoute } from './components/SmtProtectedRoute';
import { SmtLogin } from './pages/smt/SmtLogin';

export const router = createBrowserRouter([
    {
        element: <Layout />,
        children: [
            {
                path: '/',
                element: <Navigate to="/login" replace />,
            },
            {
                path: '/login',
                element: <Login />,
            },
            {
                path: '/signup',
                element: <Signup />,
            },
            {
                path: '/forgot',
                element: <Forgot />,
            },
            {
                path: '/dashboard',
                element: (
                    <ProtectedRoute>
                        <Dashboard />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/admin-panel',
                element: (
                    <ProtectedRoute>
                        <AdminPanel />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/qc-inspection',
                element: (
                    <ProtectedRoute>
                        <QCInspection />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/qc-inspection/shifts',
                element: (
                    <ProtectedRoute>
                        <ShiftManagement />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/purchase-order',
                element: (
                    <ProtectedRoute>
                        <PurchaseOrder />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/wip-stack',
                element: (
                    <ProtectedRoute>
                        <WipStack />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/return-wip',
                element: (
                    <ProtectedRoute>
                        <ReturnWip />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/report',
                element: (
                    <ProtectedRoute>
                        <Report />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/pre-testing/warehouse',
                element: (
                    <ProtectedRoute>
                        <Warehouse />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/pre-testing/iqc',
                element: (
                    <ProtectedRoute>
                        <IQC />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/pre-testing/impedance',
                element: (
                    <ProtectedRoute>
                        <Impedance />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/pre-testing/calibration',
                element: (
                    <ProtectedRoute>
                        <PreCalibration />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/pre-testing/pre-aclr',
                element: (
                    <ProtectedRoute>
                        <PreACLR />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/pre-testing/trace',
                element: (
                    <ProtectedRoute>
                        <Trace />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/vacuum-leak-test',
                element: (
                    <ProtectedRoute>
                        <VacuumLeakTest />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/smt/login',
                element: <SmtLogin />,
            },
            {
                path: '/smt',
                element: <SmtProtectedRoute children={<Outlet />} />,
                children: [
                    {
                        path: 'work-order',
                        element: <WorkOrder />,
                    },
                    {
                        path: 'workorder-history',
                        element: <WorkOrderHistory />,
                    },
                    {
                        path: 'serial-number',
                        element: <SerialNumber />,
                    },
                    {
                        path: 'printing',
                        element: <Printing />,
                    },
                ]
            },
        ],
    },
]);
