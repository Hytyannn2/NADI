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
    ShoppingBag, Briefcase, Search, MapPin, Phone, Clock,
    Loader2, Plus, Send, X, ExternalLink, Compass,
    Building2
} from 'lucide-react';
import { CardSkeleton, StatsBannerSkeleton } from '@/src/components/ui/Skeleton';
import { getDistanceKm } from '@/src/lib/format';

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
            <div className="mb-6 flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h2 className="text-2xl">{t('komuniti.header_title') || 'Papan Komuniti'}</h2>
                    <p className="mt-1 text-md text-ink-2">Cari kerja kosong dan sokong perniagaan tempatan di kawasan anda.</p>
                </div>

                <button
                    type="button"
                    onClick={() => setShowAddModal(true)}
                    className="btn btn--primary"
                >
                    <Plus className="w-4 h-4" aria-hidden="true" /> {subTab === 'kerja' ? 'Iklan Kerja' : 'Daftar Perniagaan'}
                </button>
            </div>

            {/* Standardized Sub-tab Switcher */}
            <div role="tablist" className="seg mb-4 max-w-md">
                <button
                    type="button"
                    role="tab"
                    aria-selected={subTab === 'kerja'}
                    onClick={() => { setSubTab('kerja'); setSearchQuery(''); }}
                >
                    <Briefcase className="w-4 h-4" aria-hidden="true" />
                    {t('komuniti.tab_jobs') || 'Kerja Kosong'}
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={subTab === 'niaga'}
                    onClick={() => { setSubTab('niaga'); setSearchQuery(''); }}
                >
                    <ShoppingBag className="w-4 h-4" aria-hidden="true" />
                    {t('komuniti.tab_vendors') || 'Peniaga Tempatan'}
                </button>
            </div>

            {/* Search Bar + Radius Filter Row */}
            <div className="mb-2 space-y-2">
                <div className="relative max-w-md">
                    <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" aria-hidden="true" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder={subTab === 'kerja' ? 'Cari kerja, majikan, atau kawasan…' : 'Cari kedai, produk, atau perkhidmatan…'}
                        aria-label={subTab === 'kerja' ? 'Cari kerja kosong' : 'Cari peniaga tempatan'}
                        className="field pl-10"
                    />
                </div>

                {/* Radius Filter Pills */}
                <div className="-mx-1 flex items-center gap-2 overflow-x-auto no-scrollbar px-1 py-2">
                    <span className="label mb-0 flex shrink-0 items-center gap-1">
                        <Compass className="w-4 h-4" aria-hidden="true" /> Jarak:
                    </span>
                    {RADIUS_OPTIONS.map(opt => {
                        const isSelected = maxRadiusKm === opt.value;
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                aria-pressed={isSelected}
                                onClick={() => setMaxRadiusKm(opt.value)}
                                className={`tag shrink-0${isSelected ? ' tag--on' : ''}`}
                            >
                                {opt.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Category Filter Pills (Fixed height so they don't squish into lines) */}
            <div className="-mx-1 mb-4 flex shrink-0 items-center gap-2 overflow-x-auto no-scrollbar px-1 py-2">
                {(subTab === 'kerja' ? JOB_CATEGORIES : VENDOR_CATEGORIES).map(cat => {
                    const isActive = subTab === 'kerja' ? selectedJobCategory === cat : selectedVendorCategory === cat;
                    return (
                        <button
                            key={cat}
                            type="button"
                            aria-pressed={isActive}
                            onClick={() => subTab === 'kerja' ? setSelectedJobCategory(cat) : setSelectedVendorCategory(cat)}
                            className={`tag shrink-0${isActive ? ' tag--on' : ''}`}
                        >
                            {cat}
                        </button>
                    );
                })}
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="space-y-4">
                    <StatsBannerSkeleton />
                    <CardSkeleton />
                    <CardSkeleton />
                    <CardSkeleton />
                </div>
            ) : subTab === 'kerja' ? (
                <div key="kerja" className="space-y-6">
                    {/* Stats Banner */}
                    <div className="flex divide-x divide-rule">
                        {[
                            { label: maxRadiusKm > 0 ? `Iklan (≤${maxRadiusKm}km)` : 'Jumlah Iklan', value: filteredJobs.length },
                            { label: 'Patuh Gaji Minimum', value: `${filteredJobs.filter(j => j.isFairWage).length}/${filteredJobs.length}` },
                            { label: 'Susunan', value: userLat ? 'Jarak Terdekat' : 'Terkini' },
                        ].map((stat, i) => (
                            <div key={i} className="px-4 first:pl-0">
                                <p className="text-xl font-bold tabular-nums">{stat.value}</p>
                                <p className="text-sm text-muted">{stat.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* Job Listings */}
                    {filteredJobs.length === 0 ? (
                        <div className="well flex flex-col items-center px-6 py-12 text-center">
                            <Briefcase className="w-6 h-6 text-muted" aria-hidden="true" />
                            <h3 className="mt-3 text-lg">Belum Ada Iklan Kerja Kosong</h3>
                            <p className="mt-2 max-w-md text-ink-2">
                                Ada jawatan kosong di syarikat atau premis anda? Iklankan di sini supaya warga setempat boleh memohon terus.
                            </p>
                            <button
                                type="button"
                                onClick={() => setShowAddModal(true)}
                                className="btn mt-5"
                            >
                                <Plus className="w-4 h-4" aria-hidden="true" /> Iklankan Kerja Sekarang
                            </button>
                        </div>
                    ) : (
                        <ul className="ruled">
                            {filteredJobs.map((job, i) => (
                                <li
                                    key={job.id || i}
                                    className="flex flex-col gap-3 py-4 md:flex-row md:items-start md:justify-between md:gap-8"
                                >
                                    <div className="min-w-0 flex-1">
                                        {/* Job Title & Employer */}
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                            <h3 className="text-md font-semibold">{job.title}</h3>
                                            {job.isFairWage && (
                                                <span className="tag tag--in">Patuh Gaji Minimum</span>
                                            )}
                                        </div>
                                        <p className="mt-1 flex items-center gap-1 text-sm text-ink-2">
                                            <Building2 className="w-4 h-4 shrink-0" aria-hidden="true" /> {job.employer}
                                        </p>
                                        <p className="mt-2 max-w-prose text-ink-2 whitespace-pre-line line-clamp-3">{job.description}</p>

                                        {/* Meta: Wage, Location, Distance, Posted */}
                                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                                            <span className="font-semibold">{formatWage(job.wageMYR, job.wageType)}</span>
                                            <span className="flex items-center gap-1 text-sm text-muted">
                                                <MapPin className="w-4 h-4 shrink-0" aria-hidden="true" /> {job.location}
                                            </span>
                                            {job.distanceKm != null && (
                                                <span className="text-sm text-muted"><span className="num">{job.distanceKm}</span> km dari anda</span>
                                            )}
                                            <span className="text-sm text-muted">{timeAgo(job.postedAt)}</span>
                                        </div>
                                    </div>

                                    {/* Action Buttons: Apply Link or WhatsApp */}
                                    <div className="flex shrink-0 items-center gap-2 empty:hidden">
                                        {job.applyUrl && (
                                            <a
                                                href={job.applyUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn btn--sm"
                                            >
                                                <ExternalLink className="w-4 h-4" aria-hidden="true" /> Mohon
                                            </a>
                                        )}
                                        {job.whatsapp && (
                                            <button
                                                type="button"
                                                onClick={() => openWhatsApp(job.whatsapp!, `Salam sejahtera, saya berminat memohon jawatan "${job.title}" di ${job.employer} seperti yang diiklankan di NADI.`)}
                                                className="btn btn--sm"
                                            >
                                                <Phone className="w-4 h-4" aria-hidden="true" /> WhatsApp
                                            </button>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            ) : (
                <div key="niaga">
                    {/* Vendor Listings */}
                    {filteredVendors.length === 0 ? (
                        <div className="well flex flex-col items-center px-6 py-12 text-center">
                            <ShoppingBag className="w-6 h-6 text-muted" aria-hidden="true" />
                            <h3 className="mt-3 text-lg">Belum Ada Peniaga Didaftarkan</h3>
                            <p className="mt-2 max-w-md text-ink-2">
                                Anda mengusahakan kedai makan, gerai, atau servis tempatan? Daftar percuma supaya pelanggan setempat mudah menghubungi anda.
                            </p>
                            <button
                                type="button"
                                onClick={() => setShowAddModal(true)}
                                className="btn mt-5"
                            >
                                <Plus className="w-4 h-4" aria-hidden="true" /> Daftar Perniagaan Anda
                            </button>
                        </div>
                    ) : (
                        <ul className="ruled">
                            {filteredVendors.map((vendor, i) => (
                                <li
                                    key={vendor.id || i}
                                    className="flex flex-col gap-3 py-4 md:flex-row md:items-start md:justify-between md:gap-8"
                                >
                                    <div className="min-w-0 flex-1">
                                        <h3 className="text-md font-semibold">{vendor.name}</h3>
                                        <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-ink-2">
                                            <span>{vendor.category}</span>
                                            <span className="text-muted">Peniaga Tempatan</span>
                                        </p>
                                        <p className="mt-2 max-w-prose text-ink-2">{vendor.description}</p>

                                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                                            <span className="flex items-center gap-1">
                                                <MapPin className="w-4 h-4 shrink-0" aria-hidden="true" /> {vendor.location}
                                            </span>
                                            {vendor.distanceKm != null && (
                                                <span><span className="num">{vendor.distanceKm}</span> km</span>
                                            )}
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-4 h-4 shrink-0" aria-hidden="true" /> {vendor.operatingHours}
                                            </span>
                                        </div>
                                    </div>

                                    {vendor.whatsapp && (
                                        <button
                                            type="button"
                                            onClick={() => openWhatsApp(vendor.whatsapp!, `Salam sejahtera, saya ingin bertanya tentang ${vendor.name} seperti yang dipaparkan di NADI.`)}
                                            className="btn btn--sm shrink-0 self-start"
                                        >
                                            <Phone className="w-4 h-4" aria-hidden="true" /> Hubungi via WhatsApp
                                        </button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {/* ADD ITEM MODAL */}
            <AnimatePresence>
                {showAddModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.22 }}
                        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-scrim"
                    >
                        <div
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="komuniti-add-title"
                            className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-card sm:rounded-card border border-rule bg-paper p-6 pb-safe shadow-card"
                        >
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <h3 id="komuniti-add-title" className="flex items-center gap-2 text-lg">
                                    <Plus className="w-5 h-5 shrink-0" aria-hidden="true" /> {subTab === 'kerja' ? 'Iklankan Kerja Kosong' : 'Daftar Perniagaan Tempatan'}
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="icon-btn"
                                    aria-label="Tutup"
                                >
                                    <X className="w-5 h-5" aria-hidden="true" />
                                </button>
                            </div>

                            <form onSubmit={handleCreateItem} className="space-y-4">
                                <div>
                                    <label htmlFor="komuniti-title" className="label">
                                        {subTab === 'kerja' ? 'Nama Jawatan' : 'Nama Kedai / Perniagaan'}
                                    </label>
                                    <input
                                        id="komuniti-title"
                                        type="text"
                                        required
                                        value={titleOrName}
                                        onChange={e => setTitleOrName(e.target.value)}
                                        placeholder={subTab === 'kerja' ? 'cth: Pembantu Juruwang, Pemandu, Tukang Masak' : 'cth: Warung Celup Tepung Pantai'}
                                        className="field"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="komuniti-employer" className="label">
                                        {subTab === 'kerja' ? 'Nama Syarikat / Majikan' : 'Waktu Operasi'}
                                    </label>
                                    <input
                                        id="komuniti-employer"
                                        type="text"
                                        value={employerOrHours}
                                        onChange={e => setEmployerOrHours(e.target.value)}
                                        placeholder={subTab === 'kerja' ? 'cth: Kedai Runcit Mesra, Majikan Tempatan' : 'cth: 9:00 pagi - 6:00 petang'}
                                        className="field"
                                    />
                                </div>

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div>
                                        <label htmlFor="komuniti-location" className="label">Lokasi / Kawasan</label>
                                        <input
                                            id="komuniti-location"
                                            type="text"
                                            required
                                            value={location}
                                            onChange={e => setLocation(e.target.value)}
                                            placeholder={locationLabel ? `cth: ${locationLabel}` : 'cth: Kota Bharu, Pasir Mas'}
                                            className="field"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="komuniti-category" className="label">Kategori</label>
                                        <select
                                            id="komuniti-category"
                                            value={category}
                                            onChange={e => setCategory(e.target.value)}
                                            className="field"
                                        >
                                            <option value="">Pilih Kategori…</option>
                                            {(subTab === 'kerja' ? JOB_CATEGORIES : VENDOR_CATEGORIES).filter(c => c !== 'Semua').map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {subTab === 'kerja' && (
                                    <>
                                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                            <div>
                                                <label htmlFor="komuniti-wage" className="label">Gaji Ditawarkan (RM)</label>
                                                <input
                                                    id="komuniti-wage"
                                                    type="number"
                                                    step="0.5"
                                                    value={wageMYR}
                                                    onChange={e => setWageMYR(e.target.value)}
                                                    placeholder="cth: 1700"
                                                    className="field"
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor="komuniti-wage-type" className="label">Kadar Bayaran</label>
                                                <select
                                                    id="komuniti-wage-type"
                                                    value={wageType}
                                                    onChange={e => setWageType(e.target.value as typeof wageType)}
                                                    className="field"
                                                >
                                                    <option value="monthly">Sebulan (/bulan)</option>
                                                    <option value="hourly">Sejam (/jam)</option>
                                                    <option value="daily">Sehari (/hari)</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div>
                                            <label htmlFor="komuniti-apply-url" className="label">Pautan Laman Web / Borang Permohonan (Pilihan)</label>
                                            <input
                                                id="komuniti-apply-url"
                                                type="url"
                                                value={applyUrl}
                                                onChange={e => setApplyUrl(e.target.value)}
                                                placeholder="https://syarikat.com/kerjaya"
                                                className="field"
                                            />
                                        </div>
                                    </>
                                )}

                                <div>
                                    <label htmlFor="komuniti-whatsapp" className="label">
                                        {subTab === 'kerja' ? 'No. WhatsApp / Telefon Majikan' : 'No. WhatsApp / Telefon Kedai'}
                                    </label>
                                    <input
                                        id="komuniti-whatsapp"
                                        type="text"
                                        value={whatsapp}
                                        onChange={e => setWhatsapp(e.target.value)}
                                        placeholder="cth: 0123456789"
                                        className="field"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="komuniti-description" className="label">
                                        {subTab === 'kerja' ? 'Penerangan Kerja & Syarat Kelayakan' : 'Penerangan Produk & Servis'}
                                    </label>
                                    <textarea
                                        id="komuniti-description"
                                        required
                                        rows={3}
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        placeholder={subTab === 'kerja' ? 'Tulis skop tugas ringkas, waktu kerja, dan syarat umur atau kelayakan…' : 'Ceritakan menu utama, servis yang disediakan, atau cara tempahan…'}
                                        className="field"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="btn btn--primary btn--block mt-2"
                                >
                                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin keep-motion" aria-hidden="true" /> : <Send className="w-4 h-4" aria-hidden="true" />}
                                    {subTab === 'kerja' ? 'Terbitkan Iklan Kerja' : 'Daftar Perniagaan Sekarang'}
                                </button>
                            </form>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Footer */}
            <div className="mt-auto pt-8 pb-4">
                <p className="flex flex-wrap justify-center gap-x-3 text-sm text-muted">
                    <span>NADI Komuniti</span>
                    <span>{locationLabel || 'Malaysia'}</span>
                </p>
            </div>
        </div>
    );
}
