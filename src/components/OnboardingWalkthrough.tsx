'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '@/src/context/LanguageContext';

const STEPS = [
    { id: 'bantuan', target: '#tour-bantuan', titleKey: 'tour.bantuan_title', descKey: 'tour.bantuan_desc', placement: 'right' },
    { id: 'bencana', target: '#tour-bencana', titleKey: 'tour.bencana_title', descKey: 'tour.bencana_desc', placement: 'right' },
    { id: 'dashboard', target: '#tab-dashboard', titleKey: 'tour.dashboard_title', descKey: 'tour.dashboard_desc', placement: 'right' },
    { id: 'infra', target: '#tour-infra', titleKey: 'tour.infra_title', descKey: 'tour.infra_desc', placement: 'right' },
    { id: 'suara', target: '#tour-suara', titleKey: 'tour.suara_title', descKey: 'tour.suara_desc', placement: 'right' },
    { id: 'heatmap', target: '#tour-heatmap', titleKey: 'tour.heatmap_title', descKey: 'tour.heatmap_desc', placement: 'bottom-left' },
    { id: 'community', target: '#tour-community', titleKey: 'tour.community_title', descKey: 'tour.community_desc', placement: 'bottom-left' },
    { id: 'notif', target: '#notif-btn', titleKey: 'tour.notif_title', descKey: 'tour.notif_desc', placement: 'bottom-left' },
    { id: 'settings', target: '#settings-btn', titleKey: 'tour.settings_title', descKey: 'tour.settings_desc', placement: 'bottom-left' },
];

