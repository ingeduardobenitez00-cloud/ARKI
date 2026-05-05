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
            Eres un experto en escrutinio electoral paraguayo de alta precisión.
            ESTÁS ANALIZANDO UN ACTA DE: ${cargo} (Departamento: ${depto})

            ${cargo === 'JUNTA' 
                ? `MODO JUNTA MUNICIPAL:
                   1. Debes extraer los votos de las LISTAS solicitadas: ${JSON.stringify(listas)}.
                   2. Para cada lista, DEBES buscar la cuadrícula de 24 OPCIONES PREFERENCIALES.
                   3. Extrae los votos de cada opción (del 1 al 24) que veas marcados o escritos.
                   4. Estructura los votos de las opciones como "LISTA-OPCION" (ej: "2-1", "2-2", "7-1").`
                : `MODO INTENDENTE:
                   1. Solo busca los votos totales por cada LISTA: ${JSON.stringify(listas)}.
                   2. Ignora cualquier cuadro de opciones preferenciales si lo hubiera.`
            }

            CAMPOS TÉCNICOS OBLIGATORIOS (CIERRE):
            - NUL (Votos Nulos)
            - BLC (Votos en Blanco)
            - VAC (Votos a Computar / Vaciados)
            - TOT (Total Oficial escrito en el acta)

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
