const admin = require('firebase-admin');
const serviceAccount = require('./scripts/serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function test() {
    const collections = await db.listCollections();
    for (let c of collections) {
        console.log("Collection:", c.id);
    }
    process.exit(0);
}
test();
