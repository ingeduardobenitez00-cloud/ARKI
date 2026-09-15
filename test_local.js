const admin = require('firebase-admin');
const serviceAccount = require('./scripts/serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function checkLocal() {
    const snap = await db.collection('sheet_generales').where('DESC_LOCAL', '==', 'COL. PABLO L. AVILA').limit(1).get();
    if(snap.empty) {
        console.log('Not found');
    } else {
        console.log('Found:', snap.docs[0].data());
    }
}
checkLocal();
