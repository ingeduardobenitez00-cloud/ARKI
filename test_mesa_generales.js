const admin = require('firebase-admin');
const serviceAccount = require('./scripts/serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function test() {
    const snap = await db.collection('sheet_generales').where('MESA', '!=', null).limit(1).get();
    if(snap.empty) {
        console.log('NO MESA IN sheet_generales');
    } else {
        console.log('FOUND MESA:', snap.docs[0].data().MESA);
    }
    process.exit(0);
}
test();
