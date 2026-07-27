'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/src/context/AuthContext';
import { useGame } from '@/src/context/GameContext';
import { useLanguage } from '@/src/context/LanguageContext';
import { useXP } from '@/src/hooks/useXP';
import { useWeather } from '@/src/hooks/useWeather';
import {
    CloudRain, AlertTriangle, ShieldAlert, Heart, Activity, Mic,
    Trophy, Target, Award, Zap, ChevronRight, Loader2, Thermometer,
    Wind, Droplets, CheckCircle2, Lock, Flame, Users, TrendingUp,
    Send, ThumbsUp, MessageSquare, Plus, Trash2
} from 'lucide-react';
import { RANK_DATA } from '@/src/constants/ranks';

export default function DashboardView() {
    const { user } = useAuth();
    const { t } = useLanguage();
    const { quests, badges, crs, crsLabel, leaderboard, stats } = useGame();
    const { xp, level, xpToNext, addXp } = useXP();
    const { weather, isWeatherLoading, locationLabel } = useWeather();

    const [recentPosts, setRecentPosts] = useState<any[]>([]);
    const [isLoadingPosts, setIsLoadingPosts] = useState(true);

    const currentRankIndex = RANK_DATA.reduce((acc, r, i) => level >= r.level ? i : acc, 0);
    const nextRankIndex = Math.min(currentRankIndex + 1, RANK_DATA.length - 1);
    const rank = RANK_DATA[currentRankIndex];
    const nextRank = RANK_DATA[nextRankIndex];
    const xpPercent = Math.min((xp / xpToNext) * 100, 100);
    const completedQuests = quests.filter(q => q.completed).length;
    const totalQuests = quests.length;
    const unlockedBadges = badges.filter(b => b.unlocked).length;
    const totalBadges = badges.length;

    const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Warga';

    // Greeting based on time of day
    const hour = new Date().getHours();
    const greetingKey = hour < 12 ? 'Selamat Pagi' : hour < 18 ? 'Selamat Petang' : 'Selamat Malam';

    const [newPostContent, setNewPostContent] = useState('');
    const [newPostType, setNewPostType] = useState('general');
    const [isSubmittingPost, setIsSubmittingPost] = useState(false);
    const [postError, setPostError] = useState<string | null>(null);
    const { incrementStat, completeQuest } = useGame();

    useEffect(() => {
        fetch('/api/community')
            .then(r => r.json())
            .then(d => { if (d.success) setRecentPosts(d.posts); })
            .catch(() => {})
            .finally(() => setIsLoadingPosts(false));
    }, []);

    const handleCreatePost = async () => {
        if (!newPostContent.trim() || isSubmittingPost) return;
        setIsSubmittingPost(true);
        setPostError(null);
        try {
            const authorName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Warga';
            const res = await fetch('/api/community', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: newPostContent, type: newPostType, author: authorName })
            });
            const d = await res.json();
            if (d.success) {
                setRecentPosts(prev => [d.post, ...prev]);
                setNewPostContent('');
                setPostError(null);
                incrementStat('communityPosts');
            } else {
                setPostError(d.error || 'Gagal menghantar mesej.');
            }
        } catch (err) {
            console.error('Failed to post:', err);
            setPostError('Ralat rangkaian. Sila cuba lagi.');
        } finally {
            setIsSubmittingPost(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter') {
            const isMobile = typeof window !== 'undefined' && (
                window.innerWidth < 768 ||
                /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
            );
            if (isMobile || e.shiftKey || e.ctrlKey) return;
            e.preventDefault();
            if (newPostContent.trim() && !isSubmittingPost) {
                handleCreatePost();
            }
        }
    };

    const handleDeletePost = async (postId: string) => {
        try {
            const res = await fetch(`/api/community?id=${postId}`, { method: 'DELETE' });
            const d = await res.json();
            if (d.success) {
                setRecentPosts(prev => prev.filter(p => p.id !== postId));
            } else {
                setPostError(d.error || 'Gagal memadam mesej.');
            }
        } catch {
            setPostError('Ralat rangkaian semasa memadam.');
        }
    };

    const handleDeleteAllMyPosts = async () => {
        if (!confirm('Adakah anda pasti mahu memadam SEMUA mesej anda?')) return;
        try {
            const res = await fetch('/api/community?all=true', { method: 'DELETE' });
            const d = await res.json();
            if (d.success) {
                const authorName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Warga';
                setRecentPosts(prev => prev.filter(p => p.user_id !== user?.id && p.author !== authorName));
            } else {
                setPostError(d.error || 'Gagal memadam semua mesej.');
            }
        } catch {
            setPostError('Ralat rangkaian semasa memadam.');
        }
    };

    const switchToTab = (tabId: string) => {
        const btn = document.getElementById(`tab-${tabId}`);
        if (btn) btn.click();
    };

    const openCommunityFeed = () => {
        const btn = document.getElementById('tour-community');
        if (btn) btn.click();
    };

    const RankIcon = rank.icon;

    return (
        <div className="p-5 h-full flex flex-col relative z-0 overflow-y-auto pb-24 no-scrollbar">

            {/* ═══════ 1. HERO RANK CARD ═══════ */}
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative rounded-2xl p-5 mb-5 overflow-hidden"
                style={{
                    background: `linear-gradient(135deg, ${rank.color}22, ${rank.color}08)`,
                    border: `1px solid ${rank.color}33`,
                }}
            >
                {/* Subtle glow */}
                <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-20 blur-2xl" style={{ background: rank.color }} />

                <div className="relative z-10 flex items-start justify-between">
                    <div className="flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>
                            {greetingKey}
                        </p>
                        <h2 className="text-xl font-bold tracking-tight mb-0.5" style={{ color: 'var(--text-primary)' }}>
                            {userName}
                        </h2>
                        <div className="flex items-center gap-2 mt-1">
                            <RankIcon className="w-4 h-4" style={{ color: rank.color }} />
                            <span className="text-xs font-bold" style={{ color: rank.color }}>{rank.title}</span>
                            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>· {rank.subtitle}</span>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <span className="text-2xl font-black tabular-nums" style={{ color: 'var(--text-primary)' }}>Lv.{level}</span>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${rank.color}20`, color: rank.color }}>
                            {rank.perk}
                        </span>
                    </div>
                </div>

                {/* XP Bar */}
                <div className="relative z-10 mt-4">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>{xp} / {xpToNext} XP</span>
                        {currentRankIndex < RANK_DATA.length - 1 && (
                            <span className="text-[9px] font-medium" style={{ color: 'var(--text-muted)' }}>
                                Next: {nextRank.title} (Lv.{nextRank.level})
                            </span>
                        )}
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${xpPercent}%` }}
                            transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                            className="h-full rounded-full"
                            style={{ background: `linear-gradient(90deg, ${rank.color}, ${rank.color}CC)` }}
                        />
                    </div>
                </div>
            </motion.div>

            {/* ═══════ 2. STAT PILLS ROW ═══════ */}
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="grid grid-cols-3 gap-2 mb-5"
            >
                <div className="rounded-xl p-3 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                    <Trophy className="w-4 h-4 mx-auto mb-1" style={{ color: '#F59E0B' }} />
                    <div className="text-lg font-black tabular-nums" style={{ color: 'var(--text-primary)' }}>{crs}</div>
                    <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>CRS</div>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                    <Target className="w-4 h-4 mx-auto mb-1" style={{ color: '#3B82F6' }} />
                    <div className="text-lg font-black tabular-nums" style={{ color: 'var(--text-primary)' }}>{completedQuests}/{totalQuests}</div>
                    <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Quests</div>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                    <Award className="w-4 h-4 mx-auto mb-1" style={{ color: '#A855F7' }} />
                    <div className="text-lg font-black tabular-nums" style={{ color: 'var(--text-primary)' }}>{unlockedBadges}/{totalBadges}</div>
                    <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Badges</div>
                </div>
            </motion.div>

            {/* ═══════ 3. DAILY QUESTS ═══════ */}
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="mb-5"
            >
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Daily Quests</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{
                        background: completedQuests === totalQuests ? 'var(--success)' : 'var(--bg-subtle)',
                        color: completedQuests === totalQuests ? 'white' : 'var(--text-muted)'
                    }}>
                        {completedQuests === totalQuests ? '✓ All Done!' : `${completedQuests}/${totalQuests}`}
                    </span>
                </div>
                <div className="space-y-2">
                    {quests.slice(0, 4).map((q, i) => (
                        <motion.div
                            key={q.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2 + i * 0.05 }}
                            className="flex items-center gap-3 rounded-xl p-3 transition-all"
                            style={{
                                background: q.completed ? `${rank.color}08` : 'var(--bg-card)',
                                border: `1px solid ${q.completed ? rank.color + '30' : 'var(--border-default)'}`,
                                opacity: q.completed ? 0.7 : 1,
                            }}
                        >
                            {q.completed ? (
                                <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: 'var(--success)' }} />
                            ) : (
                                <div className="w-5 h-5 rounded-full border-2 shrink-0" style={{ borderColor: 'var(--border-default)' }} />
                            )}
                            <div className="flex-1 min-w-0">
                                <span className={`text-xs font-bold block ${q.completed ? 'line-through' : ''}`} style={{ color: 'var(--text-primary)' }}>
                                    {q.title}
                                </span>
                                <span className="text-[10px] block truncate" style={{ color: 'var(--text-muted)' }}>
                                    {q.description}
                                </span>
                            </div>
                            <span className="text-[10px] font-bold shrink-0 px-2 py-0.5 rounded-full" style={{
                                background: q.completed ? 'var(--success)' : `${rank.color}15`,
                                color: q.completed ? 'white' : rank.color,
                            }}>
                                +{q.xpReward} XP
                            </span>
                        </motion.div>
                    ))}
                </div>
            </motion.div>

            {/* ═══════ 4. WEATHER + ALERTS ═══════ */}
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="mb-5 space-y-3"
            >
                <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Local Conditions</h3>

                <div className="rounded-2xl p-4 relative overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{locationLabel}</span>
                        {isWeatherLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--text-muted)' }} />
                        ) : weather ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>Live</span>
                        ) : null}
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'var(--bg-subtle)' }}>
                                {weather?.rainMm && weather.rainMm > 0 ? (
                                    <CloudRain className="w-6 h-6" style={{ color: 'var(--info)' }} />
                                ) : (
                                    <Thermometer className="w-6 h-6" style={{ color: 'var(--warning)' }} />
                                )}
                            </div>
                            <div>
                                <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                                    {weather ? Math.round(weather.temp) : '--'}°C
                                </div>
                                <div className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                                    {weather ? `Feels like ${Math.round(weather.feelsLike)}°C` : 'Loading...'}
                                </div>
                            </div>
                        </div>

                        {weather && (
                            <div className="flex flex-col gap-2 border-l pl-4" style={{ borderColor: 'var(--border-default)' }}>
                                <div className="flex items-center gap-2">
                                    <Droplets className="w-3 h-3" style={{ color: 'var(--info)' }} />
                                    <span className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>{weather.humidity}%</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Wind className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                                    <span className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>{Math.round(weather.windSpeed * 3.6)} km/h</span>
                                </div>
                                {weather.rainMm > 0 && (
                                    <div className="flex items-center gap-2">
                                        <CloudRain className="w-3 h-3" style={{ color: 'var(--info)' }} />
                                        <span className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>{weather.rainMm}mm</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Flood alert */}
                {Boolean(weather?.rainMm && weather.rainMm > 5) && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="rounded-2xl p-4 flex items-start gap-3 border"
                        style={{ background: 'var(--danger-muted)', borderColor: 'var(--danger)', color: 'var(--danger)' }}
                    >
                        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                        <div>
                            <h4 className="text-sm font-bold mb-1">Heavy Rain Alert</h4>
                            <p className="text-xs opacity-90 mb-2">High rainfall detected. Potential flash flood risk.</p>
                            <button onClick={() => switchToTab('bencana')} className="text-xs font-bold underline">View Bencana Map →</button>
                        </div>
                    </motion.div>
                )}
            </motion.div>



            {/* ═══════ 7. COMMUNITY HUB (UTAMA) ═══════ */}
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mb-6"
            >
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-emerald-400" />
                        <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-primary)' }}>
                            Suara Warga (Live Community Feed)
                        </h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {recentPosts.length} Mesej
                        </span>
                        {recentPosts.some(p => p.user_id === user?.id || p.author === userName) && (
                            <button
                                onClick={handleDeleteAllMyPosts}
                                className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all flex items-center gap-1"
                                title="Padam semua mesej yang saya hantar"
                            >
                                <Trash2 className="w-3 h-3" />
                                Padam Mesej Saya
                            </button>
                        )}
                    </div>
                </div>

                {/* Inline Post Composer */}
                <div className="rounded-2xl border p-4 mb-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-1" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                            {userName.charAt(0)}
                        </div>
                        <div className="flex-1">
                            <textarea
                                value={newPostContent}
                                onChange={(e) => { setNewPostContent(e.target.value); setPostError(null); }}
                                onKeyDown={handleKeyDown}
                                placeholder="Apa perkembangan atau pesanan untuk warga tempatan?"
                                rows={2}
                                className="w-full text-xs rounded-xl p-3 resize-none outline-none transition-all"
                                style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                            />

                            {postError && (
                                <p className="text-[10px] font-bold text-red-400 mt-1.5 flex items-center gap-1">
                                    ⚠️ {postError}
                                </p>
                            )}

                            <div className="flex items-center justify-end mt-2">
                                <button
                                    onClick={handleCreatePost}
                                    disabled={!newPostContent.trim() || isSubmittingPost}
                                    className="text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 text-white transition-all disabled:opacity-50"
                                    style={{ background: 'var(--accent)' }}
                                >
                                    {isSubmittingPost ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                    Hantar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Live Community Feed List */}
                <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
                    {isLoadingPosts ? (
                        <div className="p-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-muted)' }} /></div>
                    ) : recentPosts.length > 0 ? (
                        <div className="divide-y" style={{ borderColor: 'var(--border-default)' }}>
                            {recentPosts.map((post: any, i: number) => (
                                <motion.div
                                    key={post.id || i}
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 * i }}
                                    className="p-4 hover:bg-[var(--bg-subtle)] transition-colors"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                                                {(post.author || 'Warga').charAt(0)}
                                            </div>
                                            <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{post.author || 'Warga NADI'}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                                                {new Date(post.timestamp || Date.now()).toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            {(post.user_id === user?.id || post.author === userName) && (
                                                <button
                                                    onClick={() => handleDeletePost(post.id)}
                                                    title="Padam mesej ini"
                                                    className="p-1 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-xs leading-relaxed pl-8" style={{ color: 'var(--text-secondary)' }}>{post.content}</p>
                                </motion.div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-8 text-center">
                            <Users className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                            <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Belum ada mesej komuniti. Jadilah yang pertama!</p>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* ═══════ 8. LEADERBOARD PEEK ═══════ */}
            {leaderboard && leaderboard.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45 }}
                    className="mb-6"
                >
                    <h3 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Top Citizens</h3>
                    <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
                        {leaderboard.slice(0, 3).map((entry: any, i: number) => {
                            const medals = ['🥇', '🥈', '🥉'];
                            return (
                                <div key={i} className="flex items-center gap-3 p-3 border-b last:border-b-0" style={{ borderColor: 'var(--border-default)' }}>
                                    <span className="text-base">{medals[i]}</span>
                                    <div className="flex-1 min-w-0">
                                        <span className="text-xs font-bold block truncate" style={{ color: 'var(--text-primary)' }}>{entry.name || entry.email}</span>
                                    </div>
                                    <span className="text-[10px] font-bold tabular-nums" style={{ color: 'var(--accent)' }}>{entry.xp || entry.score} XP</span>
                                </div>
                            );
                        })}
                    </div>
                </motion.div>
            )}

            {/* ═══════ 9. SYSTEM FOOTER ═══════ */}
            <footer className="mt-6 pt-6 pb-2 border-t text-center" style={{ borderColor: 'var(--border-default)' }}>
                <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--text-primary)' }}>
                    NADI
                </p>
                <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                    Platform Digital Komuniti & Respon Warga
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3 text-[10px] mt-3 font-medium" style={{ color: 'var(--text-muted)' }}>
                    <span>v2.7.3</span>
                    <span>•</span>
                    <span>Hak Cipta Terpelihara © {new Date().getFullYear()} NADI</span>
                    <span>•</span>
                    <span>Pusat Khidmat & Maklumat Digital</span>
                </div>
            </footer>

        </div>
    );
}
