const admin = require('firebase-admin');
const { Dbf } = require('dbf-reader');
const fs = require('fs');

const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
    console.log("Leyendo DBF...");
    const buffer = fs.readFileSync('scripts/padron_capital.dbf');
    const datatable = Dbf.read(buffer);
    
    console.log(`Total registros en DBF: ${datatable.rows.length}`);
    
    const localStats = new Map();
    // localId -> { electores: 0, mesasSet: Set }

    datatable.rows.forEach(row => {
        const id = `${row.DEPART || 0}_${row.DISTRITO || 0}_${row.ZONA}_${row.LOCAL}`;
        const mesa = String(row.MESA).trim();
        
        if (!localStats.has(id)) {
            localStats.set(id, { electores: 0, mesasSet: new Set() });
        }
        
        const stats = localStats.get(id);
        stats.electores++;
        if (mesa) stats.mesasSet.add(mesa);
    });

    console.log(`Calculadas estadísticas para ${localStats.size} locales.`);
    
    console.log("Actualizando Firebase...");
    let batch = db.batch();
    let count = 0;
    
    for (const [id, stats] of localStats.entries()) {
        const docRef = db.collection('locales_votacion').doc(id);
        batch.set(docRef, {
            total_electores: stats.electores,
            total_mesas: stats.mesasSet.size
        }, { merge: true });
        
        count++;
        if (count % 200 === 0) {
            await batch.commit();
            batch = db.batch();
            console.log(`Guardados ${count} locales...`);
        }
    }
    
    if (count % 200 !== 0) {
        await batch.commit();
    }
    
    console.log(`¡Listo! Se actualizaron las estadísticas de ${count} locales en Firestore.`);
}

run().catch(console.error);
