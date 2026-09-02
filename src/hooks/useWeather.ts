/**
 * Weather & Geolocation Hook
 * 
 * Fetches current weather conditions and air quality based on the user's GPS
 * location or a manually selected location. Uses a reactive global singleton store
 * so all views (Utama, Bencana, Ambient) stay 100% synchronized in real time.
 */
import { useState, useEffect, useRef } from 'react';

export interface WeatherData {
    temp: number;
    feelsLike: number;
    humidity: number;
    windSpeed: number;
    rainMm: number;
    floodRisk: string;
    aqi: number;
    pm25: number;
    pm10: number;
}

const DEFAULT_WEATHER: WeatherData = {
    temp: 30,
    feelsLike: 32,
    humidity: 75,
    windSpeed: 10,
    rainMm: 0,
    floodRisk: 'Low',
    aqi: 50,
    pm25: 10,
    pm10: 20,
};

// ── Shared Singleton Store ─────────────────────────────────────────
let globalWeather: WeatherData = DEFAULT_WEATHER;
let globalLocationLabel: string = 'Lokasi Semasa';
let globalUserLat: number | null = null;
let globalUserLng: number | null = null;
let globalIsManualOverride: boolean = false;
let globalIsWeatherLoading: boolean = false;
let globalLastFetchTime = 0;
let globalLastLat: number | null = null;
let globalLastLng: number | null = null;
let isGeoInitialized = false;

const listeners = new Set<() => void>();

function notifyListeners() {
    listeners.forEach(fn => fn());
}

function updateGlobalWeather(data: Partial<{
    weather: WeatherData;
    locationLabel: string;
    userLat: number | null;
    userLng: number | null;
    isManualOverride: boolean;
    isWeatherLoading: boolean;
}>) {
    if (data.weather !== undefined) globalWeather = data.weather;
    if (data.locationLabel !== undefined) globalLocationLabel = data.locationLabel;
    if (data.userLat !== undefined) globalUserLat = data.userLat;
    if (data.userLng !== undefined) globalUserLng = data.userLng;
    if (data.isManualOverride !== undefined) globalIsManualOverride = data.isManualOverride;
    if (data.isWeatherLoading !== undefined) globalIsWeatherLoading = data.isWeatherLoading;
    notifyListeners();
}

async function fetchWeatherAndGeocodeGlobal(lat: number, lng: number, manualLabel?: string) {
    const now = Date.now();
    // Throttle duplicate fetches within 3 seconds unless forced
    if (now - globalLastFetchTime < 3000 && globalLastLat === lat && globalLastLng === lng) {
        return;
    }
    globalLastFetchTime = now;
    globalLastLat = lat;
    globalLastLng = lng;

    updateGlobalWeather({ isWeatherLoading: true, userLat: lat, userLng: lng });

    try {
        const res = await fetch(`/api/weather?lat=${lat}&lng=${lng}`);
        const d = await res.json();
        
        let newLabel = globalLocationLabel;
        if (manualLabel) {
            newLabel = manualLabel;
        } else if (d.location) {
            newLabel = d.location;
        } else if (!globalLocationLabel || globalLocationLabel === 'Lokasi Semasa') {
            newLabel = `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`;
        }

        updateGlobalWeather({
            weather: d.weather || globalWeather,
            locationLabel: newLabel,
            isWeatherLoading: false
        });
    } catch {
        updateGlobalWeather({ isWeatherLoading: false });
    }
}

export function useWeather() {
    const [weather, setWeather] = useState<WeatherData>(globalWeather);
    const [isWeatherLoading, setIsWeatherLoading] = useState<boolean>(globalIsWeatherLoading);
    const [locationLabel, setLocationLabel] = useState<string>(globalLocationLabel);
    const [userLat, setUserLat] = useState<number | null>(globalUserLat);
    const [userLng, setUserLng] = useState<number | null>(globalUserLng);
    const [isManualOverride, setIsManualOverride] = useState<boolean>(globalIsManualOverride);

    // Sync with singleton store
    useEffect(() => {
        const sync = () => {
            setWeather(globalWeather);
            setIsWeatherLoading(globalIsWeatherLoading);
            setLocationLabel(globalLocationLabel);
            setUserLat(globalUserLat);
            setUserLng(globalUserLng);
            setIsManualOverride(globalIsManualOverride);
        };
        listeners.add(sync);
        // Initial sync in case global state changed before mount
        sync();
        return () => {
            listeners.delete(sync);
        };
    }, []);

    const setManualLocation = (lat: number, lng: number, label: string) => {
        updateGlobalWeather({ isManualOverride: true, locationLabel: label, userLat: lat, userLng: lng });
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem('nadi_saved_user_location', JSON.stringify({ lat, lng, label }));
            } catch (e) {}
        }
        fetchWeatherAndGeocodeGlobal(lat, lng, label);
    };

    const resetToAutoGps = () => {
        updateGlobalWeather({ isManualOverride: false });
        if (typeof window !== 'undefined') {
            try {
                localStorage.removeItem('nadi_saved_user_location');
            } catch (e) {}
        }
        if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition((pos) => {
                const { latitude, longitude } = pos.coords;
                fetchWeatherAndGeocodeGlobal(latitude, longitude);
            });
        }
    };

    // Initialize GPS / Storage only once globally
    useEffect(() => {
        if (isGeoInitialized) return;
        isGeoInitialized = true;

        // 1. Check saved custom location in localStorage
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem('nadi_saved_user_location');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (parsed.lat && parsed.lng && parsed.label) {
                        updateGlobalWeather({
                            isManualOverride: true,
                            userLat: parsed.lat,
                            userLng: parsed.lng,
                            locationLabel: parsed.label
                        });
                        fetchWeatherAndGeocodeGlobal(parsed.lat, parsed.lng, parsed.label);
                        return;
                    }
                }
            } catch (e) {}
        }

        // 2. Fetch browser GPS
        if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    if (globalIsManualOverride) return;
                    const { latitude, longitude } = pos.coords;
                    fetchWeatherAndGeocodeGlobal(latitude, longitude);
                },
                () => {
                    // Fallback to default coordinates (e.g. Kuala Lumpur / Kota Bharu) if GPS permission denied
                    if (!globalUserLat) {
                        fetchWeatherAndGeocodeGlobal(3.1390, 101.6869);
                    }
                },
                { enableHighAccuracy: true, timeout: 5000 }
            );

            // Watch position updates
            navigator.geolocation.watchPosition(
                (position) => {
                    if (globalIsManualOverride) return;
                    const { latitude, longitude, accuracy } = position.coords;
                    if (accuracy < 5000) {
                        if (
                            globalLastLat !== null &&
                            globalLastLng !== null &&
                            Math.abs(latitude - globalLastLat) < 0.0015 &&
                            Math.abs(longitude - globalLastLng) < 0.0015
                        ) {
                            return;
                        }
                        fetchWeatherAndGeocodeGlobal(latitude, longitude);
                    }
                },
                () => {},
                { enableHighAccuracy: true, maximumAge: 15000, timeout: 10000 }
            );
        }
    }, []);

    return {
        weather,
        isWeatherLoading,
        locationLabel,
        userLat,
        userLng,
        setManualLocation,
        isManualOverride,
        resetToAutoGps
    };
}
