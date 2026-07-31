const fs = require('fs');
const path = require('path');
const { Dbf } = require('dbf-reader');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT_KEY_PATH = path.join(__dirname, 'serviceAccountKey.json');
const serviceAccount = require(SERVICE_ACCOUNT_KEY_PATH);

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function reimportCapitalLocales() {
    const dbfPath = path.join(__dirname, 'padron_capital.dbf');
    if (!fs.existsSync(dbfPath)) {
        console.error(`❌ Error: No se encontró padron_capital.dbf`);
        return;
    }

    console.log(`\n🗑️  PASO 1: Eliminando los locales viejos y erróneos de Capital (DPTO 0) en Firebase...`);
    
    // Buscar todos los locales de DPTO 0 en Firebase
    const oldLocales = await db.collection('locales_votacion').where('dpto', '==', '0').get();
    
    let deleteBatch = db.batch();
    let deleteCount = 0;
    
    oldLocales.forEach(doc => {
        deleteBatch.delete(doc.ref);
        deleteCount++;
    });
    
    if (deleteCount > 0) {
        await deleteBatch.commit();
        console.log(`✅ Se borraron ${deleteCount} locales viejos de Capital (que tenían la zona errónea 0).`);
    } else {
        console.log(`✅ No había locales de Capital viejos para borrar.`);
    }

    console.log('\n📖 PASO 2: Leyendo padron_capital.dbf (Esto tomará unos 5 a 10 segundos)...');
    const buffer = fs.readFileSync(dbfPath);
    const datatable = Dbf.read(buffer);

    const uniqueLocales = {};

    for (let i = 0; i < datatable.rows.length; i++) {
        const r = datatable.rows[i];
        
        const dpto = r['DEPART'] !== undefined ? String(r['DEPART']).trim() : String(r['DPTO'] || '').trim();
        const dist = r['DISTRITO'] !== undefined ? String(r['DISTRITO']).trim() : '';
        const zona = r['ZONA'] !== undefined ? String(r['ZONA']).trim() : '';
        const local = r['LOCAL'] !== undefined ? String(r['LOCAL']).trim() : '';
        const descrip = r['DESC_LOCAL'] !== undefined ? String(r['DESC_LOCAL']).trim() : '';

        // Solo importamos Capital (DPTO 0) y evitamos el local 999 (Fuera de Padrón)
        if (dpto === '0' && local !== '999' && dist && zona && local && descrip) {
            const docId = `${dpto}_${dist}_${zona}_${local}`;
            if (!uniqueLocales[docId]) {
                uniqueLocales[docId] = { dpto, dist, zona, local, descrip };
            }
        }
    }

    const uniqueCount = Object.keys(uniqueLocales).length;
    console.log(`✅ Se extrajeron ${uniqueCount} locales puros y perfectos de Capital.`);
    console.log(`\n⏳ PASO 3: Insertando los nuevos locales de Capital en Firebase...`);

    let insertBatch = db.batch();
    let insertCount = 0;

    for (const [docId, data] of Object.entries(uniqueLocales)) {
        const docRef = db.collection('locales_votacion').doc(docId);
        
        insertBatch.set(docRef, {
            nombre: data.descrip,
            dpto: data.dpto,
            distrito: data.dist,
            zona: data.zona,
            local: data.local,
            codigo_local: data.local,
            seccional_id: null,
            status: 'pending_seccional',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        insertCount++;
    }

    if (insertCount > 0) {
        await insertBatch.commit();
        console.log(`🎉 ¡ÉXITO TOTAL! Se crearon ${insertCount} locales de Capital impecables.`);
        console.log(`   Ve a tu panel de configuración en el sistema y verás que ya no hay ningún "SIN DESCRIPCION".`);
    }
}

try {
    reimportCapitalLocales();
} catch(e) {
    console.error("Error crítico:", e);
}
