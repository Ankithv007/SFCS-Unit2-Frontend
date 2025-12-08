import React from 'react';
import { Outlet } from 'react-router-dom';
import { ToastProvider } from './Toast';

export const Layout: React.FC = () => {
    return (
        <ToastProvider>
            <Outlet />
        </ToastProvider>
    );
};
