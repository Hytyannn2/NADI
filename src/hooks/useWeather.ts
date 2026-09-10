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
    weatherCode?: number;
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

// ── Weather Simulation Presets for Testing ───────────────────────────
type SimulatedWeather = 'auto' | 'thunderstorm' | 'heavy_rain' | 'drizzle' | 'sunny' | 'cloudy' | 'night' | 'heat' | 'flood';

interface WeatherPresetInfo {
    id: SimulatedWeather;
    label: string;
    icon: string;
    description: string;
    weather: WeatherData;
    locationLabel: string;
}

const SIMULATED_WEATHER_PRESETS: Record<Exclude<SimulatedWeather, 'auto'>, WeatherPresetInfo> = {
    thunderstorm: {
        id: 'thunderstorm',
        label: 'Ribut Petir',
        icon: '⚡',
        description: 'Ribut petir kuat, kilat bersabung & hujan lebat',
        weather: {
            temp: 24,
            feelsLike: 26,
            humidity: 94,
            windSpeed: 38,
            rainMm: 32.5,
            floodRisk: 'High',
            weatherCode: 95,
            aqi: 22,
            pm25: 5,
            pm10: 10,
        },
        locationLabel: 'Kota Bharu (Zon Ribut)',
    },
    heavy_rain: {
        id: 'heavy_rain',
        label: 'Hujan Lebat',
        icon: '🌧️',
        description: 'Hujan monsun lebat & jalan berair',
        weather: {
            temp: 25,
            feelsLike: 27,
            humidity: 90,
            windSpeed: 22,
            rainMm: 16.4,
            floodRisk: 'Moderate',
            weatherCode: 65,
            aqi: 25,
            pm25: 6,
            pm10: 12,
        },
        locationLabel: 'Pasir Mas (Hujan Monsun)',
    },
    drizzle: {
        id: 'drizzle',
        label: 'Hujan Renyai',
        icon: '🌦️',
        description: 'Gerimis lembut & udara sejuk berkabut',
        weather: {
            temp: 26,
            feelsLike: 28,
            humidity: 82,
            windSpeed: 9,
            rainMm: 1.8,
            floodRisk: 'Low',
            weatherCode: 53,
            aqi: 35,
            pm25: 8,
            pm10: 15,
        },
        locationLabel: 'Tanah Merah (Gerimis Pagi)',
    },
    sunny: {
        id: 'sunny',
        label: 'Panas Terik',
        icon: '☀️',
        description: 'Langit cerah berpanjangan & haba nyaman (34°C)',
        weather: {
            temp: 34,
            feelsLike: 41,
            humidity: 58,
            windSpeed: 7,
            rainMm: 0,
            floodRisk: 'Low',
            weatherCode: 0,
            aqi: 65,
            pm25: 18,
            pm10: 30,
        },
        locationLabel: 'Sri Petaling, KL (Cerah)',
    },
    heat: {
        id: 'heat',
        label: 'Gelombang Haba',
        icon: '🔥',
        description: 'Cuaca ekstrem panas & amaran dehidrasi (39°C)',
        weather: {
            temp: 39,
            feelsLike: 47,
            humidity: 48,
            windSpeed: 5,
            rainMm: 0,
            floodRisk: 'Low',
            weatherCode: 0,
            aqi: 95,
            pm25: 32,
            pm10: 48,
        },
        locationLabel: 'Chuping, Perlis (Gelombang Haba)',
    },
    cloudy: {
        id: 'cloudy',
        label: 'Mendung',
        icon: '☁️',
        description: 'Awan tebal berarak & bayu redup',
        weather: {
            temp: 28,
            feelsLike: 30,
            humidity: 78,
            windSpeed: 14,
            rainMm: 0,
            floodRisk: 'Low',
            weatherCode: 3,
            aqi: 45,
            pm25: 12,
            pm10: 22,
        },
        locationLabel: 'Tumpat (Mendung)',
    },
    night: {
        id: 'night',
        label: 'Malam Tenang',
        icon: '🌙',
        description: 'Malam berbintang & suhu sejuk (22°C)',
        weather: {
            temp: 22,
            feelsLike: 23,
            humidity: 74,
            windSpeed: 4,
            rainMm: 0,
            floodRisk: 'Low',
            weatherCode: 0,
            aqi: 30,
            pm25: 7,
            pm10: 14,
        },
        locationLabel: 'Kundasang / Cameron (Malam Sejuk)',
    },
    flood: {
        id: 'flood',
        label: 'Amaran Banjir',
        icon: '🚨',
        description: 'Paras air sungai melimpah & hujan ekstrem',
        weather: {
            temp: 23,
            feelsLike: 25,
            humidity: 98,
            windSpeed: 45,
            rainMm: 48.0,
            floodRisk: 'High',
            weatherCode: 99,
            aqi: 20,
            pm25: 4,
            pm10: 8,
        },
        locationLabel: 'Rantau Panjang (Amaran Bahaya)',
    },
};

