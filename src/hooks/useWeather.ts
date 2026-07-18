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

export function useWeather() {
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [isWeatherLoading, setIsWeatherLoading] = useState(true);
    const [locationLabel, setLocationLabel] = useState('Locating...');
    const [userLat, setUserLat] = useState<number | null>(null);
    const [userLng, setUserLng] = useState<number | null>(null);

    useEffect(() => {
        let watchId: number | null = null;
        let lastFetchedLat: number | null = null;

        const fetchLocationName = (lat: number, lng: number) => {
            // Prevent spamming the geocoding API
            if (lastFetchedLat === lat) return;
            lastFetchedLat = lat;

            fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=12`, { headers: { 'User-Agent': 'NADI/1.0' } })
                .then(r => r.json())
                .then(d => { const a = d.address || {}; setLocationLabel(a.suburb || a.town || a.city || a.county || 'Unknown Location'); })
                .catch(() => { setLocationLabel('Unknown Location'); });

            setIsWeatherLoading(true);
            fetch(`/api/weather?lat=${lat}&lng=${lng}`)
                .then(r => r.json())
                .then(d => { if (d.success) setWeather(d.weather); })
                .catch(() => {})
                .finally(() => setIsWeatherLoading(false));
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
                    console.error("Error getting location:", error);
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
