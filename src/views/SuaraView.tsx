'use client';
import { useState, useEffect, useRef } from 'react';
import { Send, Bot, Loader2, Sparkles, MapPin, ThumbsUp, ThumbsDown, Mic, MicOff, Languages, ChevronDown, Check, ShieldAlert, X, Trash2, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAntiSpam } from '../hooks/useAntiSpam';

export default function SuaraView() {
    const [inputText, setInputText] = useState('');
    const [reports, setReports] = useState<any[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [targetLanguage, setTargetLanguage] = useState('English');
    const [showLangMenu, setShowLangMenu] = useState(false);

    // Dialect correction modal state
    const [correctionTarget, setCorrectionTarget] = useState<any>(null);
    const [dialectInput, setDialectInput] = useState('');
    const [meaningInput, setMeaningInput] = useState('');
    const [isSubmittingCorrection, setIsSubmittingCorrection] = useState(false);

    // Anti-spam: 5 requests per 60 seconds, 2 minute cooldown
    const spam = useAntiSpam({
        maxRequests: 5,
        windowSeconds: 60,
        cooldownSeconds: 120,
        storageKey: 'suara_voice',
    });

    const recognitionRef = useRef<any>(null);

    const languages = ['English', 'Standard Malay', 'Chinese', 'Tamil', 'Arabic'];

    useEffect(() => {
        const saved = localStorage.getItem('nadi_voice_reports');
        if (saved) {
            try {
                setReports(JSON.parse(saved).map((r: any) => ({
                    ...r,
                    timestamp: new Date(r.timestamp)
                })));
            } catch (e) {
                console.error("Failed to load reports", e);
            }
        }

        // Initialize Speech Recognition
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = false;
            recognitionRef.current.lang = 'ms-MY'; // Set to Malay by default for dialects

            recognitionRef.current.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                setInputText(transcript);
                setIsListening(false);
            };

            recognitionRef.current.onerror = (event: any) => {
                console.error("Speech recognition error", event.error);
                setIsListening(false);
            };

            recognitionRef.current.onend = () => {
                setIsListening(false);
            };
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('nadi_voice_reports', JSON.stringify(reports));
    }, [reports]);

    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
        } else {
            if (recognitionRef.current) {
                setIsListening(true);
                recognitionRef.current.start();
            } else {
                alert("Speech recognition is not supported in this browser.");
            }
        }
    };

    const handleRate = async (id: string, rating: 'up' | 'down') => {
        setReports(prev => prev.map(r =>
            r.id === id ? { ...r, rating } : r
        ));

        if (rating === 'up') {
            const report = reports.find(r => r.id === id);
            if (report && report.raw && report.simplifiedTranslation) {
                try {
                    await fetch('/api/dialect/feedback', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            dialectText: report.raw.trim(),
                            correctMeaning: report.simplifiedTranslation.trim(),
                            region: report.detectedDialect && report.detectedDialect !== 'unknown' ? report.detectedDialect : 'kelantan',
                            rawVoice: report.raw || '',
                            reportId: report.id,
                        }),
                    });
                } catch (e) {
                    console.error('Auto-correction failed', e);
                }
            }
        }
    };

    const handleRemoveReport = (id: string) => {
        setReports(prev => prev.filter(r => r.id !== id));
    };

    const openCorrection = (report: any) => {
        setCorrectionTarget(report);
        setDialectInput(report.raw || '');
        setMeaningInput('');
    };

    const submitCorrection = async () => {
        if (!dialectInput.trim() || !meaningInput.trim() || !correctionTarget) return;
        setIsSubmittingCorrection(true);
        try {
            await fetch('/api/dialect/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dialectText: dialectInput.trim(),
                    correctMeaning: meaningInput.trim(),
                    region: correctionTarget.detectedDialect || 'unknown',
                    rawVoice: correctionTarget.raw || '',
                    reportId: correctionTarget.id,
                }),
            });
            setReports(prev => prev.map(r =>
                r.id === correctionTarget.id ? { ...r, rating: 'corrected' } : r
            ));
            setCorrectionTarget(null);
        } catch (e) {
            console.error('Correction failed', e);
        } finally {
            setIsSubmittingCorrection(false);
        }
    };




    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputText.trim() || isProcessing) return;

        // Client-side anti-spam check
        if (!spam.tryRequest()) return;

        setIsProcessing(true);
        try {
            let coords: { lat: number, lng: number } | null = null;
            try {
                if ('geolocation' in navigator) {
                    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, maximumAge: 0, enableHighAccuracy: true });
                    });
                    coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                } else {
                    throw new Error("Geolocation not supported");
                }
            } catch (geoErr) {
                console.log("Geolocation failed:", geoErr);
                alert("Sila benarkan akses lokasi (GPS) untuk menghantar laporan. (Please allow GPS access)");
                setIsProcessing(false);
                return;
            }

            const res = await fetch('/api/suara/parse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inputText: inputText.trim(), targetLanguage }),
            });

            if (res.status === 429) {
                const err = await res.json();
                spam.forceBlock(err.retryAfter || 120);
                return;
            }

            const result = await res.json();
            if (!result.success) throw new Error(result.error);

            setReports(prev => [{
                id: Date.now().toString(),
                raw: inputText,
                ...result.data,
                coordinates: coords || result.data.coordinates,
                location: result.data.location || (coords ? 'Current Location' : 'Unknown Location'),
                timestamp: new Date()
            }, ...prev]);

            setInputText('');
        } catch (error) {
            console.error("AI Parsing Error", error);
            alert("Failed to process report. Try again.");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="p-6 h-full flex flex-col relative z-0">
            <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="mb-10 text-center mt-4"
            >
                <h2 className="text-3xl font-serif mb-2 tracking-tight" style={{ color: 'var(--text-primary)' }}>Maklum Balas</h2>
                <p className="text-xs uppercase font-bold tracking-widest" style={{ color: 'var(--accent)' }}>
                    AI Dialect Parsing
                </p>
            </motion.div>

            <div className="flex-1 flex flex-col items-center justify-center -mt-8">

                {/* Helper prompt graphic */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
                    className="backdrop-blur-xl rounded-[2rem] p-6 text-center max-w-[280px] w-full mb-8 relative"
                    style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-md)' }}
                >
                    <div className="absolute -top-4 -left-4 p-2.5 rounded-full" style={{ background: 'var(--accent)', color: 'var(--text-on-accent)' }}>
                        <Sparkles className="w-4 h-4" />
                    </div>
                    <p className="font-serif text-lg italic leading-tight" style={{ color: 'var(--text-primary)' }}>
                        "Tangki rumah saya pecah..."
                    </p>
                    <p className="text-xs uppercase font-bold tracking-widest mt-5" style={{ color: 'var(--text-muted)' }}>Speak in local dialect</p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                    className="flex items-center gap-2 mb-8 text-xs uppercase font-bold tracking-widest animate-pulse text-center"
                    style={{ color: 'var(--text-muted)' }}
                >
                    <span>Tap the microphone below to report</span>
                </motion.div>

                {/* Language Selection */}
                <div className="w-full max-w-xs mb-4 relative z-40">
                    <button
                        onClick={() => setShowLangMenu(!showLangMenu)}
                        className="w-full backdrop-blur-xl px-4 py-3 rounded-xl flex items-center justify-between text-xs font-bold uppercase tracking-widest transition-colors"
                        style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}
                    >
                        <div className="flex items-center gap-2">
                            <Languages className="w-3.5 h-3.5" />
                            <span>Translate to: {targetLanguage}</span>
                        </div>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showLangMenu ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                        {showLangMenu && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                className="absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden"
                                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-lg)' }}
                            >
                                {languages.map((lang) => (
                                    <button
                                        key={lang}
                                        onClick={() => {
                                            setTargetLanguage(lang);
                                            setShowLangMenu(false);
                                        }}
                                        className="w-full px-4 py-4 text-left text-xs font-bold uppercase tracking-widest flex items-center justify-between transition-colors"
                                        style={targetLanguage === lang ? { background: 'var(--accent-muted)', color: 'var(--accent)' } : { color: 'var(--text-muted)' }}
                                    >
                                        {lang}
                                        {targetLanguage === lang && <Check className="w-3.5 h-3.5" />}
                                    </button>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
                {/* Anti-Spam Cooldown Indicator */}
                <AnimatePresence>
                    {spam.cooldownRemaining > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                            className="w-full bg-red-500/10 border border-red-500/20 rounded-2xl p-4 mb-4 flex items-center gap-3"
                        >
                            <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
                            <div>
                                <p className="text-sm font-bold text-red-300">Rate Limited</p>
                                <p className="text-xs text-red-400/70 font-medium">Try again in {spam.cooldownRemaining}s</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
                {spam.statusMessage && spam.cooldownRemaining === 0 && (
                    <p className="text-xs uppercase font-bold tracking-widest text-orange-400/70 mb-3">{spam.statusMessage}</p>
                )}

                {/* Fallback/Demo Input */}
                <motion.form
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                    onSubmit={handleSubmit}
                    className={`w-full relative rounded-2xl overflow-hidden shadow-2xl transition-all z-20 ${spam.cooldownRemaining > 0 ? 'opacity-50 pointer-events-none' : ''}`}
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
                >
                    <button
                        type="button"
                        aria-label="Toggle voice input"
                        onClick={toggleListening}
                        className={`absolute left-3 top-1/2 -translate-y-1/2 p-3 rounded-xl transition-all ${isListening ? 'bg-red-500/20 text-red-500 animate-pulse' : ''}`}
                        style={!isListening ? { color: 'var(--text-muted)' } : {}}
                    >
                        {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </button>
                    <input
                        type="text"
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        placeholder={isListening ? "Listening..." : (isProcessing ? "Analysing dialect..." : "Type or speak report...")}
                        className={`w-full pl-14 px-6 py-5 pr-28 text-sm bg-transparent outline-none font-medium transition-all ${isProcessing ? 'opacity-50' : 'opacity-100'}`}
                        style={{ color: 'var(--text-primary)' }}
                        disabled={isProcessing}
                    />
                    <div className="absolute right-14 top-1/2 -translate-y-1/2">
                        {isProcessing && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}><Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--accent)' }} /></motion.div>}
                    </div>
                    <button
                        type="submit"
                        aria-label="Send report"
                        disabled={isProcessing || !inputText.trim()}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-3 rounded-xl disabled:opacity-30 transition-colors"
                        style={{ color: 'var(--accent)' }}
                    >
                        {isProcessing ? <Sparkles className="w-5 h-5 animate-pulse" /> : <Send className="w-5 h-5" />}
                    </button>
                </motion.form>
            </div>

            {reports.length > 0 && (
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="mt-8 relative z-30 pb-10 pt-6"
                    style={{ borderTop: '1px solid var(--border-default)' }}
                >
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xs uppercase font-bold tracking-widest flex items-center gap-2" style={{ color: 'var(--accent)' }}>
                            <ShieldAlert className="w-4 h-4" /> Live Community Feed
                        </h3>
                        <span className="text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-widest bg-[#10B981]/10 text-[#10B981]">
                            {reports.length} Updates
                        </span>
                    </div>
                    <div className="space-y-4">
                        {reports.map((report, i) => (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                                key={report.id}
                                className="rounded-3xl p-6 shadow-lg relative overflow-hidden"
                                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -z-10" style={{ background: 'var(--accent-muted)' }}></div>
                                
                                {/* User Header */}
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-md" style={{ background: 'linear-gradient(135deg, var(--accent), #3B82F6)' }}>
                                            R
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-1.5">
                                                <h4 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Local Resident</h4>
                                                <div className="w-3.5 h-3.5 rounded-full bg-blue-500 flex items-center justify-center">
                                                    <Check className="w-2 h-2 text-white" />
                                                </div>
                                            </div>
                                            <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                                                {report.timestamp ? new Date(report.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                                            </p>
                                        </div>
                                    </div>
                                    <span className={`px-3 py-1.5 text-[10px] font-bold rounded-full uppercase tracking-widest border flex items-center justify-center ${report.urgency === 'High' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                        report.urgency === 'Medium' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                                            'bg-[#C5A367]/10 text-[#C5A367] border-[#C5A367]/20'
                                        }`}>
                                        {report.urgency} Priority
                                    </span>
                                </div>

                                {/* Main Content */}
                                <h4 className="font-serif text-lg mb-3 leading-snug" style={{ color: 'var(--text-primary)' }}>"{report.intent}"</h4>
                                
                                {/* Location Tag */}
                                <div className="flex text-xs uppercase font-bold tracking-widest mb-4">
                                    <span className="flex items-center gap-1.5 px-4 py-2 rounded-lg" style={{ color: 'var(--text-primary)', background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                                        <MapPin className="w-4 h-4" style={{ color: 'var(--accent)' }} /> {report.location || 'Unknown Location'}
                                    </span>
                                </div>

                                {/* AI Translation Box */}
                                <div className="rounded-2xl p-5 mb-4" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <Bot className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                                        <span className="text-xs uppercase tracking-widest font-bold" style={{ color: 'var(--text-muted)' }}>AI Translation ({targetLanguage})</span>
                                    </div>
                                    <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{report.simplifiedTranslation}</p>
                                </div>

                                {/* GPS Chip (replaces fake map) */}
                                {report.coordinates?.lat !== undefined && report.coordinates?.lng !== undefined && (
                                    <div className="flex items-center gap-2 mb-4 flex-wrap">
                                        <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}>
                                            <MapPin className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
                                            GPS: {report.coordinates?.lat?.toFixed(4)}, {report.coordinates?.lng?.toFixed(4)}
                                        </span>
                                        {report.detectedDialect && report.detectedDialect !== 'unknown' && report.detectedDialect !== 'standard' && (
                                            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                                                <BookOpen className="w-3.5 h-3.5" />
                                                {report.detectedDialect}
                                            </span>
                                        )}
                                    </div>
                                )}

                                {/* Feedback Mechanism */}
                                <div className="flex items-center justify-between pt-4" style={{ borderTop: '1px solid var(--border-default)' }}>
                                    <span className="text-xs uppercase font-bold tracking-widest" style={{ color: report.rating === 'corrected' ? 'var(--success)' : 'var(--text-muted)' }}>
                                        {report.rating === 'corrected' ? '✓ Corrected — Terima kasih!' : report.rating === 'up' ? '✓ Accurate' : 'Rate accuracy'}
                                    </span>
                                    <div className="flex gap-2">
                                        <button
                                            aria-label="Rate as accurate"
                                            onClick={() => handleRate(report.id, 'up')}
                                            className={`p-3 rounded-lg border transition-all ${report.rating === 'up' ? 'bg-[#10B981]/20 border-[#10B981]/40 text-[#10B981]' : ''}`}
                                            style={report.rating !== 'up' ? { borderColor: 'var(--border-default)', color: 'var(--text-muted)' } : {}}
                                            title="AI got it right"
                                        >
                                            <ThumbsUp className="w-4 h-4" />
                                        </button>
                                        <button
                                            aria-label="Suggest correction"
                                            onClick={() => openCorrection(report)}
                                            className={`p-3 rounded-lg border transition-all ${report.rating === 'down' || report.rating === 'corrected' ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' : ''}`}
                                            style={report.rating !== 'down' && report.rating !== 'corrected' ? { borderColor: 'var(--border-default)', color: 'var(--text-muted)' } : {}}
                                            title="AI got it wrong — teach it"
                                        >
                                            <ThumbsDown className="w-4 h-4" />
                                        </button>
                                        <button
                                            aria-label="Delete report"
                                            onClick={() => handleRemoveReport(report.id)}
                                            className="p-3 rounded-lg border transition-all hover:text-red-400 hover:bg-red-500/10 ml-1"
                                            style={{ borderColor: 'var(--border-default)', color: 'var(--text-muted)' }}
                                            title="Delete this report"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* ===== Dialect Correction Modal ===== */}
            <AnimatePresence>
                {correctionTarget && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 backdrop-blur-sm"
                        onClick={() => setCorrectionTarget(null)}
                    >
                        <motion.div
                            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            className="w-full max-w-md rounded-t-3xl p-6 pb-10"
                            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Teach NADI</h3>
                                <button onClick={() => setCorrectionTarget(null)} className="p-2 rounded-xl" style={{ color: 'var(--text-muted)' }}>
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                                Help us understand your dialect better! Write what you said and what it means.
                            </p>

                            {/* What AI heard */}
                            <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                                <p className="text-xs uppercase font-bold tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>AI heard</p>
                                <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>"{correctionTarget.raw}"</p>
                            </div>

                            {/* Dialect input */}
                            <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: 'var(--text-muted)' }}>
                                What you said (dialect spelling)
                            </label>
                            <input
                                type="text"
                                value={dialectInput}
                                onChange={e => setDialectInput(e.target.value)}
                                placeholder="e.g. ambo nok make ghaso"
                                className="input-base mb-3"
                            />

                            {/* Meaning input */}
                            <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: 'var(--text-muted)' }}>
                                Correct meaning (Malay / English)
                            </label>
                            <input
                                type="text"
                                value={meaningInput}
                                onChange={e => setMeaningInput(e.target.value)}
                                placeholder="e.g. saya hendak makan rasa"
                                className="input-base mb-5"
                            />

                            <button
                                onClick={submitCorrection}
                                disabled={!dialectInput.trim() || !meaningInput.trim() || isSubmittingCorrection}
                                className="btn-primary w-full"
                            >
                                {isSubmittingCorrection ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
                                ) : (
                                    <><BookOpen className="w-4 h-4" /> Submit Correction</>
                                )}
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

