const fetch = require('node-fetch');
async function getElecciones() {
    try {
        const res = await fetch('https://resultados.tsje.gov.py/publicacion/dinamics/elecciones.json', {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://resultados.tsje.gov.py/' }
        });
        const text = await res.text();
        console.log(text.substring(0, 1000));
    } catch(e) { console.error(e); }
}
getElecciones();
