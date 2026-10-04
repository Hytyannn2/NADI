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
import { getAdminSupabase } from '@/src/lib/auth/serverAuth';
import Groq from 'groq-sdk';

// In-memory fallback store for relief volunteer jobs
let IN_MEMORY_BENCANA_JOBS: any[] = [];

// GET: Fetches open relief volunteer tasks (excludes private phone numbers and banned requests)
export async function GET() {
    try {
        const adminSupabase = getAdminSupabase();
        const { data, error } = await adminSupabase
            .from('nadi_bencana_jobs')
            .select('id, name, req, dist, area, priority, tools_needed, pax_needed, status, bounty, created_at, posted_by, accepted_by')
            .neq('status', 'banned')
            .order('created_at', { ascending: false });

        if (error) {
            console.warn('Notice fetching Supabase jobs:', error.message);
        }

        const formattedDbJobs = (data || []).map(j => ({
            ...j,
            tools: j.tools_needed || '',
            pax: j.pax_needed || null,
        }));

        const allJobs = [
            ...formattedDbJobs,
            ...IN_MEMORY_BENCANA_JOBS
        ];
        const uniqueJobs = Array.from(new Map(allJobs.map(j => [j.id, j])).values());
        return NextResponse.json({ success: true, jobs: uniqueJobs });
    } catch (err: any) {
        console.error('Jobs GET error:', err?.message);
        return NextResponse.json({ success: true, jobs: IN_MEMORY_BENCANA_JOBS });
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
        let { data: { user } } = await supabase.auth.getUser();
        const adminSupabase = getAdminSupabase();

        // Fallback to Bearer token if cookies were omitted
        if (!user) {
            const authHeader = request.headers.get('Authorization');
            if (authHeader?.startsWith('Bearer ')) {
                const token = authHeader.substring(7).trim();
                const { data } = await adminSupabase.auth.getUser(token);
                user = data?.user || null;
            }
        }

        // 1. Action: Accept task
        if (action === 'accept' && jobId) {
            if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

            // Fetch the job to check ownership
            let targetJob: any = null;
            try {
                const { data: existingJob } = await adminSupabase
                    .from('nadi_bencana_jobs')
                    .select('id, posted_by, status')
                    .eq('id', jobId)
                    .single();
                targetJob = existingJob;
            } catch {}

            if (!targetJob) {
                targetJob = IN_MEMORY_BENCANA_JOBS.find(j => j.id === jobId);
            }

            if (!targetJob) {
                return NextResponse.json({ success: false, error: 'Tugasan tidak dijumpai.' }, { status: 404 });
            }

            // CRITICAL: User cannot accept their own job!
            if (targetJob.posted_by === user.id) {
                return NextResponse.json({ 
                    success: false, 
                    error: 'Anda tidak boleh menerima permohonan bantuan anda sendiri.' 
                }, { status: 400 });
            }

            if (targetJob.status !== 'open') {
                return NextResponse.json({ success: false, error: 'Tugasan ini telah diterima oleh sukarelawan lain.' }, { status: 409 });
            }

            try {
                const { data, error } = await adminSupabase
                    .from('nadi_bencana_jobs')
                    .update({ status: 'accepted', accepted_by: user.id })
                    .eq('id', jobId)
                    .eq('status', 'open')
                    .select()
                    .single();

                if (!error && data) {
                    return NextResponse.json({ success: true, job: data });
                }
            } catch {}

            // In-memory fallback
            const memJob = IN_MEMORY_BENCANA_JOBS.find(j => j.id === jobId && j.status === 'open');
            if (memJob) {
                memJob.status = 'accepted';
                memJob.accepted_by = user.id;
                return NextResponse.json({ success: true, job: memJob });
            }

            return NextResponse.json({ success: false, error: 'Tugasan tidak dijumpai atau telah diterima.' }, { status: 409 });
        }

        // 2. Action: Cancel task (only the original author can cancel)
        if (action === 'cancel' && jobId) {
            if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

            try {
                const { data: job } = await adminSupabase
                    .from('nadi_bencana_jobs')
                    .select('id, posted_by')
                    .eq('id', jobId)
                    .single();

                if (job && job.posted_by === user.id) {
                    await adminSupabase.from('nadi_bencana_jobs').delete().eq('id', jobId);
                    return NextResponse.json({ success: true });
                }
            } catch {}

            // In-memory fallback
            const memIdx = IN_MEMORY_BENCANA_JOBS.findIndex(j => j.id === jobId && j.posted_by === user.id);
            if (memIdx !== -1) {
                IN_MEMORY_BENCANA_JOBS.splice(memIdx, 1);
                return NextResponse.json({ success: true });
            }

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

            let jobRecord: any = null;

            try {
                const { data, error } = await adminSupabase
                    .from('nadi_bencana_jobs')
                    .insert(newJob)
                    .select()
                    .single();

                if (!error && data) {
                    jobRecord = data;
                } else if (error) {
                    console.warn('Supabase jobs insert warning, falling back to local memory:', error.message);
                }
            } catch (err: any) {
                console.warn('Supabase jobs insert exception:', err?.message);
            }

            if (!jobRecord) {
                jobRecord = {
                    ...newJob,
                    id: `job-${Date.now()}`,
                    created_at: new Date().toISOString(),
                };
                IN_MEMORY_BENCANA_JOBS.unshift(jobRecord);
            }

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
                    const targetId = jobRecord?.id;

                    if (targetId) {
                        try {
                            if (parsedData.isInappropriate) {
                                await adminSupabase.from('nadi_bencana_jobs').update({ status: 'banned', bounty: 0 }).eq('id', targetId);
                            } else {
                                const updatedBounty = parsedData.bountyPoints || 30;
                                await adminSupabase.from('nadi_bencana_jobs').update({ bounty: updatedBounty }).eq('id', targetId);
                            }
                        } catch {}

                        const memItem = IN_MEMORY_BENCANA_JOBS.find(j => j.id === targetId);
                        if (memItem) {
                            if (parsedData.isInappropriate) {
                                memItem.status = 'banned';
                            } else {
                                memItem.bounty = parsedData.bountyPoints || 30;
                            }
                        }
                    }
                } catch (e) {
                    console.error('Background AI Task Failed:', e);
                }
            });

            return NextResponse.json({ success: true, job: jobRecord });
        }

        return NextResponse.json({ success: false, error: 'Unknown action.' }, { status: 400 });
    } catch (error) {
        console.error('Bencana jobs error:', error);
        return NextResponse.json({ success: false, error: 'Operation failed.' }, { status: 500 });
    }
}
