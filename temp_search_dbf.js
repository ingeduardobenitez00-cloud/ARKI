const { Dbf } = require('dbf-reader');
const fs = require('fs');
const buffer = fs.readFileSync('scripts/padron_capital.dbf');
const dbf = Dbf.read(buffer);
const row = dbf.rows.find(r => String(r.CEDULA) === '7219333');
console.log(row);
