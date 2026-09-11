const https = require('https');
const fs = require('fs');
const path = require('path');

const candidates = [
  { file: 'intendente-1.webp', url: 'https://simuladoroficial.tsje.gov.py/datos/59.0.0/imagenes_candidaturas/1.0.webp' },
  { file: 'intendente-4.webp', url: 'https://simuladoroficial.tsje.gov.py/datos/59.0.0/imagenes_candidaturas/2.1.webp' },
  { file: 'intendente-6.webp', url: 'https://simuladoroficial.tsje.gov.py/datos/59.0.0/imagenes_candidaturas/3.2.webp' },
  { file: 'intendente-300.webp', url: 'https://simuladoroficial.tsje.gov.py/datos/59.0.0/imagenes_candidaturas/4.3.webp' },
];

for (let i = 1; i <= 24; i++) {
  candidates.push({
    file: `concejal-1-opt-${i}.webp`,
    url: `https://simuladoroficial.tsje.gov.py/datos/59.0.0/imagenes_candidaturas/5.${i + 3}.webp`
  });
}

const dir = path.join('c:\\ARKI', 'public', 'candidates', 'generales');
if (!fs.existsSync(dir)){
    fs.mkdirSync(dir, { recursive: true });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, { headers: { 'Referer': 'https://simuladoroficial.tsje.gov.py/' } }, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

async function run() {
  for (const c of candidates) {
    console.log(`Downloading ${c.url}...`);
    await download(c.url, path.join(dir, c.file));
  }
  console.log('All done!');
}

run();
