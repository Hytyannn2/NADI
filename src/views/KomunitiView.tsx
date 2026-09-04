/**
 * Community Economy & Local Commerce View
 * 
 * Displays local employment vacancies (fair-wage filtered) and micro-vendor profiles
 * with distance-based radius filtering and direct WhatsApp contact actions.
 */
'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage } from '@/src/context/LanguageContext';
import { useWeather } from '@/src/hooks/useWeather';
import {
    ShoppingBag, Briefcase, Search, MapPin, Phone, Clock, Star,
    Loader2, Plus, Send, X, ExternalLink, Compass,
    Building2, ShieldCheck, Navigation
} from 'lucide-react';

// Type Definitions
export interface Job {
    id: string;
    title: string;
    employer: string;
    location: string;
    district?: string;
    state?: string;
    lat?: number;
    lng?: number;
    wageMYR: number;
    wageType: 'hourly' | 'daily' | 'monthly';
    category: string;
    postedAt: number;
    whatsapp?: string;
    applyUrl?: string;
    isOfficialPortal?: boolean;
    description: string;
    isFairWage: boolean;
    distanceKm?: number | null;
}

export interface Vendor {
    id: string;
    name: string;
    category: string;
    location: string;
    district?: string;
    state?: string;
    lat?: number;
    lng?: number;
    description: string;
    whatsapp?: string;
    rating?: number | null;
    reviews?: number;
    imageUrl?: string;
    operatingHours: string;
    postedAt?: number;
    distanceKm?: number | null;
}

const JOB_CATEGORIES = ['Semua', 'Runcit', 'Makanan & Minuman', 'Pengangkutan', 'Pembinaan', 'Perkhidmatan', 'Lain-lain'];
const VENDOR_CATEGORIES = ['Semua', 'Makanan', 'Kraf Tangan', 'Runcit & Bekalan', 'Perkhidmatan', 'Lain-lain'];
const RADIUS_OPTIONS = [
    { label: 'Semua Jarak', value: 0 },
    { label: '15 km', value: 15 },
    { label: '30 km', value: 30 },
    { label: '50 km', value: 50 },
    { label: '100 km', value: 100 },
];

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
}

