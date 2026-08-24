const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const { Dbf } = require('dbf-reader');

const SERVICE_ACCOUNT_KEY_PATH = path.join(__dirname, 'serviceAccountKey.json');
const serviceAccount = require(SERVICE_ACCOUNT_KEY_PATH);

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function migratePadron() {
    const dbfPath = path.join(__dirname, 'padron_capital.dbf');
    if (!fs.existsSync(dbfPath)) {
        console.error('❌ Error: padron_capital.dbf no encontrado.');
        return;
    }

    console.log('📖 Leyendo padron_capital.dbf...');
    const buffer = fs.readFileSync(dbfPath);
    const datatable = Dbf.read(buffer);
    const totalRecords = datatable.rows.length;
    
    console.log(`✅ DBF cargado. ${totalRecords} registros encontrados. Iniciando migración masiva...`);

    let batch = db.batch();
    let count = 0;
    let totalUpdated = 0;

    for (let i = 0; i < totalRecords; i++) {
        const r = datatable.rows[i];
        
        const cedula = r['N_CEDULA'] !== undefined ? String(r['N_CEDULA']).trim() : null;
        if (!cedula) continue; // Saltar si no hay cédula

        const seccional = r['SECCIONAL'] !== undefined ? String(r['SECCIONAL']).trim() : '';

        // Formatear fechas si vienen como objetos Date o strings
        const formatDBFDate = (val) => {
            if (val instanceof Date) return admin.firestore.Timestamp.fromDate(val);
            if (typeof val === 'string' && val.trim() !== '') {
                const d = new Date(val);
                if (!isNaN(d.getTime())) return admin.firestore.Timestamp.fromDate(d);
            }
            return null;
        };

        const updateData = {
            CEDULA: cedula,
            CODIGO_SEC: seccional,
            SECCIONAL: seccional, // Guardamos en ambos por precaución
            FEC_AFIL: formatDBFDate(r['FEC_AFIL']),
            N_PARTIDO: r['N_PARTIDO'] !== undefined ? String(r['N_PARTIDO']).trim() : '',
            VOTO1: r['VOTO1'] !== undefined ? String(r['VOTO1']).trim() : '',
            VOTO2: r['VOTO2'] !== undefined ? String(r['VOTO2']).trim() : '',
            VOTO3: r['VOTO3'] !== undefined ? String(r['VOTO3']).trim() : '',
            VOTO4: r['VOTO4'] !== undefined ? String(r['VOTO4']).trim() : '',
            VOTO5: r['VOTO5'] !== undefined ? String(r['VOTO5']).trim() : '',
            SEXO: r['SEXO'] !== undefined ? String(r['SEXO']).trim() : '',
            C_FENACI: formatDBFDate(r['C_FENACI']),
            FEC_INSCRI: formatDBFDate(r['FEC_INSCRI']),
            DIRECCION: r['DIRECCION'] !== undefined ? String(r['DIRECCION']).trim() : ''
        };

        // Eliminamos campos nulos para no llenar la BD de basura
        Object.keys(updateData).forEach(key => {
            if (updateData[key] === null) {
                delete updateData[key];
            }
        });

        const docRef = db.collection('sheet1').doc(cedula);
        
        // ¡IMPORTANTE! usamos merge: true para no borrar teléfonos ni ubicaciones
        batch.set(docRef, updateData, { merge: true });
        count++;
        totalUpdated++;

        if (count >= 500) {
            await batch.commit();
            console.log(`  └─ Lote procesado. Progreso: ${totalUpdated} / ${totalRecords}`);
            batch = db.batch();
            count = 0;
        }
    }

    if (count > 0) {
        await batch.commit();
        console.log(`  └─ Lote final procesado. Progreso: ${totalUpdated} / ${totalRecords}`);
    }

    console.log(`\n🎉 ¡MIGRACIÓN COMPLETADA! Se actualizaron ${totalUpdated} registros sin borrar datos antiguos.`);
    process.exit(0);
}

try {
    migratePadron();
} catch(e) {
    console.error("Error crítico:", e);
}
