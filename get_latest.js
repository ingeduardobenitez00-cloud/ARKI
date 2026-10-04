const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp();
}

async function run() {
    try {
        const db = admin.firestore();
        const snap = await db.collection('transmisiones_recibidas')
                             .orderBy('recibido_en', 'desc')
                             .limit(5)
                             .get();
        if (snap.empty) {
            console.log('No se encontraron transmisiones_recibidas recientes.');
        } else {
            console.log(`Últimas transmisiones recibidas:`);
            snap.docs.forEach(d => {
                const data = d.data();
                console.log(`ID: ${d.id} | Local: ${data.local}, Mesa: ${data.mesa}, Orden: ${data.orden} | Recibido: ${data.recibido_en}`);
            });
        }
    } catch (e) {
        console.error('Error fetching transmisiones:', e);
    }
}
run();
