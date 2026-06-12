import { NextResponse } from 'next/server';

const reportsStore: any[] = [];

export async function GET() {
    return NextResponse.json({ success: true, count: reportsStore.length });
}

export async function POST(request: Request) {
    try {
        const { category, description, location, image } = await request.json();
        if (!category || !description) {
            return NextResponse.json({ success: false, error: 'Category and description required.' }, { status: 400 });
        }
        const report = {
            id: `wb-${Date.now()}`,
            category,
            description,
            location: location || 'Undisclosed',
            image: image || null,
            timestamp: Date.now(),
            status: 'submitted',
            // Zero PII — no user info stored
        };
        reportsStore.unshift(report);
        if (reportsStore.length > 100) reportsStore.splice(100);
        return NextResponse.json({ success: true, reportId: report.id });
    } catch {
        return NextResponse.json({ success: false, error: 'Submission failed.' }, { status: 500 });
    }
}
