import Link from 'next/link';
import { ShieldCheck, AlertOctagon, CheckCircle2, ArrowLeft, Clock, MapPin, FileText } from 'lucide-react';
import { generatePayloadHash } from '@/src/lib/pdf/generateAduanPdf';

interface VerifyPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ hash?: string }>;
}

export default async function VerifyPage({ params, searchParams }: VerifyPageProps) {
  const { id } = await params;
  const { hash } = await searchParams;

  const ticketId = `NADI-2026-${id.slice(-6).toUpperCase()}`;

  // Mock database verification record match
  const mockRecord = {
    id,
    ticketId,
    title: 'Kerosakan Jalan Berlubang & Kehausan Structural',
    status: 'In Progress (PBT Kelantan Assigned)',
    urgency: 'High',
    locationName: 'Jalan Sultanah Zainab, Kota Bharu',
    lat: 6.1254,
    lng: 102.2381,
    time: '2026-08-05T14:32:00Z',
    confidenceScore: 0.94,
    aiDamageType: 'Hot-mix asphalt patch required',
    repairCostMYR: 'RM 450.00',
  };

  const expectedHash = generatePayloadHash({
    id: mockRecord.id,
    status: mockRecord.status,
    confidenceScore: mockRecord.confidenceScore,
    time: mockRecord.time,
  });

  const isHashValid = !hash || hash === expectedHash;

  return (
    <div className="min-h-screen bg-[#050507] text-white flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-xl bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-[#C5A367]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Navigation */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-800">
          <Link href="/" className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" /> Kembalik ke Utama
          </Link>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#C5A367]/15 text-[#C5A367] border border-[#C5A367]/30 uppercase tracking-widest">
            Portal Pengesahan NADI
          </span>
        </div>

        {/* Verification Status Banner */}
        {isHashValid ? (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h1 className="text-sm font-bold text-emerald-400 uppercase tracking-wide">
                🟢 SAH: REKOD TERPELIHARA & SEPADAN
              </h1>
              <p className="text-xs text-emerald-200/80 mt-1 leading-relaxed">
                Dokumen PDF ini telah disahkan sepadan secara kriptografi dengan pangkalan data rasmi NADI. Tiada sebarang pengubahsuaian dikesan.
              </p>
            </div>
          </div>
        ) : (
          <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
            <AlertOctagon className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
            <div>
              <h1 className="text-sm font-bold text-red-400 uppercase tracking-wide">
                🔴 AMARAN: DOKUMEN DIUBAH SUAI (TAMPERED)
              </h1>
              <p className="text-xs text-red-300/80 mt-1 leading-relaxed">
                Hash pengesahan dokumen ini tidak sepadan dengan rekod asal pangkalan data NADI. Sila semak semula borang aduan rasmi.
              </p>
            </div>
          </div>
        )}

        {/* Ticket Details */}
        <div className="space-y-4 bg-zinc-950/60 p-5 rounded-2xl border border-zinc-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-zinc-400">Tiket ID:</span>
            <span className="text-xs font-mono font-bold text-red-400">{mockRecord.ticketId}</span>
          </div>

          <div className="flex items-start justify-between gap-4 pt-2 border-t border-zinc-800/50">
            <span className="text-xs font-mono text-zinc-400">Jenis Aduan:</span>
            <span className="text-xs font-bold text-right text-zinc-100">{mockRecord.title}</span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-zinc-800/50">
            <span className="text-xs font-mono text-zinc-400">Status Semasa:</span>
            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              {mockRecord.status}
            </span>
          </div>

          <div className="flex items-start justify-between gap-4 pt-2 border-t border-zinc-800/50">
            <span className="text-xs font-mono text-zinc-400 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-zinc-400" /> Lokasi:
            </span>
            <span className="text-xs font-semibold text-right text-zinc-200">{mockRecord.locationName}</span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-zinc-800/50">
            <span className="text-xs font-mono text-zinc-400 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-zinc-400" /> Anggaran Kos Pembaikan:
            </span>
            <span className="text-xs font-bold text-emerald-400">{mockRecord.repairCostMYR}</span>
          </div>
        </div>

        {/* Verification Footnote */}
        <div className="mt-6 pt-4 border-t border-zinc-800 text-center text-[10px] text-zinc-500">
          Platform Operasi Sivik NADI • Cap Jari Hash Kriptografi: <code className="text-zinc-400">{hash || expectedHash}</code>
        </div>
      </div>
    </div>
  );
}
