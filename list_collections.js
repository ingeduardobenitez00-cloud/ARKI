const admin = require('firebase-admin');
const serviceAccount = require('./scripts/serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
async function run() {
    const collections = await db.listCollections();
    collections.forEach(collection => {
        console.log('Collection:', collection.id);
    });
    process.exit(0);
}
run();
