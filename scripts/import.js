
// Script de Sincronización Total con Purga de Diferencia
// Este script es el motor de actualización del padrón.

const admin = require('firebase-admin');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// --- CONFIGURACIÓN ---
const DATA_FILE_NAME = 'padron.xlsx'; 
let COLLECTION_NAME = 'sheet1'; 
const SERVICE_ACCOUNT_KEY_PATH = path.join(__dirname, 'serviceAccountKey.json');
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

async function importDataToFirestore() {
    const dataFilePath = path.join(__dirname, DATA_FILE_NAME);
    if (!fs.existsSync(dataFilePath)) {
        console.error(`❌ Error: El archivo ${DATA_FILE_NAME} no existe en la carpeta scripts/`);
        process.exit(1);
    }
    
    console.log(`\n🚀 Iniciando Sincronización Estratégica desde '${DATA_FILE_NAME}'...`);

    try {
        const workbook = XLSX.readFile(dataFilePath, { cellDates: true });
        // Tomamos automáticamente la PRIMERA HOJA
        const sheetName = workbook.SheetNames[0];
        const records = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false });
        
        const totalRecordsInFile = records.length;
        if (totalRecordsInFile === 0) {
            console.log('⚠️ El archivo está vacío. Operación cancelada por seguridad.');
            return;
        }

        console.log(`✅ Registros en archivo (Hoja: ${sheetName}): ${totalRecordsInFile}`);
        console.log(`ℹ️ Se protegerán los teléfonos y GPS ya cargados.`);

        // --- FASE 1: ACTUALIZACIÓN Y FUSIÓN ---
        console.log('\n⏳ Fase 1: Actualizando registros y fusionando datos...');
        
        const validCedulasSet = new Set();
        let batch = db.batch();
        let writeCount = 0;
        let totalProcessed = 0;

        for (let i = 0; i < totalRecordsInFile; i++) {
            const record = records[i];
            
            const cleanRecord = Object.entries(record).reduce((acc, [key, value]) => {
                const cleanKey = key.trim().toUpperCase();
                if(cleanKey){
                    let finalValue = value;
                    if (typeof value === 'string') {
                        finalValue = value.trim().toUpperCase();
                    }
                    // Si la celda está vacía en Excel, usamos undefined para que Firestore NO toque el dato actual
                    if (finalValue === '' || finalValue === null || finalValue === undefined || String(finalValue).toLowerCase() === 'null') {
                        finalValue = undefined; 
                    }
                    acc[cleanKey] = finalValue;
                }
                return acc;
            }, {});

            const cedula = cleanRecord.CEDULA;
            if (cedula !== undefined && cedula !== null) {
                const cedulaStr = String(cedula);
                validCedulasSet.add(cedulaStr);
                
                const docRef = db.collection(COLLECTION_NAME).doc(cedulaStr);
                // merge: true es fundamental para no borrar teléfonos manuales
                batch.set(docRef, cleanRecord, { merge: true });
                writeCount++;
                totalProcessed++;
            }

            if (writeCount === BATCH_SIZE || totalProcessed === totalRecordsInFile) {
                process.stdout.write(`\r   Progreso: ${totalProcessed}/${totalRecordsInFile} sincronizados...`);
                await batch.commit();
                batch = db.batch();
                writeCount = 0;
            }
        }

        // --- FASE 2: PURGA DE LA DIFERENCIA ---
        console.log('\n\n🧹 Fase 2: Eliminando registros obsoletos (la diferencia)...');
        
        const allDocRefs = await db.collection(COLLECTION_NAME).listDocuments();
        let deleteBatch = db.batch();
        let deleteCount = 0;
        let totalDeleted = 0;

        for (const docRef of allDocRefs) {
            // Si el documento en la base de datos NO está en nuestro nuevo Set de cédulas válidas, se borra.
            if (!validCedulasSet.has(docRef.id)) {
                deleteBatch.delete(docRef);
                deleteCount++;
                totalDeleted++;
            }

            if (deleteCount === BATCH_SIZE) {
                await deleteBatch.commit();
                deleteBatch = db.batch();
                deleteCount = 0;
                process.stdout.write(`\r   Eliminados: ${totalDeleted} registros sobrantes...`);
            }
        }
        
        if (deleteCount > 0) {
            await deleteBatch.commit();
        }

        console.log(`\n\n🎉 ¡Sincronización exitosa!`);
        console.log(`-----------------------------------------`);
        console.log(`✅ Registros Actualizados/Mantenidos: ${totalProcessed}`);
        console.log(`🗑️ Registros Eliminados (Purga): ${totalDeleted}`);
        console.log(`📊 Total Final en Base de Datos: ${validCedulasSet.size}`);
        console.log(`-----------------------------------------`);
        console.log(`👉 Paso final: Entra a la App -> Configuración -> "SINCRONIZAR PADRÓN NACIONAL".`);

    } catch (error) {
        console.error('\n❌ Error crítico durante la importación:', error);
    }
}

importDataToFirestore();
