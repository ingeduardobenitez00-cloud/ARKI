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
    console.log("Checking locals for Zona 34...");
    for (let i = 1; i <= 20; i++) {
        const data = await fetchUrl(`https://resultados.tsje.gov.py/publicacion/dinamics/certificado.ajax.php?eleccion=44&candidatura=2&departamento=0&distrito=0&zona=34&local=${i}&mesa=1`);
        if (!data.includes('"codEleccion":null')) {
            const parsed = JSON.parse(data);
            console.log(`Local ${i}: ${parsed.cabecera.desLocal}`);
        }
    }
}
run();
