import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyAlI-aiegRXTaC0Xun6Z1n0NDZOdUXGv2g",
  authDomain: "gen-lang-client-0876291410.firebaseapp.com",
  projectId: "gen-lang-client-0876291410",
  storageBucket: "gen-lang-client-0876291410.firebasestorage.app",
  messagingSenderId: "107942686067",
  appId: "1:107942686067:web:ba35b29c7beb422585a906",
  databaseURL: undefined,
};

// Primary app
const app = getApps().find(a => a.name === '[DEFAULT]') || initializeApp(firebaseConfig);

// Secondary app for creating users without signing out the current admin
const secondaryAppName = 'secondary';
const secondaryApp =
  getApps().find(a => a.name === secondaryAppName) ||
  initializeApp(firebaseConfig, secondaryAppName);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const secondaryAuth = getAuth(secondaryApp);
