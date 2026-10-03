const admin = require('firebase-admin');
const serviceAccount = require('./scripts/serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function checkTransmisiones() {
    try {
        console.log("Consultando la colección 'transmisiones_recibidas'...");
        
        // Obtener los últimos 100 registros para analizar qué tipos de 'estado' estamos recibiendo
        const snapshot = await db.collection('transmisiones_recibidas')
            .orderBy('recibido_en', 'desc')
            .limit(100)
            .get();

        if (snapshot.empty) {
            console.log("No hay ninguna transmisión recibida todavía.");
            process.exit(0);
        }

        const stats = {
            total: snapshot.size,
            estados: {}
        };

        snapshot.forEach(doc => {
            const data = doc.data();
            const estado = data.estado || 'sin_estado';
            if (!stats.estados[estado]) {
                stats.estados[estado] = 0;
            }
            stats.estados[estado]++;
        });

        console.log("\n--- RESULTADOS DE LOS ÚLTIMOS 100 REGISTROS ---");
        console.log(`Total analizados: ${stats.total}`);
        console.log("Estados recibidos:");
        for (const [estado, count] of Object.entries(stats.estados)) {
            let significado = "Desconocido";
            if (estado === 'v') significado = "Voto Emitido";
            if (estado === 'n' || estado === 'f' || estado === 'b') significado = "No Voto / Ausente / Blanco";
            console.log(`  - '${estado}' (${significado}): ${count} registros`);
        }
        
    } catch (error) {
        console.error("Error al consultar:", error);
    } finally {
        process.exit(0);
    }
}

checkTransmisiones();
