const admin = require('firebase-admin');
const serviceAccount = require('./scripts/serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function test() {
    const snap = await db.collection('sheet1').where('CEDULA', '==', 5630148).get();
    snap.forEach(doc => console.log('DOC DATA sheet1:', doc.data()));
    process.exit(0);
}
test();
