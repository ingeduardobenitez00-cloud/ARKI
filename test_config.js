const admin = require('firebase-admin');
const serviceAccount = require('./scripts/serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function checkConfig() {
    const snap = await db.collection('locales_votacion').where('nombre', '==', 'COL. PABLO L. AVILA').get();
    if(snap.empty) {
        console.log('Not mapped in configuration');
    } else {
        snap.forEach(doc => console.log('Mapped:', doc.data()));
    }
}
checkConfig();
