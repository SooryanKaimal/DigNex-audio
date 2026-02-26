import { auth, db } from './firebase.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const errorMsg = document.getElementById('error-msg');

// Redirect if already logged in
onAuthStateChanged(auth, (user) => {
    const path = window.location.pathname;
    // This checks for BOTH the standard URL and Vercel's clean URL
    if (user && (path === '/' || path.includes('index.html'))) {
        window.location.href = 'dashboard.html';
    }
});

loginBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
        await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
        window.location.href = 'dashboard.html';
    } catch (err) { errorMsg.innerText = err.message; }
});

// In auth.js - Update the signup logic:
signupBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
        const username = emailInput.value.split('@')[0];
        // Generate a dynamic avatar based on the username
        const photoURL = `https://ui-avatars.com/api/?name=${username}&background=bb86fc&color=fff&size=128`;

        const cred = await createUserWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
        await setDoc(doc(db, 'users', cred.user.uid), {
            username: username,
            email: emailInput.value,
            photoURL: photoURL, // Store the URL, not the image
            online: true,
            lastSeen: new Date().toISOString()
        });
        window.location.href = 'dashboard.html';
    } catch (err) { errorMsg.innerText = err.message; }
});