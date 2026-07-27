import { NextResponse } from 'next/server';
import { evaluateAllEligibility, type UserProfile, type AidProgram } from '@/src/utils/eligibilityEngine';

/**
 * POST /api/bantuan/match
 * 
 * Instant, zero-token deterministic eligibility matcher endpoint.
 * Replaced LLM Groq dependency with client/server shared rule engine.
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { profile, programs } = body as { profile: UserProfile; programs: AidProgram[] };
        
        if (!profile) {
            return NextResponse.json({ success: false, error: 'Tiada data profil diberikan.' }, { status: 400 });
        }

        const aidPrograms = Array.isArray(programs) ? programs : [];
        const matchesDict = evaluateAllEligibility(profile, aidPrograms);
        
        // Convert dictionary to array format for response compatibility
        const matches = Object.values(matchesDict);

        return NextResponse.json({
            success: true,
            matches,
            engine: 'deterministic-v2', // zero-token instant rule engine
        });
    } catch (error) {
        console.error('Eligibility matching error:', error);
        return NextResponse.json({ success: false, error: 'Gagal menyemak kelayakan.' }, { status: 500 });
    }
}
