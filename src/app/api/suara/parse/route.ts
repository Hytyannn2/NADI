import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { checkSuaraLimit } from '@/src/lib/rateLimit';
import { headers } from 'next/headers';

export async function POST(request: Request) {
    // Extract IP for rate limiting
    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim()
        || headersList.get('x-real-ip')
        || 'unknown';

    // Check rate limit BEFORE doing any AI work
    const limit = checkSuaraLimit(ip);
    if (!limit.allowed) {
        return NextResponse.json(
            { success: false, error: limit.message, retryAfter: limit.retryAfterSeconds },
            { status: 429 }
        );
    }

    try {
        const body = await request.json();
        const { inputText, targetLanguage } = body;

        // Basic input validation
        if (!inputText || typeof inputText !== 'string' || inputText.trim().length < 3) {
            return NextResponse.json(
                { success: false, error: 'Input too short. Please provide a real report.' },
                { status: 400 }
            );
        }
        if (inputText.length > 500) {
            return NextResponse.json(
                { success: false, error: 'Input too long. Max 500 characters.' },
                { status: 400 }
            );
        }

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

        const prompt = `
You are an NLP model for NADI Civic OS trained to understand local Malaysian dialects (e.g., Kelantanese/Kecek Kelate) and parse civic complaints.
Extract the intent and location from the following user report. Also provide a translation into ${targetLanguage || 'English'}.
User says: "${inputText}"

Respond strictly with a JSON object in this format:
{
  "intent": "Short description of issue (e.g. Broken Streetlight, Pothole)",
  "location": "Extracted location name",
  "coordinates": {"lat": 1.23, "lng": 101.45},
  "urgency": "Low, Medium, or High",
  "simplifiedTranslation": "Translation of the issue into ${targetLanguage || 'English'}"
}
`;
        let data;
        const models = ['gemini-2.0-flash', 'gemini-2.0-flash-lite'];
        for (const model of models) {
            try {
                const response = await ai.models.generateContent({
                    model,
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    config: { responseMimeType: 'application/json' },
                });
                data = JSON.parse(response.text || '{}');
                break; // success, stop trying
            } catch (modelError: any) {
                if (modelError?.status === 429 && model !== models[models.length - 1]) {
                    continue; // try next model
                }
                if (modelError?.status === 429) {
                    return NextResponse.json(
                        { success: false, error: 'Gemini API quota exceeded. Please wait a moment and try again.' },
                        { status: 429 }
                    );
                }
                throw modelError;
            }
        }

        return NextResponse.json({
            success: true,
            data,
            remaining: limit.remaining,
        });
    } catch (error) {
        console.error('Suara parse error:', error);
        return NextResponse.json(
            { success: false, error: 'AI parsing failed. Try again.' },
            { status: 500 }
        );
    }
}
