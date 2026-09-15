const admin = require('firebase-admin');
const sa = require('./scripts/serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
admin.firestore().collection('sheet_generales').doc('5630148').get().then(doc => {
  console.log(doc.data());
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
