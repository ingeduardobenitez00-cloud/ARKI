const admin = require('firebase-admin');
const serviceAccount = require('./scripts/serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function check() {
    const snap = await db.collection('locales_votacion').limit(3).get();
    snap.forEach(doc => console.log(doc.id, doc.data()));
}
check().catch(console.error);
