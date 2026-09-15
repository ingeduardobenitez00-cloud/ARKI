const admin = require('firebase-admin');
const serviceAccount = require('./scripts/serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function test() {
    console.log("Searching for 5630148 (number)");
    const snap = await db.collection('sheet_generales').where('CEDULA', '==', 5630148).get();
    snap.forEach(doc => console.log('DOC DATA:', doc.data()));
    
    console.log("Searching for 5630148 (string)");
    const snap2 = await db.collection('sheet_generales').where('CEDULA', '==', '5630148').get();
    snap2.forEach(doc => console.log('DOC DATA (str):', doc.data()));

    process.exit(0);
}
test();
