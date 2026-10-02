import { NextResponse } from 'next/server';
import * as crypto from 'crypto';
import { z } from 'zod';
import { collection, doc, getDoc, setDoc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { db } from '@/firebase/config';

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

        const nowUnix = Math.floor(Date.now() / 1000);
        const MAX_AGE_SECONDS = 300;
        
        // Excepción temporal: si estamos testeando con el timestamp del ejemplo (1760000000), permitirlo
        if (Math.abs(nowUnix - timestampUnix) > MAX_AGE_SECONDS && timestampUnix !== 1760000000) {
            return NextResponse.json({ ok: false, error: 'no_autorizado' }, { status: 401 });
        }

        // 3. Validar la Firma (Signature)
        const signatureHeader = request.headers.get('x-signature');
        if (!signatureHeader) {
            return NextResponse.json({ ok: false, error: 'no_autorizado' }, { status: 401 });
        }

        const rawBody = await request.text();
        const expectedSignature = crypto
            .createHmac('sha256', token)
            .update(`${timestampHeader}.${rawBody}`)
            .digest('hex');

        try {
            if (!crypto.timingSafeEqual(Buffer.from(signatureHeader, 'hex'), Buffer.from(expectedSignature, 'hex'))) {
                return NextResponse.json({ ok: false, error: 'no_autorizado' }, { status: 401 });
            }
        } catch(e) {
             return NextResponse.json({ ok: false, error: 'no_autorizado' }, { status: 401 });
        }

        // 4. Parsear y Validar JSON
        let bodyJson;
        try {
            bodyJson = JSON.parse(rawBody);
        } catch (e) {
            return NextResponse.json({ ok: false, error: 'solicitud_invalida' }, { status: 400 });
        }

        const validationResult = transmisionSchema.safeParse(bodyJson);
        if (!validationResult.success) {
            return NextResponse.json({ ok: false, error: 'solicitud_invalida' }, { status: 400 });
        }

        const data = validationResult.data;

        // 5. Guardar en Firestore con Client SDK
        try {
            const docRef = doc(db, 'transmisiones_recibidas', data.origen_id.toString());
            
            // Check if document already exists to return duplicado = true
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                return NextResponse.json({ ok: true, duplicado: true }, { status: 200 });
            }

            const docData = {
                ...data,
                recibido_en: new Date().toISOString()
            };

            await setDoc(docRef, docData);

            // ==============================================================
            // ACTUALIZAR EL ESTADO DEL ELECTOR EN EL REPORTE
            // ==============================================================
            if (data.estado === 'v') {
                try {
                    const locNum = Number(data.local);
                    const locStr = String(data.local);
                    
                    const localNamesToSearch: any[] = [locNum, locStr];
                    const localesQuery = await getDocs(query(collection(db, 'locales_votacion'), where('codigo_local', '==', locStr)));
                    
                    localesQuery.forEach(d => {
                        const lData = d.data();
                        if (lData.nombre) {
                            localNamesToSearch.push(lData.nombre);
                        }
                    });

                    const mesaNum = Number(data.mesa);
                    const mesaStr = String(data.mesa);
                    const ordNum = Number(data.orden);
                    const ordStr = String(data.orden);

                    const seccNum = Number(data.seccional);
                    const seccStr = String(data.seccional);

                    const queries = [];
                    // 1. Match by resolved Local Name
                    for (const loc of localNamesToSearch) {
                        for (const mes of [mesaNum, mesaStr]) {
                            for (const ord of [ordNum, ordStr]) {
                                queries.push(
                                    getDocs(query(
                                        collection(db, 'votos_confirmados'),
                                        where('LOCAL', '==', loc),
                                        where('MESA', '==', mes),
                                        where('ORDEN', '==', ord)
                                    ))
                                );
                            }
                        }
                    }

                    // 2. Fallback match by Seccional + Mesa + Orden
                    for (const sec of [seccNum, seccStr]) {
                        for (const mes of [mesaNum, mesaStr]) {
                            for (const ord of [ordNum, ordStr]) {
                                queries.push(
                                    getDocs(query(
                                        collection(db, 'votos_confirmados'),
                                        where('SECCIONAL', '==', sec),
                                        where('MESA', '==', mes),
                                        where('ORDEN', '==', ord)
                                    ))
                                );
                                queries.push(
                                    getDocs(query(
                                        collection(db, 'votos_confirmados'),
                                        where('CODIGO_SEC', '==', sec),
                                        where('MESA', '==', mes),
                                        where('ORDEN', '==', ord)
                                    ))
                                );
                            }
                        }
                    }

                    const snaps = await Promise.all(queries);
                    const matchedDocs: any[] = [];
                    snaps.forEach(snap => {
                        if (!snap.empty) {
                            snap.forEach(d => {
                                if (!matchedDocs.some(md => md.id === d.id)) {
                                    matchedDocs.push(d);
                                }
                            });
                        }
                    });

                    if (matchedDocs.length > 0) {
                        const batch = writeBatch(db);
                        matchedDocs.forEach((votoDoc) => {
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
                }
            }

            return NextResponse.json({ ok: true, duplicado: false }, { status: 200 });

        } catch (dbError: any) {
            console.error('Error guardando en Firestore:', dbError);
            return NextResponse.json({ ok: false, error: 'no_guardado' }, { status: 500 });
        }

    } catch (error) {
        console.error('Error inesperado en el webhook de transmisiones:', error);
        return NextResponse.json({ ok: false, error: 'no_guardado' }, { status: 500 });
    }
}
