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
    temp: 31,
    feelsLike: 33,
    humidity: 78,
    windSpeed: 12,
    rainMm: 0,
    floodRisk: 'Low',
    aqi: 42,
    pm25: 9.8,
    pm10: 18.2,
};

import { DEFAULT_LOCATION } from '@/src/config/constants';

export function useWeather() {
    const [weather, setWeather] = useState<WeatherData>(DEFAULT_WEATHER);
    const [isWeatherLoading, setIsWeatherLoading] = useState(false);
    const [locationLabel, setLocationLabel] = useState<string>(DEFAULT_LOCATION.label);
    const [userLat, setUserLat] = useState<number | null>(DEFAULT_LOCATION.lat);
    const [userLng, setUserLng] = useState<number | null>(DEFAULT_LOCATION.lng);
    const [isManualOverride, setIsManualOverride] = useState(false);

    const lastLatRef = useRef<number | null>(DEFAULT_LOCATION.lat);
    const lastLngRef = useRef<number | null>(DEFAULT_LOCATION.lng);
    const lastFetchTimeRef = useRef<number>(0);

    const setManualLocation = (lat: number, lng: number, label: string) => {
        setIsManualOverride(true);
        lastLatRef.current = lat;
        lastLngRef.current = lng;
        setUserLat(lat);
        setUserLng(lng);
        setLocationLabel(label);
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem('nadi_saved_user_location', JSON.stringify({ lat, lng, label }));
            } catch (e) {}
        }
        fetch(`/api/weather?lat=${lat}&lng=${lng}`)
            .then(r => r.json())
            .then(d => { if (d.success && d.weather) setWeather(d.weather); })
            .catch(() => {});
    };

    useEffect(() => {
        // Restore saved custom location from localStorage if available
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem('nadi_saved_user_location');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (parsed.lat && parsed.lng && parsed.label) {
                        setIsManualOverride(true);
                        setUserLat(parsed.lat);
                        setUserLng(parsed.lng);
                        setLocationLabel(parsed.label);
                        lastLatRef.current = parsed.lat;
                        lastLngRef.current = parsed.lng;
                        fetch(`/api/weather?lat=${parsed.lat}&lng=${parsed.lng}`)
                            .then(r => r.json())
                            .then(d => { if (d.success && d.weather) setWeather(d.weather); })
                            .catch(() => {});
                    }
                }
            } catch (e) {}
        }
    }, []);

    useEffect(() => {
        let watchId: number | null = null;

        const fetchLocationName = (lat: number, lng: number) => {
            const now = Date.now();
            if (now - lastFetchTimeRef.current < 15000) return; // Throttle to max once per 15s
            lastFetchTimeRef.current = now;

            fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=12`, { headers: { 'User-Agent': 'NADI/1.0' } })
                .then(r => r.json())
                .then(d => { const a = d.address || {}; setLocationLabel(a.suburb || a.town || a.city || a.county || DEFAULT_LOCATION.label); })
                .catch(() => { setLocationLabel(DEFAULT_LOCATION.label); });

            fetch(`/api/weather?lat=${lat}&lng=${lng}`)
                .then(r => r.json())
                .then(d => { if (d.success && d.weather) setWeather(d.weather); })
                .catch(() => {});
        };

        if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
            watchId = navigator.geolocation.watchPosition(
                (position) => {
                    if (isManualOverride) return; // Do not overwrite user's saved location!
                    const { latitude, longitude, accuracy } = position.coords;
                    if (accuracy < 5000) {
                        // Only update if moved by more than ~150 meters (0.0015 degrees)
                        if (
                            lastLatRef.current !== null &&
                            lastLngRef.current !== null &&
                            Math.abs(latitude - lastLatRef.current) < 0.0015 &&
                            Math.abs(longitude - lastLngRef.current) < 0.0015
                        ) {
                            return;
                        }

                        lastLatRef.current = latitude;
                        lastLngRef.current = longitude;
                        setUserLat(latitude);
                        setUserLng(longitude);
                        fetchLocationName(latitude, longitude);
                    }
                },
                (error) => {
                    console.info("Geolocation unavailable, using default location:", error.message || "Position unavailable");
                },
                { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 }
            );
        }

        return () => {
            if (watchId !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
                navigator.geolocation.clearWatch(watchId);
            }
        };
    }, [isManualOverride]);

    const resetToAutoGps = () => {
        setIsManualOverride(false);
        if (typeof window !== 'undefined') {
            try {
                localStorage.removeItem('nadi_saved_user_location');
            } catch (e) {}
        }
    };

    return { weather, isWeatherLoading, locationLabel, userLat, userLng, setManualLocation, isManualOverride, resetToAutoGps };
}
