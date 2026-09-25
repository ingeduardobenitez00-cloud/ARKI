const admin = require('firebase-admin');
const serviceAccount = require('./scripts/serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
async function run() {
    const snap = await db.collection('sheet_generales').where('CEDULA', '==', 1535387).get();
    snap.forEach(doc => {
        const data = doc.data();
        console.log('OBDON:', data.LOCAL, data.DESC_LOCAL);
    });

    const snap2 = await db.collection('sheet_generales').where('CEDULA', '==', '1535387').get();
    snap2.forEach(doc => {
        const data = doc.data();
        console.log('OBDON (str):', data.LOCAL, data.DESC_LOCAL);
    });
    process.exit(0);
}
run();
