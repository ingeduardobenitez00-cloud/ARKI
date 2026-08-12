const admin = require('firebase-admin');
const fs = require('fs');
const serviceAccount = JSON.parse(fs.readFileSync('scripts/serviceAccountKey.json'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
    const snap1 = await db.collection('votos_seguros').where('seccional', '==', '').get();
    snap1.forEach(doc => {
        console.log("Empty seccional:", doc.id, doc.data());
    });
    
    const snap2 = await db.collection('votos_seguros').where('seccional', '==', 'SIN SECCIONAL').get();
    snap2.forEach(doc => {
        console.log("SIN SECCIONAL:", doc.id, doc.data());
    });
    process.exit(0);
}
run();
