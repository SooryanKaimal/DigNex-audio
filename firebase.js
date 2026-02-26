import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// REPLACE THIS WITH YOUR ACTUAL FIREBASE CONFIG
const firebaseConfig = {
    apiKey: "AIzaSyDC6hQ_efUrevTL890jhKfRtquCfb5VnqE",
    authDomain: "dignex-audio.firebaseapp.com",
    projectId: "dignex-audio",
    storageBucket: "dignex-audio.firebasestorage.app",
    messagingSenderId: "680504162583",
    appId: "1:680504162583:web:02895f79e5c6aa26891f52"
  };

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);