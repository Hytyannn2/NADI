'use client';

import pkg from '@/package.json';

const APP_VERSION = `v${pkg.version}`;

function MalaysiaFlagIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g clipPath="url(#circular-flag-clip)">
        {/* White background circle */}
        <circle cx="256" cy="256" r="256" fill="#FFFFFF" />

        {/* 14 Red and White Stripes */}
        <rect y="0" width="512" height="36.57" fill="#CC1E27" />
        <rect y="73.14" width="512" height="36.57" fill="#CC1E27" />
        <rect y="146.28" width="512" height="36.57" fill="#CC1E27" />
        <rect y="219.42" width="512" height="36.57" fill="#CC1E27" />
        <rect y="292.57" width="512" height="36.57" fill="#CC1E27" />
        <rect y="365.71" width="512" height="36.57" fill="#CC1E27" />
        <rect y="438.85" width="512" height="36.57" fill="#CC1E27" />
        <rect y="475.42" width="512" height="36.57" fill="#CC1E27" />

        {/* Navy Blue Canton (Top-Left quadrant covering 8 stripes) */}
        <rect width="323" height="292.57" fill="#1C2156" />

        {/* Golden Crescent Moon */}
        <path
          d="M 185 85 C 235 85 275 125 275 175 C 275 225 235 265 185 265 C 162 265 141 257 125 244 C 158 231 181 198 181 175 C 181 152 158 119 125 106 C 141 93 162 85 185 85 Z"
          fill="#FFC800"
        />

        {/* 14-Pointed Golden Star */}
        <path
          d="M 235 175 L 246 153 L 262 167 L 264 143 L 285 153 L 280 129 L 304 132 L 292 110 L 316 105 L 297 89 L 318 77 L 295 70 L 309 52 L 287 53 L 292 29 L 272 40 L 269 16 L 253 31 L 242 9 L 232 31 L 216 16 L 213 40 L 193 29 L 198 53 L 176 52 L 190 70 L 167 77 L 188 89 L 169 105 L 193 110 L 181 132 L 205 129 L 200 153 L 221 143 L 223 167 Z"
          fill="#FFC800"
        />
      </g>
      <defs>
        <clipPath id="circular-flag-clip">
          <circle cx="256" cy="256" r="256" />
        </clipPath>
      </defs>
    </svg>
  );
}

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { createClient } from '@/src/lib/supabase/client';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Shield, Zap, Globe, Sparkles, User, Phone, MapPin, CheckCircle2, ChevronDown, Check } from 'lucide-react';

type Mode = 'login' | 'register' | 'forgot';
type Lang = 'BM' | 'EN';

const MALAYSIA_STATES = [
  'Selangor', 'Kuala Lumpur', 'Johor', 'Penang', 'Perak', 'Kedah', 
  'Kelantan', 'Terengganu', 'Pahang', 'Melaka', 'Negeri Sembilan', 
  'Sabah', 'Sarawak', 'Perlis', 'Putrajaya', 'Labuan'
];

/**
 * 3D Particle Globe Component using HTML5 Canvas 2D Perspective Projection
 * Smooth, lightweight 60FPS 3D rendering with glowing atmosphere and connecting data arcs
 */
