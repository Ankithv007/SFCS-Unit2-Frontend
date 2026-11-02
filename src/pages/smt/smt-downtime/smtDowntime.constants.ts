export const SHIFTS = [
    'Shift A',
    'Shift B',
    'Shift C',
    'General Shift'
];

export const LINES = [
    'Line 1',
    'Line 2',
    'Line 3'
];

export const MACHINES = [
    'Laser Marker',
    'Printer',
    'SPI',
    'Pick & Place',
    'AOI',
    'Reflow'
];

export const DOWNTIME_CATEGORIES = [
    'Planned',
    'Unplanned'
];

export const REASON_CODES = [
    'Quality Issue',
    'NPI Issue',
    'Setup',
    'Program Change',
    'Power Failure',
    'Material Shortage',
    'Breakdown'
];

export const CHART_PALETTE = {
    category: ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'],
    machine: ['#2563eb', '#0284c7', '#0d9488', '#059669', '#d97706', '#7c3aed'],
    shift: ['#6366f1', '#ec4899', '#14b8a6', '#f97316'],
    status: ['#ef4444', '#10b981', '#64748b']
};

export interface OeeBenchmark {
    label: string;
    badge: string;
    color: string;
    bg: string;
    border: string;
    description: string;
}

export const getOeeBenchmark = (score: number): OeeBenchmark => {
    if (score >= 85) {
        return {
            label: 'World Class',
            badge: '★ World Class',
            color: '#10b981',
            bg: '#f0fdf4',
            border: '#bbf7d0',
            description: 'World Class manufacturing efficiency (≥ 85%)'
        };
    }
    if (score >= 75) {
        return {
            label: 'Good',
            badge: '✓ Good',
            color: '#2563eb',
            bg: '#eff6ff',
            border: '#bfdbfe',
            description: 'Good operational performance (75% – 84.9%)'
        };
    }
    if (score >= 60) {
        return {
            label: 'Average',
            badge: '⚠ Average',
            color: '#d97706',
            bg: '#fffbeb',
            border: '#fde68a',
            description: 'Average efficiency – improvement needed (60% – 74.9%)'
        };
    }
    return {
        label: 'Critical',
        badge: '✖ Critical',
        color: '#dc2626',
        bg: '#fef2f2',
        border: '#fecaca',
        description: 'Critical low performance – requires immediate action (< 60%)'
    };
};
