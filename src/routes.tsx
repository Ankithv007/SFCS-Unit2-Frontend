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
import PCBGeneration from './pages/smt/PCBGeneration';
import PreAoi from './pages/smt/PreAoi';
import SMTFG from './pages/smt/SMTFG';
import SmtTrackItems from './pages/smt/SmtTrackItems';

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
import ReworkBackend from './pages/backend/Rework';
import DebugBackend from './pages/backend/Debug';
import TrackItems from './pages/backend/TrackItems';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';

import { BackendProtectedRoute } from './components/BackendProtectedRoute';
import { BackendLogin } from './pages/backend/BackendLogin';

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
                path: '/backend/login',
                element: <BackendLogin />,
            },
            {
                path: '/backend',
                element: <BackendProtectedRoute children={<Outlet />} />,
                children: [
                    {
                        path: 'work-order',
                        element: <WorkOrderBackend />,
                    },
                    {
                        path: 'pth',
                        element: <PTH />,
                    },
                    {
                        path: 'vi',
                        element: <VI />,
                    },
                    {
                        path: 'qa',
                        element: <QA />,
                    },
                    {
                        path: 'flashing',
                        element: <Flashing />,
                    },
                    {
                        path: 'pcba-fct',
                        element: <PCBAFCT />,
                    },
                    {
                        path: 'assembly',
                        element: <Assembly />,
                    },
                    {
                        path: 'unit-testing',
                        element: <UnitTesting />,
                    },
                    {
                        path: 'qi',
                        element: <QI />,
                    },
                    {
                        path: 'packing',
                        element: <Packing />,
                    },
                    {
                        path: 'rework',
                        element: <ReworkBackend />,
                    },
                    {
                        path: 'debug',
                        element: <DebugBackend />,
                    },
                    {
                        path: 'track-items',
                        element: <TrackItems />,
                    },
                ]
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
                        path: 'pcb-generation',
                        element: <PCBGeneration />,
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
                        path: 'pre-aoi',
                        element: <PreAoi />,
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
                        path: 'smt-fg',
                        element: <SMTFG />,
                    },
                    {
                        path: 'track-items',
                        element: <SmtTrackItems />,
                    },

                ]
            },
        ],
    },
]);
