const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp();
}

async function run() {
    try {
        const db = admin.firestore();
        const snap = await db.collection('transmisiones')
                             .orderBy('timestamp', 'desc')
                             .limit(1)
                             .get();
        if (snap.empty) {
            console.log('No se encontraron transmisiones recientes en la colección "transmisiones".');
        } else {
            console.log('Última transmisión recibida:');
            snap.docs.forEach(d => {
                console.log(d.id, JSON.stringify(d.data(), null, 2));
            });
        }
    } catch (e) {
        console.error('Error fetching transmisiones:', e);
    }
}
run();
