const admin = require('firebase-admin');
const serviceAccount = require('./scripts/serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function test() {
    try {
        const snap = await db.collection('votos_confirmados')
            .where('LOCAL', '==', 33)
            .where('MESA', '==', 6)
            .where('ORDEN', '==', 227)
            .get();
        if(snap.empty) {
            console.log('NO DOCS MATCHING LOCAL, MESA, ORDEN');
        } else {
            console.log('MATCH:', snap.docs[0].id, snap.docs[0].data().NOMBRE_COMPLETO);
        }
    } catch(e) {
        console.error('QUERY ERROR:', e.message);
    }
    process.exit(0);
}
test();
