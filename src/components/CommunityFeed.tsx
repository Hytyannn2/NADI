'use client';
import { useState, useEffect } from 'react';
import { Send, ThumbsUp, Plus, X, Loader2, MessageSquare, Shield, AlertTriangle, Users, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/src/context/AuthContext';
import { useGame } from '@/src/context/GameContext';
import { useXP } from '@/src/hooks/useXP';

interface Post { id: string; content: string; author: string; author_avatar?: string; type: string; timestamp: number; upvotes: number; user_id?: string; replies?: any[]; comments?: number; }

export default function CommunityFeed({ onClose, initialTab = 'feed' }: { onClose: () => void; initialTab?: 'feed' | 'whistle' }) {
    const [tab, setTab] = useState<'feed' | 'whistle'>(initialTab);
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCompose, setShowCompose] = useState(false);
    const [content, setContent] = useState('');
    const [posting, setPosting] = useState(false);
    // Whistle-blower
    const [wbCategory, setWbCategory] = useState('corruption');
    const [wbDesc, setWbDesc] = useState('');
    const [wbLocation, setWbLocation] = useState('');
    const [wbImage, setWbImage] = useState<string | null>(null);
    const [wbSubmitting, setWbSubmitting] = useState(false);
    const [wbSuccess, setWbSuccess] = useState(false);

    const { user } = useAuth();
    const userAvatar = (
        user?.user_metadata?.avatar_url ||
        user?.user_metadata?.picture ||
        user?.user_metadata?.avatarUrl ||
        user?.identities?.[0]?.identity_data?.avatar_url ||
        user?.identities?.[0]?.identity_data?.picture
    ) as string | undefined;
    const { incrementStat, completeQuest } = useGame();
    const { addXp } = useXP();

    const [replyingPostId, setReplyingPostId] = useState<string | null>(null);
    const [replyText, setReplyText] = useState('');
    const [submittingReply, setSubmittingReply] = useState(false);
    const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});

    useEffect(() => {
        fetch('/api/community').then(r => r.json()).then(d => { if (d.success) setPosts(d.posts); }).catch(() => {}).finally(() => setLoading(false));
    }, []);

    const handleDeletePost = async (postId: string) => {
        try {
            const res = await fetch(`/api/community?id=${postId}`, { method: 'DELETE' });
            const d = await res.json();
            if (d.success) {
                setPosts(prev => prev.filter(p => p.id !== postId));
            }
        } catch {}
    };

    const handleLike = async (postId: string) => {
        if (likedPosts[postId]) return;
        setLikedPosts(prev => ({ ...prev, [postId]: true }));
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, upvotes: (p.upvotes || 0) + 1 } : p));
        try {
            await fetch('/api/community', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ postId, action: 'like' })
            });
        } catch {}
    };

    const handleSendReply = async (postId: string) => {
        if (!replyText.trim() || submittingReply) return;
        setSubmittingReply(true);
        try {
            const res = await fetch('/api/community', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ postId, action: 'reply', content: replyText })
            });
            const d = await res.json();
            if (d.success && d.reply) {
                setPosts(prev => prev.map(p => {
                    if (p.id === postId) {
                        const existing = Array.isArray(p.replies) ? p.replies : [];
                        return { ...p, replies: [...existing, d.reply], comments: d.commentsCount };
                    }
                    return p;
                }));
                setReplyText('');
            }
        } catch {} finally {
            setSubmittingReply(false);
        }
    };

    const handlePost = async () => {
        if (!content.trim() || posting) return;
        setPosting(true);
        try {
            const authorName = user?.user_metadata?.full_name || 'Anonymous Warga';
            const res = await fetch('/api/community', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content, type: 'general', author: authorName }) });
            const d = await res.json();
            if (d.success) { 
                setPosts(prev => [d.post, ...prev]); 
                setContent(''); 
                setShowCompose(false); 
                incrementStat('communityPosts');
            }
        } catch {} finally { setPosting(false); }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter') {
            const isMobile = typeof window !== 'undefined' && (
                window.innerWidth < 768 ||
                /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
            );
            if (isMobile || e.shiftKey || e.ctrlKey) return;
            e.preventDefault();
            if (content.trim() && !posting) {
                handlePost();
            }
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new window.Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1200;
                let width = img.width;
                let height = img.height;
                if (width > MAX_WIDTH) {
                    height = Math.round((height * MAX_WIDTH) / width);
                    width = MAX_WIDTH;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                // Export to JPEG. Canvas export completely drops EXIF metadata.
                const scrubbedBase64 = canvas.toDataURL('image/jpeg', 0.8);
                setWbImage(scrubbedBase64);
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    const handleWhistle = async () => {
        if (!wbDesc.trim() || wbSubmitting) return;
        setWbSubmitting(true);
        try {
            const res = await fetch('/api/whistleblower', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: wbCategory, description: wbDesc, location: wbLocation, image: wbImage }) });
            const d = await res.json();
            if (d.success) { 
                setWbSuccess(true); 
                setWbDesc(''); 
                setWbLocation('');
                setWbImage(null);
                setTimeout(() => setWbSuccess(false), 3000); 
                completeQuest('report').then(xp => {
                    if (xp > 0) addXp(xp);
                });
            }
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
                                            <textarea value={content} onChange={e => setContent(e.target.value)} onKeyDown={handleKeyDown} rows={3} placeholder="What's happening in your community?"
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
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full overflow-hidden border border-zinc-700 bg-zinc-800 shrink-0 flex items-center justify-center">
                                                        <img 
                                                            src={p.author_avatar || (p.user_id === user?.id && userAvatar ? userAvatar : `https://ui-avatars.com/api/?name=${encodeURIComponent(p.author || 'Warga')}&background=0F766E&color=fff&bold=true`)} 
                                                            alt={p.author} 
                                                            className="w-full h-full object-cover" 
                                                        />
                                                    </div>
                                                    <span className="text-xs font-bold text-zinc-300">{p.author}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-600">{timeAgo(p.timestamp)}</span>
                                                    {Boolean(user?.id && p.user_id === user.id) && (
                                                        <button onClick={() => handleDeletePost(p.id)} title="Delete post" className="text-zinc-600 hover:text-red-400 p-1 transition-colors">
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="text-sm text-zinc-300 mb-3 leading-relaxed">{p.content}</p>

                                            {/* Action bar: Like & Reply */}
                                            <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-xs">
                                                <div className="flex items-center gap-4">
                                                    <button
                                                        onClick={() => handleLike(p.id)}
                                                        className={`flex items-center gap-1.5 transition-colors text-[10px] font-bold ${likedPosts[p.id] ? 'text-red-400' : 'text-zinc-500 hover:text-red-400'}`}
                                                    >
                                                        <ThumbsUp className={`w-3.5 h-3.5 ${likedPosts[p.id] ? 'fill-red-400' : ''}`} />
                                                        <span>{p.upvotes || 0}</span>
                                                    </button>

                                                    <button
                                                        onClick={() => setReplyingPostId(replyingPostId === p.id ? null : p.id)}
                                                        className={`flex items-center gap-1.5 transition-colors text-[10px] font-bold ${replyingPostId === p.id ? 'text-[#C5A367]' : 'text-zinc-500 hover:text-[#C5A367]'}`}
                                                    >
                                                        <MessageSquare className="w-3.5 h-3.5" />
                                                        <span>Balas {p.replies?.length ? `(${p.replies.length})` : ''}</span>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Threaded Reply Drawer */}
                                            <AnimatePresence>
                                                {replyingPostId === p.id && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        className="mt-3 pt-3 border-t border-zinc-800/80 space-y-3 overflow-hidden"
                                                    >
                                                        {/* Threaded Replies List */}
                                                        {Array.isArray(p.replies) && p.replies.length > 0 && (
                                                            <div className="space-y-2 pl-3 border-l-2 border-zinc-800">
                                                                {p.replies.map((reply: any, idx: number) => (
                                                                    <div key={reply.id || idx} className="bg-zinc-900/70 rounded-xl p-2.5 border border-zinc-800/60">
                                                                        <div className="flex items-center justify-between mb-1">
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="w-5 h-5 rounded-full overflow-hidden border border-zinc-700 bg-zinc-800 shrink-0 flex items-center justify-center">
                                                                                    <img
                                                                                        src={reply.author_avatar || (reply.user_id === user?.id && userAvatar ? userAvatar : `https://ui-avatars.com/api/?name=${encodeURIComponent(reply.author || 'Warga')}&background=0F766E&color=fff`)}
                                                                                        alt={reply.author}
                                                                                        className="w-full h-full object-cover"
                                                                                    />
                                                                                </div>
                                                                                <span className="text-[11px] font-bold text-zinc-300">{reply.author}</span>
                                                                            </div>
                                                                            <span className="text-[8px] text-zinc-600 font-mono">
                                                                                {timeAgo(reply.timestamp || Date.now())}
                                                                            </span>
                                                                        </div>
                                                                        <p className="text-xs text-zinc-400 pl-7 leading-relaxed">{reply.content}</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {/* Reply Input */}
                                                        <div className="flex gap-2 items-center bg-zinc-900 border border-zinc-800 rounded-xl p-2">
                                                            <input
                                                                type="text"
                                                                value={replyText}
                                                                onChange={e => setReplyText(e.target.value)}
                                                                onKeyDown={e => { if (e.key === 'Enter' && replyText.trim() && !submittingReply) handleSendReply(p.id); }}
                                                                placeholder={`Balas kepada @${p.author}...`}
                                                                className="flex-1 bg-transparent text-xs text-white placeholder:text-zinc-600 outline-none px-2"
                                                            />
                                                            <button
                                                                onClick={() => handleSendReply(p.id)}
                                                                disabled={!replyText.trim() || submittingReply}
                                                                className="px-3 py-1.5 rounded-lg bg-[#C5A367] text-slate-950 font-bold text-[10px] uppercase tracking-wider disabled:opacity-40 flex items-center gap-1 shrink-0"
                                                            >
                                                                {submittingReply ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                                                Balas
                                                            </button>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
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
                                > Report submitted anonymously. Reference ID generated.</motion.div>
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
                                    className="w-full bg-[#121214] border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none resize-none mb-4" />
                                    
                                <label className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5 block">General Location (Optional)</label>
                                <input value={wbLocation} onChange={e => setWbLocation(e.target.value)} placeholder="e.g. Behind SMK Kota Bharu"
                                    className="w-full bg-[#121214] border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none mb-4" />
                                    
                                <label className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5 block">Evidence Photo (Optional - EXIF Scrubbed)</label>
                                <input type="file" accept="image/*" onChange={handleImageUpload}
                                    className="w-full bg-[#121214] border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-400 outline-none file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-bold file:uppercase file:tracking-widest file:bg-zinc-800 file:text-white hover:file:bg-zinc-700" />
                                {wbImage && (
                                    <div className="mt-3 relative rounded-xl overflow-hidden border border-zinc-800">
                                        <img src={wbImage} alt="Scrubbed evidence" className="w-full h-auto" />
                                        <div className="absolute top-2 right-2 bg-black/60 px-2 py-1 rounded text-[8px] text-[#10B981] font-bold uppercase tracking-widest flex items-center gap-1">
                                            <Shield className="w-3 h-3" /> EXIF Scrubbed
                                        </div>
                                        <button onClick={() => setWbImage(null)} className="absolute top-2 left-2 bg-black/60 p-1.5 rounded-full text-white hover:bg-red-500/80 transition-colors"><X className="w-3 h-3" /></button>
                                    </div>
                                )}
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