export default function OnboardingWalkthrough({ onComplete }: { onComplete: () => void }) {
    const { t } = useLanguage();
    const [step, setStep] = useState(0);
    const [visible, setVisible] = useState(true);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

    const current = STEPS[step];
    const isLast = step === STEPS.length - 1;

    const updateRect = () => {
        if (!current.target) {
            setTargetRect(null);
            return;
        }
        
        // Try multiple possible targets (desktop SideNav vs mobile BottomNav)
        const possibleTargets = [
            current.target, 
            current.target.replace('#tour-', '#tab-')
        ];
        
        let foundEl = null;
        let rect = null;
        
        for (const selector of possibleTargets) {
            const el = document.querySelector(selector);
            if (el) {
                const r = el.getBoundingClientRect();
                if (r.width > 0 && r.height > 0) {
                    foundEl = el;
                    rect = r;
                    break;
                }
            }
        }

        if (foundEl && rect) {
            setTargetRect(rect);
            foundEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        } else {
            setTargetRect(null);
        }
    };

    useEffect(() => {
        updateRect();
        const timer = setTimeout(updateRect, 300);
        const handleResize = () => updateRect();
        window.addEventListener('resize', handleResize);
        window.addEventListener('scroll', handleResize, true);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('scroll', handleResize, true);
        };
    }, [step, current.target]);

    const handleNext = () => {
        if (isLast) {
            handleSkip();
        } else {
            setStep(s => s + 1);
        }
    };

    const handleSkip = () => {
        setVisible(false);
        try { localStorage.setItem('nadi_onboarded', 'true'); } catch { }
        setTimeout(onComplete, 300);
    };

    let tooltipStyle: React.CSSProperties = {};
    let fingerStyle: React.CSSProperties = { display: 'none' };
    let fingerAnim = {};
    let fingerEmoji = '👆';

    if (targetRect && current.placement) {
        const padding = 16;
        let p = current.placement;
        const screenW = typeof window !== 'undefined' ? window.innerWidth : 1000;
        const screenH = typeof window !== 'undefined' ? window.innerHeight : 1000;
        
        // Smart override for mobile/bottom nav items
        if (targetRect.bottom > screenH - 100) {
            p = 'top';
        }

        // Pre-check for right placement overflow
        if (p === 'right') {
            const leftPos = targetRect.right + padding + 40;
            const approxTooltipWidth = 380;
            if (leftPos + approxTooltipWidth + 16 > screenW) {
                p = targetRect.top > screenH / 2 ? 'top' : 'bottom'; 
            }
        }

        if (p === 'right') {
            const topPos = targetRect.top + targetRect.height / 2 - 60;
            tooltipStyle = {
                top: Math.max(padding, Math.min(topPos, screenH - 200)),
                left: targetRect.right + padding + 40,
                width: 'max-content',
                minWidth: '280px',
                maxWidth: `calc(100vw - ${targetRect.right + padding + 40 + padding}px)`,
            };
            fingerStyle = {
                position: 'absolute',
                top: targetRect.top + targetRect.height / 2 - 20,
                left: targetRect.right + padding,
            };
            fingerAnim = { x: [0, -15, 0], scale: [1, 1.05, 0.95, 1] };
            fingerEmoji = '👈';
        } else if (p === 'top') {
            const leftPos = targetRect.left + targetRect.width / 2 - 140;
            tooltipStyle = {
                bottom: screenH - targetRect.top + padding + 40,
                left: Math.max(padding, Math.min(leftPos, screenW - 380 - padding)),
                width: 'max-content',
                minWidth: '280px',
                maxWidth: `calc(100vw - ${padding * 2}px)`,
            };
            fingerStyle = {
                position: 'absolute',
                bottom: screenH - targetRect.top + padding,
                left: targetRect.left + targetRect.width / 2 - 20,
            };
            fingerAnim = { y: [0, 15, 0], scale: [1, 1.05, 0.95, 1] };
            fingerEmoji = '👇';
        } else if (p === 'bottom' || p === 'bottom-left') {
            const leftPos = p === 'bottom' ? targetRect.left + targetRect.width / 2 - 140 : undefined;
            tooltipStyle = {
                top: targetRect.bottom + padding + 40,
                right: p === 'bottom-left' ? 16 : undefined,
                left: leftPos !== undefined ? Math.max(padding, Math.min(leftPos, screenW - 380 - padding)) : undefined,
                width: 'max-content',
                minWidth: '280px',
                maxWidth: `calc(100vw - ${padding * 2}px)`,
            };
            fingerStyle = {
                position: 'absolute',
                top: targetRect.bottom + padding,
                left: targetRect.left + targetRect.width / 2 - 20,
            };
            fingerAnim = { y: [0, -15, 0], scale: [1, 1.05, 0.95, 1] };
            fingerEmoji = '👆';
        }
    }

    return (
        <AnimatePresence>
            {visible && (
                <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }} 
                    transition={{ duration: 0.3 }}
                    className="fixed inset-0 z-[1000] pointer-events-auto"
                >
                    <svg className="absolute inset-0 w-full h-full pointer-events-none transition-all duration-500" preserveAspectRatio="none">
                        <defs>
                            <mask id="tour-mask">
                                <rect x="0" y="0" width="100%" height="100%" fill="white" opacity="0.8" />
                                {targetRect && (
                                    <rect
                                        x={targetRect.left - 8}
                                        y={targetRect.top - 8}
                                        width={targetRect.width + 16}
                                        height={targetRect.height + 16}
                                        fill="black"
                                        rx="12"
                                        className="transition-all duration-500 ease-in-out"
                                    />
                                )}
                            </mask>
                        </defs>
                        <rect x="0" y="0" width="100%" height="100%" fill="black" mask="url(#tour-mask)" opacity="0.75" />
                    </svg>

                    {targetRect && (
                        <motion.div
                            initial={fingerAnim}
                            animate={fingerAnim}
                            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                            style={{ ...fingerStyle, zIndex: 1003 }}
                        >
                            <div className="text-4xl drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
                                {fingerEmoji}
                            </div>
                        </motion.div>
                    )}

                    {targetRect && (
                        <motion.div
                            key={step}
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                            style={tooltipStyle}
                            className="absolute bg-[var(--bg-card)] border border-[var(--border-default)] rounded-3xl p-5 sm:p-6 shadow-2xl z-[1002] overflow-hidden"
                            role="dialog"
                            aria-live="polite"
                            aria-labelledby="tour-step-title"
                            aria-describedby="tour-step-desc"
                        >
                            <h3 id="tour-step-title" className="text-sm sm:text-base font-black text-[var(--text-primary)] mb-2 uppercase tracking-wide break-words">
                                {t(current.titleKey as any) || current.titleKey}
                            </h3>
                            <p id="tour-step-desc" className="text-xs sm:text-sm text-[var(--text-secondary)] mb-6 whitespace-normal leading-relaxed break-words">
                                {t(current.descKey as any) || current.descKey}
                            </p>

                            <div className="flex flex-wrap items-center justify-between gap-3 w-full">
                                <button
                                    onClick={handleSkip}
                                    className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors whitespace-nowrap"
                                >
                                    {t('tour.skip' as any) || 'Langkau'}
                                </button>
                                
                                <div className="flex items-center justify-center gap-1.5 flex-1 min-w-[80px] mx-2">
                                    {STEPS.map((_, i) => (
                                        <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-4 bg-[var(--text-primary)]' : 'w-1.5 bg-[var(--border-default)]'}`} />
                                    ))}
                                </div>

                                <button
                                    onClick={handleNext}
                                    className="bg-[var(--text-primary)] text-[var(--bg-card)] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold active:scale-[0.97] transition-transform whitespace-nowrap w-fit"
                                >
                                    {isLast ? (t('tour.finish' as any) || 'Selesai') : (t('tour.next' as any) || 'Seterusnya')}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
