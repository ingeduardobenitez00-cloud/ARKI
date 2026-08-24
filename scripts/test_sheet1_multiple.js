const admin = require('firebase-admin');
const path = require('path');
const serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function checkSheet1() {
    const snap = await db.collection('sheet1').limit(5).get();
    snap.docs.forEach(doc => {
        console.log("ID:", doc.id);
        console.log("Data:", doc.data());
        console.log("---");
    });
    process.exit(0);
}
checkSheet1();
