/**
 * Server-Side Authentication & Authorization Helper
 * 
 * Provides centralized caller session verification for API route handlers.
 * Enforces fail-closed credential validation and rejects anonymous or expired callers
 * before executing privileged service_role operations (CWE-862 Remediation).
 */
import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient, type SupabaseClient, type User } from '@supabase/supabase-js';

export function getAdminSupabase(): SupabaseClient {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dxexikpuezslryywhnnf.supabase.co';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceKey) {
        throw new Error('FATAL: SUPABASE_SERVICE_ROLE_KEY is not configured in the server environment');
    }

    return createSupabaseClient(supabaseUrl, serviceKey);
}

export interface ServerAuthSuccess {
    user: User;
    adminSupa: SupabaseClient;
    token: string;
    errorResponse: null;
}

export interface ServerAuthFailure {
    user: null;
    adminSupa: null;
    token: null;
    errorResponse: NextResponse;
}

export type ServerAuthResult = ServerAuthSuccess | ServerAuthFailure;

/**
 * Requires an authenticated Supabase user session from the Authorization header.
 * Returns either { user, adminSupa, token, errorResponse: null } or an immediate 401 error response.
 */
export async function requireServerAuth(request: Request): Promise<ServerAuthResult> {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;

    if (!token) {
        return {
            user: null,
            adminSupa: null,
            token: null,
            errorResponse: NextResponse.json(
                { success: false, error: 'Autentikasi diperlukan. Sila log masuk untuk meneruskan tindakan ini.' },
                { status: 401 }
            ),
        };
    }

    try {
        const adminSupa = getAdminSupabase();
        const { data: { user }, error: userError } = await adminSupa.auth.getUser(token);

        if (userError || !user) {
            return {
                user: null,
                adminSupa: null,
                token: null,
                errorResponse: NextResponse.json(
                    { success: false, error: 'Sesi pengguna tidak sah atau telah tamat tempoh. Sila log masuk semula.' },
                    { status: 401 }
                ),
            };
        }

        return {
            user,
            adminSupa,
            token,
            errorResponse: null,
        };
    } catch (err: any) {
        console.error('[requireServerAuth] Internal authorization error:', err?.message || err);
        return {
            user: null,
            adminSupa: null,
            token: null,
            errorResponse: NextResponse.json(
                { success: false, error: 'Ralat pengesahan pelayan.' },
                { status: 500 }
            ),
        };
    }
}
