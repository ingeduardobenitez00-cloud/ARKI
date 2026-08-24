const admin = require('firebase-admin');
const path = require('path');
const serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function checkPadron() {
    const snap = await db.collection('padron').limit(1).get();
    if (snap.empty) {
        console.log('No hay registros en padron');
    } else {
        console.log('Primer registro en padron:');
        console.log(snap.docs[0].data());
    }
    process.exit(0);
}
checkPadron();
