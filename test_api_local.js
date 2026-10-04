const crypto = require('crypto');
const token = '23f923197185f91f34d78764624d0b848c5f736fa36aea2eaab69fb2a37493be';

async function test() {
    const data = {
        "id": "99999",
        "seccional": 1,
        "mesa": "4",
        "transmitido_en": "2026-10-02T16:48:00Z",
        "orden": 123,
        "local": 8,
        "zona": 5,
        "departamento": 0,
        "origen_id": 99999,
        "recibido_en": "2026-10-02T16:48:06.412Z",
        "distrito": 0,
        "estado": "v"
    };

    const rawBody = JSON.stringify(data);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    
    const signature = crypto
        .createHmac('sha256', token)
        .update(`${timestamp}.${rawBody}`)
        .digest('hex');

    console.log("Sending to live API...");
    const res = await fetch('http://localhost:3000/api/transmisiones', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'x-timestamp': timestamp,
            'x-signature': signature
        },
        body: rawBody
    });

    const text = await res.text();
    console.log(`Status: ${res.status}`);
    console.log(`Response: ${text}`);
}

test();
