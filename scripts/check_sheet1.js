const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const SERVICE_ACCOUNT_KEY_PATH = path.join(__dirname, 'serviceAccountKey.json');
const serviceAccount = require(SERVICE_ACCOUNT_KEY_PATH);

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function checkSheet1() {
    const snap = await db.collection('sheet1').limit(1).get();
    if (!snap.empty) {
        console.log("Campos en sheet1:", Object.keys(snap.docs[0].data()).sort());
    } else {
        console.log("No se encontraron documentos en sheet1");
    }
}
checkSheet1();
