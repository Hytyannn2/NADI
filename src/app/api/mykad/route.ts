import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST(request: Request) {
    try {
        const { imageBase64 } = await request.json();
        if (!imageBase64) return NextResponse.json({ success: false, error: 'No image' }, { status: 400 });

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return NextResponse.json({ success: false, error: 'API key missing' }, { status: 500 });

        const ai = new GoogleGenAI({ apiKey });
        
        // Strip data:image prefix if present to get raw base64
        const base64Data = imageBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");

        const prompt = `You are a strict OCR system extracting data from a Malaysian MyKad (Identity Card).
Analyze this image and return ONLY a valid JSON object matching this structure:
{"name":"Full Name extracted","ic":"XXXXXX-XX-XXXX","state":"State name inferred from code","dob":"DD/MM/YYYY","verified":true}
If the image is completely unreadable, blurry, or not an ID card, return {"verified":false}.
Do not hallucinate names. Extract exactly what is on the card.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                prompt,
                { inlineData: { data: base64Data, mimeType: 'image/jpeg' } }
            ],
            config: {
                temperature: 0.1,
                responseMimeType: "application/json"
            }
        });

        const text = response.text;
        if (!text) throw new Error("Empty response from AI");
        
        const data = JSON.parse(text);
        
        if (data.verified !== false && data.name && data.ic) {
            return NextResponse.json({ success: true, data: { ...data, verified: true } });
        } else {
            return NextResponse.json({ success: false, error: 'Failed to extract valid data or not an ID', data: { verified: false } });
        }

    } catch (error) {
        console.error('MyKad OCR error:', error);
        return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
    }
}
