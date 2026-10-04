const xlsx = require('xlsx');

try {
    const workbook = xlsx.readFile('guillermo.xlsx');
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);
    console.log(`Leídas ${data.length} filas.`);
    if (data.length > 0) {
        console.log('Primera fila:', data[0]);
    }
} catch (e) {
    console.error('Error leyendo Excel:', e.message);
}
