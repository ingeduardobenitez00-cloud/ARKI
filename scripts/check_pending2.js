const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const SERVICE_ACCOUNT_KEY_PATH = path.join(__dirname, 'serviceAccountKey.json');
const serviceAccount = require(SERVICE_ACCOUNT_KEY_PATH);

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function checkMorePending() {
    const snap = await db.collection('locales_votacion')
        .where('nombre', '==', 'SIN DESCRIPCION')
        .get();
        
    let count = 0;
    console.log(`Buscando locales SIN DESCRIPCION con Local diferente de 999...`);
    snap.forEach(doc => {
        const data = doc.data();
        if (String(data.local) !== '999') {
            count++;
            if (count <= 10) {
                console.log(`- ${doc.id}: DPTO=${data.dpto}, DIST=${data.distrito}, ZONA=${data.zona}, LOCAL=${data.local}`);
            }
        }
    });
    console.log(`Total encontrados (sin contar los 999): ${count}`);
}
checkMorePending();
