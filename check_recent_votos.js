const admin = require('firebase-admin');
const fs = require('fs');
const serviceAccount = JSON.parse(fs.readFileSync('scripts/serviceAccountKey.json'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
    try {
        console.log("Buscando los últimos votos confirmados...");
        const snapshot = await db.collection('votos_confirmados')
            .orderBy('updatedAt', 'desc')
            .limit(10)
            .get();
        
        if (snapshot.empty) {
            console.log("No se encontraron votos recientes.");
        } else {
            console.log(`Se encontraron ${snapshot.size} registros recientes:`);
            snapshot.forEach(doc => {
                const data = doc.data();
                console.log(`- Cédula: ${data.CEDULA}, Nombre: ${data.NOMBRE} ${data.APELLIDO}, Fecha: ${data.updatedAt}, Registrador: ${data.registradoPor_nombre}, Local: ${data.DESC_LOCAL}`);
            });
        }
    } catch (e) {
        console.log("Error al buscar ordenados por updatedAt (puede faltar índice):", e.message);
    }
    process.exit(0);
}
run();
