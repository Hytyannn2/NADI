/**
 * Citizen Authentication View
 * 
 * Handles user login, account registration, password reset and OTP email
 * verification.
 */
'use client';

import pkg from '@/package.json';

const APP_VERSION = `v${pkg.version}`;

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { createClient } from '@/src/lib/supabase/client';
import { Mail, Lock, Eye, EyeOff, Radar, Shield, Zap, Globe, User, Phone, MapPin, CheckCircle2, ChevronDown, Check, AlertCircle, RotateCw, Info } from 'lucide-react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';

type Mode = 'login' | 'register' | 'forgot' | 'verify_email';
type Lang = 'BM' | 'EN';

// 11 Official Kelantan Administrative Districts (Alphabetical Ascending Order)
const KELANTAN_JAJAHAN_LIST = [
  'Bachok',
  'Gua Musang',
  'Jeli',
  'Kota Bharu',
  'Kuala Krai',
  'Lojing',
  'Machang',
  'Pasir Mas',
  'Pasir Puteh',
  'Tanah Merah',
  'Tumpat',
] as const;

// High-Precision Centroid coordinates for GPS proximity detection
const JAJAHAN_COORDINATES: Record<string, { lat: number; lng: number }> = {
  'Kota Bharu': { lat: 6.1254, lng: 102.2386 },
  'Pasir Mas': { lat: 6.0422, lng: 102.1414 },
  'Tumpat': { lat: 6.1978, lng: 102.1710 },
  'Bachok': { lat: 6.0644, lng: 102.3986 },
  'Pasir Puteh': { lat: 5.8344, lng: 102.4042 },
  'Machang': { lat: 5.7644, lng: 102.2144 },
  'Tanah Merah': { lat: 5.8086, lng: 102.1469 },
  'Kuala Krai': { lat: 5.5317, lng: 102.2028 },
  'Gua Musang': { lat: 4.8662, lng: 101.9609 },
  'Jeli': { lat: 5.6983, lng: 101.8436 },
  'Lojing': { lat: 4.6344, lng: 101.4659 },
};

// 24 Kelantan jajahan and towns, set as type in the side panel
const KELANTAN_PLACES = [
  'Kota Bharu', 'Pasir Mas', 'Tumpat', 'Bachok', 'Pasir Puteh',
  'Machang', 'Tanah Merah', 'Kuala Krai', 'Gua Musang', 'Jeli',
  'Lojing', 'Rantau Panjang', 'Pengkalan Chepa', 'Kubang Kerian', 'Dabong',
  'Manek Urai', 'Wakaf Bharu', 'Tok Bali', 'Kok Lanas', 'Ketereh',
  'Melor', 'Pulai Chondong', 'Bukit Bunga', 'Gual Periok',
];

