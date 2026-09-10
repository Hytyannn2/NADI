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

// In-memory fallback cache for jobs and local vendors
let IN_MEMORY_JOBS: any[] = [];
let IN_MEMORY_VENDORS: any[] = [];

// GET: Fetches local job postings and small business vendor listings
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const locationParam = searchParams.get('location') || '';

    try {
        const adminSupa = getAdminSupabase();

        const { data: dbJobs, error: jobsError } = await adminSupa
            .from('nadi_jobs')
            .select('*')
            .order('created_at', { ascending: false });

        const { data: dbVendors, error: vendorsError } = await adminSupa
            .from('nadi_vendors')
            .select('*')
            .order('created_at', { ascending: false });

        const allJobs = [
            ...(dbJobs || []),
            ...IN_MEMORY_JOBS
        ];

        const allVendors = [
            ...(dbVendors || []),
            ...IN_MEMORY_VENDORS
        ];

        // Deduplicate records by unique ID
        const uniqueJobs = Array.from(new Map(allJobs.map(j => [j.id, j])).values());
        const uniqueVendors = Array.from(new Map(allVendors.map(v => [v.id, v])).values());

        return NextResponse.json({
            success: true,
            location: locationParam || 'Malaysia',
            jobs: uniqueJobs,
            vendors: uniqueVendors
        });
    } catch (err: any) {
        return NextResponse.json({
            success: true,
            location: locationParam || 'Malaysia',
            jobs: IN_MEMORY_JOBS,
            vendors: IN_MEMORY_VENDORS
        });
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
                userId: user.id,
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
                console.warn('Supabase insert notice, saved to local store:', error.message);
                IN_MEMORY_JOBS.unshift(newJob);
                const res = NextResponse.json({ success: true, job: newJob });
                return addRateLimitHeaders(res, limit);
            }
            const res = NextResponse.json({ success: true, job: data });
            return addRateLimitHeaders(res, limit);
        } else if (itemType === 'vendor') {
            const newVendor = {
                id: `vendor-${Date.now()}`,
                userId: user.id,
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
                console.warn('Supabase vendor insert notice, saved to local store:', error.message);
                IN_MEMORY_VENDORS.unshift(newVendor);
                const res = NextResponse.json({ success: true, vendor: newVendor });
                return addRateLimitHeaders(res, limit);
            }
            const res = NextResponse.json({ success: true, vendor: data });
            return addRateLimitHeaders(res, limit);
        }

        const errRes = NextResponse.json({ success: false, error: 'Jenis item tidak sah.' }, { status: 400 });
        return addRateLimitHeaders(errRes, limit);
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err?.message || 'Gagal' }, { status: 500 });
    }
}
