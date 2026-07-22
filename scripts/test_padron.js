const fs = require('fs');
const path = require('path');
const { Dbf } = require('dbf-reader');

const dataFilePath = path.join(__dirname, 'padron_capital.dbf');
const buffer = fs.readFileSync(dataFilePath);
const datatable = Dbf.read(buffer);

console.log(`Total rows: ${datatable.rows.length}`);
if (datatable.rows.length > 0) {
    console.log('Structure of the first row:');
    console.log(datatable.rows[0]);
}
