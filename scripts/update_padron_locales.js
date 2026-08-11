// Script de Actualización Parcial del Padrón Oficial desde DBF
// Este script lee el archivo padron_capital.dbf y ÚNICAMENTE actualiza 
// los campos LOCAL, MESA, ORDEN y CODIGO_SEC para cada CÉDULA.
// Protege toda la información recolectada (Ubicación GPS, Teléfonos, Votos, etc).

const admin = require('firebase-admin');
const { Dbf } = require('dbf-reader');
const path = require('path');
const fs = require('fs');

// --- CONFIGURACIÓN ---
const DATA_FILE_NAME = 'padron_capital.dbf'; 
const COLLECTION_NAME = 'sheet1'; 
const SERVICE_ACCOUNT_KEY_PATH = path.join(__dirname, 'serviceAccountKey.json');
const BATCH_SIZE = 450; // Límite de Firestore es 500

if (!fs.existsSync(SERVICE_ACCOUNT_KEY_PATH)) {
    console.error(`❌ Error: No se encontró serviceAccountKey.json en ${SERVICE_ACCOUNT_KEY_PATH}`);
    process.exit(1);
}

const serviceAccount = require(SERVICE_ACCOUNT_KEY_PATH);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

async function updateLocalesMesaOrdenDbf() {
    const dataFilePath = path.join(__dirname, DATA_FILE_NAME);
    if (!fs.existsSync(dataFilePath)) {
        console.error(`❌ Error: El archivo ${DATA_FILE_NAME} no existe en la carpeta scripts/`);
        process.exit(1);
    }
    
    console.log(`\n🚀 Iniciando Actualización Parcial desde '${DATA_FILE_NAME}'...`);
    console.log(`⚠️  ATENCIÓN: SOLO se actualizarán LOCAL, MESA, ORDEN y CODIGO_SEC.`);
    console.log(`ℹ️  Toda la información capturada (Teléfonos, GPS, Votos Seguros) permanecerá intacta.\n`);

    try {
        const buffer = fs.readFileSync(dataFilePath);
        const datatable = Dbf.read(buffer);
        
        console.log(`✅ Archivo leído. Total de registros en DBF: ${datatable.rows.length}`);
        
        if (datatable.rows.length === 0) {
            console.log('⚠️ El archivo está vacío. Operación cancelada.');
            return;
        }

        console.log('\n⏳ Actualizando registros en Firebase...');
        
        let batch = db.batch();
        let writeCount = 0;
        let totalProcessed = 0;

        for (let i = 0; i < datatable.rows.length; i++) {
            const record = datatable.rows[i];
            
            // Buscar la columna Cédula
            const cedulaKey = Object.keys(record).find(k => k.trim().toUpperCase() === 'CEDULA' || k.trim().toUpperCase() === 'CI');
            
            let localKey = null;
            const preferredLocalKeys = ['DESC_LOCAL', 'DESCRIP', 'LOCAL_VOTACION', 'LOCALVOTACION', 'COLEGIO', 'LOCAL'];
            for (const pref of preferredLocalKeys) {
                const found = Object.keys(record).find(k => k.trim().toUpperCase() === pref);
                if (found) {
                    localKey = found;
                    break;
                }
            }
            
            const mesaKey = Object.keys(record).find(k => k.trim().toUpperCase() === 'MESA');
            const ordenKey = Object.keys(record).find(k => k.trim().toUpperCase() === 'ORDEN');
            const secKey = Object.keys(record).find(k => ['CODIGO_SEC', 'SECCIONAL', 'SECC'].includes(k.trim().toUpperCase()));

            if (!cedulaKey || !record[cedulaKey]) continue;

            const cedulaStr = String(record[cedulaKey]).trim();
            const updateData = {};

            // Mapeamos ubicacion electoral obligatoria
            if (localKey && record[localKey]) updateData.LOCAL = String(record[localKey]).trim().toUpperCase();
            if (mesaKey && record[mesaKey]) updateData.MESA = String(record[mesaKey]).trim();
            if (ordenKey && record[ordenKey]) updateData.ORDEN = String(record[ordenKey]).trim();
            if (secKey && record[secKey]) updateData.CODIGO_SEC = String(record[secKey]).trim();
            
            // Extraer y forzar datos basicos perdidos (si la base no los tenia)
            // Firebase con { merge: true } agregara esto si faltaba, o sobreescribira
            // pero como los nombres vienen del DBF oficial, es seguro actualizarlos.
            let nombreKey = Object.keys(record).find(k => k.trim().toUpperCase() === 'NOMBRE');
            let apellidoKey = Object.keys(record).find(k => k.trim().toUpperCase() === 'APELLIDO');
            let dirKey = Object.keys(record).find(k => k.trim().toUpperCase() === 'DIRECCION');
            let fnKey = Object.keys(record).find(k => k.trim().toUpperCase() === 'FECHA_NACI' || k.trim().toUpperCase() === 'FEC_NAC');
            
            updateData.CEDULA = cedulaStr;
            if (nombreKey && record[nombreKey]) updateData.NOMBRE = String(record[nombreKey]).trim().toUpperCase();
            if (apellidoKey && record[apellidoKey]) updateData.APELLIDO = String(record[apellidoKey]).trim().toUpperCase();
            if (dirKey && record[dirKey]) updateData.DIRECCION = String(record[dirKey]).trim().toUpperCase();
            if (fnKey && record[fnKey]) updateData.FECHA_NACI = String(record[fnKey]).trim();

            // Si hay algo que actualizar
            if (Object.keys(updateData).length > 0) {
                const docRef = db.collection(COLLECTION_NAME).doc(cedulaStr);
                // merge: true asegura que SOLO se toquen los campos especificados, 
                // respetando todo el resto (teléfono, lat, lng, etc.)
                batch.set(docRef, updateData, { merge: true });
                writeCount++;
                totalProcessed++;
            }

            // Enviar el lote a Firestore si llegamos al límite
            if (writeCount === BATCH_SIZE || i === datatable.rows.length - 1) {
                process.stdout.write(`\r   Progreso: ${totalProcessed}/${datatable.rows.length} procesados...`);
                await batch.commit();
                batch = db.batch();
                writeCount = 0;
            }
        }

        console.log(`\n\n🎉 ¡Actualización Parcial Finalizada!`);
        console.log(`-----------------------------------------`);
        console.log(`✅ Electores Actualizados: ${totalProcessed}`);
        console.log(`🛡️ Teléfonos y GPS: Intactos.`);
        console.log(`-----------------------------------------`);

    } catch (error) {
        console.error('\n❌ Error crítico durante la actualización:', error);
    }
}

updateLocalesMesaOrdenDbf();
