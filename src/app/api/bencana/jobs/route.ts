/**
 * Disaster Relief Volunteer Jobs API
 * 
 * Manages disaster response tasks (SOS requests, cleanup squads, supplies delivery),
 * volunteer assignments, and background AI moderation.
 */
import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { createClient } from '@/src/utils/supabase/server';
import { cookies } from 'next/headers';
import Groq from 'groq-sdk';

// GET: Fetches open relief volunteer tasks (excludes private phone numbers and banned requests)
export async function GET() {
    try {
        const supabase = createClient(await cookies());
        const { data, error } = await supabase
            .from('nadi_bencana_jobs')
            .select('id, name, req, dist, area, priority, tools, pax, status, bounty, created_at, posted_by, accepted_by')
            .neq('status', 'banned')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return NextResponse.json({ success: true, jobs: data });
    } catch (err) {
        return NextResponse.json({ success: false, jobs: [] });
    }
}

// POST: Submits new disaster tasks, accepts assignments, or cancels existing tasks
export async function POST(request: Request) {
    try {
        // Validates request Origin/Host to prevent cross-origin submissions
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

        // 1. Action: Accept task
        if (action === 'accept' && jobId) {
            if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
            // Only accept jobs that are currently 'open' to prevent race conditions
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

        // 2. Action: Cancel task (only the original author can cancel)
        if (action === 'cancel' && jobId) {
            if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

            // Verify ownership before deleting
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

        // 3. Action: Submit new task with asynchronous AI moderation
        if (action === 'submit') {
            if (!name || !req) return NextResponse.json({ success: false, error: 'Name and request are required.' }, { status: 400 });
            if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

            let priority = userPriority || 'Medium';
            let bounty = 30; // Default points

            const newJob = {
                name,
                dist: dist || 'Unknown',
                req,
                status: 'open',
                bounty,
                area: area || 'Unknown',
                priority,
                posted_by: user.id,
                phone: phone || null,
                tools_needed: tools || null,
                pax_needed: pax ? parseInt(pax, 10) : null,
            };

            // Saves to database immediately so user gets an instant response
            const { data, error } = await supabase
                .from('nadi_bencana_jobs')
                .insert(newJob)
                .select()
                .single();

            if (error) throw error;

            // Background task: evaluates content appropriateness and sets bounty points
            after(async () => {
                try {
                    const fullReq = `${req}${phone ? ` | Phone: ${phone}` : ''}${tools ? ` | Tools: ${tools}` : ''}${pax ? ` | Pax: ${pax}` : ''}`;
                    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });
                    const result = await groq.chat.completions.create({
                        messages: [{
                            role: 'user',
                            content: `You are a disaster relief AI moderator for Malaysia's NADI Bencana system.
A user submitted this SOS request: "${fullReq}" for household "${name}" in area "${area || 'unknown'}".
1. Check for inappropriate content, pranks, hate speech, or spam.
2. If legitimate, assess urgency and assign bounty.
Respond with JSON:
{
  "isInappropriate": <boolean>,
  "bountyPoints": <integer between 20-100, reflecting urgency>,
  "category": "Mud Cleanup/Furniture Moving/Medical/Supply Delivery/Evacuation/Other"
}`
                        }],
                        model: 'llama-3.3-70b-versatile',
                        response_format: { type: 'json_object' },
                    });

                    const parsedData = JSON.parse(result.choices[0]?.message?.content || '{}');

                    // Admin client to update without user cookie context
                    const { createClient: createAdminClient } = await import('@supabase/supabase-js');
                    const adminSupabase = createAdminClient(
                        process.env.NEXT_PUBLIC_SUPABASE_URL!,
                        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
                    );

                    if (parsedData.isInappropriate) {
                        // Temporarily ban/remove the request if prank/inappropriate
                        await adminSupabase.from('nadi_bencana_jobs').update({ status: 'banned', bounty: 0 }).eq('id', data.id);
                    } else {
                        // Update with actual calculated bounty
                        const updatedBounty = parsedData.bountyPoints || 30;
                        await adminSupabase.from('nadi_bencana_jobs').update({ bounty: updatedBounty }).eq('id', data.id);
                    }
                } catch (e) {
                    console.error('Background AI Task Failed:', e);
                }
            });

            return NextResponse.json({ success: true, job: data });
        }

        return NextResponse.json({ success: false, error: 'Unknown action.' }, { status: 400 });
    } catch (error) {
        console.error('Bencana jobs error:', error);
        return NextResponse.json({ success: false, error: 'Operation failed.' }, { status: 500 });
    }
}
