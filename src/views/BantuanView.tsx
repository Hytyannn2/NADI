'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Heart, MapPin, Loader2, Plus, X, Search, Phone, Clock, Users, Package, ChevronDown, CheckCircle, AlertTriangle, HandHeart, Briefcase, Trash2, ExternalLink, Globe, Calendar, UserCheck, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import VolunteerChat from '@/src/components/VolunteerChat';
import { useLanguage } from '@/src/context/LanguageContext';
import { useAuth } from '@/src/context/AuthContext';
import { useGame } from '@/src/context/GameContext';
import { useXP } from '@/src/hooks/useXP';

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
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<'programs' | 'volunteer'>('programs');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'government' | 'ngo' | 'zakat' | 'community'>('all');
    const [volFilterCategory, setVolFilterCategory] = useState<string>('all');

    // Real aid programs fetched from API
    const [aidPrograms, setAidPrograms] = useState<AidProgram[]>([]);
    const [programsLoading, setProgramsLoading] = useState(true);
    const [locationName, setLocationName] = useState('');

    // AI Matcher State
    const [showAIMatcher, setShowAIMatcher] = useState(false);
    const [isMatching, setIsMatching] = useState(false);
    const [profile, setProfile] = useState({ age: '', income: '', status: 'Bekerja', dependents: '0' });
    const [matchResults, setMatchResults] = useState<Record<string, { isEligible: boolean | 'maybe', reason: string }>>({});

    // Volunteer opportunities (nationwide from API)
    const [volOpportunities, setVolOpportunities] = useState<VolunteerOpportunity[]>([]);
    const [volPortals, setVolPortals] = useState<{id: string; title: string; organization: string; url: string; description: string}[]>([]);
    const [volLoading, setVolLoading] = useState(false);
    const [volSearchQuery, setVolSearchQuery] = useState('');

    // Local P2P SOS Volunteering
    const [localJobs, setLocalJobs] = useState<VolunteerJob[]>([]);
    const [localJobsLoading, setLocalJobsLoading] = useState(false);
    const [showJobForm, setShowJobForm] = useState(false);
    const [isSubmittingJob, setIsSubmittingJob] = useState(false);
    const [jobForm, setJobForm] = useState({ name: '', req: '', dist: '', area: '', phone: '', priority: 'Medium', tools: '', pax: '' });

    const { user } = useAuth();
    const { completeQuest } = useGame();
    const { addXp } = useXP();

    // Lock background scroll when modal is open and pre-fill name
    useEffect(() => {
        if (showJobForm) {
            document.body.style.overflow = 'hidden';
            if (!jobForm.name && user?.user_metadata?.full_name) {
                setJobForm(prev => ({ ...prev, name: user.user_metadata.full_name }));
            }
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [showJobForm, user]);
    const [chatJobName, setChatJobName] = useState<string | null>(null);

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
                    fetch('/api/bantuan/programs?lat=6.125&lng=102.238')
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

    useEffect(() => {
        if (activeTab === 'volunteer') {
            if (volOpportunities.length === 0) fetchVolunteerOpportunities();
            if (localJobs.length === 0) fetchLocalJobs();
        }
    }, [activeTab]);

    const fetchLocalJobs = async () => {
        setLocalJobsLoading(true);
        try {
            const res = await fetch('/api/bencana/jobs');
            const data = await res.json();
            if (data.success) setLocalJobs(data.jobs);
        } catch {}
        finally { setLocalJobsLoading(false); }
    };

    const handleAcceptJob = async (jobId: string) => {
        try {
            const res = await fetch('/api/bencana/jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'accept', jobId }),
            });
            const data = await res.json();
            if (data.success) {
                setLocalJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'accepted' } : j));
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
                setLocalJobs(prev => prev.filter(j => j.id !== jobId));
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
                setLocalJobs(prev => [data.job, ...prev]);
                setShowJobForm(false);
                setJobForm({ name: '', req: '', dist: '', area: '', phone: '', priority: 'Medium', tools: '', pax: '' });
                addXp(15);
                completeQuest('report');
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

    const fetchVolunteerOpportunities = async () => {
        setVolLoading(true);
        try {
            const res = await fetch('/api/bantuan/volunteers');
            const data = await res.json();
            if (data.success) {
                setVolOpportunities(data.opportunities || []);
                setVolPortals(data.portals || []);
            }
        } catch {}
        finally { setVolLoading(false); }
    };

    const typeColors: Record<string, string> = {
        government: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        ngo: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
        zakat: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        community: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    };

    const urgencyStyles: Record<string, { bg: string; text: string; label: string }> = {
        high: { bg: 'var(--danger-muted)', text: 'var(--danger)', label: '🔴 Urgent' },
        medium: { bg: 'rgba(217,119,6,0.08)', text: 'var(--warning)', label: '🟡 Active' },
        low: { bg: 'var(--success-muted)', text: 'var(--success)', label: '🟢 Open' },
    };

    const categoryIcons: Record<string, string> = {
        disaster_relief: '🆘',
        education: '📚',
        environment: '🌿',
        healthcare: '🏥',
        community: '🤝',
        elderly_care: '👵',
        animal_welfare: '🐾',
        youth: '⚡',
    };

    const filteredPrograms = aidPrograms.filter(a =>
        (filterType === 'all' || a.type === filterType) &&
        (searchQuery.trim() === '' ||
            a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            a.provider?.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const filteredVolunteers = volOpportunities.filter(v =>
        (volFilterCategory === 'all' || v.category === volFilterCategory) &&
        (volSearchQuery.trim() === '' ||
            v.title.toLowerCase().includes(volSearchQuery.toLowerCase()) ||
            v.organization.toLowerCase().includes(volSearchQuery.toLowerCase()) ||
            v.location.toLowerCase().includes(volSearchQuery.toLowerCase()))
    );

    const openUrl = (url?: string) => {
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
    };

    const handleAIMatch = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsMatching(true);
        try {
            const res = await fetch('/api/bantuan/match', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profile, programs: aidPrograms })
            });
            const data = await res.json();
            if (data.success && data.matches) {
                const resultsObj: Record<string, any> = {};
                data.matches.forEach((m: any) => {
                    resultsObj[m.id] = m;
                });
                setMatchResults(resultsObj);
                setShowAIMatcher(false);
            }
        } catch {
            alert('Failed to check eligibility. Please try again.');
        } finally {
            setIsMatching(false);
        }
    };

    return (
        <div className="p-6 h-full flex flex-col relative z-0">

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

            <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="mb-6"
            >
                <h2 className="text-2xl font-bold tracking-tight mb-1" style={{ color: 'var(--text-primary)' }}>Bantuan</h2>
                <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                    Aid &amp; Volunteer{locationName ? ` · ${locationName}` : ''}
                </p>
            </motion.div>

            {/* Quick Stats */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
                className="grid grid-cols-3 gap-3 mb-6"
            >
                <div className="rounded-2xl p-4 text-center" style={{ background: 'var(--success-light)', border: '1px solid var(--border-default)' }}>
                    <Package className="w-4 h-4 mx-auto mb-2" style={{ color: 'var(--success)' }} />
                    <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{aidPrograms.filter(a => a.status === 'active').length}</p>
                    <p className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>Active Aid</p>
                </div>
                <div className="rounded-2xl p-4 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                    <Globe className="w-4 h-4 mx-auto mb-2" style={{ color: 'var(--accent)' }} />
                    <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{volOpportunities.length}</p>
                    <p className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>Volunteer</p>
                </div>
                <div className="rounded-2xl p-4 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                    <HandHeart className="w-4 h-4 mx-auto mb-2" style={{ color: 'var(--warning)' }} />
                    <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{volOpportunities.reduce((sum, v) => sum + (v.spots || 0), 0)}</p>
                    <p className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>Open Spots</p>
                </div>
            </motion.div>

            {/* Tab Toggle */}
            <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="flex p-1.5 rounded-2xl mb-6"
                style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}
            >
                <button
                    onClick={() => setActiveTab('programs')}
                    className="flex-1 py-2.5 text-xs font-semibold rounded-xl transition-all"
                    style={activeTab === 'programs' ? { background: 'var(--bg-card)', color: 'var(--text-primary)', boxShadow: 'var(--shadow-sm)' } : { color: 'var(--text-muted)' }}
                >Aid Programs</button>
                <button
                    onClick={() => setActiveTab('volunteer')}
                    className="flex-1 py-2.5 text-xs font-semibold rounded-xl transition-all"
                    style={activeTab === 'volunteer' ? { background: 'var(--bg-card)', color: 'var(--text-primary)', boxShadow: 'var(--shadow-sm)' } : { color: 'var(--text-muted)' }}
                >Volunteer 🇲🇾</button>
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
                                    <Search className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                                </div>
                                <input
                                    type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Search aid programs..."
                                    className="w-full pl-11 pr-4 py-3 rounded-xl text-sm outline-none transition-colors"
                                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                                />
                            </div>
                            <div className="flex gap-2 flex-wrap mb-2">
                                {(['all', 'government', 'ngo', 'zakat'] as const).map(f => (
                                    <button key={f} onClick={() => setFilterType(f)}
                                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                                        style={filterType === f
                                            ? { background: 'var(--accent-muted)', color: 'var(--accent)', border: '1px solid var(--accent)' }
                                            : { color: 'var(--text-muted)', border: '1px solid var(--border-default)' }
                                        }
                                    >{f}</button>
                                ))}
                            </div>

                            {programsLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-7 h-7 animate-spin" style={{ color: 'var(--text-muted)' }} />
                                </div>
                            ) : filteredPrograms.length === 0 ? (
                                <div className="text-center py-12 rounded-2xl" style={{ color: 'var(--text-muted)', border: '1px dashed var(--border-default)' }}>
                                    <p className="text-sm font-medium">No aid programs found for your area</p>
                                </div>
                            ) : (
                                <>
                                    {/* AI Matcher CTA */}
                                    {!showAIMatcher && Object.keys(matchResults).length === 0 && (
                                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4 p-4 rounded-2xl flex items-center justify-between shadow-sm cursor-pointer" style={{ background: 'linear-gradient(135deg, var(--accent-muted) 0%, rgba(197, 163, 103, 0.05) 100%)', border: '1px solid var(--accent)' }} onClick={() => setShowAIMatcher(true)}>
                                            <div>
                                                <h4 className="text-sm font-bold flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}><Search className="w-4 h-4 text-[#C5A367]" /> Semak Kelayakan AI</h4>
                                                <p className="text-[10px] mt-1" style={{ color: 'var(--text-secondary)' }}>Biar NADI AI semak program mana yang anda layak mohon.</p>
                                            </div>
                                            <span className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-[#C5A367] text-white">Semak Sekarang</span>
                                        </motion.div>
                                    )}

                                    {/* AI Matcher Form */}
                                    <AnimatePresence>
                                        {showAIMatcher && (
                                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-4 overflow-hidden">
                                                <div className="p-4 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--accent)' }}>
                                                    <div className="flex justify-between items-center mb-3">
                                                        <h4 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Profil Pemohon</h4>
                                                        <button onClick={() => setShowAIMatcher(false)}><X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} /></button>
                                                    </div>
                                                    <form onSubmit={handleAIMatch} className="space-y-3">
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div>
                                                                <label className="text-[9px] font-bold uppercase tracking-widest block mb-1">Umur</label>
                                                                <input type="number" required value={profile.age} onChange={e => setProfile({...profile, age: e.target.value})} className="w-full rounded-xl px-3 py-2 text-xs outline-none" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
                                                            </div>
                                                            <div>
                                                                <label className="text-[9px] font-bold uppercase tracking-widest block mb-1">Pendapatan (RM)</label>
                                                                <input type="number" required value={profile.income} onChange={e => setProfile({...profile, income: e.target.value})} className="w-full rounded-xl px-3 py-2 text-xs outline-none" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
                                                            </div>
                                                            <div>
                                                                <label className="text-[9px] font-bold uppercase tracking-widest block mb-1">Status</label>
                                                                <select value={profile.status} onChange={e => setProfile({...profile, status: e.target.value})} className="w-full rounded-xl px-3 py-2 text-xs outline-none" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}>
                                                                    <option>Bekerja</option><option>Tidak Bekerja</option><option>Pelajar</option><option>Pesara</option>
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <label className="text-[9px] font-bold uppercase tracking-widest block mb-1">Tanggungan</label>
                                                                <input type="number" value={profile.dependents} onChange={e => setProfile({...profile, dependents: e.target.value})} className="w-full rounded-xl px-3 py-2 text-xs outline-none" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
                                                            </div>
                                                        </div>
                                                        <button type="submit" disabled={isMatching} className="w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 mt-2" style={{ background: 'var(--accent)', color: 'var(--text-on-accent)' }}>
                                                            {isMatching ? <><Loader2 className="w-4 h-4 animate-spin" /> Menganalisis...</> : 'Jalankan Analisis AI'}
                                                        </button>
                                                    </form>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {/* Clear Results */}
                                    {Object.keys(matchResults).length > 0 && !showAIMatcher && (
                                        <div className="flex justify-between items-center mb-4">
                                            <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest">✅ AI Match Results Active</p>
                                            <button onClick={() => setMatchResults({})} className="text-[10px] font-bold text-red-400 hover:text-red-500 transition-colors uppercase tracking-widest">Clear</button>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {filteredPrograms.map((aid, i) => {
                                        const match = matchResults[aid.id];
                                        return (
                                <motion.div
                                    key={aid.id}
                                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                                    onClick={() => openUrl(aid.url)}
                                    className="rounded-2xl p-5 transition-all shadow-sm group"
                                    style={{
                                        background: 'var(--bg-card)',
                                        border: '1px solid var(--border-default)',
                                        cursor: aid.url ? 'pointer' : 'default',
                                    }}
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-md border ${typeColors[aid.type]}`}>{aid.type}</span>
                                            <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-md"
                                                style={{ background: aid.status === 'active' ? 'var(--success-muted)' : 'var(--accent-muted)', color: aid.status === 'active' ? 'var(--success)' : 'var(--accent)' }}
                                            >{aid.status}</span>
                                        </div>
                                        {aid.url && (
                                            <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--accent)' }} />
                                        )}
                                    </div>
                                    <h4 className="text-base font-bold mb-2 leading-tight group-hover:underline decoration-1 underline-offset-2" style={{ color: 'var(--text-primary)' }}>{aid.name}</h4>
                                    
                                    {match && (
                                        <div className={`mb-3 p-3 rounded-xl border ${match.isEligible === true ? 'bg-green-500/10 border-green-500/20' : match.isEligible === false ? 'bg-red-500/10 border-red-500/20' : 'bg-orange-500/10 border-orange-500/20'}`}>
                                            <div className="flex items-center gap-1.5 mb-1 text-[11px] font-bold uppercase tracking-widest" style={{ color: match.isEligible === true ? '#10B981' : match.isEligible === false ? '#EF4444' : '#F59E0B' }}>
                                                {match.isEligible === true ? <CheckCircle className="w-3.5 h-3.5" /> : match.isEligible === false ? <X className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                                                {match.isEligible === true ? 'Layak' : match.isEligible === false ? 'Tidak Layak' : 'Mungkin Layak'}
                                            </div>
                                            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>{match.reason}</p>
                                        </div>
                                    )}

                                    <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>{aid.description}</p>
                                    <div className="space-y-1.5 pt-3" style={{ borderTop: '1px solid var(--border-default)' }}>
                                        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                                            <MapPin className="w-3 h-3 shrink-0" /> {aid.location}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                                            <Users className="w-3 h-3 shrink-0" /> {aid.eligibility}
                                        </div>
                                        {aid.deadline && (
                                            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                                                <Clock className="w-3 h-3 shrink-0" /> {aid.deadline}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between mt-3">
                                        <p className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>Provider: {aid.provider}</p>
                                        {aid.url && (
                                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                                                Visit Site →
                                            </span>
                                        )}
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
                                    <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>🚨 Urgent Local SOS</p>
                                    <button
                                        onClick={() => setShowJobForm(true)}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest active:scale-95 transition-all"
                                        style={{ background: 'var(--danger-muted)', color: 'var(--danger)', border: '1px solid var(--danger)' }}
                                    >
                                        <Plus className="w-3 h-3" /> {t('bencana.request_help')}
                                    </button>
                                </div>
                                
                                {localJobsLoading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
                                    </div>
                                ) : localJobs.length === 0 ? (
                                    <div className="text-center py-8 rounded-3xl text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', border: '1px dashed var(--border-default)' }}>
                                        No local SOS requests
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
                                    <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>🤝 Nationwide Campaigns 🇲🇾</p>
                                    <button
                                        onClick={fetchVolunteerOpportunities}
                                        className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg transition-all active:scale-95"
                                        style={{ background: 'var(--accent-muted)', color: 'var(--accent)', border: '1px solid var(--border-default)' }}
                                    >↻ Refresh</button>
                                </div>

                            {/* Volunteer Search */}
                            <div className="relative mb-2">
                                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                                    <Search className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                                </div>
                                <input
                                    type="text" value={volSearchQuery} onChange={e => setVolSearchQuery(e.target.value)}
                                    placeholder="Search by org, location, or role..."
                                    className="w-full pl-11 pr-4 py-3 rounded-xl text-sm outline-none transition-colors"
                                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                                />
                            </div>

                            {/* Category filter pills */}
                            <div className="flex gap-2 flex-wrap mb-2 overflow-x-auto pb-1">
                                {[
                                    { key: 'all', label: 'All' },
                                    { key: 'disaster_relief', label: '🆘 Disaster' },
                                    { key: 'education', label: '📚 Education' },
                                    { key: 'environment', label: '🌿 Environment' },
                                    { key: 'healthcare', label: '🏥 Health' },
                                    { key: 'community', label: '🤝 Community' },
                                    { key: 'elderly_care', label: '👵 Elderly' },
                                    { key: 'youth', label: '⚡ Youth' },
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
                                    <p className="text-xs font-medium animate-pulse" style={{ color: 'var(--text-muted)' }}>Finding volunteer opportunities...</p>
                                </div>
                            ) : filteredVolunteers.length === 0 ? (
                                <div className="text-center py-12 rounded-2xl" style={{ border: '1px dashed var(--border-default)' }}>
                                    <Briefcase className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                                    <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>No matching opportunities</p>
                                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Try a different search or category</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredVolunteers.map((vol, i) => {
                                    const urgency = urgencyStyles[vol.urgency] || urgencyStyles.medium;
                                    const catIcon = categoryIcons[vol.category] || '🤝';
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
                                                    <UserCheck className="w-3 h-3" /> {vol.spots} spots
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
                                                    Sign Up →
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
                                    <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>🔗 Browse Directly</p>
                                    <p className="text-[11px] mb-3" style={{ color: 'var(--text-secondary)' }}>Visit these official volunteer portals to find and sign up for specific activities:</p>
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
        </div>
    );
}
