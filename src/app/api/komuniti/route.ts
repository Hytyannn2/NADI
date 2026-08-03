import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function getAdminSupabase() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dxexikpuezslryywhnnf.supabase.co';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4ZXhpa3B1ZXpzbHJ5eXdobm5mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM0NDQxOSwiZXhwIjoyMDkyOTIwNDE5fQ.kxdMDFBbVehjKCsIRfgyhebLeu-vUP2D2sAjNywMOQE';
    return createSupabaseClient(supabaseUrl, serviceKey);
}

// Memory cache for runtime additions if table creation pending
let IN_MEMORY_JOBS: any[] = [
    {
        id: 'j1', title: 'Pembantu Kedai Runcit', employer: 'Kedai Runcit Mak Cik Zah',
        location: 'Kubang Kerian', wageMYR: 8.50, wageType: 'hourly', category: 'retail',
        postedAt: Date.now() - 86400000, whatsapp: '60179876543',
        description: 'Mencari pekerja sambilan untuk membantu di kedai runcit. Waktu fleksibel.',
        isFairWage: true
    },
    {
        id: 'j2', title: 'Tukang Masak Nasi Kerabu', employer: 'Warung Kak Ani',
        location: 'Kota Bharu', wageMYR: 60, wageType: 'daily', category: 'f&b',
        postedAt: Date.now() - 172800000, whatsapp: '60121234567',
        description: 'Perlukan tukang masak berpengalaman untuk waktu pagi (6AM-12PM).',
        isFairWage: true
    },
    {
        id: 'j3', title: 'Pemandu Grab/e-Hailing', employer: 'Grab Kelantan Hub',
        location: 'Kota Bharu', wageMYR: 2800, wageType: 'monthly', category: 'transport',
        postedAt: Date.now() - 259200000,
        description: 'Pendapatan anggaran RM2,800/bulan. Kereta sendiri diperlukan.',
        isFairWage: true
    },
];

let IN_MEMORY_VENDORS: any[] = [
    {
        id: 'v1', name: 'Keropok Lekor Mak Su', category: 'Makanan',
        location: 'Pantai Cahaya Bulan', description: 'Keropok lekor asli Terengganu, goreng panas setiap hari.',
        whatsapp: '60171234567', rating: 4.8, reviews: 142, operatingHours: '8AM - 6PM'
    },
    {
        id: 'v2', name: 'Batik Canting Kak Jah', category: 'Kraf Tangan',
        location: 'Kampung Kraftangan', description: 'Batik lukis tangan asli Kelantan. Tempahan khas untuk majlis.',
        whatsapp: '60129876543', rating: 4.9, reviews: 87, operatingHours: '9AM - 5PM'
    },
];

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
