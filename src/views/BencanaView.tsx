'use client';
import { MapPin, Navigation, AlertTriangle, CheckCircle, Plus, Loader2, X, Radio, Trash2, MessageCircle, Battery, Wifi } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '@/src/context/LanguageContext';
import VolunteerChat from '@/src/components/VolunteerChat';

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

export default function BencanaView() {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<'map'>('map');
    const [jobs, setJobs] = useState<VolunteerJob[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showJobForm, setShowJobForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [form, setForm] = useState({ name: '', req: '', dist: '', area: '' });
    const [chatJobName, setChatJobName] = useState<string | null>(null);
    const [showDashboard, setShowDashboard] = useState(false);
    const [userLat, setUserLat] = useState(2.9181); // Default: UKM Bangi
    const [userLng, setUserLng] = useState(101.7712);
    const [locationLabel, setLocationLabel] = useState('Bangi, Selangor');

    // LoRaWAN sensor status — read-only, not user-controlled
    // Will connect to real LoRaWAN gateway in future
    const [sensorStatus] = useState<'safe' | 'warning' | 'danger'>('safe');
    const sensorLabels = {
        safe: { text: t('bencana.sensor_safe'), style: 'bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20' },
        warning: { text: t('bencana.sensor_warning'), style: 'bg-orange-500/10 text-orange-400 border border-orange-500/20' },
        danger: { text: t('bencana.sensor_danger'), style: 'bg-red-500/20 text-red-500 border border-red-500/30' },
    };
    const currentSensor = sensorLabels[sensorStatus];

    const fetchJobs = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/bencana/jobs');
            const data = await res.json();
            if (data.success) setJobs(data.jobs);
        } catch {
            // silently fail
        } finally {
            setIsLoading(false);
        }
    };

    // Real-time geolocation tracking
    useEffect(() => {
        let watchId: number | null = null;
        if (navigator.geolocation) {
            // Try to get initial position
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    setUserLat(pos.coords.latitude);
                    setUserLng(pos.coords.longitude);
                    // Reverse geocode to get real location name
                    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json&zoom=12`, { headers: { 'User-Agent': 'NADI/1.0' } })
                        .then(r => r.json())
                        .then(d => { const a = d.address || {}; setLocationLabel(a.suburb || a.town || a.city || a.county || 'Your area'); })
                        .catch(() => {});
                },
                () => { /* keep Bangi defaults */ },
                { enableHighAccuracy: true }
            );
            // Watch for continuous updates
            watchId = navigator.geolocation.watchPosition(
                (pos) => {
                    setUserLat(pos.coords.latitude);
                    setUserLng(pos.coords.longitude);
                },
                () => {},
                { enableHighAccuracy: true, maximumAge: 10000 }
            );
        }
        return () => { if (watchId !== null) navigator.geolocation.clearWatch(watchId); };
    }, []);

    const handleAccept = async (jobId: string) => {
        try {
            const res = await fetch('/api/bencana/jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'accept', jobId }),
            });
            const data = await res.json();
            if (data.success) {
                setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'accepted' } : j));
            }
        } catch {
            alert('Failed to accept job. Try again.');
        }
    };

    const handleCancel = async (jobId: string) => {
        if (!confirm(t('bencana.cancel_confirm'))) return;
        try {
            const res = await fetch('/api/bencana/jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'cancel', jobId }),
            });
            const data = await res.json();
            if (data.success) {
                setJobs(prev => prev.filter(j => j.id !== jobId));
            }
        } catch {
            alert('Failed to cancel request. Try again.');
        }
    };

    const handleSubmitJob = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name || !form.req) return;
        setIsSubmitting(true);
        try {
            const res = await fetch('/api/bencana/jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'submit', ...form }),
            });
            const data = await res.json();
            if (data.success) {
                setJobs(prev => [data.job, ...prev]);
                setShowJobForm(false);
                setForm({ name: '', req: '', dist: '', area: '' });
            }
        } catch {
            alert('Failed to submit request. Try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const priorityColor = (p: string) => {
        if (p === 'High') return 'text-red-400 bg-red-500/10 border-red-500/20';
        if (p === 'Medium') return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
        return 'text-zinc-400 bg-zinc-800/50 border-zinc-700/50';
    };

    return (
        <div className="p-6 h-full flex flex-col relative z-0 text-zinc-100">

            {/* Submit Job Modal */}
            <AnimatePresence>
                {showJobForm && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end justify-center"
                        onClick={(e) => e.target === e.currentTarget && setShowJobForm(false)}
                    >
                        <motion.div
                            initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
                            className="bg-[#121214] border border-zinc-800 rounded-t-3xl p-6 w-full max-w-md shadow-2xl"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-serif text-xl text-white">{t('bencana.request_volunteers')}</h3>
                                <button onClick={() => setShowJobForm(false)} className="p-2 text-zinc-500 hover:text-white"><X className="w-5 h-5" /></button>
                            </div>
                            <form onSubmit={handleSubmitJob} className="space-y-4">
                                {[
                                    { key: 'name', placeholder: 'e.g. Keluarga Ibrahim', label: t('bencana.household') },
                                    { key: 'req', placeholder: 'e.g. Mud cleanup, furniture moving', label: t('bencana.help_needed') },
                                    { key: 'dist', placeholder: 'e.g. 500m from main road', label: t('bencana.distance') },
                                    { key: 'area', placeholder: 'e.g. Taman Sri Putra, Kota Bharu', label: t('bencana.area') },
                                ].map(f => (
                                    <div key={f.key}>
                                        <label className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5 block">{f.label}</label>
                                        <input
                                            type="text"
                                            value={(form as any)[f.key]}
                                            onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                                            placeholder={f.placeholder}
                                            required={f.key === 'name' || f.key === 'req'}
                                            className="w-full bg-[#0A0A0C] border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-[#C5A367]/50 focus:outline-none transition-colors"
                                        />
                                    </div>
                                ))}
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full bg-gradient-to-r from-[#C5A367] to-[#E8C34B] text-[#0A0A0C] py-4 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 mt-2 shadow-[0_5px_20px_rgba(197,163,103,0.15)]"
                                >
                                    {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('bencana.ai_priority')}</> : t('bencana.submit_request')}
                                </button>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="mb-8"
            >
                <h2 className="text-3xl font-serif mb-1 tracking-tight">{t('bencana.title')}</h2>
                <p className="text-[10px] uppercase font-bold tracking-widest mt-1 text-[#C5A367]">
                    {t('bencana.subtitle')}
                </p>
            </motion.div>

            {/* LoRaWAN Sensor Status + Dashboard (Feature 9) */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
                className="mb-6 p-5 rounded-3xl border shadow-xl relative overflow-hidden bg-[#121214] border-zinc-800"
            >
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -z-10 translate-x-1/3 -translate-y-1/3" />

                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Radio className="w-4 h-4 text-zinc-500" />
                        <span className="font-bold text-[10px] text-zinc-500 uppercase tracking-widest">{t('bencana.lorawan')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold px-3 py-1.5 rounded-full tracking-widest uppercase shadow-sm ${currentSensor.style}`}>
                            {currentSensor.text}
                        </span>
                        <button onClick={() => setShowDashboard(!showDashboard)} className="text-[8px] font-bold uppercase tracking-widest text-[#C5A367] border border-[#C5A367]/20 px-2 py-1 rounded-lg hover:bg-[#C5A367]/10 transition-colors">
                            {showDashboard ? 'Hide' : 'Dashboard'}
                        </button>
                    </div>
                </div>
                <p className="text-[10px] text-zinc-600 font-medium leading-relaxed">
                    {t('bencana.sensor_desc')}
                </p>

                {/* Expanded LoRaWAN Dashboard */}
                <AnimatePresence>
                    {showDashboard && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                            <div className="mt-4 pt-4 border-t border-zinc-800 space-y-3">
                                {/* Sensor data placeholder — will connect to real LoRaWAN gateway */}
                                <div className="text-center py-6 border border-dashed border-zinc-800 rounded-2xl">
                                    <Radio className="w-6 h-6 text-zinc-700 mx-auto mb-2" />
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Awaiting Sensor Connection</p>
                                    <p className="text-[9px] text-zinc-700 mt-1 max-w-[200px] mx-auto">Water level, battery, and uptime data will appear once LoRaWAN sensors are paired</p>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            {/* Volunteer Chat Overlay (Feature 12) */}
            <AnimatePresence>
                {chatJobName && <VolunteerChat jobName={chatJobName} onClose={() => setChatJobName(null)} />}
            </AnimatePresence>

            {/* Sensor Status */}
            <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="flex items-center gap-3 p-4 rounded-2xl mb-6"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}
            >
                <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{t('bencana.evacuation')}</span>
                <span className="ml-auto text-[10px] font-medium px-2.5 py-1 rounded-lg" style={{ background: 'var(--success-muted)', color: 'var(--success)' }}>{t('bencana.standby')}</span>
            </motion.div>

            <div className="flex-1 min-h-0 overflow-y-auto pb-6 relative">
                <AnimatePresence mode="wait">
                    {activeTab === 'map' ? (
                        <motion.div
                            key="map"
                            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }}
                            className="space-y-6"
                        >
                            {/* Live Map — Dynamic Location */}
                            <div className="w-full h-72 rounded-3xl relative overflow-hidden border-2 shadow-2xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', boxShadow: 'var(--shadow-lg)' }}>
                                <iframe
                                    title="NADI Bencana Map"
                                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${(userLng - 0.08).toFixed(4)}%2C${(userLat - 0.06).toFixed(4)}%2C${(userLng + 0.08).toFixed(4)}%2C${(userLat + 0.06).toFixed(4)}&layer=mapnik&marker=${userLat.toFixed(4)}%2C${userLng.toFixed(4)}`}
                                    className="w-full h-full border-0 opacity-90"
                                    sandbox="allow-scripts allow-same-origin"
                                />
                                {/* Live location pulse */}
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20">
                                    <div className="relative">
                                        <div className="w-4 h-4 rounded-full bg-[#10B981] border-2 border-white shadow-lg" />
                                        <div className="absolute inset-0 w-4 h-4 rounded-full bg-[#10B981] animate-ping opacity-40" />
                                    </div>
                                </div>
                                {/* Top label — positioned to NOT block OSM +/- controls */}
                                <div className="absolute top-3 left-3 z-20 pointer-events-none">
                                    <div className="flex items-center gap-2 backdrop-blur-md px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid var(--border-default)' }}>
                                        <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                                        <span className="text-[10px] font-semibold" style={{ color: 'var(--success)' }}>Live GPS</span>
                                    </div>
                                </div>
                                {/* Bottom overlay */}
                                <div className="absolute bottom-0 inset-x-0 pointer-events-none z-20">
                                    <div className="pt-10 pb-4 px-4" style={{ background: 'linear-gradient(to top, var(--bg-card) 40%, transparent)' }}>
                                        <div className="flex items-center gap-3 mb-2">
                                            <Navigation className="w-5 h-5 shrink-0" style={{ color: 'var(--accent)' }} />
                                            <div>
                                                <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>GPS active · {locationLabel}</p>
                                                <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>📍 {userLat.toFixed(4)}°N, {userLng.toFixed(4)}°E</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="volunteer"
                            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}
                            className="space-y-4"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <p className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">
                                    {t('bencana.cleanup')}
                                </p>
                                <button
                                    onClick={() => setShowJobForm(true)}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest active:scale-95 transition-all border bg-[#C5A367]/10 text-[#C5A367] border-[#C5A367]/20 hover:bg-[#C5A367] hover:text-[#0A0A0C]"
                                >
                                    <Plus className="w-3 h-3" /> {t('bencana.request_help')}
                                </button>
                            </div>

                            {isLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-7 h-7 text-zinc-700 animate-spin" />
                                </div>
                            ) : jobs.length === 0 ? (
                                <div className="text-center py-12 text-zinc-600 border border-dashed border-zinc-800 rounded-3xl text-[10px] font-bold uppercase tracking-widest">
                                    {t('bencana.no_requests')}
                                </div>
                            ) : (
                                jobs.map((job) => (
                                    <motion.div
                                        key={job.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        className="p-5 rounded-3xl border transition-all hover:shadow-xl group cursor-pointer bg-[#121214] border-zinc-800 hover:border-zinc-700"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-serif text-lg mb-1 transition-colors text-zinc-100 group-hover:text-white">{job.name}</h4>
                                                <div className="flex items-center gap-2 text-[9px] font-bold tracking-widest uppercase mb-2 flex-wrap">
                                                    <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-800/50 text-zinc-400 border border-zinc-700/50">
                                                        <MapPin className="w-3.5 h-3.5" /> {job.dist}
                                                    </span>
                                                    <span className="text-[#C5A367]">{job.req}</span>
                                                </div>
                                                <span className={`text-[8px] px-2 py-1 rounded-md font-bold uppercase tracking-widest border ${priorityColor(job.priority)}`}>
                                                    {job.priority} {t('bencana.priority')}
                                                </span>
                                            </div>
                                            <div className="flex flex-col items-end gap-2 ml-3 shrink-0">
                                                {job.status === 'open' ? (
                                                    <>
                                                        <button
                                                            onClick={() => handleAccept(job.id)}
                                                            className="px-4 py-2.5 rounded-xl text-[9px] font-bold tracking-widest uppercase transition-all shadow-lg active:scale-95 bg-[#C5A367]/10 text-[#C5A367] border border-[#C5A367]/20 hover:bg-[#C5A367] hover:text-[#0A0A0C]"
                                                        >
                                                            {t('bencana.accept')}<br />
                                                            <span className="text-[8px] opacity-70 font-normal">+{job.bounty} pts</span>
                                                        </button>
                                                        <button
                                                            onClick={() => handleCancel(job.id)}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[8px] font-bold tracking-widest uppercase transition-all text-red-400/60 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20"
                                                        >
                                                            <Trash2 className="w-3 h-3" /> {t('bencana.cancel')}
                                                        </button>
                                                    </>
                                                ) : (
                                                    <div className="flex flex-col items-end gap-2">
                                                        <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] font-bold uppercase tracking-widest bg-zinc-800/30 px-3 py-2 rounded-xl border border-zinc-800">
                                                            <CheckCircle className="w-4 h-4 opacity-70" /> {t('bencana.secured')}
                                                        </div>
                                                        <button onClick={() => setChatJobName(job.name)}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[8px] font-bold tracking-widest uppercase text-[#C5A367] hover:bg-[#C5A367]/10 border border-[#C5A367]/20 transition-all"
                                                        >
                                                            <MessageCircle className="w-3 h-3" /> Chat
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
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
