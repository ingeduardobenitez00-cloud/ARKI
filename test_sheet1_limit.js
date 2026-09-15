const admin = require('firebase-admin');
const serviceAccount = require('./scripts/serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function test() {
    const snap = await db.collection('sheet1').limit(1).get();
    if(snap.empty) {
        console.log('sheet1 is empty');
    } else {
        console.log('sheet1 doc:', snap.docs[0].data());
    }
    process.exit(0);
}
test();
