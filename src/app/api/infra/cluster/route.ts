import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit } from '@/src/lib/rateLimit';
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
    const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || headersList.get('x-real-ip') || 'unknown';
    const limit = checkRateLimit(ip, {
        maxRequests: 30,
        windowSeconds: 60,
        bucketName: 'infra-cluster',
        blockDurationSeconds: 60,
    });
    if (!limit.allowed) {
        return NextResponse.json({ success: false, error: limit.message }, { status: 429 });
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

        // Find all reports within 15m radius in the last 48 hours using PostGIS
        const windowStart = new Date(Date.now() - CLUSTER_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

        // Use raw SQL via RPC for PostGIS spatial query
        // If PostGIS is not available, fall back to bounding box approximation
        let nearbyReports: any[] = [];

        try {
            // Try PostGIS first (preferred)
            const { data: spatialData, error: spatialError } = await supabase.rpc(
                'find_nearby_infra_reports',
                {
                    target_lng: parsedLng,
                    target_lat: parsedLat,
                    radius_meters: CLUSTER_RADIUS_METERS,
                    since: windowStart,
                }
            );

            if (!spatialError && spatialData) {
                nearbyReports = spatialData;
            } else {
                throw new Error('PostGIS RPC not available, falling back');
            }
        } catch {
            // Fallback: bounding box approximation (works without PostGIS)
            // ~15m ≈ 0.000135° latitude, longitude varies but similar at equator
            const latDelta = 0.000135;
            const lngDelta = 0.000135;

            const { data: fallbackData } = await supabase
                .from('nadi_infra_reports')
                .select('id, lat, lng, device_fingerprint, user_id, cluster_id, created_at')
                .gte('created_at', windowStart)
                .gte('lat', String(parsedLat - latDelta))
                .lte('lat', String(parsedLat + latDelta))
                .gte('lng', String(parsedLng - lngDelta))
                .lte('lng', String(parsedLng + lngDelta))
                .neq('id', reportId);

            nearbyReports = fallbackData || [];
        }

        // Count unique devices/users (include current report)
        const uniqueDevices = new Set<string>();
        if (deviceFingerprint) {
            uniqueDevices.add(deviceFingerprint);
        } else {
            uniqueDevices.add(reportId); // fallback: use report ID as unique identifier
        }

        let existingClusterId: string | null = null;

        for (const report of nearbyReports) {
            if (report.id === reportId) continue;
            const fingerprint = report.device_fingerprint || report.user_id || report.id;
            uniqueDevices.add(fingerprint);
            if (report.cluster_id) {
                existingClusterId = report.cluster_id;
            }
        }

        const uniqueCount = uniqueDevices.size;
        const isVerified = uniqueCount >= threshold;

        // Generate or reuse cluster_id
        const clusterId = existingClusterId || crypto.randomUUID();

        // Assign cluster_id to the current report
        await supabase
            .from('nadi_infra_reports')
            .update({ cluster_id: clusterId })
            .eq('id', reportId);

        // If threshold is met, verify all reports in the cluster
        if (isVerified) {
            // Update all nearby reports with the same cluster_id and verified status
            const allIds = [reportId, ...nearbyReports.map((r: any) => r.id)];
            await supabase
                .from('nadi_infra_reports')
                .update({ cluster_id: clusterId, status: 'verified' })
                .in('id', allIds);
        }

        return NextResponse.json({
            success: true,
            cluster: {
                clusterId,
                uniqueDevices: uniqueCount,
                threshold,
                isUrban: isUrban(parsedLat, parsedLng),
                isVerified,
                nearbyCount: nearbyReports.length,
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
