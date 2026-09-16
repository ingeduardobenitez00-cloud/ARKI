const admin = require('firebase-admin');
admin.initializeApp({
  credential: admin.credential.cert(require('./scripts/serviceAccountKey.json'))
});
const db = admin.firestore();
async function getSample() {
  const s = await db.collection('votos_confirmados').limit(1).get();
  console.log('votos_confirmados sample:', s.docs[0].data());
  const s2 = await db.collection('votos_confirmados_internas').limit(1).get();
  console.log('votos_confirmados_internas sample:', s2.docs[0]?.data());
}
getSample().then(() => process.exit(0));
