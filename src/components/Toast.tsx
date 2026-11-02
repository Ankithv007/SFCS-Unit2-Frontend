import React, { createContext, useContext, useState, useCallback } from 'react';
import clsx from 'clsx';
import styles from './Toast.module.css';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    showToast: (message: string, type: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    // Use a ref to track the last toast message and time to prevent duplicates
    const lastToastRef = React.useRef<{ message: string; time: number } | null>(null);

    const showToast = useCallback((message: string, type: ToastType) => {
        const now = Date.now();

        // Prevent showing the same message multiple times within 2 seconds (deduplication)
        if (lastToastRef.current &&
            lastToastRef.current.message === message &&
            now - lastToastRef.current.time < 2000) {
            return;
        }

        lastToastRef.current = { message, time: now };
        const id = now.toString();

        // Add new toast to the list
        setToasts((prev) => [...prev, { id, message, type }]);

        // Automatically remove the toast after 3 seconds
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 3000);
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className={styles.container}>
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={clsx(styles.toast, styles[toast.type])}
                        role="alert"
                    >
                        {toast.message}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};
