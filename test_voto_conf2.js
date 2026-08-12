const admin = require('firebase-admin');
const fs = require('fs');
const serviceAccount = JSON.parse(fs.readFileSync('scripts/serviceAccountKey.json'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
    console.log("CODIGO_SEC is empty or SIN SECCIONAL:");
    const snap = await db.collection('votos_confirmados').get();
    snap.forEach(doc => {
        const data = doc.data();
        if (!data.CODIGO_SEC || data.CODIGO_SEC === '' || data.CODIGO_SEC === 'SIN SECCIONAL') {
            console.log(doc.id, "CODIGO_SEC:", data.CODIGO_SEC, "LOCAL:", data.LOCAL, "DESC_LOCAL:", data.DESC_LOCAL, "seccional:", data.seccional);
        }
    });
    process.exit(0);
}
run();
