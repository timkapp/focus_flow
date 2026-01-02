import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
    apiKey: "AIzaSyB1DyGTdHZGqZg4JJnqUpoi3HCkWRyjDA0",
    authDomain: "focusflow-42119.firebaseapp.com",
    projectId: "focusflow-42119",
    storageBucket: "focusflow-42119.firebasestorage.app",
    messagingSenderId: "266774563474",
    appId: "1:266774563474:web:0aa6cba04a2ecd6955f44b"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
