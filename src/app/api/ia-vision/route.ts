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

        // Configuración del Prompt de Alta Precisión
        const prompt = `
            Eres un experto en escrutinio electoral paraguayo. Tu tarea es extraer los votos de la imagen de un ACTA DE ESCRUTINIO.
            DEPARTAMENTO: ${depto}
            CARGO: ${cargo}
            ${cargo === 'JUNTA' ? 'INSTRUCCIÓN ESPECIAL: Esta es un acta de JUNTA MUNICIPAL. Debes buscar tanto las LISTAS (ej: 2, 7, 300) como las 24 OPCIONES preferenciales (del 1 al 24). Extrae los votos de ambos sectores.' : 'INSTRUCCIÓN ESPECIAL: Esta es un acta de INTENDENTE. Solo busca los resultados por LISTA.'}

            CAMPOS OBLIGATORIOS A BUSCAR:
            1. Votos por cada Lista solicitada: ${JSON.stringify(listas)}
            2. Votos Nulos (NUL o NULOS)
            3. Votos en Blanco (BLC o BLANCOS)
            4. Votos Vaciados (VAC o VACIADOS)
            5. Total General del Acta (TOT o TOTAL)

            REGLAS DE ORO:
            - Solo devuelve JSON.
            - Si un número no es legible, intenta deducirlo por el contexto o pon 0.
            - Si una lista o campo no existe en el papel, pon 0.
            
            ESTRUCTURA JSON:
            {
                "votos": { "id_o_numero": valor_numerico },
                "cierre": { "nul": numero, "blc": numero, "vac": numero, "tot": numero },
                "confianza": 0.0 a 1.0
            }
        `;

        // Lista de modelos verificados para 2026 (Gemini 1.5 es el estándar de alta estabilidad)
        const modelos = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'];
        let lastError = '';
        let response: any = null;

        console.log(`Intentando escaneo IA para ${cargo} en ${depto} con ${listas.length} listas.`);

        for (const modelo of modelos) {
            try {
                console.log(`Probando modelo: ${modelo}...`);
                const modelName = modelo.includes('models/') ? modelo : `models/${modelo}`;
                
                response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${API_KEY}`, {
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
                            temperature: 0.1, // Baja temperatura para mayor precisión en extracción de datos
                        }
                    })
                });

                if (response.ok) {
                    console.log(`Modelo ${modelo} respondió exitosamente.`);
                    break;
                }
                
                const errorData = await response.json();
                lastError = `[${modelo}] ${errorData.error?.message || 'Error desconocido'}`;
                console.warn(`Fallo con ${modelo}:`, lastError);
            } catch (e: any) {
                lastError = `[${modelo}] Error de conexión: ${e.message}`;
                console.error(`Error crítico con ${modelo}:`, e);
            }
        }

        if (!response || !response.ok) {
            throw new Error(lastError || 'No se pudo conectar con ningún modelo de IA disponible. Verifica tu cuota de API o conexión.');
        }

        const data = await response.json();

        let text = data.candidates[0].content.parts[0].text;
        
        // Limpieza por si acaso devuelve markdown
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        const aiResult = JSON.parse(text);

        return NextResponse.json(aiResult);

    } catch (error: any) {
        console.error('IA VISION ERROR:', error);
        return NextResponse.json({ error: "DIAGNÓSTICO: " + error.message }, { status: 500 });
    }
}