function formatWage(amount: number, type: string): string {
    const num = Number(amount) || 0;
    if (num <= 0) return 'Gaji boleh runding';
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
    const { user, session } = useAuth();
    const { t } = useLanguage();
    const { locationLabel, userLat, userLng } = useWeather();
    const [subTab, setSubTab] = useState<'kerja' | 'niaga'>('kerja');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedJobCategory, setSelectedJobCategory] = useState('Semua');
    const [selectedVendorCategory, setSelectedVendorCategory] = useState('Semua');
    const [maxRadiusKm, setMaxRadiusKm] = useState<number>(0); // 0 = all

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
    const [wageType, setWageType] = useState<'hourly' | 'daily' | 'monthly'>('monthly');
    const [applyUrl, setApplyUrl] = useState('');
    const [whatsapp, setWhatsapp] = useState('');
    const [description, setDescription] = useState('');

    // Fetch community-posted data on mount and location changes
    const loadCommunityData = () => {
        setIsLoading(true);
        const locQuery = locationLabel && locationLabel !== 'Lokasi Semasa' ? `?location=${encodeURIComponent(locationLabel)}` : '';
        fetch(`/api/komuniti${locQuery}`)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setJobs(data.jobs || []);
                    setVendors(data.vendors || []);
                }
            })
            .catch(() => {})
            .finally(() => setIsLoading(false));
    };

    useEffect(() => {
        loadCommunityData();
    }, [locationLabel]);

    // Calculate real Haversine distance from user's live GPS coordinates
    const jobsWithDistance = useMemo(() => {
        return jobs.map(j => {
            let dist: number | null = null;
            if (userLat != null && userLng != null && j.lat && j.lng && (j.lat !== 0 || j.lng !== 0)) {
                dist = getDistanceKm(userLat, userLng, j.lat, j.lng);
            }
            return { ...j, distanceKm: dist };
        });
    }, [jobs, userLat, userLng]);

    const vendorsWithDistance = useMemo(() => {
        return vendors.map(v => {
            let dist: number | null = null;
            if (userLat != null && userLng != null && v.lat && v.lng && (v.lat !== 0 || v.lng !== 0)) {
                dist = getDistanceKm(userLat, userLng, v.lat, v.lng);
            }
            return { ...v, distanceKm: dist };
        });
    }, [vendors, userLat, userLng]);

    // Filter & Sort Jobs by Distance (nearest first) + Radius Filter
    const filteredJobs = useMemo(() => {
        return jobsWithDistance
            .filter(j => {
                const matchesSearch = !searchQuery ||
                    j.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    j.employer.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    j.location.toLowerCase().includes(searchQuery.toLowerCase());
                const matchesCategory = selectedJobCategory === 'Semua' || j.category === selectedJobCategory;
                const matchesRadius = maxRadiusKm === 0 || j.distanceKm == null || j.distanceKm <= maxRadiusKm || j.isOfficialPortal;
                return matchesSearch && matchesCategory && matchesRadius;
            })
            .sort((a, b) => {
                if (a.distanceKm != null && b.distanceKm != null) {
                    return a.distanceKm - b.distanceKm;
                }
                if (a.distanceKm != null) return -1;
                if (b.distanceKm != null) return 1;
                return (b.postedAt || 0) - (a.postedAt || 0);
            });
    }, [jobsWithDistance, searchQuery, selectedJobCategory, maxRadiusKm]);

    // Filter & Sort Vendors by Distance (nearest first) + Radius Filter
    const filteredVendors = useMemo(() => {
        return vendorsWithDistance
            .filter(v => {
                const matchesSearch = !searchQuery ||
                    v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    v.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    v.location.toLowerCase().includes(searchQuery.toLowerCase());
                const matchesCategory = selectedVendorCategory === 'Semua' || v.category === selectedVendorCategory;
                const matchesRadius = maxRadiusKm === 0 || v.distanceKm == null || v.distanceKm <= maxRadiusKm;
                return matchesSearch && matchesCategory && matchesRadius;
            })
            .sort((a, b) => {
                if (a.distanceKm != null && b.distanceKm != null) {
                    return a.distanceKm - b.distanceKm;
                }
                if (a.distanceKm != null) return -1;
                if (b.distanceKm != null) return 1;
                return (b.postedAt || 0) - (a.postedAt || 0);
            });
    }, [vendorsWithDistance, searchQuery, selectedVendorCategory, maxRadiusKm]);

    const openWhatsApp = (phone: string, message: string) => {
        window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
    };

    const handleCreateItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!titleOrName || !location || !description) return;

        if (!session?.access_token) {
            alert('Sila log masuk terlebih dahulu untuk menyiarkan iklan komuniti.');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = subTab === 'kerja' ? {
                itemType: 'job',
                title: titleOrName,
                employer: employerOrHours || user?.user_metadata?.full_name || 'Majikan Tempatan',
                location,
                lat: userLat || 0,
                lng: userLng || 0,
                category: category || 'Runcit',
                wageMYR: Number(wageMYR) || 0,
                wageType,
                applyUrl,
                whatsapp,
                description
            } : {
                itemType: 'vendor',
                name: titleOrName,
                operatingHours: employerOrHours || '8:00 AM - 6:00 PM',
                location,
                lat: userLat || 0,
                lng: userLng || 0,
                category: category || 'Makanan',
                whatsapp,
                description
            };

            const res = await fetch('/api/komuniti', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
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
                setApplyUrl('');
                setWhatsapp('');
                setDescription('');
            }
        } catch (err) {
            console.error('Failed to advertise item:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="p-5 min-h-full w-full flex flex-col relative z-0">
            {/* Standardized Header */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white font-serif">{t('komuniti.header_title') || 'Papan Komuniti'}</h1>
                    <p className="text-xs font-medium text-zinc-400 mt-0.5">Cari kerja kosong dan sokong perniagaan tempatan di kawasan anda.</p>
                </div>

                <button
                    onClick={() => setShowAddModal(true)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-black bg-[#C5A367] flex items-center gap-1.5 transition-all shadow-md active:scale-95 hover:brightness-110"
                >
                    <Plus className="w-4 h-4 text-black" /> {subTab === 'kerja' ? 'Iklan Kerja' : 'Daftar Perniagaan'}
                </button>
            </motion.div>

            {/* Standardized Sub-tab Switcher */}
            <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="flex p-1.5 rounded-2xl mb-5 bg-[#0D0D10] border border-zinc-800/80 shadow-xl"
            >
                <button
                    onClick={() => { setSubTab('kerja'); setSearchQuery(''); }}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                        subTab === 'kerja'
                            ? 'bg-zinc-800 border-zinc-600 text-white shadow-md'
                            : 'bg-transparent border-transparent text-zinc-400 hover:text-zinc-200'
                    }`}
                >
                    <Briefcase className="w-4 h-4" />
                    {t('komuniti.tab_jobs') || 'Kerja Kosong'}
                </button>
                <button
                    onClick={() => { setSubTab('niaga'); setSearchQuery(''); }}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                        subTab === 'niaga'
                            ? 'bg-zinc-800 border-zinc-600 text-white shadow-md'
                            : 'bg-transparent border-transparent text-zinc-400 hover:text-zinc-200'
                    }`}
                >
                    <ShoppingBag className="w-4 h-4" />
                    {t('komuniti.tab_vendors') || 'Peniaga Tempatan'}
                </button>
            </motion.div>

            {/* Search Bar + Radius Filter Row */}
            <div className="space-y-3 mb-4">
                <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                    className="relative"
                >
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder={subTab === 'kerja' ? 'Cari kerja, majikan, atau kawasan...' : 'Cari kedai, produk, atau perkhidmatan...'}
                        className="w-full pl-11 pr-4 py-3.5 rounded-2xl text-xs font-medium outline-none transition-all"
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                    />
                </motion.div>

                {/* Radius Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1 shrink-0 mr-1">
                        <Compass className="w-3 h-3 text-[#C5A367]" /> Jarak:
                    </span>
                    {RADIUS_OPTIONS.map(opt => {
                        const isSelected = maxRadiusKm === opt.value;
                        return (
                            <button
                                key={opt.value}
                                onClick={() => setMaxRadiusKm(opt.value)}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap shrink-0 border ${
                                    isSelected
                                        ? 'bg-[#C5A367] text-black border-[#C5A367] shadow-sm'
                                        : 'bg-zinc-900/80 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-white'
                                }`}
                            >
                                {opt.label}
                            </button>
                        );
                    })}
                </div>
            </div>

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
                        <span className="text-xs font-medium text-zinc-400">Mencari maklumat berdekatan...</span>
                    </div>
                ) : subTab === 'kerja' ? (
                    <motion.div key="kerja" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-4">
                        {/* Stats Banner */}
                        <div className="grid grid-cols-3 gap-3 mb-4">
                            {[
                                { label: maxRadiusKm > 0 ? `Iklan (≤${maxRadiusKm}km)` : 'Jumlah Iklan', value: filteredJobs.length, icon: Briefcase },
                                { label: 'Patuh Gaji Minimum', value: `${filteredJobs.filter(j => j.isFairWage).length}/${filteredJobs.length}`, icon: ShieldCheck },
                                { label: 'Susunan', value: userLat ? 'Jarak Terdekat' : 'Terkini', icon: MapPin },
                            ].map((stat, i) => (
                                <div key={i} className="rounded-2xl p-3.5 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                                    <stat.icon className="w-4 h-4 mx-auto mb-1" style={{ color: 'var(--accent)' }} />
                                    <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{stat.value}</p>
                                    <p className="text-[9px] font-medium uppercase tracking-wider truncate" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
                                </div>
                            ))}
                        </div>

                        {/* Job Listings */}
                        {filteredJobs.length === 0 ? (
                            <div className="text-center py-16 px-6 rounded-3xl border border-dashed border-zinc-800 bg-[#0D0D10]/80 w-full flex flex-col items-center justify-center">
                                <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-3 text-zinc-400">
                                    <Briefcase className="w-7 h-7 text-[#C5A367]" />
                                </div>
                                <h4 className="text-sm font-bold text-white mb-1">Belum Ada Iklan Kerja Kosong</h4>
                                <p className="text-xs text-zinc-400 max-w-md mx-auto mb-5 leading-relaxed">
                                    Ada jawatan kosong di syarikat atau premis anda? Iklankan di sini supaya warga setempat boleh memohon terus.
                                </p>
                                <button
                                    onClick={() => setShowAddModal(true)}
                                    className="px-5 py-2.5 rounded-xl text-xs font-bold text-black bg-[#C5A367] inline-flex items-center gap-1.5 transition-all shadow-md active:scale-95 hover:brightness-110"
                                >
                                    <Plus className="w-4 h-4 text-black" /> Iklankan Kerja Sekarang
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {filteredJobs.map((job, i) => (
                                    <motion.div
                                        key={job.id || i}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.04 }}
                                        className="rounded-2xl p-4.5 relative overflow-hidden border transition-all hover:border-zinc-700 flex flex-col justify-between"
                                        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
                                    >
                                        <div>
                                            {/* Top Badges: Distance & Fair Wage */}
                                            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    {job.distanceKm != null ? (
                                                        <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
                                                            <MapPin className="w-3 h-3" /> {job.distanceKm} km dari anda
                                                        </span>
                                                    ) : (
                                                        <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700 flex items-center gap-1">
                                                            <Building2 className="w-3 h-3 text-[#C5A367]" /> {job.location}
                                                        </span>
                                                    )}

                                                    {job.isFairWage && (
                                                        <span className="text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                                                            style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}>
                                                            ✓ Patuh Gaji Minimum
                                                        </span>
                                                    )}
                                                </div>

                                                <span className="text-[9px] font-mono text-zinc-500">
                                                    {timeAgo(job.postedAt)}
                                                </span>
                                            </div>

                                            {/* Job Title & Employer */}
                                            <h4 className="text-base font-bold mb-0.5 text-white">{job.title}</h4>
                                            <p className="text-xs font-semibold text-[#C5A367] mb-2 flex items-center gap-1">
                                                <Building2 className="w-3.5 h-3.5" /> {job.employer}
                                            </p>
                                            <p className="text-xs mb-3 leading-relaxed text-zinc-300 whitespace-pre-line line-clamp-3">{job.description}</p>

                                            {/* Meta pills: Wage, Location */}
                                            <div className="flex items-center gap-2.5 flex-wrap mb-4">
                                                <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                    {formatWage(job.wageMYR, job.wageType)}
                                                </span>
                                                <span className="flex items-center gap-1 text-[10px] font-medium text-zinc-400">
                                                    <MapPin className="w-3 h-3 text-zinc-500" /> {job.location}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Action Buttons: Apply Link or WhatsApp */}
                                        <div className="flex items-center gap-2 mt-auto pt-2 border-t border-zinc-800/60">
                                            {job.applyUrl && (
                                                <a
                                                    href={job.applyUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex-1 py-2 px-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 hover:brightness-110 bg-[#C5A367] text-black"
                                                >
                                                    <ExternalLink className="w-3.5 h-3.5" /> Mohon
                                                </a>
                                            )}
                                            {job.whatsapp && (
                                                <button
                                                    onClick={() => openWhatsApp(job.whatsapp!, `Salam sejahtera, saya berminat memohon jawatan "${job.title}" di ${job.employer} seperti yang diiklankan di NADI.`)}
                                                    className="py-2 px-3.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 hover:opacity-90 bg-[#25D366] text-white shrink-0"
                                                >
                                                    <Phone className="w-3.5 h-3.5" /> WhatsApp
                                                </button>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                ) : (
                    <motion.div key="niaga" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
                        {/* Vendor Listings */}
                        {filteredVendors.length === 0 ? (
                            <div className="text-center py-16 px-6 rounded-3xl border border-dashed border-zinc-800 bg-[#0D0D10]/80 w-full flex flex-col items-center justify-center">
                                <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-3 text-zinc-400">
                                    <ShoppingBag className="w-7 h-7 text-[#C5A367]" />
                                </div>
                                <h4 className="text-sm font-bold text-white mb-1">Belum Ada Peniaga Didaftarkan</h4>
                                <p className="text-xs text-zinc-400 max-w-md mx-auto mb-5 leading-relaxed">
                                    Anda mengusahakan kedai makan, gerai, atau servis tempatan? Daftar percuma supaya pelanggan setempat mudah menghubungi anda.
                                </p>
                                <button
                                    onClick={() => setShowAddModal(true)}
                                    className="px-5 py-2.5 rounded-xl text-xs font-bold text-black bg-[#C5A367] inline-flex items-center gap-1.5 transition-all shadow-md active:scale-95 hover:brightness-110"
                                >
                                    <Plus className="w-4 h-4 text-black" /> Daftar Perniagaan Anda
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {filteredVendors.map((vendor, i) => (
                                    <motion.div
                                        key={vendor.id || i}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.04 }}
                                        className="rounded-2xl p-4.5 relative overflow-hidden border transition-all hover:border-zinc-700 flex flex-col justify-between"
                                        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
                                    >
                                        <div>
                                            <div className="flex items-start justify-between mb-2">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                        <h4 className="text-sm font-bold text-white">{vendor.name}</h4>
                                                        {vendor.distanceKm != null && (
                                                            <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
                                                                <MapPin className="w-2.5 h-2.5" /> {vendor.distanceKm} km
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full inline-block bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                        {vendor.category}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0 bg-zinc-900 px-2 py-1 rounded-lg border border-zinc-800">
                                                    <span className="text-[10px] font-semibold text-zinc-300">Peniaga Tempatan</span>
                                                </div>
                                            </div>

                                            <p className="text-xs mb-3 leading-relaxed text-zinc-300">{vendor.description}</p>

                                            <div className="flex items-center gap-3 flex-wrap mb-4 text-zinc-400">
                                                <span className="flex items-center gap-1 text-[10px] font-medium">
                                                    <MapPin className="w-3 h-3 text-zinc-500" /> {vendor.location}
                                                </span>
                                                <span className="flex items-center gap-1 text-[10px] font-medium">
                                                    <Clock className="w-3 h-3 text-zinc-500" /> {vendor.operatingHours}
                                                </span>
                                            </div>
                                        </div>

                                        {vendor.whatsapp && (
                                            <button
                                                onClick={() => openWhatsApp(vendor.whatsapp!, `Salam sejahtera, saya ingin bertanya tentang ${vendor.name} seperti yang dipaparkan di NADI.`)}
                                                className="w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all hover:opacity-90 bg-[#25D366] text-white shadow-md active:scale-95 mt-auto"
                                            >
                                                <Phone className="w-3.5 h-3.5" /> Hubungi via WhatsApp
                                            </button>
                                        )}
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ADD ITEM MODAL */}
            <AnimatePresence>
                {showAddModal && (
                    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md">
                        <motion.div
                            initial={{ y: '100%', opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: '100%', opacity: 0 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="bg-[#0A0A0C] border border-zinc-800 rounded-t-3xl sm:rounded-3xl p-6 max-w-md w-full shadow-2xl relative text-white max-h-[90vh] overflow-y-auto no-scrollbar pb-safe"
                        >
                            <div className="w-12 h-1 rounded-full bg-zinc-700 mx-auto mb-4 sm:hidden" />
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                                    <Plus className="w-4 h-4" /> {subTab === 'kerja' ? 'Iklankan Kerja Kosong' : 'Daftar Perniagaan Tempatan'}
                                </h3>
                                <button onClick={() => setShowAddModal(false)} className="p-1 text-zinc-400 hover:text-white">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <form onSubmit={handleCreateItem} className="space-y-3">
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                                        {subTab === 'kerja' ? 'Nama Jawatan' : 'Nama Kedai / Perniagaan'}
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={titleOrName}
                                        onChange={e => setTitleOrName(e.target.value)}
                                        placeholder={subTab === 'kerja' ? 'cth: Pembantu Juruwang, Pemandu, Tukang Masak' : 'cth: Warung Celup Tepung Pantai'}
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
                                        placeholder={subTab === 'kerja' ? 'cth: Kedai Runcit Mesra, Majikan Tempatan' : 'cth: 9:00 pagi - 6:00 petang'}
                                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white outline-none"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">Lokasi / Kawasan</label>
                                        <input
                                            type="text"
                                            required
                                            value={location}
                                            onChange={e => setLocation(e.target.value)}
                                            placeholder={locationLabel ? `cth: ${locationLabel}` : 'cth: Kota Bharu, Pasir Mas'}
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
                                            <option value="">Pilih Kategori...</option>
                                            {(subTab === 'kerja' ? JOB_CATEGORIES : VENDOR_CATEGORIES).filter(c => c !== 'Semua').map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {subTab === 'kerja' && (
                                    <>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">Gaji Ditawarkan (RM)</label>
                                                <input
                                                    type="number"
                                                    step="0.5"
                                                    value={wageMYR}
                                                    onChange={e => setWageMYR(e.target.value)}
                                                    placeholder="cth: 1700"
                                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">Kadar Bayaran</label>
                                                <select
                                                    value={wageType}
                                                    onChange={e => setWageType(e.target.value as any)}
                                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white outline-none"
                                                >
                                                    <option value="monthly">Sebulan (/bulan)</option>
                                                    <option value="hourly">Sejam (/jam)</option>
                                                    <option value="daily">Sehari (/hari)</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">Pautan Laman Web / Borang Permohonan (Pilihan)</label>
                                            <input
                                                type="url"
                                                value={applyUrl}
                                                onChange={e => setApplyUrl(e.target.value)}
                                                placeholder="https://syarikat.com/kerjaya"
                                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white outline-none"
                                            />
                                        </div>
                                    </>
                                )}

                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                                        {subTab === 'kerja' ? 'No. WhatsApp / Telefon Majikan' : 'No. WhatsApp / Telefon Kedai'}
                                    </label>
                                    <input
                                        type="text"
                                        value={whatsapp}
                                        onChange={e => setWhatsapp(e.target.value)}
                                        placeholder="cth: 0123456789"
                                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                                        {subTab === 'kerja' ? 'Penerangan Kerja & Syarat Kelayakan' : 'Penerangan Produk & Servis'}
                                    </label>
                                    <textarea
                                        required
                                        rows={3}
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        placeholder={subTab === 'kerja' ? 'Tulis skop tugas ringkas, waktu kerja, dan syarat umur atau kelayakan...' : 'Ceritakan menu utama, servis yang disediakan, atau cara tempahan...'}
                                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white outline-none resize-none"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full py-3 rounded-xl bg-emerald-500 text-black font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-emerald-400 transition-all disabled:opacity-50 mt-2 shadow-lg"
                                >
                                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    {subTab === 'kerja' ? 'Terbitkan Iklan Kerja' : 'Daftar Perniagaan Sekarang'}
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Footer */}
            <div className="mt-auto pt-8 text-center pb-4">
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                    NADI Komuniti • {locationLabel ? locationLabel.toUpperCase() : 'MALAYSIA'}
                </p>
            </div>
        </div>
    );
}
