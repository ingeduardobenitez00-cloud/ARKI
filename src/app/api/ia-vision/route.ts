import { NextResponse } from 'next/server';

/**
 * API DE VISIÓN ARKI v1.1
 * Utiliza Google Gemini 1.5 Flash para extraer votos de actas electorales.
 */

export async function POST(req: Request) {
    try {
        const { image, depto, cargo, listas } = await req.json();

        if (!image) {
            return NextResponse.json({ error: 'No se recibió la imagen' }, { status: 400 });
        }

        const API_KEY = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
        
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
            2. Extrae también: Nulos (NUL), Blancos (BLC), Votos a Computar (VAC) y el Total General (TOT).
            3. Si un valor no es legible o está vacío, devuelve 0.
            4. Devuelve los resultados EXCLUSIVAMENTE en formato JSON plano con esta estructura:
            {
                "votos": { "id_lista": numero_votos },
                "cierre": { "nul": numero, "blc": numero, "vac": numero, "tot": numero },
                "confianza": 0.0 a 1.0
            }
        `;

        // Lista de modelos a intentar (del más rápido al más potente)
        const modelos = ['gemini-1.5-flash', 'gemini-1.5-pro'];
        let lastError = '';
        let response: any = null;

        for (const modelo of modelos) {
            try {
                response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${API_KEY}`, {
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

                if (response.ok) break; // Si funciona, salimos del bucle
                
                const errorData = await response.json();
                lastError = errorData.error?.message || 'Error desconocido';
                console.warn(`Modelo ${modelo} falló: ${lastError}`);
            } catch (e: any) {
                lastError = e.message;
            }
        }

        if (!response || !response.ok) {
            throw new Error(lastError || 'No se pudo conectar con ningún modelo de IA');
        }

        const data = await response.json();

        let text = data.candidates[0].content.parts[0].text;
        
        // Limpieza por si acaso devuelve markdown
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        const aiResult = JSON.parse(text);

        return NextResponse.json(aiResult);

    } catch (error: any) {
        console.error('IA VISION ERROR:', error);
        
        let mensajeFriendly = error.message;
        if (mensajeFriendly.includes('not found')) {
            mensajeFriendly = "El modelo de IA solicitado no está disponible en tu región todavía o la llave de API es muy nueva. Intenta de nuevo en unos minutos.";
        } else if (mensajeFriendly.includes('API key')) {
            mensajeFriendly = "La llave de API no es válida o no tiene permisos.";
        }

        return NextResponse.json({ error: mensajeFriendly }, { status: 500 });
    }
}
