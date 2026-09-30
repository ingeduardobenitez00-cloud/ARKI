const admin = require('firebase-admin');
const serviceAccount = require('./scripts/serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
async function run() {
    const snap = await db.collection('sheet_generales').where('CEDULA', 'in', [5630148, '5630148', 1121500, '1121500']).limit(2).get();
    snap.forEach(doc => {
        console.log(doc.data());
    });
    process.exit(0);
}
run();
