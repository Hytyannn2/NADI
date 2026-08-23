/**
 * Privacy Policy Page (PDPA 2010 Compliance)
 */
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Lock, EyeOff, Server, FileText } from 'lucide-react';

export const metadata = {
  title: 'Dasar Privasi | NADI',
  description: 'Dasar Privasi dan Perlindungan Data Peribadi Platform NADI.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#050507] text-white p-6 md:p-12 font-sans relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-widest">
            <ShieldCheck className="w-4 h-4" /> Perlindungan Privasi (PDPA)
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white font-serif">
            Dasar Privasi
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
              <Lock className="w-4 h-4 text-[#C5A367]" /> 1. Maklumat Yang Disimpan
            </h2>
            <p>
              Kami hanya mengumpul maklumat yang diperlukan untuk membantu anda membuat aduan dan menerima amaran bencana:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-zinc-400">
              <li>Lokasi GPS semasa membuat aduan atau menyemak amaran bencana.</li>
              <li>Rakaman atau teks aduan yang anda serahkan.</li>
              <li>Maklumat pengesanan jalan rosak (jika diaktifkan).</li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800/80 space-y-2">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <EyeOff className="w-4 h-4 text-emerald-400" /> 2. Privasi Identiti
            </h2>
            <p>
              Identiti anda tidak akan dipaparkan secara terbuka. Aduan yang ditunjukkan kepada umum tidak mendedahkan nombor telefon, nombor kad pengenalan, atau alamat kediaman anda.
            </p>
          </section>

          {/* Section 3 */}
          <section className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800/80 space-y-2">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-400" /> 3. Keselamatan Data
            </h2>
            <p>
              Maklumat anda disimpan secara selamat dengan penyulitan data dan kawalan keselamatan yang ketat.
            </p>
          </section>

          {/* Section 4 */}
          <section className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800/80 space-y-2">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-400" /> 4. Hak Anda
            </h2>
            <p>
              Anda berhak meminta untuk memadamkan rekod aduan atau mengemaskini maklumat akaun anda pada bila-bila masa.
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

