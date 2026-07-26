import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { checkInfraAnalyzeLimit } from '@/src/lib/rateLimit';
import { headers } from 'next/headers';

export async function POST(request: Request) {
    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || headersList.get('x-real-ip') || 'unknown';
    const limit = checkInfraAnalyzeLimit(ip);
    if (!limit.allowed) {
        return NextResponse.json({ success: false, error: limit.message }, { status: 429 });
    }

    try {
        const body = await request.json();
        const { lat, lng, zDropped, verifications, confidenceScore, speedKmh, clusterSize } = body;

        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });

        // Enhanced prompt with sensor fusion data
        const sensorFusionContext = confidenceScore != null
            ? `\n- Sensor Fusion Confidence Score: ${confidenceScore}/100 (from 5-layer filter: Speed Gate, Waveform Signature, Gyroscope Stability, Debounce, Magnitude)
- Vehicle speed at detection: ${speedKmh || 'unknown'} km/h
- Crowdsource cluster size: ${clusterSize || 1} unique device(s) reported this location
- Note: Higher confidence scores indicate stronger evidence of a real pothole. Scores below 60 are filtered out before reaching this API.`
            : '';

        const prompt = `You are an infrastructure analysis AI for a Malaysian civic OS called NADI.
Analyze this pothole/road anomaly data detected by a phone's accelerometer with sensor fusion:

- GPS Coordinates: ${lat}°N, ${lng}°E
- Z-axis drop magnitude: ${Math.abs(zDropped).toFixed(1)}g (gravitational units, baseline-calibrated)
- Independent verifications: ${verifications}/15 passes${sensorFusionContext}
- Country context: Malaysia (tropical, heavy monsoon rain, laterite soil)

Based on this data, provide your analysis strictly in this JSON format:
{
  "severityScore": <1-5 integer, 1=minor crack, 5=dangerous sinkhole>,
  "severityLabel": "<Minor|Moderate|Severe|Critical|Dangerous>",
  "damageType": "<Pothole|Crack|Subsidence|Depression|Sinkhole>",
  "estimatedWidth": "<e.g. 30-50cm>",
  "estimatedDepth": "<e.g. 5-10cm>",
  "repairMethod": "<Recommended repair method>",
  "repairCostMYR": "<Estimated cost range in RM>",
  "priorityScore": <0-100 float>,
  "riskAssessment": "<One sentence about danger to motorists>",
  "nearestRoadType": "<Highway|Urban|Rural|Residential based on GPS>",
  "recommendedAction": "<Immediate|Monitor|Scheduled>"
}`;

        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.3-70b-versatile',
            response_format: { type: 'json_object' }
        });

        const analysis = JSON.parse(chatCompletion.choices[0]?.message?.content || '{}');

        return NextResponse.json({ success: true, analysis });
    } catch (error) {
        console.error('Infra analysis error:', error);
        return NextResponse.json(
            { success: false, error: 'Analysis failed' },
            { status: 500 }
        );
    }
}
