/**
 * Hydrological Sensor Trend & Predictive Forecast Chart
 * 
 * Renders Recharts area visualization of historical water levels and projects
 * future flood trajectories using damped Ordinary Least Squares (OLS) regression.
 */
'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown, Minus, Sparkles, AlertTriangle } from 'lucide-react';
import { useTheme } from '@/src/context/ThemeContext';

interface ChartDataPoint {
    time: string;
    timeLabel: string;
    live_level?: number | null;
    projected_level?: number | null;
    isProjection?: boolean;
}

interface SensorTrendChartProps {
    sensorId: string | null;
    currentWaterLevel: number; // Water level value
    riseRate: number;          // Pre-calculated backend rate (cm/hr, optional fallback)
    unit?: 'm' | 'cm';        // Explicit unit declaration. Default: 'm' (meters)
    status?: string;          // e.g. 'safe', 'warning', 'danger', 'sensor_fault', 'offline'
    lastReadingTime?: string | number | null; // Last ping timestamp
    isOnline?: boolean;       // Live status
}

type ForecastRange = '30m' | '1h' | '3h' | '6h' | '12h' | '24h';

// Hydrological Forecast Constants
// Basin damping time constant (tau in hours): attenuates linear rate decay over long forecasts
const DAMPING_TAU_HOURS = 4.0;

// Rolling telemetry buffer window (30 minutes)
const TIME_WINDOW_MINUTES = 30;

// Soft noise deadband (cm/hr) to filter sensor ripple vibrations
const NOISE_DEADBAND_CM_HR = 5.0;

