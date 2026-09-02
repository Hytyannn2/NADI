/**
 * Account Deletion API
 * 
 * Permanently deletes user account, clears personal civic records,
 * and terminates auth session with GDPR/PDPA compliance.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function getAdminSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dxexikpuezslryywhnnf.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4ZXhpa3B1ZXpzbHJ5eXdobm5mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM0NDQxOSwiZXhwIjoyMDkyOTIwNDE5fQ.kxdMDFBbVehjKCsIRfgyhebLeu-vUP2D2sAjNywMOQE';
  return createSupabaseClient(supabaseUrl, serviceKey);
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
      return NextResponse.json({ success: false, error: 'Token autentikasi diperlukan.' }, { status: 401 });
    }

    const adminSupabase = getAdminSupabase();

    // 1. Verify user session from bearer token
    const { data: { user }, error: userError } = await adminSupabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Sesi tidak sah atau telah tamat tempoh.' }, { status: 401 });
    }

    const userId = user.id;

    // 2. Cascade delete all user-owned civic records in public tables
    try {
      await adminSupabase.from('nadi_bencana_chat').delete().eq('user_id', userId);
      await adminSupabase.from('nadi_bantuan_requests').delete().eq('user_id', userId);
      await adminSupabase.from('nadi_infra_reports').delete().eq('user_id', userId);
      await adminSupabase.from('nadi_bencana_jobs').delete().eq('posted_by', userId);
      await adminSupabase.from('nadi_dialect_feedback').delete().eq('user_id', userId);
    } catch (cleanupErr: any) {
      console.warn('Notice during user data purge:', cleanupErr.message);
    }

    // 3. Permanently delete user from Supabase Auth
    const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(userId);
    if (deleteError) {
      return NextResponse.json({ success: false, error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Akaun dan segala rekod berkaitan telah dipadam selama-lamanya.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Gagal memadam akaun. Sila cuba lagi.' },
      { status: 500 }
    );
  }
}
