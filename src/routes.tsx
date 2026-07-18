import { createBrowserRouter, Navigate, Outlet, useParams } from 'react-router-dom';
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
import PostAoi from './pages/smt/PostAoi';
import Rework from './pages/smt/Rework';
import PreAoi from './pages/smt/PreAoi';
import SMTFG from './pages/smt/SMTFG';
import SmtTrackItems from './pages/smt/SmtTrackItems';
import SmtDowntimeTracker from './pages/smt/SmtDowntimeTracker';
import SolderPasteManagement from './pages/smt/SolderPasteManagement';
import Document from './pages/smt/Document';
import BomView from './pages/smt/BomView';
import MaterialManagement from './pages/smt/MaterialManagement';
import MaterialBomView from './pages/smt/MaterialBomView';
import MsdTracker from './pages/smt/MsdTracker';
import MsdBomView from './pages/smt/MsdBomView';
import StencilMasterRecord from './pages/smt/StencilMasterRecord';
import StencilLifecycleManagement from './pages/smt/StencilLifecycleManagement';
import BakingTrackingRecord from './pages/smt/BakingTrackingRecord';

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
import { SmtProtectedRoute } from './components/SmtProtectedRoute';
const LegacyReturnBomRedirect: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    return <Navigate to={`/smt/material-management/bom-view/${id}`} replace />;
};

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
                path: '/admin-panel/create-user',
                element: (
                    <ProtectedRoute>
                        <AdminPanel />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/admin-panel/create-department',
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
                path: '/backend',
                element: (
                    <ProtectedRoute>
                        <BackendProtectedRoute children={<Outlet />} />
                    </ProtectedRoute>
                ),
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
                path: '/smt',
                element: (
                    <ProtectedRoute>
                        <SmtProtectedRoute children={<Outlet />} />
                    </ProtectedRoute>
                ),
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
                        path: 'solder-paste',
                        element: <SolderPasteManagement />,
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
                    {
                        path: 'downtime-tracker',
                        element: <SmtDowntimeTracker />,
                    },
                    {
                        path: 'qms',
                        element: <Document />,
                    },
                    {
                        path: 'qms/bom-view/:revisionId',
                        element: <BomView />,
                    },
                    {
                        path: 'material-management',
                        element: <MaterialManagement />,
                    },
                    {
                        path: 'material-management/requests',
                        element: <Navigate to="/smt/material-management" replace />,
                    },
                    {
                        path: 'material-management/return',
                        element: <Navigate to="/smt/material-management" replace />,
                    },
                    {
                        path: 'material-management/return/bom-view/:id',
                        element: <LegacyReturnBomRedirect />,
                    },
                    {
                        path: 'material-management/bom-view/:id',
                        element: <MaterialBomView />,
                    },
                    {
                        path: 'msd-tracker',
                        element: <MsdTracker />,
                    },
                    {
                        path: 'msd-tracker/bom-view/:id',
                        element: <MsdBomView />,
                    },
                    {
                        path: 'stencil/master',
                        element: <StencilMasterRecord />,
                    },
                    {
                        path: 'stencil/lifecycle',
                        element: <StencilLifecycleManagement />,
                    },
                    {
                        path: 'baking-tracking',
                        element: <BakingTrackingRecord />,
                    },

                ]
            },
        ],
    },
]);
