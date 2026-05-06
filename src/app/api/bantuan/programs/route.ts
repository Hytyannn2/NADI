import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/bantuan/programs?lat=X&lng=Y
 * 
 * Uses Groq AI to generate contextually relevant, real aid programs
 * based on the user's location in Malaysia.
 */

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get('lat') || '0');
    const lng = parseFloat(searchParams.get('lng') || '0');

    const GROQ_API_KEY = process.env.GROQ_API_KEY;

    if (!GROQ_API_KEY) {
        return NextResponse.json({ success: false, error: 'API key not configured' }, { status: 500 });
    }

    try {
        // First, reverse geocode to get location name
        let locationName = 'Malaysia';
        try {
            const geoRes = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10`,
                { headers: { 'User-Agent': 'NADI-Civic-OS/1.0' }, signal: AbortSignal.timeout(5000) }
            );
            const geoData = await geoRes.json();
            const addr = geoData.address || {};
            locationName = addr.state || addr.county || addr.city || addr.town || 'Malaysia';
        } catch {}

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [{
                    role: 'system',
                    content: `You are a Malaysian government aid database. Return ONLY valid JSON array of real, currently active aid programs available in or near "${locationName}", Malaysia. Include national programs available everywhere plus local programs. Each item must have: id (string), name (string), provider (string - the actual government body/NGO), type ("government"|"ngo"|"zakat"|"community"), description (string - 1 sentence with amounts if applicable), eligibility (string), status ("active"|"upcoming"|"closed"), location (string), deadline (string or null). Return 6-10 programs. ONLY respond with the JSON array, no markdown, no explanation.`
                }, {
                    role: 'user',
                    content: `List current real Malaysian aid programs available for residents near ${locationName} (coordinates: ${lat}, ${lng}). Include STR/BSH/BKM/IPT aid, zakat distributions, flood relief, education aid, and any local programs. Use real program names and real provider names.`
                }],
                temperature: 0.3,
                max_tokens: 2000,
            }),
            signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) {
            throw new Error(`Groq API returned ${res.status}`);
        }

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || '[]';

        // Parse JSON from AI response
        let programs = [];
        try {
            const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            programs = JSON.parse(cleaned);
        } catch {
            programs = [];
        }

        return NextResponse.json({
            success: true,
            programs,
            location: locationName,
            total: programs.length,
        });

    } catch (error: any) {
        console.error('Bantuan programs API error:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to fetch aid programs',
            programs: [],
        }, { status: 500 });
    }
}
