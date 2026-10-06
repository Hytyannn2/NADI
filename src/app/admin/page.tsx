/**
 * Officer Review Page (/admin)
 *
 * Closes the citizen → officer loop: approve/reject PPS location corrections and
 * verify/resolve/reject Aduan reports. All authorization happens in /api/admin;
 * this page only renders what that API returns for the caller's role.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, X, MapPin, ShieldCheck, Wrench, History } from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { ALL_KELANTAN_PPS_CENTERS } from '@/src/data/kelantanPpsCenters';
import { haversineKm, formatReportRelative } from '@/src/lib/format';

interface PpsCorrection {
    id: string; center_name: string; jajahan: string;
    suggested_lat: number; suggested_lng: number; notes: string | null; created_at: string;
}
interface InfraReport {
    id: string; title: string | null; lat: string; lng: string; status: 'pending' | 'verified';
    confidence_score: number | null; photo_url: string | null; created_at: string;
    ai_analysis: { damageType?: string; severityScore?: number; riskAssessment?: string; routingAgency?: string; originalText?: string } | null;
}
interface AuditEntry { id: string; action: string; target_id: string; changes: { note?: string | null } | null; created_at: string }
interface AdminData { role: string; pps: PpsCorrection[] | null; infra: InfraReport[] | null; audit: AuditEntry[] }

const ROLE_LABEL: Record<string, string> = {
    super_admin: 'Super Admin', bencana_officer: 'Pegawai Bencana', infra_officer: 'Pegawai Infra',
};
const ACTION_LABEL: Record<string, string> = {
    PPS_APPROVE: 'Lulus lokasi PPS', PPS_REJECT: 'Tolak lokasi PPS',
    INFRA_VERIFY: 'Sahkan aduan', INFRA_RESOLVE: 'Aduan selesai', INFRA_REJECT: 'Tolak aduan',
};

const mapsUrl = (lat: number, lng: number) => `https://www.google.com/maps?q=${lat},${lng}`;

export default function AdminPage() {
    const { session, loading } = useAuth();
    const [data, setData] = useState<AdminData | null>(null);
    const [error, setError] = useState<{ status: number; message: string } | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);

    const token = session?.access_token;

    const load = useCallback(async () => {
        if (!token) return;
        const res = await fetch('/api/admin', { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json().catch(() => ({}));
        if (res.ok) { setData(json); setError(null); }
        else setError({ status: res.status, message: json.error || 'Ralat tidak diketahui.' });
    }, [token]);

    useEffect(() => { load(); }, [load]);

    const act = async (queue: 'pps' | 'infra', id: string, action: string) => {
        const note = action === 'reject' ? window.prompt('Sebab penolakan (pilihan):') : null;
        if (note === null && action === 'reject') return; // cancelled
        setBusyId(id);
        const res = await fetch('/api/admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ queue, id, action, note }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) window.alert(json.error || 'Tindakan gagal.');
        await load();
        setBusyId(null);
    };

    if (loading) return <Shell><p className="text-[var(--text-muted)]">Memuatkan…</p></Shell>;
    if (!session) return <Shell><Notice title="Sila log masuk" body="Log masuk dengan akaun pegawai di halaman utama, kemudian kembali ke /admin." /></Shell>;
    if (error?.status === 403) return <Shell><Notice title="Akses ditolak" body="Akaun ini belum dilantik sebagai pegawai. Minta Super Admin melantik anda, kemudian log keluar dan masuk semula." /></Shell>;
    if (error) return <Shell><Notice title="Ralat" body={error.message} /></Shell>;
    if (!data) return <Shell><p className="text-[var(--text-muted)]">Memuatkan…</p></Shell>;

    return (
        <Shell role={data.role}>
            {data.pps && (
                <Section icon={<MapPin className="w-4 h-4" />} title="Semakan Lokasi PPS" count={data.pps.length}>
                    {data.pps.length === 0 && <Empty />}
                    {data.pps.map(p => {
                        const current = ALL_KELANTAN_PPS_CENTERS.find(c => c.name === p.center_name && c.jajahan === p.jajahan)
                            ?? ALL_KELANTAN_PPS_CENTERS.find(c => c.name === p.center_name);
                        const offsetM = current ? Math.round(haversineKm(current.lat, current.lng, p.suggested_lat, p.suggested_lng) * 1000) : null;
                        // Other citizens who pinned this centre within 50 m of the same spot
                        const agreeing = data.pps!.filter(o => o.center_name === p.center_name
                            && haversineKm(o.suggested_lat, o.suggested_lng, p.suggested_lat, p.suggested_lng) <= 0.05).length;
                        return (
                            <Card key={p.id}>
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div>
                                        <h3 className="font-bold">{p.center_name}</h3>
                                        <p className="text-xs text-[var(--text-muted)]">{p.jajahan} · {formatReportRelative(p.created_at)}</p>
                                    </div>
                                    {agreeing > 1 && <Pill tone="success">{agreeing} cadangan sepadan</Pill>}
                                </div>
                                <div className="grid sm:grid-cols-2 gap-2 text-sm">
                                    <div className="rounded-lg bg-[var(--bg-subtle)] p-2.5">
                                        <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-bold">Lokasi semasa {current && !current.isExact && '(anggaran)'}</p>
                                        {current
                                            ? <a className="text-[var(--accent)] underline" href={mapsUrl(current.lat, current.lng)} target="_blank" rel="noopener noreferrer">{current.lat.toFixed(5)}, {current.lng.toFixed(5)}</a>
                                            : <span className="text-[var(--text-muted)]">Tiada dalam set data</span>}
                                    </div>
                                    <div className="rounded-lg bg-[var(--bg-subtle)] p-2.5">
                                        <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-bold">Cadangan warga {offsetM !== null && `· ${offsetM} m dari semasa`}</p>
                                        <a className="text-[var(--accent)] underline" href={mapsUrl(p.suggested_lat, p.suggested_lng)} target="_blank" rel="noopener noreferrer">{p.suggested_lat.toFixed(5)}, {p.suggested_lng.toFixed(5)}</a>
                                    </div>
                                </div>
                                {p.notes && <p className="text-sm text-[var(--text-secondary)]">“{p.notes}”</p>}
                                <Actions busy={busyId === p.id} buttons={[
                                    { label: 'Luluskan', tone: 'success', onClick: () => act('pps', p.id, 'approve') },
                                    { label: 'Tolak', tone: 'danger', onClick: () => act('pps', p.id, 'reject') },
                                ]} />
                            </Card>
                        );
                    })}
                </Section>
            )}

            {data.infra && (
                <Section icon={<Wrench className="w-4 h-4" />} title="Triage Aduan" count={data.infra.length}>
                    {data.infra.length === 0 && <Empty />}
                    {data.infra.map(r => {
                        const ai = r.ai_analysis;
                        const lat = Number(r.lat), lng = Number(r.lng);
                        return (
                            <Card key={r.id}>
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <h3 className="font-bold break-words">{r.title || ai?.damageType || 'Aduan Infrastruktur'}</h3>
                                        <p className="text-xs text-[var(--text-muted)]">
                                            {formatReportRelative(r.created_at)}
                                            {ai?.routingAgency && ` · ${ai.routingAgency}`}
                                            {ai?.severityScore && ` · Keterukan ${ai.severityScore}/5`}
                                        </p>
                                    </div>
                                    <Pill tone={r.status === 'verified' ? 'success' : 'muted'}>{r.status === 'verified' ? 'Disahkan' : 'Dalam Semakan'}</Pill>
                                </div>
                                <div className="flex gap-3">
                                    {r.photo_url && (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={r.photo_url} alt="Gambar aduan" className="w-24 h-24 object-cover rounded-lg shrink-0 border border-[var(--border-default)]" />
                                    )}
                                    <div className="text-sm text-[var(--text-secondary)] space-y-1 min-w-0">
                                        {ai?.originalText && <p className="break-words">“{ai.originalText}”</p>}
                                        {ai?.riskAssessment && <p className="break-words">{ai.riskAssessment}</p>}
                                        {lat && lng ? <a className="text-[var(--accent)] underline" href={mapsUrl(lat, lng)} target="_blank" rel="noopener noreferrer">{lat.toFixed(5)}, {lng.toFixed(5)}</a> : null}
                                    </div>
                                </div>
                                <Actions busy={busyId === r.id} buttons={r.status === 'pending'
                                    ? [
                                        { label: 'Sahkan', tone: 'success', onClick: () => act('infra', r.id, 'verify') },
                                        { label: 'Tolak', tone: 'danger', onClick: () => act('infra', r.id, 'reject') },
                                    ]
                                    : [
                                        { label: 'Tandakan Selesai', tone: 'success', onClick: () => act('infra', r.id, 'resolve') },
                                        { label: 'Tolak', tone: 'danger', onClick: () => act('infra', r.id, 'reject') },
                                    ]} />
                            </Card>
                        );
                    })}
                </Section>
            )}

            <Section icon={<History className="w-4 h-4" />} title="Log Audit" count={data.audit.length}>
                {data.audit.length === 0 && <Empty />}
                <ul className="text-sm divide-y divide-[var(--border-subtle)]">
                    {data.audit.map(a => (
                        <li key={a.id} className="py-2 flex flex-wrap justify-between gap-2">
                            <span>
                                <b>{ACTION_LABEL[a.action] || a.action}</b>
                                <span className="text-[var(--text-muted)] font-mono text-xs"> #{a.target_id.slice(0, 8)}</span>
                                {a.changes?.note && <span className="text-[var(--text-secondary)]"> — {a.changes.note}</span>}
                            </span>
                            <span className="text-xs text-[var(--text-muted)]">{formatReportRelative(a.created_at)}</span>
                        </li>
                    ))}
                </ul>
            </Section>
        </Shell>
    );
}

function Shell({ role, children }: { role?: string; children: React.ReactNode }) {
    return (
        <div className="h-full overflow-y-auto bg-[var(--bg-base)] text-[var(--text-primary)]">
            <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
                <header className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <Link href="/" aria-label="Kembali ke utama" className="p-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)]">
                            <ArrowLeft className="w-4 h-4" />
                        </Link>
                        <div>
                            <h1 className="text-lg font-bold flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-[var(--accent)]" /> Semakan Pegawai NADI</h1>
                            <p className="text-xs text-[var(--text-muted)]">Setiap tindakan direkodkan dalam log audit.</p>
                        </div>
                    </div>
                    {role && <Pill tone="accent">{ROLE_LABEL[role] || role}</Pill>}
                </header>
                {children}
            </div>
        </div>
    );
}

function Section({ icon, title, count, children }: { icon: React.ReactNode; title: string; count: number; children: React.ReactNode }) {
    return (
        <section className="space-y-3">
            <h2 className="font-bold flex items-center gap-2">{icon} {title} <span className="text-xs font-mono text-[var(--text-muted)]">({count})</span></h2>
            {children}
        </section>
    );
}

function Card({ children }: { children: React.ReactNode }) {
    return <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 space-y-3 shadow-[var(--shadow-sm)]">{children}</div>;
}

const TONES = {
    success: 'bg-[var(--success-muted)] text-[var(--success)] border-[var(--success)]',
    danger: 'bg-[var(--danger-muted)] text-[var(--danger)] border-[var(--danger)]',
    accent: 'bg-[var(--accent-muted)] text-[var(--accent)] border-[var(--accent)]',
    muted: 'bg-[var(--bg-muted)] text-[var(--text-secondary)] border-[var(--border-default)]',
};

function Pill({ tone, children }: { tone: keyof typeof TONES; children: React.ReactNode }) {
    return <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${TONES[tone]}`}>{children}</span>;
}

function Actions({ busy, buttons }: { busy: boolean; buttons: { label: string; tone: 'success' | 'danger'; onClick: () => void }[] }) {
    return (
        <div className="flex flex-wrap gap-2">
            {buttons.map(b => (
                <button key={b.label} type="button" disabled={busy} onClick={b.onClick}
                    className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-xl border disabled:opacity-50 ${TONES[b.tone]}`}>
                    {b.tone === 'success' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />} {b.label}
                </button>
            ))}
        </div>
    );
}

function Empty() {
    return <p className="text-sm text-[var(--text-muted)]">Tiada item untuk disemak.</p>;
}

function Notice({ title, body }: { title: string; body: string }) {
    return (
        <Card>
            <h2 className="font-bold">{title}</h2>
            <p className="text-sm text-[var(--text-secondary)]">{body}</p>
        </Card>
    );
}
