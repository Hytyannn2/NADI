/**
 * Community Economy & Local Directory API
 * 
 * Manages local job postings (fair-wage filtered) and micro-vendor listings
 * across Malaysian neighborhoods.
 */
import { NextResponse } from 'next/server';
import { checkKomunitiLimit, getClientIp, addRateLimitHeaders } from '@/src/lib/rateLimit';
import { headers } from 'next/headers';
import { requireServerAuth, getAdminSupabase } from '@/src/lib/auth/serverAuth';

// GET: Fetches local job postings and small business vendor listings
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const locationParam = searchParams.get('location') || '';

    try {
        const adminSupa = getAdminSupabase();

        // Service role skips RLS, so the spam filter (hidden, set by auto_hide_spammed) is applied here
        const { data: dbJobs, error: jobsError } = await adminSupa
            .from('nadi_jobs')
            .select('*')
            .eq('hidden', false)
            .order('created_at', { ascending: false });

        const { data: dbVendors, error: vendorsError } = await adminSupa
            .from('nadi_vendors')
            .select('*')
            .eq('hidden', false)
            .order('created_at', { ascending: false });

        if (jobsError || vendorsError) {
            console.error('[api/komuniti] read failed:', jobsError?.message, vendorsError?.message);
            return NextResponse.json({ success: false, error: 'Gagal memuatkan data komuniti.' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            location: locationParam || 'Malaysia',
            jobs: dbJobs ?? [],
            vendors: dbVendors ?? []
        });
    } catch (err) {
        console.error('[api/komuniti] GET error:', err);
        return NextResponse.json({ success: false, error: 'Gagal memuatkan data komuniti.' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const headersList = await headers();
    const ip = getClientIp(headersList);
    const limit = checkKomunitiLimit(ip);
    if (!limit.allowed) {
        const errRes = NextResponse.json({ success: false, error: limit.message, retryAfter: limit.retryAfterSeconds }, { status: 429 });
        return addRateLimitHeaders(errRes, limit);
    }

    try {
        // Enforce Server-Side Caller Authentication (CWE-862 Remediation)
        const { user, adminSupa, errorResponse } = await requireServerAuth(request);
        if (errorResponse) {
            return errorResponse;
        }

        const body = await request.json();
        const { itemType, ...itemData } = body;

        if (itemType === 'job') {
            const newJob = {
                id: `job-${Date.now()}`,
                user_id: user.id,
                title: itemData.title,
                employer: itemData.employer,
                location: itemData.location,
                district: itemData.district || itemData.location,
                state: itemData.state || 'Malaysia',
                lat: Number(itemData.lat) || 0,
                lng: Number(itemData.lng) || 0,
                wageMYR: Number(itemData.wageMYR) || 0,
                wageType: itemData.wageType || 'monthly',
                category: itemData.category || 'Runcit',
                description: itemData.description,
                applyUrl: itemData.applyUrl || '',
                whatsapp: itemData.whatsapp || '',
                isFairWage: Number(itemData.wageMYR) >= (itemData.wageType === 'hourly' ? 7.5 : itemData.wageType === 'daily' ? 60 : 1700),
                postedAt: Date.now(),
            };

            const { data, error } = await adminSupa.from('nadi_jobs').insert(newJob).select().single();
            if (error) {
                console.error('[api/komuniti] nadi_jobs insert failed:', error.message);
                return NextResponse.json({ success: false, error: 'Gagal menyimpan iklan kerja.' }, { status: 500 });
            }
            const res = NextResponse.json({ success: true, job: data });
            return addRateLimitHeaders(res, limit);
        } else if (itemType === 'vendor') {
            const newVendor = {
                id: `vendor-${Date.now()}`,
                user_id: user.id,
                name: itemData.name,
                category: itemData.category || 'Makanan',
                location: itemData.location,
                district: itemData.district || itemData.location,
                state: itemData.state || 'Malaysia',
                lat: Number(itemData.lat) || 0,
                lng: Number(itemData.lng) || 0,
                description: itemData.description,
                whatsapp: itemData.whatsapp || '',
                rating: null,
                reviews: 0,
                operatingHours: itemData.operatingHours || '8:00 AM - 6:00 PM',
            };

            const { data, error } = await adminSupa.from('nadi_vendors').insert(newVendor).select().single();
            if (error) {
                console.error('[api/komuniti] nadi_vendors insert failed:', error.message);
                return NextResponse.json({ success: false, error: 'Gagal menyimpan peniaga.' }, { status: 500 });
            }
            const res = NextResponse.json({ success: true, vendor: data });
            return addRateLimitHeaders(res, limit);
        }

        const errRes = NextResponse.json({ success: false, error: 'Jenis item tidak sah.' }, { status: 400 });
        return addRateLimitHeaders(errRes, limit);
    } catch (err) {
        return NextResponse.json({ success: false, error: (err instanceof Error && err.message) || 'Gagal' }, { status: 500 });
    }
}
