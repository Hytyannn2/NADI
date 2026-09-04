'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, Navigation, AlertTriangle, Send, Loader2, Compass } from 'lucide-react';
import { createClient } from '@/src/lib/supabase/client';
import { useAuth } from '@/src/context/AuthContext';
import { sound } from '@/src/lib/audio/soundEffects';

export interface PpsVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  center: {
    name: string;
    jajahan?: string;
    district?: string;
    currentLat?: number;
    currentLng?: number;
    snappedTo?: string | null;
  } | null;
  onVerified?: (newLat: number, newLng: number) => void;
}

// Haversine distance calculator in kilometers
function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const SUBMIT_COOLDOWN_MS = 30000; // 30-second rate-limit cooldown per client session

export default function PpsVerificationModal({
  isOpen,
  onClose,
  center,
  onVerified,
}: PpsVerificationModalProps) {
  const { user } = useAuth();
  const [latInput, setLatInput] = useState('');
  const [lngInput, setLngInput] = useState('');
  const [notes, setNotes] = useState('');
  const [isGpsLoading, setIsGpsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isSyncedToCloud, setIsSyncedToCloud] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [lastSubmitTime, setLastSubmitTime] = useState(0);

  if (!isOpen || !center) return null;

  const district = center.jajahan || center.district || 'Kelantan';

  const handleGetGps = () => {
    if (!navigator.geolocation) {
      setErrorMsg('Peranti anda tidak menyokong Geolocation.');
      return;
    }

    setIsGpsLoading(true);
    setErrorMsg('');
    sound.playSoftTap();

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsGpsLoading(false);
        setLatInput(pos.coords.latitude.toFixed(6));
        setLngInput(pos.coords.longitude.toFixed(6));
        sound.playWaterDrop();
      },
      (err) => {
        setIsGpsLoading(false);
        setErrorMsg(`Gagal membaca GPS: ${err.message}. Anda boleh memasukkan koordinat manual.`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Authentication Check
    if (!user) {
      setErrorMsg('Sila log masuk untuk menghantar pengesahan lokasi PPS.');
      return;
    }

    // 2. Rate Limiting Cooldown Check
    const now = Date.now();
    if (now - lastSubmitTime < SUBMIT_COOLDOWN_MS) {
      const remainingSec = Math.ceil((SUBMIT_COOLDOWN_MS - (now - lastSubmitTime)) / 1000);
      setErrorMsg(`Sila tunggu ${remainingSec} saat sebelum menghantar pengesahan seterusnya.`);
      return;
    }

    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);

    // 3. Tighter Kelantan Geographical Bounds Validation
    const isKelantanBounds = lat >= 4.5 && lat <= 6.5 && lng >= 101.0 && lng <= 102.85;
    if (isNaN(lat) || isNaN(lng) || !isKelantanBounds) {
      setErrorMsg('Koordinat mestilah berada dalam kawasan Negeri Kelantan (Lat: 4.50 – 6.50, Lng: 101.00 – 102.85).');
      return;
    }

    // 4. Distance Proximity Check from Estimated Center
    if (center.currentLat && center.currentLng) {
      const dist = getDistanceKm(center.currentLat, center.currentLng, lat, lng);
      if (dist > 35) {
        setErrorMsg(`Koordinat ini (${dist.toFixed(1)} km jauh) terlalu jauh dari lokasi anggaran ${center.snappedTo || district}. Had maksimum ialah 35 km.`);
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMsg('');

    const payload = {
      center_name: center.name,
      jajahan: district,
      suggested_lat: lat,
      suggested_lng: lng,
      notes: notes.trim().slice(0, 300) || null,
      source: 'community',
      status: 'pending',
      user_id: user.id,
      created_at: new Date().toISOString(),
    };

    let cloudSuccess = false;

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('nadi_pps_corrections')
        .insert(payload);

      if (error) {
        console.warn('[PPS Verification] Supabase insert note:', error.message);
      } else {
        cloudSuccess = true;
      }
    } catch (dbErr) {
      console.warn('[PPS Verification] Supabase connection error:', dbErr);
    }

    // Store in local storage cache so user submission is never lost
    try {
      const existing = JSON.parse(localStorage.getItem('nadi_pps_corrections') || '[]');
      existing.push({ ...payload, synced: cloudSuccess });
      localStorage.setItem('nadi_pps_corrections', JSON.stringify(existing));
    } catch {
      // ignore localStorage quota errors
    }

    sound.playWaterDrop();
    setLastSubmitTime(now);
    setIsSyncedToCloud(cloudSuccess);
    setSuccess(true);
    if (onVerified) onVerified(lat, lng);

    setTimeout(() => {
      setSuccess(false);
      onClose();
    }, 2500);

    setIsSubmitting(false);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-700/80 shadow-2xl overflow-hidden font-sans text-white"
        >
          {/* Header */}
          <div className="p-4 bg-zinc-800/80 border-b border-zinc-700 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                <Compass className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white leading-tight">Bantu Sahkan Lokasi PPS</h3>
                <p className="text-[11px] text-zinc-400 truncate max-w-[260px]">{center.name}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4">
            {/* Status notice */}
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                Pusat ini kini menggunakan <strong>lokasi anggaran</strong> {center.snappedTo ? `(Pusat Mukim ${center.snappedTo})` : `(Jajahan ${district})`}.
                Bantuan anda mempercepatkan laluan mangsa banjir dan pasukan penyelamat.
              </div>
            </div>

            {success ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-8 flex flex-col items-center justify-center text-center gap-3"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 10, stiffness: 200 }}
                  className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center text-emerald-400"
                >
                  <CheckCircle2 className="w-8 h-8" />
                </motion.div>
                <h4 className="text-base font-bold text-white">Terima Kasih!</h4>
                <p className="text-xs text-zinc-300 max-w-xs leading-relaxed">
                  {isSyncedToCloud
                    ? 'Koordinat cadangan anda telah direkodkan untuk pengesahan sistem NADI dan JKM.'
                    : 'Cadangan anda disimpan pada peranti ini dan akan dihantar semula kemudian.'}
                </p>
                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  {isSyncedToCloud ? '✓ Dihantar ke Pangkalan Data' : '💾 Disimpan pada Storan Tempatan'}
                </span>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3.5">
                {/* 1-Click GPS Button */}
                <button
                  type="button"
                  onClick={handleGetGps}
                  disabled={isGpsLoading}
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-blue-600/30 to-emerald-600/30 hover:from-blue-600/40 hover:to-emerald-600/40 border border-blue-500/40 text-xs font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-98 shadow-sm"
                >
                  {isGpsLoading ? (
                    <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                  ) : (
                    <Navigation className="w-4 h-4 text-emerald-400" />
                  )}
                  <span>{isGpsLoading ? 'Sedang membaca GPS...' : '📍 Ambil Lokasi GPS Semasa Saya'}</span>
                </button>

                <div className="relative flex items-center justify-center">
                  <div className="border-t border-zinc-800 w-full" />
                  <span className="bg-zinc-900 px-2 text-[10px] text-zinc-500 font-bold uppercase tracking-wider absolute">
                    Atau Masukkan Manual
                  </span>
                </div>

                {/* Coordinate Fields */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                      Latitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="cth: 5.5347"
                      value={latInput}
                      onChange={(e) => setLatInput(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-800/80 border border-zinc-700 focus:border-blue-500 focus:outline-none text-white font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                      Longitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="cth: 102.1975"
                      value={lngInput}
                      onChange={(e) => setLngInput(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-800/80 border border-zinc-700 focus:border-blue-500 focus:outline-none text-white font-mono"
                      required
                    />
                  </div>
                </div>

                {/* Optional Landmark Notes */}
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                    Petunjuk / Mercu Tanda (Pilihan)
                  </label>
                  <input
                    type="text"
                    placeholder="cth: Bersebelahan Masjid Kg Bekok, pagar hijau"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-800/80 border border-zinc-700 focus:border-blue-500 focus:outline-none text-white"
                  />
                </div>

                {errorMsg && (
                  <p className="text-[11px] text-rose-400 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
                    {errorMsg}
                  </p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-98 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>Hantar Pengesahan</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
