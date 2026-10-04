const admin = require('firebase-admin');
const path = require('path');
const serviceAccount = require(path.join(__dirname, 'scripts', 'serviceAccountKey.json'));

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

async function run() {
    const db = admin.firestore();
    const snap = await db.collection('users').get();
    snap.docs.forEach(d => {
        const data = d.data();
        if (data.name?.toLowerCase().includes('guille') || data.nombre?.toLowerCase().includes('guille')) {
            console.log("ID de Guillermo:", d.id, data.name);
        }
    });
}
run();
