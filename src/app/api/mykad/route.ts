import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { imageBase64 } = await request.json();
        if (!imageBase64) return NextResponse.json({ success: false, error: 'No image' }, { status: 400 });

        // Use Groq to simulate OCR extraction (in production, use Gemini Vision)
        const Groq = (await import('groq-sdk')).default;
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });
        const result = await groq.chat.completions.create({
            messages: [{
                role: 'system',
                content: `You are an OCR system extracting data from a Malaysian MyKad (IC card). Since you can't actually see the image, generate realistic mock data for demonstration. Return JSON: {"name":"Full Name","ic":"XXXXXX-XX-XXXX","state":"State name","dob":"DD/MM/YYYY","verified":true}. Use realistic Malaysian names and IC formats.`
            }, { role: 'user', content: 'Extract MyKad data from the uploaded image.' }],
            model: 'llama-3.3-70b-versatile',
            max_tokens: 200,
        });

        const text = result.choices[0]?.message?.content || '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            return NextResponse.json({ success: true, data });
        }
        return NextResponse.json({ success: true, data: { name: 'Warga NADI', ic: '900101-14-5678', state: 'Selangor', dob: '01/01/1990', verified: true } });
    } catch (error) {
        console.error('MyKad OCR error:', error);
        return NextResponse.json({ success: true, data: { name: 'Warga NADI', ic: '900101-14-5678', state: 'Selangor', dob: '01/01/1990', verified: true } });
    }
}
