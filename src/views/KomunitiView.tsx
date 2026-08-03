'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import {
    ShoppingBag, Briefcase, Search, MapPin, Phone, Clock, Star,
    ChevronRight, Filter, Users, TrendingUp, Loader2, Heart,
    Plus, Send, X
} from 'lucide-react';

// ===== Types =====
interface Job {
    id: string;
    title: string;
    employer: string;
    location: string;
    wageMYR: number;
    wageType: 'hourly' | 'daily' | 'monthly';
    category: string;
    postedAt: number;
    whatsapp?: string;
    description: string;
    isFairWage: boolean;
}

interface Vendor {
    id: string;
    name: string;
    category: string;
    location: string;
    description: string;
    whatsapp?: string;
    rating: number;
    reviews: number;
    imageUrl?: string;
    operatingHours: string;
}

const JOB_CATEGORIES = ['Semua', 'retail', 'f&b', 'transport', 'agriculture', 'construction'];
const VENDOR_CATEGORIES = ['Semua', 'Makanan', 'Kraf Tangan', 'Perkhidmatan'];

function formatWage(amount: number, type: string): string {
    const num = Number(amount) || 0;
    const formatted = `RM${num.toFixed(type === 'hourly' ? 2 : 0)}`;
    const label = type === 'hourly' ? '/jam' : type === 'daily' ? '/hari' : '/bulan';
    return `${formatted}${label}`;
}

function timeAgo(ts: number): string {
    const diff = Date.now() - (ts || Date.now());
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${Math.max(1, mins)}m lalu`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}j lalu`;
    const days = Math.floor(hours / 24);
    return `${days}h lalu`;
}

