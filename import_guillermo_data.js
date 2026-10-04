const admin = require('firebase-admin');
const path = require('path');
const xlsx = require('xlsx');

const serviceAccount = require(path.join(__dirname, 'scripts', 'serviceAccountKey.json'));

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

async function run() {
    const db = admin.firestore();
    const GUILLERMO_ID = 'xwp6MPAWUIfs1BkNWTpzTyTcq0b2';
    
    const workbook = xlsx.readFile('guillermo.xlsx');
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet);
    
    console.log(`Leídas ${data.length} filas del Excel.`);
    
    // Preparar el usuario Guillermo
    const guilleDoc = await db.collection('users').doc(GUILLERMO_ID).get();
    const guilleData = guilleDoc.data();
    const registradoPor = {
        id: GUILLERMO_ID,
        nombre: guilleData.name || guilleData.nombre || 'Guillermo Fernandez',
        cedula: guilleData.cedula || ''
    };

    let inserted = 0;
    let notFound = 0;
    const batchSize = 400;
    let currentBatch = db.batch();
    let currentBatchCount = 0;

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (!row.CEDULA) continue;
        
        // Find in padron
        const pSnap = await db.collection('padron').where('CEDULA', '==', Number(row.CEDULA)).limit(1).get();
        if (pSnap.empty) {
            notFound++;
            continue;
        }

        const pData = pSnap.docs[0].data();
        
        // Generate new document
        const newRef = db.collection('votos_confirmados').doc();
        const votoData = {
            ...pData,
            TELEFONO: row.TELEFONO ? String(row.TELEFONO) : '',
            PUNTEROS: row.PUNTEROS || 'SIN PUNTERO ASIGNADO',
            registradoPor_id: registradoPor.id,
            registradoPor_nombre: registradoPor.nombre,
            registradoPor_cedula: registradoPor.cedula,
            fechaRegistro: new Date().toISOString()
        };

        currentBatch.set(newRef, votoData);
        currentBatchCount++;
        inserted++;

        if (currentBatchCount >= batchSize) {
            await currentBatch.commit();
            console.log(`Guardados ${inserted} votos seguros...`);
            currentBatch = db.batch();
            currentBatchCount = 0;
        }
    }
    
    if (currentBatchCount > 0) {
        await currentBatch.commit();
    }
    
    console.log(`¡Importación completa! Se insertaron ${inserted} electores con éxito. (No encontrados en padrón: ${notFound})`);
}

run().catch(console.error);
