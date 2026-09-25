const admin = require('firebase-admin');
const serviceAccount = require('./scripts/serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
async function run() {
    const snap = await db.collection('users').where('seccionales', 'array-contains', '34').get();
    snap.forEach(doc => {
        const data = doc.data();
        if (data.role !== 'Dirigente' && data.role !== 'Coordinador') {
            console.log(data.name, data.role, data.seccionales);
        }
    });
    process.exit(0);
}
run();
