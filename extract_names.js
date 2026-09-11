const fs = require('fs');
const data = require('./Candidaturas.json');

const listsToExtract = ['6', '7']; 
const output = {};

listsToExtract.forEach(list => {
    const candidates = data.filter(c => c.cod_categoria === 'JUN' && c.cod_lista === list);
    candidates.sort((a, b) => parseInt(a.codigo.split('.')[1]) - parseInt(b.codigo.split('.')[1]));
    output['lista-' + list] = candidates.map(c => c.nombre);
});

fs.writeFileSync('extracted_names_2.json', JSON.stringify(output, null, 2));
console.log('Saved extracted_names_2.json');
