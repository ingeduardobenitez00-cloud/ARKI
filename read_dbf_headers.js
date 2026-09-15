const fs = require('fs');
const path = require('path');
const { Dbf } = require('dbf-reader');

const dbfPath = path.join(__dirname, 'scripts', 'padron_capital.dbf');
if (!fs.existsSync(dbfPath)) {
    console.error('dbf not found');
    process.exit(1);
}

const buffer = fs.readFileSync(dbfPath);
const datatable = Dbf.read(buffer);

if (datatable.rows.length > 0) {
    console.log("Headers:");
    console.log(Object.keys(datatable.rows[0]));
} else {
    console.log("empty dbf");
}
process.exit(0);
