const admin = require('firebase-admin');
admin.initializeApp({
  credential: admin.credential.cert(require('./scripts/serviceAccountKey.json'))
});
const db = admin.firestore();
async function countBoth() {
  const c1 = await db.collection('votos_confirmados').count().get();
  const c2 = await db.collection('votos_confirmados_internas').count().get();
  console.log('votos_confirmados:', c1.data().count);
  console.log('votos_confirmados_internas:', c2.data().count);
}
countBoth().then(() => process.exit(0));
