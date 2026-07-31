const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// ==========================================
// CONFIGURACIÓN (Puedes modificar esto)
// ==========================================
const CSV_FILE_NAME = 'mi_excel_locales.csv';
const UMBRAL_SIMILITUD = 0.70; // 70% de coincidencia mínima para asignar automáticamente

// Nombres de columnas esperados en el CSV (en minúsculas para comparar mejor)
const COLUMNA_SECCIONAL = 'seccional'; 
const COLUMNA_LOCAL = 'local'; 

// ==========================================

const SERVICE_ACCOUNT_KEY_PATH = path.join(__dirname, 'serviceAccountKey.json');
if (!fs.existsSync(SERVICE_ACCOUNT_KEY_PATH)) {
    console.error(`❌ Error: No se encontró serviceAccountKey.json en ${SERVICE_ACCOUNT_KEY_PATH}`);
    process.exit(1);
}

const serviceAccount = require(SERVICE_ACCOUNT_KEY_PATH);
if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// Función para calcular la distancia de Levenshtein (Fuzzy Matching)
function levenshteinDistance(a, b) {
    const matrix = [];
    let i, j;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    for (i = 0; i <= b.length; i++) { matrix[i] = [i]; }
    for (j = 0; j <= a.length; j++) { matrix[0][j] = j; }
    for (i = 1; i <= b.length; i++) {
        for (j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // sustitución
                    Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1) // inserción o borrado
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

function getSimilarity(s1, s2) {
    let longer = s1;
    let shorter = s2;
    if (s1.length < s2.length) { longer = s2; shorter = s1; }
    const longerLength = longer.length;
    if (longerLength === 0) return 1.0;
    return (longerLength - levenshteinDistance(longer, shorter)) / parseFloat(longerLength);
}

function normalizeString(str) {
    if (!str) return '';
    return str.toString().toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Quitar acentos
        .replace(/[^a-z0-9 ]/g, ' ') // Quitar caracteres especiales
        .replace(/\s+/g, ' ') // Espacios múltiples a simples
        .trim();
}

async function runFuzzyMapping() {
    const csvPath = path.join(__dirname, CSV_FILE_NAME);
    if (!fs.existsSync(csvPath)) {
        console.error(`❌ El archivo ${CSV_FILE_NAME} no existe en la carpeta scripts.`);
        return;
    }

    console.log('📖 Leyendo archivo CSV...');
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.split(/\r?\n/).filter(line => line.trim() !== '');
    
    if (lines.length < 2) {
        console.error('❌ El archivo CSV parece estar vacío o no tener datos.');
        return;
    }

    // Parsear separador (, o ;)
    const headerLine = lines[0];
    const separator = headerLine.includes(';') ? ';' : ',';
    const headers = headerLine.split(separator).map(h => h.trim().toLowerCase());
    
    console.log(`Columnas detectadas: [${headers.join(', ')}]`);

    let idxSeccional = headers.findIndex(h => h.includes(COLUMNA_SECCIONAL) || h === 'sec' || h.includes('seccional_id') || h.includes('seccional'));
    let idxLocal = headers.findIndex(h => h.includes(COLUMNA_LOCAL) || h.includes('nombre') || h.includes('descrip') || h.includes('local'));

    if (idxSeccional === -1 || idxLocal === -1) {
        console.error('❌ No se pudieron detectar automáticamente las columnas de Seccional y Local.');
        console.log(`Índices encontrados -> Seccional: ${idxSeccional}, Local: ${idxLocal}`);
        return;
    }

    console.log(`Usando columna '${headers[idxSeccional]}' para Seccional y '${headers[idxLocal]}' para Local.`);

    const excelMapping = [];
    for (let i = 1; i < lines.length; i++) {
        const columns = lines[i].split(separator);
        if (columns.length > Math.max(idxSeccional, idxLocal)) {
            const sec = columns[idxSeccional].trim();
            const locName = columns[idxLocal].trim();
            if (sec && locName) {
                excelMapping.push({
                    originalName: locName,
                    normalized: normalizeString(locName),
                    seccional: sec
                });
            }
        }
    }

    console.log(`✅ ${excelMapping.length} locales leídos del Excel.`);
    console.log('⏳ Obteniendo locales pendientes de la base de datos...');

    const localesSnap = await db.collection('locales_votacion').where('status', '==', 'pending_seccional').get();
    if (localesSnap.empty) {
        console.log('✅ No hay locales pendientes de asignar en la base de datos.');
        return;
    }

    console.log(`🔍 Analizando similitudes para ${localesSnap.size} locales de la BD...`);

    let matchCount = 0;
    const batch = db.batch();

    // Cache metadata
    const metadataUpdates = {}; 
    const metaSnap = await db.collection('seccionales_metadata').get();
    metaSnap.forEach(doc => {
        metadataUpdates[doc.id] = doc.data();
    });

    localesSnap.forEach(docSnap => {
        const dbData = docSnap.data();
        const dbNameNorm = normalizeString(dbData.nombre);

        let bestMatch = null;
        let highestScore = 0;

        for (const excelItem of excelMapping) {
            const score = getSimilarity(dbNameNorm, excelItem.normalized);
            if (score > highestScore) {
                highestScore = score;
                bestMatch = excelItem;
            }
        }

        if (bestMatch && highestScore >= UMBRAL_SIMILITUD) {
            console.log(`[MATCHEADO ${(highestScore*100).toFixed(1)}%] BD: "${dbData.nombre}" === EXCEL: "${bestMatch.originalName}" -> Seccional ${bestMatch.seccional}`);
            
            // 1. Update locales_votacion
            batch.update(docSnap.ref, {
                seccional_id: bestMatch.seccional,
                status: 'asignado',
                fuzzy_score: highestScore,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // 2. Prepare seccionales_metadata update
            const secId = String(bestMatch.seccional);
            if (!metadataUpdates[secId]) {
                metadataUpdates[secId] = { locales: [], mesas_por_local: [] };
            }
            if (!metadataUpdates[secId].locales) metadataUpdates[secId].locales = [];
            if (!metadataUpdates[secId].mesas_por_local) metadataUpdates[secId].mesas_por_local = [];

            if (!metadataUpdates[secId].locales.includes(dbData.nombre)) {
                metadataUpdates[secId].locales.push(dbData.nombre);
                metadataUpdates[secId].mesas_por_local.push({ localName: dbData.nombre, mesas: [] });
            }

            matchCount++;
        } else {
            console.log(`[SIN COINCIDENCIA] BD: "${dbData.nombre}" (Mejor opción fue "${bestMatch?.originalName}" con ${(highestScore*100).toFixed(1)}%)`);
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
        console.log(`🎉 ¡Se asignaron exitosamente ${matchCount} locales!`);
    } else {
        console.log('\n❌ No se encontró coincidencia sobre el umbral.');
    }
}

runFuzzyMapping();
