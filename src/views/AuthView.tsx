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
import { Mail, Lock, Eye, EyeOff, ArrowRight, Shield, Zap, Globe, Sparkles, User, Phone, MapPin, CheckCircle2, ChevronDown, Check, AlertCircle } from 'lucide-react';

type Mode = 'login' | 'register' | 'forgot';
type Lang = 'BM' | 'EN';

const MALAYSIA_STATES = [
  'Johor', 'Kedah', 'Kelantan', 'Kuala Lumpur', 'Labuan', 'Melaka', 
  'Negeri Sembilan', 'Pahang', 'Penang', 'Perak', 'Perlis', 'Putrajaya', 
  'Sabah', 'Sarawak', 'Selangor', 'Terengganu'
];

/**
 * 3D Particle Globe Component using HTML5 Canvas 2D Perspective Projection
 * Smooth, lightweight 60FPS 3D rendering with glowing atmosphere and connecting data arcs
 */
function ParticleGlobe({ isMobile = false }: { isMobile?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const updateDimensions = () => {
      if (!canvas) return;
      const rect = canvas.parentElement?.getBoundingClientRect();
      const w = canvas.offsetWidth || rect?.width || 800;
      const h = canvas.offsetHeight || rect?.height || 800;
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      return { w, h };
    };

    let { w: width, h: height } = updateDimensions() || { w: 800, h: 800 };

    const handleResize = () => {
      const dims = updateDimensions();
      if (dims) {
        width = dims.w;
        height = dims.h;
      }
    };
    window.addEventListener('resize', handleResize);

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

      const dims = updateDimensions();
      if (dims) {
        width = dims.w;
        height = dims.h;
      }

      // Compute smooth continuous right-side fraction based on container width
      // If width >= 1280 (large laptop/desktop): globe centered at 0.64 (right side)
      // If width < 1280 (shrunk laptop window / tablet): globe smoothly shifts towards 0.50 (middle)
      const fraction = Math.max(0.50, Math.min(0.64, 0.50 + ((width - 700) / 580) * 0.14));
      const centerX = width * fraction;
      const centerY = height * 0.5;
      const radius = Math.max(120, Math.min(width, height) * 0.40);

      // Draw background ambient glow for the globe
      const bgGlow = ctx.createRadialGradient(centerX, centerY, Math.max(0.1, radius * 0.2), centerX, centerY, Math.max(0.1, radius * 1.5));
      bgGlow.addColorStop(0, 'rgba(16, 185, 129, 0.22)'); // Soft Emerald core
      bgGlow.addColorStop(0.40, 'rgba(6, 182, 212, 0.15)'); // Cyan atmosphere
      bgGlow.addColorStop(0.80, 'rgba(30, 58, 138, 0.08)'); // Deep blue outer
      bgGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = bgGlow;
      ctx.fillRect(0, 0, width, height);

      // Draw outer atmospheric ring
      ctx.beginPath();
      ctx.arc(centerX, centerY, Math.max(0.1, radius * 1.04), 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(centerX, centerY, Math.max(0.1, radius * 1.12), 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.20)';
      ctx.lineWidth = 1.0;
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
        const scale = Math.max(0.1, fov / Math.max(1, fov + z2));
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
      ctx.lineWidth = 0.8;

      for (let i = 0; i < frontPoints.length; i += 3) {
        const p1 = frontPoints[i];
        for (let j = i + 1; j < Math.min(i + 9, frontPoints.length); j++) {
          const p2 = frontPoints[j];
          const dx = p1.px - p2.px;
          const dy = p1.py - p2.py;
          const distSq = dx * dx + dy * dy;

          if (distSq < 4800) {
            const alpha = (1 - Math.sqrt(distSq) / 69) * 0.35 * (p1.z < 0 ? 1 : 0.4);
            ctx.beginPath();
            ctx.moveTo(p1.px, p1.py);
            ctx.lineTo(p2.px, p2.py);
            ctx.strokeStyle = p1.isHotspot 
              ? `rgba(16, 185, 129, ${alpha * 1.6})`
              : `rgba(6, 182, 212, ${alpha * 1.2})`;
            ctx.stroke();
          }
        }
      }

      // Screen collision tracking array to prevent text label overlap
      const drawnLabelPositions: { x: number; y: number }[] = [];

      // Draw points & hotspot labels
      projected.forEach((p) => {
        const opacity = Math.max(0.20, Math.min(1, (p.z < 0 ? 1 : 0.40) * p.scale * 1.3));
        const size = Math.max(0.8, Math.abs(p.baseSize * p.scale * 1.1));

        ctx.beginPath();
        ctx.arc(p.px, p.py, Math.max(0.8, size), 0, Math.PI * 2);

        if (p.isHotspot) {
          const color = `rgba(16, 185, 129, ${opacity})`; // Emerald for Malaysia

          ctx.fillStyle = color;
          ctx.fill();

          // Outer pulse ring for hotspot
          ctx.beginPath();
          ctx.arc(p.px, p.py, Math.max(0.1, size * 2.6), 0, Math.PI * 2);
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
  const [stateRegion, setStateRegion] = useState('');

  // Pure Automatic GPS State Detection (No IP tracking fallback)
  useEffect(() => {
    let isMounted = true;

    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const { latitude, longitude } = pos.coords;
            const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
            const data = await res.json();
            const rawName = data.principalSubdivision || data.administrative?.[0]?.name || data.locality;
            if (rawName && isMounted) {
              const lower = rawName.toLowerCase();
              const matched = MALAYSIA_STATES.find((s) => {
                const sLower = s.toLowerCase();
                return lower.includes(sLower) || sLower.includes(lower);
              });
              if (matched) {
                setStateRegion(matched);
              }
            }
          } catch (err) {
            // Geocode failed -> defaults to "Sila Pilih Negeri"
          }
        },
        () => {
          // GPS denied or error -> defaults to "Sila Pilih Negeri"
        },
        { timeout: 5000, enableHighAccuracy: false }
      );
    }
    return () => {
      isMounted = false;
    };
  }, []);

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

  // Load remembered email and password on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedEmail = localStorage.getItem('nadi_remembered_email');
      const savedPass = localStorage.getItem('nadi_remembered_pass');
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
      if (savedPass) {
        try {
          setPassword(atob(savedPass));
        } catch {
          setPassword(savedPass);
        }
      }
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

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    // Save or remove remembered email & password
    if (typeof window !== 'undefined') {
      if (rememberMe) {
        if (email) localStorage.setItem('nadi_remembered_email', email);
        if (password) localStorage.setItem('nadi_remembered_pass', btoa(password));
      } else {
        localStorage.removeItem('nadi_remembered_email');
        localStorage.removeItem('nadi_remembered_pass');
      }
    }

    try {
      if (mode === 'register') {
        // Validate phone number format (01X... 10 or 11 digits total)
        if (!validateMalaysianPhone(phone)) {
          setError(lang === 'BM' ? 'Nombor telefon tidak sah.' : 'Invalid phone number.');
          setLoading(false);
          return;
        }

        // Validate strong password protocol
        if (!validateStrongPassword(password)) {
          setError(
            lang === 'BM'
              ? 'Kata laluan mesti sekurang-kurangnya 8 aksara dan mengandungi huruf besar (A-Z) & nombor (0-9).'
              : 'Password must be at least 8 characters long with an uppercase letter (A-Z) & a number (0-9).'
          );
          setLoading(false);
          return;
        }

        // Validate password confirmation match
        if (password !== confirmPassword) {
          setError(
            lang === 'BM'
              ? 'Kata laluan dan sahkan kata laluan tidak sepadan.'
              : 'Password and confirm password do not match.'
          );
          setLoading(false);
          return;
        }

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
        if (error) {
          const errMsg = (error.message || '').toLowerCase();
          if (errMsg.includes('already registered') || errMsg.includes('already exists') || errMsg.includes('email_exists') || errMsg.includes('user_already_exists')) {
            setMode('login');
            setMessage(
              lang === 'BM'
                ? 'Nombor telefon atau e-mel ini telah pun berdaftar. Kami telah memindahkan anda ke log masuk!'
                : 'This phone number or email is already registered. Switched to login form!'
            );
            return;
          }
          throw error;
        }
        setMessage(lang === 'BM' ? 'Pautan pengesahan telah dihantar ke e-mel anda!' : 'Verification link sent to your email!');
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset`,
        });
        if (error) throw error;
        setMessage(lang === 'BM' ? 'Pautan menetapkan semula kata laluan telah dihantar!' : 'Password reset link sent to your email!');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          const errMsg = (error.message || '').toLowerCase();
          // If account doesn't exist in Supabase auth database, auto-switch to register mode keeping email & password prefilled
          if (errMsg.includes('invalid login credentials') || errMsg.includes('user not found') || errMsg.includes('invalid_credentials')) {
            setMode('register');
            setMessage(
              lang === 'BM' 
                ? 'Akaun belum berdaftar. Kami telah memindahkan anda ke borang pendaftaran!' 
                : 'Account not registered yet. Switched to sign-up form!'
            );
            return;
          }
          throw error;
        }
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
      regTitle: 'Daftar Akaun',
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
      fullNamePlaceholder: 'Sila masukkan nama penuh anda',
      phoneLabel: 'Nombor Telefon',
      phonePlaceholder: 'Contoh: 012-345 6789',
      stateLabel: 'Negeri',
      selectStatePlaceholder: 'Sila Pilih Negeri',
      confirmPassLabel: 'Sahkan Kata Laluan',
      confirmPassPlaceholder: 'Sila masukkan semula kata laluan anda',
      pass8Chars: '8+ Aksara',
      passUppercase: 'Huruf Besar (A-Z)',
      passNumber: 'Nombor (0-9)',
      radarTitle: 'RADAR HUJAN DOPPLER',
      radarSub: 'Kemaskini 15-Min Real-Time',
      damageTitle: 'ADUAN KEROSAKAN',
      damageSub: 'Foto AI & Sensor Impak Jalan',
      satelliteTag: '628+ PPS SATELIT SAH',
      systemLive: 'SISTEM LIVE',
      eligibilityTitle: 'ENJIN SEMAKAN KELAYAKAN',
      eligibilitySub: 'Semak Kelayakan Anda Serta-Merta!',
      bannerTitle: 'NADI — Rangkaian Pintar & Pengurusan Bencana Kebangsaan',
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
      backToLogin: '← Back to Login',
      fullNameLabel: 'Full Name',
      fullNamePlaceholder: 'Enter your full name',
      phoneLabel: 'Phone Number',
      phonePlaceholder: 'e.g. 012-345 6789',
      stateLabel: 'State',
      selectStatePlaceholder: 'Select State',
      pass8Chars: '8+ Chars',
      passUppercase: 'Uppercase (A-Z)',
      passNumber: 'Number (0-9)',
      radarTitle: 'DOPPLER RAIN RADAR',
      radarSub: '15-Min Real-Time Update',
      damageTitle: 'DAMAGE REPORTING',
      damageSub: 'AI Photo & Road Impact Sensors',
      satelliteTag: '628+ VERIFIED SATELLITE PPS',
      systemLive: 'SYSTEM LIVE',
      eligibilityTitle: 'ELIGIBILITY CHECK ENGINE',
      eligibilitySub: 'Check Your Eligibility Instantly!',
      bannerTitle: 'NADI — Smart Civic Network & National Disaster Management',
      navDisaster: 'Disaster',
      navAid: 'Aid',
      navReports: 'Reports',
      navCommunity: 'Community',
      copyright: 'NADI Malaysia. All Rights Reserved.',
      privacy: 'Privacy',
      terms: 'Terms',
    },
  }[lang];

  return (
    <div className="h-screen w-full bg-[#050811] text-white flex flex-col justify-between overflow-hidden selection:bg-emerald-500/30 select-none relative">
      
      {/* Universal Full-Bleed 3D Particle Globe — Adapts automatically to all devices & window resizing */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <ParticleGlobe />
      </div>

      {/* Grid Container — Left Form Column + Right Feature Telemetry Chips */}
      <div className="w-full flex-1 grid grid-cols-1 lg:grid-cols-12 h-screen max-h-screen overflow-hidden relative z-10 pointer-events-none">
        
        {/* Left Column — Dark Sleek Translucent Form Area */}
        <div className="lg:col-span-5 xl:col-span-4 bg-[#070B14]/35 backdrop-blur-sm lg:bg-[#070B14]/85 lg:backdrop-blur-xl border-r border-slate-800/60 p-4 sm:p-5 lg:p-6 xl:p-8 flex flex-col justify-between h-full relative z-20 shadow-2xl overflow-y-auto lg:overflow-y-hidden pointer-events-auto">
          
          {/* Top Brand Bar + Language Selector */}
          <div>
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              {/* Brand Logo & Name */}
              <div className="flex items-center gap-3">
                <div className="relative flex items-center justify-center w-8.5 h-8.5 rounded-xl bg-[#0C1222] border border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.25)] overflow-hidden">
                  <img src="/images/malaysia-flag.png" alt="Malaysia Flag" className="w-6 h-6 rounded-full object-cover relative z-10 filter drop-shadow" />
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-cyan-500/20 blur-sm pointer-events-none" />
                </div>
                <div>
                  <span className="text-base font-black tracking-wider text-white flex items-center gap-1.5">
                    NADI <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">{APP_VERSION}</span>
                  </span>
                  <p className="text-[9px] text-slate-400 tracking-widest uppercase font-medium">Smart Civic Platform</p>
                </div>
              </div>

              {/* Language Selector Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowLangDropdown(!showLangDropdown)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] font-semibold text-slate-300 hover:text-white hover:border-slate-700 transition-all duration-200"
                >
                  <Globe className="w-3 h-3 text-emerald-400" />
                  <span>{lang === 'BM' ? 'Bahasa Melayu' : 'English'}</span>
                  <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform ${showLangDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showLangDropdown && (
                  <div className="absolute right-0 mt-2 w-36 rounded-xl bg-[#0D1424] border border-slate-800 shadow-2xl py-1 z-50 backdrop-blur-xl">
                    <button
                      type="button"
                      onClick={() => { setLang('BM'); setShowLangDropdown(false); }}
                      className={`w-full text-left px-3 py-1.5 text-xs font-semibold flex items-center justify-between transition-colors ${
                        lang === 'BM' ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                      }`}
                    >
                      <span>Bahasa Melayu</span>
                      {lang === 'BM' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setLang('EN'); setShowLangDropdown(false); }}
                      className={`w-full text-left px-3 py-1.5 text-xs font-semibold flex items-center justify-between transition-colors ${
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
                className="mb-3 sm:mb-4"
              >
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white font-sans">
                  {mode === 'login' ? t.loginTitle : mode === 'register' ? t.regTitle : t.forgotTitle}
                </h1>
                <p className="text-xs text-slate-400 mt-1 leading-normal max-w-sm">
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
                className="w-full flex items-center justify-center gap-3 font-semibold py-2 px-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 text-white transition-all duration-200 text-xs mb-2.5 sm:mb-3 disabled:opacity-60 shadow-inner group"
              >
                {googleLoading ? (
                  <div className="w-3.5 h-3.5 border-2 rounded-full animate-spin border-white/20 border-t-white" />
                ) : (
                  <svg className="w-3.5 h-3.5 shrink-0 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
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
              <div className="flex items-center gap-3 mb-2.5 sm:mb-3">
                <div className="flex-1 h-px bg-slate-800/80" />
                <span className="text-[10px] font-medium text-slate-500 lowercase">{t.orEmail}</span>
                <div className="flex-1 h-px bg-slate-800/80" />
              </div>
            )}

            {/* Main Auth Form */}
            <form onSubmit={handleEmailAuth} className="space-y-2.5 sm:space-y-3">
              
              {/* Extended Register Fields */}
              {mode === 'register' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2.5 sm:space-y-3">
                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">{t.fullNameLabel}</label>
                    <div className="relative group">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder={t.fullNamePlaceholder}
                        required={mode === 'register'}
                        className="w-full bg-[#0B101E] border border-slate-800 focus:border-emerald-500 rounded-xl py-2 sm:py-2.5 pl-10 pr-4 text-xs text-white placeholder:text-slate-600 outline-none transition-all duration-200 focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                  </div>

                  {/* Phone Number */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">{t.phoneLabel}</label>
                    <div className="relative group">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/[^\d\s-]/g, ''))}
                        placeholder={t.phonePlaceholder}
                        required={mode === 'register'}
                        className="w-full bg-[#0B101E] border border-slate-800 focus:border-emerald-500 rounded-xl py-2 sm:py-2.5 pl-10 pr-4 text-xs text-white placeholder:text-slate-600 outline-none transition-all duration-200 focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                  </div>

                  {/* State Region */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">{t.stateLabel}</label>
                    <div className="relative group">
                      <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-emerald-400 transition-colors pointer-events-none z-10" />
                      <select
                        value={stateRegion}
                        onChange={(e) => setStateRegion(e.target.value)}
                        required={mode === 'register'}
                        className={`w-full bg-[#0B101E] border border-slate-800 focus:border-emerald-500 rounded-xl py-2 sm:py-2.5 pl-10 pr-4 text-xs outline-none transition-all duration-200 focus:ring-2 focus:ring-emerald-500/20 appearance-none ${stateRegion ? 'text-white' : 'text-slate-500'}`}
                      >
                        <option value="" disabled className="bg-[#0B101E] text-slate-500">{t.selectStatePlaceholder}</option>
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
                <label className="block text-xs font-semibold text-slate-300 mb-1">{t.emailLabel}</label>
                <div className="relative group">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                  <input
                    id="email-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t.emailPlaceholder}
                    required
                    className="w-full bg-[#0B101E] border border-slate-800 focus:border-emerald-500 rounded-xl py-2 sm:py-2.5 pl-10 pr-4 text-xs text-white placeholder:text-slate-600 outline-none transition-all duration-200 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              {/* Password */}
              {mode !== 'forgot' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
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
                      className="w-full bg-[#0B101E] border border-slate-800 focus:border-emerald-500 rounded-xl py-2 sm:py-2.5 pl-10 pr-11 text-xs text-white placeholder:text-slate-600 outline-none transition-all duration-200 focus:ring-2 focus:ring-emerald-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Live Password Strength Protocol Indicators for Register Mode */}
                  {mode === 'register' && (
                    <div className="flex items-center gap-1.5 mt-1.5 text-[10px] font-semibold">
                      {/* Criterion 1: Min 8 Chars */}
                      <motion.div
                        animate={{
                          backgroundColor: password.length >= 8 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(15, 23, 42, 0.8)',
                          borderColor: password.length >= 8 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(30, 41, 59, 0.8)',
                          color: password.length >= 8 ? '#34d399' : '#64748b',
                        }}
                        transition={{ duration: 0.2 }}
                        className="px-2 py-0.5 rounded-md border flex items-center gap-1 overflow-hidden"
                      >
                        <AnimatePresence initial={false}>
                          {password.length >= 8 && (
                            <motion.span
                              key="check-1"
                              initial={{ scale: 0, opacity: 0, width: 0 }}
                              animate={{ scale: 1, opacity: 1, width: 'auto' }}
                              exit={{ scale: 0, opacity: 0, width: 0 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                              className="flex items-center shrink-0 overflow-hidden"
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            </motion.span>
                          )}
                        </AnimatePresence>
                        <span>{t.pass8Chars}</span>
                      </motion.div>

                      {/* Criterion 2: Uppercase A-Z */}
                      <motion.div
                        animate={{
                          backgroundColor: /[A-Z]/.test(password) ? 'rgba(16, 185, 129, 0.12)' : 'rgba(15, 23, 42, 0.8)',
                          borderColor: /[A-Z]/.test(password) ? 'rgba(16, 185, 129, 0.4)' : 'rgba(30, 41, 59, 0.8)',
                          color: /[A-Z]/.test(password) ? '#34d399' : '#64748b',
                        }}
                        transition={{ duration: 0.2 }}
                        className="px-2 py-0.5 rounded-md border flex items-center gap-1 overflow-hidden"
                      >
                        <AnimatePresence initial={false}>
                          {/[A-Z]/.test(password) && (
                            <motion.span
                              key="check-2"
                              initial={{ scale: 0, opacity: 0, width: 0 }}
                              animate={{ scale: 1, opacity: 1, width: 'auto' }}
                              exit={{ scale: 0, opacity: 0, width: 0 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                              className="flex items-center shrink-0 overflow-hidden"
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            </motion.span>
                          )}
                        </AnimatePresence>
                        <span>{t.passUppercase}</span>
                      </motion.div>

                      {/* Criterion 3: Number 0-9 */}
                      <motion.div
                        animate={{
                          backgroundColor: /[0-9]/.test(password) ? 'rgba(16, 185, 129, 0.12)' : 'rgba(15, 23, 42, 0.8)',
                          borderColor: /[0-9]/.test(password) ? 'rgba(16, 185, 129, 0.4)' : 'rgba(30, 41, 59, 0.8)',
                          color: /[0-9]/.test(password) ? '#34d399' : '#64748b',
                        }}
                        transition={{ duration: 0.2 }}
                        className="px-2 py-0.5 rounded-md border flex items-center gap-1 overflow-hidden"
                      >
                        <AnimatePresence initial={false}>
                          {/[0-9]/.test(password) && (
                            <motion.span
                              key="check-3"
                              initial={{ scale: 0, opacity: 0, width: 0 }}
                              animate={{ scale: 1, opacity: 1, width: 'auto' }}
                              exit={{ scale: 0, opacity: 0, width: 0 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                              className="flex items-center shrink-0 overflow-hidden"
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            </motion.span>
                          )}
                        </AnimatePresence>
                        <span>{t.passNumber}</span>
                      </motion.div>
                    </div>
                  )}
                </div>
              )}

              {/* Confirm Password Field (Register Mode) */}
              {mode === 'register' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-300">{t.confirmPassLabel}</label>
                  </div>
                  <div className="relative group">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                    <input
                      id="confirm-password-input"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder={t.confirmPassPlaceholder}
                      required={mode === 'register'}
                      minLength={6}
                      className="w-full bg-[#0B101E] border border-slate-800 focus:border-emerald-500 rounded-xl py-2 sm:py-2.5 pl-10 pr-11 text-xs text-white placeholder:text-slate-600 outline-none transition-all duration-200 focus:ring-2 focus:ring-emerald-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Live Real-time Confirm Password Match Indicator */}
                  {confirmPassword.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -2 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex items-center gap-1.5 mt-1 text-[11px] font-semibold ${
                        confirmPassword === password ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {confirmPassword === password ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>{lang === 'BM' ? 'Kata laluan sepadan!' : 'Password matched!'}</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                          <span>{lang === 'BM' ? 'Kata laluan tidak sepadan' : 'Password does not match'}</span>
                        </>
                      )}
                    </motion.div>
                  )}
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
                    className="rounded-xl px-4 py-2 text-xs font-semibold bg-red-500/10 border border-red-500/20 text-red-400"
                  >
                    {error}
                  </motion.div>
                )}
                {message && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="rounded-xl px-4 py-2 text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
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
                className="w-full mt-2 sm:mt-2.5 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs sm:text-sm tracking-wide shadow-[0_0_30px_rgba(16,185,129,0.35)] hover:shadow-[0_0_40px_rgba(16,185,129,0.5)] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                ) : (
                  <>
                    <span>{mode === 'login' ? t.submitLogin : mode === 'register' ? t.submitRegister : t.submitForgot}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </motion.button>
            </form>

            {/* Bottom Account Mode Switch */}
            <div className="mt-2.5 pt-2 border-t border-slate-800/60 text-xs text-slate-400 text-left">
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
          <div className="mt-4 pt-3 border-t border-slate-800/40 text-[11px] text-slate-500 flex items-center justify-between">
            <span>© {new Date().getFullYear()} {t.copyright}</span>
            <div className="flex items-center gap-3">
              <span className="hover:text-slate-400 cursor-pointer">{t.privacy}</span>
              <span>·</span>
              <span className="hover:text-slate-400 cursor-pointer">{t.terms}</span>
            </div>
          </div>

        </div>

        {/* Right Column — Deep Futuristic 3D Particle Globe Visual Banner */}
        <div className="hidden lg:block lg:col-span-7 xl:col-span-8 bg-transparent relative overflow-hidden h-full pointer-events-auto">
          
          {/* Ambient Glowing Background Radial Orbs */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none" />
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[160px] pointer-events-none" />

          {/* Dark Overlay Gradients */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#070B14] via-transparent to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#03060E] via-transparent to-transparent opacity-80 pointer-events-none" />

          {/* Top Right Live Command Status Pill */}
          <div className="absolute top-6 right-6 z-10 flex items-center gap-3">
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-950/85 border border-slate-800/80 backdrop-blur-xl text-[10px] font-mono font-semibold text-slate-300 shadow-xl">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>{t.systemLive}</span>
            </div>
            <div className="px-3.5 py-1.5 rounded-full bg-slate-950/85 border border-slate-800/80 backdrop-blur-xl text-[10px] font-mono font-bold text-emerald-400 border-emerald-500/30 shadow-xl">
              {t.satelliteTag}
            </div>
          </div>

          {/* Floating Authentic Feature Telemetry Chips */}
          <div className="absolute top-8 left-6 p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 backdrop-blur-xl shadow-2xl z-10 flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#10b981] animate-pulse shrink-0" />
            <div>
              <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">{t.radarTitle}</div>
              <div className="text-xs font-extrabold text-white">{t.radarSub}</div>
            </div>
          </div>

          <div className="absolute top-32 left-6 p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 backdrop-blur-xl shadow-2xl z-10 flex items-center gap-3">
            <div className="p-1.5 rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
              <Shield className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">{t.damageTitle}</div>
              <div className="text-xs font-extrabold text-white">{t.damageSub}</div>
            </div>
          </div>

          <div className="absolute bottom-24 right-6 p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 backdrop-blur-xl shadow-2xl z-10 flex items-center gap-3">
            <div className="p-1.5 rounded-xl bg-cyan-500/10 text-cyan-400 shrink-0">
              <Zap className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">{t.eligibilityTitle}</div>
              <div className="text-xs font-extrabold text-white">{t.eligibilitySub}</div>
            </div>
          </div>

          {/* Bottom Minimalist Slogan Overlay Bar */}
          <div className="absolute bottom-6 left-6 right-6 p-3.5 rounded-2xl bg-slate-950/85 border border-slate-800/80 backdrop-blur-2xl shadow-2xl z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
                <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
              </div>
              <p className="text-xs sm:text-sm font-bold text-slate-200 tracking-wide">
                {t.bannerTitle}
              </p>
            </div>
            <div className="hidden xl:flex items-center gap-2 text-[10px] font-mono font-semibold text-slate-400">
              <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-emerald-400">{t.navDisaster}</span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-cyan-400">{t.navAid}</span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-amber-400">{t.navReports}</span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-purple-400">{t.navCommunity}</span>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
