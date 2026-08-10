const admin = require('firebase-admin');
const serviceAccount = require('./scripts/serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function check() {
    const snap = await db.collection('locales_votacion').where('nombre', '>=', 'COL').get();
    snap.forEach(doc => {
        const data = doc.data();
        if (data.nombre.includes('SAGRADO')) {
            console.log(doc.id, data.nombre, "Electores:", data.total_electores);
        }
    });
}
check().catch(console.error);
