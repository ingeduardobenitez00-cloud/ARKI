const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const SERVICE_ACCOUNT_KEY_PATH = path.join(__dirname, 'serviceAccountKey.json');
const serviceAccount = require(SERVICE_ACCOUNT_KEY_PATH);

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function checkPending() {
    const snap = await db.collection('locales_votacion')
        .where('nombre', '==', 'SIN DESCRIPCION')
        .limit(10)
        .get();
        
    console.log(`Encontrados ${snap.size} locales SIN DESCRIPCION.`);
    snap.forEach(doc => {
        const data = doc.data();
        console.log(`- ${doc.id}: DPTO=${data.dpto}, DIST=${data.distrito}, ZONA=${data.zona}, LOCAL=${data.local}`);
    });
}
checkPending();
