const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const CSV_FILE_NAME = 'loc_capital.csv';

const SERVICE_ACCOUNT_KEY_PATH = path.join(__dirname, 'serviceAccountKey.json');
if (!fs.existsSync(SERVICE_ACCOUNT_KEY_PATH)) {
    console.error(`❌ Error: No se encontró serviceAccountKey.json`);
    process.exit(1);
}

const serviceAccount = require(SERVICE_ACCOUNT_KEY_PATH);
if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function runPadronSeccionalMapping() {
    console.log('⏳ Buscando locales en la base de datos de Capital (DPTO 0) pendientes de seccional...');

    const localesSnap = await db.collection('locales_votacion')
        .where('dpto', '==', '0')
        .where('status', '==', 'pending_seccional')
        .get();
    
    if (localesSnap.empty) {
        console.log('✅ No hay locales de Capital pendientes de asignar en la base de datos.');
        return;
    }

    let matchCount = 0;
    const batch = db.batch();
    const metadataUpdates = {}; 

    // Cache metadata
    const metaSnap = await db.collection('seccionales_metadata').get();
    metaSnap.forEach(doc => {
        metadataUpdates[doc.id] = doc.data();
    });

    console.log(`🔍 Procesando ${localesSnap.size} locales de Capital y buscando su seccional en el padrón (sheet1)...`);

    for (const docSnap of localesSnap.docs) {
        const dbData = docSnap.data();
        const dpto = String(dbData.dpto);
        const dist = String(dbData.distrito);
        const zona = String(dbData.zona);
        const local = String(dbData.local);

        let padronSnap = await db.collection('sheet1')
            .where('COD_DPTO', '==', dpto)
            .where('COD_DIST', '==', dist)
            .where('ZONA', '==', zona)
            .where('LOCAL', '==', local)
            .limit(1).get();

        if (padronSnap.empty) {
            padronSnap = await db.collection('sheet1')
                .where('DEPART', '==', parseInt(dpto, 10))
                .where('DISTRITO', '==', parseInt(dist, 10))
                .where('ZONA', '==', parseInt(zona, 10))
                .where('LOCAL', '==', parseInt(local, 10))
                .limit(1).get();
        }

        if (!padronSnap.empty) {
            const elector = padronSnap.docs[0].data();
            const secId = String(elector['CODIGO_SEC'] || elector['SECCIONAL']);

            if (secId && secId !== 'undefined' && secId !== 'null') {
                const updates = {};
                updates.seccional_id = secId;
                updates.status = 'asignado';
                updates.mapping_method = 'from_padron_sheet1';
                updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

                console.log(`[ASIGNADO] ${dpto}-${dist}-${zona}-${local} "${dbData.nombre}" -> Sec: ${secId}`);
                
                batch.update(docSnap.ref, updates);
                
                // Update metadata
                if (!metadataUpdates[secId]) metadataUpdates[secId] = { locales: [], mesas_por_local: [] };
                if (!metadataUpdates[secId].locales) metadataUpdates[secId].locales = [];
                if (!metadataUpdates[secId].mesas_por_local) metadataUpdates[secId].mesas_por_local = [];

                if (!metadataUpdates[secId].locales.includes(dbData.nombre)) {
                    metadataUpdates[secId].locales.push(dbData.nombre);
                    metadataUpdates[secId].mesas_por_local.push({ localName: dbData.nombre, mesas: [] });
                }

                matchCount++;
            }
        }
    }

    if (matchCount > 0) {
        console.log(`\n💾 Guardando ${matchCount} asignaciones en Firebase...`);
        for (const secId of Object.keys(metadataUpdates)) {
            const metaRef = db.collection('seccionales_metadata').doc(secId);
            batch.set(metaRef, {
                locales: metadataUpdates[secId].locales,
                mesas_por_local: metadataUpdates[secId].mesas_por_local,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }
        await batch.commit();
        console.log(`🎉 ¡Se asignaron exitosamente ${matchCount} locales usando las seccionales del Padrón (sheet1)!`);
    } else {
        console.log('\n❌ No se encontraron locales que necesiten asignación de seccional desde el padrón, o no se encontró el dato.');
    }
}

runPadronSeccionalMapping();
