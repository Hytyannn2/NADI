import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { checkSuaraLimit } from '@/src/lib/rateLimit';
import { headers } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const DIALECT_ENGINE_URL = process.env.DIALECT_ENGINE_URL || 'http://localhost:8100';

async function getLearnedDbFeedback(): Promise<string> {
    try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
        if (!url || !key) return '';
        const supabase = createClient(url, key);

        const { data } = await supabase
            .from('nadi_dialect_feedback')
            .select('dialect_text, correct_meaning')
            .eq('is_positive', false)
            .not('correct_meaning', 'is', null)
            .order('created_at', { ascending: false })
            .limit(20);

        if (data && data.length > 0) {
            return data.map(item => `"${item.dialect_text}" -> "${item.correct_meaning}"`).join('\n');
        }
    } catch {
        // Fail silently
    }
    return '';
}

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

        // Fetch dialect context from engine AND learned feedback from database
        const [engineContext, learnedFeedback] = await Promise.all([
            getDialectContext(dialectRegion),
            getLearnedDbFeedback()
        ]);

        const dialectContext = [
            engineContext,
            learnedFeedback ? `LEARNED CITIZEN CORRECTIONS (Verified by users):\n${learnedFeedback}` : ''
        ].filter(Boolean).join('\n\n');

        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });

        // Build dialect-enriched prompt
        const dialectSection = dialectContext
            ? `\n\nYou have access to a Malaysian dialect dictionary. Use these mappings to understand dialect words:\n${dialectContext}\n\nApply these mappings when parsing the user's input. If you encounter a word in the dictionary, use the standard Malay equivalent to understand the meaning.\n`
            : '';

        const prompt = `
You are an NLP model for NADI Civic OS trained to understand local Malaysian dialects (e.g., Kelantanese/Kecek Kelate, Terengganu, Kedah, Sabah, Sarawak) and parse civic complaints.
${dialectSection}
Extract the intent and location from the following user report. Also provide a translation into standard Malay (${targetLanguage || 'Malay'}).

CRITICAL RULES:
- If the report specifies a real physical infrastructure issue (e.g. pothole, broken streetlight, blocked drain, water leak, trash dump), set "intent" to a clean 2-4 word Malay title (e.g. "Jalan Berlubang", "Lampu Jalan Rosak", "Longkang Tersumbat").
- If the report is a general expression of frustration, emotion, or general comment without mentioning a specific defect, set "intent" to "Aduan & Ulasan Warga" and set "location" to "Kota Bharu". DO NOT invent or hallucinate unmentioned physical damage like "overgrown vegetation" or "sinkhole".
- In "simplifiedTranslation", provide an accurate standard Malay translation of what the user actually said.
- In "userIntendedMeaning", explain the EXACT intent or metaphorical meaning of the user's dialect expression (e.g. "Ungkapan kelesuan/stres (Kiasan Kelantan: 'sakit kepala') — Tiada kerosakan fizikal" or "Aduan kerosakan fizikal jalan raya").
- In "confidenceScore", provide an integer between 70 and 98 representing NLP parsing confidence.

User says: "${inputText}"

Respond strictly with a JSON object in this format:
{
  "intent": "Short title in Malay (e.g. Jalan Berlubang, Lampu Jalan Rosak, Aduan Warga)",
  "location": "Extracted location name or 'Kota Bharu'",
  "coordinates": {"lat": 6.0833, "lng": 102.2500},
  "urgency": "Low, Medium, or High",
  "simplifiedTranslation": "Standard Malay translation of user input",
  "userIntendedMeaning": "Detailed explanation of what the user actually intended by their speech",
  "detectedDialect": "The dialect region detected (kelantan/terengganu/kedah/sabah/sarawak/standard/unknown)",
  "dialectWords": ["list", "of", "dialect", "words", "found"],
  "confidenceScore": 88
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

            // Dynamic fallback for confidenceScore if missing or static
            if (!data.confidenceScore || data.confidenceScore === 94) {
                const dialectCount = (data.dialectWords || []).length;
                data.confidenceScore = Math.min(98, Math.max(72, 78 + dialectCount * 5 + (data.userIntendedMeaning ? 6 : 0)));
            }
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
