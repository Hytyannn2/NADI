'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { createClient } from '@/src/lib/supabase/client';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Shield, Zap, Globe, Sparkles, CheckCircle2 } from 'lucide-react';

type Mode = 'login' | 'register' | 'forgot';

export default function AuthView({ onSuccess }: { onSuccess?: () => void }) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const supabase = createClient();

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (mode === 'register') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}`,
          },
        });
        if (error) throw error;
        setMessage('Pautan pengesahan telah dihantar ke e-mel anda! 📬');
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset`,
        });
        if (error) throw error;
        setMessage('Pautan menetapkan semula kata laluan telah dihantar ke e-mel anda! 🔑');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onSuccess?.();
      }
    } catch (err: any) {
      setError(err.message || 'Ralat berlaku. Sila cuba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Log masuk Google gagal.');
      setGoogleLoading(false);
    }
  };

  const modeConfig = {
    login: { title: 'Selamat Kembali', subtitle: 'Log masuk ke akaun NADI anda', cta: 'Log Masuk' },
    register: { title: 'Daftar Akaun NADI', subtitle: 'Sertai rangkaian komuniti digital warga', cta: 'Daftar Akaun Baru' },
    forgot: { title: 'Lupa Kata Laluan', subtitle: 'Kami akan hantar pautan menetapkan semula kata laluan', cta: 'Hantar Pautan Reset' },
  };

  const cfg = modeConfig[mode];

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden p-4 select-none" style={{ background: '#050508' }}>
      
      {/* Dynamic Animated Glow Orbs & Ambient Mesh Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Dot matrix grid overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:24px_24px] opacity-70" />
        
        {/* Animated Orbs */}
        <motion.div 
          animate={{ scale: [1, 1.2, 1], x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-[-15%] left-[-10%] w-[600px] h-[600px] rounded-full blur-[140px] opacity-40 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #C5A367 0%, #B8860B 50%, transparent 80%)' }} 
        />
        <motion.div 
          animate={{ scale: [1, 1.25, 1], x: [0, -40, 0], y: [0, 30, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          className="absolute bottom-[-15%] right-[-10%] w-[550px] h-[550px] rounded-full blur-[140px] opacity-35 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #0D9488 0%, #064E3B 50%, transparent 80%)' }} 
        />
        <motion.div 
          animate={{ opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-[40%] right-[15%] w-[350px] h-[350px] rounded-full blur-[120px] opacity-25 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #3B82F6 0%, transparent 70%)' }} 
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md relative z-10 my-8"
      >
        {/* Brand Header */}
        <div className="text-center mb-6">
          {/* Animated Logo Emblem */}
          <div className="relative inline-flex mb-3">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
              className="absolute -inset-1.5 rounded-3xl opacity-60 blur-sm bg-gradient-to-r from-[#C5A367] via-emerald-500 to-blue-500"
            />
            <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-[#0F0F14] border border-white/10 shadow-2xl backdrop-blur-xl">
              <span className="text-3xl filter drop-shadow-[0_0_8px_rgba(197,163,103,0.5)]">🇲🇾</span>
            </div>
          </div>

          {/* Title Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold text-[#C5A367] uppercase tracking-widest mb-3 backdrop-blur-md">
            <Sparkles className="w-3 h-3 text-[#C5A367] animate-pulse" /> NADI · Smart Civic Platform
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">{cfg.title}</h1>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1.5 max-w-xs mx-auto leading-relaxed">{cfg.subtitle}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Glassmorphic Auth Card */}
        <div className="rounded-3xl p-6 sm:p-8 bg-[#0F0F14]/80 border border-white/10 shadow-[0_0_60px_-15px_rgba(0,0,0,0.8)] backdrop-blur-3xl relative overflow-hidden">
          
          {/* Subtle Accent Glow Line at top */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#C5A367] to-transparent opacity-80" />

          {/* Mode Switcher Tabs */}
          {mode !== 'forgot' && (
            <div className="flex p-1 mb-6 rounded-2xl bg-[#050508]/80 border border-white/5 relative">
              <button
                type="button"
                id="switch-to-login"
                onClick={() => { setMode('login'); setError(''); setMessage(''); }}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all duration-300 relative z-10 ${
                  mode === 'login' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {mode === 'login' && (
                  <motion.div
                    layoutId="authActiveTab"
                    className="absolute inset-0 bg-[#1F1F28] border border-white/10 rounded-xl shadow-md"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10">Sign In</span>
              </button>
              
              <button
                type="button"
                id="switch-to-register"
                onClick={() => { setMode('register'); setError(''); setMessage(''); }}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all duration-300 relative z-10 ${
                  mode === 'register' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {mode === 'register' && (
                  <motion.div
                    layoutId="authActiveTab"
                    className="absolute inset-0 bg-[#1F1F28] border border-white/10 rounded-xl shadow-md"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10">Daftar Baru</span>
              </button>
            </div>
          )}

          {/* Google OAuth Button */}
          {mode !== 'forgot' && (
            <motion.button
              id="google-auth-btn"
              whileHover={{ scale: 1.01, backgroundColor: 'rgba(255, 255, 255, 0.08)' }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGoogleAuth}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-3 font-semibold py-3.5 px-4 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 text-white transition-all duration-200 text-xs sm:text-sm mb-5 disabled:opacity-60 shadow-sm group"
            >
              {googleLoading ? (
                <div className="w-5 h-5 border-2 rounded-full animate-spin border-white/20 border-t-white" />
              ) : (
                <svg className="w-5 h-5 shrink-0 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              <span>Teruskan dengan Google</span>
            </motion.button>
          )}

          {/* Divider */}
          {mode !== 'forgot' && (
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">atau e-mel</span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </div>
          )}

          {/* Email/Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1.5">Alamat E-mel</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-[#C5A367] transition-colors" />
                <input
                  id="email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  required
                  className="w-full bg-[#050508] border border-white/10 focus:border-[#C5A367] rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder:text-zinc-600 outline-none transition-all duration-200 focus:ring-2 focus:ring-[#C5A367]/20"
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400">Kata Laluan</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => { setMode('forgot'); setError(''); setMessage(''); }}
                      className="text-[11px] font-medium text-zinc-400 hover:text-[#C5A367] transition-colors"
                    >
                      Lupa kata laluan?
                    </button>
                  )}
                </div>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-[#C5A367] transition-colors" />
                  <input
                    id="password-input"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'register' ? 'Cipta kata laluan kukuh' : 'Masukkan kata laluan'}
                    required
                    minLength={6}
                    className="w-full bg-[#050508] border border-white/10 focus:border-[#C5A367] rounded-xl py-3 pl-11 pr-12 text-sm text-white placeholder:text-zinc-600 outline-none transition-all duration-200 focus:ring-2 focus:ring-[#C5A367]/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Error / Success messages */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-xl px-4 py-3 text-xs font-semibold bg-red-500/10 border border-red-500/20 text-red-400"
                >
                  {error}
                </motion.div>
              )}
              {message && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-xl px-4 py-3 text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                >
                  {message}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit Button */}
            <motion.button
              id="auth-submit-btn"
              type="submit"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              disabled={loading}
              className="w-full mt-2 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#C5A367] via-[#D4AF37] to-[#B8860B] text-[#050508] font-bold text-sm tracking-wide shadow-[0_0_30px_-5px_rgba(197,163,103,0.4)] hover:shadow-[0_0_40px_0px_rgba(197,163,103,0.6)] transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  <span>{cfg.cta}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </form>

          {/* Mode switchers */}
          {mode === 'forgot' && (
            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); setMessage(''); }}
                className="text-xs text-zinc-400 hover:text-white transition-colors flex items-center gap-1 mx-auto font-medium"
              >
                ← Kembali ke log masuk
              </button>
            </div>
          )}
        </div>

        {/* Live Active Community Badge */}
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0F0F14]/90 border border-white/10 text-[11px] font-semibold text-zinc-400 shadow-lg backdrop-blur-xl">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Lebih 12,000+ Warga Aktif Terhubung</span>
          </div>
        </div>

        {/* Trust Signals */}
        <div className="mt-5 flex items-center justify-center gap-6 text-zinc-500">
          {[
            { icon: Shield, label: 'Enkripsi 256-Bit' },
            { icon: Zap, label: 'Respon Pantas' },
            { icon: Globe, label: 'Rangkaian Kebangsaan' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <Icon className="w-3.5 h-3.5 text-[#C5A367]/80" />
              <span className="text-[10px] font-semibold tracking-wider uppercase text-zinc-400">{label}</span>
            </div>
          ))}
        </div>

        <p className="text-center text-[10px] text-zinc-600 mt-4 leading-relaxed">
          Dengan meneruskan, anda bersetuju dengan{' '}
          <span className="underline cursor-pointer text-zinc-400 hover:text-white">Terma Perkhidmatan</span> dan{' '}
          <span className="underline cursor-pointer text-zinc-400 hover:text-white">Dasar Privasi NADI</span>.
        </p>
      </motion.div>
    </div>
  );
}

