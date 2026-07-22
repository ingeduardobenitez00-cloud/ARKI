const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const { Dbf } = require('dbf-reader');

const SERVICE_ACCOUNT_KEY_PATH = path.join(__dirname, 'serviceAccountKey.json');
const DATA_FILE_NAME = 'loc.dbf';
const COLLECTION_NAME = 'locales_votacion';
const BATCH_SIZE = 500;

if (!fs.existsSync(SERVICE_ACCOUNT_KEY_PATH)) {
    console.error(`❌ Error: No se encontró serviceAccountKey.json en ${SERVICE_ACCOUNT_KEY_PATH}`);
    process.exit(1);
}

const serviceAccount = require(SERVICE_ACCOUNT_KEY_PATH);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

async function importLocales() {
    const dataFilePath = path.join(__dirname, DATA_FILE_NAME);
    if (!fs.existsSync(dataFilePath)) {
        console.error(`❌ Error: El archivo ${DATA_FILE_NAME} no existe.`);
        process.exit(1);
    }

    console.log(`\n🚀 Iniciando Migración desde DBF '${DATA_FILE_NAME}'...`);

    try {
        const buffer = fs.readFileSync(dataFilePath);
        const datatable = Dbf.read(buffer);
        
        console.log(`✅ Archivo leído. Total de locales: ${datatable.rows.length}`);

        let batch = db.batch();
        let writeCount = 0;
        let totalProcessed = 0;

        for (let i = 0; i < datatable.rows.length; i++) {
            const record = datatable.rows[i];
            
            // Creamos un ID único compuesto para asegurar que no haya choques entre distritos distintos
            const dpto = record['DPTO'];
            const distrito = record['DISTRITO'];
            const zona = record['ZONA'];
            const local = record['LOCAL'];

            if (local !== undefined) {
                const docId = `${dpto}_${distrito}_${zona}_${local}`;
                const docRef = db.collection(COLLECTION_NAME).doc(docId);
                const nombre = record['DESCRIP'] ? String(record['DESCRIP']).trim() : `Local ${docId}`;
                
                batch.set(docRef, {
                    nombre: nombre,
                    dpto: dpto,
                    distrito: distrito,
                    zona: zona,
                    local: local,
                    codigo_local: local,
                    seccional_id: null,
                    status: 'pending_seccional',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                
                writeCount++;
                totalProcessed++;

                if (writeCount === BATCH_SIZE || totalProcessed === datatable.rows.length) {
                    process.stdout.write(`\r   Progreso: ${totalProcessed}/${datatable.rows.length} procesados...`);
                    await batch.commit();
                    batch = db.batch();
                    writeCount = 0;
                }
            }
        }

        console.log(`\n\n🎉 ¡Importación de Locales finalizada exitosamente!`);

    } catch (error) {
        console.error('\n❌ Error durante la importación:', error);
    }
}

importLocales();
