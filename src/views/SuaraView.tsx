import { useState, useEffect, useRef } from 'react';
import { Send, Bot, Loader2, Sparkles, MapPin, ThumbsUp, ThumbsDown, Mic, MicOff, Languages, ChevronDown, Check, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAntiSpam } from '../hooks/useAntiSpam';

export default function SuaraView() {
    const [inputText, setInputText] = useState('');
    const [reports, setReports] = useState<any[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [targetLanguage, setTargetLanguage] = useState('English');
    const [showLangMenu, setShowLangMenu] = useState(false);

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

    const handleRate = (id: string, rating: 'up' | 'down') => {
        setReports(prev => prev.map(r =>
            r.id === id ? { ...r, rating } : r
        ));
    };

    const handleRemoveReport = (id: string) => {
        setReports(prev => prev.filter(r => r.id !== id));
    };

    const getMapPos = (coords: { lat: number, lng: number }) => {
        if (!coords) return { left: '50%', top: '50%' };
        // Malaysia bounds roughly
        const latMin = 1.0, latMax = 7.4;
        const lngMin = 99.0, lngMax = 119.3;

        let left = ((coords.lng - lngMin) / (lngMax - lngMin)) * 100;
        let top = 100 - ((coords.lat - latMin) / (latMax - latMin)) * 100;

        // Clamp
        left = Math.max(10, Math.min(90, left));
        top = Math.max(10, Math.min(90, top));

        return { left: `${left}%`, top: `${top}%` };
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputText.trim() || isProcessing) return;

        // Client-side anti-spam check
        if (!spam.tryRequest()) return;

        setIsProcessing(true);
        try {
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
                <h2 className="text-3xl font-serif text-white mb-2 tracking-tight">Maklum Balas</h2>
                <p className="text-[10px] uppercase font-bold tracking-widest text-[#C5A367]">
                    AI Dialect Parsing
                </p>
            </motion.div>

            <div className="flex-1 flex flex-col items-center justify-center -mt-8">

                {/* Helper prompt graphic */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
                    className="bg-[#121214]/60 border border-zinc-800/80 shadow-[0_0_30px_rgba(197,163,103,0.05)] backdrop-blur-xl rounded-[2rem] p-6 text-center max-w-[280px] w-full mb-8 relative"
                >
                    <div className="absolute -top-4 -left-4 bg-gradient-to-br from-[#D4AF37] to-[#B8860B] text-[#0A0A0C] p-2.5 rounded-full shadow-lg shadow-[#D4AF37]/20 border border-[#E8C34B]/50">
                        <Sparkles className="w-4 h-4" />
                    </div>
                    <p className="text-zinc-200 font-serif text-lg italic leading-tight">
                        "Lampu jalan depan surau kelip-kelip, jalan pun berlubang..."
                    </p>
                    <p className="text-[9px] uppercase font-bold tracking-widest text-[#C5A367]/60 mt-5">Speak in local dialect</p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                    className="flex items-center gap-2 mb-8 text-[10px] uppercase font-bold tracking-widest text-zinc-500 animate-pulse text-center"
                >
                    <span>Tap the microphone below to report</span>
                </motion.div>

                {/* Language Selection */}
                <div className="w-full max-w-xs mb-4 relative z-40">
                    <button
                        onClick={() => setShowLangMenu(!showLangMenu)}
                        className="w-full bg-[#121214]/60 border border-zinc-800/80 backdrop-blur-xl px-4 py-2 rounded-xl flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:text-[#C5A367] transition-colors"
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
                                className="absolute top-full left-0 right-0 mt-2 bg-[#121214] border border-zinc-800 rounded-xl overflow-hidden shadow-2xl"
                            >
                                {languages.map((lang) => (
                                    <button
                                        key={lang}
                                        onClick={() => {
                                            setTargetLanguage(lang);
                                            setShowLangMenu(false);
                                        }}
                                        className={`w-full px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest flex items-center justify-between transition-colors ${targetLanguage === lang ? 'bg-[#C5A367]/10 text-[#C5A367]' : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'
                                            }`}
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
                                <p className="text-xs font-bold text-red-300">Rate Limited</p>
                                <p className="text-[10px] text-red-400/70 font-medium">Try again in {spam.cooldownRemaining}s</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
                {spam.statusMessage && spam.cooldownRemaining === 0 && (
                    <p className="text-[9px] uppercase font-bold tracking-widest text-orange-400/70 mb-3">{spam.statusMessage}</p>
                )}

                {/* Fallback/Demo Input */}
                <motion.form
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                    onSubmit={handleSubmit}
                    className={`w-full relative rounded-2xl overflow-hidden bg-[#0A0A0C] shadow-2xl border transition-all z-20 ${spam.cooldownRemaining > 0 ? 'border-red-500/30 opacity-50 pointer-events-none' : 'border-zinc-800 focus-within:border-[#C5A367]/50 focus-within:ring-4 focus-within:ring-[#C5A367]/10'}`}
                >
                    <button
                        type="button"
                        onClick={toggleListening}
                        className={`absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-xl transition-all ${isListening ? 'bg-red-500/20 text-red-500 animate-pulse' : 'text-zinc-500 hover:bg-zinc-800/50'
                            }`}
                    >
                        {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </button>
                    <input
                        type="text"
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        placeholder={isListening ? "Listening..." : (isProcessing ? "Analysing dialect..." : "Type or speak report...")}
                        className={`w-full pl-14 px-6 py-5 pr-28 text-sm bg-transparent outline-none text-zinc-100 placeholder:text-zinc-600 font-medium transition-all ${isProcessing ? 'opacity-50' : 'opacity-100'}`}
                        disabled={isProcessing}
                    />
                    <div className="absolute right-14 top-1/2 -translate-y-1/2">
                        {isProcessing && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}><Loader2 className="w-4 h-4 animate-spin text-[#C5A367]/50" /></motion.div>}
                    </div>
                    <button
                        type="submit"
                        disabled={isProcessing || !inputText.trim()}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 text-[#C5A367] hover:bg-[#C5A367]/10 rounded-xl disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                    >
                        {isProcessing ? <Sparkles className="w-5 h-5 animate-pulse" /> : <Send className="w-5 h-5" />}
                    </button>
                </motion.form>
            </div>

            {reports.length > 0 && (
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="mt-8 relative z-30 pb-10 border-t border-zinc-800/50 pt-6"
                >
                    <h3 className="text-[10px] uppercase font-bold tracking-widest text-[#C5A367] mb-4 flex items-center gap-2">
                        <Bot className="w-4 h-4" /> Parsed Intents
                    </h3>
                    <div className="space-y-4">
                        {reports.map((report, i) => (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                                key={report.id}
                                className="bg-[#121214] rounded-3xl p-6 border border-zinc-800/60 shadow-lg relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-[#C5A367]/5 rounded-full blur-3xl -z-10"></div>
                                <div className="flex justify-between items-start mb-4">
                                    <span className={`px-4 py-1.5 text-[9px] font-bold rounded-full uppercase tracking-widest border flex items-center justify-center ${report.urgency === 'High' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                            report.urgency === 'Medium' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                                                'bg-[#C5A367]/10 text-[#C5A367] border-[#C5A367]/20'
                                        }`}>
                                        {report.urgency} Priority
                                    </span>
                                </div>
                                <h4 className="font-serif text-xl text-zinc-100 mb-4 leading-tight">"{report.intent}"</h4>
                                <div className="flex text-[10px] uppercase font-bold tracking-widest text-zinc-500 border-t border-zinc-800/50 pt-4 mb-4">
                                    <span className="flex items-center gap-1.5 text-zinc-300 bg-zinc-800/50 px-3 py-1.5 rounded-lg border border-zinc-700">
                                        <MapPin className="w-3.5 h-3.5 text-[#C5A367]" /> {report.location}
                                    </span>
                                </div>

                                <div className="bg-[#0A0A0C] rounded-2xl p-4 border border-zinc-800/50 mb-4">
                                    <div className="flex items-center gap-1.5 mb-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[#C5A367] shadow-[0_0_5px_#C5A367]"></div>
                                        <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Standard Text ({targetLanguage})</span>
                                    </div>
                                    <p className="text-sm text-zinc-300 font-medium">{report.simplifiedTranslation}</p>
                                </div>

                                {/* Map Visual Component */}
                                <div className="relative w-full h-32 bg-[#050505] rounded-2xl border border-zinc-800 overflow-hidden mb-6 group">
                                    <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
                                    {/* Grid Lines */}
                                    <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, #222 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

                                    <motion.div
                                        initial={{ scale: 0 }} animate={{ scale: 1 }}
                                        className="absolute"
                                        style={getMapPos(report.coordinates)}
                                    >
                                        <div className="relative">
                                            <div className="absolute -inset-4 bg-[#C5A367]/20 rounded-full animate-ping"></div>
                                            <div className="absolute -inset-2 bg-[#C5A367]/30 rounded-full animate-pulse"></div>
                                            <MapPin className="w-6 h-6 text-[#C5A367] drop-shadow-[0_0_10px_#C5A367]" />
                                        </div>
                                    </motion.div>

                                    <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg border border-white/5 text-[8px] font-bold uppercase tracking-widest text-zinc-400">
                                        GPS: {report.coordinates?.lat?.toFixed(4)}, {report.coordinates?.lng?.toFixed(4)}
                                    </div>
                                </div>

                                {/* Feedback Mechanism */}
                                <div className="flex items-center justify-between border-t border-zinc-800/50 pt-4">
                                    <span className="text-[9px] uppercase font-bold tracking-widest text-zinc-500">Rate accuracy</span>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleRate(report.id, 'up')}
                                            className={`p-2 rounded-lg border transition-all ${report.rating === 'up' ? 'bg-[#10B981]/20 border-[#10B981]/40 text-[#10B981]' : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'
                                                }`}
                                        >
                                            <ThumbsUp className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleRate(report.id, 'down')}
                                            className={`p-2 rounded-lg border transition-all ${report.rating === 'down' ? 'bg-red-500/20 border-red-500/40 text-red-500' : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'
                                                }`}
                                        >
                                            <ThumbsDown className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleRemoveReport(report.id)}
                                            className="p-2 rounded-lg border border-zinc-800 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all ml-2"
                                        >
                                            <Bot className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            )}
        </div>
    );
}
