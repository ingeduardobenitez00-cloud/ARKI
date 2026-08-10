const admin = require('firebase-admin');
const path = require('path');
const serviceAccount = require('./scripts/serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function check() {
    const doc = await db.collection('sheet1').doc('7219333').get();
    console.log(doc.data());
}
check();
