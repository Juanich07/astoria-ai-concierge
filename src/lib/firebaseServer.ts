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

const hasPlaceholderValue = (value: string | undefined) =>
  typeof value !== 'string' || value.trim().length === 0 || /your_|example|placeholder|replace-me/i.test(value);

const firebaseEnvConfigured =
  typeof firebaseConfig.apiKey === 'string' &&
  !hasPlaceholderValue(firebaseConfig.apiKey) &&
  typeof firebaseConfig.authDomain === 'string' &&
  !hasPlaceholderValue(firebaseConfig.authDomain) &&
  typeof firebaseConfig.projectId === 'string' &&
  !hasPlaceholderValue(firebaseConfig.projectId) &&
  typeof firebaseConfig.storageBucket === 'string' &&
  !hasPlaceholderValue(firebaseConfig.storageBucket) &&
  typeof firebaseConfig.messagingSenderId === 'string' &&
  !hasPlaceholderValue(firebaseConfig.messagingSenderId) &&
  typeof firebaseConfig.appId === 'string' &&
  !hasPlaceholderValue(firebaseConfig.appId);

export const isFirebaseServerConfigured =
  process.env.ENABLE_FIREBASE_CONTENT === 'true' && firebaseEnvConfigured;

let serverDb: Firestore | null = null;

if (isFirebaseServerConfigured) {
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  serverDb = getFirestore(app);
}

export { serverDb };
