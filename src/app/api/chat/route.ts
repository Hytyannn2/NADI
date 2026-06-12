import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { checkRateLimit } from '@/src/lib/rate-limiter';

export async function POST(request: Request) {
    try {
        const ip = request.headers.get('x-forwarded-for') || 'anonymous';
        const { allowed, retryAfter } = checkRateLimit(ip);

        if (!allowed) {
            return NextResponse.json({ 
                success: false, 
                reply: `Sistem sedang berehat kerana terlalu banyak mesej. Sila cuba lagi dalam ${retryAfter} saat.` 
            }, { status: 429 });
        }

        const { message, context } = await request.json();
        if (!message) return NextResponse.json({ success: false, error: 'No message' }, { status: 400 });

        // Fetch dialect context from the engine for Kelantan
        let dialectContext = '';
        try {
            const engineUrl = process.env.DIALECT_ENGINE_URL || 'http://localhost:8100';
            const res = await fetch(`${engineUrl}/prompt-context?region=kelantan`, { signal: AbortSignal.timeout(2000) });
            if (res.ok) {
                const data = await res.json();
                dialectContext = data.context || '';
            }
        } catch (e) {
            // Silently ignore if dialect engine is down
        }

        const dialectSection = dialectContext
            ? `\n\nHere is a dictionary of Kelantanese dialect words mapped to standard Malay to help you understand the user:\n${dialectContext}\n`
            : '';

        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });
        const result = await groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: `You are NADI Assistant, an AI civic helper for Malaysia's NADI Civic OS platform. You are currently configured for the state of Kelantan. You help citizens with:
- Government services (Bantuan Rakyat eligibility, IC renewal, etc.)
- Flood shelters and emergency info in Kelantan (e.g. Pasir Mas, Kuala Krai)
- Community services and civic reporting
- General Malaysian civic knowledge
Current context: User is viewing the "${context || 'general'}" section.
${dialectSection}
Keep responses concise (under 150 words), helpful, and in a friendly tone. Reply using a natural mix of standard Malay and Kelantanese dialect (Kecek Kelate). If unsure, suggest visiting the relevant government portal.`
                },
                { role: 'user', content: message }
            ],
            model: 'llama-3.3-70b-versatile',
            max_tokens: 300,
        });

        const reply = result.choices[0]?.message?.content || 'Maaf, saya tidak dapat memproses permintaan anda. Sila cuba lagi.';
        return NextResponse.json({ success: true, reply });
    } catch (error) {
        console.error('Chatbot error:', error);
        return NextResponse.json({ success: true, reply: 'Maaf, perkhidmatan AI sedang sibuk. Sila cuba sebentar lagi.' });
    }
}
