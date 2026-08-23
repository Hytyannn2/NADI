import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkInfraClusterLimit, getClientIp, addRateLimitHeaders } from '@/src/lib/rateLimit';
import { headers } from 'next/headers';

// ============================================
// NADI Crowdsource Clustering API
// ============================================
// When a new pothole report is submitted, this API:
// 1. Finds all pending reports within 15m radius (PostGIS ST_DWithin)
// 2. Counts unique user devices in the cluster
// 3. Auto-verifies if threshold is met:
//    - Urban (Kota Bharu bounding box): 3 unique devices
//    - Rural: 2 unique devices
// 4. Assigns a shared cluster_id to all reports in the group
// ============================================

// Kota Bharu Urban Bounding Box (approximate city center + surrounding areas)
const KOTA_BHARU_BOUNDS = {
    minLat: 6.08,
    maxLat: 6.18,
    minLng: 102.22,
    maxLng: 102.30,
};

const CLUSTER_RADIUS_METERS = 15;
const CLUSTER_WINDOW_HOURS = 48;
const URBAN_THRESHOLD = 3; // unique devices needed in urban area
const RURAL_THRESHOLD = 2; // unique devices needed in rural area

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

        // Use service role key for server-side operations
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const parsedLat = typeof lat === 'string' ? parseFloat(lat) : lat;
        const parsedLng = typeof lng === 'string' ? parseFloat(lng) : lng;
        const threshold = isUrban(parsedLat, parsedLng) ? URBAN_THRESHOLD : RURAL_THRESHOLD;

        // Execute the atomic spatial clustering transaction
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
