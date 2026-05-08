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
import Spi from './pages/smt/Spi';
import PostAoi from './pages/smt/PostAoi';
import Rework from './pages/smt/Rework';
import { PreviousSoldering } from './pages/smt/PreviousSoldering';
import { PostWorkSoldering } from './pages/smt/PostWorkSoldering';
import { ViTouchUp } from './pages/smt/ViTouchUp';
import WorkOrderBackend from './pages/backend/WorkOrder';
import PTH from './pages/backend/PTH';
import VI from './pages/backend/VI';
import QA from './pages/backend/QA';
import Flashing from './pages/backend/Flashing';
import PCBAFCT from './pages/backend/PCBAFCT';
import Assembly from './pages/backend/Assembly';
import UnitTesting from './pages/backend/UnitTesting';
import QI from './pages/backend/QI';
import Packing from './pages/backend/Packing';
import RemarkBackend from './pages/backend/Remark';
import DebugBackend from './pages/backend/Debug';
import TrackItems from './pages/backend/TrackItems';
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
                path: '/backend/work-order',
                element: (
                    <ProtectedRoute>
                        <WorkOrderBackend />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/backend/pth',
                element: (
                    <ProtectedRoute>
                        <PTH />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/backend/vi',
                element: (
                    <ProtectedRoute>
                        <VI />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/backend/qa',
                element: (
                    <ProtectedRoute>
                        <QA />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/backend/flashing',
                element: (
                    <ProtectedRoute>
                        <Flashing />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/backend/pcba-fct',
                element: (
                    <ProtectedRoute>
                        <PCBAFCT />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/backend/assembly',
                element: (
                    <ProtectedRoute>
                        <Assembly />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/backend/unit-testing',
                element: (
                    <ProtectedRoute>
                        <UnitTesting />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/backend/qi',
                element: (
                    <ProtectedRoute>
                        <QI />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/backend/packing',
                element: (
                    <ProtectedRoute>
                        <Packing />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/backend/remark',
                element: (
                    <ProtectedRoute>
                        <RemarkBackend />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/backend/debug',
                element: (
                    <ProtectedRoute>
                        <DebugBackend />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/backend/track-items',
                element: (
                    <ProtectedRoute>
                        <TrackItems />
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
                    {
                        path: 'spi',
                        element: <Spi />,
                    },
                    {
                        path: 'post-aoi',
                        element: <PostAoi />,
                    },
                    {
                        path: 'rework',
                        element: <Rework />,
                    },
                    {
                        path: 'previous-soldering',
                        element: <PreviousSoldering />,
                    },
                    {
                        path: 'post-work-soldering',
                        element: <PostWorkSoldering />,
                    },
                    {
                        path: 'vi-touch-up',
                        element: <ViTouchUp />,
                    },
                ]
            },
        ],
    },
]);
