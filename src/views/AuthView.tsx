'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { createClient } from '@/src/lib/supabase/client';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Sparkles, Shield, Zap, Globe } from 'lucide-react';

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
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        setMessage('Check your email for a confirmation link! 📬');
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset`,
        });
        if (error) throw error;
        setMessage('Password reset link sent to your email! 🔑');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onSuccess?.();
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
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
      setError(err.message || 'Google sign-in failed.');
      setGoogleLoading(false);
    }
  };

  const modeConfig = {
    login: { title: 'Welcome back', subtitle: 'Sign in to your NADI account', cta: 'Sign In' },
    register: { title: 'Join NADI', subtitle: 'Create your civic account today', cta: 'Create Account' },
    forgot: { title: 'Reset Password', subtitle: 'Enter your email to reset your password', cta: 'Send Reset Link' },
  };

  const cfg = modeConfig[mode];

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] relative overflow-hidden p-4">
      {/* Ambient background glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-[#C5A367]/[0.04] rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-[#3B82F6]/[0.05] rounded-full blur-[120px]" />
        <div className="absolute top-[40%] left-[40%] w-[300px] h-[300px] bg-[#8B5CF6]/[0.03] rounded-full blur-[100px]" />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(197,163,103,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(197,163,103,0.5) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="w-full max-w-sm relative z-10"
      >
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#C5A367]/20 to-[#C5A367]/5 border border-[#C5A367]/20 mb-4 shadow-[0_0_40px_rgba(197,163,103,0.15)]"
          >
            <span className="text-3xl">🇲🇾</span>
          </motion.div>
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <h1 className="text-2xl font-serif font-semibold text-white tracking-tight">{cfg.title}</h1>
              <p className="text-zinc-500 text-xs mt-1 font-medium">{cfg.subtitle}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Card */}
        <div className="bg-[#0A0A0C]/80 border border-zinc-800/80 rounded-3xl p-6 backdrop-blur-xl shadow-[0_0_80px_rgba(0,0,0,0.5)]">

          {/* Google OAuth Button */}
          {mode !== 'forgot' && (
            <motion.button
              id="google-auth-btn"
              whileTap={{ scale: 0.97 }}
              onClick={handleGoogleAuth}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-zinc-100 text-zinc-900 font-semibold py-3.5 px-4 rounded-2xl transition-all duration-200 text-sm mb-4 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg"
            >
              {googleLoading ? (
                <div className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              Continue with Google
            </motion.button>
          )}

          {/* Divider */}
          {mode !== 'forgot' && (
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-zinc-800" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">or continue with email</span>
              <div className="flex-1 h-px bg-zinc-800" />
            </div>
          )}

          {/* Email/Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-3">
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-[#C5A367] transition-colors" />
              <input
                id="email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                required
                className="w-full bg-zinc-900/70 border border-zinc-800 focus:border-[#C5A367]/50 focus:ring-1 focus:ring-[#C5A367]/20 rounded-xl pl-11 pr-4 py-3.5 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none transition-all"
              />
            </div>

            {mode !== 'forgot' && (
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-[#C5A367] transition-colors" />
                <input
                  id="password-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Create a strong password' : 'Your password'}
                  required
                  minLength={6}
                  className="w-full bg-zinc-900/70 border border-zinc-800 focus:border-[#C5A367]/50 focus:ring-1 focus:ring-[#C5A367]/20 rounded-xl pl-11 pr-12 py-3.5 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            )}

            {/* Error / Success messages */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-xs text-red-400 font-medium"
                >
                  {error}
                </motion.div>
              )}
              {message && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 text-xs text-green-400 font-medium"
                >
                  {message}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Forgot password link */}
            {mode === 'login' && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setError(''); setMessage(''); }}
                  className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 hover:text-[#C5A367] transition-colors"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* Submit Button */}
            <motion.button
              id="auth-submit-btn"
              type="submit"
              whileTap={{ scale: 0.97 }}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#C5A367] to-[#B8860B] hover:from-[#D4AF37] hover:to-[#C5A367] text-[#0A0A0C] font-bold py-3.5 rounded-2xl transition-all duration-200 text-sm shadow-[0_0_30px_rgba(197,163,103,0.25)] disabled:opacity-60 disabled:cursor-not-allowed mt-1"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-[#0A0A0C]/30 border-t-[#0A0A0C] rounded-full animate-spin" />
              ) : (
                <>
                  {cfg.cta}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </form>

          {/* Mode switchers */}
          <div className="mt-5 text-center space-y-2">
            {mode === 'login' && (
              <p className="text-xs text-zinc-600">
                No account?{' '}
                <button
                  id="switch-to-register"
                  onClick={() => { setMode('register'); setError(''); setMessage(''); }}
                  className="text-[#C5A367] font-semibold hover:text-[#D4AF37] transition-colors"
                >
                  Create one free
                </button>
              </p>
            )}
            {mode === 'register' && (
              <p className="text-xs text-zinc-600">
                Already have an account?{' '}
                <button
                  id="switch-to-login"
                  onClick={() => { setMode('login'); setError(''); setMessage(''); }}
                  className="text-[#C5A367] font-semibold hover:text-[#D4AF37] transition-colors"
                >
                  Sign in
                </button>
              </p>
            )}
            {mode === 'forgot' && (
              <button
                onClick={() => { setMode('login'); setError(''); setMessage(''); }}
                className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1 mx-auto"
              >
                ← Back to sign in
              </button>
            )}
          </div>
        </div>

        {/* Trust signals */}
        <div className="mt-6 flex items-center justify-center gap-6">
          {[
            { icon: Shield, label: 'Secured' },
            { icon: Zap, label: 'Instant' },
            { icon: Globe, label: 'Nationwide' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-1.5 text-zinc-700">
              <Icon className="w-3 h-3" />
              <span className="text-[9px] font-bold uppercase tracking-widest">{label}</span>
            </div>
          ))}
        </div>

        <p className="text-center text-[9px] text-zinc-700 mt-3 font-medium">
          By continuing, you agree to NADI's{' '}
          <span className="text-zinc-600 underline cursor-pointer">Terms</span> and{' '}
          <span className="text-zinc-600 underline cursor-pointer">Privacy Policy</span>
        </p>
      </motion.div>
    </div>
  );
}
