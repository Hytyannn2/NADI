'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown, Minus, RefreshCw, Play, Square } from 'lucide-react';
import { useTheme } from '@/src/context/ThemeContext';

interface Reading {
    water_level: number;
    battery_pct: number | null;
    temperature_c: number | null;
    humidity_pct: number | null;
    pressure_hpa: number | null;
    recorded_at: string;
}

interface ChartDataPoint {
    time: string;
    timeLabel: string;
    water_level: number;
    temperature_c: number | null;
    pressure_hpa: number | null;
}

interface SensorTrendChartProps {
    sensorId: string | null;
    currentWaterLevel: number;
    riseRate: number;
}

// Generate realistic river water level data with natural patterns
function generateDemoData(hours: number): ChartDataPoint[] {
    const points: ChartDataPoint[] = [];
    const now = Date.now();
    const intervalMs = (hours * 60 * 60 * 1000) / 120; // ~120 data points regardless of range
    const totalPoints = 120;

    // Create a realistic river pattern: base level + slow tide + rain event + noise
    const baseLevel = 35; // normal river level cm
    const tideAmplitude = 12; // slow oscillation
    const tidePeriod = 24 * 60 * 60 * 1000; // 24h cycle

    // Simulate a rain event that causes water to rise then slowly fall
    const rainPeakTime = now - (hours * 0.3 * 60 * 60 * 1000); // peak at 30% from now
    const rainDuration = hours * 0.4 * 60 * 60 * 1000; // rain event lasts 40% of the window
    const rainPeakLevel = 55; // additional cm from rain

    for (let i = 0; i < totalPoints; i++) {
        const timestamp = now - (totalPoints - i) * intervalMs;
        const date = new Date(timestamp);

        // Base tide oscillation
        const tideOffset = tideAmplitude * Math.sin((2 * Math.PI * timestamp) / tidePeriod);

        // Rain event — gaussian-like rise and fall
        const distFromPeak = timestamp - rainPeakTime;
        const rainSigma = rainDuration / 3;
        const rainEffect = rainPeakLevel * Math.exp(-0.5 * Math.pow(distFromPeak / rainSigma, 2));

        // Random noise (±2cm)
        const noise = (Math.random() - 0.5) * 4;

        // Slight upward trend in recent data (approaching monsoon feeling)
        const recentTrend = Math.max(0, (i - totalPoints * 0.8) * 0.3);

        const waterLevel = Math.max(5, Math.round((baseLevel + tideOffset + rainEffect + noise + recentTrend) * 10) / 10);

        points.push({
            time: date.toISOString(),
            timeLabel: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            water_level: waterLevel,
            temperature_c: 28 + Math.random() * 4,
            pressure_hpa: 1010 + Math.random() * 8 - 4,
        });
    }

    return points;
}

