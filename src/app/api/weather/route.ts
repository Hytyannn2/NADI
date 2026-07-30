import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat') || '3.139';
    const lng = searchParams.get('lng') || '101.6869';

    try {
        // Fetch weather and air quality from Open-Meteo
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,wind_speed_10m&timezone=auto`;
        const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,ozone&timezone=auto`;

        const [weatherRes, aqiRes] = await Promise.all([
            fetch(weatherUrl, { next: { revalidate: 300 } }),
            fetch(aqiUrl, { next: { revalidate: 300 } })
        ]);

        if (!weatherRes.ok || !aqiRes.ok) {
            throw new Error('Failed to fetch from Open-Meteo');
        }

        const weatherData = await weatherRes.json();
        const aqiData = await aqiRes.json();

        const currentW = weatherData.current || {};
        const currentA = aqiData.current || {};

        const rainMm = currentW.precipitation || currentW.rain || 0;
        const humidity = currentW.relative_humidity_2m || 70;
        const pressure = currentW.surface_pressure || currentW.pressure_msl || 1013;

        // ====================================================
        // NADI Hydrological Flood Risk Index (FRI) Equation
        // ====================================================
        // FRI = (Rain_mm * 5.0) + (Humidity_pct / 100 * 10.0) + Max(0, 1013 - Surface_Pressure_hPa) * 1.5
        //
        // Factors:
        // 1. Rain Intensity (mm/hr) — Primary driver (MetMalaysia scale)
        // 2. Air Moisture Saturation (%) — Soil/atmosphere absorption capacity
        // 3. Barometric Pressure Drop (hPa) — Low pressure (<1008 hPa) indicates tropical monsoon storm depression
        // ====================================================
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
            weather: {
                temp: Math.round(currentW.temperature_2m || 30),
                feelsLike: Math.round(currentW.apparent_temperature || 32),
                humidity: currentW.relative_humidity_2m || 70,
                windSpeed: Math.round(currentW.wind_speed_10m || 0),
                rainMm: Number(rainMm.toFixed(1)),
                floodRisk,
                friScore: Number(fri.toFixed(1)),
                aqi: currentA.us_aqi || 50,
                pm25: currentA.pm2_5 || 10,
                pm10: currentA.pm10 || 20,
            },
        });
    } catch (error) {
        console.error('Weather fetch error:', error);
        return NextResponse.json(
            { success: false, error: 'Weather fetch failed' },
            { status: 500 }
        );
    }
}
