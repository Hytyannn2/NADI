import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { checkInfraVisionLimit } from '@/src/lib/rateLimit';
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

        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });

        const prompt = `You are an infrastructure damage assessment AI for Malaysia's NADI Civic OS.
Analyze this photo of road damage. The phone's accelerometer recorded a Z-axis drop of ${Math.abs(zDropped || 0).toFixed(1)}g at GPS ${lat || 'unknown'}°N, ${lng || 'unknown'}°E.

Provide your visual analysis strictly in this JSON format:
{
  "damageType": "<Pothole|Crack|Subsidence|Flooding|Debris|Sinkhole|Other>",
  "visualSeverity": <1-5 integer>,
  "estimatedDimensions": "<e.g. ~40cm wide, ~8cm deep>",
  "surfaceMaterial": "<Asphalt|Concrete|Gravel|Laterite|Unknown>",
  "waterPresent": <true|false boolean>,
  "vegetationEncroachment": <true|false boolean>,
  "description": "<2-3 sentence professional damage description suitable for a JKR report>",
  "repairRecommendation": "<Professional repair method recommendation>",
  "estimatedCostMYR": "<Cost range in RM>",
  "urgency": "<Immediate|48 Hours|1 Week|Scheduled>"
}`;

        const content: any[] = [{ type: 'text', text: prompt }];
        
        if (imageBase64) {
            content.push({
                type: 'image_url',
                image_url: {
                    url: `data:image/jpeg;base64,${imageBase64}`,
                },
            });
        }

        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'user',
                    content,
                }
            ],
            model: 'llama-3.2-90b-vision-preview',
        });

        // Extract JSON block in case Llama outputs conversational text around it
        const responseText = chatCompletion.choices[0]?.message?.content || '{}';
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        const analysis = JSON.parse(jsonMatch ? jsonMatch[0] : '{}');

        return NextResponse.json({ success: true, analysis });
    } catch (error) {
        console.error('Vision analysis error:', error);
        return NextResponse.json(
            { success: false, error: 'Vision analysis failed' },
            { status: 500 }
        );
    }
}
