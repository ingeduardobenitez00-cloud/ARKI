const admin = require('firebase-admin');
const { Dbf } = require('dbf-reader');
const path = require('path');
const fs = require('fs');

const DATA_FILE_NAME = 'padron_capital.dbf';
const COLLECTION_NAME = 'sheet1';
const SERVICE_ACCOUNT_KEY_PATH = path.join(__dirname, 'serviceAccountKey.json');

const serviceAccount = require(SERVICE_ACCOUNT_KEY_PATH);
if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function run() {
    const dataFilePath = path.join(__dirname, DATA_FILE_NAME);
    if (!fs.existsSync(dataFilePath)) {
        console.error('No se encontro el archivo DBF.');
        process.exit(1);
    }
    const buffer = fs.readFileSync(dataFilePath);
    const datatable = Dbf.read(buffer);

    console.log(`Leidos ${datatable.rows.length} registros del DBF.`);
    
    // Crear un Map en memoria de los datos que nos interesan
    const dbfMap = new Map();
    for(let r of datatable.rows) {
        let cedulaKey = Object.keys(r).find(k => k.toUpperCase().includes('CEDULA') || k.toUpperCase() === 'CI');
        if(!cedulaKey || !r[cedulaKey]) continue;
        const cedula = String(r[cedulaKey]).trim();
        
        let nombreKey = Object.keys(r).find(k => k.toUpperCase() === 'NOMBRE');
        let apellidoKey = Object.keys(r).find(k => k.toUpperCase() === 'APELLIDO');
        let dirKey = Object.keys(r).find(k => k.toUpperCase() === 'DIRECCION');
        let fnKey = Object.keys(r).find(k => k.toUpperCase() === 'FECHA_NACI' || k.toUpperCase() === 'FEC_NAC');
        
        dbfMap.set(cedula, {
            NOMBRE: nombreKey && r[nombreKey] ? String(r[nombreKey]).trim().toUpperCase() : '',
            APELLIDO: apellidoKey && r[apellidoKey] ? String(r[apellidoKey]).trim().toUpperCase() : '',
            CEDULA: cedula,
            DIRECCION: dirKey && r[dirKey] ? String(r[dirKey]).trim().toUpperCase() : '',
            FECHA_NACI: fnKey && r[fnKey] ? String(r[fnKey]).trim() : ''
        });
    }

    console.log(`DBF indexado en memoria. Iniciando revision y correccion de Firebase...`);
    
    // Hacemos un stream de la colección leyendo SOLO el campo NOMBRE y APELLIDO
    const stream = db.collection(COLLECTION_NAME).select('NOMBRE', 'APELLIDO').stream();
    
    let batch = db.batch();
    let writeCount = 0;
    let totalUpdated = 0;
    
    stream.on('data', (doc) => {
        const data = doc.data();
        // Si le falta nombre O apellido, lo corregimos
        if (!data.NOMBRE || !data.APELLIDO) {
            const cedula = doc.id;
            const dbfData = dbfMap.get(cedula);
            if (dbfData) {
                batch.update(doc.ref, {
                    NOMBRE: dbfData.NOMBRE,
                    APELLIDO: dbfData.APELLIDO,
                    CEDULA: dbfData.CEDULA,
                    DIRECCION: dbfData.DIRECCION,
                    FECHA_NACI: dbfData.FECHA_NACI
                });
                writeCount++;
                totalUpdated++;
            }
            
            if (writeCount >= 400) {
                stream.pause();
                batch.commit().then(() => {
                    batch = db.batch();
                    writeCount = 0;
                    console.log(`Corregidos ${totalUpdated} registros vacios...`);
                    stream.resume();
                }).catch(err => {
                    console.error("Error en commit:", err);
                    stream.resume();
                });
            }
        }
    });

    stream.on('end', async () => {
        if (writeCount > 0) {
            await batch.commit();
            console.log(`Corregidos ${totalUpdated} registros vacios...`);
        }
        console.log(`Proceso finalizado! Total de datos restaurados: ${totalUpdated}`);
        process.exit(0);
    });
    
    stream.on('error', (err) => {
        console.error("Error en el stream:", err);
        process.exit(1);
    });
}

run();
