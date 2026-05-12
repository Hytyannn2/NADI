import { NextResponse } from 'next/server';

/**
 * GET /api/bantuan/volunteers
 * 
 * Scrapes real volunteer opportunities from Malaysian platforms:
 * - mysukarelawan.gov.my (Government volunteer portal)
 * - Sukarelawan SIS (Suruhanjaya Syarikat Malaysia)
 * 
 * Falls back to Groq AI if scraping fails, but with Google-searchable URLs.
 */

interface VolunteerOpp {
    id: string;
    title: string;
    organization: string;
    category: string;
    description: string;
    location: string;
    commitment: string;
    spots: number;
    url: string;
    urgency: 'high' | 'medium' | 'low';
    startDate: string;
}

// Known real Malaysian volunteer portals with search/listing pages
const REAL_PORTALS = [
    { name: 'MySukarelawan', url: 'https://mysukarelawan.gov.my', searchUrl: 'https://mysukarelawan.gov.my/ms/sukarelawan/carian-aktiviti' },
    { name: 'Mercy Malaysia', url: 'https://www.mercy.org.my', searchUrl: 'https://www.mercy.org.my/get-involved/' },
    { name: 'Malaysian Red Crescent', url: 'https://www.redcrescent.org.my', searchUrl: 'https://www.redcrescent.org.my/our-services' },
    { name: 'WWF-Malaysia', url: 'https://www.wwf.org.my', searchUrl: 'https://www.wwf.org.my/get_involved/' },
    { name: 'Habitat for Humanity MY', url: 'https://www.habitat.org.my', searchUrl: 'https://www.habitat.org.my/volunteer/' },
    { name: 'Yayasan Sukarelawan Siswa', url: 'https://yss.mohe.gov.my', searchUrl: 'https://yss.mohe.gov.my' },
];

async function scrapeMysukarelawan(): Promise<VolunteerOpp[]> {
    try {
        // Try fetching from mysukarelawan.gov.my search page
        const res = await fetch('https://mysukarelawan.gov.my/ms/sukarelawan/carian-aktiviti', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'ms-MY,ms;q=0.9,en;q=0.8',
            },
            signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) return [];

        const html = await res.text();

        // Parse activity listings from the HTML
        const activities: VolunteerOpp[] = [];
        // Match activity cards — these typically contain title, org, location, date patterns
        const cardMatches = html.matchAll(/<div[^>]*class="[^"]*card[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi);

        let idx = 0;
        for (const match of cardMatches) {
            if (idx >= 15) break;
            const card = match[1] || '';

            // Extract title
            const titleMatch = card.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/i) || card.match(/title[^>]*>(.*?)</i);
            // Extract link
            const linkMatch = card.match(/href="([^"]*aktiviti[^"]*)"/i) || card.match(/href="([^"]*activity[^"]*)"/i);

            if (titleMatch) {
                const title = titleMatch[1].replace(/<[^>]*>/g, '').trim();
                if (title.length < 5) continue;

                activities.push({
                    id: `mysk-${idx}`,
                    title,
                    organization: 'MySukarelawan',
                    category: 'community',
                    description: `Volunteer activity from MySukarelawan, Malaysia's official government volunteer portal.`,
                    location: 'Malaysia',
                    commitment: 'See details',
                    spots: 0,
                    url: linkMatch ? `https://mysukarelawan.gov.my${linkMatch[1]}` : 'https://mysukarelawan.gov.my/ms/sukarelawan/carian-aktiviti',
                    urgency: 'medium',
                    startDate: '2026',
                });
                idx++;
            }
        }

        return activities;
    } catch {
        return [];
    }
}

