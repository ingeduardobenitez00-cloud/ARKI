const fs = require('fs');
const path = require('path');
const { Dbf } = require('dbf-reader');

async function debugDBF() {
    const dbfPath = path.join(__dirname, 'padron_capital.dbf');
    const buffer = fs.readFileSync(dbfPath);
    const datatable = Dbf.read(buffer);

    console.log(`Analizando primeros 20 registros únicos de Capital en el DBF...`);
    const unique = {};
    for (let i = 0; i < datatable.rows.length; i++) {
        const r = datatable.rows[i];
        const dpto = r['DEPART'] !== undefined ? String(r['DEPART']).trim() : '';
        const dist = r['DISTRITO'] !== undefined ? String(r['DISTRITO']).trim() : '';
        const zona = r['ZONA'] !== undefined ? String(r['ZONA']).trim() : '';
        const local = r['LOCAL'] !== undefined ? String(r['LOCAL']).trim() : '';
        const descrip = r['DESC_LOCAL'] !== undefined ? String(r['DESC_LOCAL']).trim() : '';
        
        if (dpto === '0') { // Solo Capital
            const key = `${dpto}_${dist}_${zona}_${local}`;
            if (!unique[key]) {
                unique[key] = descrip;
                if (Object.keys(unique).length <= 20) {
                    console.log(`DBF tiene: DPTO=${dpto}, DIST=${dist}, ZONA=${zona}, LOCAL=${local} -> ${descrip}`);
                }
            }
        }
    }
}
debugDBF();
