const admin = require('firebase-admin');
const serviceAccount = require('./scripts/serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
async function run() {
    const snap = await db.collection('locales_votacion').where('nombre', '==', 'ESCUELA SANTA ANA').get();
    if (snap.empty) {
        console.log('No local found');
    } else {
        snap.forEach(doc => console.log(doc.id, doc.data()));
    }
    process.exit(0);
}
run();
