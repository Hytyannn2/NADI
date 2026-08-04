import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { createClient } from '@/src/utils/supabase/server';
import { cookies } from 'next/headers';
import Groq from 'groq-sdk';

// GET /api/bantuan/jobs — fetch volunteer jobs
export async function GET() {
    try {
        const supabase = createClient(await cookies());
        // SECURITY: Select explicit public fields only — exclude phone number PII from unauthenticated GET queries
        const { data, error } = await supabase
            .from('nadi_bencana_jobs')
            .select('id, name, req, dist, area, priority, tools, pax, status, bounty, created_at, posted_by, accepted_by')
            .neq('status', 'banned') // Filter out inappropriate requests
            .order('created_at', { ascending: false });

        if (error) throw error;
        return NextResponse.json({ success: true, jobs: data });
    } catch (err) {
        return NextResponse.json({ success: false, jobs: [] });
    }
}

// POST /api/bantuan/jobs — submit, accept, or cancel a volunteer job
export async function POST(request: Request) {
    try {
        // SECURITY: CSRF defense-in-depth — validate Origin/Referer using exact hostname comparison
        const origin = request.headers.get('origin');
        const referer = request.headers.get('referer');
        const host = request.headers.get('host')?.split(':')[0]; // strip port
        if (host) {
            try {
                if (origin) {
                    const originHost = new URL(origin).hostname;
                    if (originHost !== host && !originHost.endsWith('.' + host)) {
                        return NextResponse.json({ success: false, error: 'Forbidden: Cross-origin request detected.' }, { status: 403 });
                    }
                } else if (referer) {
                    const refererHost = new URL(referer).hostname;
                    if (refererHost !== host && !refererHost.endsWith('.' + host)) {
                        return NextResponse.json({ success: false, error: 'Forbidden: Cross-origin request detected.' }, { status: 403 });
                    }
                }
            } catch { /* malformed URL — allow request to proceed, auth will catch it */ }
        }

        const body = await request.json();
        const { action, jobId, name, req, dist, area, phone, tools, pax, priority: userPriority } = body;

        const supabase = createClient(await cookies());
        const { data: { user } } = await supabase.auth.getUser();

        // Accept a job
        if (action === 'accept' && jobId) {
            if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
            // SECURITY: Only accept jobs that are still 'open' to prevent race/overwrite
            const { data, error } = await supabase
                .from('nadi_bencana_jobs')
                .update({ status: 'accepted', accepted_by: user.id })
                .eq('id', jobId)
                .eq('status', 'open')
                .select()
                .single();

            if (error) return NextResponse.json({ success: false, error: 'Job not found, already accepted, or error.' }, { status: 409 });
            return NextResponse.json({ success: true, job: data });
        }

        // Cancel a job — only the owner can cancel
        if (action === 'cancel' && jobId) {
            if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

            // Verify ownership before deletion
            const { data: job, error: fetchError } = await supabase
                .from('nadi_bencana_jobs')
                .select('id, posted_by')
                .eq('id', jobId)
                .single();

            if (fetchError || !job) {
                return NextResponse.json({ success: false, error: 'Job not found.' }, { status: 404 });
            }

            if (job.posted_by !== user.id) {
                return NextResponse.json({ success: false, error: 'Forbidden. You can only cancel your own jobs.' }, { status: 403 });
            }

            const { error } = await supabase
                .from('nadi_bencana_jobs')
                .delete()
                .eq('id', jobId);

            if (error) return NextResponse.json({ success: false, error: 'Failed to cancel job.' }, { status: 500 });
            return NextResponse.json({ success: true });
        }

        // Submit new job with QUEUEING THEORY & AUTO-MODERATION
        if (action === 'submit') {
            if (!name || !req) return NextResponse.json({ success: false, error: 'Name and request are required.' }, { status: 400 });

            // Default values
            let finalPriority: 'High' | 'Medium' | 'Low' = userPriority || 'Medium';
            let bounty = 50; // default bounty
            let status: 'open' | 'banned' = 'open';

            // Auto-moderation & Smart Priority Classification via Groq AI
            if (process.env.GROQ_API_KEY) {
                try {
                    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
                    const chatCompletion = await groq.chat.completions.create({
                        messages: [
                            {
                                role: 'system',
                                content: `You are an emergency dispatch AI for flood and disaster relief in Malaysia.
Analyze the user's help request and output JSON with:
1. "is_inappropriate": boolean (true if request contains spam, offensive content, non-disaster trolling, or illegal stuff)
2. "priority": "High" | "Medium" | "Low" (High for medical, life-threatening, trapped seniors/children, severe flooding; Medium for food/water supply, cleanup help; Low for general info)
3. "bounty_xp": number (between 50 and 300 based on urgency/effort required)

Respond ONLY with raw valid JSON.`
                            },
                            {
                                role: 'user',
                                content: `Name: ${name}\nRequest: ${req}\nArea: ${area}\nTools needed: ${tools}`
                            }
                        ],
                        model: 'llama-3.3-70b-versatile',
                        response_format: { type: 'json_object' },
                        temperature: 0.1,
                    });

                    const resText = chatCompletion.choices[0]?.message?.content || '{}';
                    const parsed = JSON.parse(resText);
                    if (parsed.is_inappropriate) {
                        status = 'banned';
                    }
                    if (parsed.priority) {
                        finalPriority = parsed.priority;
                    }
                    if (parsed.bounty_xp && typeof parsed.bounty_xp === 'number') {
                        bounty = Math.min(300, Math.max(50, parsed.bounty_xp));
                    }
                } catch (aiErr) {
                    console.warn('[Jobs API] Groq AI moderation error (falling back to manual priority):', aiErr);
                }
            }

            const postedBy = user ? user.id : null;

            const { data: newJob, error: insertError } = await supabase
                .from('nadi_bencana_jobs')
                .insert({
                    name,
                    req,
                    dist: dist || '0 km',
                    area: area || 'Kelantan',
                    phone: phone || null,
                    tools: tools || null,
                    pax: pax || '1',
                    priority: finalPriority,
                    bounty,
                    status,
                    posted_by: postedBy,
                })
                .select()
                .single();

            if (insertError) {
                console.error('[Jobs API] DB insert error:', insertError);
                return NextResponse.json({ success: false, error: 'Failed to submit job.' }, { status: 500 });
            }

            return NextResponse.json({ success: true, job: newJob });
        }

        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    } catch (err: any) {
        console.error('[Jobs API] Error:', err);
        return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
    }
}
