import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const isFirebaseConfigured =
  typeof firebaseConfig.apiKey === 'string' &&
  firebaseConfig.apiKey.length > 0 &&
  typeof firebaseConfig.authDomain === 'string' &&
  firebaseConfig.authDomain.length > 0 &&
  typeof firebaseConfig.projectId === 'string' &&
  firebaseConfig.projectId.length > 0 &&
  typeof firebaseConfig.storageBucket === 'string' &&
  firebaseConfig.storageBucket.length > 0 &&
  typeof firebaseConfig.messagingSenderId === 'string' &&
  firebaseConfig.messagingSenderId.length > 0 &&
  typeof firebaseConfig.appId === 'string' &&
  firebaseConfig.appId.length > 0;

let db: ReturnType<typeof getFirestore> | null = null;
let auth: ReturnType<typeof getAuth> | null = null;
let storage: ReturnType<typeof getStorage> | null = null;

if (isFirebaseConfigured) {
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  db = getFirestore(app);
  auth = getAuth(app);
  storage = getStorage(app);
}

export { auth, db, storage, isFirebaseConfigured };
