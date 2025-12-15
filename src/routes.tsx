import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Forgot } from './pages/Forgot';
import { Dashboard } from './pages/Dashboard';
import { PurchaseOrder } from './pages/PurchaseOrder';
import { WipStack } from './pages/WipStack';
import { ReturnWip } from './pages/ReturnWip';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';

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
        ],
    },
]);
