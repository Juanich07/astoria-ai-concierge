import { getApp, getApps, initializeApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore/lite';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseServerConfigured =
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

let serverDb: Firestore | null = null;

if (isFirebaseServerConfigured) {
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  serverDb = getFirestore(app);
}

export { serverDb };
