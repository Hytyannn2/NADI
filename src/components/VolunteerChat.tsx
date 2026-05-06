'use client';
import { useState, useRef, useEffect } from 'react';
import { Send, X, Camera } from 'lucide-react';
import { motion } from 'motion/react';

interface ChatMsg { id: string; text: string; sender: 'me' | 'them'; time: string; }

export default function VolunteerChat({ jobName, onClose }: { jobName: string; onClose: () => void }) {
    const [messages, setMessages] = useState<ChatMsg[]>([
        { id: '0', text: `Terima kasih kerana menerima permintaan bantuan kami. Sila hubungi kami apabila sampai.`, sender: 'them', time: 'Now' },
    ]);
    const [input, setInput] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages]);

    const send = () => {
        if (!input.trim()) return;
        setMessages(prev => [...prev, { id: Date.now().toString(), text: input.trim(), sender: 'me', time: 'Now' }]);
        setInput('');
        // Simulate auto-reply after 2s
        setTimeout(() => {
            setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), text: 'Baik, terima kasih! Kami tunggu di lokasi. 🙏', sender: 'them', time: 'Now' }]);
        }, 2000);
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black/90 backdrop-blur-xl flex items-end justify-center"
        >
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="w-full max-w-md h-[70vh] bg-[#0A0A0C] border-t border-x border-zinc-800 rounded-t-3xl flex flex-col"
            >
                <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                    <div>
                        <h3 className="text-sm font-bold text-white">{jobName}</h3>
                        <p className="text-[8px] font-bold uppercase tracking-widest text-[#10B981]">● Volunteer Chat</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white"><X className="w-5 h-5" /></button>
                </div>

                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
                    {messages.map(m => (
                        <div key={m.id} className={`flex ${m.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm ${
                                m.sender === 'me' ? 'bg-[#C5A367]/15 text-zinc-200 border border-[#C5A367]/20 rounded-br-md'
                                    : 'bg-[#121214] text-zinc-300 border border-zinc-800 rounded-bl-md'
                            }`}>{m.text}</div>
                        </div>
                    ))}
                </div>

                <form onSubmit={e => { e.preventDefault(); send(); }} className="p-3 border-t border-zinc-800 flex gap-2">
                    <button type="button" className="p-3 text-zinc-500 hover:text-[#C5A367] rounded-xl hover:bg-zinc-800 transition-colors">
                        <Camera className="w-4 h-4" />
                    </button>
                    <input value={input} onChange={e => setInput(e.target.value)} placeholder="Type a message..."
                        className="flex-1 bg-[#121214] border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none" />
                    <button type="submit" disabled={!input.trim()}
                        className="px-4 bg-gradient-to-r from-[#C5A367] to-[#B8860B] text-[#0A0A0C] rounded-xl disabled:opacity-30"
                    ><Send className="w-4 h-4" /></button>
                </form>
            </motion.div>
        </motion.div>
    );
}
