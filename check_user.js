const admin = require('firebase-admin');
const serviceAccount = require('./scripts/serviceAccountKey.json');
if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function run() {
    const snap = await db.collection('users').where('name', '==', 'GUILLERMO RAMON NOGUERA MONGES').get();
    if (snap.empty) {
        console.log('No user found');
    } else {
        snap.forEach(doc => console.log(doc.id, '=>', doc.data()));
    }
    process.exit(0);
}
run();
