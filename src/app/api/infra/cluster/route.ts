/**
 * Crowdsource Spatial Clustering API
 * 
 * Groups nearby pothole reports within a 15-meter radius (PostGIS ST_DWithin)
 * and automatically marks defects as verified when confirmed by multiple users:
 * - Urban zones (Kota Bharu center): 3 unique users
 * - Rural zones: 2 unique users
 *
 * Called by PotholeDetectorContext after each detection insert. Coordinates are read
 * from the stored report, never from the request body.
 */
import { NextResponse } from 'next/server';
import { checkInfraClusterLimit, getClientIp, addRateLimitHeaders } from '@/src/lib/rateLimit';
import { headers } from 'next/headers';
import { requireServerAuth } from '@/src/lib/auth/serverAuth';

// Approximate coordinates for Kota Bharu urban center
const KOTA_BHARU_BOUNDS = {
    minLat: 6.08,
    maxLat: 6.18,
    minLng: 102.22,
    maxLng: 102.30,
};

const URBAN_THRESHOLD = 3; // Unique users required in urban areas
const RURAL_THRESHOLD = 2; // Unique users required in rural areas

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

    // Enforce server-side caller authentication before executing spatial clustering RPC (CWE-862)
    const { user, adminSupa, errorResponse } = await requireServerAuth(request);
    if (errorResponse) {
        return errorResponse;
    }

    try {
        const body = await request.json();
        const { reportId } = body;

        if (typeof reportId !== 'string' || !reportId) {
            return NextResponse.json(
                { success: false, error: 'Missing required field: reportId' },
                { status: 400 }
            );
        }

        // Only the report's owner may cluster it, at the location it was stored with
        const { data: report } = await adminSupa
            .from('nadi_infra_reports')
            .select('lat, lng, device_fingerprint, user_id')
            .eq('id', reportId)
            .maybeSingle();

        if (!report || report.user_id !== user.id) {
            return NextResponse.json({ success: false, error: 'Report not found' }, { status: 404 });
        }

        const parsedLat = parseFloat(report.lat);
        const parsedLng = parseFloat(report.lng);
        if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
            return NextResponse.json({ success: false, error: 'Report has no valid location' }, { status: 400 });
        }
        const threshold = isUrban(parsedLat, parsedLng) ? URBAN_THRESHOLD : RURAL_THRESHOLD;

        // Executes atomic spatial clustering stored procedure
        const { data: rpcData, error: rpcError } = await adminSupa.rpc('atomic_cluster_pothole', {
            p_report_id: reportId,
            p_lat: parsedLat,
            p_lng: parsedLng,
            p_fingerprint: report.device_fingerprint,
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