export default function SensorTrendChart({ sensorId, currentWaterLevel, riseRate }: SensorTrendChartProps) {
    const { formatTime } = useTheme();
    const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [timeRange, setTimeRange] = useState<number>(24);
    const [isLiveDemo, setIsLiveDemo] = useState(false);
    const [hasRealData, setHasRealData] = useState(false);
    const liveDemoRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const demoDataRef = useRef<ChartDataPoint[]>([]);

    // Fetch real readings from the API
    const fetchReadings = useCallback(async () => {
        if (!sensorId) return;
        setIsLoading(true);
        try {
            const res = await fetch(`/api/bencana/sensors/readings?sensor_id=${sensorId}&hours=${timeRange}`);
            const json = await res.json();
            if (json.success && json.readings && json.readings.length > 0) {
                const data: ChartDataPoint[] = json.readings.map((r: Reading) => {
                    const date = new Date(r.recorded_at);
                    return {
                        time: date.toISOString(),
                        timeLabel: formatTime(date),
                        water_level: r.water_level,
                        temperature_c: r.temperature_c,
                        pressure_hpa: r.pressure_hpa,
                    };
                });
                setChartData(data);
                setHasRealData(true);
            } else {
                setHasRealData(false);
                if (!isLiveDemo) {
                    setChartData([]);
                }
            }
        } catch {
            setHasRealData(false);
            if (!isLiveDemo) setChartData([]);
        } finally {
            setIsLoading(false);
        }
    }, [sensorId, timeRange, isLiveDemo, formatTime]);

    // Fetch real data on mount and when time range changes
    useEffect(() => {
        if (!isLiveDemo) {
            fetchReadings();
            const interval = setInterval(fetchReadings, 120_000);
            return () => clearInterval(interval);
        }
    }, [fetchReadings, isLiveDemo]);

    // Live Demo mode — generates initial data and appends new points every 3s
    const startLiveDemo = useCallback(() => {
        // Generate initial historical data for the selected time range
        const initial = generateDemoData(timeRange).map(p => ({ ...p, timeLabel: formatTime(new Date(p.time)) }));
        demoDataRef.current = initial;
        setChartData(initial);
        setIsLiveDemo(true);

        // Add a new point every 3 seconds
        liveDemoRef.current = setInterval(() => {
            const prev = demoDataRef.current;
            const lastLevel = prev.length > 0 ? prev[prev.length - 1].water_level : 40;
            const now = new Date();

            // Random walk: drift ±3cm from last value with slight mean reversion
            const meanReversion = (45 - lastLevel) * 0.02; // pull toward 45cm
            const drift = (Math.random() - 0.48) * 6 + meanReversion; // slight upward bias
            const newLevel = Math.max(5, Math.round((lastLevel + drift) * 10) / 10);

            const newPoint: ChartDataPoint = {
                time: now.toISOString(),
                timeLabel: formatTime(now),
                water_level: newLevel,
                temperature_c: 28 + Math.random() * 4,
                pressure_hpa: 1008 + Math.random() * 8,
            };

            // Keep the window to ~120 points max, drop oldest
            const updated = [...prev.slice(-119), newPoint];
            demoDataRef.current = updated;
            setChartData(updated);
        }, 3000);
    }, [timeRange]);

    const stopLiveDemo = useCallback(() => {
        setIsLiveDemo(false);
        if (liveDemoRef.current) {
            clearInterval(liveDemoRef.current);
            liveDemoRef.current = null;
        }
        demoDataRef.current = [];
        // Fetch real data again
        fetchReadings();
    }, [fetchReadings]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (liveDemoRef.current) clearInterval(liveDemoRef.current);
        };
    }, []);

    // When time range changes during live demo, regenerate
    useEffect(() => {
        if (isLiveDemo) {
            if (liveDemoRef.current) clearInterval(liveDemoRef.current);
            startLiveDemo();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timeRange]);

    // Rise rate indicator
    const RiseIndicator = () => {
        if (riseRate > 1) return <TrendingUp className="w-4 h-4 text-red-500" />;
        if (riseRate < -1) return <TrendingDown className="w-4 h-4 text-blue-400" />;
        return <Minus className="w-4 h-4 text-zinc-500" />;
    };

    const riseLabel = riseRate > 1 ? `↑ ${riseRate} cm/hr` : riseRate < -1 ? `↓ ${Math.abs(riseRate)} cm/hr` : '→ Stable';
    const riseColor = riseRate > 5 ? 'text-red-500' : riseRate > 1 ? 'text-orange-400' : riseRate < -1 ? 'text-blue-400' : 'text-zinc-500';

    // Determine gradient color from the latest chart data point (for demo) or current level
    const latestLevel = chartData.length > 0 ? chartData[chartData.length - 1].water_level : currentWaterLevel;
    const gradientColor = latestLevel >= 120 ? '#EF4444' : latestLevel >= 80 ? '#F97316' : '#10B981';

    // Custom tooltip
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload?.length) return null;
        const val = payload[0].value;
        const color = val >= 120 ? '#EF4444' : val >= 80 ? '#F97316' : '#10B981';
        return (
            <div className="rounded-xl p-3 shadow-xl text-xs" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                <p className="font-bold text-[10px] uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
                <p className="font-bold text-sm" style={{ color }}>
                    {val} <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>cm</span>
                </p>
            </div>
        );
    };

    return (
        <div className="rounded-2xl p-4 relative overflow-hidden" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                        Water Level Trend
                    </p>
                    {isLiveDemo && (
                        <span className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 animate-pulse">
                            ● LIVE DEMO
                        </span>
                    )}
                    {!isLiveDemo && (
                        <div className={`flex items-center gap-1 text-[9px] font-bold ${riseColor}`}>
                            <RiseIndicator />
                            {riseLabel}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-1.5">
                    {[6, 12, 24].map(h => (
                        <button
                            key={h}
                            onClick={() => setTimeRange(h)}
                            className="text-[8px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg transition-colors"
                            style={timeRange === h
                                ? { background: 'var(--accent-muted)', color: 'var(--accent)', border: '1px solid var(--accent)' }
                                : { color: 'var(--text-muted)', border: '1px solid var(--border-default)' }
                            }
                        >{h}h</button>
                    ))}
                    {/* Live Demo toggle */}
                    <button
                        onClick={isLiveDemo ? stopLiveDemo : startLiveDemo}
                        className={`text-[8px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                            isLiveDemo ? 'bg-red-500/15 text-red-400 border border-red-500/30' : 'text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10'
                        }`}
                    >
                        {isLiveDemo ? <><Square className="w-2.5 h-2.5" /> Stop</> : <><Play className="w-2.5 h-2.5" /> Demo</>}
                    </button>
                    {!isLiveDemo && (
                        <button
                            onClick={fetchReadings}
                            className="text-[8px] font-bold px-1.5 py-1 rounded-lg transition-colors"
                            style={{ color: 'var(--text-muted)', border: '1px solid var(--border-default)' }}
                        >
                            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                        </button>
                    )}
                </div>
            </div>

            {/* Chart */}
            {chartData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 rounded-xl gap-2" style={{ border: '1px dashed var(--border-default)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                        {isLoading ? 'Loading readings...' : 'No readings yet'}
                    </p>
                    <button
                        onClick={startLiveDemo}
                        className="text-[9px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10"
                    >
                        <Play className="w-3 h-3" /> Start Live Demo
                    </button>
                </div>
            ) : (
                <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="waterGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={gradientColor} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={gradientColor} stopOpacity={0.02} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis
                                dataKey="timeLabel"
                                tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
                                tickLine={false}
                                axisLine={false}
                                interval={Math.floor(chartData.length / 6)}
                            />
                            <YAxis
                                tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
                                tickLine={false}
                                axisLine={false}
                                domain={[0, (dataMax: number) => Math.max(150, Math.ceil(dataMax / 20) * 20)]}
                                unit=" cm"
                            />
                            <Tooltip content={<CustomTooltip />} />
                            {/* Danger threshold line at 120cm */}
                            <ReferenceLine y={120} stroke="#EF4444" strokeDasharray="4 4" strokeOpacity={0.6} label={{ value: 'DANGER 120cm', position: 'right', fill: '#EF4444', fontSize: 8 }} />
                            {/* Warning threshold line at 80cm */}
                            <ReferenceLine y={80} stroke="#F97316" strokeDasharray="4 4" strokeOpacity={0.4} label={{ value: 'WARN 80cm', position: 'right', fill: '#F97316', fontSize: 8 }} />
                            <Area
                                type="monotone"
                                dataKey="water_level"
                                stroke={gradientColor}
                                strokeWidth={2}
                                fill="url(#waterGradient)"
                                dot={false}
                                activeDot={{ r: 4, stroke: gradientColor, strokeWidth: 2, fill: 'var(--bg-card)' }}
                                animationDuration={isLiveDemo ? 300 : 800}
                                isAnimationActive={!isLiveDemo}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Rise rate warning banner */}
            {riseRate > 5 && !isLiveDemo && (
                <div className="mt-3 p-2.5 rounded-xl flex items-center gap-2 animate-pulse" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                    <TrendingUp className="w-4 h-4 text-red-500 shrink-0" />
                    <p className="text-[10px] font-bold text-red-400">
                        ⚠️ EARLY WARNING: Water rising {riseRate} cm/hr — monitor closely
                    </p>
                </div>
            )}
        </div>
    );
}
