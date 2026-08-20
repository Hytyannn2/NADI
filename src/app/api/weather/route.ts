import { NextResponse } from 'next/server';

// Comprehensive Malaysian District & City Centroids for instant offline fallback reverse-geocoding
const MALAYSIA_LOCATIONS: { name: string; state: string; lat: number; lng: number }[] = [
    // Terengganu
    { name: 'Kuala Terengganu', state: 'Terengganu', lat: 5.3302, lng: 103.1408 },
    { name: 'Kuala Nerus', state: 'Terengganu', lat: 5.3856, lng: 103.0789 },
    { name: 'Marang', state: 'Terengganu', lat: 5.2056, lng: 103.2059 },
    { name: 'Dungun', state: 'Terengganu', lat: 4.7753, lng: 103.4162 },
    { name: 'Kemaman / Chukai', state: 'Terengganu', lat: 4.2333, lng: 103.4167 },
    { name: 'Hulu Terengganu / Kuala Berang', state: 'Terengganu', lat: 5.0667, lng: 103.0167 },
    { name: 'Setiu', state: 'Terengganu', lat: 5.5667, lng: 102.7333 },
    { name: 'Besut / Jerteh', state: 'Terengganu', lat: 5.7500, lng: 102.5500 },

    // Kelantan
    { name: 'Kota Bharu', state: 'Kelantan', lat: 6.1254, lng: 102.2381 },
    { name: 'Pasir Mas', state: 'Kelantan', lat: 6.0433, lng: 102.1400 },
    { name: 'Tumpat', state: 'Kelantan', lat: 6.1983, lng: 102.1678 },
    { name: 'Bachok', state: 'Kelantan', lat: 6.0667, lng: 102.4000 },
    { name: 'Pasir Puteh', state: 'Kelantan', lat: 5.8333, lng: 102.4000 },
    { name: 'Machang', state: 'Kelantan', lat: 5.7667, lng: 102.2167 },
    { name: 'Tanah Merah', state: 'Kelantan', lat: 5.8083, lng: 102.1472 },
    { name: 'Kuala Krai', state: 'Kelantan', lat: 5.5319, lng: 102.2008 },
    { name: 'Jeli', state: 'Kelantan', lat: 5.6983, lng: 101.8425 },
    { name: 'Gua Musang', state: 'Kelantan', lat: 4.8822, lng: 101.9686 },

    // Pahang
    { name: 'Kuantan', state: 'Pahang', lat: 3.8077, lng: 103.3260 },
    { name: 'Temerloh', state: 'Pahang', lat: 3.4489, lng: 102.4172 },
    { name: 'Bentong', state: 'Pahang', lat: 3.5222, lng: 101.9083 },
    { name: 'Pekan', state: 'Pahang', lat: 3.4836, lng: 103.3996 },
    { name: 'Rompin', state: 'Pahang', lat: 2.8167, lng: 103.4833 },
    { name: 'Maran', state: 'Pahang', lat: 3.5833, lng: 102.7667 },
    { name: 'Jerantut', state: 'Pahang', lat: 3.9333, lng: 102.3667 },
    { name: 'Lipis', state: 'Pahang', lat: 4.1842, lng: 102.0467 },
    { name: 'Raub', state: 'Pahang', lat: 3.7897, lng: 101.8572 },
    { name: 'Cameron Highlands', state: 'Pahang', lat: 4.4714, lng: 101.3764 },

    // Klang Valley / Selangor / KL / Putrajaya
    { name: 'Kuala Lumpur', state: 'W.P. Kuala Lumpur', lat: 3.1390, lng: 101.6869 },
    { name: 'Putrajaya', state: 'W.P. Putrajaya', lat: 2.9264, lng: 101.6964 },
    { name: 'Petaling Jaya', state: 'Selangor', lat: 3.1073, lng: 101.6067 },
    { name: 'Shah Alam', state: 'Selangor', lat: 3.0738, lng: 101.5183 },
    { name: 'Subang Jaya', state: 'Selangor', lat: 3.0567, lng: 101.5851 },
    { name: 'Klang', state: 'Selangor', lat: 3.0449, lng: 101.4456 },
    { name: 'Kajang / Bangi', state: 'Selangor', lat: 2.9927, lng: 101.7909 },
    { name: 'Cyberjaya / Sepang', state: 'Selangor', lat: 2.9213, lng: 101.6559 },
    { name: 'Gombak / Selayang', state: 'Selangor', lat: 3.2379, lng: 101.6543 },
    { name: 'Rawang', state: 'Selangor', lat: 3.3214, lng: 101.5768 },

    // Perak
    { name: 'Ipoh', state: 'Perak', lat: 4.5975, lng: 101.0901 },
    { name: 'Taiping', state: 'Perak', lat: 4.8500, lng: 100.7333 },
    { name: 'Teluk Intan', state: 'Perak', lat: 4.0259, lng: 101.0213 },
    { name: 'Manjung / Seri Manjung', state: 'Perak', lat: 4.1978, lng: 100.6653 },

    // Penang & Kedah & Perlis
    { name: 'George Town', state: 'Pulau Pinang', lat: 5.4141, lng: 100.3288 },
    { name: 'Butterworth / Seberang Perai', state: 'Pulau Pinang', lat: 5.3991, lng: 100.3638 },
    { name: 'Alor Setar', state: 'Kedah', lat: 6.1248, lng: 100.3678 },
    { name: 'Sungai Petani', state: 'Kedah', lat: 5.6470, lng: 100.4877 },
    { name: 'Kulim', state: 'Kedah', lat: 5.3649, lng: 100.5618 },
    { name: 'Langkawi', state: 'Kedah', lat: 6.3500, lng: 99.8000 },
    { name: 'Kangar', state: 'Perlis', lat: 6.4414, lng: 100.1986 },

    // Negeri Sembilan & Melaka & Johor
    { name: 'Seremban', state: 'Negeri Sembilan', lat: 2.7258, lng: 101.9424 },
    { name: 'Port Dickson', state: 'Negeri Sembilan', lat: 2.5228, lng: 101.7961 },
    { name: 'Bandaraya Melaka', state: 'Melaka', lat: 2.1896, lng: 102.2501 },
    { name: 'Johor Bahru', state: 'Johor', lat: 1.4927, lng: 103.7414 },
    { name: 'Batu Pahat', state: 'Johor', lat: 1.8548, lng: 102.9325 },
    { name: 'Muar', state: 'Johor', lat: 2.0442, lng: 102.5689 },
    { name: 'Kluang', state: 'Johor', lat: 2.0305, lng: 103.3187 },

    // Sabah & Sarawak
    { name: 'Kuching', state: 'Sarawak', lat: 1.5533, lng: 110.3592 },
    { name: 'Miri', state: 'Sarawak', lat: 4.3995, lng: 113.9914 },
    { name: 'Sibu', state: 'Sarawak', lat: 2.3000, lng: 111.8167 },
    { name: 'Kota Kinabalu', state: 'Sabah', lat: 5.9804, lng: 116.0735 },
    { name: 'Sandakan', state: 'Sabah', lat: 5.8388, lng: 118.1173 },
    { name: 'Tawau', state: 'Sabah', lat: 4.2447, lng: 117.8912 },
    { name: 'Labuan', state: 'W.P. Labuan', lat: 5.2831, lng: 115.2308 }
];

