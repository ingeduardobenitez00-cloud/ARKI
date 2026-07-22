const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const SERVICE_ACCOUNT_KEY_PATH = path.join(__dirname, 'serviceAccountKey.json');
const SUFFIX = '_InternasANR_2026';

if (!fs.existsSync(SERVICE_ACCOUNT_KEY_PATH)) {
    console.error(`❌ Error: No se encontró serviceAccountKey.json en ${SERVICE_ACCOUNT_KEY_PATH}`);
    process.exit(1);
}

const serviceAccount = require(SERVICE_ACCOUNT_KEY_PATH);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Colecciones a respaldar y luego vaciar
const collectionsToArchive = [
    'votos_seguros',
    'dia_d',
    'electoral_stats'
];

async function archiveAndClear() {
    console.log(`\n📦 Iniciando Archivo y Limpieza de Elecciones (Sufijo: ${SUFFIX})...`);

    for (const colName of collectionsToArchive) {
        console.log(`\nProcesando colección: ${colName}`);
        try {
            const snapshot = await db.collection(colName).get();
            if (snapshot.empty) {
                console.log(`  └─ Colección vacía. Se omite.`);
                continue;
            }

            console.log(`  └─ Respaldando ${snapshot.size} documentos a ${colName}${SUFFIX}...`);
            
            let batch = db.batch();
            let count = 0;
            
            // 1. Respaldar
            for (const doc of snapshot.docs) {
                const newRef = db.collection(`${colName}${SUFFIX}`).doc(doc.id);
                batch.set(newRef, doc.data());
                count++;
                
                if (count === 500) {
                    await batch.commit();
                    batch = db.batch();
                    count = 0;
                }
            }
            if (count > 0) {
                await batch.commit();
            }
            console.log(`  └─ Respaldo exitoso.`);

            // 2. Vaciar colección original
            console.log(`  └─ Vaciando la colección original ${colName}...`);
            let deleteBatch = db.batch();
            let delCount = 0;
            for (const doc of snapshot.docs) {
                deleteBatch.delete(doc.ref);
                delCount++;
                if (delCount === 500) {
                    await deleteBatch.commit();
                    deleteBatch = db.batch();
                    delCount = 0;
                }
            }
            if (delCount > 0) {
                await deleteBatch.commit();
            }
            console.log(`  └─ Vaciado exitoso.`);

        } catch (error) {
            console.error(`❌ Error procesando la colección ${colName}:`, error);
        }
    }

    console.log(`\n🎉 ¡Proceso finalizado! Las colecciones han sido archivadas y vaciadas.`);
}

archiveAndClear();
