'use client';
import { useState, useCallback, createContext, useContext, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Star, Trophy, Heart, Flame } from 'lucide-react';

// ===== Types =====
interface XPPopup {
  id: string;
  amount: number;
  label: string;
  x: number;
  y: number;
}

interface CelebrationData {
  type: 'streak' | 'badge' | 'rank_up' | 'quest_complete' | 'milestone';
  title: string;
  subtitle: string;
  icon: string;
  color: string;
}

interface GamificationContextType {
  showXPPopup: (amount: number, label?: string) => void;
  showCelebration: (data: CelebrationData) => void;
  triggerConfetti: () => void;
}

const GamificationContext = createContext<GamificationContextType>({
  showXPPopup: () => {},
  showCelebration: () => {},
  triggerConfetti: () => {},
});

export function useGamification() {
  return useContext(GamificationContext);
}

// ===== Confetti Particle =====
function ConfettiParticle({ delay, color }: { delay: number; color: string }) {
  const x = Math.random() * 100;
  const rotation = Math.random() * 720 - 360;
  const size = 4 + Math.random() * 6;
  const duration = 1.5 + Math.random() * 1;

  return (
    <motion.div
      initial={{ y: -20, x: `${x}vw`, opacity: 1, rotate: 0, scale: 1 }}
      animate={{ y: '110vh', opacity: 0, rotate: rotation, scale: 0.3 }}
      transition={{ duration, delay, ease: 'easeIn' }}
      className="fixed z-[300] pointer-events-none"
      style={{
        width: size,
        height: size * 1.5,
        backgroundColor: color,
        borderRadius: 2,
        left: 0,
        top: 0,
      }}
    />
  );
}

// ===== XP Floating Popup =====
function XPFloat({ popup, onDone }: { popup: XPPopup; onDone: (id: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 1, y: 0, scale: 0.5 }}
      animate={{ opacity: 0, y: -80, scale: 1.2 }}
      transition={{ duration: 1.2, ease: 'easeOut' }}
      onAnimationComplete={() => onDone(popup.id)}
      className="fixed z-[250] pointer-events-none flex items-center gap-1.5"
      style={{ left: popup.x, top: popup.y }}
    >
      <div className="bg-gradient-to-r from-[#C5A367] to-[#E8C34B] text-[#0A0A0C] px-3 py-1.5 rounded-full text-sm font-black shadow-[0_0_20px_rgba(197,163,103,0.5)] flex items-center gap-1">
        <Zap className="w-3.5 h-3.5" />
        +{popup.amount} XP
      </div>
      {popup.label && (
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#C5A367] bg-[#C5A367]/10 px-2 py-1 rounded-md border border-[#C5A367]/20">
          {popup.label}
        </span>
      )}
    </motion.div>
  );
}

// ===== Celebration Modal =====
function CelebrationModal({ data, onClose }: { data: CelebrationData; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-md flex items-center justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        exit={{ scale: 0.5, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="bg-[#111113] border-2 rounded-3xl p-8 max-w-xs w-full text-center shadow-2xl relative overflow-hidden"
        style={{ borderColor: data.color + '40' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Glow background */}
        <div className="absolute inset-0 opacity-10" style={{ background: `radial-gradient(circle at 50% 30%, ${data.color}, transparent 70%)` }} />

        {/* Sparkle ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          className="w-24 h-24 rounded-full border-2 border-dashed mx-auto mb-4 flex items-center justify-center relative"
          style={{ borderColor: data.color + '30' }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 400 }}
            className="text-5xl"
          >
            {data.icon}
          </motion.div>
          {/* Orbiting stars */}
          {[0, 1, 2, 3].map(i => (
            <motion.div
              key={i}
              animate={{ rotate: [i * 90, i * 90 + 360] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              className="absolute w-full h-full"
              style={{ transformOrigin: 'center' }}
            >
              <Star className="w-3 h-3 absolute -top-1.5 left-1/2 -translate-x-1/2" style={{ color: data.color }} />
            </motion.div>
          ))}
        </motion.div>

        <motion.h3
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-xl font-serif font-bold text-white mb-2 relative z-10"
        >
          {data.title}
        </motion.h3>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="text-sm text-zinc-400 mb-6 relative z-10"
        >
          {data.subtitle}
        </motion.p>

        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          whileTap={{ scale: 0.95 }}
          onClick={onClose}
          className="w-full py-3.5 rounded-2xl text-[10px] font-bold uppercase tracking-widest text-[#0A0A0C] shadow-lg relative z-10"
          style={{ background: `linear-gradient(135deg, ${data.color}, ${data.color}CC)` }}
        >
          Awesome! 
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

// ===== Provider =====
export function GamificationProvider({ children }: { children: ReactNode }) {
  const [xpPopups, setXpPopups] = useState<XPPopup[]>([]);
  const [celebration, setCelebration] = useState<CelebrationData | null>(null);
  const [confettiParticles, setConfettiParticles] = useState<{ id: string; delay: number; color: string }[]>([]);

  const CONFETTI_COLORS = ['#C5A367', '#E8C34B', '#10B981', '#3B82F6', '#A855F7', '#F59E0B', '#EF4444'];

  const showXPPopup = useCallback((amount: number, label: string = '') => {
    const id = `xp-${Date.now()}-${Math.random()}`;
    // Place in the upper center area
    const x = window.innerWidth / 2 - 60 + (Math.random() - 0.5) * 80;
    const y = 120 + Math.random() * 40;
    setXpPopups(prev => [...prev, { id, amount, label, x, y }]);
    // Auto cleanup
    setTimeout(() => {
      setXpPopups(prev => prev.filter(p => p.id !== id));
    }, 1500);
  }, []);

  const triggerConfetti = useCallback(() => {
    const particles = Array.from({ length: 40 }, (_, i) => ({
      id: `confetti-${Date.now()}-${i}`,
      delay: Math.random() * 0.5,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    }));
    setConfettiParticles(particles);
    setTimeout(() => setConfettiParticles([]), 3000);
  }, []);

  const showCelebration = useCallback((data: CelebrationData) => {
    setCelebration(data);
    triggerConfetti();
  }, [triggerConfetti]);

  const removePopup = useCallback((id: string) => {
    setXpPopups(prev => prev.filter(p => p.id !== id));
  }, []);

  return (
    <GamificationContext.Provider value={{ showXPPopup, showCelebration, triggerConfetti }}>
      {children}

      {/* XP Popups */}
      <AnimatePresence>
        {xpPopups.map(popup => (
          <XPFloat key={popup.id} popup={popup} onDone={removePopup} />
        ))}
      </AnimatePresence>

      {/* Confetti */}
      <AnimatePresence>
        {confettiParticles.map(p => (
          <ConfettiParticle key={p.id} delay={p.delay} color={p.color} />
        ))}
      </AnimatePresence>

      {/* Celebration Modal */}
      <AnimatePresence>
        {celebration && (
          <CelebrationModal data={celebration} onClose={() => setCelebration(null)} />
        )}
      </AnimatePresence>
    </GamificationContext.Provider>
  );
}
