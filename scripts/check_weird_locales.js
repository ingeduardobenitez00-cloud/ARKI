const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const SERVICE_ACCOUNT_KEY_PATH = path.join(__dirname, 'serviceAccountKey.json');
if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(require(SERVICE_ACCOUNT_KEY_PATH)) });
}
const db = admin.firestore();

async function checkWeirdLocales() {
    const snap = await db.collection('locales_votacion').limit(500).get();
    let count = 0;
    
    console.log("Locales extraños encontrados:");
    snap.forEach(doc => {
        const d = doc.data();
        if (d.nombre === '11' || d.zona === '0' || d.zona === 0 || !d.zona || !d.distrito) {
            console.log(`ID: ${doc.id} | Nombre: ${d.nombre} | Dpto: ${d.dpto} | Dist: ${d.distrito} | Zona: ${d.zona} | Local: ${d.local}`);
            count++;
        }
    });
    console.log(`\nTotal extraños encontrados: ${count}`);
}

checkWeirdLocales();
