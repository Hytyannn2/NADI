import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { checkSuaraLimit } from '@/src/lib/rateLimit';
import { headers } from 'next/headers';

const DIALECT_ENGINE_URL = process.env.DIALECT_ENGINE_URL || 'http://localhost:8100';

/**
 * Fetch dialect context from the Python engine.
 * Returns a compact mapping string (e.g. "ghaso=rasa, make=makan, ...")
 * or empty string if engine is not running.
 */
async function getDialectContext(region?: string): Promise<string> {
    try {
        const url = `${DIALECT_ENGINE_URL}/prompt-context${region ? `?region=${region}` : ''}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
            const data = await res.json();
            return data.context || '';
        }
    } catch {
        // Engine not available — that's fine
    }
    return '';
}

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
        const { inputText, targetLanguage, dialectRegion } = body;

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

        // Fetch dialect context from the engine (non-blocking, with timeout)
        const dialectContext = await getDialectContext(dialectRegion);

        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });

        // Build dialect-enriched prompt
        const dialectSection = dialectContext
            ? `\n\nYou have access to a Malaysian dialect dictionary. Use these mappings to understand dialect words:\n${dialectContext}\n\nApply these mappings when parsing the user's input. If you encounter a word in the dictionary, use the standard Malay equivalent to understand the meaning.\n`
            : '';

        const prompt = `
You are an NLP model for NADI Civic OS trained to understand local Malaysian dialects (e.g., Kelantanese/Kecek Kelate, Terengganu, Kedah, Sabah, Sarawak) and parse civic complaints.
${dialectSection}
Extract the intent and location from the following user report. Also provide a translation into ${targetLanguage || 'English'}.

User says: "${inputText}"

Respond strictly with a JSON object in this format:
{
  "intent": "Short description of issue (e.g. Broken Streetlight, Pothole)",
  "location": "Extracted location name",
  "coordinates": {"lat": 1.23, "lng": 101.45},
  "urgency": "Low, Medium, or High",
  "simplifiedTranslation": "Translation of the issue into ${targetLanguage || 'English'}",
  "detectedDialect": "The dialect region detected (kelantan/terengganu/kedah/sabah/sarawak/standard/unknown)",
  "dialectWords": ["list", "of", "dialect", "words", "found"]
}
`;
        let data;
        try {
            const chatCompletion = await groq.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: 'llama-3.3-70b-versatile',
                response_format: { type: 'json_object' }
            });
            data = JSON.parse(chatCompletion.choices[0]?.message?.content || '{}');
        } catch (error: any) {
            if (error?.status === 429) {
                return NextResponse.json(
                    { success: false, error: 'Groq API rate limit exceeded. Please wait a moment and try again.' },
                    { status: 429 }
                );
            }
            throw error;
        }

        return NextResponse.json({
            success: true,
            data,
            remaining: limit.remaining,
            dialectEnriched: dialectContext.length > 0,
        });
    } catch (error) {
        console.error('Suara parse error:', error);
        return NextResponse.json(
            { success: false, error: 'AI parsing failed. Try again.' },
            { status: 500 }
        );
    }
}