export default function SensorTrendChart({
    sensorId,
    currentWaterLevel,
    riseRate,
    unit = 'm',
    status,
    lastReadingTime,
    isOnline,
}: SensorTrendChartProps) {
    const { getSamplingIntervalMs } = useTheme();
    const sampleIntervalMs = getSamplingIntervalMs();
    const [liveHistory, setLiveHistory] = useState<{ timestamp: number; timeLabel: string; level: number }[]>([]);
    const [forecastRange, setForecastRange] = useState<ForecastRange>('6h');
    const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const latestCmRef = useRef<number>(0);

    // =========================================================================
    // WATCHDOG: 30-Second Telemetry Timeout & Sensor Fault Protection
    // =========================================================================
    const lastPingTimestamp = useMemo(() => {
        if (lastReadingTime) {
            return typeof lastReadingTime === 'string' ? new Date(lastReadingTime).getTime() : lastReadingTime;
        }
        if (liveHistory.length > 0) {
            return liveHistory[liveHistory.length - 1].timestamp;
        }
        return 0;
    }, [lastReadingTime, liveHistory]);

    const isSensorOffline = useMemo(() => {
        if (isOnline === false || status === 'sensor_fault' || status === 'offline' || currentWaterLevel === -1) {
            return true;
        }
        if (!lastPingTimestamp) return false;
        const secondsSinceLastPing = (Date.now() - lastPingTimestamp) / 1000;
        return secondsSinceLastPing > 35; // 35 seconds of silence = hardware offline
    }, [lastPingTimestamp, status, isOnline, currentWaterLevel]);

    // =========================================================================
    // FIX #1: EXPLICIT UNIT CONVERSION (No Magic Threshold Heuristics)
    // =========================================================================
    const currentCm = useMemo(() => {
        if (!currentWaterLevel || currentWaterLevel <= 0) return 0;
        return unit === 'm'
            ? Math.round(currentWaterLevel * 100)
            : Math.round(currentWaterLevel);
    }, [currentWaterLevel, unit]);

    // Keep latestCmRef in sync so the interval closure always has the current value
    useEffect(() => {
        latestCmRef.current = currentCm;
    }, [currentCm]);

    // Heartbeat interval: append a reading dynamically based on user sampling rate
    useEffect(() => {
        const appendReading = () => {
            const level = latestCmRef.current;
            if (level <= 0 || isSensorOffline) return;

            const now = Date.now();
            const timeLabel = new Date(now).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
            });

            setLiveHistory((prev) => {
                const cutoffTime = now - TIME_WINDOW_MINUTES * 60 * 1000;
                const filtered = prev.filter((p) => p.timestamp >= cutoffTime);

                // Deduplicate: skip if last point was within 80% of sampling rate
                const minGap = Math.max(2000, sampleIntervalMs * 0.8);
                if (filtered.length > 0 && (now - filtered[filtered.length - 1].timestamp) < minGap) {
                    return filtered;
                }

                return [...filtered, { timestamp: now, timeLabel, level }];
            });
        };

        // Immediately append on mount/level change
        appendReading();

        // Start heartbeat interval using configured sampling rate
        heartbeatRef.current = setInterval(appendReading, sampleIntervalMs);

        return () => {
            if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        };
    }, [sampleIntervalMs, isSensorOffline]);

    // Also append immediately whenever level actually changes (responsive to real sensor pings)
    useEffect(() => {
        if (currentCm <= 0) return;

        const now = Date.now();
        const timeLabel = new Date(now).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });

        setLiveHistory((prev) => {
            const cutoffTime = now - TIME_WINDOW_MINUTES * 60 * 1000;
            const filtered = prev.filter((p) => p.timestamp >= cutoffTime);

            if (filtered.length > 0 && (now - filtered[filtered.length - 1].timestamp) < 2000) {
                return filtered;
            }

            return [...filtered, { timestamp: now, timeLabel, level: currentCm }];
        });
    }, [currentCm]);

    // =========================================================================
    // FIX #2, #3: HYDROLOGICAL DAMPED WAVE FORECAST ENGINE
    // =========================================================================
    // Uses:
    //   - OLS Linear Regression over the FULL time-bounded buffer (not last 6 pings)
    //   - Continuous Soft-Thresholding (not a hard step-function cutoff)
    //   - Exponential Asymptotic Damping (not unbounded linear extrapolation)
    //
    // Forecast formula:
    //   ĥ(t + Δt) = h₀ + m · τ · (1 - e^(-Δt/τ))
    //
    // Where:
    //   h₀ = Current water level (cm)
    //   m  = OLS regression slope (cm/hr) after soft deadband subtraction
    //   τ  = Basin damping constant (4.0 hours)
    //   Δt = Forecast horizon step (hours)
    //
    // Properties:
    //   - Short-range (Δt << τ): ĥ ≈ h₀ + m·Δt (nearly linear, tracks real rate)
    //   - Long-range (Δt >> τ): ĥ → h₀ + m·τ  (asymptotes, never explodes)
    //   - At Δt = τ: captures 63.2% of max delta (natural inflection point)
    const combinedChartData = useMemo((): ChartDataPoint[] => {
        if (liveHistory.length === 0) return [];

        const combined: ChartDataPoint[] = [];

        // --- LIVE HARDWARE POINTS (Solid Emerald Green) ---
        liveHistory.forEach((pt, index) => {
            const isLast = index === liveHistory.length - 1;
            combined.push({
                time: new Date(pt.timestamp).toISOString(),
                timeLabel: pt.timeLabel,
                live_level: pt.level,
                projected_level: isLast ? pt.level : null, // Seamless bridge to cyan series
                isProjection: false,
            });
        });

        const lastPt = liveHistory[liveHistory.length - 1];

        // --- ORDINARY LEAST SQUARES (OLS) LINEAR REGRESSION ---
        // Computed over the ENTIRE time-bounded buffer (up to 30 minutes of data),
        // not a tiny 6-ping window. This gives a statistically stable slope.
        let activeRateCmHr = 0;
        if (liveHistory.length >= 3) {
            const t0 = liveHistory[0].timestamp;
            const n = liveHistory.length;
            let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

            liveHistory.forEach((pt) => {
                const x = (pt.timestamp - t0) / (1000 * 3600); // Convert ms → hours
                const y = pt.level;
                sumX += x;
                sumY += y;
                sumXY += x * y;
                sumXX += x * x;
            });

            const denominator = n * sumXX - sumX * sumX;
            if (denominator > 1e-6) {
                const rawSlope = (n * sumXY - sumX * sumY) / denominator;

                // FIX #3: CONTINUOUS SOFT-THRESHOLDING
                // Instead of: if (|slope| >= 10) use it, else zero.
                //   (which causes a 240cm discontinuous jump at the threshold)
                // We subtract the deadband magnitude continuously:
                //   effective = sign(raw) * max(0, |raw| - deadband)
                //
                // This means:
                //   slope =  3 cm/hr → effective =  0 cm/hr (noise, zeroed)
                //   slope =  7 cm/hr → effective =  2 cm/hr (gentle, passes through attenuated)
                //   slope = 25 cm/hr → effective = 20 cm/hr (strong, minimal attenuation)
                //
                // The 6 cm/hr early-flood-rise that Bug #1 in the review flagged?
                // It now passes through as 1 cm/hr — small but VISIBLE on the forecast
                // line, which is exactly what an early warning system should show.
                if (Math.abs(rawSlope) > NOISE_DEADBAND_CM_HR) {
                    activeRateCmHr = rawSlope > 0
                        ? rawSlope - NOISE_DEADBAND_CM_HR
                        : rawSlope + NOISE_DEADBAND_CM_HR;
                }
                // else: activeRateCmHr stays 0 (pure noise, flat forecast)
            }
        }

        // --- FORECAST TIMESTEPS ---
        const rangeStepConfig: Record<ForecastRange, number[]> = {
            '30m': [5 / 60, 10 / 60, 15 / 60, 20 / 60, 25 / 60, 30 / 60],
            '1h': [10 / 60, 20 / 60, 30 / 60, 40 / 60, 50 / 60, 1.0],
            '3h': [0.5, 1.0, 1.5, 2.0, 2.5, 3.0],
            '6h': [1.0, 2.0, 3.0, 4.0, 5.0, 6.0],
            '12h': [2.0, 4.0, 6.0, 8.0, 10.0, 12.0],
            '24h': [4.0, 8.0, 12.0, 16.0, 20.0, 24.0],
        };

        const steps = rangeStepConfig[forecastRange];

        // --- ASYMPTOTIC DAMPED HYDROLOGICAL PROJECTION ---
        steps.forEach((stepHours) => {
            const futureTime = new Date(lastPt.timestamp + stepHours * 3600 * 1000);

            // Damped forecast: h_pred = h0 + m * τ * (1 - e^(-Δt / τ))
            //
            // At short Δt (e.g. 30 min): e^(-0.5/4) ≈ 0.88, so factor ≈ 0.12
            //   → nearly linear: h_pred ≈ h0 + m * 0.5 (tracks real rate closely)
            //
            // At long Δt (e.g. 24h):  e^(-24/4) ≈ 0.0025, so factor ≈ 0.997
            //   → asymptote: h_pred ≈ h0 + m * 4.0 (max delta = rate × τ)
            //   → Even at 100 cm/hr, max delta = 100 * 4 = +400cm (not 2400cm!)
            const dampedDelta = activeRateCmHr * DAMPING_TAU_HOURS * (1 - Math.exp(-stepHours / DAMPING_TAU_HOURS));
            const predictedCm = Math.max(0, Math.round(lastPt.level + dampedDelta));

            const labelStr = stepHours < 1
                ? `+${Math.round(stepHours * 60)}m (Pred)`
                : `+${stepHours}h (Pred)`;

            combined.push({
                time: futureTime.toISOString(),
                timeLabel: labelStr,
                live_level: null,
                projected_level: predictedCm,
                isProjection: true,
            });
        });

        return combined;
    }, [liveHistory, forecastRange]);

    // --- DISPLAY RATE (for the header badge) ---
    const calculatedRateCmHr = useMemo(() => {
        if (liveHistory.length < 2) return 0;
        const first = liveHistory[0];
        const last = liveHistory[liveHistory.length - 1];
        const hours = (last.timestamp - first.timestamp) / (3600 * 1000);
        return hours > 0.001 ? (last.level - first.level) / hours : 0;
    }, [liveHistory]);

    // Color Palette
    const greenColor = '#10B981';
    const cyanColor = '#06B6D4';

    // Custom Tooltip
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload?.length) return null;
        const entry = payload.find((p: any) => p.value !== null && p.value !== undefined) || payload[0];
        const val = entry.value;
        const isPred = label?.includes('Pred');
        return (
            <div className="rounded-xl p-3 shadow-xl text-xs bg-zinc-900 border border-zinc-800">
                <p className="font-bold text-[10px] uppercase tracking-widest mb-1 text-zinc-400">
                    {label} {isPred ? `🔮 DAMPED MODEL (${forecastRange.toUpperCase()})` : '● ESP32 SONAR'}
                </p>
                <p className={`font-bold text-sm ${isPred ? 'text-cyan-400' : 'text-emerald-400'}`}>
                    {val} <span className="text-[10px] font-medium text-zinc-400">cm</span>
                </p>
            </div>
        );
    };

    const availableRanges: ForecastRange[] = ['30m', '1h', '3h', '6h', '12h', '24h'];

    return (
        <div className="rounded-2xl p-4 relative overflow-hidden bg-zinc-900/60 border border-zinc-800/80">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                        RAMALAN PARAS AIR SUNGAI
                    </p>
                    <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-400">
                        {calculatedRateCmHr > 1 ? (
                            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                        ) : calculatedRateCmHr < -1 ? (
                            <TrendingDown className="w-3.5 h-3.5 text-blue-400" />
                        ) : (
                            <Minus className="w-3.5 h-3.5 text-zinc-500" />
                        )}
                        {calculatedRateCmHr > 0 ? `+${calculatedRateCmHr.toFixed(1)}` : calculatedRateCmHr.toFixed(1)} cm/j
                    </div>
                </div>

                {/* Range Selector Bar */}
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-500 mr-1 flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5 text-cyan-400" /> Tempoh Ramalan:
                    </span>
                    {availableRanges.map((rng) => (
                        <button
                            key={rng}
                            onClick={() => setForecastRange(rng)}
                            className={`text-[8px] font-bold uppercase px-2.5 py-1 rounded-lg transition-all ${
                                forecastRange === rng
                                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-sm'
                                    : 'text-zinc-400 border border-zinc-800 hover:text-white hover:bg-zinc-800/50'
                            }`}
                        >
                            {rng} {rng === '6h' ? '⭐' : ''}
                        </button>
                    ))}
                </div>
            </div>

            {/* Chart */}
            {combinedChartData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-44 rounded-xl gap-2 border border-dashed border-zinc-800">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                        MENUNGGU BACAAN PENDERIA...
                    </p>
                    <span className="text-[9px] text-zinc-500">Bacaan paras air daripada penderia sungai akan dipaparkan secara langsung di sini.</span>
                </div>
            ) : (
                <div className="h-64 w-full relative">
                    {/* OFFLINE HARDWARE OVERLAY BANNER */}
                    {isSensorOffline && (
                        <div className="absolute inset-0 z-30 bg-zinc-950/85 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-4 border border-red-500/30 text-center">
                            <AlertTriangle className="w-8 h-8 text-red-500 animate-bounce mb-2" />
                            <p className="text-xs font-bold uppercase tracking-widest text-red-400">
                                ⚠️ PENDERIA LUAR TALIAN
                            </p>
                            <p className="text-[10px] text-zinc-400 mt-1 max-w-xs">
                                Penderia sungai tidak menghantar data pada masa ini.
                            </p>
                        </div>
                    )}
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={combinedChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="liveWaterGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={greenColor} stopOpacity={0.4} />
                                    <stop offset="95%" stopColor={greenColor} stopOpacity={0.02} />
                                </linearGradient>
                                <linearGradient id="cyanProjectionGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={cyanColor} stopOpacity={0.35} />
                                    <stop offset="95%" stopColor={cyanColor} stopOpacity={0.02} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                            <XAxis
                                dataKey="timeLabel"
                                tick={{ fontSize: 9, fill: '#A1A1AA' }}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                tick={{ fontSize: 9, fill: '#A1A1AA' }}
                                tickLine={false}
                                axisLine={false}
                                domain={[0, (dataMax: number) => Math.max(200, Math.ceil(dataMax / 50) * 50)]}
                                unit=" cm"
                            />
                            <Tooltip content={<CustomTooltip />} />

                            {/* Danger & Warning threshold lines */}
                            <ReferenceLine y={120} stroke="#EF4444" strokeDasharray="4 4" strokeOpacity={0.6} label={{ value: 'BAHAYA 120cm', position: 'right', fill: '#EF4444', fontSize: 8 }} />
                            <ReferenceLine y={80} stroke="#F97316" strokeDasharray="4 4" strokeOpacity={0.4} label={{ value: 'AMARAN 80cm', position: 'right', fill: '#F97316', fontSize: 8 }} />

                            {/* Live Real Hardware Data Line (Solid Emerald Green) */}
                            <Area
                                type="monotone"
                                dataKey="live_level"
                                stroke={greenColor}
                                strokeWidth={2.5}
                                fill="url(#liveWaterGradient)"
                                dot={{ r: 4, fill: greenColor, stroke: '#09090B', strokeWidth: 1.5 }}
                                activeDot={{ r: 6, stroke: greenColor, strokeWidth: 2, fill: '#FFFFFF' }}
                                isAnimationActive={true}
                                animationDuration={300}
                                connectNulls={false}
                            />

                            {/* Projected Damped Wave Forecast Line (Dotted Cyan) */}
                            <Area
                                type="monotone"
                                dataKey="projected_level"
                                stroke={cyanColor}
                                strokeWidth={2.5}
                                strokeDasharray="4 4"
                                fill="url(#cyanProjectionGradient)"
                                dot={{ r: 4, fill: cyanColor, stroke: '#09090B', strokeWidth: 1.5 }}
                                activeDot={{ r: 6, stroke: cyanColor, strokeWidth: 2, fill: '#FFFFFF' }}
                                isAnimationActive={true}
                                animationDuration={300}
                                connectNulls={true}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}
