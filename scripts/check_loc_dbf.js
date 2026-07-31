const fs = require('fs');
const path = require('path');
const { Dbf } = require('dbf-reader');

const dataFilePath = path.join(__dirname, 'loc.dbf');
if (!fs.existsSync(dataFilePath)) {
    console.error(`❌ Error: El archivo loc.dbf no existe.`);
    process.exit(1);
}

const buffer = fs.readFileSync(dataFilePath);
const datatable = Dbf.read(buffer);

let sinDesc = [];
for (let i = 0; i < datatable.rows.length; i++) {
    const record = datatable.rows[i];
    const desc = record['DESCRIP'];
    if (desc && typeof desc === 'string' && desc.includes('SIN DESCRIPCION')) {
        sinDesc.push(record);
    }
}

console.log(`Locales con SIN DESCRIPCION: ${sinDesc.length}`);
if (sinDesc.length > 0) {
    console.log('Ejemplos:');
    sinDesc.slice(0, 5).forEach(r => console.log(`${r['DPTO']}-${r['DISTRITO']}-${r['ZONA']}-${r['LOCAL']} -> ${r['DESCRIP']}`));
} else {
    // Check if there are completely empty descriptions
    let emptyDesc = [];
    for (let i = 0; i < datatable.rows.length; i++) {
        if (!datatable.rows[i]['DESCRIP'] || datatable.rows[i]['DESCRIP'].trim() === '') {
            emptyDesc.push(datatable.rows[i]);
        }
    }
    console.log(`Locales con descripción vacía: ${emptyDesc.length}`);
}
