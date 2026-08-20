import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { SEED_JOBS, SEED_VENDORS } from '@/src/data/fallbacks';

function getAdminSupabase() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dxexikpuezslryywhnnf.supabase.co';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4ZXhpa3B1ZXpzbHJ5eXdobm5mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM0NDQxOSwiZXhwIjoyMDkyOTIwNDE5fQ.kxdMDFBbVehjKCsIRfgyhebLeu-vUP2D2sAjNywMOQE';
    return createSupabaseClient(supabaseUrl, serviceKey);
}

// Memory cache for runtime additions if table creation pending
let IN_MEMORY_JOBS = [...SEED_JOBS];
let IN_MEMORY_VENDORS = [...SEED_VENDORS];

export async function GET() {
    try {
        const adminSupa = getAdminSupabase();

        let { data: jobs, error: jobsError } = await adminSupa.from('nadi_jobs').select('*').order('created_at', { ascending: false });
        let { data: vendors, error: vendorsError } = await adminSupa.from('nadi_vendors').select('*').order('created_at', { ascending: false });

        if (jobsError || !jobs || jobs.length === 0) {
            jobs = IN_MEMORY_JOBS;
        }

        if (vendorsError || !vendors || vendors.length === 0) {
            vendors = IN_MEMORY_VENDORS;
        }

        return NextResponse.json({ success: true, jobs, vendors });
    } catch (err: any) {
        return NextResponse.json({ success: true, jobs: IN_MEMORY_JOBS, vendors: IN_MEMORY_VENDORS });
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
                wageMYR: Number(itemData.wageMYR),
                wageType: itemData.wageType || 'hourly',
                category: itemData.category || 'general',
                description: itemData.description,
                whatsapp: itemData.whatsapp || '',
                isFairWage: Number(itemData.wageMYR) >= (itemData.wageType === 'hourly' ? 6.5 : itemData.wageType === 'daily' ? 50 : 1500),
                postedAt: Date.now(),
            };

            const { data, error } = await adminSupa.from('nadi_jobs').insert(newJob).select().single();
            if (error) {
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
                description: itemData.description,
                whatsapp: itemData.whatsapp || '',
                rating: 5.0,
                reviews: 1,
                operatingHours: itemData.operatingHours || '8AM - 6PM',
            };

            const { data, error } = await adminSupa.from('nadi_vendors').insert(newVendor).select().single();
            if (error) {
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
