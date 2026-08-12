const admin = require('firebase-admin');
const fs = require('fs');
const serviceAccount = JSON.parse(fs.readFileSync('scripts/serviceAccountKey.json'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
    const snap = await db.collection('votos_seguros').orderBy('fechaRegistro', 'desc').limit(5).get();
    snap.forEach(doc => {
        console.log(doc.id, doc.data());
    });
    process.exit(0);
}
run();
