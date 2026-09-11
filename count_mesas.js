const admin = require('firebase-admin');
const serviceAccount = require('./scripts/serviceAccountKey.json');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function count() {
    const snapshot = await db.collection('sheet1').get();
    const mesas = new Set();
    snapshot.forEach(doc => {
        const data = doc.data();
        if (data.LOCAL && data.MESA) {
            mesas.add(data.LOCAL + '-' + data.MESA);
        }
    });
    console.log('Total Mesas:', mesas.size);
    process.exit(0);
}
count();
