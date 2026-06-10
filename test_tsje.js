const https = require('https');

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function run() {
    try {
        console.log("Fetching zonas...");
        const html = await fetchUrl('https://resultados.tsje.gov.py/publicacion/divulgacion.html');
        // Let's just fetch some common structures
        const z1 = await fetchUrl('https://resultados.tsje.gov.py/publicacion/dinamics/zonas.ajax.php?departamento=0&distrito=0');
        console.log("Zonas.ajax.php:", z1.slice(0, 100));

        const z2 = await fetchUrl('https://resultados.tsje.gov.py/publicacion/dinamics/0/0/zonas.ajax.php');
        console.log("0/0/zonas.ajax.php:", z2.slice(0, 100));

        const tree = await fetchUrl('https://resultados.tsje.gov.py/publicacion/js/app.js');
        console.log("app.js length:", tree.length);

        const config = await fetchUrl('https://resultados.tsje.gov.py/publicacion/dinamics/0/0/locales.ajax.php');
        console.log("locales.ajax.php:", config.slice(0, 100));
        
    } catch (e) {
        console.error(e);
    }
}
run();
