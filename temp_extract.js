const fs = require('fs');
const { Dbf } = require('dbf-reader');

async function getDistritos() {
    let buffer = fs.readFileSync('c:/ARKI/scripts/loc.dbf');
    let dbf = Dbf.read(buffer);
    
    console.log(dbf.columns.map(c => c.name));
    console.log("Sample record:", dbf.rows[0]);
}
getDistritos();
