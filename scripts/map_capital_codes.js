const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// ==========================================
// CONFIGURACIÓN
// ==========================================
const CSV_FILE_NAME = 'loc_capital.csv';

// Palabras clave para autodetectar columnas
const COL_DISTRITO = 'distrito';
const COL_ZONA = 'zona';
const COL_LOCAL = 'local';
const COL_SECCIONAL = 'seccional';

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

async function runExactMapping() {
    const csvPath = path.join(__dirname, CSV_FILE_NAME);
    if (!fs.existsSync(csvPath)) {
        console.error(`❌ El archivo ${CSV_FILE_NAME} no existe.`);
        return;
    }

    console.log(`📖 Leyendo archivo ${CSV_FILE_NAME}...`);
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.split(/\r?\n/).filter(line => line.trim() !== '');
    
    if (lines.length < 2) {
        console.error('❌ El archivo CSV parece estar vacío.');
        return;
    }

    // Detectar separador
    const headerLine = lines[0];
    const separator = headerLine.includes(';') ? ';' : (headerLine.includes(',') ? ',' : '\t');
    const headers = headerLine.split(separator).map(h => h.trim().toLowerCase());
    
    console.log(`Columnas detectadas: [${headers.join(', ')}]`);

    let idxDistrito = headers.findIndex(h => h.includes(COL_DISTRITO) || h === 'dist');
    let idxZona = headers.findIndex(h => h.includes(COL_ZONA));
    let idxLocal = headers.findIndex(h => h.includes(COL_LOCAL) || h === 'cod_local');
    let idxSeccional = headers.findIndex(h => h.includes(COL_SECCIONAL) || h === 'sec');

    if (idxDistrito === -1 || idxZona === -1 || idxLocal === -1 || idxSeccional === -1) {
        console.error('❌ No se detectaron todas las columnas necesarias (Distrito, Zona, Local, Seccional).');
        console.log(`Índices -> Distrito: ${idxDistrito}, Zona: ${idxZona}, Local: ${idxLocal}, Seccional: ${idxSeccional}`);
        return;
    }

    console.log(`Usando columnas -> Distrito: ${headers[idxDistrito]}, Zona: ${headers[idxZona]}, Local: ${headers[idxLocal]}, Seccional: ${headers[idxSeccional]}`);

    // Crear un diccionario de códigos exactos: clave "DISTRITO_ZONA_LOCAL" = SECCIONAL
    const excelMapping = {};
    for (let i = 1; i < lines.length; i++) {
        const columns = lines[i].split(separator);
        if (columns.length > Math.max(idxDistrito, idxZona, idxLocal, idxSeccional)) {
            const dist = parseInt(columns[idxDistrito].trim(), 10);
            const zona = parseInt(columns[idxZona].trim(), 10);
            const loc = parseInt(columns[idxLocal].trim(), 10);
            const sec = columns[idxSeccional].trim();
            
            if (!isNaN(dist) && !isNaN(zona) && !isNaN(loc) && sec) {
                const key = `${dist}_${zona}_${loc}`;
                excelMapping[key] = sec;
            }
        }
    }

    console.log(`✅ ${Object.keys(excelMapping).length} códigos leídos del CSV.`);
    console.log('⏳ Buscando locales pendientes en la base de datos (solo Capital)...');

    // Buscamos locales pendientes
    const localesSnap = await db.collection('locales_votacion').where('status', '==', 'pending_seccional').get();
    if (localesSnap.empty) {
        console.log('✅ No hay locales pendientes de asignar en la base de datos.');
        return;
    }

    let matchCount = 0;
    const batch = db.batch();

    const metadataUpdates = {}; 
    const metaSnap = await db.collection('seccionales_metadata').get();
    metaSnap.forEach(doc => {
        metadataUpdates[doc.id] = doc.data();
    });

    localesSnap.forEach(docSnap => {
        const dbData = docSnap.data();
        
        // Capital es normalmente DPTO 0
        if (String(dbData.dpto) === '0') {
            const dist = parseInt(dbData.distrito, 10);
            const zona = parseInt(dbData.zona, 10);
            const loc = parseInt(dbData.local, 10);
            
            const key = `${dist}_${zona}_${loc}`;
            
            if (excelMapping[key]) {
                const bestSec = excelMapping[key];
                console.log(`[ASIGNADO] Local "${dbData.nombre}" (Código: ${key}) -> Seccional ${bestSec}`);
                
                batch.update(docSnap.ref, {
                    seccional_id: bestSec,
                    status: 'asignado',
                    mapping_method: 'exact_code',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });

                const secId = String(bestSec);
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
    });

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
        console.log(`🎉 ¡Se asignaron exitosamente ${matchCount} locales usando CÓDIGOS EXACTOS!`);
    } else {
        console.log('\n❌ No se encontraron locales que coincidan con los códigos numéricos provistos.');
    }
}

runExactMapping();
