import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

// In-memory volunteer job store (replace with DB in production)
const jobsStore: any[] = [];

// GET /api/bencana/jobs — fetch volunteer jobs
export async function GET() {
    const sorted = [...jobsStore].sort((a, b) => b.createdAt - a.createdAt);
    return NextResponse.json({ success: true, jobs: sorted });
}

// POST /api/bencana/jobs — submit, accept, or cancel a volunteer job
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, jobId, name, req, dist, area } = body;

        // Accept a job
        if (action === 'accept' && jobId) {
            const job = jobsStore.find(j => j.id === jobId);
            if (!job) return NextResponse.json({ success: false, error: 'Job not found.' }, { status: 404 });
            if (job.status === 'accepted') return NextResponse.json({ success: false, error: 'Job already accepted.' }, { status: 409 });
            job.status = 'accepted';
            return NextResponse.json({ success: true, job });
        }

        // Cancel a job — remove it entirely from the store
        if (action === 'cancel' && jobId) {
            const idx = jobsStore.findIndex(j => j.id === jobId);
            if (idx === -1) return NextResponse.json({ success: false, error: 'Job not found.' }, { status: 404 });
            const [removed] = jobsStore.splice(idx, 1);
            return NextResponse.json({ success: true, cancelled: removed });
        }

        // Submit new job with AI-generated priority
        if (action === 'submit') {
            if (!name || !req) return NextResponse.json({ success: false, error: 'Name and request are required.' }, { status: 400 });

            let priority = 'Medium';
            let bounty = 30;
            try {
                const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });
                const result = await groq.chat.completions.create({
                    messages: [{
                        role: 'user',
                        content: `You are a disaster relief coordinator for Malaysia's NADI Bencana (flood/crisis response) system.
A victim needs help: "${req}" for household "${name}" in area "${area || 'unknown'}".
Assess this request and respond with JSON:
{
  "priority": "High/Medium/Low",
  "bountyPoints": <integer between 20-100, reflecting urgency>,
  "category": "Mud Cleanup/Furniture Moving/Medical/Supply Delivery/Evacuation/Other"
}`
                    }],
                    model: 'llama-3.3-70b-versatile',
                    response_format: { type: 'json_object' },
                });
                const data = JSON.parse(result.choices[0]?.message?.content || '{}');
                priority = data.priority || 'Medium';
                bounty = data.bountyPoints || 30;
            } catch {
                // fallback defaults
            }

            const newJob = {
                id: `job-${Date.now()}`,
                name,
                dist: dist || 'Unknown',
                req,
                status: 'open',
                bounty,
                area: area || 'Unknown',
                createdAt: Date.now(),
                priority,
            };
            jobsStore.unshift(newJob);
            if (jobsStore.length > 30) jobsStore.splice(30);

            return NextResponse.json({ success: true, job: newJob });
        }

        return NextResponse.json({ success: false, error: 'Unknown action.' }, { status: 400 });
    } catch (error) {
        console.error('Bencana jobs error:', error);
        return NextResponse.json({ success: false, error: 'Operation failed.' }, { status: 500 });
    }
}
