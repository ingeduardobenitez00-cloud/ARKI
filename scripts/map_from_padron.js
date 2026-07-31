const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

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

async function runPadronMapping() {
    console.log('⏳ Buscando locales en la base de datos que necesitan actualización...');

    // Obtenemos TODOS los locales para asegurarnos de actualizar descripciones y seccionales
    const localesSnap = await db.collection('locales_votacion').get();
    
    if (localesSnap.empty) {
        console.log('✅ No hay locales en la base de datos.');
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

    console.log(`🔍 Procesando ${localesSnap.size} locales y buscando su descripción real en el padrón (sheet1)...`);

    for (const docSnap of localesSnap.docs) {
        const dbData = docSnap.data();
        const dpto = String(dbData.dpto);
        const dist = String(dbData.distrito);
        const zona = String(dbData.zona);
        const local = String(dbData.local);

        // Vamos a buscar 1 elector en sheet1 que pertenezca a este local exacto
        // Probamos con los nombres de campos más comunes
        let padronSnap = await db.collection('sheet1')
            .where('COD_DPTO', '==', dpto)
            .where('COD_DIST', '==', dist)
            .where('ZONA', '==', zona)
            .where('LOCAL', '==', local)
            .limit(1).get();

        // Si no encontró con ZONA y LOCAL, intentamos con COD_ZONA y COD_LOCAL
        if (padronSnap.empty) {
            padronSnap = await db.collection('sheet1')
                .where('COD_DPTO', '==', dpto)
                .where('COD_DIST', '==', dist)
                .where('COD_ZONA', '==', zona)
                .where('COD_LOCAL', '==', local)
                .limit(1).get();
        }

        // Si tampoco encontró, probamos con valores numéricos en lugar de texto
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
            const descLocalReal = elector['DESC_LOCAL'] || elector['LOCAL_DESC'] || elector['NOMBRE_LOCAL'];
            const secId = String(elector['CODIGO_SEC'] || elector['SECCIONAL']);

            if (descLocalReal) {
                const updates = {};
                let isUpdated = false;

                // 1. Si la descripción es diferente o decía SIN DESCRIPCION
                if (dbData.nombre !== descLocalReal) {
                    updates.nombre = descLocalReal;
                    isUpdated = true;
                }

                // 2. Si no tenía seccional asignada, se la asignamos
                if (dbData.status === 'pending_seccional' && secId && secId !== 'undefined') {
                    updates.seccional_id = secId;
                    updates.status = 'asignado';
                    isUpdated = true;

                    // Update metadata
                    if (!metadataUpdates[secId]) metadataUpdates[secId] = { locales: [], mesas_por_local: [] };
                    if (!metadataUpdates[secId].locales) metadataUpdates[secId].locales = [];
                    if (!metadataUpdates[secId].mesas_por_local) metadataUpdates[secId].mesas_por_local = [];

                    if (!metadataUpdates[secId].locales.includes(descLocalReal)) {
                        metadataUpdates[secId].locales.push(descLocalReal);
                        metadataUpdates[secId].mesas_por_local.push({ localName: descLocalReal, mesas: [] });
                    }
                }

                if (isUpdated) {
                    console.log(`[ACTUALIZADO] ${dpto}-${dist}-${zona}-${local} -> Nombre: "${descLocalReal}" | Sec: ${secId}`);
                    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
                    batch.update(docSnap.ref, updates);
                    matchCount++;
                }
            }
        }
    }

    if (matchCount > 0) {
        console.log(`\n💾 Guardando ${matchCount} actualizaciones en Firebase...`);
        for (const secId of Object.keys(metadataUpdates)) {
            const metaRef = db.collection('seccionales_metadata').doc(secId);
            batch.set(metaRef, {
                locales: metadataUpdates[secId].locales,
                mesas_por_local: metadataUpdates[secId].mesas_por_local,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }
        await batch.commit();
        console.log(`🎉 ¡Se actualizaron exitosamente ${matchCount} locales usando los datos del Padrón (sheet1)!`);
    } else {
        console.log('\n✅ Todo está actualizado. No se encontraron locales que necesiten corrección desde el padrón.');
    }
}

runPadronMapping();
