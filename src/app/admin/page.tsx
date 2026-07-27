'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/context/AuthContext';
import { Shield, AlertTriangle, X, Search, ChevronRight, Lock, Loader2, RefreshCw, Users, MessageSquare, HeartHandshake, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

interface Report { id: string; category: string; description: string; location: string; image: string | null; timestamp: number; status: string; }
interface AnalyticsData {
    stats: { users: number; posts: number; jobs: number; reports: number; };
    charts: { whistleblower: any[]; jobs: any[]; };
    recentPosts: any[];
}

export default function AdminDashboard() {
    const { user, loading } = useAuth();
    const router = useRouter();
    
    const [reports, setReports] = useState<Report[]>([]);
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [fetching, setFetching] = useState(true);
    const [selectedReport, setSelectedReport] = useState<Report | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'reports'>('overview');

    useEffect(() => {
        if (!loading && !user) {
            router.push('/');
            return;
        }
        // SECURITY: Client-side admin role check (defense-in-depth — server APIs also enforce this)
        if (!loading && user) {
            const isAdmin = (user as any).app_metadata?.role === 'admin' || user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;
            if (!isAdmin) {
                router.push('/');
            }
        }
    }, [user, loading, router]);

    const loadData = async () => {
        setFetching(true);
        try {
            const [reportsRes, analyticsRes] = await Promise.all([
                fetch('/api/admin/reports'),
                fetch('/api/admin/analytics')
            ]);
            const reportsData = await reportsRes.json();
            const analyticsData = await analyticsRes.json();
            
            if (reportsData.success) setReports(reportsData.reports);
            if (analyticsData.success) setAnalytics(analyticsData);
        } catch (e) { console.error(e); } 
        finally { setFetching(false); }
    };

    useEffect(() => { if (user) loadData(); }, [user]);

    if (loading || !user) return (
        <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-white">
            <Loader2 className="w-8 h-8 animate-spin text-[#C5A367] mb-4" />
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Authenticating Secure Connection...</p>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#050505] text-white selection:bg-[#C5A367]/30">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-[#0A0A0C]/80 backdrop-blur-xl border-b border-zinc-800/50">
                <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-red-600 to-red-900 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(220,38,38,0.3)]">
                            <Lock className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h1 className="text-sm font-bold tracking-widest uppercase">NADI Command Center</h1>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Tier 1 Clearance</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <div className="flex bg-[#121214] p-1 rounded-xl border border-zinc-800">
                            <button onClick={() => setActiveTab('overview')} className={`px-4 py-1.5 text-xs font-bold uppercase tracking-widest rounded-lg transition-colors ${activeTab === 'overview' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>Overview</button>
                            <button onClick={() => setActiveTab('reports')} className={`px-4 py-1.5 text-xs font-bold uppercase tracking-widest rounded-lg transition-colors flex items-center gap-2 ${activeTab === 'reports' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                                Reports {reports.length > 0 && <span className="bg-red-500 text-white px-1.5 rounded-full text-[9px]">{reports.length}</span>}
                            </button>
                        </div>
                        <button onClick={() => router.push('/')} className="text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-white transition-colors">Exit</button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-6xl mx-auto px-6 py-8 pb-20">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        {activeTab === 'overview' ? <><Activity className="w-5 h-5 text-[#C5A367]" /> System Analytics</> : <><Shield className="w-5 h-5 text-red-500" /> Whistleblower Queue</>}
                    </h2>
                    <button onClick={loadData} className="p-2 rounded-lg bg-[#121214] border border-zinc-800 text-zinc-400 hover:text-white transition-colors">
                        <RefreshCw className={`w-4 h-4 ${fetching ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {fetching ? (
                    <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-zinc-700" /></div>
                ) : activeTab === 'overview' && analytics ? (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                        {/* KPI Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-[#0A0A0C] border border-zinc-800 p-5 rounded-2xl flex flex-col">
                                <Users className="w-5 h-5 text-[#C5A367] mb-3" />
                                <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Total Citizens</span>
                                <span className="text-3xl font-bold text-white mt-1">{analytics.stats.users}</span>
                            </div>
                            <div className="bg-[#0A0A0C] border border-zinc-800 p-5 rounded-2xl flex flex-col">
                                <HeartHandshake className="w-5 h-5 text-emerald-500 mb-3" />
                                <span className="text-[10px] text-zinc-500 uppercase tracking-widest">SOS Jobs</span>
                                <span className="text-3xl font-bold text-white mt-1">{analytics.stats.jobs}</span>
                            </div>
                            <div className="bg-[#0A0A0C] border border-zinc-800 p-5 rounded-2xl flex flex-col">
                                <MessageSquare className="w-5 h-5 text-blue-500 mb-3" />
                                <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Community Posts</span>
                                <span className="text-3xl font-bold text-white mt-1">{analytics.stats.posts}</span>
                            </div>
                            <div className="bg-[#0A0A0C] border border-red-500/30 p-5 rounded-2xl flex flex-col relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                                <Shield className="w-5 h-5 text-red-500 mb-3" />
                                <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Whistleblowers</span>
                                <span className="text-3xl font-bold text-red-400 mt-1">{analytics.stats.reports}</span>
                            </div>
                        </div>

                        {/* Charts Section */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-2 bg-[#0A0A0C] border border-zinc-800 p-6 rounded-2xl">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-6">Whistleblower Breakdown</h3>
                                <div className="h-[300px] w-full">
                                    {analytics.charts.whistleblower.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={analytics.charts.whistleblower} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                <XAxis dataKey="name" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                                                <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                                                <RechartsTooltip cursor={{ fill: '#18181b' }} contentStyle={{ backgroundColor: '#121214', border: '1px solid #27272a', borderRadius: '12px', fontSize: '12px' }} />
                                                <Bar dataKey="value" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={40} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-xs text-zinc-600 font-bold uppercase tracking-widest border border-dashed border-zinc-800 rounded-xl">No Reports Yet</div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-[#0A0A0C] border border-zinc-800 p-6 rounded-2xl">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-6">SOS Job Status</h3>
                                <div className="h-[250px] w-full">
                                    {analytics.charts.jobs.reduce((a, b) => a + b.value, 0) > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={analytics.charts.jobs} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                                                    {analytics.charts.jobs.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                                                </Pie>
                                                <RechartsTooltip contentStyle={{ backgroundColor: '#121214', border: '1px solid #27272a', borderRadius: '12px', fontSize: '12px' }} />
                                                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-xs text-zinc-600 font-bold uppercase tracking-widest border border-dashed border-zinc-800 rounded-xl">No Jobs Available</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Recent Activity Feed */}
                        <div className="bg-[#0A0A0C] border border-zinc-800 p-6 rounded-2xl">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-6">Recent Community Activity</h3>
                            <div className="space-y-4">
                                {analytics.recentPosts.length > 0 ? analytics.recentPosts.map(post => (
                                    <div key={post.id} className="flex gap-4 items-start pb-4 border-b border-zinc-800/50 last:border-0 last:pb-0">
                                        <div className="w-8 h-8 rounded-full bg-[#121214] border border-zinc-700 flex items-center justify-center shrink-0">
                                            <MessageSquare className="w-3.5 h-3.5 text-[#C5A367]" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-bold text-zinc-300">{post.author}</span>
                                                <span className="text-[10px] text-zinc-600">{new Date(post.created_at).toLocaleString()}</span>
                                            </div>
                                            <p className="text-sm text-zinc-400">{post.content}</p>
                                        </div>
                                    </div>
                                )) : <div className="text-xs text-zinc-600">No recent posts.</div>}
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4">
                        {reports.length === 0 ? (
                            <div className="text-center py-20 border border-dashed border-zinc-800 rounded-3xl bg-[#0A0A0C]">
                                <Shield className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                                <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest">No Reports</h3>
                            </div>
                        ) : reports.map(report => (
                            <div key={report.id} onClick={() => setSelectedReport(report)} className="group bg-[#0A0A0C] border border-zinc-800 hover:border-zinc-700 p-5 rounded-2xl cursor-pointer transition-all hover:bg-[#121214] flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20">
                                        <AlertTriangle className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <span className="text-xs font-bold uppercase tracking-widest text-[#C5A367]">{report.category.replace('_', ' ')}</span>
                                            <span className="text-[10px] text-zinc-600">{new Date(report.timestamp).toLocaleString()}</span>
                                            {report.image && <span className="text-[9px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded border border-emerald-500/20 font-bold uppercase">Has Evidence</span>}
                                        </div>
                                        <p className="text-sm text-zinc-300 line-clamp-1">{report.description}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 pl-14 md:pl-0">
                                    <div className="text-right">
                                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-0.5">Location</p>
                                        <p className="text-xs font-bold text-zinc-300">{report.location}</p>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-zinc-700 group-hover:text-[#C5A367] transition-colors hidden md:block" />
                                </div>
                            </div>
                        ))}
                    </motion.div>
                )}
            </main>

            {/* Modal for Report Details */}
            <AnimatePresence>
                {selectedReport && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
                        <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-[#0A0A0C] border border-zinc-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl">
                            <div className="sticky top-0 bg-[#0A0A0C]/90 backdrop-blur-md border-b border-zinc-800 p-6 flex justify-between items-center z-10">
                                <div>
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                        <AlertTriangle className="w-5 h-5 text-red-500" />
                                        Report Details
                                    </h3>
                                    <p className="text-xs text-zinc-500 uppercase tracking-widest mt-1">Ref: {selectedReport.id}</p>
                                </div>
                                <button onClick={() => setSelectedReport(null)} className="p-2 bg-[#121214] hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-full transition-colors"><X className="w-5 h-5" /></button>
                            </div>

                            <div className="p-6 space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-[#121214] border border-zinc-800 rounded-xl p-4">
                                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Category</p>
                                        <p className="text-sm font-bold text-[#C5A367] capitalize">{selectedReport.category.replace('_', ' ')}</p>
                                    </div>
                                    <div className="bg-[#121214] border border-zinc-800 rounded-xl p-4">
                                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Date Submitted</p>
                                        <p className="text-sm font-bold text-white">{new Date(selectedReport.timestamp).toLocaleString()}</p>
                                    </div>
                                </div>

                                <div>
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2 ml-1">General Location</p>
                                    <div className="bg-[#121214] border border-zinc-800 rounded-xl p-4 flex items-start gap-3">
                                        <Search className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
                                        <p className="text-sm text-zinc-300 leading-relaxed">{selectedReport.location}</p>
                                    </div>
                                </div>

                                <div>
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2 ml-1">Incident Description</p>
                                    <div className="bg-[#121214] border border-zinc-800 rounded-xl p-5">
                                        <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{selectedReport.description}</p>
                                    </div>
                                </div>

                                {selectedReport.image && (
                                    <div>
                                        <div className="flex items-center justify-between mb-2 ml-1">
                                            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Photographic Evidence</p>
                                            <span className="text-[9px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded border border-emerald-500/20 font-bold uppercase flex items-center gap-1">
                                                <Shield className="w-3 h-3" /> EXIF Scrubbed
                                            </span>
                                        </div>
                                        <div className="rounded-xl overflow-hidden border border-zinc-800 bg-[#121214]">
                                            <img src={selectedReport.image} alt="Evidence" className="w-full h-auto" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
