import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

export async function POST(request: Request) {
    try {
        const { message, context } = await request.json();
        if (!message) return NextResponse.json({ success: false, error: 'No message' }, { status: 400 });

        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });
        const result = await groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: `You are NADI Assistant, an AI civic helper for Malaysia's NADI Civic OS platform. You help citizens with:
- Government services (Bantuan Rakyat eligibility, IC renewal, roadtax, etc.)
- Flood shelters and emergency info
- Transit routes and schedules
- Community services and civic reporting
- General Malaysian civic knowledge
Current context: User is viewing the "${context || 'general'}" section.
Keep responses concise (under 150 words), helpful, and in a friendly tone. Use Malay terms where natural. If unsure, suggest visiting the relevant government portal.`
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
