
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, setDoc } from 'firebase/firestore';
import * as dotenv from 'dotenv';
dotenv.config();

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testUpdate(userId) {
  console.log(`Testing update for user ${userId}...`);
  const userRef = doc(db, 'users', userId);
  try {
    await setDoc(userRef, {
      test_field: "test_" + Date.now(),
      permissions: ['/', '/escaner-actas', '/resultados-electorales'],
      updatedAt: new Date().toISOString()
    }, { merge: true });
    console.log("Update successful!");
  } catch (error) {
    console.error("Update failed:", error);
  }
}

// Get userId from command line
const userId = process.argv[2];
if (userId) {
  testUpdate(userId);
} else {
  console.log("Usage: node test-firestore.js <userId>");
}
