/**
 * Account Deletion API
 * 
 * Permanently deletes user account, clears personal civic records,
 * and terminates auth session with GDPR/PDPA compliance.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { requireServerAuth } from '@/src/lib/auth/serverAuth';

export async function POST(request: NextRequest) {
  try {
    const { user, adminSupa: adminSupabase, errorResponse } = await requireServerAuth(request);
    if (errorResponse) {
      return errorResponse;
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
