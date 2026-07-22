const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const { Dbf } = require('dbf-reader');

const SERVICE_ACCOUNT_KEY_PATH = path.join(__dirname, 'serviceAccountKey.json');
const DATA_FILE_NAME = 'padron_capital.dbf';
const COLLECTION_NAME = 'sheet1';
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

async function importDbf() {
    const dataFilePath = path.join(__dirname, DATA_FILE_NAME);
    if (!fs.existsSync(dataFilePath)) {
        console.error(`❌ Error: El archivo ${DATA_FILE_NAME} no existe.`);
        process.exit(1);
    }

    console.log(`\n🚀 Iniciando Migración desde DBF '${DATA_FILE_NAME}'...`);

    try {
        const buffer = fs.readFileSync(dataFilePath);
        const datatable = Dbf.read(buffer);
        
        console.log(`✅ Archivo leído. Total de registros en DBF: ${datatable.rows.length}`);
        
        if (datatable.rows.length === 0) {
            console.log('⚠️ El archivo está vacío.');
            return;
        }

        const firstRecordRow = datatable.rows[0];
        console.log('\n--- Estructura de la primera fila ---');
        console.log(firstRecordRow);
        
        console.log('\n⏳ Actualizando padrón y extrayendo Locales de Votación...');
        
        const validCedulasSet = new Set();
        const localesUnicos = new Set();
        
        let batch = db.batch();
        let writeCount = 0;
        let totalProcessed = 0;

        for (let i = 0; i < datatable.rows.length; i++) {
            const record = datatable.rows[i];
            
            // Intenta detectar la cédula dinámicamente o usa la primera columna
            const cedulaRaw = record['CEDULA'] || record['cedula'] || record['CI'] || record['ci'] || Object.values(record)[0];
            const cedulaStr = String(cedulaRaw).trim();
            
            // Intenta detectar el local
            const localRaw = record['LOCAL'] || record['local'] || record['LOCAL_VOTACION'] || record['LOCALVOTACION'] || record['COLEGIO'];
            if (localRaw && String(localRaw).trim() !== '') {
                localesUnicos.add(String(localRaw).trim().toUpperCase());
            }

            if (cedulaStr && cedulaStr !== 'undefined') {
                validCedulasSet.add(cedulaStr);
                
                const cleanRecord = Object.entries(record).reduce((acc, [key, value]) => {
                    const cleanKey = key.trim().toUpperCase();
                    if(cleanKey){
                        let finalValue = value;
                        if (typeof value === 'string') finalValue = value.trim().toUpperCase();
                        if (finalValue === '' || finalValue === null || finalValue === undefined) finalValue = undefined; 
                        acc[cleanKey] = finalValue;
                    }
                    return acc;
                }, {});

                const docRef = db.collection(COLLECTION_NAME).doc(cedulaStr);
                batch.set(docRef, cleanRecord, { merge: true });
                writeCount++;
                totalProcessed++;
            }

            if (writeCount === BATCH_SIZE || totalProcessed === datatable.rows.length) {
                process.stdout.write(`\r   Progreso: ${totalProcessed}/${datatable.rows.length} procesados...`);
                await batch.commit();
                batch = db.batch();
                writeCount = 0;
            }
        }

        console.log(`\n\n🎉 ¡Importación del Padrón finalizada!`);
        console.log(`✅ Electores procesados: ${totalProcessed}`);

        console.log('\n⏳ Guardando Locales de Votación extraídos...');
        
        let localesBatch = db.batch();
        let localesWriteCount = 0;
        
        for (const localName of localesUnicos) {
            // El ID del local puede ser un slug, pero guardamos el nombre original
            const docId = localName.replace(/[^a-zA-Z0-9]/g, '_');
            const localRef = db.collection('locales_votacion').doc(docId);
            
            // Usamos merge true para no sobreescribir la seccional si ya estaba mapeado en una prueba anterior
            localesBatch.set(localRef, {
                nombre: localName,
                seccional_id: null,
                status: 'pending_seccional',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            
            localesWriteCount++;
            if (localesWriteCount === BATCH_SIZE) {
                await localesBatch.commit();
                localesBatch = db.batch();
                localesWriteCount = 0;
            }
        }
        
        if (localesWriteCount > 0) {
            await localesBatch.commit();
        }

        console.log(`✅ Total de Locales Únicos extraídos: ${localesUnicos.size}`);
        console.log(`\n👉 Siguiente paso: Ve a la App > Configuración > Mapeo de Locales para asignarles la Seccional.`);

    } catch (error) {
        console.error('\n❌ Error durante la importación:', error);
    }
}

importDbf();
