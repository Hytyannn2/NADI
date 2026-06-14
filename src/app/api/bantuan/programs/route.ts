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
    const langParam = searchParams.get('lang') || 'en';
    const langMap: Record<string, string> = { ms: 'Malay', en: 'English', zh: 'Chinese', ta: 'Tamil', ar: 'Arabic' };
    const targetLang = langMap[langParam] || 'English';

    const GROQ_API_KEY = process.env.GROQ_API_KEY;

    if (!GROQ_API_KEY) {
        return NextResponse.json({ success: false, error: 'API key not configured' }, { status: 500 });
    }

    let locationName = 'Malaysia';
    try {
        // First, reverse geocode to get location name
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
                    content: `You are a Malaysian government aid database. The current year is 2026. Return ONLY valid JSON array of CURRENTLY ACTIVE aid programs available in or near "${locationName}", Malaysia. Do NOT include any expired programs from 2024 or 2025. Include only programs with 2026 deadlines or ongoing programs. Include national programs available everywhere plus local programs. Each item must have: id (string), name (string), provider (string - the actual government body/NGO), type ("government"|"ngo"|"zakat"|"community"), description (string - 1 sentence with amounts if applicable), eligibility (string), status ("active"|"upcoming"), location (string), deadline (string with 2026 dates or "Ongoing" or null), url (string).

CRITICAL INSTRUCTION: You MUST translate the string values of 'name', 'provider', 'description', 'eligibility', and 'location' into ${targetLang}. Keep the exact structure and keys in English.

CRITICAL - Use these EXACT URLs for known programs:
- STR/Sumbangan Tunai Rakyat: "https://str.hasil.gov.my"
- BKM/Bantuan Keluarga Malaysia: "https://bfrm.hasil.gov.my"  
- eKasih: "https://ekasih.icu.gov.my"
- Zakat Selangor: "https://www.zakatselangor.com.my/permohonan-bantuan/"
- Zakat MAIWP/KL: "https://www.maiwp.gov.my/i/index.php/perkhidmatan-kami/agihan-zakat"
- JKM/Jabatan Kebajikan: "https://www.jkm.gov.my/jkm/index.php"
- PTPTN: "https://www.ptptn.gov.my"
- MySTEP: "https://mystep.mohr.gov.my"
- EPF i-Saraan: "https://www.kwsp.gov.my/ms/ahli/caruman/i-saraan"
- Bantuan Sara Hidup: "https://bfrm.hasil.gov.my"
For state-level programs, use the relevant state government or zakat website. 
Return 6-10 programs. ONLY respond with the JSON array, no markdown, no explanation.`
                }, {
                    role: 'user',
                    content: `List current 2026 Malaysian aid programs for residents near ${locationName} (${lat}, ${lng}). Include STR, BKM, zakat, education aid, and local programs. Use the SPECIFIC URLs I provided above for known programs. All dates must be 2026 or Ongoing. Provide output translated into ${targetLang}.`
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
        
        const translate = (en: string, ms: string, zh: string, ta: string, ar: string) => {
            switch (langParam) {
                case 'ms': return ms;
                case 'zh': return zh;
                case 'ta': return ta;
                case 'ar': return ar;
                default: return en;
            }
        };

        // Fallback data when API fails
        const fallbackPrograms = [
            {
                id: 'fallback_1',
                name: 'Sumbangan Tunai Rahmah (STR)',
                provider: translate('Ministry of Finance', 'Kementerian Kewangan', '财政部', 'நிதி அமைச்சகம்', 'وزارة المالية'),
                type: 'government',
                description: translate('Financial assistance for B40 and M40 groups.', 'Bantuan kewangan untuk golongan B40 dan M40.', '为 B40 和 M40 群体提供的财务援助。', 'B40 மற்றும் M40 குழுக்களுக்கான நிதி உதவி.', 'مساعدة مالية لمجموعات B40 و M40.'),
                eligibility: translate('Household income below RM5,000', 'Pendapatan isi rumah bawah RM5,000', '家庭收入低于 RM5,000', 'குடும்ப வருமானம் RM5,000 க்கும் குறைவாக', 'دخل الأسرة أقل من 5,000 رينغيت ماليزي'),
                status: 'active',
                deadline: translate('Ongoing', 'Berterusan', '进行中', 'தொடர்ந்து', 'مستمر'),
                location: locationName || 'Malaysia',
                url: 'https://str.hasil.gov.my'
            },
            {
                id: 'fallback_2',
                name: 'Bantuan Awal Persekolahan (BAP)',
                provider: translate('Ministry of Education', 'Kementerian Pendidikan Malaysia', '教育部', 'கல்வி அமைச்சகம்', 'وزارة التعليم'),
                type: 'government',
                description: translate('RM150 cash assistance for each student.', 'Bantuan tunai RM150 untuk setiap murid.', '每位学生 RM150 的现金援助。', 'ஒவ்வொரு மாணவருக்கும் RM150 ரொக்க உதவி.', 'مساعدة نقدية بقيمة 150 رينغيت ماليزي لكل طالب.'),
                eligibility: translate('School students', 'Murid sekolah', '在校学生', 'பள்ளி மாணவர்கள்', 'طلاب المدارس'),
                status: 'active',
                deadline: translate('Ongoing', 'Berterusan', '进行中', 'தொடர்ந்து', 'مستمر'),
                location: locationName || 'Malaysia',
                url: 'https://www.moe.gov.my'
            }
        ];
        
        return NextResponse.json({
            success: true,
            error: 'Using fallback data due to API error',
            programs: fallbackPrograms,
            location: locationName,
            total: fallbackPrograms.length,
        });
    }
}
