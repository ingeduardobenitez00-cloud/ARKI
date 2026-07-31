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

async function runLocalDBFMapping() {
    const dbfPath = path.join(__dirname, 'padron_capital.dbf');
    if (!fs.existsSync(dbfPath)) {
        console.error(`❌ Error: No se encontró padron_capital.dbf`);
        return;
    }

    console.log('📖 Leyendo padron_capital.dbf (Esto tomará unos 5 a 10 segundos)...');
    
    // Leer el DBF en memoria (500MB toma unos segundos en V8)
    const buffer = fs.readFileSync(dbfPath);
    const datatable = Dbf.read(buffer);

    console.log(`✅ Archivo leído. Analizando ${datatable.rows.length} electores para extraer los locales únicos...`);

    const uniqueLocales = {}; // clave: DPTO_DIST_ZONA_LOCAL

    for (let i = 0; i < datatable.rows.length; i++) {
        const r = datatable.rows[i];
        
        // Nombres de columnas según tu captura
        const dpto = r['DEPART'] !== undefined ? String(r['DEPART']).trim() : String(r['DPTO'] || '').trim();
        const dist = r['DISTRITO'] !== undefined ? String(r['DISTRITO']).trim() : '';
        const zona = r['ZONA'] !== undefined ? String(r['ZONA']).trim() : '';
        const local = r['LOCAL'] !== undefined ? String(r['LOCAL']).trim() : '';
        const descrip = r['DESC_LOCAL'] !== undefined ? String(r['DESC_LOCAL']).trim() : '';
        
        // Algunos padrones tienen CODIGO_SEC en el DBF, si no, intentamos sacarlo
        const seccional = r['CODIGO_SEC'] || r['SECCIONAL'] || null;

        if (dpto && dist && zona && local && descrip) {
            const key = `${dpto}_${dist}_${zona}_${local}`;
            if (!uniqueLocales[key]) {
                uniqueLocales[key] = { descrip, seccional: seccional ? String(seccional).trim() : null };
            }
        }
    }

    const uniqueCount = Object.keys(uniqueLocales).length;
    console.log(`✅ Se extrajeron ${uniqueCount} locales únicos del padrón de Capital.`);
    console.log(`⏳ Actualizando la base de datos de Firebase...`);

    const localesSnap = await db.collection('locales_votacion').get();
    let matchCount = 0;
    const batch = db.batch();
    const metadataUpdates = {}; 

    const metaSnap = await db.collection('seccionales_metadata').get();
    metaSnap.forEach(doc => {
        metadataUpdates[doc.id] = doc.data();
    });

    localesSnap.forEach(docSnap => {
        const dbData = docSnap.data();
        const key = `${dbData.dpto}_${dbData.distrito}_${dbData.zona}_${dbData.local}`;

        if (uniqueLocales[key]) {
            const realDesc = uniqueLocales[key].descrip;
            const realSec = uniqueLocales[key].seccional;
            
            const updates = {};
            let isUpdated = false;

            if (dbData.nombre !== realDesc && realDesc !== "SIN DESCRIPCION") {
                updates.nombre = realDesc;
                isUpdated = true;
            }

            if (dbData.status === 'pending_seccional' && realSec && realSec !== 'null') {
                updates.seccional_id = realSec;
                updates.status = 'asignado';
                isUpdated = true;

                if (!metadataUpdates[realSec]) metadataUpdates[realSec] = { locales: [], mesas_por_local: [] };
                if (!metadataUpdates[realSec].locales) metadataUpdates[realSec].locales = [];
                if (!metadataUpdates[realSec].mesas_por_local) metadataUpdates[realSec].mesas_por_local = [];

                if (!metadataUpdates[realSec].locales.includes(realDesc)) {
                    metadataUpdates[realSec].locales.push(realDesc);
                    metadataUpdates[realSec].mesas_por_local.push({ localName: realDesc, mesas: [] });
                }
            }

            if (isUpdated) {
                console.log(`[ACTUALIZADO] ${key} -> "${realDesc}" | Sec: ${realSec || 'N/A'}`);
                updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
                batch.update(docSnap.ref, updates);
                matchCount++;
            }
        }
    });

    if (matchCount > 0) {
        console.log(`\n💾 Guardando actualizaciones en Firebase...`);
        for (const secId of Object.keys(metadataUpdates)) {
            const metaRef = db.collection('seccionales_metadata').doc(secId);
            batch.set(metaRef, {
                locales: metadataUpdates[secId].locales,
                mesas_por_local: metadataUpdates[secId].mesas_por_local,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }
        await batch.commit();
        console.log(`🎉 ¡ÉXITO! Se corrigieron ${matchCount} locales al instante.`);
    } else {
        console.log('\n✅ Todos los locales coinciden, no hubo necesidad de hacer cambios.');
    }
}

// Para evitar problemas de memoria con archivos grandes
try {
    runLocalDBFMapping();
} catch(e) {
    console.error("Error crítico:", e);
}
