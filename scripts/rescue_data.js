const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const SERVICE_ACCOUNT_KEY_PATH = path.join(__dirname, 'serviceAccountKey.json');
if (!fs.existsSync(SERVICE_ACCOUNT_KEY_PATH)) {
    console.error(`❌ Error: No se encontró serviceAccountKey.json`);
    process.exit(1);
}

const serviceAccount = require(SERVICE_ACCOUNT_KEY_PATH);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function rescueData() {
    console.log(`\n🚀 Iniciando Rescate de Datos (Teléfonos y Votos Seguros) de sheet1 a sheet_generales...`);

    try {
        // Obtenemos solo los documentos de sheet1 que tengan TELEFONO o esten registrados
        console.log('⏳ Buscando electores con teléfonos registrados en las internas...');
        const phoneSnapshot = await db.collection('sheet1').where('TELEFONO', '!=', '').get();
        
        console.log('⏳ Buscando electores marcados como Voto Seguro en las internas...');
        // Como Firestore requiere índices compuestos para múltiples 'where', hacemos otra consulta para los votos
        // Alternativamente, podemos hacer una consulta por registradoPor_id != nulo (asumiendo que existe)
        const votoSnapshot = await db.collection('sheet1').where('registradoPor_id', '!=', '').get();

        const dataToRescue = new Map();

        phoneSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.TELEFONO) {
                dataToRescue.set(doc.id, { ...dataToRescue.get(doc.id), TELEFONO: data.TELEFONO });
            }
        });

        votoSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.registradoPor_id) {
                dataToRescue.set(doc.id, {
                    ...dataToRescue.get(doc.id),
                    registradoPor_id: data.registradoPor_id,
                    registradoPor_nombre: data.registradoPor_nombre || '',
                    fechaRegistro: data.fechaRegistro || null,
                    estado_votacion: data.estado_votacion || 'Pendiente'
                });
            }
        });

        console.log(`✅ Se encontraron ${dataToRescue.size} electores con datos históricos valiosos.`);
        console.log('\n⏳ Transfiriendo datos a sheet_generales...');

        let batch = db.batch();
        let writeCount = 0;
        let totalProcessed = 0;

        for (const [cedula, fieldsToRescue] of dataToRescue.entries()) {
            const docRef = db.collection('sheet_generales').doc(cedula);
            
            // Usamos merge: true para no borrar los datos nuevos del padron_capital.dbf
            batch.set(docRef, fieldsToRescue, { merge: true });
            
            writeCount++;
            totalProcessed++;

            if (writeCount === 500) {
                process.stdout.write(`\r   Progreso: ${totalProcessed}/${dataToRescue.size} transferidos...`);
                await batch.commit();
                batch = db.batch();
                writeCount = 0;
            }
        }

        if (writeCount > 0) {
            await batch.commit();
            process.stdout.write(`\r   Progreso: ${totalProcessed}/${dataToRescue.size} transferidos...`);
        }

        console.log(`\n\n🎉 ¡Rescate finalizado! Todos tus celulares y votos seguros ahora viven en sheet_generales.`);
        process.exit(0);

    } catch (error) {
        console.error("Error durante el rescate:", error);
    }
}

rescueData();
