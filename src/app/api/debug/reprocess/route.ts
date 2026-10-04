import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

export async function GET() {
    try {
        if (!admin.apps.length) {
            admin.initializeApp();
        }
        const db = admin.firestore();
        console.log('Obteniendo transmisiones para reprocesar...');
        const transmisionesSnap = await db.collection('transmisiones_recibidas').where('estado', '==', 'v').get();
        
        console.log(`Se encontraron ${transmisionesSnap.size} transmisiones.`);
        
        let updatedCount = 0;
        
        for (const docSnap of transmisionesSnap.docs) {
            const data = docSnap.data();
            
            const locNum = Number(data.local);
            const locStr = String(data.local);
            const mesaNum = Number(data.mesa);
            const mesaStr = String(data.mesa);
            const ordNum = Number(data.orden);
            const ordStr = String(data.orden);

            const queries = [];
            for (const loc of [locNum, locStr]) {
                for (const mes of [mesaNum, mesaStr]) {
                    for (const ord of [ordNum, ordStr]) {
                        queries.push(
                            db.collection('votos_confirmados')
                              .where('LOCAL', '==', loc)
                              .where('MESA', '==', mes)
                              .where('ORDEN', '==', ord)
                              .get()
                        );
                    }
                }
            }

            const snaps = await Promise.all(queries);
            const matchedDocs: any[] = [];
            snaps.forEach(querySnap => {
                if (!querySnap.empty) {
                    querySnap.forEach(d => {
                        if (!matchedDocs.some(md => md.id === d.id)) {
                            matchedDocs.push(d);
                        }
                    });
                }
            });

            if (matchedDocs.length > 0) {
                const batch = db.batch();
                let needsUpdate = false;
                
                matchedDocs.forEach((votoDoc) => {
                    if (votoDoc.data().estado_votacion !== 'Ya Votó') {
                        batch.update(votoDoc.ref, {
                            estado_votacion: 'Ya Votó',
                            updatedAt: new Date().toISOString()
                        });
                        needsUpdate = true;
                    }
                });
                
                if (needsUpdate) {
                    await batch.commit();
                    updatedCount++;
                }
            }
        }
        
        return NextResponse.json({ ok: true, message: `Proceso finalizado. Se re-procesaron y actualizaron ${updatedCount} registros en votos_confirmados.` });
    } catch (error: any) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