function getNearestLocation(lat: number, lng: number): { name: string; state: string } {
    let bestDist = Infinity;
    let bestLoc = { name: 'Lokasi Semasa', state: 'Malaysia' };

    for (const loc of MALAYSIA_LOCATIONS) {
        const dLat = loc.lat - lat;
        const dLng = loc.lng - lng;
        const distSq = dLat * dLat + dLng * dLng;
        if (distSq < bestDist) {
            bestDist = distSq;
            bestLoc = loc;
        }
    }
    // If within ~35km of a known town/city centroid
    if (bestDist < 0.15) {
        return bestLoc;
    }
    return { name: `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`, state: 'Malaysia' };
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const latParam = searchParams.get('lat');
    const lngParam = searchParams.get('lng');

    const numLat = latParam ? parseFloat(latParam) : 3.1390;
    const numLng = lngParam ? parseFloat(lngParam) : 101.6869;

    try {
        // Parallel fetch: Open-Meteo Weather, Open-Meteo AQI, and Server-Side Reverse Geocoding
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${numLat}&longitude=${numLng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,weather_code,wind_speed_10m,surface_pressure&minutely_15=precipitation&timezone=auto`;
        const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${numLat}&longitude=${numLng}&current=us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,ozone&timezone=auto`;
        const geocodeUrl = `https://nominatim.openstreetmap.org/reverse?lat=${numLat}&lon=${numLng}&format=json&zoom=14&addressdetails=1`;

        const [weatherRes, aqiRes, geocodeRes] = await Promise.allSettled([
            fetch(weatherUrl, { next: { revalidate: 60 } }),
            fetch(aqiUrl, { next: { revalidate: 120 } }),
            fetch(geocodeUrl, { 
                headers: { 'User-Agent': 'NADI-Civic-App/1.0 (https://nadi.my; contact@nadi.my)' },
                signal: AbortSignal.timeout(3500)
            })
        ]);

        let resolvedLocationName = '';
        let resolvedStateName = '';

        if (geocodeRes.status === 'fulfilled' && geocodeRes.value.ok) {
            try {
                const geoData = await geocodeRes.value.json();
                const addr = geoData.address || {};
                resolvedLocationName = addr.city || addr.town || addr.municipality || addr.suburb || addr.village || addr.hamlet || addr.county || addr.state_district || '';
                resolvedStateName = addr.state || '';
            } catch (e) {
                console.warn('Geocode parse error:', e);
            }
        }

        // Offline geometric nearest-city fallback if Nominatim failed or was empty
        if (!resolvedLocationName) {
            const nearest = getNearestLocation(numLat, numLng);
            resolvedLocationName = nearest.name;
            resolvedStateName = nearest.state;
        }

        if (weatherRes.status !== 'fulfilled' || !weatherRes.value.ok) {
            throw new Error('Failed to fetch weather from Open-Meteo');
        }

        const weatherData = await weatherRes.value.json();
        const aqiData = (aqiRes.status === 'fulfilled' && aqiRes.value.ok) ? await aqiRes.value.json() : {};

        const currentW = weatherData.current || {};
        const currentA = aqiData.current || {};
        const minutely15 = weatherData.minutely_15?.precipitation || [];
        const recent15MinRain = minutely15.length > 0 ? (minutely15[minutely15.length - 1] * 4) : 0;

        const weatherCode = currentW.weather_code || 0;
        let baseRainMm = Math.max(
            currentW.precipitation || 0,
            currentW.rain || 0,
            currentW.showers || 0,
            recent15MinRain
        );

        if ([95, 96, 99].includes(weatherCode)) {
            baseRainMm = Math.max(baseRainMm, 15.0);
        } else if ([65, 82].includes(weatherCode)) {
            baseRainMm = Math.max(baseRainMm, 10.0);
        }

        const rainMm = baseRainMm;
        const humidity = currentW.relative_humidity_2m || 70;
        const pressure = currentW.surface_pressure || currentW.pressure_msl || 1013;

        const pressureDrop = Math.max(0, 1013 - pressure);
        const fri = (rainMm * 5.0) + ((humidity / 100) * 10.0) + (pressureDrop * 1.5);

        let floodRisk = 'Low';
        if (fri >= 45 || rainMm >= 10.0) {
            floodRisk = 'High';
        } else if (fri >= 25 || rainMm >= 4.0) {
            floodRisk = 'Moderate';
        }

        return NextResponse.json({
            success: true,
            location: resolvedLocationName,
            state: resolvedStateName,
            coordinates: { lat: numLat, lng: numLng },
            weather: {
                temp: Math.round(currentW.temperature_2m || 30),
                feelsLike: Math.round(currentW.apparent_temperature || 32),
                humidity: currentW.relative_humidity_2m || 70,
                windSpeed: Math.round(currentW.wind_speed_10m || 0),
                rainMm: Number(rainMm.toFixed(1)),
                floodRisk,
                friScore: Number(fri.toFixed(1)),
                weatherCode,
                aqi: currentA.us_aqi || 50,
                pm25: currentA.pm2_5 || 10,
                pm10: currentA.pm10 || 20,
            },
        }, {
            headers: {
                'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
            },
        });
    } catch (error) {
        console.error('Weather fetch error:', error);
        const nearest = getNearestLocation(numLat, numLng);
        return NextResponse.json({
            success: false,
            location: nearest.name,
            state: nearest.state,
            coordinates: { lat: numLat, lng: numLng },
            error: 'Weather fetch failed'
        }, { status: 200 });
    }
}