export default function KomunitiView() {
    const { user } = useAuth();
    const [subTab, setSubTab] = useState<'kerja' | 'niaga'>('kerja');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedJobCategory, setSelectedJobCategory] = useState('Semua');
    const [selectedVendorCategory, setSelectedVendorCategory] = useState('Semua');

    const [jobs, setJobs] = useState<Job[]>([]);
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Modal state for adding items
    const [showAddModal, setShowAddModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form fields
    const [titleOrName, setTitleOrName] = useState('');
    const [employerOrHours, setEmployerOrHours] = useState('');
    const [location, setLocation] = useState('');
    const [category, setCategory] = useState('');
    const [wageMYR, setWageMYR] = useState('');
    const [wageType, setWageType] = useState<'hourly' | 'daily' | 'monthly'>('hourly');
    const [whatsapp, setWhatsapp] = useState('');
    const [description, setDescription] = useState('');

    // Fetch dynamic data on mount
    useEffect(() => {
        setIsLoading(true);
        fetch('/api/komuniti')
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setJobs(data.jobs || []);
                    setVendors(data.vendors || []);
                }
            })
            .catch(() => {})
            .finally(() => setIsLoading(false));
    }, []);

    // Filter jobs
    const filteredJobs = jobs.filter(j => {
        const matchesSearch = !searchQuery || j.title.toLowerCase().includes(searchQuery.toLowerCase()) || j.employer.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedJobCategory === 'Semua' || j.category === selectedJobCategory;
        return matchesSearch && matchesCategory;
    });

    // Filter vendors
    const filteredVendors = vendors.filter(v => {
        const matchesSearch = !searchQuery || v.name.toLowerCase().includes(searchQuery.toLowerCase()) || v.description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedVendorCategory === 'Semua' || v.category === selectedVendorCategory;
        return matchesSearch && matchesCategory;
    });

    const openWhatsApp = (phone: string, message: string) => {
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
    };

    const handleCreateItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!titleOrName || !location || !description) return;

        setIsSubmitting(true);
        try {
            const payload = subTab === 'kerja' ? {
                itemType: 'job',
                title: titleOrName,
                employer: employerOrHours || 'Majikan Tempatan',
                location,
                category: category || 'retail',
                wageMYR: Number(wageMYR) || 8,
                wageType,
                whatsapp,
                description
            } : {
                itemType: 'vendor',
                name: titleOrName,
                operatingHours: employerOrHours || '8AM - 6PM',
                location,
                category: category || 'Makanan',
                whatsapp,
                description
            };

            const res = await fetch('/api/komuniti', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                if (subTab === 'kerja' && data.job) {
                    setJobs(prev => [data.job, ...prev]);
                } else if (subTab === 'niaga' && data.vendor) {
                    setVendors(prev => [data.vendor, ...prev]);
                }
                setShowAddModal(false);
                setTitleOrName('');
                setEmployerOrHours('');
                setLocation('');
                setWageMYR('');
                setWhatsapp('');
                setDescription('');
            }
        } catch (err) {
            console.error('Failed to create komuniti item:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="p-5 max-w-2xl mx-auto">
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'var(--accent-muted)' }}>
                        <Users className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>NADI Komuniti</h1>
                        <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Ekonomi Lokal Kelantan</p>
                    </div>
                </div>

                <button
                    onClick={() => setShowAddModal(true)}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                    style={{ background: 'var(--accent)' }}
                >
                    <Plus className="w-4 h-4" /> {subTab === 'kerja' ? 'Iklan Kerja' : 'Daftar Peniaga'}
                </button>
            </motion.div>

            {/* Sub-tab Switcher */}
            <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="flex gap-2 mb-5 p-1 rounded-2xl" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}
            >
                <button
                    onClick={() => { setSubTab('kerja'); setSearchQuery(''); }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                    style={subTab === 'kerja' ? { background: 'var(--accent)', color: 'white' } : { color: 'var(--text-muted)' }}
                >
                    <Briefcase className="w-4 h-4" />
                    Kerja Bermaruah
                </button>
                <button
                    onClick={() => { setSubTab('niaga'); setSearchQuery(''); }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                    style={subTab === 'niaga' ? { background: 'var(--accent)', color: 'white' } : { color: 'var(--text-muted)' }}
                >
                    <ShoppingBag className="w-4 h-4" />
                    Niaga Lokal
                </button>
            </motion.div>

            {/* Search Bar */}
            <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                className="relative mb-4"
            >
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder={subTab === 'kerja' ? 'Cari kerja di Kelantan...' : 'Cari peniaga lokal...'}
                    className="w-full pl-11 pr-4 py-3.5 rounded-2xl text-xs font-medium outline-none transition-all"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                />
            </motion.div>

            {/* Category Filter Pills */}
            <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="flex gap-2 mb-5 overflow-x-auto no-scrollbar pb-1"
            >
                {(subTab === 'kerja' ? JOB_CATEGORIES : VENDOR_CATEGORIES).map(cat => {
                    const isActive = subTab === 'kerja' ? selectedJobCategory === cat : selectedVendorCategory === cat;
                    return (
                        <button
                            key={cat}
                            onClick={() => subTab === 'kerja' ? setSelectedJobCategory(cat) : setSelectedVendorCategory(cat)}
                            className="px-3.5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider whitespace-nowrap shrink-0 transition-all"
                            style={isActive
                                ? { background: 'var(--accent-muted)', color: 'var(--accent)', border: '1px solid var(--accent)' }
                                : { background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border-default)' }
                            }
                        >
                            {cat}
                        </button>
                    );
                })}
            </motion.div>

            {/* Content */}
            <AnimatePresence mode="wait">
                {isLoading ? (
                    <div className="p-12 text-center flex flex-col items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin mb-2" style={{ color: 'var(--accent)' }} />
                        <span className="text-xs font-medium text-zinc-400">Memuatkan data komuniti...</span>
                    </div>
                ) : subTab === 'kerja' ? (
                    <motion.div key="kerja" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-3">
                        {/* Stats Banner */}
                        <div className="grid grid-cols-3 gap-2 mb-4">
                            {[
                                { label: 'Kerja Aktif', value: jobs.length, icon: Briefcase },
                                { label: 'Gaji Adil', value: `${jobs.filter(j => j.isFairWage).length}/${jobs.length}`, icon: Heart },
                                { label: 'Daerah', value: new Set(jobs.map(j => j.location)).size || 1, icon: MapPin },
                            ].map((stat, i) => (
                                <div key={i} className="rounded-2xl p-3 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                                    <stat.icon className="w-4 h-4 mx-auto mb-1" style={{ color: 'var(--accent)' }} />
                                    <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{stat.value}</p>
                                    <p className="text-[9px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
                                </div>
                            ))}
                        </div>

                        {/* Job Listings */}
                        {filteredJobs.length === 0 ? (
                            <div className="text-center py-12 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px dashed var(--border-default)' }}>
                                <Briefcase className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                                <p className="text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>Tiada kerja ditemui</p>
                                <p className="text-[10px] text-zinc-500">Jadilah yang pertama untuk menambah jawatan kosong!</p>
                            </div>
                        ) : (
                            filteredJobs.map((job, i) => (
                                <motion.div
                                    key={job.id || i}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    className="rounded-2xl p-4 relative overflow-hidden"
                                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
                                >
                                    {/* Fair Wage Badge */}
                                    {job.isFairWage && (
                                        <div className="absolute top-3 right-3">
                                            <span className="text-[8px] font-bold uppercase tracking-wider px-2 py-1 rounded-full"
                                                style={{ background: 'var(--success-muted, rgba(16,185,129,0.1))', color: 'var(--success, #10B981)', border: '1px solid rgba(16,185,129,0.2)' }}>
                                                ✓ Gaji Adil
                                            </span>
                                        </div>
                                    )}

                                    <h4 className="text-sm font-bold mb-1 pr-20" style={{ color: 'var(--text-primary)' }}>{job.title}</h4>
                                    <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>{job.employer}</p>
                                    <p className="text-xs mb-3 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{job.description}</p>

                                    <div className="flex items-center gap-3 flex-wrap mb-3">
                                        <span className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg"
                                            style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                                            {formatWage(job.wageMYR, job.wageType)}
                                        </span>
                                        <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                                            <MapPin className="w-3 h-3" /> {job.location}
                                        </span>
                                        <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                                            <Clock className="w-3 h-3" /> {timeAgo(job.postedAt)}
                                        </span>
                                    </div>

                                    {job.whatsapp && (
                                        <button
                                            onClick={() => openWhatsApp(job.whatsapp!, `Assalamualaikum, saya berminat dengan jawatan "${job.title}" yang diiklankan di NADI.`)}
                                            className="w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all hover:opacity-90"
                                            style={{ background: '#25D366', color: 'white' }}
                                        >
                                            <Phone className="w-3.5 h-3.5" /> Hubungi via WhatsApp
                                        </button>
                                    )}
                                </motion.div>
                            ))
                        )}
                    </motion.div>
                ) : (
                    <motion.div key="niaga" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-3">
                        {/* Vendor Listings */}
                        {filteredVendors.length === 0 ? (
                            <div className="text-center py-12 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px dashed var(--border-default)' }}>
                                <ShoppingBag className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                                <p className="text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>Tiada peniaga ditemui</p>
                                <p className="text-[10px] text-zinc-500">Daftarkan perniagaan tempatan anda di sini!</p>
                            </div>
                        ) : (
                            filteredVendors.map((vendor, i) => (
                                <motion.div
                                    key={vendor.id || i}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    className="rounded-2xl p-4 relative overflow-hidden"
                                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <h4 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{vendor.name}</h4>
                                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mt-1 inline-block"
                                                style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                                                {vendor.category}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                            <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{vendor.rating || 5.0}</span>
                                            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>({vendor.reviews || 1})</span>
                                        </div>
                                    </div>

                                    <p className="text-xs mb-3 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{vendor.description}</p>

                                    <div className="flex items-center gap-3 flex-wrap mb-3">
                                        <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                                            <MapPin className="w-3 h-3" /> {vendor.location}
                                        </span>
                                        <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                                            <Clock className="w-3 h-3" /> {vendor.operatingHours}
                                        </span>
                                    </div>

                                    {vendor.whatsapp && (
                                        <button
                                            onClick={() => openWhatsApp(vendor.whatsapp!, `Assalamualaikum, saya ingin bertanya tentang ${vendor.name} di NADI.`)}
                                            className="w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all hover:opacity-90"
                                            style={{ background: '#25D366', color: 'white' }}
                                        >
                                            <Phone className="w-3.5 h-3.5" /> WhatsApp Peniaga
                                        </button>
                                    )}
                                </motion.div>
                            ))
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ADD ITEM MODAL */}
            <AnimatePresence>
                {showAddModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-[#0A0A0C] border border-zinc-800 rounded-3xl p-6 max-w-md w-full shadow-2xl relative text-white"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400">
                                    {subTab === 'kerja' ? 'Tambah Iklan Kerja Bermaruah' : 'Daftar Peniaga Lokal'}
                                </h3>
                                <button onClick={() => setShowAddModal(false)} className="p-1 text-zinc-400 hover:text-white">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <form onSubmit={handleCreateItem} className="space-y-3">
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                                        {subTab === 'kerja' ? 'Jawatan / Tajuk Kerja' : 'Nama Perniagaan / Kedai'}
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={titleOrName}
                                        onChange={e => setTitleOrName(e.target.value)}
                                        placeholder={subTab === 'kerja' ? 'cth: Pembantu Kedai' : 'cth: Kak Jah Batik Lukis'}
                                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                                        {subTab === 'kerja' ? 'Nama Syarikat / Majikan' : 'Waktu Operasi'}
                                    </label>
                                    <input
                                        type="text"
                                        value={employerOrHours}
                                        onChange={e => setEmployerOrHours(e.target.value)}
                                        placeholder={subTab === 'kerja' ? 'cth: Syarikat Maju Jaya' : 'cth: 8AM - 6PM'}
                                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white outline-none"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">Lokasi / Daerah</label>
                                        <input
                                            type="text"
                                            required
                                            value={location}
                                            onChange={e => setLocation(e.target.value)}
                                            placeholder="cth: Kota Bharu"
                                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">Kategori</label>
                                        <select
                                            value={category}
                                            onChange={e => setCategory(e.target.value)}
                                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white outline-none"
                                        >
                                            <option value="">Pilih...</option>
                                            {(subTab === 'kerja' ? JOB_CATEGORIES : VENDOR_CATEGORIES).filter(c => c !== 'Semua').map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {subTab === 'kerja' && (
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">Kadar Gaji (MYR)</label>
                                            <input
                                                type="number"
                                                step="0.5"
                                                value={wageMYR}
                                                onChange={e => setWageMYR(e.target.value)}
                                                placeholder="cth: 8.50"
                                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">Jenis Gaji</label>
                                            <select
                                                value={wageType}
                                                onChange={e => setWageType(e.target.value as any)}
                                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white outline-none"
                                            >
                                                <option value="hourly">Jam (/jam)</option>
                                                <option value="daily">Hari (/hari)</option>
                                                <option value="monthly">Bulan (/bulan)</option>
                                            </select>
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">Nombor WhatsApp</label>
                                    <input
                                        type="text"
                                        value={whatsapp}
                                        onChange={e => setWhatsapp(e.target.value)}
                                        placeholder="cth: 60171234567"
                                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">Keterangan / Butiran</label>
                                    <textarea
                                        required
                                        rows={3}
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        placeholder="Tulis butiran lanjut..."
                                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white outline-none resize-none"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full py-3 rounded-xl bg-emerald-500 text-black font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-emerald-400 transition-all disabled:opacity-50 mt-2"
                                >
                                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    {subTab === 'kerja' ? 'Hantar Iklan Kerja' : 'Simpan Peniaga'}
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Footer */}
            <div className="mt-8 text-center pb-4">
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                    NADI Komuniti • Ekonomi Lokal Kelantan
                </p>
            </div>
        </div>
    );
}