function ParticleGlobe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', handleResize);

    // Radius of globe
    const radius = Math.min(width, height) * 0.38;

    // 100% MALAYSIA PLACES ONLY — Beautifully scattered for aesthetic decoration
    const MALAYSIA_PLACES = [
      'Kuala Lumpur', 'Kota Bharu', 'Penang', 'Johor Bahru', 'Kuching', 
      'Kota Kinabalu', 'Kuantan', 'Ipoh', 'Melaka', 'Kuala Terengganu', 
      'Alor Setar', 'Sandakan', 'Miri', 'Putrajaya', 'Seremban', 
      'Kangar', 'Labuan', 'Bintulu', 'Taiping', 'Sibu', 
      'Tawau', 'Batu Pahat', 'Bangi', 'Cyberjaya'
    ];

    const numPoints = 800;
    const points: { nx: number; ny: number; nz: number; baseSize: number; isHotspot?: boolean; label?: string }[] = [];

    const phi = Math.PI * (3 - Math.sqrt(5)); // Golden angle

    // Evenly distribute 24 Malaysian locations all around the 3D sphere surface
    for (let i = 0; i < MALAYSIA_PLACES.length; i++) {
      // Spread latitude evenly from top (+0.85) to bottom (-0.85)
      const ny = 0.85 - (i / (MALAYSIA_PLACES.length - 1)) * 1.7;
      const radiusAtY = Math.sqrt(1 - ny * ny);
      
      // Step longitude around the globe (137.5 degrees step for optimal spacing)
      const theta = i * 2.39996; // ~137.5 degrees

      const nx = Math.cos(theta) * radiusAtY;
      const nz = Math.sin(theta) * radiusAtY;

      points.push({
        nx,
        ny,
        nz,
        baseSize: 2.8,
        isHotspot: true,
        label: MALAYSIA_PLACES[i],
      });
    }

    // Fill the rest of the 3D sphere with background particle mesh dots
    for (let i = 0; i < numPoints; i++) {
      const ny = 1 - (i / (numPoints - 1)) * 2;
      const radiusAtY = Math.sqrt(1 - ny * ny);
      const theta = phi * i;

      const nx = Math.cos(theta) * radiusAtY;
      const nz = Math.sin(theta) * radiusAtY;

      points.push({
        nx,
        ny,
        nz,
        baseSize: Math.random() * 1.2 + 0.5,
        isHotspot: false,
      });
    }

    let angleY = 0;
    let angleX = 0.28;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const radius = Math.min(width, height) * 0.38;
      const centerX = width * 0.56;
      const centerY = height * 0.5;

      // Draw background ambient glow for the globe
      const bgGlow = ctx.createRadialGradient(centerX, centerY, radius * 0.2, centerX, centerY, radius * 1.4);
      bgGlow.addColorStop(0, 'rgba(16, 185, 129, 0.14)'); // Emerald core
      bgGlow.addColorStop(0.35, 'rgba(6, 182, 212, 0.09)'); // Cyan atmosphere
      bgGlow.addColorStop(0.75, 'rgba(30, 58, 138, 0.05)'); // Deep blue outer
      bgGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = bgGlow;
      ctx.fillRect(0, 0, width, height);

      // Draw outer atmospheric ring
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 1.04, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.18)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 1.12, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.08)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 12]);
      ctx.stroke();
      ctx.setLineDash([]);

      angleY += 0.0035; // Smooth rotation speed

      const cosY = Math.cos(angleY);
      const sinY = Math.sin(angleY);
      const cosX = Math.cos(angleX);
      const sinX = Math.sin(angleX);

      // Project 3D to 2D
      const projected = points.map((p) => {
        const pxRadius = p.nx * radius;
        const pyRadius = p.ny * radius;
        const pzRadius = p.nz * radius;

        // Rotate Y
        let x1 = pxRadius * cosY - pzRadius * sinY;
        let z1 = pzRadius * cosY + pxRadius * sinY;

        // Rotate X
        let y1 = pyRadius * cosX - z1 * sinX;
        let z2 = z1 * cosX + pyRadius * sinX;

        // Perspective scale factor
        const fov = 650;
        const scale = fov / (fov + z2);
        const px = centerX + x1 * scale;
        const py = centerY + y1 * scale;

        return {
          px,
          py,
          z: z2,
          scale,
          baseSize: p.baseSize,
          isHotspot: p.isHotspot,
          label: p.label,
        };
      });

      // Sort by Z so front dots draw over back dots
      projected.sort((a, b) => b.z - a.z);

      // Draw connecting lines between close front points
      const frontPoints = projected.filter((p) => p.z < 60);
      ctx.lineWidth = 0.6;

      for (let i = 0; i < frontPoints.length; i += 3) {
        const p1 = frontPoints[i];
        for (let j = i + 1; j < Math.min(i + 9, frontPoints.length); j++) {
          const p2 = frontPoints[j];
          const dx = p1.px - p2.px;
          const dy = p1.py - p2.py;
          const distSq = dx * dx + dy * dy;

          if (distSq < 4800) {
            const alpha = (1 - Math.sqrt(distSq) / 69) * 0.22 * (p1.z < 0 ? 1 : 0.4);
            ctx.beginPath();
            ctx.moveTo(p1.px, p1.py);
            ctx.lineTo(p2.px, p2.py);
            ctx.strokeStyle = p1.isHotspot 
              ? `rgba(16, 185, 129, ${alpha * 1.6})`
              : `rgba(6, 182, 212, ${alpha})`;
            ctx.stroke();
          }
        }
      }

      // Screen collision tracking array to prevent text label overlap
      const drawnLabelPositions: { x: number; y: number }[] = [];

      // Draw points & hotspot labels
      projected.forEach((p) => {
        const opacity = Math.max(0.08, Math.min(1, (p.z < 0 ? 0.95 : 0.22) * p.scale));
        const size = p.baseSize * p.scale;

        ctx.beginPath();
        ctx.arc(p.px, p.py, Math.max(0.8, size), 0, Math.PI * 2);

        if (p.isHotspot) {
          const color = `rgba(16, 185, 129, ${opacity})`; // Emerald for Malaysia

          ctx.fillStyle = color;
          ctx.fill();

          // Outer pulse ring for hotspot
          ctx.beginPath();
          ctx.arc(p.px, p.py, size * 2.6, 0, Math.PI * 2);
          ctx.strokeStyle = color;
          ctx.lineWidth = 0.8;
          ctx.stroke();

          // Hotspot text label when on front hemisphere (z < -45) and not overlapping another label
          if (p.label && p.z < -45) {
            const isTooClose = drawnLabelPositions.some(
              (pos) => Math.hypot(pos.x - p.px, pos.y - p.py) < 42
            );

            if (!isTooClose) {
              drawnLabelPositions.push({ x: p.px, y: p.py });

              ctx.font = 'bold 10px sans-serif';
              ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.95})`;
              
              // Draw marker indicator line
              ctx.beginPath();
              ctx.moveTo(p.px, p.py);
              ctx.lineTo(p.px + 7, p.py - 4);
              ctx.strokeStyle = `rgba(16, 185, 129, ${opacity * 0.6})`;
              ctx.lineWidth = 0.8;
              ctx.stroke();

              ctx.fillText(p.label, p.px + 10, p.py - 3);
            }
          }
        } else {
          ctx.fillStyle = p.z < 0 ? `rgba(6, 182, 212, ${opacity})` : `rgba(148, 163, 184, ${opacity * 0.45})`;
          ctx.fill();
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
}

export default function AuthView({ onSuccess }: { onSuccess?: () => void }) {
  const [mode, setMode] = useState<Mode>('login');
  const [lang, setLang] = useState<Lang>('BM');
  const [showLangDropdown, setShowLangDropdown] = useState(false);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [stateRegion, setStateRegion] = useState('Selangor');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
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
            data: {
              full_name: fullName,
              phone: phone,
              state_region: stateRegion,
            },
            emailRedirectTo: `${window.location.origin}`,
          },
        });
        if (error) throw error;
        setMessage(lang === 'BM' ? 'Pautan pengesahan telah dihantar ke e-mel anda! ' : 'Verification link sent to your email! ');
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset`,
        });
        if (error) throw error;
        setMessage(lang === 'BM' ? 'Pautan menetapkan semula kata laluan telah dihantar! ' : 'Password reset link sent to your email! ');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onSuccess?.();
      }
    } catch (err: any) {
      setError(err.message || (lang === 'BM' ? 'Ralat berlaku. Sila cuba lagi.' : 'An error occurred. Please try again.'));
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
      setError(err.message || (lang === 'BM' ? 'Log masuk Google gagal.' : 'Google sign-in failed.'));
      setGoogleLoading(false);
    }
  };

  const t = {
    BM: {
      loginTitle: 'Log Masuk',
      loginSub: 'Langkah masuk ke platform pintar sivik dan pengurusan bencana kebangsaan.',
      regTitle: 'Daftar Akaun Warga',
      regSub: 'Sertai rangkaian pintar warga digital NADI seluruh Malaysia.',
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
      backToLogin: '← Kembali ke Log Masuk',
      fullNameLabel: 'Nama Penuh',
      fullNamePlaceholder: 'Contoh: Ahmad Razak bin Osman',
      phoneLabel: 'Nombor Telefon (Amaran SOS/Bencana)',
      phonePlaceholder: 'Contoh: 012-345 6789',
      stateLabel: 'Kawasan / Negeri Utama',
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
      remember: 'Remember me',
      forgotLink: 'Forgot password?',
      submitLogin: 'Login',
      submitRegister: 'Create Account',
      submitForgot: 'Send Reset Link',
      noAccount: 'Not registered yet?',
      createAccount: 'Create an account',
      hasAccount: 'Already registered?',
      signInLink: 'Sign in here',
      backToLogin: '← Back to Login',
      fullNameLabel: 'Full Name',
      fullNamePlaceholder: 'e.g. Ahmad Razak bin Osman',
      phoneLabel: 'Phone Number (SOS / Emergency Alerts)',
      phonePlaceholder: 'e.g. 012-345 6789',
      stateLabel: 'State / Primary Region',
    },
  }[lang];

  return (
    <div className="min-h-screen w-full bg-[#050811] text-white flex flex-col justify-between overflow-x-hidden selection:bg-emerald-500/30 select-none">
      
      {/* Grid Container — Left Form Column + Right 3D Particle Canvas */}
      <div className="w-full flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-screen">
        
        {/* Left Column — Dark Sleek Form Area */}
        <div className="lg:col-span-5 xl:col-span-4 bg-[#070B14] border-r border-slate-800/60 p-6 sm:p-10 lg:p-12 flex flex-col justify-between relative z-20 shadow-2xl">
          
          {/* Top Brand Bar + Language Selector */}
          <div>
            <div className="flex items-center justify-between mb-8 sm:mb-12">
              {/* Brand Logo & Name */}
              <div className="flex items-center gap-3">
                <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-[#0C1222] border border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.25)] overflow-hidden">
                  <img src="/images/malaysia-flag.png" alt="Malaysia Flag" className="w-7 h-7 rounded-full object-cover relative z-10 filter drop-shadow" />
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-cyan-500/20 blur-sm pointer-events-none" />
                </div>
                <div>
                  <span className="text-lg font-black tracking-wider text-white flex items-center gap-1.5">
                    NADI <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">{APP_VERSION}</span>
                  </span>
                  <p className="text-[10px] text-slate-400 tracking-widest uppercase font-medium">Smart Civic Platform</p>
                </div>
              </div>

              {/* Language Selector Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowLangDropdown(!showLangDropdown)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white hover:border-slate-700 transition-all duration-200"
                >
                  <Globe className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{lang === 'BM' ? 'Bahasa Melayu' : 'English'}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${showLangDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showLangDropdown && (
                  <div className="absolute right-0 mt-2 w-36 rounded-xl bg-[#0D1424] border border-slate-800 shadow-2xl py-1 z-50 backdrop-blur-xl">
                    <button
                      type="button"
                      onClick={() => { setLang('BM'); setShowLangDropdown(false); }}
                      className={`w-full text-left px-3 py-2 text-xs font-semibold flex items-center justify-between transition-colors ${
                        lang === 'BM' ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                      }`}
                    >
                      <span>Bahasa Melayu</span>
                      {lang === 'BM' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setLang('EN'); setShowLangDropdown(false); }}
                      className={`w-full text-left px-3 py-2 text-xs font-semibold flex items-center justify-between transition-colors ${
                        lang === 'EN' ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                      }`}
                    >
                      <span>English</span>
                      {lang === 'EN' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Main Auth Header */}
            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="mb-8"
              >
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white font-sans">
                  {mode === 'login' ? t.loginTitle : mode === 'register' ? t.regTitle : t.forgotTitle}
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed max-w-sm">
                  {mode === 'login' ? t.loginSub : mode === 'register' ? t.regSub : t.forgotSub}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Google OAuth Button */}
            {mode !== 'forgot' && (
              <motion.button
                id="google-auth-btn"
                whileHover={{ scale: 1.01, backgroundColor: 'rgba(255, 255, 255, 0.06)' }}
                whileTap={{ scale: 0.98 }}
                onClick={handleGoogleAuth}
                disabled={googleLoading}
                className="w-full flex items-center justify-center gap-3 font-semibold py-3.5 px-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 text-white transition-all duration-200 text-xs sm:text-sm mb-6 disabled:opacity-60 shadow-inner group"
              >
                {googleLoading ? (
                  <div className="w-4 h-4 border-2 rounded-full animate-spin border-white/20 border-t-white" />
                ) : (
                  <svg className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                )}
                <span>{t.googleBtn}</span>
              </motion.button>
            )}

            {/* Divider */}
            {mode !== 'forgot' && (
              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 h-px bg-slate-800/80" />
                <span className="text-[11px] font-medium text-slate-500 lowercase">{t.orEmail}</span>
                <div className="flex-1 h-px bg-slate-800/80" />
              </div>
            )}

            {/* Main Auth Form */}
            <form onSubmit={handleEmailAuth} className="space-y-4">
              
              {/* Extended Register Fields */}
              {mode === 'register' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-4">
                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">{t.fullNameLabel}</label>
                    <div className="relative group">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder={t.fullNamePlaceholder}
                        required={mode === 'register'}
                        className="w-full bg-[#0B101E] border border-slate-800 focus:border-emerald-500 rounded-xl py-3 pl-10 pr-4 text-xs sm:text-sm text-white placeholder:text-slate-600 outline-none transition-all duration-200 focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                  </div>

                  {/* Phone Number */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">{t.phoneLabel}</label>
                    <div className="relative group">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder={t.phonePlaceholder}
                        required={mode === 'register'}
                        className="w-full bg-[#0B101E] border border-slate-800 focus:border-emerald-500 rounded-xl py-3 pl-10 pr-4 text-xs sm:text-sm text-white placeholder:text-slate-600 outline-none transition-all duration-200 focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                  </div>

                  {/* State Region */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">{t.stateLabel}</label>
                    <div className="relative group">
                      <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-emerald-400 transition-colors pointer-events-none z-10" />
                      <select
                        value={stateRegion}
                        onChange={(e) => setStateRegion(e.target.value)}
                        className="w-full bg-[#0B101E] border border-slate-800 focus:border-emerald-500 rounded-xl py-3 pl-10 pr-4 text-xs sm:text-sm text-white outline-none transition-all duration-200 focus:ring-2 focus:ring-emerald-500/20 appearance-none"
                      >
                        {MALAYSIA_STATES.map((s) => (
                          <option key={s} value={s} className="bg-[#0B101E] text-white">{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Email Address */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">{t.emailLabel}</label>
                <div className="relative group">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                  <input
                    id="email-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t.emailPlaceholder}
                    required
                    className="w-full bg-[#0B101E] border border-slate-800 focus:border-emerald-500 rounded-xl py-3 pl-10 pr-4 text-xs sm:text-sm text-white placeholder:text-slate-600 outline-none transition-all duration-200 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              {/* Password */}
              {mode !== 'forgot' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-300">{t.passLabel}</label>
                  </div>
                  <div className="relative group">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                    <input
                      id="password-input"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t.passPlaceholder}
                      required
                      minLength={6}
                      className="w-full bg-[#0B101E] border border-slate-800 focus:border-emerald-500 rounded-xl py-3 pl-10 pr-11 text-xs sm:text-sm text-white placeholder:text-slate-600 outline-none transition-all duration-200 focus:ring-2 focus:ring-emerald-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Remember Me & Forgot Password Row */}
              {mode === 'login' && (
                <div className="flex items-center justify-between py-1">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-800 bg-[#0B101E] text-emerald-500 focus:ring-emerald-500/30 focus:ring-offset-0 transition-colors cursor-pointer"
                    />
                    <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">{t.remember}</span>
                  </label>
                  
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); setError(''); setMessage(''); }}
                    className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    {t.forgotLink}
                  </button>
                </div>
              )}

              {/* Error / Success Alerts */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="rounded-xl px-4 py-3 text-xs font-semibold bg-red-500/10 border border-red-500/20 text-red-400"
                  >
                    {error}
                  </motion.div>
                )}
                {message && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="rounded-xl px-4 py-3 text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                  >
                    {message}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit CTA Button */}
              <motion.button
                id="auth-submit-btn"
                type="submit"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                disabled={loading}
                className="w-full mt-2 py-3.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm tracking-wide shadow-[0_0_30px_rgba(16,185,129,0.35)] hover:shadow-[0_0_40px_rgba(16,185,129,0.5)] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                ) : (
                  <>
                    <span>{mode === 'login' ? t.submitLogin : mode === 'register' ? t.submitRegister : t.submitForgot}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </motion.button>
            </form>

            {/* Bottom Account Mode Switch */}
            <div className="mt-6 pt-4 border-t border-slate-800/60 text-xs text-slate-400 text-left">
              {mode === 'login' ? (
                <span>
                  {t.noAccount}{' '}
                  <button
                    type="button"
                    onClick={() => { setMode('register'); setError(''); setMessage(''); }}
                    className="font-bold text-emerald-400 hover:text-emerald-300 underline underline-offset-4 ml-1 transition-colors"
                  >
                    {t.createAccount}
                  </button>
                </span>
              ) : mode === 'register' ? (
                <span>
                  {t.hasAccount}{' '}
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setError(''); setMessage(''); }}
                    className="font-bold text-emerald-400 hover:text-emerald-300 underline underline-offset-4 ml-1 transition-colors"
                  >
                    {t.signInLink}
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(''); setMessage(''); }}
                  className="font-semibold text-slate-300 hover:text-white transition-colors"
                >
                  {t.backToLogin}
                </button>
              )}
            </div>

          </div>

          {/* Footer Copyright */}
          <div className="mt-10 pt-4 border-t border-slate-800/40 text-[11px] text-slate-500 flex items-center justify-between">
            <span>© {new Date().getFullYear()} NADI Malaysia. Hak Cipta Terpelihara.</span>
            <div className="flex items-center gap-3">
              <span className="hover:text-slate-400 cursor-pointer">Privasi</span>
              <span>·</span>
              <span className="hover:text-slate-400 cursor-pointer">Terma</span>
            </div>
          </div>

        </div>

        {/* Right Column — Deep Futuristic 3D Particle Globe Visual Banner */}
        <div className="hidden lg:block lg:col-span-7 xl:col-span-8 bg-[#03060E] relative overflow-hidden">
          
          {/* Interactive 3D Canvas Particle Globe */}
          <ParticleGlobe />

          {/* Dark Overlay Gradients */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#070B14] via-transparent to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#03060E] via-transparent to-transparent opacity-80 pointer-events-none" />


          {/* Bottom Hero Glass Card overlay */}
          <div className="absolute bottom-12 left-12 right-12 p-8 rounded-3xl bg-slate-950/60 border border-slate-800/80 backdrop-blur-2xl max-w-xl shadow-2xl z-10">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-bold text-emerald-400 uppercase tracking-widest w-fit mb-3">
              <Sparkles className="w-3 h-3 text-emerald-400 animate-pulse" /> Platform Sivik Kebangsaan
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Pemantauan Bencana & Respon Komuniti Pintar
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
              Platform digital bersepadu untuk pemantauan aras air sensor LoRaWAN, pengesahan laporan kerosakan infrastruktur, dan koordinasi bantuan bencana di Malaysia.
            </p>
            
            {/* System Feature Grid */}
            <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-slate-800/60 text-left">
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Modul Utama</div>
                <div className="text-sm font-extrabold text-emerald-400 font-mono mt-0.5">5 Komuniti</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Teknologi</div>
                <div className="text-sm font-extrabold text-cyan-400 font-mono mt-0.5">LoRa & AI</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Kawasan</div>
                <div className="text-sm font-extrabold text-white font-mono mt-0.5">Malaysia</div>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
