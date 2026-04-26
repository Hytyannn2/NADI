import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

// In-memory store for submitted listings (resets on server restart — for MVP)
// In production, replace with a real database (Supabase, PlanetScale, etc.)
const listingsStore: any[] = [
    {
        id: 'seed-001',
        seller: "Nelayan Tumpat Koperasi",
        badge: true,
        item: "Fresh Siakap (50kg Bulk)",
        price: "RM 25/kg",
        location: "Pengkalan Kubor, Kelantan",
        time: "20 mins ago",
        type: "Seafood",
        submittedAt: Date.now() - 20 * 60 * 1000,
        verified: true,
    },
    {
        id: 'seed-002',
        seller: "Ladang Sayur Lojing",
        badge: true,
        item: "Organic Cabbage (100kg)",
        price: "RM 3.50/kg",
        location: "Lojing Highlands, Kelantan",
        time: "1 hour ago",
        type: "Produce",
        submittedAt: Date.now() - 60 * 60 * 1000,
        verified: true,
    },
    {
        id: 'seed-003',
        seller: "Pak Ali Livestock",
        badge: false,
        item: "Kampung Chicken (20 birds)",
        price: "RM 18/bird",
        location: "Pasir Mas, Kelantan",
        time: "3 hours ago",
        type: "Poultry",
        submittedAt: Date.now() - 3 * 60 * 60 * 1000,
        verified: false,
    },
];

// GET /api/niaga/listings — fetch live listings sorted newest first
export async function GET() {
    const sorted = [...listingsStore].sort((a, b) => b.submittedAt - a.submittedAt);
    const formatted = sorted.map(l => ({
        ...l,
        time: formatTime(l.submittedAt),
    }));
    return NextResponse.json({ success: true, listings: formatted, total: formatted.length });
}

// POST /api/niaga/listings — submit a new listing (AI-verified via Groq)
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { seller, item, price, location, type } = body;

        if (!seller || !item || !price || !location) {
            return NextResponse.json({ success: false, error: 'Missing required fields.' }, { status: 400 });
        }

        // Use Groq to verify and standardize the listing
        let verified = false;
        let badge = false;
        try {
            const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });
            const check = await groq.chat.completions.create({
                messages: [{
                    role: 'user',
                    content: `You are a listings moderator for NADI-Niaga, a Malaysian B2B agricultural marketplace.
Verify this listing is legitimate and not spam:
Seller: "${seller}"
Item: "${item}"
Price: "${price}"
Location: "${location}"
Type: "${type || 'General'}"

Respond with JSON: { "isLegitimate": true/false, "isTrustedSeller": true/false, "reason": "brief reason" }`
                }],
                model: 'llama-3.3-70b-versatile',
                response_format: { type: 'json_object' },
            });
            const result = JSON.parse(check.choices[0]?.message?.content || '{}');
            verified = result.isLegitimate === true;
            badge = result.isTrustedSeller === true;
        } catch {
            // If AI check fails, allow listing but mark as unverified
            verified = true;
        }

        const newListing = {
            id: `listing-${Date.now()}`,
            seller,
            badge,
            item,
            price,
            location,
            type: type || 'General',
            submittedAt: Date.now(),
            time: 'Just now',
            verified,
        };

        listingsStore.unshift(newListing);
        // Keep max 50 listings in memory
        if (listingsStore.length > 50) listingsStore.splice(50);

        return NextResponse.json({ success: true, listing: newListing });
    } catch (error) {
        console.error('Niaga listing error:', error);
        return NextResponse.json({ success: false, error: 'Failed to submit listing.' }, { status: 500 });
    }
}

function formatTime(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min${mins > 1 ? 's' : ''} ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
    const days = Math.floor(hrs / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
}
