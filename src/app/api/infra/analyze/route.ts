/**
 * Infrastructure Defect Triage Route
 * 
 * Uses Groq LLaMA to evaluate citizen text reports or accelerometer pothole telemetry,
 * estimating severity, dimensions, repair method, and municipal repair costs.
 */
import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { checkInfraAnalyzeLimit, getClientIp, addRateLimitHeaders } from '@/src/lib/rateLimit';
import { headers } from 'next/headers';
import { DEFAULT_LOCATION } from '@/src/config/constants';

export async function POST(request: Request) {
    const headersList = await headers();
    const ip = getClientIp(headersList);
    const limit = checkInfraAnalyzeLimit(ip);
    if (!limit.allowed) {
        const errRes = NextResponse.json({ success: false, error: limit.message, retryAfter: limit.retryAfterSeconds }, { status: 429 });
        return addRateLimitHeaders(errRes, limit);
    }

    try {
        const body = await request.json();
        const { lat, lng, zDropped, verifications, confidenceScore, speedKmh, clusterSize, originalText, translatedText, title, locationName, source } = body;

        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });

        const isVoiceOrTextReport = Boolean(originalText || translatedText || (source && source !== 'sensor'));

        let prompt = '';
        if (isVoiceOrTextReport) {
            prompt = `You are an infrastructure & civic report analysis AI for a Malaysian civic OS called NADI.
Analyze this citizen report:

- Title / Issue: ${title || 'Aduan Infrastruktur'}
- Original Citizen Input: "${originalText || '—'}"
- Translated / Normalized Text: "${translatedText || originalText || '—'}"
- Location: ${locationName || DEFAULT_LOCATION.label} (${lat}°N, ${lng}°E)
- Country context: Malaysia (Kelantan / PBT local council governance)

Provide your analysis strictly in this JSON format:
{
  "severityScore": <1-5 integer based on urgency>,
  "severityLabel": "<Minor|Moderate|Severe|Critical|Dangerous>",
  "damageType": "<Issue category in Malay e.g. Jalan Berlubang, Lampu Jalan, Longkang, Paip Bocor, Sampah, Aduan Warga>",
  "estimatedWidth": "<e.g. 0.5m - 1.0m or N/A>",
  "estimatedDepth": "<e.g. 5cm - 10cm or N/A>",
  "repairMethod": "<Recommended action by local authority PBT>",
  "repairCostMYR": "<Estimated cost range e.g. RM 150 - RM 500>",
  "priorityScore": <0-100 float>,
  "riskAssessment": "<Concise 1-sentence risk summary based on the citizen's actual words. Do not invent unmentioned defects.>",
  "nearestRoadType": "<Urban|Rural|Residential|Highway>",
  "recommendedAction": "<Penilaian Tapak|Penugasan Skuad|Penyelenggaraan Berkala>"
}`;
        } else {
            // Formats prompt with sensor fusion telemetry for accelerometer-detected road anomalies
            const sensorFusionContext = confidenceScore != null
                ? `\n- Sensor Fusion Confidence Score: ${confidenceScore}/100 (from 5-layer filter: Speed Gate, Waveform Signature, Gyroscope Stability, Debounce, Magnitude)
- Vehicle speed at detection: ${speedKmh || 'unknown'} km/h
- Crowdsource cluster size: ${clusterSize || 1} unique device(s) reported this location
- Note: Higher confidence scores indicate stronger evidence of a real pothole.`
                : '';

            prompt = `You are an infrastructure analysis AI for a Malaysian civic OS called NADI.
Analyze this pothole/road anomaly data detected by a phone's accelerometer with sensor fusion:

- GPS Coordinates: ${lat}°N, ${lng}°E
- Z-axis drop magnitude: ${Math.abs(zDropped || 2.5).toFixed(1)}g (gravitational units, baseline-calibrated)
- Independent verifications: ${verifications || 1}/15 passes${sensorFusionContext}
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
        }

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
