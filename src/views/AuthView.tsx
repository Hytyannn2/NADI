'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { createClient } from '@/src/lib/supabase/client';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Shield, Zap, Globe } from 'lucide-react';

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
          redirectTo: `${window.location.origin}`,
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
    login: { title: 'Welcome back', subtitle: 'Sign in to continue to NADI', cta: 'Sign In' },
    register: { title: 'Join NADI', subtitle: 'Create your civic account', cta: 'Create Account' },
    forgot: { title: 'Reset Password', subtitle: 'We\'ll send you a reset link', cta: 'Send Reset Link' },
  };

  const cfg = modeConfig[mode];

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden p-4" style={{ background: 'var(--bg-base)' }}>
      {/* Soft ambient background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full blur-[120px]" style={{ background: 'var(--accent-muted)', opacity: 0.5 }} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] rounded-full blur-[120px]" style={{ background: 'var(--success-muted)', opacity: 0.5 }} />
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
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: 'var(--accent-muted)', border: '1px solid var(--border-default)' }}
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
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>{cfg.title}</h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{cfg.subtitle}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-lg)' }}>

          {/* Google OAuth Button */}
          {mode !== 'forgot' && (
            <motion.button
              id="google-auth-btn"
              whileTap={{ scale: 0.97 }}
              onClick={handleGoogleAuth}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-3 font-semibold py-3.5 px-4 rounded-xl transition-all duration-200 text-sm mb-4 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
            >
              {googleLoading ? (
                <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border-default)', borderTopColor: 'var(--text-primary)' }} />
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
              <div className="flex-1 h-px" style={{ background: 'var(--border-default)' }} />
              <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>or use email</span>
              <div className="flex-1 h-px" style={{ background: 'var(--border-default)' }} />
            </div>
          )}

          {/* Email/Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-3">
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors" style={{ color: 'var(--text-muted)' }} />
              <input
                id="email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                required
                className="input-base pl-11"
              />
            </div>

            {mode !== 'forgot' && (
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors" style={{ color: 'var(--text-muted)' }} />
                <input
                  id="password-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Create a strong password' : 'Your password'}
                  required
                  minLength={6}
                  className="input-base pl-11 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: 'var(--text-muted)' }}
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
                  className="rounded-xl px-4 py-3 text-xs font-medium"
                  style={{ background: 'var(--danger-muted)', color: 'var(--danger)', border: '1px solid var(--danger-muted)' }}
                >
                  {error}
                </motion.div>
              )}
              {message && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-xl px-4 py-3 text-xs font-medium"
                  style={{ background: 'var(--success-muted)', color: 'var(--success)', border: '1px solid var(--success-muted)' }}
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
                  className="text-xs font-medium transition-colors hover:opacity-70"
                  style={{ color: 'var(--text-muted)' }}
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
              className="btn-primary w-full mt-1 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
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
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                No account?{' '}
                <button
                  id="switch-to-register"
                  onClick={() => { setMode('register'); setError(''); setMessage(''); }}
                  className="font-semibold transition-colors hover:opacity-80"
                  style={{ color: 'var(--accent)' }}
                >
                  Create one free
                </button>
              </p>
            )}
            {mode === 'register' && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Already have an account?{' '}
                <button
                  id="switch-to-login"
                  onClick={() => { setMode('login'); setError(''); setMessage(''); }}
                  className="font-semibold transition-colors hover:opacity-80"
                  style={{ color: 'var(--accent)' }}
                >
                  Sign in
                </button>
              </p>
            )}
            {mode === 'forgot' && (
              <button
                onClick={() => { setMode('login'); setError(''); setMessage(''); }}
                className="text-xs transition-colors flex items-center gap-1 mx-auto hover:opacity-80"
                style={{ color: 'var(--text-muted)' }}
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
            <div key={label} className="flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
              <Icon className="w-3 h-3" />
              <span className="text-[10px] font-semibold">{label}</span>
            </div>
          ))}
        </div>

        <p className="text-center text-[10px] mt-3" style={{ color: 'var(--text-muted)' }}>
          By continuing, you agree to NADI's{' '}
          <span className="underline cursor-pointer" style={{ color: 'var(--text-secondary)' }}>Terms</span> and{' '}
          <span className="underline cursor-pointer" style={{ color: 'var(--text-secondary)' }}>Privacy Policy</span>
        </p>
      </motion.div>
    </div>
  );
}
