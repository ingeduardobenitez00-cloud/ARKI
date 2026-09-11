const url = 'https://simuladoroficial.tsje.gov.py/datos/59.0.0/imagenes_candidaturas/1.0.webp';
fetch(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://simuladoroficial.tsje.gov.py/sufragio.html?ubicacion=59.0.0'
  }
}).then(r => {
  console.log(r.status, r.headers.get('content-length'));
  if (r.ok) {
    console.log("Success! We can download the image.");
  } else {
    r.text().then(console.log);
  }
});
