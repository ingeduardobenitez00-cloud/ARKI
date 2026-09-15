const admin = require('firebase-admin');
const serviceAccount = require('./scripts/serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function test() {
    const snap = await db.collection('sheet_generales').count().get();
    console.log('TOTAL DOCS:', snap.data().count);
    process.exit(0);
}
test();
