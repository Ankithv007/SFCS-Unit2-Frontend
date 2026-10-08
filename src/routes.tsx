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
import { WorkOrder } from './pages/smt/work-order/WorkOrder';
import { WorkOrderHistory } from './pages/smt/work-order-history/WorkOrderHistory';
import { SerialNumber } from './pages/smt/serial-number/SerialNumber';
import { Printing } from './pages/smt/printing/Printing';
import PostAoi from './pages/smt/post-aoi/PostAoi';
import Rework from './pages/smt/rework/Rework';
import PreAoi from './pages/smt/pre-aoi/PreAoi';
import Spi from './pages/smt/spi/Spi';
import SMTFG from './pages/smt/smt-fg/SMTFG';
import SmtTrackItems from './pages/smt/smt-track-items/SmtTrackItems';
import SmtDowntimeTracker from './pages/smt/smt-downtime/SmtDowntimeTracker';
import SolderPasteManagement from './pages/smt/solder-paste-management/SolderPasteManagement';
import Document from './pages/smt/document/Document';
import BomView from './pages/smt/bom-view/BomView';
import MaterialManagement from './pages/smt/material-management/MaterialManagement';
import MaterialBomView from './pages/smt/material-bom-view/MaterialBomView';
import MsdTracker from './pages/smt/msd-tracker/MsdTracker';
import MsdBomView from './pages/smt/msd-bom-view/MsdBomView';
import StencilLifecycleManagement from './pages/smt/stencil-lifecycle-management/StencilLifecycleManagement';
import BakingTrackingRecord from './pages/smt/baking-tracking-record/BakingTrackingRecord';
import StencilRackManagement from './pages/smt/stencil-rack-management/StencilRackManagement';
import StencilScan from './pages/smt/stencil-scan/StencilScan';
import { BomSplit } from './pages/bom-split/BomSplit';

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
import { RrhWorkOrder } from './pages/rrh/work-order/RrhWorkOrder';
import { RrhMasterView } from './pages/rrh/master-view/RrhMasterView';
import { RrhInward } from './pages/rrh/inward/RrhInward';
import { RrhIvi } from './pages/rrh/ivi/RrhIvi';
import { RrhIpqc } from './pages/rrh/ipqc/RrhIpqc';
import { RrhDebug } from './pages/rrh/debug/RrhDebug';
import { RrhTesting } from './pages/rrh/testing/RrhTesting';
import { RrhFqc } from './pages/rrh/fqc/RrhFqc';
import { RrhOba } from './pages/rrh/oba/RrhOba';
import { RrhPackagingOutgoingData } from './pages/rrh/packaging-outgoing-data/RrhPackagingOutgoingData';
import { RrhProgramming } from './pages/rrh/programming/RrhProgramming';
import { RrhPreBurnIn } from './pages/rrh/pre-burn-in/RrhPreBurnIn';
import { RrhHipot } from './pages/rrh/hipot/RrhHipot';
import { RrhPostBurnIn } from './pages/rrh/post-burn-in/RrhPostBurnIn';
import { RrhPacking } from './pages/rrh/packing/RrhPacking';
import { RrhShipment } from './pages/rrh/shipment/RrhShipment';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';

import { BackendProtectedRoute } from './components/BackendProtectedRoute';
import { SmtProtectedRoute } from './components/SmtProtectedRoute';

export { type SystemPageRoute, systemPagesConfig } from './constants/systemPages';


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
                path: '/bom-split',
                element: (
                    <ProtectedRoute>
                        <BomSplit />
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
                path: '/rrh',
                element: (
                    <ProtectedRoute>
                        <Outlet />
                    </ProtectedRoute>
                ),
                children: [
                    {
                        path: '',
                        element: <Navigate to="/rrh/work-order" replace />,
                    },
                    {
                        path: 'work-order',
                        element: <RrhWorkOrder />,
                    },
                    {
                        path: 'work-order/master-view/:id',
                        element: <RrhMasterView />,
                    },
                    {
                        path: 'inward',
                        element: <RrhInward />,
                    },
                    {
                        path: 'ivi',
                        element: <RrhIvi />,
                    },
                    {
                        path: 'ipqc',
                        element: <RrhIpqc />,
                    },
                    {
                        path: 'debug',
                        element: <RrhDebug />,
                    },
                    {
                        path: 'testing',
                        element: <RrhTesting />,
                    },
                    {
                        path: 'fqc',
                        element: <RrhFqc />,
                    },
                    {
                        path: 'oba',
                        element: <RrhOba />,
                    },
                    {
                        path: 'packaging-outgoing-data',
                        element: <RrhPackagingOutgoingData />,
                    },
                    // ECN Station Routes
                    {
                        path: 'ecn/ipqc',
                        element: <RrhIpqc />,
                    },
                    {
                        path: 'ecn/programming',
                        element: <RrhProgramming routeType="ECN" />,
                    },
                    {
                        path: 'ecn/pre-burn-in',
                        element: <RrhPreBurnIn routeType="ECN" />,
                    },
                    {
                        path: 'ecn/hipot',
                        element: <RrhHipot routeType="ECN" />,
                    },
                    {
                        path: 'ecn/post-burn-in',
                        element: <RrhPostBurnIn routeType="ECN" />,
                    },
                    {
                        path: 'ecn/fqc',
                        element: <RrhFqc routeType="ECN" />,
                    },
                    {
                        path: 'ecn/oba',
                        element: <RrhOba routeType="ECN" />,
                    },
                    {
                        path: 'ecn/packing',
                        element: <RrhPacking routeType="ECN" />,
                    },
                    {
                        path: 'ecn/shipment',
                        element: <RrhShipment routeType="ECN" />,
                    },
                    // Non-ECN Station Routes
                    {
                        path: 'non-ecn/post-burn-in-initial',
                        element: <RrhPostBurnIn routeType="Non-ECN" customTitle="RRH Post-Burn-in Test (Initial)" />,
                    },
                    {
                        path: 'non-ecn/programming',
                        element: <RrhProgramming routeType="Non-ECN" />,
                    },
                    {
                        path: 'non-ecn/pre-burn-in',
                        element: <RrhPreBurnIn routeType="Non-ECN" />,
                    },
                    {
                        path: 'non-ecn/hipot',
                        element: <RrhHipot routeType="Non-ECN" />,
                    },
                    {
                        path: 'non-ecn/post-burn-in',
                        element: <RrhPostBurnIn routeType="Non-ECN" />,
                    },
                    {
                        path: 'non-ecn/fqc',
                        element: <RrhFqc routeType="Non-ECN" />,
                    },
                    {
                        path: 'non-ecn/oba',
                        element: <RrhOba routeType="Non-ECN" />,
                    },
                    {
                        path: 'non-ecn/packing',
                        element: <RrhPacking routeType="Non-ECN" />,
                    },
                    {
                        path: 'non-ecn/shipment',
                        element: <RrhShipment routeType="Non-ECN" />,
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
                        path: 'spi',
                        element: <Spi />,
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
                        path: 'stencil/lifecycle',
                        element: <StencilLifecycleManagement />,
                    },
                    {
                        path: 'stencil/rack',
                        element: <StencilRackManagement />,
                    },
                    {
                        path: 'stencil/scan',
                        element: <StencilScan />,
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
