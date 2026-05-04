import { NextResponse } from 'next/server';

/**
 * API DE VISIÓN ARKI v1.2 (PRODUCCIÓN)
 * Motor híbrido con auto-reparación y múltiples modelos.
 */

export async function POST(req: Request) {
    try {
        const { image, depto, cargo, listas } = await req.json();
        const API_KEY = process.env.GEMINI_API_KEY || '';
        
        if (!API_KEY) return NextResponse.json({ error: 'Falta la API KEY en el servidor' }, { status: 500 });

        const prompt = `
            Eres un experto en escrutinio electoral paraguayo. Tu tarea es extraer los votos de la imagen de un ACTA DE ESCRUTINIO IMPRESA.
            DEPARTAMENTO: ${depto}
            CARGO: ${cargo}
            ${cargo === 'JUNTA' ? 'INSTRUCCIÓN: Busca tanto las LISTAS como las 24 OPCIONES preferenciales.' : 'INSTRUCCIÓN: Busca los resultados por LISTA.'}

            LISTAS A BUSCAR: ${JSON.stringify(listas)}
            CAMPOS DE CIERRE: NULOS, BLANCOS, VACIADOS, TOTAL (TOT).

            REGLAS:
            - Devuelve SOLO JSON puro.
            - Si el número es 0 o no está, pon 0.
            
            ESTRUCTURA JSON:
            {
                "votos": { "id": valor },
                "cierre": { "nul": 0, "blc": 0, "vac": 0, "tot": 0 },
                "confianza": 0.95
            }
        `;

        // Modelos de última generación (2.5 y 3) para cuentas de pago
        const modelos = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
        const apiVersions = ['v1beta', 'v1'];
        let accumulatedErrors: string[] = [];

        for (const modelo of modelos) {
            for (const version of apiVersions) {
                try {
                    // Probamos una estructura de URL alternativa que a veces resuelve el "not found"
                    const url = `https://generativelanguage.googleapis.com/${version}/models/${modelo}:generateContent?key=${API_KEY}`;
                    
                    const fetchResponse = await fetch(url, {
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
                                temperature: 0.1
                            }
                        })
                    });

                    const data = await fetchResponse.json();

                    if (fetchResponse.ok) {
                        let text = data.candidates[0].content.parts[0].text;
                        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
                        return NextResponse.json(JSON.parse(text));
                    }

                    accumulatedErrors.push(`${modelo} (${version}): ${data.error?.message || 'Error'}`);
                } catch (e: any) {
                    accumulatedErrors.push(`${modelo} error: ${e.message}`);
                }
            }
        }

        throw new Error(accumulatedErrors.join(' | '));

    } catch (error: any) {
        console.error('IA ERROR:', error.message);
        return NextResponse.json({ error: "DIAGNÓSTICO: " + error.message }, { status: 500 });
    }
}
