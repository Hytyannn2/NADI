import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

export async function POST(request: Request) {
    try {
        const { profile, programs } = await request.json();
        
        if (!profile) return NextResponse.json({ success: false, error: 'No profile data' }, { status: 400 });

        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });
        
        const prompt = `
You are an AI assistant for NADI Civic OS helping a citizen in Kelantan check their eligibility for various government and NGO aid programs.
Here is the user's profile information:
${JSON.stringify(profile, null, 2)}

Here is the list of available aid programs:
${JSON.stringify(programs, null, 2)}

Analyze the user's profile against the eligibility criteria of EACH program. 
Return a JSON array of matches. For each match, provide:
- id: the program ID
- isEligible: true, false, or "maybe"
- reason: A short explanation (1-2 sentences) of why they are or aren't eligible, or what additional info is needed. Use standard Malay with a friendly tone.

Return ONLY the JSON array. Example format:
[
  { "id": "prog_1", "isEligible": true, "reason": "Pendapatan anda di bawah RM2500, jadi anda layak untuk STR." },
  ...
]
`;

        const result = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.3-70b-versatile',
            response_format: { type: 'json_object' }
        });

        // The model might return `{ "matches": [...] }` or just `[...]` depending on how it parses the request
        const rawJson = result.choices[0]?.message?.content || '{}';
        let parsed = JSON.parse(rawJson);
        
        // Handle if it returned an object with a property containing the array
        if (!Array.isArray(parsed) && parsed.matches) {
            parsed = parsed.matches;
        }

        return NextResponse.json({ success: true, matches: parsed });
    } catch (error) {
        console.error('AI Matching error:', error);
        return NextResponse.json({ success: false, error: 'Gagal menyemak kelayakan.' }, { status: 500 });
    }
}
