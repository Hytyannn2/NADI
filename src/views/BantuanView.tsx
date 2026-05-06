'use client';
import { useState, useEffect } from 'react';
import { Heart, MapPin, Loader2, Plus, X, Search, Phone, Clock, Users, Package, ChevronDown, CheckCircle, AlertTriangle, HandHeart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '@/src/context/LanguageContext';

interface AidProgram {
    id: string;
    name: string;
    provider: string;
    type: 'government' | 'ngo' | 'community' | 'zakat';
    description: string;
    eligibility: string;
    status: 'active' | 'upcoming' | 'closed';
    deadline?: string;
    location: string;
}

interface MutualAidRequest {
    id: string;
    poster: string;
    type: 'need' | 'offer';
    title: string;
    description: string;
    location: string;
    category: string;
    time: string;
    fulfilled: boolean;
    contact?: string;
}

export default function BantuanView() {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<'programs' | 'mutual'>('programs');
    const [requests, setRequests] = useState<MutualAidRequest[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'government' | 'ngo' | 'zakat' | 'community'>('all');
    const [form, setForm] = useState({ title: '', description: '', location: '', category: 'Food', type: 'need' as 'need' | 'offer', contact: '' });

    // Real aid programs fetched from API
    const [aidPrograms, setAidPrograms] = useState<AidProgram[]>([]);
    const [programsLoading, setProgramsLoading] = useState(true);
    const [locationName, setLocationName] = useState('');

    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    fetch(`/api/bantuan/programs?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`)
                        .then(r => r.json())
                        .then(d => { if (d.success) { setAidPrograms(d.programs); setLocationName(d.location || ''); } })
                        .catch(() => {})
                        .finally(() => setProgramsLoading(false));
                },
                () => {
                    fetch('/api/bantuan/programs?lat=3.139&lng=101.686')
                        .then(r => r.json())
                        .then(d => { if (d.success) { setAidPrograms(d.programs); setLocationName(d.location || ''); } })
                        .catch(() => {})
                        .finally(() => setProgramsLoading(false));
                },
                { enableHighAccuracy: true }
            );
        } else {
            setProgramsLoading(false);
        }
    }, []);

    const fetchRequests = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/bantuan/requests');
            const data = await res.json();
            if (data.success) setRequests(data.requests);
        } catch { /* silently fail */ }
        finally { setIsLoading(false); }
    };

    useEffect(() => {
        if (activeTab === 'mutual') fetchRequests();
    }, [activeTab]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.title || !form.description || !form.location) return;
        setIsSubmitting(true);
        try {
            const res = await fetch('/api/bantuan/requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (data.success) {
                setRequests(prev => [data.request, ...prev]);
                setShowForm(false);
                setForm({ title: '', description: '', location: '', category: 'Food', type: 'need', contact: '' });
            }
        } catch {
            alert('Failed to submit. Try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleFulfill = async (id: string) => {
        try {
            const res = await fetch('/api/bantuan/requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'fulfill', requestId: id }),
            });
            const data = await res.json();
            if (data.success) {
                setRequests(prev => prev.map(r => r.id === id ? { ...r, fulfilled: true } : r));
            }
        } catch { /* silently fail */ }
    };

    const typeColors: Record<string, string> = {
        government: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        ngo: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
        zakat: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        community: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    };

    const statusColors: Record<string, string> = {
        active: 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20',
        upcoming: 'bg-[#C5A367]/10 text-[#C5A367] border-[#C5A367]/20',
        closed: 'bg-zinc-800 text-zinc-500 border-zinc-700',
    };

    const filteredPrograms = aidPrograms.filter(a =>
        (filterType === 'all' || a.type === filterType) &&
        (searchQuery.trim() === '' ||
            a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            a.provider?.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="p-6 h-full flex flex-col relative z-0">

            {/* Submit Mutual Aid Modal */}
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
                                <h3 className="font-serif text-xl text-white">Gotong-Royong</h3>
                                <button onClick={() => setShowForm(false)} className="p-2 text-zinc-500 hover:text-white"><X className="w-5 h-5" /></button>
                            </div>

                            {/* Need/Offer Toggle */}
                            <div className="flex p-1 rounded-xl bg-[#0A0A0C] border border-zinc-800 mb-4">
                                {(['need', 'offer'] as const).map(t => (
                                    <button key={t} onClick={() => setForm(p => ({ ...p, type: t }))}
                                        className={`flex-1 py-2.5 text-[9px] uppercase tracking-widest font-bold rounded-lg transition-all ${form.type === t ? (t === 'need' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20') : 'text-zinc-600'}`}
                                    >{t === 'need' ? '🆘 I Need Help' : '🤝 I Can Help'}</button>
                                ))}
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                {[
                                    { key: 'title', placeholder: 'e.g. Need food supplies for 5 people', label: 'Title' },
                                    { key: 'description', placeholder: 'e.g. Family of 5 affected by flood in Pasir Mas', label: 'Details' },
                                    { key: 'location', placeholder: 'e.g. Taman Sri Rantau, Pasir Mas', label: 'Location' },
                                    { key: 'contact', placeholder: 'e.g. 017-XXXXXXX (optional)', label: 'Contact' },
                                ].map(f => (
                                    <div key={f.key}>
                                        <label className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5 block">{f.label}</label>
                                        <input
                                            type="text"
                                            value={(form as any)[f.key]}
                                            onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                                            placeholder={f.placeholder}
                                            required={f.key !== 'contact'}
                                            className="w-full bg-[#0A0A0C] border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-[#C5A367]/50 focus:outline-none transition-colors"
                                        />
                                    </div>
                                ))}
                                <div>
                                    <label className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5 block">Category</label>
                                    <select
                                        value={form.category}
                                        onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))}
                                        className="w-full bg-[#0A0A0C] border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-[#C5A367]/50 focus:outline-none"
                                    >
                                        {['Food', 'Shelter', 'Medical', 'Transport', 'Clothing', 'Childcare', 'Elderly Care', 'General'].map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                                <button
                                    type="submit" disabled={isSubmitting}
                                    className="w-full bg-gradient-to-r from-[#C5A367] to-[#E8C34B] text-[#0A0A0C] py-4 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 mt-2 shadow-lg"
                                >
                                    {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : 'Post Request'}
                                </button>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="mb-6"
            >
                <h2 className="text-3xl font-serif text-white tracking-tight mb-1">Bantuan</h2>
                <p className="text-[10px] uppercase font-bold tracking-widest text-[#C5A367]">
                    Aid & Welfare{locationName ? ` · ${locationName}` : ''}
                </p>
            </motion.div>

            {/* Quick Stats */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
                className="grid grid-cols-3 gap-3 mb-6"
            >
                <div className="bg-[#0f1a14] rounded-2xl p-4 border border-[#10B981]/20 text-center">
                    <Package className="w-4 h-4 text-[#10B981] mx-auto mb-2" />
                    <p className="text-xl font-light text-white">{aidPrograms.filter(a => a.status === 'active').length}</p>
                    <p className="text-[7px] font-bold uppercase tracking-widest text-[#10B981]/60">Active Aid</p>
                </div>
                <div className="bg-[#121214] rounded-2xl p-4 border border-zinc-800 text-center">
                    <Users className="w-4 h-4 text-[#C5A367] mx-auto mb-2" />
                    <p className="text-xl font-light text-white">{requests.filter(r => !r.fulfilled).length}</p>
                    <p className="text-[7px] font-bold uppercase tracking-widest text-zinc-600">Open Needs</p>
                </div>
                <div className="bg-[#121214] rounded-2xl p-4 border border-zinc-800 text-center">
                    <HandHeart className="w-4 h-4 text-purple-400 mx-auto mb-2" />
                    <p className="text-xl font-light text-white">{requests.filter(r => r.fulfilled).length}</p>
                    <p className="text-[7px] font-bold uppercase tracking-widest text-zinc-600">Fulfilled</p>
                </div>
            </motion.div>

            {/* Internal Tabs */}
            <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="flex p-1.5 rounded-2xl mb-6 border backdrop-blur-md bg-[#0A0A0C]/80 border-zinc-800/80 shadow-inner"
            >
                <button
                    onClick={() => setActiveTab('programs')}
                    className={`flex-1 py-3 text-[10px] uppercase tracking-widest font-bold rounded-xl transition-all ${activeTab === 'programs' ? 'bg-zinc-800 text-[#FAFAFA] shadow-md border border-zinc-700' : 'text-zinc-600 hover:text-zinc-400'}`}
                >Aid Programs</button>
                <button
                    onClick={() => setActiveTab('mutual')}
                    className={`flex-1 py-3 text-[10px] uppercase tracking-widest font-bold rounded-xl transition-all ${activeTab === 'mutual' ? 'bg-zinc-800 text-[#FAFAFA] shadow-md border border-zinc-700' : 'text-zinc-600 hover:text-zinc-400'}`}
                >Gotong-Royong</button>
            </motion.div>

            <div className="flex-1 min-h-0 overflow-y-auto pb-6 relative">
                <AnimatePresence mode="wait">
                    {activeTab === 'programs' ? (
                        <motion.div
                            key="programs"
                            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }}
                            className="space-y-4"
                        >
                            {/* Search + Filter */}
                            <div className="relative mb-2 group">
                                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                                    <Search className="w-4 h-4 text-zinc-500" />
                                </div>
                                <input
                                    type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Search aid programs..."
                                    className="w-full bg-[#121214] pl-11 pr-4 py-3 rounded-xl border border-zinc-800 focus:border-[#C5A367]/50 outline-none text-sm text-white placeholder:text-zinc-600"
                                />
                            </div>
                            <div className="flex gap-2 flex-wrap mb-2">
                                {(['all', 'government', 'ngo', 'zakat'] as const).map(f => (
                                    <button key={f} onClick={() => setFilterType(f)}
                                        className={`px-2.5 py-1.5 rounded-lg text-[8px] font-bold uppercase tracking-widest border transition-all ${filterType === f ? 'bg-[#C5A367]/10 text-[#C5A367] border-[#C5A367]/20' : 'text-zinc-600 border-zinc-800 hover:text-zinc-400'}`}
                                    >{f}</button>
                                ))}
                            </div>

                            {programsLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-7 h-7 text-zinc-700 animate-spin" />
                                </div>
                            ) : filteredPrograms.length === 0 ? (
                                <div className="text-center py-12 text-zinc-600 border border-dashed border-zinc-800 rounded-3xl text-[10px] font-bold uppercase tracking-widest">
                                    No aid programs found for your area
                                </div>
                            ) : filteredPrograms.map((aid, i) => (
                                <motion.div
                                    key={aid.id}
                                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                                    className="bg-[#121214] rounded-3xl p-5 border border-zinc-800 hover:border-zinc-700 transition-all shadow-lg"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-1 rounded-md border ${typeColors[aid.type]}`}>{aid.type}</span>
                                            <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-1 rounded-md border ${statusColors[aid.status]}`}>{aid.status}</span>
                                        </div>
                                    </div>
                                    <h4 className="font-serif text-lg text-white mb-2 leading-tight">{aid.name}</h4>
                                    <p className="text-[11px] text-zinc-400 font-medium leading-relaxed mb-3">{aid.description}</p>
                                    <div className="space-y-2 border-t border-zinc-800/50 pt-3">
                                        <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                                            <MapPin className="w-3 h-3 text-zinc-600" /> {aid.location}
                                        </div>
                                        <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                                            <Users className="w-3 h-3 text-zinc-600" /> {aid.eligibility}
                                        </div>
                                        {aid.deadline && (
                                            <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                                                <Clock className="w-3 h-3 text-zinc-600" /> {aid.deadline}
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-[8px] font-bold uppercase tracking-widest text-[#C5A367]/60 mt-3">Provider: {aid.provider}</p>
                                </motion.div>
                            ))}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="mutual"
                            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}
                            className="space-y-4"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">Community Mutual Aid</p>
                                <button
                                    onClick={() => setShowForm(true)}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest active:scale-95 transition-all border bg-[#C5A367]/10 text-[#C5A367] border-[#C5A367]/20 hover:bg-[#C5A367] hover:text-[#0A0A0C]"
                                >
                                    <Plus className="w-3 h-3" /> Post
                                </button>
                            </div>

                            {isLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-7 h-7 text-zinc-700 animate-spin" />
                                </div>
                            ) : requests.length === 0 ? (
                                <div className="text-center py-12 space-y-3 border border-dashed border-zinc-800 rounded-3xl">
                                    <HandHeart className="w-8 h-8 text-zinc-700 mx-auto" />
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">No requests yet</p>
                                    <p className="text-[9px] text-zinc-700 max-w-[200px] mx-auto">Post a need or offer to start helping your community</p>
                                </div>
                            ) : (
                                requests.map((req) => (
                                    <motion.div
                                        key={req.id}
                                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                        className={`p-5 rounded-3xl border transition-all hover:shadow-xl group ${req.fulfilled ? 'bg-[#10B981]/5 border-[#10B981]/20' : 'bg-[#121214] border-zinc-800 hover:border-zinc-700'}`}
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-1 rounded-md border ${req.type === 'need' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20'}`}>
                                                    {req.type === 'need' ? '🆘 Need' : '🤝 Offer'}
                                                </span>
                                                <span className="text-[8px] font-bold uppercase tracking-widest px-2 py-1 rounded-md border bg-zinc-800/50 text-zinc-400 border-zinc-700/50">{req.category}</span>
                                            </div>
                                            <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-600">{req.time}</span>
                                        </div>
                                        <h4 className="font-serif text-lg text-white mb-2">{req.title}</h4>
                                        <p className="text-[11px] text-zinc-400 font-medium leading-relaxed mb-3">{req.description}</p>
                                        <div className="flex items-center justify-between border-t border-zinc-800/50 pt-3">
                                            <div className="flex items-center gap-3">
                                                <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-1">
                                                    <MapPin className="w-3 h-3" /> {req.location}
                                                </span>
                                                <span className="text-[9px] font-bold text-zinc-600">{req.poster}</span>
                                            </div>
                                            {req.fulfilled ? (
                                                <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-[#10B981]">
                                                    <CheckCircle className="w-3 h-3" /> Fulfilled
                                                </span>
                                            ) : req.type === 'need' ? (
                                                <button
                                                    onClick={() => handleFulfill(req.id)}
                                                    className="px-3 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest bg-[#C5A367]/10 text-[#C5A367] border border-[#C5A367]/20 hover:bg-[#C5A367] hover:text-[#0A0A0C] transition-all active:scale-95"
                                                >Help</button>
                                            ) : null}
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
