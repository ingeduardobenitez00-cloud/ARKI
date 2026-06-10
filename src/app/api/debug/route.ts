import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const res = await fetch('https://resultados.tsje.gov.py/publicacion/divulgacion.html');
        const text = await res.text();
        
        // Extraer todos los scripts
        const scriptRegex = /<script[^>]+src="([^">]+)"/g;
        let match;
        const scripts = [];
        while ((match = scriptRegex.exec(text)) !== null) {
            scripts.push(match[1]);
        }
        
        return NextResponse.json({ scripts, textPreview: text.slice(0, 1000) });
    } catch (e: any) {
        return NextResponse.json({ error: e.message });
    }
}
