import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin if it hasn't been initialized yet
if (!admin.apps.length) {
    try {
        admin.initializeApp();
    } catch (error) {
        console.error('Firebase admin initialization error', error);
    }
}

export async function POST(request: Request) {
    try {
        // Fetch from ETR API
        const token = process.env.ETR_API_TOKEN;
        if (!token) {
            return NextResponse.json({ success: false, error: 'ETR_API_TOKEN no configurado en variables de entorno' }, { status: 500 });
        }

        console.log('Fetching ETR API...');
        const response = await fetch('https://etr.webnet.com.py/api/listar-padron-estado-v', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`ETR API Error: ${response.status} - ${errText}`);
        }

        const data = await response.json();
        if (!data.success || !data.data || !data.data.registros) {
            throw new Error('Formato de respuesta de API ETR inválido');
        }

        const registros = data.data.registros;
        console.log(`Recibidos ${registros.length} registros de la API ETR.`);

        // Extract set of cedulas that have voted
        const votedCedulas = new Set(registros.map((r: any) => String(r.cedula)));

        // Now, get all 'votos_confirmados' from our Firestore
        const db = admin.firestore();
        const snapshot = await db.collection('votos_confirmados').get();

        let updateCount = 0;
        let batch = db.batch();
        let currentBatchSize = 0;
        const commitPromises = [];

        for (const doc of snapshot.docs) {
            const docData = doc.data();
            const cedula = String(docData.CEDULA);
            if (votedCedulas.has(cedula) && docData.estado_votacion !== 'Ya Votó') {
                batch.update(doc.ref, { estado_votacion: 'Ya Votó', updatedAt: new Date().toISOString() });
                updateCount++;
                currentBatchSize++;
                
                if (currentBatchSize >= 450) {
                    commitPromises.push(batch.commit());
                    batch = db.batch();
                    currentBatchSize = 0;
                }
            }
        }

        if (currentBatchSize > 0) {
            commitPromises.push(batch.commit());
        }

        await Promise.all(commitPromises);

        return NextResponse.json({ 
            success: true, 
            message: `Sincronización completada. Se actualizaron ${updateCount} registros que ya votaron.` 
        });

    } catch (error: any) {
        console.error('Error syncing with ETR API:', error);
        return NextResponse.json({ success: false, error: error.message || String(error) }, { status: 500 });
    }
}
