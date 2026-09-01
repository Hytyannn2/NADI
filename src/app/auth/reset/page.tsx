/**
 * Password Reset Page
 * 
 * Shown after a user clicks the password recovery link in their email.
 * The Supabase session is already active (set by the callback route).
 * User enters a new password, which is updated via supabase.auth.updateUser().
 */
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { createClient } from '@/src/lib/supabase/client';
import { Lock, Eye, EyeOff, ArrowRight, CheckCircle2, AlertCircle, Shield } from 'lucide-react';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const supabase = createClient();

  // Validate strong password: Min 8 chars, 1 Uppercase (A-Z), 1 Number (0-9)
  const isLongEnough = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const isStrongPassword = isLongEnough && hasUppercase && hasNumber;
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!isStrongPassword) {
      setError('Kata laluan mesti sekurang-kurangnya 8 aksara dan mengandungi huruf besar (A-Z) & nombor (0-9).');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Kata laluan dan sahkan kata laluan tidak sepadan.');
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      // Redirect to homepage after 2 seconds
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Ralat berlaku. Sila cuba lagi.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="h-screen w-full bg-[#050811] text-white flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-4"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto" />
          </motion.div>
          <h1 className="text-2xl font-extrabold">Kata Laluan Dikemas Kini!</h1>
          <p className="text-sm text-slate-400">Mengalihkan ke halaman utama...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-[#050811] text-white flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-7 h-7 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Tetapkan Kata Laluan Baru</h1>
          <p className="text-sm text-slate-400 mt-2">Masukkan kata laluan baru anda di bawah.</p>
        </div>

        {/* Form */}
        <form onSubmit={handleResetPassword} className="space-y-4">
          {/* New Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Kata Laluan Baru</label>
            <div className="relative group">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan kata laluan baru"
                required
                minLength={8}
                className="w-full bg-[#0B101E] border border-slate-800 focus:border-emerald-500 rounded-xl py-2.5 pl-10 pr-11 text-sm text-white placeholder:text-slate-600 outline-none transition-all duration-200 focus:ring-2 focus:ring-emerald-500/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Password Strength Indicators */}
            <div className="flex items-center gap-1.5 mt-2 text-[10px] font-semibold">
              <div className={`px-2 py-0.5 rounded-md border flex items-center gap-1 ${isLongEnough ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-slate-900/80 border-slate-800 text-slate-500'}`}>
                {isLongEnough && <CheckCircle2 className="w-3 h-3" />}
                <span>8+ Aksara</span>
              </div>
              <div className={`px-2 py-0.5 rounded-md border flex items-center gap-1 ${hasUppercase ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-slate-900/80 border-slate-800 text-slate-500'}`}>
                {hasUppercase && <CheckCircle2 className="w-3 h-3" />}
                <span>Huruf Besar (A-Z)</span>
              </div>
              <div className={`px-2 py-0.5 rounded-md border flex items-center gap-1 ${hasNumber ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-slate-900/80 border-slate-800 text-slate-500'}`}>
                {hasNumber && <CheckCircle2 className="w-3 h-3" />}
                <span>Nombor (0-9)</span>
              </div>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Sahkan Kata Laluan Baru</label>
            <div className="relative group">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Masukkan semula kata laluan"
                required
                minLength={8}
                className="w-full bg-[#0B101E] border border-slate-800 focus:border-emerald-500 rounded-xl py-2.5 pl-10 pr-11 text-sm text-white placeholder:text-slate-600 outline-none transition-all duration-200 focus:ring-2 focus:ring-emerald-500/20"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Match Indicator */}
            {confirmPassword.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -2 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-center gap-1.5 mt-1.5 text-[11px] font-semibold ${passwordsMatch ? 'text-emerald-400' : 'text-red-400'}`}
              >
                {passwordsMatch ? (
                  <><CheckCircle2 className="w-3.5 h-3.5" /><span>Kata laluan sepadan!</span></>
                ) : (
                  <><AlertCircle className="w-3.5 h-3.5" /><span>Kata laluan tidak sepadan</span></>
                )}
              </motion.div>
            )}
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-xl px-4 py-2 text-xs font-semibold bg-red-500/10 border border-red-500/20 text-red-400"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit */}
          <motion.button
            type="submit"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            disabled={loading || !isStrongPassword || !passwordsMatch}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm tracking-wide shadow-[0_0_30px_rgba(16,185,129,0.35)] hover:shadow-[0_0_40px_rgba(16,185,129,0.5)] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
            ) : (
              <>
                <span>Kemas Kini Kata Laluan</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
