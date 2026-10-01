const admin = require('firebase-admin');
const serviceAccount = require('./scripts/serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function test() {
    const snap = await db.collection('votos_confirmados').limit(1).get();
    if(snap.empty) {
        console.log('NO DOCS');
    } else {
        console.log(snap.docs[0].data());
    }
    process.exit(0);
}
test();
