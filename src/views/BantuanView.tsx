'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Heart, MapPin, Loader2, Plus, X, Search, Phone, Clock, Users, Package, ChevronDown, CheckCircle, AlertTriangle, HandHeart, Briefcase, Trash2, ExternalLink, Globe, Calendar, UserCheck, MessageCircle, Filter, Landmark, Building, Compass } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import VolunteerChat from '@/src/components/VolunteerChat';
import { useLanguage } from '@/src/context/LanguageContext';
import { useAuth } from '@/src/context/AuthContext';
import { useDebounce } from '@/src/hooks/useDebounce';
import useSWR from 'swr';
import { evaluateAllEligibility } from '@/src/utils/eligibilityEngine';

const fetcher = (url: string) => fetch(url).then(res => res.json());

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
    url?: string;
}

interface VolunteerOpportunity {
    id: string;
    title: string;
    organization: string;
    category: string;
    description: string;
    location: string;
    commitment: string;
    spots: number;
    url: string;
    urgency: 'high' | 'medium' | 'low';
    startDate: string;
}

interface VolunteerJob {
    id: string;
    name: string;
    dist: string;
    req: string;
    status: 'open' | 'accepted';
    bounty: number;
    area: string;
    priority: 'High' | 'Medium' | 'Low';
}

export default function BantuanView() {
    const { t, lang } = useLanguage();
    const [activeTab, setActiveTab] = useState<'programs' | 'volunteer'>('programs');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'government' | 'ngo' | 'zakat' | 'community'>('all');
    const [filterLocation, setFilterLocation] = useState<string>('all');
    const [filterEligStatus, setFilterEligStatus] = useState<'all' | 'eligible' | 'maybe' | 'not_eligible'>('all');
    const [sortBy, setSortBy] = useState<'default' | 'name_asc' | 'name_desc' | 'provider_asc' | 'provider_desc' | 'match_desc' | 'match_asc'>('name_asc');
    const [volFilterCategory, setVolFilterCategory] = useState<string>('all');

    // Algorithmic Debouncing optimization
    const debouncedSearchQuery = useDebounce(searchQuery, 300);

    // Toast Alert State
    const [toastMessage, setToastMessage] = useState<{title: string, desc: string} | null>(null);
    const showToast = (title: string, desc: string) => {
        setToastMessage({ title, desc });
        setTimeout(() => setToastMessage(null), 3000);
    };

    // SWR Fetcher logic
    const [userLoc, setUserLoc] = useState<{ lat: number, lng: number } | null>(null);
    useEffect(() => {
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                (err) => console.log('Geolocation unavailable/denied:', err),
                { enableHighAccuracy: true }
            );
        }
    }, []);

    const programsUrl = userLoc ? `/api/bantuan/programs?lat=${userLoc.lat}&lng=${userLoc.lng}&lang=${lang}` : null;
    const { data: programsData, isLoading: programsLoading } = useSWR(programsUrl, fetcher, { revalidateOnFocus: false });
    const aidPrograms: AidProgram[] = programsData?.programs || [];
    const locationName = programsData?.location || '';

    // AI Matcher State
    const [showAIMatcher, setShowAIMatcher] = useState(false);
    const [isMatching, setIsMatching] = useState(false);
    const [profile, setProfile] = useState({ age: '', income: '', status: 'Bekerja', dependents: '0' });
    const [matchResults, setMatchResults] = useState<Record<string, { isEligible: boolean | 'maybe', reason: string }>>({});

    // Volunteer opportunities (nationwide from API)
    const { data: volData, isLoading: volLoading, mutate: mutateVolOpportunities } = useSWR(activeTab === 'volunteer' ? `/api/bantuan/volunteers?lang=${lang}` : null, fetcher, { revalidateOnFocus: false });
    const volOpportunities: VolunteerOpportunity[] = volData?.opportunities || [];
    const volPortals: VolunteerOpportunity[] = volData?.portals || [];

    const [volSearchQuery, setVolSearchQuery] = useState('');
    const debouncedVolSearchQuery = useDebounce(volSearchQuery, 300);

    // Local P2P SOS Volunteering
    const { data: localJobsData, isLoading: localJobsLoading, mutate: mutateLocalJobs } = useSWR(activeTab === 'volunteer' ? '/api/bencana/jobs' : null, fetcher);
    const localJobs: VolunteerJob[] = localJobsData?.jobs || [];
    const [showJobForm, setShowJobForm] = useState(false);
    const [selectedProgram, setSelectedProgram] = useState<AidProgram | null>(null);
    const [isSubmittingJob, setIsSubmittingJob] = useState(false);
    const [jobForm, setJobForm] = useState({ name: '', req: '', dist: '', area: '', phone: '', priority: 'Medium', tools: '', pax: '' });

    const { user } = useAuth();

    // Lock background scroll when modal is open and pre-fill name
    useEffect(() => {
        if (showJobForm || selectedProgram) {
            document.body.style.overflow = 'hidden';
            if (showJobForm && !jobForm.name && user?.user_metadata?.full_name) {
                setJobForm(prev => ({ ...prev, name: user.user_metadata.full_name }));
            }
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [showJobForm, selectedProgram, user]);
    const [chatJobName, setChatJobName] = useState<string | null>(null);

    const handleAcceptJob = async (jobId: string) => {
        try {
            const res = await fetch('/api/bencana/jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'accept', jobId }),
            });
            const data = await res.json();
            if (data.success) {
                mutateLocalJobs({ ...localJobsData, jobs: localJobs.map(j => j.id === jobId ? { ...j, status: 'accepted' } : j) }, false);
                showToast('Job Accepted', `You have accepted to help: ${localJobs.find(j => j.id === jobId)?.name}`);
            }
        } catch {
            alert('Failed to accept job. Try again.');
        }
    };

    const handleCancelJob = async (jobId: string) => {
        if (!confirm(t('bencana.cancel_confirm'))) return;
        try {
            const res = await fetch('/api/bencana/jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'cancel', jobId }),
            });
            const data = await res.json();
            if (data.success) {
                mutateLocalJobs({ ...localJobsData, jobs: localJobs.filter(j => j.id !== jobId) }, false);
            }
        } catch {
            alert('Failed to cancel request. Try again.');
        }
    };

    const handleSubmitJob = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!jobForm.name || !jobForm.req) return;
        setIsSubmittingJob(true);
        try {
            const res = await fetch('/api/bencana/jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'submit', ...jobForm }),
            });
            const data = await res.json();
            if (data.success) {
                mutateLocalJobs({ ...localJobsData, jobs: [data.job, ...localJobs] }, false);
                setShowJobForm(false);
                setJobForm({ name: '', req: '', dist: '', area: '', phone: '', priority: 'Medium', tools: '', pax: '' });
                showToast('Request Submitted', 'Your SOS request has been posted to the community.');
            }
        } catch {
            alert('Failed to submit request. Try again.');
        } finally {
            setIsSubmittingJob(false);
        }
    };

    const priorityColor = (p: string) => {
        if (p === 'High') return 'text-red-400 bg-red-500/10 border-red-500/20';
        if (p === 'Medium') return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
        return 'text-zinc-400 bg-zinc-800/50 border-zinc-700/50';
    };


    const typeColors: Record<string, string> = {
        government: 'bg-blue-500/15 text-blue-300 border-blue-400/30 shadow-[0_0_12px_rgba(59,130,246,0.15)]',
        ngo: 'bg-purple-500/15 text-purple-300 border-purple-400/30 shadow-[0_0_12px_rgba(168,85,247,0.15)]',
        zakat: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30 shadow-[0_0_12px_rgba(16,185,129,0.15)]',
        community: 'bg-amber-500/15 text-amber-300 border-amber-400/30 shadow-[0_0_12px_rgba(245,158,11,0.15)]',
    };

    const urgencyStyles: Record<string, { bg: string; text: string; label: string }> = {
        high: { bg: 'var(--danger-muted)', text: 'var(--danger)', label: ' Urgent' },
        medium: { bg: 'rgba(217,119,6,0.08)', text: 'var(--warning)', label: ' Active' },
        low: { bg: 'var(--success-muted)', text: 'var(--success)', label: ' Open' },
    };

    const categoryIcons: Record<string, string> = {
        disaster_relief: '',
        education: '',
        environment: '',
        healthcare: '',
        community: '',
        elderly_care: '',
        animal_welfare: '',
        youth: '',
    };

    const filteredPrograms = aidPrograms
        .filter(a => {
            const matchesType = filterType === 'all' || a.type === filterType;
            const matchesLoc = filterLocation === 'all' || a.location.toLowerCase().includes(filterLocation.toLowerCase());
            const matchObj = matchResults[a.id];
            const matchesElig = filterEligStatus === 'all'
                ? true
                : filterEligStatus === 'eligible'
                ? matchObj?.isEligible === true
                : filterEligStatus === 'maybe'
                ? matchObj?.isEligible === 'maybe'
                : matchObj?.isEligible === false;

            const q = debouncedSearchQuery.trim().toLowerCase();
            const matchesSearch = q === '' ||
                a.name.toLowerCase().includes(q) ||
                a.provider?.toLowerCase().includes(q) ||
                a.description.toLowerCase().includes(q) ||
                a.eligibility.toLowerCase().includes(q);

            return matchesType && matchesLoc && matchesElig && matchesSearch;
        })
        .sort((a, b) => {
            if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
            if (sortBy === 'name_desc') return b.name.localeCompare(a.name);
            if (sortBy === 'provider_asc') return a.provider.localeCompare(b.provider);
            if (sortBy === 'provider_desc') return b.provider.localeCompare(a.provider);
            if (sortBy === 'match_desc') {
                const scoreA = (matchResults[a.id] as any)?.matchScore ?? ((matchResults[a.id] as any)?.isEligible === true ? 100 : 0);
                const scoreB = (matchResults[b.id] as any)?.matchScore ?? ((matchResults[b.id] as any)?.isEligible === true ? 100 : 0);
                return scoreB - scoreA;
            }
            if (sortBy === 'match_asc') {
                const scoreA = (matchResults[a.id] as any)?.matchScore ?? ((matchResults[a.id] as any)?.isEligible === true ? 100 : 0);
                const scoreB = (matchResults[b.id] as any)?.matchScore ?? ((matchResults[b.id] as any)?.isEligible === true ? 100 : 0);
                return scoreA - scoreB;
            }
            return 0;
        });

    const filteredVolunteers = volOpportunities.filter(v =>
        (volFilterCategory === 'all' || v.category === volFilterCategory) &&
        (debouncedVolSearchQuery.trim() === '' ||
            v.title.toLowerCase().includes(debouncedVolSearchQuery.toLowerCase()) ||
            v.organization.toLowerCase().includes(debouncedVolSearchQuery.toLowerCase()) ||
            v.location.toLowerCase().includes(debouncedVolSearchQuery.toLowerCase()))
    );

    const openUrl = (url?: string) => {
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
    };

    const handleAIMatch = (e: React.FormEvent) => {
        e.preventDefault();
        setIsMatching(true);
        try {
            const results = evaluateAllEligibility(profile, aidPrograms);
            setMatchResults(results as any);
            setShowAIMatcher(false);
            showToast('Semakan Selesai', 'Kelayakan bantuan anda telah dikemas kini serta-merta.');
        } catch {
            alert('Gagal menyemak kelayakan. Sila cuba lagi.');
        } finally {
            setIsMatching(false);
        }
    };

    return (
        <div className="p-6 h-full flex flex-col relative z-0">
            {/* Global Toast for Bantuan */}
            <AnimatePresence>
                {toastMessage && (
                    <motion.div initial={{ opacity: 0, y: -20, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: -20, x: '-50%' }}
                        className="fixed top-6 left-1/2 z-[9999] bg-[#10B981]/10 border border-[#10B981]/30 backdrop-blur-md px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 min-w-[300px]"
                    >
                        <CheckCircle className="w-5 h-5 text-[#10B981]" />
                        <div>
                            <p className="text-sm font-bold text-white">{toastMessage.title}</p>
                            <p className="text-[10px] text-zinc-300">{toastMessage.desc}</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {showJobForm && typeof document !== 'undefined' && createPortal(
                <AnimatePresence>
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
                        onClick={(e) => e.target === e.currentTarget && setShowJobForm(false)}
                    >
                        <motion.div
                            initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
                            className="rounded-3xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
                            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('bencana.request_volunteers')}</h3>
                                <button onClick={() => setShowJobForm(false)} className="p-2" style={{ color: 'var(--text-muted)' }}><X className="w-5 h-5" /></button>
                            </div>
                            <form onSubmit={handleSubmitJob} className="space-y-4">
                                {[
                                    { key: 'name', placeholder: 'e.g. Keluarga Ibrahim', label: t('bencana.household'), required: true, defaultValue: user?.user_metadata?.full_name || '' },
                                    { key: 'phone', placeholder: 'e.g. 012-3456789', label: 'Phone Number (Compulsory)', required: true },
                                    { key: 'req', placeholder: 'e.g. Mud cleanup, furniture moving', label: t('bencana.help_needed'), required: true },
                                    { key: 'dist', placeholder: 'e.g. 500m from main road', label: t('bencana.distance'), required: false },
                                    { key: 'area', placeholder: 'e.g. Taman Sri Putra, Kota Bharu', label: t('bencana.area'), required: false },
                                    { key: 'tools', placeholder: 'e.g. Chainsaw, Boots, Ropes (Optional)', label: 'Tools Needed (Optional)', required: false },
                                    { key: 'pax', placeholder: 'e.g. 5', label: 'Volunteers Needed (Optional)', required: false },
                                ].map(f => (
                                    <div key={f.key}>
                                        <label className="text-[9px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--text-muted)' }}>{f.label}</label>
                                        <input
                                            type={f.key === 'pax' ? 'number' : 'text'}
                                            value={(jobForm as any)[f.key] || f.defaultValue || ''}
                                            onChange={e => setJobForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                                            placeholder={f.placeholder}
                                            required={f.required}
                                            className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-colors"
                                            style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                                        />
                                    </div>
                                ))}

                                <div>
                                    <label className="text-[9px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Priority Level</label>
                                    <select
                                        value={jobForm.priority}
                                        onChange={e => setJobForm(prev => ({ ...prev, priority: e.target.value }))}
                                        className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-colors appearance-none"
                                        style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                                    >
                                        <option value="Low">Low (Non-urgent cleanup)</option>
                                        <option value="Medium">Medium (Needs help soon)</option>
                                        <option value="High">High (Urgent assistance required)</option>
                                        <option value="Critical">Critical (Immediate danger/rescue)</option>
                                    </select>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSubmittingJob}
                                    className="w-full mt-4 flex items-center justify-center gap-2 py-4 rounded-xl font-bold uppercase tracking-widest text-xs transition-all active:scale-95 disabled:opacity-50"
                                    style={{ background: 'var(--accent)', color: 'var(--text-on-accent)' }}
                                >
                                    {isSubmittingJob ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Plus className="w-5 h-5" /> Submit Request</>}
                                </button>
                            </form>
                        </motion.div>
                    </motion.div>
                </AnimatePresence>
                , document.body)}

            {/* Volunteer Chat Overlay */}
            <AnimatePresence>
                {chatJobName && <VolunteerChat jobName={chatJobName} onClose={() => setChatJobName(null)} />}
            </AnimatePresence>

            {/* === STANDARDIZED HEADER === */}
            <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3"
            >
                <div>
                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            📍 {locationName && !locationName.toLowerCase().includes('singapore') ? locationName : 'Kota Bharu, Kelantan'}
                        </span>
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight text-white font-serif">Bantuan & Sukarelawan</h2>
                    <p className="text-xs font-medium text-zinc-400 mt-0.5">
                        Cari program bantuan kewangan dan peluang sukarelawan di Kelantan.
                    </p>
                </div>
            </motion.div>

            {/* Quick Stats */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
                className="grid grid-cols-3 gap-3 mb-6"
            >
                <div className="rounded-2xl p-4 text-center" style={{ background: 'var(--success-light)', border: '1px solid var(--border-default)' }}>
                    <Package className="w-4 h-4 mx-auto mb-2" style={{ color: 'var(--success)' }} />
                    <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{aidPrograms.filter(a => a.status === 'active').length}</p>
                    <p className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>{t('bantuan.active_aid')}</p>
                </div>
                <div className="rounded-2xl p-4 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                    <Globe className="w-4 h-4 mx-auto mb-2" style={{ color: 'var(--accent)' }} />
                    <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{volOpportunities.length}</p>
                    <p className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>{t('bantuan.volunteer')}</p>
                </div>
                <div className="rounded-2xl p-4 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                    <HandHeart className="w-4 h-4 mx-auto mb-2" style={{ color: 'var(--warning)' }} />
                    <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{volOpportunities.reduce((sum, v) => sum + (v.spots || 0), 0)}</p>
                    <p className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>{t('bantuan.open_spots')}</p>
                </div>
            </motion.div>

            {/* Standardized Tab Toggle */}
            <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="flex p-1.5 rounded-2xl mb-6 bg-[#0D0D10] border border-zinc-800/80 shadow-xl"
            >
                <button
                    onClick={() => setActiveTab('programs')}
                    className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all border ${
                        activeTab === 'programs'
                            ? 'bg-zinc-800 border-zinc-600 text-white shadow-md'
                            : 'bg-transparent border-transparent text-zinc-400 hover:text-zinc-200'
                    }`}
                >Program Bantuan</button>
                <button
                    onClick={() => setActiveTab('volunteer')}
                    className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all border ${
                        activeTab === 'volunteer'
                            ? 'bg-zinc-800 border-zinc-600 text-white shadow-md'
                            : 'bg-transparent border-transparent text-zinc-400 hover:text-zinc-200'
                    }`}
                >Sukarelawan</button>
            </motion.div>

            <div className="flex-1 min-h-0 overflow-y-auto pb-6 relative">
                <AnimatePresence mode="wait">
                    {activeTab === 'programs' ? (
                        <motion.div
                            key="programs"
                            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }}
                            className="space-y-4"
                        >
                            {/* Multi-Factor Search & Filter Controls */}
                            <div className="space-y-3 mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="relative flex-1 group">
                                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                                            <Search className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                                        </div>
                                        <input
                                            type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                            placeholder={t('bantuan.search_aid')}
                                            className="w-full pl-11 pr-4 py-3 rounded-xl text-sm outline-none transition-colors"
                                            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                                        />
                                    </div>

                                    {/* Sort Dropdown */}
                                    <div className="relative shrink-0">
                                        <Filter className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--accent)' }} />
                                        <select
                                            value={sortBy}
                                            onChange={e => setSortBy(e.target.value as any)}
                                            className="appearance-none pl-9 pr-8 py-3 rounded-2xl text-xs font-bold outline-none cursor-pointer border transition-all"
                                            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                        >
                                            <option value="default">Default</option>
                                            <option value="name_asc">Nama (A - Z)</option>
                                            <option value="name_desc">Nama (Z - A)</option>
                                            <option value="provider_asc">Agensi (A - Z)</option>
                                            <option value="provider_desc">Agensi (Z - A)</option>
                                            {Object.keys(matchResults).length > 0 && (
                                                <>
                                                    <option value="match_desc">Skor Kelayakan (Tertinggi)</option>
                                                    <option value="match_asc">Skor Kelayakan (Terendah)</option>
                                                </>
                                            )}
                                        </select>
                                        <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                                    </div>
                                </div>

                                {/* Bigger Program Category Type Chips */}
                                <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-3 px-3 -mx-3">
                                    {[
                                        {
                                            id: 'all',
                                            label: 'Semua',
                                            icon: Globe,
                                            activeStyle: { background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.22) 0%, rgba(245, 158, 11, 0.16) 100%)', color: '#FCD34D', borderColor: '#F59E0B', boxShadow: '0 4px 16px rgba(245, 158, 11, 0.25)' },
                                            inactiveStyle: { background: 'var(--bg-card)', color: 'var(--text-muted)', borderColor: 'var(--border-default)' }
                                        },
                                        {
                                            id: 'government',
                                            label: 'Kerajaan',
                                            icon: Landmark,
                                            activeStyle: { background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.22) 0%, rgba(37, 99, 235, 0.16) 100%)', color: '#93C5FD', borderColor: '#3B82F6', boxShadow: '0 4px 16px rgba(59, 130, 246, 0.25)' },
                                            inactiveStyle: { background: 'var(--bg-card)', color: 'var(--text-muted)', borderColor: 'var(--border-default)' }
                                        },
                                        {
                                            id: 'ngo',
                                            label: 'NGO',
                                            icon: HandHeart,
                                            activeStyle: { background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.22) 0%, rgba(147, 51, 234, 0.16) 100%)', color: '#E9D5FF', borderColor: '#A855F7', boxShadow: '0 4px 16px rgba(168, 85, 247, 0.25)' },
                                            inactiveStyle: { background: 'var(--bg-card)', color: 'var(--text-muted)', borderColor: 'var(--border-default)' }
                                        },
                                        {
                                            id: 'zakat',
                                            label: 'Zakat',
                                            icon: Building,
                                            activeStyle: { background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.22) 0%, rgba(5, 150, 105, 0.16) 100%)', color: '#A7F3D0', borderColor: '#10B981', boxShadow: '0 4px 16px rgba(16, 185, 129, 0.25)' },
                                            inactiveStyle: { background: 'var(--bg-card)', color: 'var(--text-muted)', borderColor: 'var(--border-default)' }
                                        }
                                    ].map(cat => {
                                        const isActive = filterType === cat.id;
                                        const IconComp = cat.icon;
                                        return (
                                            <button
                                                key={cat.id}
                                                onClick={() => setFilterType(cat.id as any)}
                                                className="flex items-center gap-3 px-6 py-3.5 rounded-2xl text-base font-extrabold transition-all duration-300 shrink-0 border hover:-translate-y-1 hover:brightness-110 active:scale-95 shadow-md"
                                                style={isActive ? cat.activeStyle : cat.inactiveStyle}
                                            >
                                                <IconComp className="w-5 h-5" />
                                                <span>{cat.label}</span>
                                            </button>
                                        );
                                    })}

                                    {/* Match Filter (If Evaluated) */}
                                    {Object.keys(matchResults).length > 0 && (
                                        <>
                                            <div className="w-[1px] h-8 bg-zinc-800 shrink-0 mx-1" />
                                            <button
                                                onClick={() => setFilterEligStatus(prev => prev === 'eligible' ? 'all' : 'eligible')}
                                                className="flex items-center gap-3 px-6 py-3.5 rounded-2xl text-base font-extrabold transition-all duration-300 shrink-0 border hover:-translate-y-1 hover:brightness-110 active:scale-95 shadow-md"
                                                style={filterEligStatus === 'eligible'
                                                    ? { background: '#064E3B', color: '#A7F3D0', borderColor: '#10B981', boxShadow: '0 4px 16px rgba(16, 185, 129, 0.25)' }
                                                    : { background: 'var(--bg-card)', color: 'var(--text-muted)', borderColor: 'var(--border-default)' }
                                                }
                                            >
                                                <CheckCircle className="w-5 h-5" />
                                                <span>Layak Sahaja</span>
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {programsLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-7 h-7 animate-spin" style={{ color: 'var(--text-muted)' }} />
                                </div>
                            ) : filteredPrograms.length === 0 ? (
                                <div className="text-center py-12 rounded-2xl" style={{ color: 'var(--text-muted)', border: '1px dashed var(--border-default)' }}>
                                    <p className="text-sm font-medium">{t('bantuan.no_aid')}</p>
                                </div>
                            ) : (
                                <>
                                    {/* Instant Eligibility Matcher Card - Hardware Accelerated 60FPS */}
                                    {Object.keys(matchResults).length === 0 && (
                                        <div className="mb-4">
                                            {/* Compact CTA Banner */}
                                            <AnimatePresence initial={false} mode="wait">
                                                {!showAIMatcher && (
                                                    <motion.div
                                                        key="cta-banner"
                                                        initial={{ opacity: 0, height: 0, scale: 0.98 }}
                                                        animate={{ opacity: 1, height: 'auto', scale: 1 }}
                                                        exit={{ opacity: 0, height: 0, scale: 0.98 }}
                                                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                                                        className="overflow-hidden transform-gpu will-change-transform"
                                                    >
                                                        <div
                                                            onClick={() => setShowAIMatcher(true)}
                                                            className="p-4 rounded-2xl flex items-center justify-between shadow-sm cursor-pointer group hover:border-[#C5A367]/60 transition-colors"
                                                            style={{
                                                                background: 'linear-gradient(135deg, var(--accent-muted) 0%, rgba(197, 163, 103, 0.05) 100%)',
                                                                border: '1px solid var(--accent)'
                                                            }}
                                                        >
                                                            <div>
                                                                <h4 className="text-sm font-bold flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                                                                    <Search className="w-4 h-4 text-[#C5A367]" />
                                                                    <span>Semak Kelayakan</span>
                                                                </h4>
                                                                <p className="text-[10px] mt-1" style={{ color: 'var(--text-secondary)' }}>
                                                                    Semak bantuan yang anda layak secara serta-merta.
                                                                </p>
                                                            </div>
                                                            <motion.button
                                                                whileHover={{ scale: 1.05 }}
                                                                whileTap={{ scale: 0.95 }}
                                                                onClick={(e) => { e.stopPropagation(); setShowAIMatcher(true); }}
                                                                className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-[#C5A367] text-white shadow-sm shrink-0 hover:bg-[#b59357] transition-colors"
                                                            >
                                                                Semak Sekarang
                                                            </motion.button>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>

                                            {/* Expanded Form Drawer */}
                                            <AnimatePresence initial={false} mode="wait">
                                                {showAIMatcher && (
                                                    <motion.div
                                                        key="form-drawer"
                                                        initial={{ opacity: 0, height: 0, scale: 0.98 }}
                                                        animate={{ opacity: 1, height: 'auto', scale: 1 }}
                                                        exit={{ opacity: 0, height: 0, scale: 0.98 }}
                                                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                                                        className="overflow-hidden transform-gpu will-change-transform"
                                                    >
                                                        <div className="p-4 rounded-2xl shadow-md space-y-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--accent)' }}>
                                                            <div className="flex justify-between items-center mb-3">
                                                                <h4 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                                                    <span>Maklumat Diri</span>
                                                                </h4>
                                                                <motion.button
                                                                    whileHover={{ scale: 1.15, rotate: 90 }}
                                                                    whileTap={{ scale: 0.85 }}
                                                                    onClick={() => setShowAIMatcher(false)}
                                                                    className="p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                                                                >
                                                                    <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                                                                </motion.button>
                                                            </div>
                                                            <form onSubmit={handleAIMatch} className="space-y-3">
                                                                <div className="grid grid-cols-2 gap-3">
                                                                    <div>
                                                                        <label className="text-[9px] font-bold uppercase tracking-widest block mb-1">{t('bantuan.age')}</label>
                                                                        <input type="number" required placeholder="e.g. 28" value={profile.age} onChange={e => setProfile({ ...profile, age: e.target.value })} className="w-full rounded-xl px-3 py-2 text-xs outline-none" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-[9px] font-bold uppercase tracking-widest block mb-1">Pendapatan Sebulan (RM)</label>
                                                                        <input type="number" required placeholder="e.g. 2500" value={profile.income} onChange={e => setProfile({ ...profile, income: e.target.value })} className="w-full rounded-xl px-3 py-2 text-xs outline-none" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
                                                                        <span className="text-[8px] opacity-75 block mt-0.5" style={{ color: 'var(--text-muted)' }}>*Jumlah pendapatan kasar sebulan</span>
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-[9px] font-bold uppercase tracking-widest block mb-1">{t('bantuan.status')}</label>
                                                                        <select value={profile.status} onChange={e => setProfile({ ...profile, status: e.target.value })} className="w-full rounded-xl px-3 py-2 text-xs outline-none" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}>
                                                                            <option value="Bekerja">{t('bantuan.status_work')}</option>
                                                                            <option value="Penganggur">{t('bantuan.status_nowork')}</option>
                                                                            <option value="Pelajar">{t('bantuan.status_student')}</option>
                                                                            <option value="Pesara">{t('bantuan.status_retiree')}</option>
                                                                            <option value="OKU">OKU (Orang Kurang Upaya)</option>
                                                                            <option value="Suri Rumah">Suri Rumah / Ibu Tunggal</option>
                                                                        </select>
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-[9px] font-bold uppercase tracking-widest block mb-1">{t('bantuan.dependents')}</label>
                                                                        <input type="number" placeholder="e.g. 2" value={profile.dependents} onChange={e => setProfile({ ...profile, dependents: e.target.value })} className="w-full rounded-xl px-3 py-2 text-xs outline-none" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    type="submit"
                                                                    disabled={isMatching}
                                                                    className="w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 mt-2"
                                                                    style={{ background: 'var(--accent)', color: 'var(--text-on-accent)' }}
                                                                >
                                                                    {isMatching ? <><Loader2 className="w-4 h-4 animate-spin" /> Menyemak...</> : 'Semak Kelayakan'}
                                                                </button>
                                                            </form>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    )}

                                    {/* Active Match Status Banner */}
                                    {Object.keys(matchResults).length > 0 && !showAIMatcher && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="mb-5 p-3.5 rounded-2xl flex items-center justify-between gap-3 border shadow-sm"
                                            style={{
                                                background: 'var(--bg-card)',
                                                borderColor: 'var(--accent)',
                                                boxShadow: '0 4px 16px rgba(197, 163, 103, 0.08)'
                                            }}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--accent-muted)' }}>
                                                    <CheckCircle className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Keputusan Kelayakan Aktif</span>
                                                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                                                            {Object.values(matchResults).filter((m: any) => m.isEligible).length} Layak
                                                        </span>
                                                    </div>
                                                    <p className="text-[10px] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                                        Berdasarkan profil: RM{profile.income || 0}/bln · Umur {profile.age || '-'} · {profile.status}
                                                    </p>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => setMatchResults({})}
                                                className="px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border shrink-0 hover:bg-red-500/10"
                                                style={{ color: 'var(--danger)', borderColor: 'var(--danger-muted)' }}
                                            >
                                                Padam Keputusan
                                            </button>
                                        </motion.div>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {filteredPrograms.map((aid, i) => {
                                            const match = matchResults[aid.id] as any;
                                            return (
                                                <motion.div
                                                    key={aid.id}
                                                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                                                    onClick={() => setSelectedProgram(aid)}
                                                    className="rounded-2xl p-5 transition-all duration-300 shadow-sm group hover:-translate-y-0.5 relative flex flex-col justify-between cursor-pointer"
                                                    style={{
                                                        background: 'var(--bg-card)',
                                                        border: '1px solid var(--border-default)',
                                                    }}
                                                >
                                                    <div>
                                                        <div className="flex items-start justify-between mb-3">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border ${typeColors[aid.type]}`}>{aid.type}</span>
                                                                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg"
                                                                    style={{ background: aid.status === 'active' ? 'var(--success-muted)' : 'var(--accent-muted)', color: aid.status === 'active' ? 'var(--success)' : 'var(--accent)' }}
                                                                >{aid.status}</span>
                                                            </div>
                                                            <div className="w-7 h-7 rounded-lg flex items-center justify-center transition-all bg-white/5 group-hover:bg-[#C5A367] group-hover:text-black">
                                                                <ExternalLink className="w-3.5 h-3.5" />
                                                            </div>
                                                        </div>

                                                        <h3 className="text-base font-bold mb-2 group-hover:text-amber-300 transition-colors" style={{ color: 'var(--text-primary)' }}>{aid.name}</h3>

                                                        {/* AI Match Badge */}
                                                        {match && (
                                                            <div className={`mb-3 p-2.5 rounded-xl border ${match.isEligible === true ? 'bg-green-500/10 border-green-500/20' : match.isEligible === false ? 'bg-red-500/10 border-red-500/20' : 'bg-orange-500/10 border-orange-500/20'}`}>
                                                                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: match.isEligible === true ? '#10B981' : match.isEligible === false ? '#EF4444' : '#F59E0B' }}>
                                                                    <span>{match.isEligible === true ? ' LAYAK' : match.isEligible === false ? ' TIDAK LAYAK' : ' MUNGKIN LAYAK'}</span>
                                                                    {match.matchScore != null && (
                                                                        <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-amber-400">
                                                                            {match.matchScore}% Match
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>{match.reason}</p>
                                                                {match.matchedCriteria && match.matchedCriteria.length > 0 && (
                                                                    <div className="flex flex-wrap gap-1 mt-2">
                                                                        {match.matchedCriteria.map((c: string, ci: number) => (
                                                                            <span key={ci} className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                                                                                 {c}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        <p className="text-xs leading-relaxed mb-4 text-zinc-300 line-clamp-3" style={{ color: 'var(--text-secondary)' }}>{aid.description}</p>
                                                    </div>

                                                    <div>
                                                        <div className="space-y-1.5 pt-3 mb-3" style={{ borderTop: '1px solid var(--border-default)' }}>
                                                            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                                                                <MapPin className="w-3.5 h-3.5 shrink-0 opacity-70" /> <span>{aid.location}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                                                                <Users className="w-3.5 h-3.5 shrink-0 opacity-70" /> <span className="truncate">{aid.eligibility}</span>
                                                            </div>
                                                            {aid.deadline && (
                                                                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                                                                    <Clock className="w-3.5 h-3.5 shrink-0 opacity-70" /> <span>{aid.deadline}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center justify-between pt-2">
                                                            <p className="text-[10px] font-medium opacity-80 truncate max-w-[150px]" style={{ color: 'var(--text-muted)' }}>{t('bantuan.provider')} <span className="font-semibold text-zinc-200">{aid.provider}</span></p>
                                                            <span className="text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 shadow-sm border border-[#C5A367]/30 bg-[#C5A367]/10 text-[#C5A367] group-hover:bg-[#C5A367] group-hover:text-black">
                                                                Lihat Butiran 
                                                            </span>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="volunteer"
                            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}
                            className="space-y-4"
                        >
                            {/* --- SECTION 1: URGENT LOCAL SOS --- */}
                            <div className="mb-8">
                                <div className="flex items-center justify-between mb-4">
                                    <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Bantuan Komuniti (SOS)</p>
                                    <button
                                        onClick={() => setShowJobForm(true)}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest active:scale-95 transition-all"
                                        style={{ background: 'var(--danger-muted)', color: 'var(--danger)', border: '1px solid var(--danger)' }}
                                    >
                                        <Plus className="w-3 h-3" /> Mohon Bantuan
                                    </button>
                                </div>

                                {localJobsLoading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
                                    </div>
                                ) : localJobs.length === 0 ? (
                                    <div className="text-center py-8 rounded-3xl text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', border: '1px dashed var(--border-default)' }}>
                                        {t('vol.no_sos')}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {localJobs.map((job) => (
                                            <div
                                                key={job.id}
                                                className="p-4 rounded-2xl border transition-all"
                                                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{job.name}</h4>
                                                        <div className="flex items-center gap-2 text-[9px] font-bold tracking-widest uppercase mb-2 flex-wrap">
                                                            <span className="flex items-center gap-1.5 px-2 py-1 rounded" style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border-default)' }}>
                                                                <MapPin className="w-3.5 h-3.5" /> {job.dist}
                                                            </span>
                                                            <span style={{ color: 'var(--danger)' }}>{job.req}</span>
                                                        </div>
                                                        <span className={`text-[8px] px-2 py-1 rounded-md font-bold uppercase tracking-widest border ${priorityColor(job.priority)}`}>
                                                            {job.priority} Priority
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-2 ml-3 shrink-0">
                                                        {job.status === 'open' ? (
                                                            <>
                                                                <button
                                                                    onClick={() => handleAcceptJob(job.id)}
                                                                    className="px-4 py-2 rounded-xl text-[9px] font-bold tracking-widest uppercase transition-all shadow-lg active:scale-95"
                                                                    style={{ background: 'var(--accent-muted)', color: 'var(--accent)', border: '1px solid var(--border-default)' }}
                                                                >
                                                                    Accept<br />
                                                                    <span className="text-[8px] opacity-70 font-normal">+{job.bounty} pts</span>
                                                                </button>
                                                                <button
                                                                    onClick={() => handleCancelJob(job.id)}
                                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[8px] font-bold tracking-widest uppercase transition-all text-red-400/60 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20"
                                                                >
                                                                    <Trash2 className="w-3 h-3" /> Cancel
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <div className="flex flex-col items-end gap-2">
                                                                <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-xl" style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border-default)' }}>
                                                                    <CheckCircle className="w-3.5 h-3.5 opacity-70" /> Secured
                                                                </div>
                                                                <button onClick={() => setChatJobName(job.name)}
                                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[8px] font-bold tracking-widest uppercase transition-all"
                                                                    style={{ color: 'var(--accent)', border: '1px solid var(--border-default)' }}
                                                                >
                                                                    <MessageCircle className="w-3 h-3" /> Chat
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* --- SECTION 2: NATIONWIDE CAMPAIGNS --- */}
                            <div className="pt-2" style={{ borderTop: '1px solid var(--border-default)' }}>
                                {/* Header */}
                                <div className="flex items-center justify-between mb-3 mt-4">
                                    <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Misi Sukarelawan</p>
                                    <button
                                        onClick={() => mutateVolOpportunities()}
                                        className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg transition-all active:scale-95"
                                        style={{ background: 'var(--accent-muted)', color: 'var(--accent)', border: '1px solid var(--border-default)' }}
                                    >Kemas Kini</button>
                                </div>

                                {/* Volunteer Search */}
                                <div className="relative mb-2">
                                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                                        <Search className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                                    </div>
                                    <input
                                        type="text" value={volSearchQuery} onChange={e => setVolSearchQuery(e.target.value)}
                                        placeholder={t('vol.search')}
                                        className="w-full pl-11 pr-4 py-3 rounded-xl text-sm outline-none transition-colors"
                                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                                    />
                                </div>

                                {/* Category filter pills */}
                                <div className="flex gap-2 flex-wrap mb-2 overflow-x-auto pb-1">
                                    {[
                                        { key: 'all', label: t('vol.cat_all') },
                                        { key: 'disaster_relief', label: t('vol.cat_disaster') },
                                        { key: 'education', label: t('vol.cat_edu') },
                                        { key: 'environment', label: t('vol.cat_env') },
                                        { key: 'healthcare', label: t('vol.cat_health') },
                                        { key: 'community', label: t('vol.cat_comm') },
                                        { key: 'elderly_care', label: t('vol.cat_elderly') },
                                        { key: 'youth', label: t('vol.cat_youth') },
                                    ].map(c => (
                                        <button key={c.key} onClick={() => setVolFilterCategory(c.key)}
                                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap shrink-0"
                                            style={volFilterCategory === c.key
                                                ? { background: 'var(--accent-muted)', color: 'var(--accent)', border: '1px solid var(--accent)' }
                                                : { color: 'var(--text-muted)', border: '1px solid var(--border-default)' }
                                            }
                                        >{c.label}</button>
                                    ))}
                                </div>

                                {volLoading ? (
                                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                                        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent)' }} />
                                        <p className="text-xs font-medium animate-pulse" style={{ color: 'var(--text-muted)' }}>{t('vol.finding')}</p>
                                    </div>
                                ) : filteredVolunteers.length === 0 ? (
                                    <div className="text-center py-12 rounded-2xl" style={{ border: '1px dashed var(--border-default)' }}>
                                        <Briefcase className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                                        <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{t('vol.no_match')}</p>
                                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t('vol.try_diff')}</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {filteredVolunteers.map((vol, i) => {
                                            const urgency = urgencyStyles[vol.urgency] || urgencyStyles.medium;
                                            const catIcon = categoryIcons[vol.category] || '';
                                            return (
                                                <motion.div
                                                    key={vol.id}
                                                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                                                    onClick={() => openUrl(vol.url)}
                                                    className="p-4 rounded-2xl transition-all group cursor-pointer hover:shadow-md"
                                                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
                                                >
                                                    {/* Top row: category + urgency */}
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-lg">{catIcon}</span>
                                                            <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md"
                                                                style={{ background: urgency.bg, color: urgency.text }}
                                                            >{urgency.label}</span>
                                                        </div>
                                                        <ExternalLink className="w-4 h-4 opacity-30 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--accent)' }} />
                                                    </div>

                                                    {/* Title + org */}
                                                    <h4 className="text-sm font-bold mb-1 group-hover:underline decoration-1 underline-offset-2" style={{ color: 'var(--text-primary)' }}>{vol.title}</h4>
                                                    <p className="text-xs font-semibold mb-2" style={{ color: 'var(--accent)' }}>{vol.organization}</p>
                                                    <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>{vol.description}</p>

                                                    {/* Meta row */}
                                                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-2" style={{ borderTop: '1px solid var(--border-default)' }}>
                                                        <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                                            <MapPin className="w-3 h-3" /> {vol.location}
                                                        </span>
                                                        <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                                            <Clock className="w-3 h-3" /> {vol.commitment}
                                                        </span>
                                                        <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                                            <UserCheck className="w-3 h-3" /> {vol.spots} {t('vol.spots')}
                                                        </span>
                                                        <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                                            <Calendar className="w-3 h-3" /> {vol.startDate}
                                                        </span>
                                                    </div>

                                                    {/* CTA */}
                                                    <div className="flex items-center justify-between mt-3">
                                                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{vol.url?.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
                                                        <span className="text-[11px] font-bold px-3 py-1 rounded-lg transition-all group-hover:shadow-sm"
                                                            style={{ background: 'var(--accent)', color: 'var(--text-on-accent)' }}
                                                        >
                                                            {t('vol.signup')}
                                                        </span>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Browse Portals Section */}
                                {volPortals.length > 0 && (
                                    <div className="mt-6 pt-4" style={{ borderTop: '1px solid var(--border-default)' }}>
                                        <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>{t('vol.browse')}</p>
                                        <p className="text-[11px] mb-3" style={{ color: 'var(--text-secondary)' }}>{t('vol.visit_portals')}</p>
                                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                            {volPortals.map(p => (
                                                <motion.a
                                                    key={p.id}
                                                    href={p.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    whileTap={{ scale: 0.97 }}
                                                    className="p-3 rounded-xl text-center transition-all hover:shadow-sm"
                                                    style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}
                                                >
                                                    <p className="text-xs font-bold mb-0.5" style={{ color: 'var(--text-primary)' }}>{p.organization}</p>
                                                    <p className="text-[9px]" style={{ color: 'var(--accent)' }}>{p.url.replace(/^https?:\/\//, '').replace(/\/$/, '').slice(0, 30)}</p>
                                                </motion.a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

            </div>

            {/* Detailed Bantuan Program Modal Popup */}
            {selectedProgram && typeof document !== 'undefined' && createPortal(
                <AnimatePresence>
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
                        onClick={(e) => e.target === e.currentTarget && setSelectedProgram(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="rounded-3xl p-6 sm:p-8 w-full max-w-2xl shadow-2xl max-h-[85vh] overflow-y-auto flex flex-col justify-between"
                            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
                        >
                            <div>
                                {/* Header Badges & Close Button */}
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-xl border ${typeColors[selectedProgram.type]}`}>
                                            {selectedProgram.type}
                                        </span>
                                        <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-xl"
                                            style={{ background: selectedProgram.status === 'active' ? 'var(--success-muted)' : 'var(--accent-muted)', color: selectedProgram.status === 'active' ? 'var(--success)' : 'var(--accent)' }}
                                        >
                                            {selectedProgram.status}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => setSelectedProgram(null)}
                                        className="p-2 rounded-xl hover:bg-white/10 transition-colors"
                                        style={{ color: 'var(--text-muted)' }}
                                    >
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>

                                {/* Title & Provider */}
                                <h3 className="text-2xl font-bold mb-2 leading-snug" style={{ color: 'var(--text-primary)' }}>
                                    {selectedProgram.name}
                                </h3>
                                <p className="text-xs font-semibold mb-6 opacity-80" style={{ color: 'var(--text-muted)' }}>
                                    Dianjurkan oleh <span className="font-bold text-zinc-100">{selectedProgram.provider}</span>
                                </p>

                                {/* AI Match Status (If Available) */}
                                {matchResults[selectedProgram.id] && (() => {
                                    const selectedMatch = matchResults[selectedProgram.id] as any;
                                    return (
                                        <div className={`mb-6 p-4 rounded-2xl border ${selectedMatch.isEligible === true ? 'bg-green-500/10 border-green-500/20' : selectedMatch.isEligible === false ? 'bg-red-500/10 border-red-500/20' : 'bg-orange-500/10 border-orange-500/20'}`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest" style={{ color: selectedMatch.isEligible === true ? '#10B981' : selectedMatch.isEligible === false ? '#EF4444' : '#F59E0B' }}>
                                                    {selectedMatch.isEligible === true ? <CheckCircle className="w-4 h-4" /> : selectedMatch.isEligible === false ? <X className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                                                    Status Kelayakan: {selectedMatch.isEligible === true ? 'LAYAK MEMOHON' : selectedMatch.isEligible === false ? 'TIDAK MEMENUHI SYARAT' : 'MUNGKIN LAYAK'}
                                                </div>
                                                {selectedMatch.matchScore != null && (
                                                    <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-zinc-800 text-amber-400 border border-amber-500/20">
                                                        {selectedMatch.matchScore}% Match
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs leading-relaxed font-medium" style={{ color: 'var(--text-primary)' }}>
                                                {selectedMatch.reason}
                                            </p>
                                            {selectedMatch.matchedCriteria && selectedMatch.matchedCriteria.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 mt-3">
                                                    {selectedMatch.matchedCriteria.map((c: string, ci: number) => (
                                                        <span key={ci} className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-medium">
                                                             {c}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}

                                {/* Detailed Content Sections */}
                                <div className="space-y-5">
                                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1.5">
                                        <h5 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                                            <Package className="w-4 h-4 text-amber-400" /> Keterangan Program
                                        </h5>
                                        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                                            {selectedProgram.description}
                                        </p>
                                    </div>

                                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1.5">
                                        <h5 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                                            <Users className="w-4 h-4 text-emerald-400" /> Syarat Kelayakan
                                        </h5>
                                        <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'var(--text-primary)' }}>
                                            {selectedProgram.eligibility}
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center gap-3">
                                            <MapPin className="w-5 h-5 text-blue-400 shrink-0" />
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Kawasan</p>
                                                <p className="text-xs font-bold text-zinc-100">{selectedProgram.location}</p>
                                            </div>
                                        </div>

                                        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center gap-3">
                                            <Clock className="w-5 h-5 text-purple-400 shrink-0" />
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Tarikh Tutup</p>
                                                <p className="text-xs font-bold text-zinc-100">{selectedProgram.deadline || 'Berterusan'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Action Button: Visit Web */}
                            <div className="pt-6 mt-6 border-t border-white/10 flex items-center justify-end gap-3">
                                <button
                                    onClick={() => setSelectedProgram(null)}
                                    className="px-5 py-3 rounded-2xl text-xs font-bold transition-all border border-white/10 hover:bg-white/5 text-zinc-300"
                                >
                                    Tutup
                                </button>
                                {selectedProgram.url && (
                                    <button
                                        onClick={() => openUrl(selectedProgram.url)}
                                        className="px-6 py-3 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg bg-[#C5A367] text-black hover:bg-[#d6b478] active:scale-95"
                                    >
                                        Layari Portal Rasmi ↗
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                </AnimatePresence>
                , document.body)}
        </div>
    );
}
