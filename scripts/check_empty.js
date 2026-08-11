const admin = require('firebase-admin');
const sa = require('./serviceAccountKey.json');
admin.initializeApp({credential: admin.credential.cert(sa)});
async function run() {
  const snap = await admin.firestore().collection('sheet1')
    .where('LOCAL', '==', 'COL.NAC.CERRO CORA')
    .where('MESA', '==', '1')
    .where('ORDEN', '==', '70')
    .get();
  snap.forEach(d => console.log('ID:', d.id, 'Data:', d.data()));
  process.exit(0);
}
run();
