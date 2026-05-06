'use client';
import { useState, useEffect } from 'react';
import { Send, ThumbsUp, Plus, X, Loader2, MessageSquare, Shield, AlertTriangle, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Post { id: string; content: string; author: string; type: string; timestamp: number; upvotes: number; }

export default function CommunityFeed({ onClose }: { onClose: () => void }) {
    const [tab, setTab] = useState<'feed' | 'whistle'>('feed');
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCompose, setShowCompose] = useState(false);
    const [content, setContent] = useState('');
    const [posting, setPosting] = useState(false);
    // Whistle-blower
    const [wbCategory, setWbCategory] = useState('corruption');
    const [wbDesc, setWbDesc] = useState('');
    const [wbSubmitting, setWbSubmitting] = useState(false);
    const [wbSuccess, setWbSuccess] = useState(false);

    useEffect(() => {
        fetch('/api/community').then(r => r.json()).then(d => { if (d.success) setPosts(d.posts); }).catch(() => {}).finally(() => setLoading(false));
    }, []);

    const handlePost = async () => {
        if (!content.trim() || posting) return;
        setPosting(true);
        try {
            const res = await fetch('/api/community', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content, type: 'general' }) });
            const d = await res.json();
            if (d.success) { setPosts(prev => [d.post, ...prev]); setContent(''); setShowCompose(false); }
        } catch {} finally { setPosting(false); }
    };

    const handleWhistle = async () => {
        if (!wbDesc.trim() || wbSubmitting) return;
        setWbSubmitting(true);
        try {
            const res = await fetch('/api/whistleblower', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: wbCategory, description: wbDesc }) });
            const d = await res.json();
            if (d.success) { setWbSuccess(true); setWbDesc(''); setTimeout(() => setWbSuccess(false), 3000); }
        } catch {} finally { setWbSubmitting(false); }
    };

    const timeAgo = (ts: number) => { const m = Math.floor((Date.now() - ts) / 60000); if (m < 2) return 'Just now'; if (m < 60) return `${m}m ago`; return `${Math.floor(m / 60)}h ago`; };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/90 backdrop-blur-xl flex items-end justify-center"
        >
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="w-full max-w-md h-[85vh] bg-[#0A0A0C] border-t border-x border-zinc-800 rounded-t-3xl flex flex-col"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                    <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-[#C5A367]" />
                        <h3 className="text-sm font-bold text-white">Community</h3>
                    </div>
                    <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white"><X className="w-5 h-5" /></button>
                </div>

                {/* Tabs */}
                <div className="flex p-1.5 mx-4 mt-3 rounded-2xl border bg-[#050505] border-zinc-800">
                    <button onClick={() => setTab('feed')} className={`flex-1 py-2.5 text-[9px] uppercase tracking-widest font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${tab === 'feed' ? 'bg-zinc-800 text-white border border-zinc-700' : 'text-zinc-600'}`}>
                        <MessageSquare className="w-3 h-3" /> Feed
                    </button>
                    <button onClick={() => setTab('whistle')} className={`flex-1 py-2.5 text-[9px] uppercase tracking-widest font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${tab === 'whistle' ? 'bg-zinc-800 text-white border border-zinc-700' : 'text-zinc-600'}`}>
                        <Shield className="w-3 h-3" /> Whistle-Blower
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
                    {tab === 'feed' ? (
                        <>
                            <button onClick={() => setShowCompose(!showCompose)}
                                className="w-full mb-4 flex items-center gap-2 p-3 rounded-2xl border border-dashed border-zinc-800 text-zinc-500 hover:text-[#C5A367] hover:border-[#C5A367]/20 transition-all text-xs font-bold"
                            ><Plus className="w-4 h-4" /> Share with your community</button>

                            <AnimatePresence>
                                {showCompose && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-4">
                                        <div className="bg-[#121214] border border-zinc-800 rounded-2xl p-4">
                                            <textarea value={content} onChange={e => setContent(e.target.value)} rows={3} placeholder="What's happening in your community?"
                                                className="w-full bg-transparent text-sm text-white placeholder:text-zinc-600 outline-none resize-none mb-3" />
                                            <button onClick={handlePost} disabled={posting || !content.trim()}
                                                className="bg-gradient-to-r from-[#C5A367] to-[#B8860B] text-[#0A0A0C] px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest disabled:opacity-40 flex items-center gap-1.5"
                                            >{posting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Post</button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {loading ? (
                                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-zinc-700" /></div>
                            ) : posts.length === 0 ? (
                                <div className="text-center py-12 text-zinc-600 border border-dashed border-zinc-800 rounded-3xl text-[10px] font-bold uppercase tracking-widest">
                                    No posts yet. Be the first!
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {posts.map(p => (
                                        <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                            className="bg-[#121214] border border-zinc-800 rounded-2xl p-4"
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-bold text-zinc-300">{p.author}</span>
                                                <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-600">{timeAgo(p.timestamp)}</span>
                                            </div>
                                            <p className="text-sm text-zinc-400 mb-3 leading-relaxed">{p.content}</p>
                                            <button className="flex items-center gap-1.5 text-zinc-600 hover:text-[#C5A367] transition-colors text-[9px] font-bold">
                                                <ThumbsUp className="w-3 h-3" /> {p.upvotes}
                                            </button>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        /* Feature 13: Whistle-Blower */
                        <div className="space-y-4">
                            <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 text-center">
                                <Shield className="w-8 h-8 text-red-400 mx-auto mb-2" />
                                <h4 className="text-sm font-bold text-red-300 mb-1">Anonymous Report</h4>
                                <p className="text-[10px] text-red-400/60">Zero-PII submission. Your identity is never recorded.</p>
                            </div>

                            {wbSuccess && (
                                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                                    className="bg-[#10B981]/10 border border-[#10B981]/20 rounded-2xl p-4 text-center text-xs font-bold text-[#10B981]"
                                >✅ Report submitted anonymously. Reference ID generated.</motion.div>
                            )}

                            <div>
                                <label className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5 block">Category</label>
                                <select value={wbCategory} onChange={e => setWbCategory(e.target.value)}
                                    className="w-full bg-[#121214] border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white outline-none"
                                >
                                    <option value="corruption">Corruption</option>
                                    <option value="illegal_dumping">Illegal Dumping</option>
                                    <option value="safety_violation">Safety Violation</option>
                                    <option value="fraud">Fraud</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5 block">Description</label>
                                <textarea value={wbDesc} onChange={e => setWbDesc(e.target.value)} rows={4} placeholder="Describe the incident in detail..."
                                    className="w-full bg-[#121214] border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none resize-none" />
                            </div>
                            <button onClick={handleWhistle} disabled={wbSubmitting || !wbDesc.trim()}
                                className="w-full bg-gradient-to-r from-red-600 to-red-700 text-white py-4 rounded-xl text-[10px] font-bold uppercase tracking-widest disabled:opacity-40 flex items-center justify-center gap-2"
                            >{wbSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />} Submit Anonymous Report</button>
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}
