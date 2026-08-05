import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Lock, EyeOff, Server, FileText } from 'lucide-react';

export const metadata = {
  title: 'Dasar Privasi | NADI',
  description: 'Dasar Privasi dan Perlindungan Data Peribadi Platform NADI mengikut Akta Perlindungan Data Peribadi 2010 (PDPA) Malaysia.',
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
            <ShieldCheck className="w-4 h-4" /> Patuh PDPA 2010 Malaysia
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white font-serif">
            Dasar Privasi & Perlindungan Data
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
              <Lock className="w-4 h-4 text-[#C5A367]" /> 1. Pengumpulan Data Sivik & Telemetri
            </h2>
            <p>
              Platform NADI mengumpul data terhad yang diperlukan khusus untuk perkhidmatan operasi sivik dan respons bencana negara. Data ini merangkumi:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-zinc-400">
              <li>Data Akselerometer & G-Sensor telefon pintar semasa pelaporan jalan berlubang.</li>
              <li>Lokasi GPS semasa hantaran aduan sivik atau semakan stesen sungai JPS.</li>
              <li>Transkripsi suara aduan pengguna yang diproses menggunakan AI Dialek Groq Llama 3.3.</li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800/80 space-y-2">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <EyeOff className="w-4 h-4 text-emerald-400" /> 2. Kerahsiaan & Anonimiti Aduan
            </h2>
            <p>
              Identiti pelapor dilindungi secara lalai (default anonymity). Aduan awam yang dipaparkan pada papan pemuka tidak mendedahkan nombor kad pengenalan, nombor telefon, atau alamat kediaman pelapor.
            </p>
          </section>

          {/* Section 3 */}
          <section className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800/80 space-y-2">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-400" /> 3. Keselamatan Pelayan & Supabase RLS
            </h2>
            <p>
              Semua simpanan rekod pangkalan data dikawal oleh dasar Keselamatan Peringkat Baris (Row Level Security - RLS) melalui pangkalan data Supabase yang disulitkan secara terbina (AES-256 at rest & TLS in transit).
            </p>
          </section>

          {/* Section 4 */}
          <section className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800/80 space-y-2">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-400" /> 4. Hak Pengguna Terhadap Data
            </h2>
            <p>
              Mengikut Akta Perlindungan Data Peribadi 2010 (PDPA), pengguna berhak meminta pemadaman rekod aduan atau kemaskini profil pada bila-bila masa melalui tetapan akaun NADI.
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
