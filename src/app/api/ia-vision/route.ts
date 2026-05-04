import { NextResponse } from 'next/server';

/**
 * API DE VISIÓN ARKI v1.0
 * Utiliza Google Gemini 1.5 Flash para extraer votos de actas electorales.
 */

export async function POST(req: Request) {
    try {
        const { image, depto, cargo, listas } = await req.json();

        if (!image) {
            return NextResponse.json({ error: 'No se recibió la imagen' }, { status: 400 });
        }

        const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
        
        if (!API_KEY) {
            return NextResponse.json({ error: 'Falta la API KEY de Gemini en el entorno' }, { status: 500 });
        }

        // Configuración del Prompt según el cargo y depto
        const prompt = `
            Eres un experto en escrutinio electoral. Tu tarea es extraer los votos de la siguiente imagen de un acta oficial.
            DEPARTAMENTO: ${depto}
            CARGO: ${cargo}
            LISTAS A BUSCAR: ${JSON.stringify(listas)}

            INSTRUCCIONES CRÍTICAS:
            1. Busca los números escritos a mano o impresos al lado de cada Lista.
            2. Extrae también: Nulos, Blancos, Votos a Computar (Vacíos) y el Total General (TOT).
            3. Si un valor no es legible, devuelve 0.
            4. Devuelve los resultados EXCLUSIVAMENTE en formato JSON plano con esta estructura:
            {
                "votos": { "id_lista": numero_votos },
                "cierre": { "nul": numero, "blc": numero, "vac": numero, "tot": numero },
                "confianza": 0.0 a 1.0
            }
        `;

        // Llamada directa a la API de Google Gemini (Vision)
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        { inline_data: { mime_type: 'image/jpeg', data: image.split(',')[1] } }
                    ]
                }],
                generationConfig: {
                    response_mime_type: "application/json",
                }
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error?.message || 'Error en la comunicación con la IA');
        }

        const aiResult = JSON.parse(data.candidates[0].content.parts[0].text);

        return NextResponse.json(aiResult);

    } catch (error: any) {
        console.error('IA VISION ERROR:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
