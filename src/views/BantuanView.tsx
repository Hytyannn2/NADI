'use client';
import { useState, useEffect } from 'react';
import { Heart, MapPin, Loader2, Plus, X, Search, Phone, Clock, Users, Package, ChevronDown, CheckCircle, AlertTriangle, HandHeart, Briefcase, Trash2, ExternalLink, Globe, Calendar, UserCheck } from 'lucide-react';
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

    // Volunteer opportunities (nationwide from API)
    const [volOpportunities, setVolOpportunities] = useState<VolunteerOpportunity[]>([]);
    const [volPortals, setVolPortals] = useState<{id: string; title: string; organization: string; url: string; description: string}[]>([]);
    const [volLoading, setVolLoading] = useState(false);
    const [volSearchQuery, setVolSearchQuery] = useState('');

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
                    fetch('/api/bantuan/programs?lat=2.918&lng=101.771')
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
        if (activeTab === 'volunteer' && volOpportunities.length === 0) {
            fetchVolunteerOpportunities();
        }
    }, [activeTab]);

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

    return (
        <div className="p-6 h-full flex flex-col relative z-0">

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
                            ) : filteredPrograms.map((aid, i) => (
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
                            ))}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="volunteer"
                            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}
                            className="space-y-4"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Nationwide Opportunities 🇲🇾</p>
                                <button
                                    onClick={fetchVolunteerOpportunities}
                                    className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-all active:scale-95"
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
                                filteredVolunteers.map((vol, i) => {
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
                                })
                            )}

                            {/* Browse Portals Section */}
                            {volPortals.length > 0 && (
                                <div className="mt-6 pt-4" style={{ borderTop: '1px solid var(--border-default)' }}>
                                    <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>🔗 Browse Directly</p>
                                    <p className="text-[11px] mb-3" style={{ color: 'var(--text-secondary)' }}>Visit these official volunteer portals to find and sign up for specific activities:</p>
                                    <div className="grid grid-cols-2 gap-2">
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
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
