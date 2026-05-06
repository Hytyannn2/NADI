import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/transit/nearby?lat=X&lng=Y
 * 
 * Uses the Overpass API (OpenStreetMap) to find real public transport stops
 * near the user's coordinates. Returns bus stops, train stations, 
 * MRT/LRT stations, etc.
 */

interface TransitStop {
    id: string;
    name: string;
    type: 'bus_stop' | 'train_station' | 'tram_stop' | 'ferry_terminal' | 'taxi_stand';
    lat: number;
    lng: number;
    distance: number; // in meters
    operator?: string;
    route?: string;
    network?: string;
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function classifyStop(tags: Record<string, string>): TransitStop['type'] {
    const highway = tags.highway || '';
    const railway = tags.railway || '';
    const amenity = tags.amenity || '';
    const publicTransport = tags.public_transport || '';

    if (railway === 'station' || railway === 'halt' || publicTransport === 'station') return 'train_station';
    if (railway === 'tram_stop') return 'tram_stop';
    if (amenity === 'ferry_terminal') return 'ferry_terminal';
    if (amenity === 'taxi') return 'taxi_stand';
    return 'bus_stop';
}

function getTypeLabel(type: TransitStop['type']): string {
    switch (type) {
        case 'train_station': return 'Train/LRT/MRT';
        case 'tram_stop': return 'Tram';
        case 'ferry_terminal': return 'Ferry';
        case 'taxi_stand': return 'Taxi';
        default: return 'Bus';
    }
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get('lat') || '0');
    const lng = parseFloat(searchParams.get('lng') || '0');
    const radius = parseInt(searchParams.get('radius') || '2000'); // default 2km radius

    if (!lat || !lng) {
        return NextResponse.json({ success: false, error: 'Missing lat/lng parameters' }, { status: 400 });
    }

    try {
        // Overpass QL query for nearby public transport stops
        const query = `
            [out:json][timeout:15];
            (
                node["highway"="bus_stop"](around:${radius},${lat},${lng});
                node["public_transport"="stop_position"](around:${radius},${lat},${lng});
                node["public_transport"="platform"](around:${radius},${lat},${lng});
                node["railway"="station"](around:${radius},${lat},${lng});
                node["railway"="halt"](around:${radius},${lat},${lng});
                node["railway"="tram_stop"](around:${radius},${lat},${lng});
                node["amenity"="ferry_terminal"](around:${radius},${lat},${lng});
                node["amenity"="bus_station"](around:${radius},${lat},${lng});
                node["public_transport"="station"](around:${radius},${lat},${lng});
            );
            out body;
        `;

        const res = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `data=${encodeURIComponent(query)}`,
            signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) {
            throw new Error(`Overpass API returned ${res.status}`);
        }

        const data = await res.json();

        if (!data.elements || data.elements.length === 0) {
            return NextResponse.json({
                success: true,
                stops: [],
                total: 0,
                message: 'No public transport stops found nearby',
            });
        }

        // Parse and deduplicate stops
        const seenNames = new Set<string>();
        const stops: TransitStop[] = [];

        for (const el of data.elements) {
            if (!el.lat || !el.lon) continue;
            const tags = el.tags || {};
            const name = tags.name || tags.description || tags.ref || `Stop #${el.id}`;

            // Deduplicate by name (some stops have multiple nodes)
            const dedupeKey = `${name}-${classifyStop(tags)}`;
            if (seenNames.has(dedupeKey)) continue;
            seenNames.add(dedupeKey);

            const distance = haversineDistance(lat, lng, el.lat, el.lon);

            stops.push({
                id: el.id.toString(),
                name,
                type: classifyStop(tags),
                lat: el.lat,
                lng: el.lon,
                distance: Math.round(distance),
                operator: tags.operator || tags.network || undefined,
                route: tags.route_ref || tags.ref || undefined,
                network: tags.network || undefined,
            });
        }

        // Sort by distance
        stops.sort((a, b) => a.distance - b.distance);

        // Limit to 20 nearest
        const limited = stops.slice(0, 20);

        return NextResponse.json({
            success: true,
            stops: limited,
            total: stops.length,
            radius,
            typeLabel: getTypeLabel,
        });

    } catch (error: any) {
        console.error('Transit API error:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to fetch nearby transit data',
            stops: [],
            total: 0,
        }, { status: 500 });
    }
}
