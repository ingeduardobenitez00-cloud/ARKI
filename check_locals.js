const admin = require('firebase-admin');
const serviceAccount = require('./scripts/serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
async function run() {
    const snap = await db.collection('locales_votacion').where('seccional_id', '==', '5').get();
    if (snap.empty) {
        console.log('No locals found for seccional 5');
    } else {
        snap.forEach(doc => console.log(doc.data().nombre));
    }
    process.exit(0);
}
run();
