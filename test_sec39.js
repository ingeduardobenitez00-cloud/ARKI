const admin = require('firebase-admin');
const fs = require('fs');
const serviceAccount = JSON.parse(fs.readFileSync('scripts/serviceAccountKey.json'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
    const snap1 = await db.collection('locales_votacion').where('seccional_id', '==', '39').get();
    console.log("Seccional 39:");
    snap1.forEach(doc => console.log(doc.id, doc.data()));

    const snap2 = await db.collection('locales_votacion').where('nombre', '>=', 'PEDRO').where('nombre', '<=', 'PEDRO\uf8ff').get();
    console.log("\nPEDRO:");
    snap2.forEach(doc => console.log(doc.id, doc.data()));

    const snap3 = await db.collection('locales_votacion').where('nombre', '>=', 'COLEGIO NAC. PEDRO').where('nombre', '<=', 'COLEGIO NAC. PEDRO\uf8ff').get();
    console.log("\nCOLEGIO NAC. PEDRO:");
    snap3.forEach(doc => console.log(doc.id, doc.data()));

    process.exit(0);
}
run();
