const fetch = require('node-fetch');

async function getTotales() {
    try {
        const res = await fetch('https://resultados.tsje.gov.py/publicacion/dinamics/divulgacion.ajax.php?codeleccion=44&candidatura=1&departamento=0&distrito=0', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Referer': 'https://resultados.tsje.gov.py/publicacion/divulgacion.html',
                'Origin': 'https://resultados.tsje.gov.py'
            }
        });
        const json = await res.json();
        console.log("Totales:", json.totales);
    } catch (e) {
        console.error(e);
    }
}
getTotales();
