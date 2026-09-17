import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection, 
  doc, 
  getDocs, 
  getDoc,
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  onSnapshot,
  writeBatch
} from 'firebase/firestore';

import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App safely
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

const config = firebaseConfig as Record<string, string | undefined>;

// Initialize Firestore safely with multi-tab coordinator & undefined property tolerance
let firestoreDb: ReturnType<typeof getFirestore>;
try {
  firestoreDb = initializeFirestore(
    app,
    {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      }),
      ignoreUndefinedProperties: true
    },
    config.firestoreDatabaseId || undefined
  );
} catch {
  firestoreDb = config.firestoreDatabaseId
    ? getFirestore(app, config.firestoreDatabaseId)
    : getFirestore(app);
}

export const db = firestoreDb;

export {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  writeBatch,
  signInWithPopup,
  signOut,
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged
};

export type { User };
