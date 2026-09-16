const admin = require('firebase-admin');
admin.initializeApp({
  credential: admin.credential.cert(require('./scripts/serviceAccountKey.json'))
});
const db = admin.firestore();
async function syncGenerales() {
  const capturesSnap = await db.collection('votos_confirmados').get();
  const operatorCounts = {};
  capturesSnap.forEach(docSnap => {
      const data = docSnap.data();
      if (data.registradoPor_id) {
          operatorCounts[data.registradoPor_id] = (operatorCounts[data.registradoPor_id] || 0) + 1;
      }
  });

  const usersSnap = await db.collection('users').get();
  const usersList = usersSnap.docs.map(d => d.id);

  let batch = db.batch();
  let count = 0;
  for (const userId of usersList) {
      const totalVotos = operatorCounts[userId] || 0;
      batch.update(db.collection('users').doc(userId), { votosCargados: totalVotos });
      count++;
      if (count >= 400) {
          await batch.commit();
          batch = db.batch();
          count = 0;
      }
  }
  if (count > 0) {
      await batch.commit();
  }
  console.log('Done syncing Generales to users.votosCargados!');
}
syncGenerales().then(() => process.exit(0));
