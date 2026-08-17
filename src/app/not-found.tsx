import Link from 'next/link';
import { AlertTriangle, Home, ClipboardList, ShieldAlert } from 'lucide-react';

export const metadata = {
  title: 'Halaman Tidak Ditemui (404) | NADI',
  description: 'Halaman yang anda cari tidak wujud atau telah dipindahkan dalam platform NADI.',
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#050507] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-[#C5A367]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full text-center space-y-6 relative z-10">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-widest">
          <AlertTriangle className="w-4 h-4 text-red-400" /> Ralat 404 • Halaman Tidak Ditemui
        </div>

        {/* Big Code */}
        <h1 className="text-8xl font-black font-mono tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-200 to-zinc-600">
          404
        </h1>

        {/* Subtitle & Message */}
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white font-serif">
            Halaman Tidak Ditemui
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed max-w-sm mx-auto">
            Halaman yang anda cari tiada atau telah dipindahkan.
          </p>
        </div>

        {/* Quick Action Navigation Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
          <Link
            href="/"
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-[#C5A367] to-[#E5C387] text-black text-xs font-bold hover:brightness-110 transition-all shadow-lg active:scale-95"
          >
            <Home className="w-4 h-4" /> Kembali Ke Utama
          </Link>
          <Link
            href="/?tab=aduan"
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs font-bold hover:bg-zinc-800 transition-all active:scale-95"
          >
            <ClipboardList className="w-4 h-4 text-[#C5A367]" /> Hantar Aduan
          </Link>
        </div>

        {/* Emergency Assistance Footer */}
        <div className="pt-6 border-t border-zinc-800/80 flex items-center justify-center gap-2 text-[10px] text-zinc-500 font-mono font-bold uppercase tracking-wider">
          <ShieldAlert className="w-3.5 h-3.5 text-red-400" /> Perlu bantuan kecemasan? Hubungi 999
        </div>
      </div>
    </div>
  );
}