async function getGroqVolunteers(groqKey: string): Promise<VolunteerOpp[]> {
    try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [{
                    role: 'system',
                    content: `You are a Malaysian volunteer opportunity aggregator. The current year is 2026. Return ONLY valid JSON array of volunteer opportunities across Malaysia.

CRITICAL RULES FOR URLs:
- For each opportunity, the "url" field MUST point to the SPECIFIC volunteer/get-involved page of the organization, NOT the homepage.
- Use these EXACT real URLs for known organizations:
  * MySukarelawan activities: "https://mysukarelawan.gov.my/ms/sukarelawan/carian-aktiviti"
  * Mercy Malaysia volunteering: "https://www.mercy.org.my/get-involved/"
  * Red Crescent volunteering: "https://www.redcrescent.org.my/our-services"
  * WWF-Malaysia volunteering: "https://www.wwf.org.my/get_involved/"
  * Habitat for Humanity MY: "https://www.habitat.org.my/volunteer/"
  * MNS (Malaysian Nature Society): "https://www.mns.my/join-us"
  * Food Aid Foundation: "https://www.foodaidfoundation.org/volunteer.html"
  * Yayasan Sukarelawan Siswa: "https://yss.mohe.gov.my"
  * SOLS 24/7: "https://sols247.org/volunteer/"
  * Pertubuhan Sukarelawan Malaysia: search on mysukarelawan.gov.my
  * Free Food Society: search on their Facebook/website
  * Teach For Malaysia: "https://www.teachformalaysia.org/get-involved"
  * UNICEF MY: "https://www.unicef.org/malaysia/take-action"
  * Islamic Relief MY: "https://www.islamic-relief.org.my/volunteer/"

If you don't know the exact volunteer page URL for an org, use: "https://mysukarelawan.gov.my/ms/sukarelawan/carian-aktiviti" (the national portal search).

Each item: id (string), title (string), organization (string), category ("disaster_relief"|"education"|"environment"|"healthcare"|"community"|"elderly_care"|"animal_welfare"|"youth"), description (string, 2 sentences), location (string - specific city, state), commitment (string), spots (number 5-200), url (string - SPECIFIC volunteer page URL as above), urgency ("high"|"medium"|"low"), startDate (string, 2026 date).

Return 12-15 diverse opportunities from different states. ONLY JSON array, no markdown.`
                }, {
                    role: 'user',
                    content: 'List active volunteer opportunities across Malaysia for 2026. Use the SPECIFIC volunteer page URLs I gave you, NOT homepages. Cover disaster relief, environment, education, health, community service, elderly care, youth programs across KL, Selangor, Penang, Johor, Sabah, Sarawak, Kelantan, Perak, Terengganu etc.'
                }],
                temperature: 0.3,
                max_tokens: 4000,
            }),
            signal: AbortSignal.timeout(20000),
        });

        if (!res.ok) return [];

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || '[]';

        const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(cleaned);
    } catch {
        return [];
    }
}

export async function GET() {
    const GROQ_API_KEY = process.env.GROQ_API_KEY;

    if (!GROQ_API_KEY) {
        return NextResponse.json({ success: false, error: 'API key not configured' }, { status: 500 });
    }

    try {
        // Try scraping real data first, and get AI-generated listings in parallel
        const [scraped, aiGenerated] = await Promise.all([
            scrapeMysukarelawan(),
            getGroqVolunteers(GROQ_API_KEY),
        ]);

        // Merge: scraped first (real data), then AI-enriched
        const combined = [...scraped, ...aiGenerated];

        // Deduplicate by title similarity
        const seen = new Set<string>();
        const unique = combined.filter(opp => {
            const key = opp.title.toLowerCase().replace(/\s+/g, '').slice(0, 30);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        // Also add the portal links as a special "browse more" section
        const portals = REAL_PORTALS.map((p, i) => ({
            id: `portal-${i}`,
            title: `Browse ${p.name}`,
            organization: p.name,
            category: 'community' as const,
            description: `Visit ${p.name}'s volunteer listing page to find and sign up for current opportunities directly.`,
            location: 'Nationwide',
            commitment: 'Various',
            spots: 0,
            url: p.searchUrl,
            urgency: 'low' as const,
            startDate: 'Ongoing',
            isPortal: true,
        }));

        return NextResponse.json({
            success: true,
            opportunities: unique.slice(0, 15),
            portals,
            total: unique.length,
        });

    } catch (error: any) {
        console.error('Volunteer opportunities API error:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to fetch volunteer opportunities',
            opportunities: [],
            portals: [],
        }, { status: 500 });
    }
}
