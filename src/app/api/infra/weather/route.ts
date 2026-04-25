import { NextResponse } from 'next/server';

const OWM_KEY = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY;

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat') || '3.139';
    const lng = searchParams.get('lng') || '101.6869';

    if (!OWM_KEY || OWM_KEY === 'apitest123') {
        // Return mock data if no real key is configured
        return NextResponse.json({
            success: true,
            weather: {
                condition: 'Rain',
                description: 'moderate rain',
                temp: 28,
                humidity: 88,
                windSpeed: 12,
                rainMm: 4.2,
                icon: '10d',
                floodRisk: 'Moderate',
            },
        });
    }

    try {
        const res = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${OWM_KEY}&units=metric`
        );
        const data = await res.json();

        const rainMm = data.rain?.['1h'] || data.rain?.['3h'] || 0;
        let floodRisk = 'Low';
        if (rainMm > 10) floodRisk = 'High';
        else if (rainMm > 4) floodRisk = 'Moderate';

        return NextResponse.json({
            success: true,
            weather: {
                condition: data.weather?.[0]?.main || 'Clear',
                description: data.weather?.[0]?.description || 'clear sky',
                temp: Math.round(data.main?.temp || 30),
                humidity: data.main?.humidity || 70,
                windSpeed: Math.round(data.wind?.speed || 0),
                rainMm: Number(rainMm.toFixed(1)),
                icon: data.weather?.[0]?.icon || '01d',
                floodRisk,
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
