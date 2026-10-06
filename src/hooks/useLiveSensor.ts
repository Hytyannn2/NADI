/**
 * Live river/BME280 sensor telemetry for the default node.
 * Polls /api/bencana/sensors while the tab is visible (paused when hidden),
 * optionally also listening to Supabase Realtime row updates.
 */
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/src/lib/supabase/client';
import { DEFAULT_SENSOR_NODE } from '@/src/config/constants';

export interface SensorData {
    id: string | null;
    status: 'safe' | 'warning' | 'danger' | 'offline' | 'sensor_fault' | string;
    water_level: number;
    battery_pct: number | null;
    rssi_dbm: number | null;
    temperature_c: number | null;
    humidity_pct: number | null;
    pressure_hpa: number | null;
    rise_rate_cm_hr: number;
    last_reading: string | null;
    is_online: boolean;
}

/** Raw sensor row as stored in nadi_bencana_sensors / returned by the API. */
interface SensorRow {
    id?: string | null;
    name?: string;
    status?: string | null;
    water_level?: number | null;
    battery_pct?: number | null;
    rssi_dbm?: number | null;
    temperature_c?: number | null;
    humidity_pct?: number | null;
    pressure_hpa?: number | null;
    rise_rate_cm_hr?: number | null;
    last_reading?: string | null;
    is_online?: boolean | null;
}

export const INITIAL_SENSOR_DATA: SensorData = {
    id: null, status: 'safe', water_level: 0, battery_pct: null, rssi_dbm: null,
    temperature_c: null, humidity_pct: null, pressure_hpa: null,
    rise_rate_cm_hr: 0, last_reading: null, is_online: false,
};

const STALE_MS = 30_000;

function toSensorData(r: SensorRow): SensorData {
    const lastReadingTs = r.last_reading ? new Date(r.last_reading).getTime() : 0;
    const isStale = !lastReadingTs || Date.now() - lastReadingTs > STALE_MS;
    const online = r.is_online !== false && !isStale && r.status !== 'sensor_fault' && r.status !== 'offline';
    return {
        id: r.id ?? null,
        status: online ? (r.status || 'safe') : 'offline',
        water_level: r.water_level ?? 0,
        battery_pct: r.battery_pct ?? null,
        rssi_dbm: r.rssi_dbm ?? null,
        temperature_c: r.temperature_c ?? null,
        humidity_pct: r.humidity_pct ?? null,
        pressure_hpa: r.pressure_hpa ?? null,
        rise_rate_cm_hr: r.rise_rate_cm_hr ?? 0,
        last_reading: r.last_reading ?? null,
        is_online: online,
    };
}

export function useLiveSensor({ intervalMs = 5000, realtime = false }: { intervalMs?: number; realtime?: boolean } = {}): SensorData {
    const [sensor, setSensor] = useState<SensorData>(INITIAL_SENSOR_DATA);

    useEffect(() => {
        let timer: ReturnType<typeof setInterval> | undefined;
        let inflight: AbortController | undefined;

        const fetchLatest = () => {
            inflight?.abort();
            inflight = new AbortController();
            fetch(`/api/bencana/sensors?_t=${Date.now()}`, { cache: 'no-store', signal: inflight.signal })
                .then(res => res.json())
                .then((d: { success?: boolean; sensors?: SensorRow[] }) => {
                    const list = d.success && Array.isArray(d.sensors) ? d.sensors : [];
                    const target = list.find(s => s.name === DEFAULT_SENSOR_NODE) || list[0];
                    if (target) setSensor(toSensorData(target));
                })
                .catch(() => {}); // network blip or abort: keep last known reading
        };

        const start = () => {
            fetchLatest();
            if (!timer) timer = setInterval(fetchLatest, intervalMs);
        };
        const stop = () => {
            clearInterval(timer);
            timer = undefined;
            inflight?.abort();
        };
        const onVisibility = () => (document.visibilityState === 'visible' ? start() : stop());

        if (document.visibilityState === 'visible') start();
        document.addEventListener('visibilitychange', onVisibility);

        const supabase = realtime ? createClient() : null;
        const channel = supabase?.channel('sensor_changes')
            .on('postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'nadi_bencana_sensors', filter: `name=eq.${DEFAULT_SENSOR_NODE}` },
                (payload) => { if (payload.new) setSensor(toSensorData(payload.new as SensorRow)); })
            .subscribe();

        return () => {
            stop();
            document.removeEventListener('visibilitychange', onVisibility);
            if (supabase && channel) supabase.removeChannel(channel);
        };
    }, [intervalMs, realtime]);

    return sensor;
}
