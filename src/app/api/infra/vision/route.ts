/**
 * AI Road Defect Vision Classifier
 * 
 * Analyzes dashcam road frames with Groq LLaMA Vision and calculates pothole
 * dimensions by combining vision estimates with accelerometer physical drop data.
 */
import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { checkInfraVisionLimit, getClientIp, addRateLimitHeaders } from '@/src/lib/rateLimit';
import { headers } from 'next/headers';
import { requireServerAuth } from '@/src/lib/auth/serverAuth';

export async function POST(request: Request) {
  const headersList = await headers();
  const ip = getClientIp(headersList);
  const limit = checkInfraVisionLimit(ip);
  if (!limit.allowed) {
    const errRes = NextResponse.json({ success: false, error: limit.message, retryAfter: limit.retryAfterSeconds }, { status: 429 });
    return addRateLimitHeaders(errRes, limit);
  }

  // Enforce server-side authentication before Vision processing & database writes (CWE-862)
  const { user, adminSupa, errorResponse } = await requireServerAuth(request);
  if (errorResponse) {
    return errorResponse;
  }

  try {
    const body = await request.json();
    const { imageBase64, lat, lng, zDropped, anomalyId, speedKmh, magnitudeG } = body;

    // Rejects payloads larger than ~4MB
    if (imageBase64 && imageBase64.length > 4000000) {
      return NextResponse.json({ success: false, error: 'Image payload too large. Max 3MB.' }, { status: 413 });
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });

    const prompt = `You are NADI Vision, a road infrastructure analysis AI for Malaysia's NADI Civic OS.
Analyze the provided dashcam frame. The top 40% of the image has been intentionally blurred for PDPA 2010 privacy compliance. Focus ONLY on the visible road asphalt surface.

TASK & SCALING RULES:
1. Confirm if the anomaly is a POTHOLE, CRACK, MANHOLE, SHADOW, or SUBSIDENCE.
2. Estimate the WIDTH of the damage as a PERCENTAGE of the visible road lane. (Assume standard Malaysian JKR lane width is 3.0 meters / 300 cm).
3. Output strictly in JSON format:
{
  "damageType": "<Pothole|Crack|Subsidence|Flooding|Debris|Sinkhole|Other>",
  "visualSeverity": <1-5 integer>,
  "widthLanePercent": <estimated width as percentage 5-90>,
  "estimatedDiameterCm": <calculated as (widthLanePercent / 100) * 300>,
  "surfaceMaterial": "<Asphalt|Concrete|Gravel|Laterite|Unknown>",
  "waterPresent": <true|false boolean>,
  "vegetationEncroachment": <true|false boolean>,
  "description": "<2-3 sentence professional damage description suitable for a JKR Malaysia report>",
  "repairRecommendation": "<Professional repair method recommendation e.g. Cold-mix patch / Premix resurfacing>",
  "estimatedCostMYR": "<Cost range in RM e.g. RM150 - RM350>",
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

    let responseText = '';

    // Primary model: Llama 3.2 90B Vision (falls back to 11B Vision if unavailable)
    try {
      const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: 'user', content }],
        model: 'llama-3.2-90b-vision-preview',
      });
      responseText = chatCompletion.choices[0]?.message?.content || '{}';
    } catch (primaryErr: any) {
      console.warn('[infra/vision] Primary 90B Vision error, trying 11B Vision fallback:', primaryErr?.message);
      const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: 'user', content }],
        model: 'llama-3.2-11b-vision-preview',
      });
      responseText = chatCompletion.choices[0]?.message?.content || '{}';
    }

    // Strips markdown code fences and parses JSON output
    const cleanedText = responseText.replace(/```json\n?|\n?```/g, '').trim();
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract valid JSON from Vision AI response');
    }
    const analysis = JSON.parse(jsonMatch[0]);

    // Calculates physical depth from accelerometer vertical drop magnitude (g)
    const physicalDropG = Math.abs(zDropped || magnitudeG || 1.2);
    analysis.estimatedDepthCm = parseFloat((3.5 + physicalDropG * 2.8).toFixed(1));

    // Calculates surface diameter and area based on 3.0m standard lane width
    if (!analysis.estimatedDiameterCm) {
      const widthPct = analysis.widthLanePercent || 15;
      analysis.estimatedDiameterCm = Math.round((widthPct / 100) * 300);
    }
    analysis.estimatedAreaM2 = parseFloat((Math.PI * Math.pow(analysis.estimatedDiameterCm / 200, 2)).toFixed(2));
    analysis.estimatedDimensions = `~${analysis.estimatedDiameterCm}cm lebar, ~${analysis.estimatedDepthCm}cm dalam`;

    // Persists verified report to Supabase attributed to the authenticated user
    try {
      await adminSupa.from('nadi_infra_reports').insert({
        user_id: user.id,
        lat: lat || 6.1251,
        lng: lng || 102.2345,
        z_dropped: parseFloat((zDropped || magnitudeG || 1.2).toFixed(2)),
        speed_kmh: Math.round(speedKmh || 0),
        waveform_duration_ms: 150,
        confidence_score: 95,
        status: 'verified',
        ai_analysis: analysis,
      });
    } catch (dbErr) {
      console.error('[infra/vision] Supabase insert error:', dbErr);
    }

    return NextResponse.json({ success: true, analysis });
  } catch (error) {
    console.error('Vision analysis error:', error);
    return NextResponse.json(
      { success: false, error: 'Vision analysis failed' },
      { status: 500 }
    );
  }
}
