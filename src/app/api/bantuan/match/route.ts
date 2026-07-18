import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import Groq from 'groq-sdk';
import { checkRateLimit } from '@/src/lib/rateLimit';

const getMatchedPrograms = unstable_cache(
    async (profileStr: string, programsStr: string) => {
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });
        
        const prompt = `
You are an AI assistant for NADI Civic OS helping a citizen in Kelantan check their eligibility for various government and NGO aid programs.
Here is the user's profile information:
${profileStr}

Here is the list of available aid programs:
${programsStr}

Analyze the user's profile against the eligibility criteria of EACH program. 
Return a JSON array of matches. For each match, provide:
- id: the program ID
- isEligible: true, false, or "maybe"
- reason: A short explanation (1-2 sentences) of why they are or aren't eligible, or what additional info is needed. Use standard Malay with a friendly tone.

Return a JSON object with a single key "matches" containing the array of results. Example format:
{
  "matches": [
    { "id": "prog_1", "isEligible": true, "reason": "Pendapatan anda di bawah RM2500, jadi anda layak." }
  ]
}
`;

        const result = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.3-70b-versatile',
            response_format: { type: 'json_object' }
        });

        const rawJson = result.choices[0]?.message?.content || '{}';
        let parsed = JSON.parse(rawJson);
        
        let matchesArray = [];
        if (Array.isArray(parsed)) {
            matchesArray = parsed;
        } else if (parsed.matches && Array.isArray(parsed.matches)) {
            matchesArray = parsed.matches;
        } else {
            // Find the first value that is an array if the LLM used a random key
            const firstArrayObj = Object.values(parsed).find(val => Array.isArray(val));
            if (firstArrayObj) {
                matchesArray = firstArrayObj as any[];
            }
        }

        return matchesArray;
    },
    ['bantuan-match-v1'],
    {
        revalidate: 86400, // cache for 24 hours
        tags: ['bantuan-match']
    }
);

export async function POST(request: Request) {
    try {
        const ip = request.headers.get('x-forwarded-for') || 'anonymous';
        const { allowed, retryAfterSeconds, message } = checkRateLimit(ip, {
            maxRequests: 5,
            windowSeconds: 60,
            blockDurationSeconds: 120,
            bucketName: 'bantuan-match'
        });

        if (!allowed) {
            return NextResponse.json({ 
                success: false, 
                error: message || `Sistem sedang berehat. Sila cuba lagi dalam ${retryAfterSeconds} saat.` 
            }, { status: 429 });
        }

        const { profile, programs } = await request.json();
        
        if (!profile) return NextResponse.json({ success: false, error: 'No profile data' }, { status: 400 });

        const profileStr = JSON.stringify(profile, null, 2);
        const programsStr = JSON.stringify(programs, null, 2);

        const matches = await getMatchedPrograms(profileStr, programsStr);

        return NextResponse.json({ success: true, matches });
    } catch (error) {
        console.error('AI Matching error:', error);
        return NextResponse.json({ success: false, error: 'Gagal menyemak kelayakan.' }, { status: 500 });
    }
}
