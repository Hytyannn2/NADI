import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { checkInfraVisionLimit } from '@/lib/rateLimit';
import { headers } from 'next/headers';

export async function POST(request: Request) {
    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || headersList.get('x-real-ip') || 'unknown';
    const limit = checkInfraVisionLimit(ip);
    if (!limit.allowed) {
        return NextResponse.json({ success: false, error: limit.message }, { status: 429 });
    }

    try {
        const body = await request.json();
        const { imageBase64, lat, lng, zDropped } = body;

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

        const prompt = `You are an infrastructure damage assessment AI for Malaysia's NADI Civic OS.
Analyze this photo of road damage. The phone's accelerometer recorded a Z-axis drop of ${Math.abs(zDropped || 0).toFixed(1)}g at GPS ${lat || 'unknown'}°N, ${lng || 'unknown'}°E.

Provide your visual analysis in this JSON format:
{
  "damageType": "<Pothole|Crack|Subsidence|Flooding|Debris|Sinkhole|Other>",
  "visualSeverity": <1-5>,
  "estimatedDimensions": "<e.g. ~40cm wide, ~8cm deep>",
  "surfaceMaterial": "<Asphalt|Concrete|Gravel|Laterite|Unknown>",
  "waterPresent": <true|false>,
  "vegetationEncroachment": <true|false>,
  "description": "<2-3 sentence professional damage description suitable for a JKR report>",
  "repairRecommendation": "<Professional repair method recommendation>",
  "estimatedCostMYR": "<Cost range in RM>",
  "urgency": "<Immediate|48 Hours|1 Week|Scheduled>"
}`;

        const parts: any[] = [{ text: prompt }];
        if (imageBase64) {
            parts.push({
                inlineData: {
                    mimeType: 'image/jpeg',
                    data: imageBase64,
                },
            });
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: [{ role: 'user', parts }],
            config: { responseMimeType: 'application/json' },
        });

        const analysis = JSON.parse(response.text || '{}');

        return NextResponse.json({ success: true, analysis });
    } catch (error) {
        console.error('Vision analysis error:', error);
        return NextResponse.json(
            { success: false, error: 'Vision analysis failed' },
            { status: 500 }
        );
    }
}
