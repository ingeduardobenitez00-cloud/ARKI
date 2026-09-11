const fetch = require('node-fetch'); // If not available, use https
const https = require('https');
const fs = require('fs');

const url = 'https://simuladoroficial.tsje.gov.py/datos/59.0.0/Candidaturas.json';

https.get(url, {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': 'https://simuladoroficial.tsje.gov.py/'
    }
}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            fs.writeFileSync('Candidaturas.json', data);
            console.log('Saved Candidaturas.json successfully.');
        } catch (e) {
            console.error('Failed to parse or save:', e);
        }
    });
}).on('error', err => {
    console.error('Error fetching:', err);
});
