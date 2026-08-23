/**
 * Weather & Geolocation Hook
 * 
 * Fetches current weather conditions and air quality based on the user's GPS
 * location or a manually selected location.
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

export function useWeather() {
    const [weather, setWeather] = useState<WeatherData>(DEFAULT_WEATHER);
    const [isWeatherLoading, setIsWeatherLoading] = useState(false);
    const [locationLabel, setLocationLabel] = useState<string>('Lokasi Semasa');
    const [userLat, setUserLat] = useState<number | null>(null);
    const [userLng, setUserLng] = useState<number | null>(null);
    const [isManualOverride, setIsManualOverride] = useState(false);

    const lastLatRef = useRef<number | null>(null);
    const lastLngRef = useRef<number | null>(null);
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
        setIsWeatherLoading(true);
        fetch(`/api/weather?lat=${lat}&lng=${lng}`)
            .then(r => r.json())
            .then(d => {
                if (d.weather) setWeather(d.weather);
                if (d.location && !label) setLocationLabel(d.location);
            })
            .catch(() => {})
            .finally(() => setIsWeatherLoading(false));
    };

    const fetchWeatherAndGeocode = (lat: number, lng: number) => {
        const now = Date.now();
        if (now - lastFetchTimeRef.current < 5000) return; // Throttles requests to once every 5 seconds
        lastFetchTimeRef.current = now;

        setIsWeatherLoading(true);
        fetch(`/api/weather?lat=${lat}&lng=${lng}`)
            .then(r => r.json())
            .then(d => {
                if (d.weather) setWeather(d.weather);
                if (d.location) {
                    setLocationLabel(d.location);
                } else {
                    setLocationLabel(`${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`);
                }
            })
            .catch(() => {
                setLocationLabel(`${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`);
            })
            .finally(() => setIsWeatherLoading(false));
    };

    useEffect(() => {
        // Restores custom saved location from localStorage if present
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
                        fetchWeatherAndGeocode(parsed.lat, parsed.lng);
                        return;
                    }
                }
            } catch (e) {}
        }
    }, []);

    useEffect(() => {
        let watchId: number | null = null;

        if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
            // Initial GPS lookup
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    if (isManualOverride) return;
                    const { latitude, longitude } = pos.coords;
                    lastLatRef.current = latitude;
                    lastLngRef.current = longitude;
                    setUserLat(latitude);
                    setUserLng(longitude);
                    fetchWeatherAndGeocode(latitude, longitude);
                },
                () => {},
                { enableHighAccuracy: true, timeout: 5000 }
            );

            // Watches GPS and updates when device moves more than ~150 meters
            watchId = navigator.geolocation.watchPosition(
                (position) => {
                    if (isManualOverride) return;
                    const { latitude, longitude, accuracy } = position.coords;
                    if (accuracy < 5000) {
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
                        fetchWeatherAndGeocode(latitude, longitude);
                    }
                },
                (error) => {
                    console.info("Geolocation info:", error.message || "Position update pending");
                },
                { enableHighAccuracy: true, maximumAge: 15000, timeout: 10000 }
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
        if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition((pos) => {
                const { latitude, longitude } = pos.coords;
                lastLatRef.current = latitude;
                lastLngRef.current = longitude;
                setUserLat(latitude);
                setUserLng(longitude);
                fetchWeatherAndGeocode(latitude, longitude);
            });
        }
    };

    return { weather, isWeatherLoading, locationLabel, userLat, userLng, setManualLocation, isManualOverride, resetToAutoGps };
}
