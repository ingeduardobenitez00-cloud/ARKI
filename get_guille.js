const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({ projectId: 'arki-23779628-5035d' });
}

async function run() {
    const db = admin.firestore();
    const snap = await db.collection('users').get();
    snap.docs.forEach(d => {
        const data = d.data();
        if (data.name?.toLowerCase().includes('guille') || data.nombre?.toLowerCase().includes('guille')) {
            console.log(d.id, data);
        }
    });
}
run();
