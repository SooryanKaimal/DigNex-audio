import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, doc, onSnapshot, updateDoc, setDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let currentUser;

onAuthStateChanged(auth, async (user) => {
    if (!user) return window.location.href = 'index.html';
    currentUser = user;
    
    // Set presence
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, { online: true, lastSeen: new Date().toISOString() });
    // This splits the email at the '@' and only shows the first part
    document.getElementById('user-display').innerText = user.email.split('@')[0];

    // Handle logout
    document.getElementById('logout-btn').addEventListener('click', async () => {
        await updateDoc(userRef, { online: false });
        await signOut(auth);
    });

    // Listen for users
    // Listen for users
    onSnapshot(collection(db, 'users'), (snapshot) => {
        const list = document.getElementById('users-list');
        list.innerHTML = '';
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (docSnap.id === user.uid) return; // Don't show the logged-in user
            
            const li = document.createElement('li');
            li.className = 'user-item';
            
            // Set fallback image if user hasn't uploaded one yet
            const avatarSrc = data.photoURL || 'https://via.placeholder.com/40';

            // Render the updated UI with the profile image
            li.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="position: relative;">
                        <img src="${avatarSrc}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">
                        <span class="online-dot" style="position: absolute; bottom: 0; right: 0; width: 12px; height: 12px; border: 2px solid var(--surface-color); background-color: ${data.online ? 'var(--success)' : 'gray'}; border-radius: 50%;"></span>
                    </div>
                    <span>${data.username}</span>
                </div>
                <button style="width: auto; padding: 5px 15px;" onclick="window.startCall('${docSnap.id}')">Call</button>
            `;
            
            list.appendChild(li);
        });
    });

    // Listen for incoming calls
    const roomsQuery = query(collection(db, 'rooms'), where('calleeId', '==', user.uid), where('status', '==', 'calling'));
    onSnapshot(roomsQuery, (snapshot) => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
                const roomData = change.doc.data();
                document.getElementById('incoming-call-alert').classList.remove('hidden');
                
                document.getElementById('accept-call').onclick = () => {
                    updateDoc(doc(db, 'rooms', change.doc.id), { status: 'answered' });
                    window.location.href = `call.html?room=${change.doc.id}&role=callee`;
                };
                
                document.getElementById('reject-call').onclick = () => {
                    updateDoc(doc(db, 'rooms', change.doc.id), { status: 'rejected' });
                    document.getElementById('incoming-call-alert').classList.add('hidden');
                };
            }
        });
    });
});

// Start Call Logic (Global scope for inline onClick)
window.startCall = async (calleeId) => {
    const roomRef = doc(collection(db, 'rooms'));
    await setDoc(roomRef, {
        callerId: currentUser.uid,
        calleeId: calleeId,
        status: 'calling',
        createdAt: new Date().toISOString()
    });
    window.location.href = `call.html?room=${roomRef.id}&role=caller`;
};

// Join Room manually
document.getElementById('join-room-btn').addEventListener('click', () => {
    const roomId = document.getElementById('room-input').value;
    if(roomId) window.location.href = `call.html?room=${roomId}&role=callee`;
});

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js');
}