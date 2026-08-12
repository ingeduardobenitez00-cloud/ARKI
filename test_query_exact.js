const admin = require('firebase-admin');
const fs = require('fs');
const serviceAccount = JSON.parse(fs.readFileSync('scripts/serviceAccountKey.json'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
    const dptoStr = '0';
    const distStr = '0';
    const zonaStr = '4';
    const localStr = 'COL. EDUARDO  LOPEZ MOREIRA';
    
    console.log(`Querying locales_votacion with: dpto=${dptoStr}, distrito=${distStr}, zona=${zonaStr}, nombre="${localStr}"`);
    
    const localesQuery = db.collection('locales_votacion')
        .where('dpto', '==', dptoStr)
        .where('distrito', '==', distStr)
        .where('zona', '==', zonaStr)
        .where('nombre', '==', localStr)
        .limit(1);

    const locSnap = await localesQuery.get();
    console.log(`Result empty? ${locSnap.empty}`);
    locSnap.forEach(doc => {
        console.log(doc.id, doc.data());
    });
    process.exit(0);
}
run();
