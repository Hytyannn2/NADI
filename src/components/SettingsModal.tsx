'use client';
import { motion, AnimatePresence } from 'motion/react';
import { X, Globe, Sun, Moon, LogOut, Award, Eye, Monitor, Baseline, Activity, Palette } from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage, LANGUAGES } from '@/src/context/LanguageContext';
import { useTheme, THEMES, FontSize, ColorblindMode, ThemeId } from '@/src/context/ThemeContext';
import { useGame } from '@/src/context/GameContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReplayTutorial: () => void;
}

export default function SettingsModal({ isOpen, onClose, onReplayTutorial }: SettingsModalProps) {
  const { signOut } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const { badges } = useGame();
  const { 
    themeId, setThemeId, fontSize, setFontSize,
    highContrast, setHighContrast,
    colorblindMode, setColorblindMode,
    reduceMotion, setReduceMotion,
    dyslexiaFont, setDyslexiaFont
  } = useTheme();

  const handleThemeSwitch = (tid: ThemeId, e: React.MouseEvent) => {
    if (themeId === tid) return;

    // @ts-ignore - startViewTransition is relatively new
    if (!document.startViewTransition || reduceMotion) {
      setThemeId(tid);
      return;
    }

    const x = e.clientX;
    const y = e.clientY;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    // @ts-ignore
    const transition = document.startViewTransition(() => {
      setThemeId(tid);
    });

    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 500,
          easing: 'ease-in',
          pseudoElement: '::view-transition-new(root)',
        }
      );
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b shrink-0" style={{ borderColor: 'var(--border-default)' }}>
              <div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{t('settings.title')}</h2>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{t('settings.subtitle')}</p>
              </div>
              <button onClick={onClose} className="p-2 rounded-xl transition-colors hover:bg-black/5 dark:hover:bg-white/5" style={{ color: 'var(--text-muted)' }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6 no-scrollbar">
              
              {/* Appearance */}
              <section>
                <h3 className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                  <Monitor className="w-4 h-4" /> {t('settings.appearance')}
                </h3>
                
                <div className="space-y-3">
                  {/* Theme */}
                  <div className="p-3 rounded-2xl" style={{ background: 'var(--bg-subtle)' }}>
                    <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{t('settings.theme')}</p>
                    <div className="flex items-center gap-2">
                      {(Object.keys(THEMES) as ThemeId[]).map(tid => (
                        <button key={tid} onClick={(e) => handleThemeSwitch(tid, e)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all"
                          style={themeId === tid
                            ? { background: 'var(--bg-card)', color: 'var(--text-primary)', boxShadow: 'var(--shadow-sm)' }
                            : { color: 'var(--text-muted)' }
                          }
                        >
                          {tid === 'light' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                          {THEMES[tid].label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Language */}
                  <div className="p-3 rounded-2xl" style={{ background: 'var(--bg-subtle)' }}>
                    <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{t('menu.language')}</p>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                      {LANGUAGES.map(l => (
                        <button key={l.code} onClick={() => setLang(l.code)}
                          className="flex-none flex flex-col items-center justify-center gap-1 min-w-[70px] p-2 rounded-xl transition-all border"
                          style={lang === l.code
                            ? { background: 'var(--accent-muted)', color: 'var(--accent)', borderColor: 'var(--accent)' }
                            : { background: 'var(--bg-card)', color: 'var(--text-muted)', borderColor: 'transparent' }
                          }
                        >
                          <span className="text-lg">{l.flag}</span>
                          <span className="text-[10px] font-bold">{l.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              {/* Accessibility */}
              <section>
                <h3 className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                  <Eye className="w-4 h-4" /> {t('settings.accessibility')}
                </h3>
                
                <div className="space-y-3">
                  {/* Font Size */}
                  <div className="p-3 rounded-2xl" style={{ background: 'var(--bg-subtle)' }}>
                    <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{t('settings.scale')}</p>
                    <div className="flex gap-2">
                      {(['S', 'M', 'L'] as FontSize[]).map(fs => (
                        <button key={fs} onClick={() => setFontSize(fs)}
                          className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border"
                          style={fontSize === fs
                            ? { background: 'var(--accent-muted)', color: 'var(--accent)', borderColor: 'var(--accent)' }
                            : { background: 'var(--bg-card)', color: 'var(--text-muted)', borderColor: 'transparent' }
                          }
                        >{fs === 'S' ? t('settings.scale_s') : fs === 'M' ? t('settings.scale_m') : t('settings.scale_l')}</button>
                      ))}
                    </div>
                  </div>

                  {/* Toggles */}
                  <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
                    <label className="flex items-center justify-between p-4 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors border-b" style={{ borderColor: 'var(--border-default)' }}>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}><Baseline className="w-4 h-4" /></div>
                        <div>
                          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('settings.dyslexia')}</p>
                          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('settings.dyslexia_desc')}</p>
                        </div>
                      </div>
                      <input type="checkbox" checked={dyslexiaFont} onChange={(e) => setDyslexiaFont(e.target.checked)} className="w-5 h-5 accent-[var(--accent)]" />
                    </label>

                    <label className="flex items-center justify-between p-4 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors border-b" style={{ borderColor: 'var(--border-default)' }}>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}><Eye className="w-4 h-4" /></div>
                        <div>
                          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('settings.contrast')}</p>
                          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('settings.contrast_desc')}</p>
                        </div>
                      </div>
                      <input type="checkbox" checked={highContrast} onChange={(e) => setHighContrast(e.target.checked)} className="w-5 h-5 accent-[var(--accent)]" />
                    </label>

                    <label className="flex items-center justify-between p-4 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}><Activity className="w-4 h-4" /></div>
                        <div>
                          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('settings.motion')}</p>
                          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('settings.motion_desc')}</p>
                        </div>
                      </div>
                      <input type="checkbox" checked={reduceMotion} onChange={(e) => setReduceMotion(e.target.checked)} className="w-5 h-5 accent-[var(--accent)]" />
                    </label>
                  </div>

                  {/* Colorblindness */}
                  <div className="p-3 rounded-2xl" style={{ background: 'var(--bg-subtle)' }}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 rounded-lg" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}><Palette className="w-4 h-4" /></div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('settings.colorblind')}</p>
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('settings.colorblind_desc')}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {(['none', 'protanopia', 'deuteranopia', 'tritanopia'] as ColorblindMode[]).map(mode => (
                        <button key={mode} onClick={() => setColorblindMode(mode)}
                          className="py-2.5 px-3 rounded-xl text-xs font-bold transition-all border text-left flex items-center justify-between"
                          style={colorblindMode === mode
                            ? { background: 'var(--accent-muted)', color: 'var(--accent)', borderColor: 'var(--accent)' }
                            : { background: 'var(--bg-card)', color: 'var(--text-secondary)', borderColor: 'transparent' }
                          }
                        >
                          <span className="capitalize">{mode === 'none' ? t('settings.cb_none') : mode}</span>
                          {colorblindMode === mode && <span>✓</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              {/* Badges Section */}
              <section>
                <h3 className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                  <Award className="w-4 h-4 text-amber-400" /> Badges & Achievements ({badges.filter(b => b.unlocked).length}/{badges.length})
                </h3>

                <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto no-scrollbar p-1">
                  {badges.map(b => (
                    <div key={b.id} className="flex items-center gap-2.5 p-2.5 rounded-2xl border transition-all"
                      style={{
                        background: b.unlocked ? 'var(--bg-card)' : 'var(--bg-subtle)',
                        borderColor: b.unlocked ? 'var(--accent)' : 'var(--border-default)',
                        opacity: b.unlocked ? 1 : 0.5
                      }}
                    >
                      <span className="text-2xl shrink-0">{b.unlocked ? b.icon : '🔒'}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold truncate" style={{ color: b.unlocked ? 'var(--text-primary)' : 'var(--text-muted)' }}>{b.name}</p>
                        <p className="text-[9px] line-clamp-1" style={{ color: 'var(--text-muted)' }}>{b.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t flex flex-col gap-2 shrink-0" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-subtle)' }}>
              <button onClick={() => { onReplayTutorial(); onClose(); }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-colors"
                style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
              >
                <Award className="w-4 h-4" style={{ color: 'var(--text-muted)' }} /> {t('settings.tutorial')}
              </button>
              
              <button onClick={() => { signOut(); onClose(); }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-colors"
                style={{ background: 'var(--danger-muted)', color: 'var(--danger)' }}
              >
                <LogOut className="w-4 h-4" /> {t('menu.signout')}
              </button>
            </div>

          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
