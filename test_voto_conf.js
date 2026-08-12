const admin = require('firebase-admin');
const fs = require('fs');
const serviceAccount = JSON.parse(fs.readFileSync('scripts/serviceAccountKey.json'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
    const snap = await db.collection('votos_confirmados').get();
    let sinSeccionalDocs = [];
    snap.forEach(doc => {
        const data = doc.data();
        if(!data.seccional || data.seccional === '' || data.seccional === 'SIN SECCIONAL') {
            sinSeccionalDocs.push({id: doc.id, data});
        }
    });
    console.log(`Found ${sinSeccionalDocs.length} records without seccional`);
    sinSeccionalDocs.forEach(d => console.log(d.id, d.data.seccional, d.data.CODIGO_SEC, d.data.LOCAL, d.data.DESC_LOCAL));
    process.exit(0);
}
run();
