const fs = require('fs');
const path = require('path');
const { Dbf } = require('dbf-reader');

async function inspectDBF() {
    const dbfPath = path.join(__dirname, 'padron_capital.dbf');
    if (!fs.existsSync(dbfPath)) {
        console.error('❌ Archivo padron_capital.dbf no encontrado.');
        return;
    }
    const buffer = fs.readFileSync(dbfPath);
    const datatable = Dbf.read(buffer);

    console.log(`\n📊 Total de registros: ${datatable.rows.length}`);
    if (datatable.rows.length > 0) {
        console.log(`\n📋 Cabeceras encontradas:`);
        console.log(Object.keys(datatable.rows[0]));
        
        console.log(`\n🔍 Muestra del primer registro:`);
        console.log(datatable.rows[0]);
    }
}
inspectDBF();
