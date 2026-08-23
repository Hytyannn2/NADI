/**
 * Crowdsource Spatial Clustering API
 * 
 * Groups nearby pothole reports within a 15-meter radius (PostGIS ST_DWithin)
 * and automatically marks defects as verified when confirmed by multiple devices:
 * - Urban zones (Kota Bharu center): 3 unique devices
 * - Rural zones: 2 unique devices
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkInfraClusterLimit, getClientIp, addRateLimitHeaders } from '@/src/lib/rateLimit';
import { headers } from 'next/headers';

// Approximate coordinates for Kota Bharu urban center
const KOTA_BHARU_BOUNDS = {
    minLat: 6.08,
    maxLat: 6.18,
    minLng: 102.22,
    maxLng: 102.30,
};

const CLUSTER_RADIUS_METERS = 15;
const CLUSTER_WINDOW_HOURS = 48;
const URBAN_THRESHOLD = 3; // Unique devices required in urban areas
const RURAL_THRESHOLD = 2; // Unique devices required in rural areas

function isUrban(lat: number, lng: number): boolean {
    return (
        lat >= KOTA_BHARU_BOUNDS.minLat &&
        lat <= KOTA_BHARU_BOUNDS.maxLat &&
        lng >= KOTA_BHARU_BOUNDS.minLng &&
        lng <= KOTA_BHARU_BOUNDS.maxLng
    );
}

export async function POST(request: Request) {
    // Rate limiting
    const headersList = await headers();
    const ip = getClientIp(headersList);
    const limit = checkInfraClusterLimit(ip);
    if (!limit.allowed) {
        const errRes = NextResponse.json({ success: false, error: limit.message, retryAfter: limit.retryAfterSeconds }, { status: 429 });
        return addRateLimitHeaders(errRes, limit);
    }

    try {
        const body = await request.json();
        const { reportId, lat, lng, deviceFingerprint } = body;

        if (!reportId || lat == null || lng == null) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields: reportId, lat, lng' },
                { status: 400 }
            );
        }

        // Uses Supabase service role key for server operations
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const parsedLat = typeof lat === 'string' ? parseFloat(lat) : lat;
        const parsedLng = typeof lng === 'string' ? parseFloat(lng) : lng;
        const threshold = isUrban(parsedLat, parsedLng) ? URBAN_THRESHOLD : RURAL_THRESHOLD;

        // Executes atomic spatial clustering stored procedure
        const { data: rpcData, error: rpcError } = await supabase.rpc('atomic_cluster_pothole', {
            p_report_id: reportId,
            p_lat: parsedLat,
            p_lng: parsedLng,
            p_fingerprint: deviceFingerprint || null,
            p_threshold: threshold
        });

        if (rpcError) {
            throw new Error(`Atomic RPC failed: ${rpcError.message}`);
        }

        const clusterData = rpcData as {
            clusterId: string;
            uniqueDevices: number;
            threshold: number;
            isVerified: boolean;
        };

        return NextResponse.json({
            success: true,
            cluster: {
                clusterId: clusterData.clusterId,
                uniqueDevices: clusterData.uniqueDevices,
                threshold: clusterData.threshold,
                isUrban: isUrban(parsedLat, parsedLng),
                isVerified: clusterData.isVerified,
            },
        });
    } catch (error) {
        console.error('Clustering error:', error);
        return NextResponse.json(
            { success: false, error: 'Clustering analysis failed' },
            { status: 500 }
        );
    }
}
