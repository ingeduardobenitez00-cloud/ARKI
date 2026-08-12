const admin = require('firebase-admin');
const fs = require('fs');
const serviceAccount = JSON.parse(fs.readFileSync('scripts/serviceAccountKey.json'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
    const doc = await db.collection('sheet1').doc('5743775').get();
    console.log("Padron:", doc.data());

    const doc2 = await db.collection('votos_confirmados').doc('5743775').get();
    console.log("Voto Confirmado:", doc2.data());

    process.exit(0);
}
run();
