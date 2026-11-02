/**
 * Formats a date string or object into India Standard Time (IST)
 * Format: DD/MM/YYYY hh:mm:ss AM/PM
 */
export const formatIST = (dateInput: any): string => {
    if (!dateInput) return 'N/A';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return 'N/A';

    try {
        const formatter = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });

        const parts = formatter.formatToParts(date);
        const d = parts.find(p => p.type === 'day')?.value;
        const mo = parts.find(p => p.type === 'month')?.value;
        const y = parts.find(p => p.type === 'year')?.value;
        const h = parts.find(p => p.type === 'hour')?.value;
        const mi = parts.find(p => p.type === 'minute')?.value;
        const s = parts.find(p => p.type === 'second')?.value;
        const dayPeriod = parts.find(p => p.type === 'dayPeriod')?.value.toUpperCase() || '';

        return `${d}/${mo}/${y} ${h}:${mi}:${s} ${dayPeriod}`;
    } catch (error) {
        console.error('Error formatting IST date:', error);
        return String(dateInput);
    }
};
