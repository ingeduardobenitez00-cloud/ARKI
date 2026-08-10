const { Dbf } = require('dbf-reader');
const fs = require('fs');
const buffer = fs.readFileSync('scripts/padron_capital.dbf');
const dbf = Dbf.read(buffer);
console.log(dbf.columns.map(c => c.name));
console.log(dbf.rows[0]);
