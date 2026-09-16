const admin = require('firebase-admin');
admin.initializeApp({
  credential: admin.credential.cert(require('./scripts/serviceAccountKey.json'))
});
const db = admin.firestore();
async function run() {
  const s = await db.collection('votos_confirmados').where('updatedAt', '<', '2026-09-01').count().get();
  console.log('Old in votos_confirmados:', s.data().count);
}
run().then(() => process.exit(0));
