/**
 * Officer Review API
 *
 * GET  — pending PPS corrections, open Aduan reports and recent audit log, filtered by role.
 * POST — { queue: 'pps' | 'infra', id, action, note? } changes a record's status and audits it.
 */
import { NextResponse } from 'next/server';
import { requireOfficer } from '@/src/lib/auth/serverAuth';
import { getClientIp } from '@/src/lib/rateLimit';

const QUEUES = {
    pps: {
        table: 'nadi_pps_corrections',
        roles: ['super_admin', 'bencana_officer'],
        actions: { approve: 'approved', reject: 'rejected' } as Record<string, string>,
    },
    infra: {
        table: 'nadi_infra_reports',
        roles: ['super_admin', 'infra_officer'],
        actions: { verify: 'verified', resolve: 'resolved', reject: 'rejected' } as Record<string, string>,
    },
};
const OFFICER_ROLES = ['super_admin', 'bencana_officer', 'infra_officer'];

export async function GET(request: Request) {
    const { user, adminSupa, errorResponse } = await requireOfficer(request, OFFICER_ROLES);
    if (errorResponse) return errorResponse;

    const role: string = user.app_metadata.role;
    let audit = adminSupa
        .from('nadi_admin_audit_logs')
        .select('id, admin_id, action, target_table, target_id, changes, created_at')
        .order('created_at', { ascending: false })
        .limit(20);
    if (role !== 'super_admin') audit = audit.eq('admin_id', user.id);

    const [pps, infra, log] = await Promise.all([
        QUEUES.pps.roles.includes(role)
            ? adminSupa.from('nadi_pps_corrections')
                .select('id, center_name, jajahan, suggested_lat, suggested_lng, notes, created_at')
                .eq('status', 'pending')
                .order('created_at')
                .limit(100)
            : null,
        QUEUES.infra.roles.includes(role)
            ? adminSupa.from('nadi_infra_reports')
                .select('id, title, lat, lng, status, confidence_score, ai_analysis, photo_url, created_at')
                .in('status', ['pending', 'verified'])
                .order('created_at', { ascending: false })
                .limit(50)
            : null,
        audit,
    ]);

    const error = pps?.error || infra?.error || log.error;
    if (error) {
        console.error('[api/admin] GET error:', error.message);
        return NextResponse.json({ success: false, error: 'Gagal memuatkan data semakan.' }, { status: 500 });
    }

    return NextResponse.json({
        success: true,
        role,
        pps: pps?.data ?? null,
        infra: infra?.data ?? null,
        audit: log.data,
    });
}

export async function POST(request: Request) {
    const body = await request.json().catch(() => null);
    const queue = QUEUES[body?.queue as keyof typeof QUEUES];
    const status = queue?.actions[body?.action];
    if (!queue || !status || typeof body.id !== 'string') {
        return NextResponse.json({ success: false, error: 'Permintaan tidak sah.' }, { status: 400 });
    }

    const { user, adminSupa, errorResponse } = await requireOfficer(request, queue.roles);
    if (errorResponse) return errorResponse;

    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 300) || null : null;
    const patch = queue.table === 'nadi_pps_corrections'
        ? { status, reviewed_by: user.id, reviewed_at: new Date().toISOString(), review_notes: note }
        : { status };

    const { data, error } = await adminSupa
        .from(queue.table)
        .update(patch)
        .eq('id', body.id)
        .select('id')
        .maybeSingle();

    if (error) {
        console.error('[api/admin] update error:', error.message);
        return NextResponse.json({ success: false, error: 'Gagal mengemas kini rekod.' }, { status: 500 });
    }
    if (!data) {
        return NextResponse.json({ success: false, error: 'Rekod tidak dijumpai.' }, { status: 404 });
    }

    // ponytail: update + audit are two writes, not one transaction. Move both into one
    // SQL function if an unlogged change is ever unacceptable.
    const { error: auditError } = await adminSupa.from('nadi_admin_audit_logs').insert({
        admin_id: user.id,
        action: `${body.queue}_${body.action}`.toUpperCase(),
        target_table: queue.table,
        target_id: body.id,
        changes: { status, note },
        ip_address: getClientIp(request.headers),
    });
    if (auditError) console.error('[api/admin] audit insert failed:', auditError.message);

    return NextResponse.json({ success: true, status });
}
