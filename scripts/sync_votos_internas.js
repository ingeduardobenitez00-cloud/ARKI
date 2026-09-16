const admin = require('firebase-admin');
const path = require('path');

const SERVICE_ACCOUNT_KEY_PATH = path.join(__dirname, 'serviceAccountKey.json');
const serviceAccount = require(SERVICE_ACCOUNT_KEY_PATH);

if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function syncVotosCargadosInternas() {
    console.log("Iniciando sincronización de votosCargadosInternas...");
    try {
        const votosSnap = await db.collection('votos_confirmados_internas').get();
        console.log(`Se encontraron ${votosSnap.size} votos de internas.`);

        const operatorCounts = {};

        votosSnap.forEach(docSnap => {
            const data = docSnap.data();
            if (data.registradoPor_id) {
                operatorCounts[data.registradoPor_id] = (operatorCounts[data.registradoPor_id] || 0) + 1;
            }
        });

        const usersSnap = await db.collection('users').get();
        const usersList = usersSnap.docs.map(d => d.id);

        let batch = db.batch();
        let count = 0;

        for (const userId of usersList) {
            const totalVotos = operatorCounts[userId] || 0;
            batch.update(db.collection('users').doc(userId), { votosCargadosInternas: totalVotos });
            count++;

            if (count >= 400) {
                await batch.commit();
                batch = db.batch();
                count = 0;
            }
        }
        if (count > 0) {
            await batch.commit();
        }

        console.log(`\nSincronización completada.`);
    } catch (e) {
        console.error("Error durante la sincronización:", e);
    }
    process.exit(0);
}

syncVotosCargadosInternas();
