import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { ToastProvider } from './Toast';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const Layout: React.FC = () => {
    const location = useLocation();
    const publicPaths = ['/login', '/signup', '/forgot', '/'];
    const showSidebar = !publicPaths.includes(location.pathname);
    const [isSidebarExpanded, setIsSidebarExpanded] = React.useState(false);
    const [isPinned, setIsPinned] = React.useState(false);

    const toggleSidebar = () => {
        setIsPinned(!isPinned);
    };

    // Sidebar is expanded if it's pinned OR if it's hovered
    const isExpanded = isPinned || isSidebarExpanded;

    return (
        <ToastProvider>
            <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-main)' }}>
                {showSidebar && <Header onToggleSidebar={toggleSidebar} />}
                <div style={{ display: 'flex' }}>
                    {showSidebar && (
                        <Sidebar
                            isExpanded={isExpanded}
                            onMouseEnter={() => setIsSidebarExpanded(true)}
                            onMouseLeave={() => setIsSidebarExpanded(false)}
                        />
                    )}
                    <div style={{
                        flex: 1,
                        marginLeft: showSidebar ? (isExpanded ? '266px' : '76px') : '0', // 250+8+8 vs 60+8+8
                        marginTop: showSidebar ? '88px' : '0', // 72px height + 8px top + 8px gap
                        minHeight: showSidebar ? 'calc(100vh - 88px)' : '100vh',
                        transition: 'margin-left 0.3s ease',
                        padding: showSidebar ? '0 8px 8px 0' : '0'
                    }}>
                        <Outlet />
                    </div>
                </div>
            </div>
        </ToastProvider>
    );
};
