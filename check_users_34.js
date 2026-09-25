const admin = require('firebase-admin');
const serviceAccount = require('./scripts/serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
async function run() {
    const snap = await db.collection('users').where('seccionales', 'array-contains', '34').get();
    if (snap.empty) {
        console.log('No users found in Seccional 34');
    } else {
        snap.forEach(doc => {
            const data = doc.data();
            console.log(data.name, '-> local:', data.local, '-> locales:', data.locales, '-> mesas:', data.mesas);
        });
    }
    process.exit(0);
}
run();
