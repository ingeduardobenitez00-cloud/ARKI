import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const url = 'https://resultados.tsje.gov.py/publicacion/dinamics/0/0/locales.ajax.php';
        const res = await fetch(url);
        const data = await res.text();
        return NextResponse.json({ data: data.substring(0, 5000) });
    } catch (e: any) {
        return NextResponse.json({ error: e.message });
    }
}
