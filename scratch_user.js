const admin = require('firebase-admin');
admin.initializeApp({
  credential: admin.credential.cert(require('./scripts/serviceAccountKey.json'))
});
const db = admin.firestore();
async function getSampleUser() {
  const users = await db.collection('users').where('votosCargados', '>', 0).limit(3).get();
  users.forEach(doc => {
      console.log(doc.id, 'votosCargados:', doc.data().votosCargados, 'votosCargadosInternas:', doc.data().votosCargadosInternas);
  });
}
getSampleUser().then(() => process.exit(0));
