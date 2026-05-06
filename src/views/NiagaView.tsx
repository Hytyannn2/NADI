'use client';
import { useState, useEffect, useRef } from 'react';
import { Store, TrendingUp, MapPin, CheckCircle, Search, Plus, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '@/src/context/LanguageContext';

interface Listing {
    id: string;
    seller: string;
    badge: boolean;
    item: string;
    price: string;
    location: string;
    time: string;
    type: string;
    verified: boolean;
}

export default function NiagaView() {
    const { t } = useLanguage();
    const [products, setProducts] = useState<Listing[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [weeklyVolume, setWeeklyVolume] = useState<number | null>(null);
    const [newCount, setNewCount] = useState(0);
    const pollRef = useRef<NodeJS.Timeout | null>(null);

    // Form state
    const [form, setForm] = useState({ seller: '', item: '', price: '', location: '', type: 'General' });

    const fetchListings = async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const res = await fetch('/api/niaga/listings');
            const data = await res.json();
            if (data.success) {
                setProducts(prev => {
                    const newItems = data.listings.filter((l: Listing) => !prev.find(p => p.id === l.id));
                    if (silent && newItems.length > 0) setNewCount(c => c + newItems.length);
                    return data.listings;
                });
                setWeeklyVolume(data.total);
            }
        } catch {
            // silently fail on poll
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchListings();
        // Poll every 15 seconds for new listings
        pollRef.current = setInterval(() => fetchListings(true), 15000);
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.seller || !form.item || !form.price || !form.location) return;
        setIsSubmitting(true);
        try {
            const res = await fetch('/api/niaga/listings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (data.success) {
                setProducts(prev => [data.listing, ...prev]);
                setNewCount(0);
                setShowForm(false);
                setForm({ seller: '', item: '', price: '', location: '', type: 'General' });
            }
        } catch {
            alert('Failed to submit listing. Try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const filtered = products.filter(p =>
        searchQuery.trim() === '' ||
        p.item.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.seller.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.location.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="p-6 h-full flex flex-col relative z-0">
            {/* Submit Listing Modal */}
            <AnimatePresence>
                {showForm && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end justify-center"
                        onClick={(e) => e.target === e.currentTarget && setShowForm(false)}
                    >
                        <motion.div
                            initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
                            className="bg-[#121214] border border-zinc-800 rounded-t-3xl p-6 w-full max-w-md shadow-2xl"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-serif text-xl text-white">{t('niaga.post_supply')}</h3>
                                <button onClick={() => setShowForm(false)} className="p-2 text-zinc-500 hover:text-white"><X className="w-5 h-5" /></button>
                            </div>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                {[
                                    { key: 'seller', placeholder: 'e.g. Your name / business', label: t('niaga.seller') },
                                    { key: 'item', placeholder: 'e.g. Fresh Siakap 50kg', label: t('niaga.item') },
                                    { key: 'price', placeholder: 'e.g. RM 25/kg', label: t('niaga.price') },
                                    { key: 'location', placeholder: 'e.g. Kota Bharu, Kelantan', label: t('niaga.location') },
                                ].map(f => (
                                    <div key={f.key}>
                                        <label className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5 block">{f.label}</label>
                                        <input
                                            type="text"
                                            value={(form as any)[f.key]}
                                            onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                                            placeholder={f.placeholder}
                                            required
                                            className="w-full bg-[#0A0A0C] border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-[#C5A367]/50 focus:outline-none transition-colors"
                                        />
                                    </div>
                                ))}
                                <div>
                                    <label className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5 block">{t('niaga.category')}</label>
                                    <select
                                        value={form.type}
                                        onChange={e => setForm(prev => ({ ...prev, type: e.target.value }))}
                                        className="w-full bg-[#0A0A0C] border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-[#C5A367]/50 focus:outline-none transition-colors"
                                    >
                                        {['Seafood', 'Produce', 'Poultry', 'Livestock', 'Grain', 'Dairy', 'General'].map(t => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </select>
                                </div>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full bg-gradient-to-r from-[#C5A367] to-[#E8C34B] text-[#0A0A0C] py-4 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
                                >
                                    {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('niaga.ai_verifying')}</> : t('niaga.post_listing')}
                                </button>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="mb-6 flex items-end justify-between"
            >
                <div>
                    <h2 className="text-3xl font-serif text-white tracking-tight mb-1">{t('niaga.title')}</h2>
                    <p className="text-[10px] uppercase font-bold tracking-widest text-[#C5A367]">
                        {t('niaga.subtitle')}
                    </p>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 bg-[#C5A367]/10 border border-[#C5A367]/20 text-[#C5A367] rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-[#C5A367]/20 transition-all active:scale-95"
                >
                    <Plus className="w-3.5 h-3.5" /> {t('niaga.post')}
                </button>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
                className="bg-gradient-to-br from-[#10B981]/10 to-[#10B981]/5 rounded-3xl p-6 mb-6 border border-[#10B981]/20 shadow-xl shadow-[#10B981]/10 inset-0 backdrop-blur-sm relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#10B981]/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

                <div className="flex justify-between items-center mb-4 relative z-10">
                    <div>
                        <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 mb-1">{t('niaga.active_listings')}</p>
                        <p className="text-3xl font-light text-[#FAFAFA] tracking-tight">
                            {weeklyVolume !== null ? weeklyVolume : <span className="text-zinc-600 text-xl">—</span>}
                            <span className="text-zinc-500 text-lg font-light ml-2">{t('niaga.listings')}</span>
                        </p>
                    </div>
                    <div className="bg-[#10B981]/20 text-[#10B981] p-3 rounded-2xl border border-[#10B981]/30 shadow-inner">
                        <TrendingUp className="w-6 h-6" />
                    </div>
                </div>
                <p className="text-[11px] text-[#10B981]/80 font-medium leading-relaxed relative z-10">
                    <span className="font-bold text-zinc-300">NADI</span> {t('niaga.connects')}
                </p>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="relative mb-6 group"
            >
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                    <Search className="w-5 h-5 text-zinc-500 group-focus-within:text-[#C5A367] transition-colors" />
                </div>
                <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder={t('niaga.search')}
                    className="w-full bg-[#121214] pl-12 pr-4 py-4 rounded-xl shadow-inner border border-zinc-800 focus:border-[#C5A367]/50 focus:ring-1 focus:ring-[#C5A367] outline-none transition-all placeholder:text-zinc-600 text-sm font-medium text-white"
                />
            </motion.div>

            <div className="flex-1 pb-10">
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                    className="flex items-center justify-between mb-4 px-1"
                >
                    <h3 className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">{t('niaga.live_log')}</h3>
                    {newCount > 0 && (
                        <button
                            onClick={() => { fetchListings(); setNewCount(0); }}
                            className="text-[9px] font-bold text-[#10B981] bg-[#10B981]/10 border border-[#10B981]/20 px-2 py-1.5 rounded-lg shadow-sm tracking-widest"
                        >
                            {newCount} {t('niaga.new')}
                        </button>
                    )}
                </motion.div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-8 h-8 text-zinc-700 animate-spin" />
                    </div>
                ) : (
                    <AnimatePresence initial={false}>
                        {filtered.length === 0 ? (
                            <div className="text-center py-12 text-zinc-600 border border-dashed border-zinc-800 rounded-3xl text-[10px] font-bold uppercase tracking-widest">
                                {searchQuery ? t('niaga.no_match') : t('niaga.no_listings')}
                            </div>
                        ) : (
                            filtered.map((product) => (
                                <motion.div
                                    key={product.id}
                                    initial={{ opacity: 0, scale: 0.9, x: -10 }}
                                    animate={{ opacity: 1, scale: 1, x: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: 10 }}
                                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                    className="bg-[#0A0A0C] rounded-3xl p-5 shadow-lg border border-zinc-800/80 hover:border-zinc-700 transition-colors relative overflow-hidden group hover:bg-[#121214] mb-4"
                                >
                                    <div className="absolute top-0 right-0 p-4">
                                        <span className="text-[8px] uppercase tracking-widest font-bold text-zinc-600 group-hover:text-zinc-400 transition-colors">{product.time}</span>
                                    </div>

                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 rounded-xl bg-zinc-800/50 flex items-center justify-center border border-zinc-700/50 shrink-0 group-hover:bg-zinc-800 transition-colors">
                                            <Store className="w-4 h-4 text-[#C5A367]" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-zinc-200 flex items-center gap-1.5">
                                                {product.seller}
                                                {product.badge && <CheckCircle className="w-3.5 h-3.5 text-[#10B981]" />}
                                            </h4>
                                            <span className="text-[8px] uppercase tracking-widest font-bold text-zinc-600">{product.type}</span>
                                        </div>
                                    </div>

                                    <div className="pl-13">
                                        <h5 className="text-lg font-serif text-white mb-2 group-hover:text-[#C5A367] transition-colors">{product.item}</h5>
                                        <p className="text-xl font-light text-zinc-300 mb-4">{product.price}</p>

                                        <div className="flex items-center justify-between border-t border-zinc-800/50 pt-4 mt-2">
                                            <div className="flex items-center gap-1.5 text-[9px] uppercase font-bold tracking-widest text-zinc-500">
                                                <MapPin className="w-3.5 h-3.5 text-zinc-600" />
                                                {product.location}
                                            </div>
                                            <button className="bg-[#121214] hover:bg-[#1A1A1E] text-white px-5 py-2.5 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all shadow-md shadow-black/40 active:scale-95 border border-zinc-700 hover:border-zinc-500 group-hover:text-[#10B981]">
                                                {t('niaga.acquire')}
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
}
