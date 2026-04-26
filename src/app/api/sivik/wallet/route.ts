import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

// In-memory Sivik wallet per IP (replace with DB in production)
const walletStore = new Map<string, {
    balance: number;
    trustScore: number;
    co2Saved: number;
    rideStreak: number;
    streakDay: number;
    transactions: Array<{
        id: number;
        title: string;
        type: 'earn' | 'spend';
        amount: number;
        category: string;
        time: string;
        notes: string;
        ts: number;
    }>;
}>();

function getOrCreate(ip: string) {
    if (!walletStore.has(ip)) {
        walletStore.set(ip, {
            balance: 0,
            trustScore: 72,
            co2Saved: 0,
            rideStreak: 0,
            streakDay: 0,
            transactions: [],
        });
    }
    return walletStore.get(ip)!;
}

function formatTime(ts: number): string {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 2) return 'Just now';
    if (mins < 60) return `${mins} mins ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
}

// GET /api/sivik/wallet — get wallet state
export async function GET() {
    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || headersList.get('x-real-ip') || 'local';
    const wallet = getOrCreate(ip);
    return NextResponse.json({
        success: true,
        balance: wallet.balance,
        trustScore: wallet.trustScore,
        co2Saved: wallet.co2Saved,
        rideStreak: wallet.rideStreak,
        streakDay: wallet.streakDay,
        transactions: wallet.transactions.map(t => ({ ...t, time: formatTime(t.ts) })).slice(0, 20),
    });
}

// POST /api/sivik/wallet — record a transaction
export async function POST(request: Request) {
    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || headersList.get('x-real-ip') || 'local';
    const wallet = getOrCreate(ip);

    try {
        const body = await request.json();
        const { action, title, amount, category, notes } = body;

        if (action === 'earn' || action === 'spend') {
            const delta = action === 'earn' ? Math.abs(amount) : -Math.abs(amount);
            wallet.balance = Math.max(0, wallet.balance + delta);

            // Update trust score based on positive actions
            if (action === 'earn') {
                wallet.trustScore = Math.min(100, wallet.trustScore + 1);
            }

            // CO2 savings for transit rides
            if (category === 'Transit' && action === 'spend') {
                wallet.co2Saved = parseFloat((wallet.co2Saved + 0.8).toFixed(1)); // ~0.8kg CO2 per bus ride
                // Update ride streak
                const today = new Date().toDateString();
                if (wallet.streakDay !== parseInt(today.slice(-2))) {
                    wallet.streakDay = parseInt(today.slice(-2));
                    wallet.rideStreak = Math.min(wallet.rideStreak + 1, 30);
                }
            }

            const tx = {
                id: Date.now(),
                title: title || (action === 'earn' ? 'Civic Activity' : 'Payment'),
                type: action,
                amount: delta,
                category: category || 'General',
                notes: notes || '',
                time: 'Just now',
                ts: Date.now(),
            };
            wallet.transactions.unshift(tx);
            if (wallet.transactions.length > 50) wallet.transactions.splice(50);

            return NextResponse.json({
                success: true,
                balance: wallet.balance,
                trustScore: wallet.trustScore,
                co2Saved: wallet.co2Saved,
                rideStreak: wallet.rideStreak,
                transaction: tx,
            });
        }

        return NextResponse.json({ success: false, error: 'Unknown action.' }, { status: 400 });
    } catch (error) {
        console.error('Sivik wallet error:', error);
        return NextResponse.json({ success: false, error: 'Transaction failed.' }, { status: 500 });
    }
}
