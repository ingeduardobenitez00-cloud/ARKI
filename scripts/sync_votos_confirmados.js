const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const SERVICE_ACCOUNT_KEY_PATH = path.join(__dirname, 'serviceAccountKey.json');
const serviceAccount = require(SERVICE_ACCOUNT_KEY_PATH);

if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function syncVotosConfirmados() {
    console.log("Iniciando sincronización de MESA y ORDEN en votos_confirmados...");
    try {
        const votosSnap = await db.collection('votos_confirmados').get();
        console.log(`Se encontraron ${votosSnap.size} votos confirmados.`);

        let batch = db.batch();
        let writeCount = 0;
        let updatedCount = 0;

        for (const doc of votosSnap.docs) {
            const data = doc.data();
            const cedula = data.CEDULA;

            if (cedula) {
                // Search in sheet_generales
                const padronDoc = await db.collection('sheet_generales').doc(String(cedula)).get();
                if (padronDoc.exists) {
                    const padronData = padronDoc.data();
                    if (padronData.MESA || padronData.ORDEN) {
                        const updateData = {};
                        if (padronData.MESA) updateData.MESA = padronData.MESA;
                        if (padronData.ORDEN) updateData.ORDEN = padronData.ORDEN;
                        
                        batch.update(doc.ref, updateData);
                        writeCount++;
                        updatedCount++;

                        if (writeCount === 500) {
                            await batch.commit();
                            console.log(`  Procesando... ${updatedCount} actualizados.`);
                            batch = db.batch();
                            writeCount = 0;
                        }
                    }
                }
            }
        }

        if (writeCount > 0) {
            await batch.commit();
        }

        console.log(`\nSincronización completada. Se actualizaron ${updatedCount} votos confirmados con MESA y ORDEN.`);
    } catch (e) {
        console.error("Error durante la sincronización:", e);
    }
    process.exit(0);
}

syncVotosConfirmados();
