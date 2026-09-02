/**
 * Citizen Authentication View
 * 
 * Handles user login, account registration, password reset, and interactive
 * 3D particle globe canvas rendering.
 */
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

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { createClient } from '@/src/lib/supabase/client';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Shield, Zap, Globe, Sparkles, User, Phone, MapPin, CheckCircle2, ChevronDown, Check, AlertCircle, RotateCw, Info } from 'lucide-react';
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

/**
 * 3D Particle Globe Component using HTML5 Canvas perspective projection.
 * Renders rotating globe animation with Malaysian city markers and ambient connection arcs.
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

    // 24 Strategic Kelantan Jajahan & Civic Flood Telemetry Hubs for animated 3D globe visualization
    const KELANTAN_PLACES = [
      'Kota Bharu', 'Pasir Mas', 'Tumpat', 'Bachok', 'Pasir Puteh', 
      'Machang', 'Tanah Merah', 'Kuala Krai', 'Gua Musang', 'Jeli', 
      'Lojing', 'Rantau Panjang', 'Pengkalan Chepa', 'Kubang Kerian', 'Dabong', 
      'Manek Urai', 'Wakaf Bharu', 'Tok Bali', 'Kok Lanas', 'Ketereh', 
      'Melor', 'Pulai Chondong', 'Bukit Bunga', 'Gual Periok'
    ];

    const numPoints = 800;
    const points: { nx: number; ny: number; nz: number; baseSize: number; isHotspot?: boolean; label?: string }[] = [];

    const phi = Math.PI * (3 - Math.sqrt(5)); // Golden angle

    // Evenly distribute 24 Kelantan locations all around the 3D sphere surface
    for (let i = 0; i < KELANTAN_PLACES.length; i++) {
      // Spread latitude evenly from top (+0.85) to bottom (-0.85)
      const ny = 0.85 - (i / (KELANTAN_PLACES.length - 1)) * 1.7;
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
        label: KELANTAN_PLACES[i],
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
        setMessage(lang === 'BM' ? '✅ E-mel berjaya disahkan! Sila log masuk.' : '✅ Email verified! Please log in.');
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

        // Password criteria are enforced via disabled submit button (tick-box UI)
        // This is a safety net in case the button state is bypassed
        if (!validateStrongPassword(password) || password !== confirmPassword) {
          setLoading(false);
          return;
        }

        // Verify CAPTCHA token server-side before signup
        if (captchaToken) {
          const captchaRes = await fetch('/api/auth/verify-captcha', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: captchaToken }),
          });
          const captchaResult = await captchaRes.json();
          if (!captchaResult.success && !captchaResult.skipped) {
            setError(lang === 'BM' ? 'Pengesahan CAPTCHA gagal. Sila cuba lagi.' : 'CAPTCHA verification failed. Please try again.');
            turnstileRef.current?.reset();
            setCaptchaToken('');
            setLoading(false);
            return;
          }
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
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
        });
        if (error) throw error;
        setMessageType('success');
        setMessage(lang === 'BM' ? 'Pautan menetapkan semula kata laluan telah dihantar!' : 'Password reset link sent to your email!');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
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
    } catch (err: any) {
      setError(err.message || (lang === 'BM' ? 'Ralat berlaku. Sila cuba lagi.' : 'An error occurred. Please try again.'));
    } finally {
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
      setMessage(lang === 'BM' ? '✅ E-mel disahkan! Menglog masuk...' : '✅ Email verified! Logging in...');
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || (lang === 'BM' ? 'Kod tidak sah atau telah tamat tempoh.' : 'Invalid or expired code.'));
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
    } catch (err: any) {
      setError(err.message || (lang === 'BM' ? 'Gagal menghantar semula kod.' : 'Failed to resend code.'));
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
    } catch (err: any) {
      setError(err.message || (lang === 'BM' ? 'Log masuk Google gagal.' : 'Google sign-in failed.'));
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
      backToLogin: '← Kembali ke Log Masuk',
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
      radarTitle: 'RADAR HUJAN & CUACA',
      radarSub: 'Kemaskini Masa Nyata',
      damageTitle: 'LAPOR KEROSAKAN',
      damageSub: 'Gambar & Lokasi Kawasan',
      satelliteTag: '628+ PUSAT PEMINDAHAN (PPS)',
      systemLive: 'SISTEM AKTIF',
      eligibilityTitle: 'SEMAK KELAYAKAN BANTUAN',
      eligibilitySub: 'Semak Kelayakan Anda Serta-Merta!',
      bannerTitle: 'NADI — Platform Komuniti & Respons Bencana',
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
      districtLabel: 'District (Jajahan)',
      selectDistrictPlaceholder: 'Select District (Jajahan)',
      currentLocationTag: 'Current Location',
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
    <div className="fixed inset-0 h-screen w-screen bg-[#050811] text-white overflow-hidden selection:bg-emerald-500/30 select-none">
      
      {/* Universal Full-Bleed 3D Particle Globe — Adapts automatically to all devices & window resizing */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <ParticleGlobe />
      </div>

      {/* Grid Container — Left Form Column + Right Feature Telemetry Chips */}
      <div className="w-full h-full grid grid-cols-1 lg:grid-cols-12 overflow-hidden relative z-10 pointer-events-none">
        
        {/* Left Column — Dark Sleek Translucent Form Area */}
        <div className="lg:col-span-5 xl:col-span-4 bg-[#070B14]/90 backdrop-blur-2xl border-r border-slate-800/60 p-4 sm:p-5 lg:p-5 xl:p-6 flex flex-col justify-between h-full relative z-20 shadow-2xl overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800/60 pointer-events-auto">
          
          {/* Top Brand Bar + Language Selector */}
          <div>
            <div className="flex items-center justify-between mb-2.5 sm:mb-3">
              {/* Brand Logo & Name */}
              <div className="flex items-center gap-2.5">
                <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-[#0C1222] border border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.25)] overflow-hidden">
                  <img src="/images/malaysia-flag.png" alt="Malaysia Flag" className="w-5.5 h-5.5 rounded-full object-cover relative z-10 filter drop-shadow" />
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-cyan-500/20 blur-sm pointer-events-none" />
                </div>
                <div>
                  <span className="text-sm sm:text-base font-black tracking-wider text-white flex items-center gap-1.5">
                    NADI <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">{APP_VERSION}</span>
                  </span>
                  <p className="text-[8px] sm:text-[9px] text-slate-400 tracking-widest uppercase font-medium">Smart Civic Platform</p>
                </div>
              </div>

              {/* Language Selector Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowLangDropdown(!showLangDropdown)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-slate-900/80 border border-slate-800 text-[10px] sm:text-[11px] font-semibold text-slate-300 hover:text-white hover:border-slate-700 transition-all duration-200"
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

            {/* Main Auth View vs Verify Email View */}
            {mode === 'verify_email' ? (
              /* OTP Verification Screen */
              <motion.div
                key="verify_email"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="space-y-4 py-2"
              >
                <div className="text-center">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                    <Mail className="w-7 h-7 text-emerald-400" />
                  </div>
                  <h2 className="text-xl font-extrabold text-white mb-1.5 font-sans">
                    {lang === 'BM' ? 'Sahkan E-Mel Anda' : 'Verify Your Email'}
                  </h2>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                    {lang === 'BM'
                      ? `Sila masukkan kod 6-digit atau klik pautan pengesahan yang dihantar ke `
                      : `Please enter the 6-digit code or click the confirmation link sent to `}
                    <span className="text-emerald-400 font-semibold">{email}</span>
                  </p>
                </div>

                {/* 6-Digit OTP Input */}
                <div className="flex justify-center gap-2 py-1" onPaste={handleOtpPaste}>
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
                      className="w-10 h-12 text-center text-lg font-bold bg-[#0B101E] border border-slate-800 focus:border-emerald-500 rounded-xl text-white outline-none transition-all duration-200 focus:ring-2 focus:ring-emerald-500/20"
                      autoFocus={i === 0}
                    />
                  ))}
                </div>

                {/* Error / Success Alerts */}
                <AnimatePresence>
                  {error && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-xl px-4 py-2 text-xs font-semibold bg-red-500/10 border border-red-500/20 text-red-400 text-center">
                      {error}
                    </motion.div>
                  )}
                  {message && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-xl px-4 py-2 text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-center">
                      {message}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Verify Button */}
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleVerifyOtp}
                  disabled={loading || otpDigits.some(d => !d)}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs sm:text-sm tracking-wide shadow-[0_0_30px_rgba(16,185,129,0.35)] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>{lang === 'BM' ? 'Sahkan Kod' : 'Verify Code'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </motion.button>

                {/* Resend + Change Email */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendCooldown > 0}
                    className="flex items-center gap-1.5 font-semibold text-emerald-400 hover:text-emerald-300 transition-colors disabled:text-slate-600 disabled:cursor-not-allowed"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    {resendCooldown > 0
                      ? `${lang === 'BM' ? 'Hantar semula dalam' : 'Resend in'} ${resendCooldown}s`
                      : (lang === 'BM' ? 'Hantar Semula Kod' : 'Resend Code')}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMode('register'); setError(''); setMessage(''); }}
                    className="font-semibold text-slate-400 hover:text-white transition-colors"
                  >
                    {lang === 'BM' ? 'Tukar E-Mel' : 'Change Email'}
                  </button>
                </div>
              </motion.div>
            ) : (
              <>
                {/* Main Auth Header */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={mode}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="mb-2 sm:mb-3"
                  >
                    <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-white font-sans">
                      {mode === 'login' ? t.loginTitle : mode === 'register' ? t.regTitle : t.forgotTitle}
                    </h1>
                    <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 leading-normal max-w-sm">
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
                    className="w-full flex items-center justify-center gap-2.5 font-semibold py-1.5 sm:py-2 px-3.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 text-white transition-all duration-200 text-xs mb-2 disabled:opacity-60 shadow-inner group"
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
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="flex-1 h-px bg-slate-800/80" />
                    <span className="text-[9px] font-medium text-slate-500 lowercase">{t.orEmail}</span>
                    <div className="flex-1 h-px bg-slate-800/80" />
                  </div>
                )}

                {/* Main Auth Form */}
                <form onSubmit={handleEmailAuth} className="space-y-2">
                  {/* Extended Register Fields (2-Column Compact Grid) */}
                  {mode === 'register' && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {/* Full Name */}
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">{t.fullNameLabel}</label>
                          <div className="relative group">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                            <input
                              type="text"
                              value={fullName}
                              onChange={(e) => setFullName(e.target.value)}
                              placeholder={t.fullNamePlaceholder}
                              required={mode === 'register'}
                              className="w-full bg-[#0B101E] border border-slate-800 focus:border-emerald-500 rounded-xl py-1.5 pl-9 pr-3 text-xs text-white placeholder:text-slate-600 outline-none transition-all duration-200 focus:ring-2 focus:ring-emerald-500/20"
                            />
                          </div>
                        </div>

                        {/* Phone Number */}
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">{t.phoneLabel}</label>
                          <div className="relative group">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                            <input
                              type="tel"
                              value={phone}
                              onChange={(e) => setPhone(e.target.value.replace(/[^\d\s-]/g, ''))}
                              placeholder={t.phonePlaceholder}
                              required={mode === 'register'}
                              className="w-full bg-[#0B101E] border border-slate-800 focus:border-emerald-500 rounded-xl py-1.5 pl-9 pr-3 text-xs text-white placeholder:text-slate-600 outline-none transition-all duration-200 focus:ring-2 focus:ring-emerald-500/20"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {/* Jajahan Selection */}
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">{t.districtLabel}</label>
                          <div className="relative group">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 group-focus-within:text-emerald-400 transition-colors pointer-events-none z-10" />
                            <select
                              value={district}
                              onChange={(e) => setDistrict(e.target.value)}
                              required={mode === 'register'}
                              className={`w-full bg-[#0B101E] border border-slate-800 focus:border-emerald-500 rounded-xl py-1.5 pl-9 pr-3 text-xs outline-none transition-all duration-200 focus:ring-2 focus:ring-emerald-500/20 appearance-none text-white`}
                            >
                              <option value="" disabled className="bg-[#0B101E] text-slate-500">{t.selectDistrictPlaceholder}</option>
                              {sortedJajahan.map((s) => (
                                <option key={s} value={s} className="bg-[#0B101E] text-white">
                                  {s}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Email Address in Register Mode */}
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">{t.emailLabel}</label>
                          <div className="relative group">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                            <input
                              id="email-input-reg"
                              type="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder={t.emailPlaceholder}
                              required
                              className="w-full bg-[#0B101E] border border-slate-800 focus:border-emerald-500 rounded-xl py-1.5 pl-9 pr-3 text-xs text-white placeholder:text-slate-600 outline-none transition-all duration-200 focus:ring-2 focus:ring-emerald-500/20"
                            />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Email Address for Login & Forgot Modes */}
                  {mode !== 'register' && (
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
                          className="w-full bg-[#0B101E] border border-slate-800 focus:border-emerald-500 rounded-xl py-2 pl-10 pr-4 text-xs text-white placeholder:text-slate-600 outline-none transition-all duration-200 focus:ring-2 focus:ring-emerald-500/20"
                        />
                      </div>
                    </div>
                  )}

                  {/* Password Fields — 2-Column for Register, 1-Column for Login */}
                  {mode === 'register' ? (
                    <div className="space-y-1.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {/* Password */}
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">{t.passLabel}</label>
                          <div className="relative group">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                            <input
                              id="password-input"
                              type={showPassword ? 'text' : 'password'}
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder={t.passPlaceholder}
                              required
                              minLength={6}
                              className="w-full bg-[#0B101E] border border-slate-800 focus:border-emerald-500 rounded-xl py-1.5 pl-9 pr-9 text-xs text-white placeholder:text-slate-600 outline-none transition-all duration-200 focus:ring-2 focus:ring-emerald-500/20"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                            >
                              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        {/* Confirm Password */}
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">{t.confirmPassLabel}</label>
                          <div className="relative group">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                            <input
                              id="confirm-password-input"
                              type={showConfirmPassword ? 'text' : 'password'}
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              placeholder={t.confirmPassPlaceholder}
                              required
                              minLength={6}
                              className="w-full bg-[#0B101E] border border-slate-800 focus:border-emerald-500 rounded-xl py-1.5 pl-9 pr-9 text-xs text-white placeholder:text-slate-600 outline-none transition-all duration-200 focus:ring-2 focus:ring-emerald-500/20"
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                            >
                              {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Password Requirements Pills & Match Status */}
                      <div className="flex flex-wrap items-center justify-between gap-1 pt-0.5">
                        <div className="flex flex-wrap gap-1 text-[10px]">
                          {/* Criterion 1 */}
                          <div className={`px-1.5 py-0.5 rounded border flex items-center gap-1 ${password.length >= 8 ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-slate-900/80 border-slate-800 text-slate-500'}`}>
                            {password.length >= 8 && <CheckCircle2 className="w-2.5 h-2.5" />}
                            <span>8+ Aksara</span>
                          </div>
                          {/* Criterion 2 */}
                          <div className={`px-1.5 py-0.5 rounded border flex items-center gap-1 ${/[A-Z]/.test(password) ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-slate-900/80 border-slate-800 text-slate-500'}`}>
                            {/[A-Z]/.test(password) && <CheckCircle2 className="w-2.5 h-2.5" />}
                            <span>Huruf Besar (A-Z)</span>
                          </div>
                          {/* Criterion 3 */}
                          <div className={`px-1.5 py-0.5 rounded border flex items-center gap-1 ${/[0-9]/.test(password) ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-slate-900/80 border-slate-800 text-slate-500'}`}>
                            {/[0-9]/.test(password) && <CheckCircle2 className="w-2.5 h-2.5" />}
                            <span>Nombor (0-9)</span>
                          </div>
                        </div>

                        {/* Match Status */}
                        {confirmPassword.length > 0 && (
                          <span className={`text-[10px] font-semibold flex items-center gap-1 ${confirmPassword === password ? 'text-emerald-400' : 'text-red-400'}`}>
                            {confirmPassword === password ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                            {confirmPassword === password ? (lang === 'BM' ? 'Sepadan' : 'Matched') : (lang === 'BM' ? 'Tidak sepadan' : 'No match')}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : mode === 'login' ? (
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
                          className="w-full bg-[#0B101E] border border-slate-800 focus:border-emerald-500 rounded-xl py-2 pl-10 pr-11 text-xs text-white placeholder:text-slate-600 outline-none transition-all duration-200 focus:ring-2 focus:ring-emerald-500/20"
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
                  ) : null}

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
                        className={`rounded-xl px-3.5 py-2.5 text-xs font-semibold flex items-center gap-2.5 transition-all duration-200 ${
                          messageType === 'warning'
                            ? 'bg-sky-500/10 border border-sky-500/25 text-sky-300 shadow-[0_0_20px_rgba(14,165,233,0.12)]'
                            : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                        }`}
                      >
                        {messageType === 'warning' ? (
                          <Info className="w-4 h-4 text-sky-400 shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        )}
                        <span className="leading-snug">{message}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Cloudflare Turnstile CAPTCHA */}
                  {(mode === 'login' || mode === 'register') && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
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

                  {/* Submit CTA Button */}
                  <motion.button
                    id="auth-submit-btn"
                    type="submit"
                    whileHover={!(loading || (mode === 'register' && (!validateStrongPassword(password) || password !== confirmPassword))) ? { scale: 1.01 } : {}}
                    whileTap={!(loading || (mode === 'register' && (!validateStrongPassword(password) || password !== confirmPassword))) ? { scale: 0.98 } : {}}
                    disabled={loading || (mode === 'register' && (!validateStrongPassword(password) || password !== confirmPassword))}
                    className={`w-full mt-2 sm:mt-2.5 py-2.5 px-4 rounded-xl font-extrabold text-xs sm:text-sm tracking-wide transition-all duration-200 flex items-center justify-center gap-2 ${
                      loading || (mode === 'register' && (!validateStrongPassword(password) || password !== confirmPassword))
                        ? 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-60'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_0_30px_rgba(16,185,129,0.35)] hover:shadow-[0_0_40px_rgba(16,185,129,0.5)]'
                    }`}
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
              </>
            )}

            {/* Bottom Account Mode Switch */}
            {mode !== 'verify_email' && (
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
            )}

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

          {/* Top Right Verified Satellite PPS Pill */}
          <div className="absolute top-6 right-6 z-10 flex items-center gap-3">
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
