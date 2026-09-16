const admin = require('firebase-admin');
admin.initializeApp({
  credential: admin.credential.cert(require('./scripts/serviceAccountKey.json'))
});
const db = admin.firestore();
async function run() {
  const s = await db.collection('votos_confirmados_internas').where('updatedAt', '>=', '2026-09-01').count().get();
  console.log('Recent in internas:', s.data().count);
}
run().then(() => process.exit(0));
