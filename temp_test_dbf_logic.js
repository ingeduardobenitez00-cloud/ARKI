const { Dbf } = require('dbf-reader');
const fs = require('fs');

const buffer = fs.readFileSync('scripts/padron_capital.dbf');
const datatable = Dbf.read(buffer);

const record = datatable.rows.find(r => String(r.CEDULA) === '7219333');

const cedulaKey = Object.keys(record).find(k => k.trim().toUpperCase() === 'CEDULA' || k.trim().toUpperCase() === 'CI');
            
let localKey = null;
const preferredLocalKeys = ['DESC_LOCAL', 'LOCAL_VOTACION', 'LOCALVOTACION', 'COLEGIO', 'LOCAL'];
for (const pref of preferredLocalKeys) {
    const found = Object.keys(record).find(k => k.trim().toUpperCase() === pref);
    if (found) {
        localKey = found;
        break;
    }
}

const mesaKey = Object.keys(record).find(k => k.trim().toUpperCase() === 'MESA');
const ordenKey = Object.keys(record).find(k => k.trim().toUpperCase() === 'ORDEN');
const secKey = Object.keys(record).find(k => ['CODIGO_SEC', 'SECCIONAL', 'SECC'].includes(k.trim().toUpperCase()));

const cedulaStr = String(record[cedulaKey]).trim();
const updateData = {};

if (localKey && record[localKey]) updateData.LOCAL = String(record[localKey]).trim().toUpperCase();
if (mesaKey && record[mesaKey]) updateData.MESA = String(record[mesaKey]).trim();
if (ordenKey && record[ordenKey]) updateData.ORDEN = String(record[ordenKey]).trim();
if (secKey && record[secKey]) updateData.CODIGO_SEC = String(record[secKey]).trim();

console.log("Cedula:", cedulaStr);
console.log("Data to update:", updateData);
