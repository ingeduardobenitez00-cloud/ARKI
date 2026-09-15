const admin = require('firebase-admin');
const serviceAccount = require('./scripts/serviceAccountKey.json');
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();
async function checkUser() {
    const snap = await db.collection('users').where('name', '>=', 'GUILLERMO').limit(5).get();
    snap.forEach(doc => console.log(doc.data().name, doc.data().role, doc.data().seccionales));
    process.exit(0);
}
checkUser();
