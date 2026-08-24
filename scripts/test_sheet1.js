const admin = require('firebase-admin');
const path = require('path');
const serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function checkSheet1() {
    const snap = await db.collection('sheet1').limit(1).get();
    if (snap.empty) {
        console.log('No hay registros en sheet1');
    } else {
        console.log('Primer registro en sheet1:');
        console.log(snap.docs[0].id);
        console.log(snap.docs[0].data());
    }
    process.exit(0);
}
checkSheet1();
