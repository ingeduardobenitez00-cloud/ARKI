const admin = require('firebase-admin');
const serviceAccount = require('./scripts/serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function check() {
    const snap = await db.collection('locales_votacion').get();
    let count = 0;
    snap.forEach(doc => {
        const data = doc.data();
        if (data.total_electores === undefined) {
            console.log("Missing stats for:", doc.id, data.nombre);
            count++;
        }
    });
    console.log(`Total missing: ${count} of ${snap.docs.length}`);
}
check().catch(console.error);
