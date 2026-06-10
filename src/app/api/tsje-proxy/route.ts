import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path') || 'divulgacion.html';
    
    try {
        const res = await fetch(`https://resultados.tsje.gov.py/publicacion/${path}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
                'Referer': 'https://resultados.tsje.gov.py/publicacion/divulgacion.html',
                'Origin': 'https://resultados.tsje.gov.py',
                'Connection': 'keep-alive'
            }
        });
        
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const data = await res.json();
            return NextResponse.json(data);
        } else {
            const text = await res.text();
            return new NextResponse(text, {
                headers: { 'Content-Type': contentType || 'text/html' }
            });
        }
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path') || 'divulgacion.html';
    const body = await request.text();
    
    try {
        const res = await fetch(`https://resultados.tsje.gov.py/publicacion/${path}`, {
            method: 'POST',
            body: body,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
                'Referer': 'https://resultados.tsje.gov.py/publicacion/divulgacion.html',
                'Origin': 'https://resultados.tsje.gov.py',
                'Connection': 'keep-alive',
                'Content-Type': request.headers.get('content-type') || 'application/json'
            }
        });
        
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const data = await res.json();
            return NextResponse.json(data);
        } else {
            const text = await res.text();
            return new NextResponse(text, {
                headers: { 'Content-Type': contentType || 'text/html' }
            });
        }
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
