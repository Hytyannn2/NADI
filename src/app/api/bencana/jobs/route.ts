import { NextResponse } from 'next/server';
import { createClient } from '@/src/utils/supabase/server';
import { cookies } from 'next/headers';
import Groq from 'groq-sdk';

// GET /api/bencana/jobs — fetch volunteer jobs
export async function GET() {
    try {
        const supabase = createClient(await cookies());
        const { data, error } = await supabase
            .from('nadi_bencana_jobs')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        return NextResponse.json({ success: true, jobs: data });
    } catch (err) {
        return NextResponse.json({ success: false, jobs: [] });
    }
}

// POST /api/bencana/jobs — submit, accept, or cancel a volunteer job
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, jobId, name, req, dist, area, phone, tools, pax, priority: userPriority } = body;

        const supabase = createClient(await cookies());
        const { data: { user } } = await supabase.auth.getUser();

        // Accept a job
        if (action === 'accept' && jobId) {
            if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
            const { data, error } = await supabase
                .from('nadi_bencana_jobs')
                .update({ status: 'accepted' })
                .eq('id', jobId)
                .select()
                .single();
                
            if (error) return NextResponse.json({ success: false, error: 'Job not found or error.' }, { status: 404 });
            return NextResponse.json({ success: true, job: data });
        }

        // Cancel a job
        if (action === 'cancel' && jobId) {
            if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
            const { error } = await supabase
                .from('nadi_bencana_jobs')
                .delete()
                .eq('id', jobId);
                
            if (error) return NextResponse.json({ success: false, error: 'Job not found.' }, { status: 404 });
            return NextResponse.json({ success: true });
        }

        // Submit new job with AI-generated priority
        if (action === 'submit') {
            if (!name || !req) return NextResponse.json({ success: false, error: 'Name and request are required.' }, { status: 400 });

            let fullReq = req;
            if (phone) fullReq += ` | Phone: ${phone}`;
            if (tools) fullReq += ` | Tools: ${tools}`;
            if (pax) fullReq += ` | Pax: ${pax}`;

            let priority = userPriority || 'Medium';
            let bounty = 30;
            try {
                const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });
                const result = await groq.chat.completions.create({
                    messages: [{
                        role: 'user',
                        content: `You are a disaster relief coordinator for Malaysia's NADI Bencana (flood/crisis response) system.
A victim needs help: "${fullReq}" for household "${name}" in area "${area || 'unknown'}".
Assess this request and respond with JSON:
{
  "bountyPoints": <integer between 20-100, reflecting urgency>,
  "category": "Mud Cleanup/Furniture Moving/Medical/Supply Delivery/Evacuation/Other"
}`
                    }],
                    model: 'llama-3.3-70b-versatile',
                    response_format: { type: 'json_object' },
                });
                const data = JSON.parse(result.choices[0]?.message?.content || '{}');
                bounty = data.bountyPoints || 30;
            } catch {
                // fallback defaults
            }

            if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

            const newJob = {
                name,
                dist: dist || 'Unknown',
                req: fullReq,
                status: 'open',
                bounty,
                area: area || 'Unknown',
                priority,
            };
            
            const { data, error } = await supabase
                .from('nadi_bencana_jobs')
                .insert(newJob)
                .select()
                .single();
                
            if (error) throw error;

            return NextResponse.json({ success: true, job: data });
        }

        return NextResponse.json({ success: false, error: 'Unknown action.' }, { status: 400 });
    } catch (error) {
        console.error('Bencana jobs error:', error);
        return NextResponse.json({ success: false, error: 'Operation failed.' }, { status: 500 });
    }
}
