import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Forgot } from './pages/Forgot';
import { Dashboard } from './pages/Dashboard';
import { SalesPurchase } from './pages/SalesPurchase';
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
                path: '/sales-purchase',
                element: (
                    <ProtectedRoute>
                        <SalesPurchase />
                    </ProtectedRoute>
                ),
            },
        ],
    },
]);
