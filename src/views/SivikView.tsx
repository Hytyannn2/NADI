'use client';
import { Coins, ShieldAlert, Sparkles, Crown, Download, Loader2, Award, TrendingUp, Target } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useGame } from '@/src/context/GameContext';
import { useLanguage } from '@/src/context/LanguageContext';

interface WalletData {
    balance: number;
    trustScore: number;
    co2Saved: number;
    rideStreak: number;
    streakDay: number;
    transactions: Array<{
        id: number;
        title: string;
        type: 'earn' | 'spend';
        amount: number;
        category: string;
        time: string;
        notes: string;
    }>;
}

const TX_ICON_MAP: Record<string, any> = {
    Civic: Award,
    Transit: Coins,
    Recycle: TrendingUp,
    General: Sparkles,
};

function getTrustLabel(score: number) {
    if (score >= 90) return 'Excellent';
    if (score >= 75) return 'Good';
    if (score >= 50) return 'Average';
    return 'At Risk';
}

export default function SivikView() {
    const [wallet, setWallet] = useState<WalletData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeSection, setActiveSection] = useState<'ledger' | 'leaderboard'>('ledger');
    const { crs, crsLabel, leaderboard, badges, quests } = useGame();
    const { t } = useLanguage();

    const fetchWallet = async () => {
        try {
            const res = await fetch('/api/sivik/wallet');
            const data = await res.json();
            if (data.success) setWallet(data);
        } catch {
            // silently fail
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchWallet();
    }, []);

    const trustLabel = wallet ? getTrustLabel(wallet.trustScore) : '—';
    const completedQuests = quests.filter(q => q.completed).length;
    const unlockedBadges = badges.filter(b => b.unlocked).length;

    return (
        <div className="p-5 h-full flex flex-col relative z-0">

            <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="mb-6"
            >
                <h2 className="text-2xl font-bold mb-1 tracking-tight" style={{ color: 'var(--text-primary)' }}>{t('sivik.pass_title')}</h2>
                <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                    {t('sivik.pass_desc')}
                </p>
            </motion.div>

            {/* Wallet Card */}
            <motion.div
                initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
                className="rounded-2xl p-6 mb-5 relative overflow-hidden shadow-md" style={{ background: 'var(--accent)', color: 'white' }}
            >
                <div className="relative z-10 flex flex-col items-center text-center">
                    <div className="flex items-center gap-2 mb-2">
                        <Coins className="w-5 h-5 text-white/70" />
                        <span className="text-xs text-white/70 font-medium">{t('sivik.pts_title')}</span>
                    </div>
                    {isLoading ? (
                        <div className="flex items-center justify-center h-16 mb-4">
                            <Loader2 className="w-8 h-8 text-white/50 animate-spin" />
                        </div>
                    ) : (
                        <div className="text-5xl font-bold tracking-tight text-white mb-4 flex items-baseline justify-center gap-2">
                            {wallet?.balance ?? 0} <span className="text-base font-medium opacity-60">pts</span>
                        </div>
                    )}
                    <p className="text-xs text-white/50 font-medium">
                        {t('sivik.pts_desc')}
                    </p>
                </div>
            </motion.div>

            {/* Quick Stats Row */}
            <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="grid grid-cols-3 gap-3 mb-5"
            >
                {/* Trust Score */}
                <div className="rounded-2xl p-4 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                    <ShieldAlert className="w-4 h-4 mx-auto mb-2" style={{ color: 'var(--success)' }} />
                    <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{wallet?.trustScore ?? '—'}</p>
                    <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{t('sivik.trust')}</p>
                    <p className="text-[10px] uppercase tracking-widest font-bold mt-0.5" style={{ color: 'var(--success)' }}>{trustLabel}</p>
                </div>

                {/* Quests */}
                <div className="rounded-2xl p-4 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                    <Target className="w-4 h-4 mx-auto mb-2" style={{ color: 'var(--accent)' }} />
                    <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{completedQuests}/{quests.length}</p>
                    <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{t('sivik.quests')}</p>
                </div>

                {/* Badges */}
                <div className="rounded-2xl p-4 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                    <Award className="w-4 h-4 mx-auto mb-2" style={{ color: '#F59E0B' }} />
                    <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{unlockedBadges}/{badges.length}</p>
                    <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{t('sivik.badges')}</p>
                </div>
            </motion.div>

            {/* CRS (Civic Reputation Score) */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                className="rounded-2xl p-4 mb-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-md)' }}
            >
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Crown className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                        <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{t('sivik.crs_title')}</span>
                    </div>
                    <span className="text-lg font-light" style={{ color: 'var(--accent)' }}>{crs}<span className="text-sm" style={{ color: 'var(--text-muted)' }}>/1000</span></span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: 'var(--bg-muted)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${(crs / 1000) * 100}%`, background: 'var(--accent)' }} />
                </div>
                <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{crsLabel}</p>
            </motion.div>

            {/* Section Tabs: Ledger / Leaderboard */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                className="flex p-1 rounded-2xl mb-6" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}
            >
                {(['ledger', 'leaderboard'] as const).map(s => (
                    <button key={s} onClick={() => setActiveSection(s)}
                        className="flex-1 py-2.5 text-xs font-semibold rounded-xl transition-all"
                        style={activeSection === s ? { background: 'var(--bg-card)', color: 'var(--text-primary)', boxShadow: 'var(--shadow-sm)' } : { color: 'var(--text-muted)' }}
                    >{s === 'ledger' ? t('sivik.tab_ledger') : t('sivik.tab_board')}</button>
                ))}
            </motion.div>

            <div className="flex-1 pb-10">

                {/* Leaderboard */}
                {activeSection === 'leaderboard' && (
                    <div className="space-y-2">
                        <h3 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--accent)' }}>{t('sivik.board_title')}</h3>
                        {leaderboard.map((u, i) => (
                            <div key={i} className={`flex items-center justify-between p-4 rounded-2xl border transition-all`}
                                style={u.name === 'You'
                                    ? { background: 'var(--accent-muted)', border: '1px solid var(--accent)' }
                                    : { background: 'var(--bg-card)', border: '1px solid var(--border-default)' }
                                }
                            >
                                <div className="flex items-center gap-3">
                                    <span className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black"
                                        style={i < 3
                                            ? { background: 'var(--accent-muted)', color: 'var(--accent)' }
                                            : { background: 'var(--bg-subtle)', color: 'var(--text-muted)' }
                                        }
                                    >{i < 3 ? ['🥇', '🥈', '🥉'][i] : u.rank}</span>
                                    <div>
                                        <p className="text-xs font-bold" style={{ color: u.name === 'You' ? 'var(--accent)' : 'var(--text-primary)' }}>{u.name}</p>
                                        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{u.mukim}</p>
                                    </div>
                                </div>
                                <span className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>{u.xp} XP</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Proof-of-Work Ledger */}
                {activeSection === 'ledger' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <h3 className="text-xs font-bold uppercase tracking-widest mb-6 flex items-center justify-between" style={{ color: 'var(--accent)' }}>
                            <span>{t('sivik.tab_ledger')}</span>
                            <button onClick={() => {
                                if (!wallet?.transactions?.length) return;
                                const csv = 'Title,Type,Amount,Category,Time\n' + wallet.transactions.map(t => `${t.title},${t.type},${t.amount},${t.category},${t.time}`).join('\n');
                                const blob = new Blob([csv], { type: 'text/csv' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a'); a.href = url; a.download = 'nadi_ledger.csv'; a.click();
                            }} className="flex items-center gap-1 transition-colors px-3 py-1.5 rounded-lg border border-transparent hover:border-[var(--border-default)]" style={{ color: 'var(--text-muted)' }}>
                                <Download className="w-4 h-4" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">{t('sivik.export_csv')}</span>
                            </button>
                        </h3>
                        {isLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
                            </div>
                        ) : wallet?.transactions && wallet.transactions.length > 0 ? (
                            <div className="rounded-3xl p-2 shadow-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                                {wallet.transactions.slice(0, 10).map((tx, i) => {
                                    const Icon = TX_ICON_MAP[tx.category] || Sparkles;
                                    return (
                                        <div key={tx.id} className={`flex items-center justify-between p-4 ${i !== Math.min(wallet.transactions.length, 10) - 1 ? 'border-b' : ''}`} style={{ borderColor: 'var(--border-default)' }}>
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border`}
                                                    style={tx.type === 'earn'
                                                        ? { background: 'var(--success-light)', border: '1px solid var(--border-default)', color: 'var(--success)' }
                                                        : { background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', color: 'var(--text-muted)' }
                                                    }
                                                >
                                                    <Icon className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm mb-0.5" style={{ color: 'var(--text-primary)' }}>{tx.title}</h4>
                                                    <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{tx.notes || tx.category}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-mono text-lg font-light tracking-tight" style={{ color: tx.type === 'earn' ? 'var(--success)' : 'var(--text-muted)' }}>
                                                    {tx.type === 'earn' ? '+' : ''}{tx.amount}
                                                </div>
                                                <p className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: 'var(--text-muted)' }}>{tx.time}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-10 rounded-3xl text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', border: '1px dashed var(--border-default)' }}>
                                {t('sivik.no_activity')}
                            </div>
                        )}
                    </motion.div>
                )}
            </div>
        </div>
    );
}
