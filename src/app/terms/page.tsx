import Link from 'next/link';
import { ArrowLeft, Scale, ShieldAlert, CheckCircle, AlertTriangle } from 'lucide-react';

export const metadata = {
  title: 'Terma & Syarat Perkhidmatan | NADI',
  description: 'Terma dan Syarat Perkhidmatan Penggunaan Platform Operasi Sivik & Respons Bencana NADI.',
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
            <Scale className="w-4 h-4" /> Terma Perkhidmatan NADI
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white font-serif">
            Terma & Syarat Perkhidmatan
          </h1>
          <p className="text-xs text-zinc-400">
            Tarikh Kemaskini Terakhir: 6 Ogos 2026 • Versi 3.2.0
          </p>
        </div>

        {/* Content sections */}
        <div className="space-y-6 text-xs text-zinc-300 leading-relaxed">
          {/* Section 1 */}
          <section className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800/80 space-y-2">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" /> 1. Penerimaan Terma
            </h2>
            <p>
              Dengan mengakses atau menggunakan platform NADI, anda bersetuju untuk terikat dengan Terma Perkhidmatan ini. NADI menyediakan platform laporan sivik awam, pemantauan paras air sungai JPS, dan maklumat bencana secara masa nyata.
            </p>
          </section>

          {/* Section 2 */}
          <section className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800/80 space-y-2">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" /> 2. Integriti Pelaporan & Penalti Palsu
            </h2>
            <p>
              Pengguna adalah bertanggungjawab sepenuhnya atas ketepatan maklumat yang dihantar. Pelaporan palsu, sabotaj data sensor, atau salah guna talian kecemasan SOS adalah dilarang keras di bawah undang-undang Malaysia.
            </p>
          </section>

          {/* Section 3 */}
          <section className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800/80 space-y-2">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400" /> 3. Penafian Kecemasan Kritikal
            </h2>
            <p>
              NADI berfungsi sebagai platform sokongan kesedaran sivik dan pemantauan awam. Untuk situasi kecemasan yang mengancam nyawa serta-merta, pengguna hendaklah menghubungi talian kecemasan kebangsaan <strong>MERS 999</strong> secara terus.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="pt-6 border-t border-zinc-800/80 text-center text-[10px] text-zinc-500 font-mono">
          NADI — Platform Operasi Sivik & Respons Bencana Kebangsaan Malaysia © 2026
        </div>
      </div>
    </div>
  );
}
