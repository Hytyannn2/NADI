import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function getAdminSupabase() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dxexikpuezslryywhnnf.supabase.co';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4ZXhpa3B1ZXpzbHJ5eXdobm5mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM0NDQxOSwiZXhwIjoyMDkyOTIwNDE5fQ.kxdMDFBbVehjKCsIRfgyhebLeu-vUP2D2sAjNywMOQE';
    return createSupabaseClient(supabaseUrl, serviceKey);
}

// In-memory store for newly advertised community jobs & vendors if DB is migrating
let IN_MEMORY_JOBS: any[] = [];
let IN_MEMORY_VENDORS: any[] = [];

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const locationParam = searchParams.get('location') || '';

    try {
        const adminSupa = getAdminSupabase();

        // 100% Community & Employer Advertised Data from Supabase
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

        // Deduplicate by ID
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
    try {
        const body = await request.json();
        const { itemType, ...itemData } = body;

        const adminSupa = getAdminSupabase();

        if (itemType === 'job') {
            const newJob = {
                id: `job-${Date.now()}`,
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
                return NextResponse.json({ success: true, job: newJob });
            }
            return NextResponse.json({ success: true, job: data });
        } else if (itemType === 'vendor') {
            const newVendor = {
                id: `vendor-${Date.now()}`,
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
                return NextResponse.json({ success: true, vendor: newVendor });
            }
            return NextResponse.json({ success: true, vendor: data });
        }

        return NextResponse.json({ success: false, error: 'Jenis item tidak sah.' }, { status: 400 });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err?.message || 'Gagal' }, { status: 500 });
    }
}
