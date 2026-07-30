import { useState, useEffect } from 'react';

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

export function useWeather() {
    const [weather, setWeather] = useState<WeatherData>(DEFAULT_WEATHER);
    const [isWeatherLoading, setIsWeatherLoading] = useState(false);
    const [locationLabel, setLocationLabel] = useState('Locating...');
    const [userLat, setUserLat] = useState<number | null>(null);
    const [userLng, setUserLng] = useState<number | null>(null);

    useEffect(() => {
        let watchId: number | null = null;
        let lastFetchedLat: number | null = null;

        const fetchLocationName = (lat: number, lng: number) => {
            if (lastFetchedLat === lat) return;
            lastFetchedLat = lat;

            fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=12`, { headers: { 'User-Agent': 'NADI/1.0' } })
                .then(r => r.json())
                .then(d => { const a = d.address || {}; setLocationLabel(a.suburb || a.town || a.city || a.county || 'Unknown Location'); })
                .catch(() => { setLocationLabel('Unknown Location'); });

            fetch(`/api/weather?lat=${lat}&lng=${lng}`)
                .then(r => r.json())
                .then(d => { if (d.success && d.weather) setWeather(d.weather); })
                .catch(() => {});
        };

        if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
            watchId = navigator.geolocation.watchPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    setUserLat(latitude);
                    setUserLng(longitude);
                    fetchLocationName(latitude, longitude);
                },
                (error) => {
                    console.info("Geolocation unavailable or denied, falling back to Kuala Lumpur:", error.message || "Position unavailable");
                    // Default to Kuala Lumpur if geolocation fails or is denied
                    const klLat = 3.1390;
                    const klLng = 101.6869;
                    setUserLat(klLat);
                    setUserLng(klLng);
                    fetchLocationName(klLat, klLng);
                },
                { enableHighAccuracy: true, maximumAge: 60000, timeout: 10000 }
            );
        }

        return () => {
            if (watchId !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
                navigator.geolocation.clearWatch(watchId);
            }
        };
    }, []);

    return { weather, isWeatherLoading, locationLabel, userLat, userLng };
}
