/**
 * Terms and Conditions of Service Page
 */
import Link from 'next/link';
import { ArrowLeft, Scale, ShieldAlert, CheckCircle, AlertTriangle } from 'lucide-react';

export const metadata = {
  title: 'Terma & Syarat | NADI',
  description: 'Terma dan Syarat Penggunaan Platform NADI.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#050507] text-white p-6 md:p-12 font-sans relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-3xl mx-auto space-y-8 relative z-10">
        {/* Back navigation */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-white transition-colors bg-zinc-900 px-3.5 py-2 rounded-xl border border-zinc-800"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali Ke Utama
        </Link>

        {/* Header */}
        <div className="space-y-3 border-b border-zinc-800/80 pb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-widest">
            <Scale className="w-4 h-4" /> Terma Perkhidmatan
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white font-serif">
            Terma & Syarat
          </h1>
          <p className="text-xs text-zinc-400">
            Kemaskini Terakhir: 6 Ogos 2026
          </p>
        </div>

        {/* Content sections */}
        <div className="space-y-6 text-xs text-zinc-300 leading-relaxed">
          {/* Section 1 */}
          <section className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800/80 space-y-2">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" /> 1. Penggunaan Platform
            </h2>
            <p>
              Dengan menggunakan platform NADI, anda bersetuju untuk mematuhi terma ini. NADI menyediakan kemudahan laporan isu kawasan, maklumat amaran bencana, dan carian bantuan awam.
            </p>
          </section>

          {/* Section 2 */}
          <section className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800/80 space-y-2">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" /> 2. Ketepatan Maklumat Aduan
            </h2>
            <p>
              Pastikan sebarang aduan atau maklumat yang dihantar adalah benar. Pelaporan palsu atau salah guna talian kecemasan tidak dibenarkan.
            </p>
          </section>

          {/* Section 3 */}
          <section className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800/80 space-y-2">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400" /> 3. Situasi Kecemasan
            </h2>
            <p>
              NADI berfungsi sebagai platform maklumat awam. Untuk sebarang situasi kecemasan yang memerlukan bantuan segera, sila hubungi talian kecemasan MERS 999 secara terus.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="pt-6 border-t border-zinc-800/80 text-center text-[10px] text-zinc-500 font-mono">
          NADI © 2026
        </div>
      </div>
    </div>
  );
}