export default function AuthView({ onSuccess }: { onSuccess?: () => void }) {
  const [mode, setMode] = useState<Mode>('login');
  const [lang, setLang] = useState<Lang>('BM');
  const [showLangDropdown, setShowLangDropdown] = useState(false);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [district, setDistrict] = useState('Kota Bharu');
  const [detectedJajahan, setDetectedJajahan] = useState<string>('Kota Bharu');

  // Pure Automatic GPS Jajahan Detection (Live Watcher + Bounded Centroid + Sensor Poller)
  useEffect(() => {
    let isMounted = true;

    const processCoords = (latitude: number, longitude: number) => {
      // Check if coordinates fall within Kelantan geographic boundaries (Lat 4.40 - 6.40, Lng 101.10 - 102.65)
      const isInsideKelantan = latitude >= 4.40 && latitude <= 6.40 && longitude >= 101.10 && longitude <= 102.65;
      
      let closest = 'Kota Bharu';
      if (isInsideKelantan) {
        let minDistance = Infinity;
        for (const [name, coords] of Object.entries(JAJAHAN_COORDINATES)) {
          const dist = Math.hypot(latitude - coords.lat, longitude - coords.lng);
          if (dist < minDistance) {
            minDistance = dist;
            closest = name;
          }
        }
      } else {
        // When outside Kelantan (e.g. Bangi, KL, Selangor), default to State Capital (Kota Bharu) rather than border districts
        closest = 'Kota Bharu';
      }

      console.log(`[NADI GPS] Detected: (${latitude.toFixed(4)}, ${longitude.toFixed(4)}) → Jajahan: ${closest}`);

      if (closest && isMounted) {
        setDetectedJajahan(closest);
        setDistrict(closest);
      }
    };

    let watchId: number | null = null;
    let pollInterval: NodeJS.Timeout | null = null;

    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      const checkGPS = () => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            processCoords(pos.coords.latitude, pos.coords.longitude);
          },
          () => {},
          { timeout: 5000, enableHighAccuracy: true }
        );
      };

      // 1. Instant check
      checkGPS();

      // 2. Continuous real-time watcher
      try {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            processCoords(pos.coords.latitude, pos.coords.longitude);
          },
          () => {},
          { enableHighAccuracy: true }
        );
      } catch {}

      // 3. Fast Sensor Poller (ensures DevTools Sensors panel changes apply instantly without refreshing!)
      pollInterval = setInterval(checkGPS, 1500);
    }

    return () => {
      isMounted = false;
      if (watchId !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchId);
      }
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  // Sorted Jajahan: User's physical location (detectedJajahan) is ALWAYS locked at index 0 (above Bachok)
  // Selecting a different district in the form will NOT mutate the dropdown order
  const sortedJajahan = useMemo(() => {
    const userLocation = detectedJajahan || 'Kota Bharu';
    const others = KELANTAN_JAJAHAN_LIST.filter((j) => j !== userLocation);
    return [userLocation, ...others];
  }, [detectedJajahan]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'warning' | 'info'>('info');

  // CAPTCHA state (Cloudflare Turnstile)
  const [captchaToken, setCaptchaToken] = useState('');
  const turnstileRef = useRef<TurnstileInstance>(null);

  // OTP verification state
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Detect ?verified=true URL param on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('verified') === 'true') {
        setMessageType('success');
        setMessage(lang === 'BM' ? 'E-mel berjaya disahkan! Sila log masuk.' : 'Email verified! Please log in.');
        window.history.replaceState({}, '', '/');
      }
      if (params.get('deleted') === 'true') {
        setMessageType('warning');
        setMessage(lang === 'BM' ? 'Akaun dan rekod peribadi anda telah berjaya dipadam selama-lamanya.' : 'Your account and personal records have been permanently deleted.');
        window.history.replaceState({}, '', '/');
      }
    }
  }, []);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Load remembered email on mount & purge any legacy stored password
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedEmail = localStorage.getItem('nadi_remembered_email');
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
      // Security Hygiene: Always purge any plaintext/base64 passwords from web storage
      localStorage.removeItem('nadi_remembered_pass');
    }
  }, []);

  // Validate Malaysian mobile phone format
  const validateMalaysianPhone = (phoneStr: string): boolean => {
    const digitsOnly = phoneStr.replace(/[\s-]/g, '');
    return /^01[0-9]{8,9}$/.test(digitsOnly);
  };

  // Validate Strong Password: Min 8 chars, 1 Uppercase (A-Z), 1 Number (0-9)
  const validateStrongPassword = (passStr: string): boolean => {
    return passStr.length >= 8 && /[A-Z]/.test(passStr) && /[0-9]/.test(passStr);
  };

  const supabase = createClient();

  // Helper to ensure clean redirect URL (replaces 0.0.0.0 with localhost for email clients)
  const getAuthRedirectUrl = () => {
    if (typeof window === 'undefined') return undefined;
    let origin = window.location.origin;
    if (origin.includes('0.0.0.0')) {
      origin = origin.replace('0.0.0.0', 'localhost');
    }
    return `${origin}/auth/callback`;
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    // Secure Remember Me: Only persist email, never passwords
    if (typeof window !== 'undefined') {
      if (rememberMe && email) {
        localStorage.setItem('nadi_remembered_email', email);
      } else {
        localStorage.removeItem('nadi_remembered_email');
      }
      localStorage.removeItem('nadi_remembered_pass');
    }

    try {
      if (mode === 'register') {
        // Validate phone number format (01X... 10 or 11 digits total)
        if (!validateMalaysianPhone(phone)) {
          setError(lang === 'BM' ? 'Nombor telefon tidak sah.' : 'Invalid phone number.');
          setLoading(false);
          return;
        }

        // Password criteria are enforced via disabled submit button (tick-box UI)
        // This is a safety net in case the button state is bypassed
        if (!validateStrongPassword(password) || password !== confirmPassword) {
          setLoading(false);
          return;
        }

        // Supabase Auth verifies the Turnstile token server-side (Auth > Bot and Abuse Protection)
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            captchaToken: captchaToken || undefined,
            data: {
              full_name: fullName,
              phone: phone,
              district: district,
              state_region: district,
            },
            emailRedirectTo: getAuthRedirectUrl(),
          },
        });
        if (error) {
          const errMsg = (error.message || '').toLowerCase();
          if (errMsg.includes('already registered') || errMsg.includes('already exists') || errMsg.includes('email_exists') || errMsg.includes('user_already_exists')) {
            setMode('login');
            setMessageType('warning');
            setMessage(
              lang === 'BM'
                ? 'Nombor telefon atau e-mel ini telah pun berdaftar. Kami telah memindahkan anda ke log masuk!'
                : 'This phone number or email is already registered. Switched to login form!'
            );
            return;
          }
          throw error;
        }
        // Switch to OTP verification screen
        setOtpDigits(['', '', '', '', '', '']);
        setMode('verify_email');
        setResendCooldown(60);
        setMessageType('success');
        setMessage(lang === 'BM' ? 'Kod 6-digit telah dihantar ke e-mel anda!' : '6-digit code sent to your email!');
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: getAuthRedirectUrl(),
          captchaToken: captchaToken || undefined,
        });
        if (error) throw error;
        setMessageType('success');
        setMessage(lang === 'BM' ? 'Pautan menetapkan semula kata laluan telah dihantar!' : 'Password reset link sent to your email!');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password, options: { captchaToken: captchaToken || undefined } });
        if (error) {
          const errMsg = (error.message || '').toLowerCase();
          // If account doesn't exist in Supabase auth database, auto-switch to register mode keeping email & password prefilled
          if (errMsg.includes('invalid login credentials') || errMsg.includes('user not found') || errMsg.includes('invalid_credentials')) {
            setMode('register');
            setMessageType('warning');
            setMessage(
              lang === 'BM' 
                ? 'Akaun belum berdaftar. Kami telah memindahkan anda ke borang pendaftaran!' 
                : 'Account not registered yet. Switched to sign-up form!'
            );
            return;
          }
          // If email not confirmed, auto-switch to OTP verification screen
          if (errMsg.includes('email_not_confirmed') || errMsg.includes('email not confirmed')) {
            setOtpDigits(['', '', '', '', '', '']);
            setMode('verify_email');
            setMessageType('warning');
            setMessage(
              lang === 'BM'
                ? 'Sila sahkan e-mel anda terlebih dahulu. Kod baru telah dihantar.'
                : 'Please verify your email first. A new code has been sent.'
            );
            // Auto-resend verification
            try {
              await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: getAuthRedirectUrl() } });
              setResendCooldown(60);
            } catch {}
            return;
          }
          throw error;
        }
        onSuccess?.();
      }
    } catch (err) {
      setError((err instanceof Error && err.message) || (lang === 'BM' ? 'Ralat berlaku. Sila cuba lagi.' : 'An error occurred. Please try again.'));
    } finally {
      // Turnstile tokens are single-use: get a fresh one for the next attempt
      turnstileRef.current?.reset();
      setCaptchaToken('');
      setLoading(false);
    }
  };

  // OTP verification handler
  const handleVerifyOtp = async () => {
    const otpCode = otpDigits.join('');
    if (otpCode.length !== 6) {
      setError(lang === 'BM' ? 'Sila masukkan kod 6 digit penuh.' : 'Please enter the full 6-digit code.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token: otpCode, type: 'signup' });
      if (error) throw error;
      setMessage(lang === 'BM' ? 'E-mel disahkan! Menglog masuk…' : 'Email verified! Logging in…');
      onSuccess?.();
    } catch (err) {
      setError((err instanceof Error && err.message) || (lang === 'BM' ? 'Kod tidak sah atau telah tamat tempoh.' : 'Invalid or expired code.'));
      setOtpDigits(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP handler with cooldown
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError('');
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: getAuthRedirectUrl() },
      });
      if (error) throw error;
      setResendCooldown(60);
      setMessage(lang === 'BM' ? 'Kod baru telah dihantar ke e-mel anda.' : 'New code sent to your email.');
    } catch (err) {
      setError((err instanceof Error && err.message) || (lang === 'BM' ? 'Gagal menghantar semula kod.' : 'Failed to resend code.'));
    }
  };

  // OTP input handlers
  const handleOtpChange = (index: number, value: string) => {
    if (!/^[0-9]?$/.test(value)) return;
    const newDigits = [...otpDigits];
    newDigits[index] = value;
    setOtpDigits(newDigits);
    // Auto-focus next input
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
    // Auto-submit when all 6 digits entered
    if (value && index === 5 && newDigits.every(d => d !== '')) {
      setTimeout(() => handleVerifyOtp(), 100);
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      const newDigits = pasted.split('');
      setOtpDigits(newDigits);
      otpRefs.current[5]?.focus();
      setTimeout(() => handleVerifyOtp(), 100);
    }
  };

  const handleGoogleAuth = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      const redirectOrigin = typeof window !== 'undefined'
        ? window.location.origin.replace('0.0.0.0', 'localhost')
        : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${redirectOrigin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      if (error) throw error;
    } catch (err) {
      setError((err instanceof Error && err.message) || (lang === 'BM' ? 'Log masuk Google gagal.' : 'Google sign-in failed.'));
      setGoogleLoading(false);
    }
  };

  const t = {
    BM: {
      loginTitle: 'Log Masuk',
      loginSub: 'Log masuk untuk aduan isu kawasan, maklumat bencana, dan carian bantuan.',
      regTitle: 'Daftar Akaun',
      regSub: 'Daftar akaun percuma untuk mula melapor isu dan menyemak bantuan.',
      forgotTitle: 'Reset Kata Laluan',
      forgotSub: 'Masukkan alamat e-mel berdaftar anda untuk menerima pautan reset.',
      googleBtn: 'Log masuk dengan Google',
      orEmail: 'atau log masuk dengan e-mel',
      emailLabel: 'E-Mel',
      emailPlaceholder: 'nama@contoh.com',
      passLabel: 'Kata Laluan',
      passPlaceholder: 'Masukkan kata laluan anda',
      remember: 'Ingat saya',
      forgotLink: 'Lupa kata laluan?',
      submitLogin: 'Log Masuk',
      submitRegister: 'Daftar Sekarang',
      submitForgot: 'Hantar Pautan Reset',
      noAccount: 'Belum mendaftar?',
      createAccount: 'Daftar akaun baru',
      hasAccount: 'Sudah mempunyai akaun?',
      signInLink: 'Log masuk di sini',
      backToLogin: 'Kembali ke Log Masuk',
      fullNameLabel: 'Nama Penuh',
      fullNamePlaceholder: 'Sila masukkan nama penuh anda',
      phoneLabel: 'Nombor Telefon',
      phonePlaceholder: 'Contoh: 012-345 6789',
      districtLabel: 'Jajahan',
      selectDistrictPlaceholder: 'Sila Pilih Jajahan',
      currentLocationTag: 'Lokasi Semasa',
      confirmPassLabel: 'Sahkan Kata Laluan',
      confirmPassPlaceholder: 'Sila masukkan semula kata laluan anda',
      pass8Chars: '8+ Aksara',
      passUppercase: 'Huruf Besar (A-Z)',
      passNumber: 'Nombor (0-9)',
      radarTitle: 'Radar hujan & cuaca',
      radarSub: 'Kemaskini Masa Nyata',
      damageTitle: 'Lapor kerosakan',
      damageSub: 'Gambar & Lokasi Kawasan',
      satelliteTag: '628+ pusat pemindahan (PPS)',
      systemLive: 'SISTEM AKTIF',
      eligibilityTitle: 'Semak kelayakan bantuan',
      eligibilitySub: 'Semak Kelayakan Anda Serta-Merta!',
      bannerTitle: 'NADI: Platform Komuniti & Respons Bencana',
      navDisaster: 'Bencana',
      navAid: 'Bantuan',
      navReports: 'Aduan',
      navCommunity: 'Komuniti',
      copyright: 'NADI Malaysia. Hak Cipta Terpelihara.',
      privacy: 'Privasi',
      terms: 'Terma',
    },
    EN: {
      loginTitle: 'Login',
      loginSub: 'Step into the world of smart civic analytics and real-time disaster management.',
      regTitle: 'Create Account',
      regSub: 'Join the national network of digital citizens on NADI Malaysia.',
      forgotTitle: 'Forgot Password',
      forgotSub: 'Enter your registered email address to receive a password reset link.',
      googleBtn: 'Sign in with Google',
      orEmail: 'or sign in with email',
      emailLabel: 'Email Address',
      emailPlaceholder: 'name@example.com',
      passLabel: 'Password',
      passPlaceholder: 'Enter your password',
      confirmPassLabel: 'Confirm Password',
      confirmPassPlaceholder: 'Re-enter your password',
      remember: 'Remember me',
      forgotLink: 'Forgot password?',
      submitLogin: 'Login',
      submitRegister: 'Create Account',
      submitForgot: 'Send Reset Link',
      noAccount: 'Not registered yet?',
      createAccount: 'Create an account',
      hasAccount: 'Already registered?',
      signInLink: 'Sign in here',
      backToLogin: 'Back to Login',
      fullNameLabel: 'Full Name',
      fullNamePlaceholder: 'Enter your full name',
      phoneLabel: 'Phone Number',
      phonePlaceholder: 'e.g. 012-345 6789',
      districtLabel: 'District (Jajahan)',
      selectDistrictPlaceholder: 'Select District (Jajahan)',
      currentLocationTag: 'Current Location',
      pass8Chars: '8+ Chars',
      passUppercase: 'Uppercase (A-Z)',
      passNumber: 'Number (0-9)',
      radarTitle: 'Doppler rain radar',
      radarSub: '15-Min Real-Time Update',
      damageTitle: 'Damage reporting',
      damageSub: 'AI Photo & Road Impact Sensors',
      satelliteTag: '628+ verified satellite PPS',
      systemLive: 'SYSTEM LIVE',
      eligibilityTitle: 'Eligibility check engine',
      eligibilitySub: 'Check Your Eligibility Instantly!',
      bannerTitle: 'NADI: Smart Civic Network & National Disaster Management',
      navDisaster: 'Disaster',
      navAid: 'Aid',
      navReports: 'Reports',
      navCommunity: 'Community',
      copyright: 'NADI Malaysia. All Rights Reserved.',
      privacy: 'Privacy',
      terms: 'Terms',
    },
  }[lang];

  // Loaders keep turning under reduced motion (keep-motion); everything else on this screen holds still.
  const spinner = <span className="keep-motion size-4 shrink-0 animate-spin rounded-full border-2 border-current/30 border-t-current" />;

  const alerts = (
    <AnimatePresence>
      {error && (
        <motion.div
          key="error"
          role="alert"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          className="rounded-control bg-danger-soft px-4 py-3 text-sm text-danger-soft-ink"
        >
          {error}
        </motion.div>
      )}
      {message && (
        <motion.div
          key="message"
          role="status"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          className={`flex items-start gap-3 rounded-control px-4 py-3 text-sm ${
            messageType === 'warning' ? 'bg-warning-soft text-warning-soft-ink' : 'bg-accent-soft text-accent-soft-ink'
          }`}
        >
          {messageType === 'warning' ? (
            <Info className="mt-0.5 size-4 shrink-0" />
          ) : (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          )}
          <span>{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className="fixed inset-0 overflow-y-auto bg-paper text-ink">
      <div className="grid min-h-full lg:grid-cols-12">

        {/* Form column */}
        <div className="flex flex-col px-5 py-6 sm:px-10 lg:col-span-6 xl:col-span-5">
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col">

            {/* Brand bar + language selector */}
            <header className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <img src="/images/malaysia-flag.png" alt="Malaysia Flag" className="size-8 shrink-0 rounded-full object-cover" />
                <div className="min-w-0">
                  <p className="text-lg font-bold leading-tight">NADI</p>
                  <p className="text-sm text-muted">Smart civic platform</p>
                </div>
              </div>

              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setShowLangDropdown(!showLangDropdown)}
                  aria-haspopup="menu"
                  aria-expanded={showLangDropdown}
                  className="btn btn--sm"
                >
                  <Globe className="size-4" />
                  <span>{lang === 'BM' ? 'Bahasa Melayu' : 'English'}</span>
                  <ChevronDown className={`size-4 transition-transform motion-reduce:transition-none ${showLangDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showLangDropdown && (
                  <div className="absolute right-0 z-10 mt-2 w-44 rounded-card border border-rule bg-paper p-1 shadow-card">
                    <button
                      type="button"
                      aria-pressed={lang === 'BM'}
                      onClick={() => { setLang('BM'); setShowLangDropdown(false); }}
                      className="flex min-h-10 w-full items-center justify-between gap-2 rounded-control px-3 text-left text-sm font-semibold text-ink hover:bg-paper-3"
                    >
                      <span>Bahasa Melayu</span>
                      {lang === 'BM' && <Check className="size-4" />}
                    </button>
                    <button
                      type="button"
                      aria-pressed={lang === 'EN'}
                      onClick={() => { setLang('EN'); setShowLangDropdown(false); }}
                      className="flex min-h-10 w-full items-center justify-between gap-2 rounded-control px-3 text-left text-sm font-semibold text-ink hover:bg-paper-3"
                    >
                      <span>English</span>
                      {lang === 'EN' && <Check className="size-4" />}
                    </button>
                  </div>
                )}
              </div>
            </header>

            <main className="flex flex-1 flex-col justify-center gap-6 py-10">
              {mode === 'verify_email' ? (
                /* OTP Verification Screen */
                <motion.div
                  key="verify_email"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  className="flex flex-col gap-6"
                >
                  <div>
                    <Mail className="size-8 text-ink-2" />
                    <h1 className="mt-4 text-3xl font-bold">
                      {lang === 'BM' ? 'Sahkan E-Mel Anda' : 'Verify Your Email'}
                    </h1>
                    <p className="mt-2 text-ink-2">
                      {lang === 'BM'
                        ? `Sila masukkan kod 6-digit atau klik pautan pengesahan yang dihantar ke `
                        : `Please enter the 6-digit code or click the confirmation link sent to `}
                      <span className="font-semibold text-ink">{email}</span>
                    </p>
                  </div>

                  {/* 6-Digit OTP Input */}
                  <div className="flex gap-2" onPaste={handleOtpPaste}>
                    {otpDigits.map((digit, i) => (
                      <input
                        key={i}
                        ref={el => { otpRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={e => handleOtpChange(i, e.target.value)}
                        onKeyDown={e => handleOtpKeyDown(i, e)}
                        aria-label={`Digit ${i + 1}`}
                        className="field h-12 w-11 text-center text-xl font-bold"
                        autoFocus={i === 0}
                      />
                    ))}
                  </div>

                  {alerts}

                  <button
                    onClick={handleVerifyOtp}
                    disabled={loading || otpDigits.some(d => !d)}
                    className="btn btn--primary btn--block"
                  >
                    {loading && spinner}
                    <span>{lang === 'BM' ? 'Sahkan Kod' : 'Verify Code'}</span>
                  </button>

                  {/* Resend + Change Email */}
                  <div className="flex flex-wrap items-center justify-between gap-x-4 text-sm">
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={resendCooldown > 0}
                      className="inline-flex min-h-10 items-center gap-2 font-semibold text-ink underline underline-offset-4 focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
                    >
                      <RotateCw className="size-4" />
                      {resendCooldown > 0
                        ? `${lang === 'BM' ? 'Hantar semula dalam' : 'Resend in'} ${resendCooldown}s`
                        : (lang === 'BM' ? 'Hantar Semula Kod' : 'Resend Code')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMode('register'); setError(''); setMessage(''); }}
                      className="min-h-10 font-semibold text-ink underline underline-offset-4 focus-visible:outline-offset-4"
                    >
                      {lang === 'BM' ? 'Tukar E-Mel' : 'Change Email'}
                    </button>
                  </div>
                </motion.div>
              ) : (
                <>
                  {/* Form head */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={mode}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.22 }}
                    >
                      <h1 className="text-3xl font-bold">
                        {mode === 'login' ? t.loginTitle : mode === 'register' ? t.regTitle : t.forgotTitle}
                      </h1>
                      <p className="mt-2 text-ink-2">
                        {mode === 'login' ? t.loginSub : mode === 'register' ? t.regSub : t.forgotSub}
                      </p>
                    </motion.div>
                  </AnimatePresence>

                  {/* Google OAuth + divider */}
                  {mode !== 'forgot' && (
                    <>
                      <button
                        id="google-auth-btn"
                        onClick={handleGoogleAuth}
                        disabled={googleLoading}
                        className="btn btn--block"
                      >
                        {googleLoading ? spinner : (
                          <svg aria-hidden="true" className="size-4 shrink-0" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                          </svg>
                        )}
                        <span>{t.googleBtn}</span>
                      </button>

                      <div className="flex items-center gap-3">
                        <span className="h-px flex-1 bg-rule" />
                        <span className="text-sm text-muted">{t.orEmail}</span>
                        <span className="h-px flex-1 bg-rule" />
                      </div>
                    </>
                  )}

                  {/* Main Auth Form */}
                  <form onSubmit={handleEmailAuth} className="flex flex-col gap-4">
                    {/* Register-only fields */}
                    {mode === 'register' && (
                      <>
                        <div>
                          <label htmlFor="full-name-input" className="label">{t.fullNameLabel}</label>
                          <div className="relative">
                            <User aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                            <input
                              id="full-name-input"
                              type="text"
                              value={fullName}
                              onChange={(e) => setFullName(e.target.value)}
                              placeholder={t.fullNamePlaceholder}
                              required={mode === 'register'}
                              className="field pl-10"
                            />
                          </div>
                        </div>

                        <div>
                          <label htmlFor="phone-input" className="label">{t.phoneLabel}</label>
                          <div className="relative">
                            <Phone aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                            <input
                              id="phone-input"
                              type="tel"
                              value={phone}
                              onChange={(e) => setPhone(e.target.value.replace(/[^\d\s-]/g, ''))}
                              placeholder={t.phonePlaceholder}
                              required={mode === 'register'}
                              className="field pl-10"
                            />
                          </div>
                        </div>

                        <div>
                          <label htmlFor="district-select" className="label">{t.districtLabel}</label>
                          <div className="relative">
                            <MapPin aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted" />
                            <select
                              id="district-select"
                              value={district}
                              onChange={(e) => setDistrict(e.target.value)}
                              required={mode === 'register'}
                              className="field pl-10"
                            >
                              <option value="" disabled>{t.selectDistrictPlaceholder}</option>
                              {sortedJajahan.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label htmlFor="email-input-reg" className="label">{t.emailLabel}</label>
                          <div className="relative">
                            <Mail aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                            <input
                              id="email-input-reg"
                              type="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder={t.emailPlaceholder}
                              required
                              className="field pl-10"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {/* Email Address for Login & Forgot Modes */}
                    {mode !== 'register' && (
                      <div>
                        <label htmlFor="email-input" className="label">{t.emailLabel}</label>
                        <div className="relative">
                          <Mail aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                          <input
                            id="email-input"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder={t.emailPlaceholder}
                            required
                            className="field pl-10"
                          />
                        </div>
                      </div>
                    )}

                    {/* Password (login and register) */}
                    {mode !== 'forgot' && (
                      <div>
                        <label htmlFor="password-input" className="label">{t.passLabel}</label>
                        <div className="relative">
                          <Lock aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                          <input
                            id="password-input"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder={t.passPlaceholder}
                            required
                            minLength={6}
                            className="field pl-10 pr-12"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label={showPassword
                              ? (lang === 'BM' ? 'Sembunyi kata laluan' : 'Hide password')
                              : (lang === 'BM' ? 'Tunjuk kata laluan' : 'Show password')}
                            className="icon-btn absolute right-1 top-1/2 -translate-y-1/2"
                          >
                            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Confirm Password + criteria (register) */}
                    {mode === 'register' && (
                      <>
                        <div>
                          <label htmlFor="confirm-password-input" className="label">{t.confirmPassLabel}</label>
                          <div className="relative">
                            <Lock aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                            <input
                              id="confirm-password-input"
                              type={showConfirmPassword ? 'text' : 'password'}
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              placeholder={t.confirmPassPlaceholder}
                              required
                              minLength={6}
                              className="field pl-10 pr-12"
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              aria-label={showConfirmPassword
                                ? (lang === 'BM' ? 'Sembunyi kata laluan' : 'Hide password')
                                : (lang === 'BM' ? 'Tunjuk kata laluan' : 'Show password')}
                              className="icon-btn absolute right-1 top-1/2 -translate-y-1/2"
                            >
                              {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                            </button>
                          </div>
                        </div>

                        {/* Password Requirements & Match Status */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap gap-2">
                            <span className={`tag ${password.length >= 8 ? 'tag--in' : 'tag--out'}`}>
                              {password.length >= 8 && <CheckCircle2 className="size-3.5" />}
                              8+ Aksara
                            </span>
                            <span className={`tag ${/[A-Z]/.test(password) ? 'tag--in' : 'tag--out'}`}>
                              {/[A-Z]/.test(password) && <CheckCircle2 className="size-3.5" />}
                              Huruf Besar (A-Z)
                            </span>
                            <span className={`tag ${/[0-9]/.test(password) ? 'tag--in' : 'tag--out'}`}>
                              {/[0-9]/.test(password) && <CheckCircle2 className="size-3.5" />}
                              Nombor (0-9)
                            </span>
                          </div>

                          {confirmPassword.length > 0 && (
                            <span className={`tag ${confirmPassword === password ? 'tag--in' : 'tag--out'}`}>
                              {confirmPassword === password ? <CheckCircle2 className="size-3.5" /> : <AlertCircle className="size-3.5" />}
                              {confirmPassword === password ? (lang === 'BM' ? 'Sepadan' : 'Matched') : (lang === 'BM' ? 'Tidak sepadan' : 'No match')}
                            </span>
                          )}
                        </div>
                      </>
                    )}

                    {/* Remember Me & Forgot Password Row */}
                    {mode === 'login' && (
                      <div className="flex flex-wrap items-center justify-between gap-x-4">
                        <label htmlFor="remember-me-input" className="flex min-h-10 cursor-pointer items-center gap-2 text-sm text-ink-2">
                          <input
                            id="remember-me-input"
                            type="checkbox"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            className="size-4 cursor-pointer accent-[var(--color-accent)]"
                          />
                          {t.remember}
                        </label>

                        <button
                          type="button"
                          onClick={() => { setMode('forgot'); setError(''); setMessage(''); }}
                          className="min-h-10 text-sm font-semibold text-ink underline underline-offset-4 focus-visible:outline-offset-4"
                        >
                          {t.forgotLink}
                        </button>
                      </div>
                    )}

                    {alerts}

                    {/* Cloudflare Turnstile CAPTCHA */}
                    {(mode === 'login' || mode === 'register' || mode === 'forgot') && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
                      <div className="flex justify-center">
                        <Turnstile
                          ref={turnstileRef}
                          siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
                          onSuccess={(token) => setCaptchaToken(token)}
                          onExpire={() => setCaptchaToken('')}
                          onError={() => setCaptchaToken('')}
                          options={{ theme: 'dark', size: 'flexible' }}
                        />
                      </div>
                    )}

                    <button
                      id="auth-submit-btn"
                      type="submit"
                      disabled={loading || (mode === 'register' && (!validateStrongPassword(password) || password !== confirmPassword))}
                      className="btn btn--primary btn--block mt-2"
                    >
                      {loading && spinner}
                      <span>{mode === 'login' ? t.submitLogin : mode === 'register' ? t.submitRegister : t.submitForgot}</span>
                    </button>
                  </form>
                </>
              )}

              {/* Bottom Account Mode Switch */}
              {mode !== 'verify_email' && (
                <div className="flex flex-wrap items-center gap-x-2 border-t border-rule pt-2 text-sm text-ink-2">
                  {mode === 'login' ? (
                    <>
                      <span>{t.noAccount}</span>
                      <button
                        type="button"
                        onClick={() => { setMode('register'); setError(''); setMessage(''); }}
                        className="min-h-10 font-semibold text-ink underline underline-offset-4 focus-visible:outline-offset-4"
                      >
                        {t.createAccount}
                      </button>
                    </>
                  ) : mode === 'register' ? (
                    <>
                      <span>{t.hasAccount}</span>
                      <button
                        type="button"
                        onClick={() => { setMode('login'); setError(''); setMessage(''); }}
                        className="min-h-10 font-semibold text-ink underline underline-offset-4 focus-visible:outline-offset-4"
                      >
                        {t.signInLink}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setMode('login'); setError(''); setMessage(''); }}
                      className="min-h-10 font-semibold text-ink underline underline-offset-4 focus-visible:outline-offset-4"
                    >
                      {t.backToLogin}
                    </button>
                  )}
                </div>
              )}
            </main>

            {/* Footer */}
            <footer className="flex flex-wrap items-center justify-between gap-x-6 border-t border-rule pt-2 text-sm text-muted">
              <p>© {new Date().getFullYear()} {t.copyright}</p>
              <div className="flex items-center gap-4">
                <span>{APP_VERSION}</span>
                <Link href="/privacy" className="inline-flex min-h-10 items-center underline underline-offset-4 focus-visible:outline-offset-4 hover:text-accent">{t.privacy}</Link>
                <Link href="/terms" className="inline-flex min-h-10 items-center underline underline-offset-4 focus-visible:outline-offset-4 hover:text-accent">{t.terms}</Link>
              </div>
            </footer>
          </div>
        </div>

        {/* Quiet panel: desktop only */}
        <aside className="hidden border-l border-rule bg-paper-2 lg:col-span-6 lg:block xl:col-span-7">
          <div className="sticky top-0 flex min-h-dvh max-w-2xl flex-col justify-center gap-10 px-12 py-16 xl:px-20">
            <div className="flex flex-col items-start gap-4">
              <p className="text-2xl font-bold text-balance">{t.bannerTitle}</p>
              <span className="tag tag--in">{t.satelliteTag}</span>
            </div>

            <ul className="ruled">
              {([
                [Radar, t.radarTitle, t.radarSub],
                [Shield, t.damageTitle, t.damageSub],
                [Zap, t.eligibilityTitle, t.eligibilitySub],
              ] as const).map(([Icon, title, sub]) => (
                <li key={title} className="flex gap-4 py-4">
                  <Icon className="mt-0.5 size-5 shrink-0 text-ink-2" />
                  <div>
                    <p className="font-semibold">{title}</p>
                    <p className="text-ink-2">{sub}</p>
                  </div>
                </li>
              ))}
            </ul>

            <p className="text-sm text-ink-2">{KELANTAN_PLACES.join(', ')}</p>

            <ul className="flex flex-wrap gap-2">
              {[t.navDisaster, t.navAid, t.navReports, t.navCommunity].map((name) => (
                <li key={name} className="tag">{name}</li>
              ))}
            </ul>
          </div>
        </aside>

      </div>
    </div>
  );
}
