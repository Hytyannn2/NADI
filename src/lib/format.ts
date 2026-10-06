/**
 * Shared display formatters (relative/exact report time, distance).
 */

/** "Baru sahaja" / "5 minit lalu" / "3 jam lalu" / "2 hari lalu", then a short date after 7 days. Empty/invalid input → `fallback`. */
export function formatReportRelative(dateInput?: string | number | Date, isMs = true, fallback = ''): string {
    if (!dateInput) return fallback;
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return fallback;
    const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diffSec < 45) return isMs ? 'Baru sahaja' : 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return isMs ? `${diffMin} minit lalu` : `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return isMs ? `${diffHours} jam lalu` : `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return isMs ? `${diffDays} hari lalu` : `${diffDays}d ago`;
    return d.toLocaleDateString(isMs ? 'ms-MY' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatReportExact(dateInput?: string | number | Date, isMs = true): string {
    if (!dateInput) return '';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString(isMs ? 'ms-MY' : 'en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
}

/** Great-circle distance in km, unrounded (use for threshold checks). */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = Math.PI / 180;
    const dLat = (lat2 - lat1) * toRad;
    const dLon = (lon2 - lon1) * toRad;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Distance in km rounded to 0.1 for display/sorting. */
export function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    return Math.round(haversineKm(lat1, lon1, lat2, lon2) * 10) / 10;
}
