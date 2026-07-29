'use client';
import { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, X, Loader2, Bot, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Message { id: string; role: 'user' | 'assistant'; content: string; }

export default function AIChatbot({ activeTab }: { activeTab: string }) {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { id: '0', role: 'assistant', content: 'Salam! Ambo NADI Assistant  Gapo boleh ambo tolong demo hari ni? (Kelate / BM / English)' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages]);

    const send = async () => {
        if (!input.trim() || loading) return;
        const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input.trim() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);
        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMsg.content, context: activeTab }),
            });
            const data = await res.json();
            setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: data.reply }]);
        } catch {
            setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: 'Maaf, sila cuba lagi.' }]);
        } finally { setLoading(false); }
    };

    const suggestions = [
        'Di mana pusat pemindahan banjir terdekat?',
        'Ambo layak ke untuk Bantuan Prihatin?',
        'Jalan rosak kat kampung saya, macam mana nak report?',
    ];

    return (
        <>
            {/* FAB */}
            <AnimatePresence>
                {!open && (
                    <motion.button
                        initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setOpen(true)}
                        className="fixed bottom-28 right-6 z-[60] w-14 h-14 rounded-full bg-gradient-to-br from-[#C5A367] to-[#B8860B] text-[#0A0A0C] flex items-center justify-center shadow-[0_0_30px_rgba(197,163,103,0.4)] border border-[#E8C34B]/50"
                    >
                        <MessageCircle className="w-6 h-6" />
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Chat Sheet */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ y: '100%', opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: '100%', opacity: 0 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed inset-x-0 bottom-0 z-[70] max-w-md mx-auto h-[70vh] bg-[#0A0A0C] border-t border-x border-zinc-800 rounded-t-3xl shadow-2xl flex flex-col"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#C5A367]/20 to-[#C5A367]/5 border border-[#C5A367]/20 flex items-center justify-center">
                                    <Bot className="w-4 h-4 text-[#C5A367]" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-white">NADI Assistant</h3>
                                    <p className="text-[8px] font-bold uppercase tracking-widest text-[#10B981]">● Online</p>
                                </div>
                            </div>
                            <button onClick={() => setOpen(false)} className="p-2 text-zinc-500 hover:text-white rounded-xl hover:bg-zinc-800 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Messages */}
                        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
                            {messages.map(msg => (
                                <motion.div
                                    key={msg.id}
                                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm font-medium leading-relaxed ${
                                        msg.role === 'user'
                                            ? 'bg-[#C5A367]/15 text-zinc-200 border border-[#C5A367]/20 rounded-br-md'
                                            : 'bg-[#121214] text-zinc-300 border border-zinc-800 rounded-bl-md'
                                    }`}>
                                        {msg.content}
                                    </div>
                                </motion.div>
                            ))}
                            {loading && (
                                <div className="flex justify-start">
                                    <div className="bg-[#121214] border border-zinc-800 rounded-2xl rounded-bl-md px-4 py-3">
                                        <Loader2 className="w-4 h-4 animate-spin text-[#C5A367]" />
                                    </div>
                                </div>
                            )}
                            {/* Quick suggestions if only greeting */}
                            {messages.length <= 1 && (
                                <div className="space-y-2 pt-2">
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Quick Questions</p>
                                    {suggestions.map(s => (
                                        <button key={s} onClick={() => { setInput(s); }}
                                            className="block w-full text-left px-3 py-2 rounded-xl bg-zinc-800/30 border border-zinc-800 text-xs text-zinc-400 hover:text-[#C5A367] hover:border-[#C5A367]/20 transition-colors"
                                        >
                                            <Sparkles className="w-3 h-3 inline mr-1.5 text-[#C5A367]/50" />{s}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Input */}
                        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="p-3 border-t border-zinc-800">
                            <div className="flex gap-2">
                                <input
                                    value={input} onChange={e => setInput(e.target.value)}
                                    placeholder="Tanya apa-apa..."
                                    className="flex-1 bg-[#121214] border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-[#C5A367]/50 transition-colors"
                                />
                                <button type="submit" disabled={!input.trim() || loading}
                                    className="px-4 bg-gradient-to-r from-[#C5A367] to-[#B8860B] text-[#0A0A0C] rounded-xl disabled:opacity-30 transition-opacity"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
