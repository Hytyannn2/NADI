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
        let floodRisk = 'Low';
        if (rainMm > 10) floodRisk = 'High';
        else if (rainMm > 4) floodRisk = 'Moderate';

        return NextResponse.json({
            success: true,
            weather: {
                temp: Math.round(currentW.temperature_2m || 30),
                feelsLike: Math.round(currentW.apparent_temperature || 32),
                humidity: currentW.relative_humidity_2m || 70,
                windSpeed: Math.round(currentW.wind_speed_10m || 0),
                rainMm: Number(rainMm.toFixed(1)),
                floodRisk,
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