// ── Shared Singleton Store ─────────────────────────────────────────
let globalWeather: WeatherData = DEFAULT_WEATHER;
let globalLocationLabel: string = 'Lokasi Semasa';
let globalUserLat: number | null = null;
let globalUserLng: number | null = null;
let globalIsManualOverride: boolean = false;
let globalIsWeatherLoading: boolean = false;
let globalSimulatedWeather: SimulatedWeather = 'auto';
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
    simulatedWeather: SimulatedWeather;
}>) {
    if (data.weather !== undefined) globalWeather = data.weather;
    if (data.locationLabel !== undefined) globalLocationLabel = data.locationLabel;
    if (data.userLat !== undefined) globalUserLat = data.userLat;
    if (data.userLng !== undefined) globalUserLng = data.userLng;
    if (data.isManualOverride !== undefined) globalIsManualOverride = data.isManualOverride;
    if (data.isWeatherLoading !== undefined) globalIsWeatherLoading = data.isWeatherLoading;
    if (data.simulatedWeather !== undefined) globalSimulatedWeather = data.simulatedWeather;
    notifyListeners();
}

async function fetchWeatherAndGeocodeGlobal(lat: number, lng: number, manualLabel?: string) {
    if (globalSimulatedWeather !== 'auto') return; // Don't overwrite simulated test state
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
    const [simulatedWeather, setSimulatedWeatherState] = useState<SimulatedWeather>(globalSimulatedWeather);

    // Sync with singleton store
    useEffect(() => {
        const sync = () => {
            setWeather(globalWeather);
            setIsWeatherLoading(globalIsWeatherLoading);
            setLocationLabel(globalLocationLabel);
            setUserLat(globalUserLat);
            setUserLng(globalUserLng);
            setIsManualOverride(globalIsManualOverride);
            setSimulatedWeatherState(globalSimulatedWeather);
        };
        listeners.add(sync);
        sync();
        return () => {
            listeners.delete(sync);
        };
    }, []);

    const setSimulatedWeather = (presetId: SimulatedWeather) => {
        if (presetId === 'auto') {
            updateGlobalWeather({
                simulatedWeather: 'auto',
                isManualOverride: false,
            });
            if (typeof window !== 'undefined') {
                const url = new URL(window.location.href);
                url.searchParams.delete('sim_weather');
                url.searchParams.delete('weather');
                window.history.replaceState({}, '', url.toString());
            }
            if (globalUserLat && globalUserLng) {
                fetchWeatherAndGeocodeGlobal(globalUserLat, globalUserLng);
            } else {
                fetchWeatherAndGeocodeGlobal(3.1390, 101.6869);
            }
            return;
        }

        const preset = SIMULATED_WEATHER_PRESETS[presetId];
        if (preset) {
            updateGlobalWeather({
                simulatedWeather: presetId,
                weather: preset.weather,
                locationLabel: preset.locationLabel,
                isWeatherLoading: false,
            });
            if (typeof window !== 'undefined') {
                const url = new URL(window.location.href);
                url.searchParams.set('sim_weather', presetId);
                window.history.replaceState({}, '', url.toString());
            }
        }
    };

    const setManualLocation = (lat: number, lng: number, label: string) => {
        updateGlobalWeather({ isManualOverride: true, locationLabel: label, userLat: lat, userLng: lng, simulatedWeather: 'auto' });
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem('nadi_saved_user_location', JSON.stringify({ lat, lng, label }));
            } catch (e) {}
        }
        fetchWeatherAndGeocodeGlobal(lat, lng, label);
    };

    const resetToAutoGps = () => {
        updateGlobalWeather({ isManualOverride: false, simulatedWeather: 'auto' });
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

    // Initialize GPS / Storage / URL Simulation only once globally
    useEffect(() => {
        if (isGeoInitialized) return;
        isGeoInitialized = true;

        // 1. Check URL parameters for ?sim_weather= or ?weather=
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const simParam = (params.get('sim_weather') || params.get('weather')) as SimulatedWeather;
            if (simParam && simParam in SIMULATED_WEATHER_PRESETS) {
                const preset = SIMULATED_WEATHER_PRESETS[simParam as Exclude<SimulatedWeather, 'auto'>];
                updateGlobalWeather({
                    simulatedWeather: simParam,
                    weather: preset.weather,
                    locationLabel: preset.locationLabel,
                });
                return;
            }
        }

        // 2. Check saved custom location in localStorage
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

        // 3. Fetch browser GPS
        if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    if (globalIsManualOverride || globalSimulatedWeather !== 'auto') return;
                    const { latitude, longitude } = pos.coords;
                    fetchWeatherAndGeocodeGlobal(latitude, longitude);
                },
                () => {
                    if (!globalUserLat && globalSimulatedWeather === 'auto') {
                        fetchWeatherAndGeocodeGlobal(3.1390, 101.6869);
                    }
                },
                { enableHighAccuracy: true, timeout: 5000 }
            );

            // Watch position updates
            navigator.geolocation.watchPosition(
                (position) => {
                    if (globalIsManualOverride || globalSimulatedWeather !== 'auto') return;
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
        simulatedWeather,
        setSimulatedWeather,
        setManualLocation,
        isManualOverride,
        resetToAutoGps
    };
}
