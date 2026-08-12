const admin = require('firebase-admin');
const fs = require('fs');
const serviceAccount = JSON.parse(fs.readFileSync('scripts/serviceAccountKey.json'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
    const docRef = db.collection('votos_confirmados').doc('5743775');
    await docRef.update({ CODIGO_SEC: '39' });
    console.log("Updated 5743775 to have CODIGO_SEC: '39'");
    process.exit(0);
}
run();
