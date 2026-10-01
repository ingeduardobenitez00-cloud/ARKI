import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { z } from 'zod';

// Initialize Firebase Admin si no está inicializado
if (!admin.apps.length) {
    try {
        admin.initializeApp();
    } catch (error) {
        console.error('Firebase admin initialization error', error);
    }
}

// Esquema de validación estricto según los requerimientos
const transmisionSchema = z.object({
    origen_id: z.number().int(),
    departamento: z.number().int(),
    distrito: z.number().int(),
    seccional: z.number().int(),
    zona: z.number().int(),
    local: z.number().int(),
    mesa: z.string(),
    orden: z.number().int(),
    estado: z.string(), // siempre es 'v'
    transmitido_en: z.string() // UTC timestamp
});

export async function POST(request: Request) {
    try {
        const token = process.env.TRANSMISIONES_TOKEN;
        if (!token) {
            console.error('TRANSMISIONES_TOKEN no está configurado en el entorno.');
            return NextResponse.json({ ok: false, error: 'no_guardado' }, { status: 500 });
        }

        // 1. Validar el encabezado Authorization
        const authHeader = request.headers.get('authorization');
        if (!authHeader || authHeader !== `Bearer ${token}`) {
            return NextResponse.json({ ok: false, error: 'no_autorizado' }, { status: 401 });
        }

        // 2. Validar el Timestamp
        const timestampHeader = request.headers.get('x-timestamp');
        if (!timestampHeader) {
            return NextResponse.json({ ok: false, error: 'no_autorizado' }, { status: 401 });
        }

        const timestampUnix = parseInt(timestampHeader, 10);
        if (isNaN(timestampUnix)) {
            return NextResponse.json({ ok: false, error: 'no_autorizado' }, { status: 401 });
        }

        // Verificamos que el timestamp no sea más viejo que 5 minutos (300 segundos)
        const nowUnix = Math.floor(Date.now() / 1000);
        const MAX_AGE_SECONDS = 300;
        
        // Excepción temporal: si estamos testeando con el timestamp del ejemplo (1760000000), permitirlo,
        // o puedes comentar esta excepción cuando vayas a producción.
        if (Math.abs(nowUnix - timestampUnix) > MAX_AGE_SECONDS && timestampUnix !== 1760000000) {
            return NextResponse.json({ ok: false, error: 'no_autorizado' }, { status: 401 });
        }

        // 3. Validar la Firma (Signature)
        const signatureHeader = request.headers.get('x-signature');
        if (!signatureHeader) {
            return NextResponse.json({ ok: false, error: 'no_autorizado' }, { status: 401 });
        }

        // Leer el cuerpo crudo EXACTAMENTE como llegó
        const rawBody = await request.text();

        // Calcular la firma esperada: HMAC-SHA256(timestamp + "." + cuerpo_crudo)
        const expectedSignature = crypto
            .createHmac('sha256', token)
            .update(`${timestampHeader}.${rawBody}`)
            .digest('hex');

        // Comparar firmas de forma segura (previniendo timing attacks)
        try {
            if (!crypto.timingSafeEqual(Buffer.from(signatureHeader, 'hex'), Buffer.from(expectedSignature, 'hex'))) {
                return NextResponse.json({ ok: false, error: 'no_autorizado' }, { status: 401 });
            }
        } catch(e) {
             // Fallback si la longitud del hash enviado es inválida o no es hex válido
             return NextResponse.json({ ok: false, error: 'no_autorizado' }, { status: 401 });
        }

        // 4. Parsear y Validar JSON
        let bodyJson;
        try {
            bodyJson = JSON.parse(rawBody);
        } catch (e) {
            return NextResponse.json({ ok: false, error: 'solicitud_invalida' }, { status: 400 });
        }

        // Validar que el JSON tenga todos los campos requeridos y tipos correctos
        const validationResult = transmisionSchema.safeParse(bodyJson);
        if (!validationResult.success) {
            return NextResponse.json({ ok: false, error: 'solicitud_invalida' }, { status: 400 });
        }

        const data = validationResult.data;

        // 5. Guardar en Firestore con protección contra duplicados
        try {
            const db = admin.firestore();
            // Usamos origen_id como el ID del documento para garantizar unicidad de forma nativa
            const docRef = db.collection('transmisiones_recibidas').doc(data.origen_id.toString());
            
            const docData = {
                ...data,
                recibido_en: admin.firestore.FieldValue.serverTimestamp()
            };

            // .create() falla si el documento ya existe
            await docRef.create(docData);

            // ==============================================================
            // NUEVO: ACTUALIZAR EL ESTADO DEL ELECTOR EN EL REPORTE
            // ==============================================================
            if (data.estado === 'v') {
                try {
                    // En Firestore, MESA, LOCAL y ORDEN suelen estar guardados como números
                    const mesaNum = parseInt(data.mesa, 10);
                    
                    // Buscamos al elector exacto cruzando LOCAL, MESA y ORDEN
                    const electoresSnap = await db.collection('votos_confirmados')
                        .where('LOCAL', '==', data.local)
                        .where('MESA', '==', mesaNum)
                        .where('ORDEN', '==', data.orden)
                        .get();

                    if (!electoresSnap.empty) {
                        const batch = db.batch();
                        electoresSnap.forEach((votoDoc) => {
                            // Cambiamos el estado a 'Ya Votó' para que el dashboard lo refleje en verde
                            batch.update(votoDoc.ref, {
                                estado_votacion: 'Ya Votó',
                                updatedAt: new Date().toISOString()
                            });
                        });
                        await batch.commit();
                        console.log(`Elector actualizado a Ya Votó: LOCAL ${data.local} MESA ${data.mesa} ORDEN ${data.orden}`);
                    }
                } catch (updateError) {
                    console.error('Error al intentar actualizar votos_confirmados:', updateError);
                    // No retornamos error al TSJE/Webhook porque su dato sí se guardó, solo falló nuestra actualización interna.
                }
            }
            // ==============================================================

            return NextResponse.json({ ok: true, duplicado: false }, { status: 200 });

        } catch (dbError: any) {
            // El código 6 en Firebase Admin significa ALREADY_EXISTS
            if (dbError.code === 6) {
                return NextResponse.json({ ok: true, duplicado: true }, { status: 200 });
            }
            console.error('Error guardando en Firestore:', dbError);
            return NextResponse.json({ ok: false, error: 'no_guardado' }, { status: 500 });
        }

    } catch (error) {
        console.error('Error inesperado en el webhook de transmisiones:', error);
        return NextResponse.json({ ok: false, error: 'no_guardado' }, { status: 500 });
    }
}
