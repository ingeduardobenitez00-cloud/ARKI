const admin = require('firebase-admin');
const serviceAccount = require('./scripts/serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function test() {
    const snap = await db.collection('sheet_generales').limit(10).get();
    snap.forEach(doc => {
        console.log('MESA:', doc.data().MESA, 'ORDEN:', doc.data().ORDEN);
    });
    process.exit(0);
}
test();
