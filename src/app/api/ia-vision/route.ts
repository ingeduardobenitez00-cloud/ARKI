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

        // Lista de modelos verificados para 2026 (Estables)
        const modelos = ['gemini-1.5-flash', 'gemini-1.5-pro'];
        const apiVersions = ['v1', 'v1beta'];
        let accumulatedErrors: string[] = [];
        let response: any = null;

        console.log(`Intentando escaneo IA para ${cargo} en ${depto} con ${listas.length} listas.`);

        for (const modelo of modelos) {
            let modelSuccess = false;
            for (const version of apiVersions) {
                try {
                    console.log(`Probando modelo: ${modelo} (API ${version})...`);
                    const modelName = modelo.includes('models/') ? modelo : `models/${modelo}`;
                    
                    const fetchResponse = await fetch(`https://generativelanguage.googleapis.com/${version}/${modelName}:generateContent?key=${API_KEY}`, {
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
                                responseMimeType: "application/json",
                                temperature: 0.1,
                            }
                        })
                    });

                    if (fetchResponse.ok) {
                        console.log(`Modelo ${modelo} (${version}) respondió exitosamente.`);
                        response = fetchResponse;
                        modelSuccess = true;
                        break;
                    }
                    
                    const errorData = await fetchResponse.json();
                    const msg = errorData.error?.message || 'Error desconocido';
                    
                    // Manejo específico de clave filtrada
                    if (msg.toLowerCase().includes('leaked')) {
                        throw new Error("TU API KEY HA SIDO FILTRADA Y DESACTIVADA POR SEGURIDAD. Debes generar una nueva en Google AI Studio y actualizar tu .env.");
                    }

                    accumulatedErrors.push(`${modelo} (${version}): ${msg}`);
                    console.warn(`Fallo con ${modelo} (${version}):`, msg);
                } catch (e: any) {
                    if (e.message.includes('FILTRADA')) throw e; // Re-lanzar error de seguridad
                    accumulatedErrors.push(`${modelo} (${version}) conexión: ${e.message}`);
                    console.error(`Error crítico con ${modelo} (${version}):`, e);
                }
            }
            if (modelSuccess) break;
        }

        if (!response || !response.ok) {
            const diagnosis = accumulatedErrors.length > 0 
                ? accumulatedErrors.join(' | ') 
                : 'No se pudo conectar con ningún modelo de IA. Verifica tu API KEY y cuotas.';
            throw new Error(diagnosis);
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
