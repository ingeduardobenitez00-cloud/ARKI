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

async function runLocalDBFMappingV2() {
    const dbfPath = path.join(__dirname, 'padron_capital.dbf');
    if (!fs.existsSync(dbfPath)) {
        console.error(`❌ Error: No se encontró padron_capital.dbf`);
        return;
    }

    console.log('📖 Leyendo padron_capital.dbf de nuevo...');
    const buffer = fs.readFileSync(dbfPath);
    const datatable = Dbf.read(buffer);

    const uniqueLocales = {}; // Exact match
    const localesByLocal = {}; // Fallback match (ignorando Zona)

    for (let i = 0; i < datatable.rows.length; i++) {
        const r = datatable.rows[i];
        
        const dpto = r['DEPART'] !== undefined ? String(r['DEPART']).trim() : String(r['DPTO'] || '').trim();
        const dist = r['DISTRITO'] !== undefined ? String(r['DISTRITO']).trim() : '';
        const zona = r['ZONA'] !== undefined ? String(r['ZONA']).trim() : '';
        const local = r['LOCAL'] !== undefined ? String(r['LOCAL']).trim() : '';
        const descrip = r['DESC_LOCAL'] !== undefined ? String(r['DESC_LOCAL']).trim() : '';
        const seccional = r['CODIGO_SEC'] || r['SECCIONAL'] || null;

        if (dpto && dist && local && descrip) {
            const exactKey = `${dpto}_${dist}_${zona}_${local}`;
            const fallbackKey = `${dpto}_${dist}_${local}`; // Sin Zona

            if (!uniqueLocales[exactKey]) {
                uniqueLocales[exactKey] = { descrip, seccional: seccional ? String(seccional).trim() : null };
            }
            if (!localesByLocal[fallbackKey]) {
                localesByLocal[fallbackKey] = { descrip, seccional: seccional ? String(seccional).trim() : null };
            }
        }
    }

    console.log(`✅ Preparado. Buscando y corrigiendo "SIN DESCRIPCION" en Firebase...`);

    const localesSnap = await db.collection('locales_votacion').where('nombre', '==', 'SIN DESCRIPCION').get();
    let matchCount = 0;
    const batch = db.batch();

    localesSnap.forEach(docSnap => {
        const dbData = docSnap.data();
        
        // El problema principal es el local 999
        if (String(dbData.local) === '999') {
            // 999 es "Electores en el Extranjero" o "Voto en casa", le ponemos un nombre por defecto
            console.log(`[CORREGIDO 999] ${docSnap.id} -> "OTROS / VOTO FUERA DE PADRON"`);
            batch.update(docSnap.ref, {
                nombre: 'OTROS / VOTO FUERA DE PADRON',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            matchCount++;
            return;
        }

        const exactKey = `${dbData.dpto}_${dbData.distrito}_${dbData.zona}_${dbData.local}`;
        const fallbackKey = `${dbData.dpto}_${dbData.distrito}_${dbData.local}`;

        // 1. Buscamos por coincidencia exacta (con Zona)
        let matched = uniqueLocales[exactKey];

        // 2. Si no lo encuentra, ignoramos la Zona (porque a veces Firebase tiene Zona=0 y el DBF tiene Zona=1)
        if (!matched && localesByLocal[fallbackKey]) {
            matched = localesByLocal[fallbackKey];
        }

        if (matched) {
            console.log(`[ACTUALIZADO] ${docSnap.id} -> "${matched.descrip}"`);
            batch.update(docSnap.ref, {
                nombre: matched.descrip,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            matchCount++;
        }
    });

    if (matchCount > 0) {
        await batch.commit();
        console.log(`🎉 ¡ÉXITO! Se corrigieron ${matchCount} locales que decían "SIN DESCRIPCION".`);
    } else {
        console.log('\n✅ No se pudo encontrar coincidencias o ya no hay locales con SIN DESCRIPCION.');
    }
}

try {
    runLocalDBFMappingV2();
} catch(e) {
    console.error("Error crítico:", e);
}
