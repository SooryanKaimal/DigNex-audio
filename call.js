import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, getDoc, updateDoc, onSnapshot, collection, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');
const role = urlParams.get('role'); // 'caller' or 'callee'

let localStream, pc;
let callStartTime;
let timerInterval, statsInterval;

const configuration = {
    iceServers: [
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
    ]
};

// Low Bandwidth: Munge SDP to force low bitrate (16kbps)
function setMediaBitrate(sdp, media, bitrate) {
    let lines = sdp.split('\n');
    let line = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].indexOf('m=' + media) === 0) { line = i; break; }
    }
    if (line === -1) return sdp;
    line++;
    while (lines[line].indexOf('i=') === 0 || lines[line].indexOf('c=') === 0) { line++; }
    if (lines[line].indexOf('b') === 0) {
        lines[line] = 'b=AS:' + bitrate;
        return lines.join('\n');
    }
    lines.splice(line, 0, 'b=AS:' + bitrate);
    return lines.join('\n');
}

onAuthStateChanged(auth, async (user) => {
    if (!user || !roomId) return window.location.href = 'dashboard.html';
    
    document.getElementById('room-id-display').innerText = `Room: ${roomId}`;
    initCall(user);
    
    document.getElementById('end-btn').addEventListener('click', () => endCall(user.uid));
    document.getElementById('mute-btn').addEventListener('click', toggleMute);
});

async function initCall(user) {
    // 1. Get Audio Only (Low Bandwidth constraints)
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
    } catch (e) {
        alert("Microphone access required.");
        return window.location.href = 'dashboard.html';
    }

    // 2. Setup Peer Connection
    pc = new RTCPeerConnection(configuration);
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    pc.ontrack = event => {
        const remoteAudio = document.getElementById('remote-audio');
        remoteAudio.srcObject = event.streams[0];
        document.getElementById('call-status').innerText = "Connected";
        startTimer();
    };

    pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        if (state === 'disconnected' || state === 'failed') {
            document.getElementById('call-status').innerText = "Reconnecting...";
            // Implementing basic retry logic could go here via ICE restart
        }
    };

    startStatsMonitor();

    const roomRef = doc(db, 'rooms', roomId);
    const callerCandidatesCollection = collection(roomRef, 'callerCandidates');
    const calleeCandidatesCollection = collection(roomRef, 'calleeCandidates');

    // 3. Signaling Logic
    if (role === 'caller') {
        pc.onicecandidate = event => {
            if (event.candidate) addDoc(callerCandidatesCollection, event.candidate.toJSON());
        };

        const offer = await pc.createOffer();
        offer.sdp = setMediaBitrate(offer.sdp, 'audio', 16); // Optimization
        await pc.setLocalDescription(offer);
        
        await updateDoc(roomRef, { offer: { type: offer.type, sdp: offer.sdp } });

        onSnapshot(roomRef, (snapshot) => {
            const data = snapshot.data();
            if (!pc.currentRemoteDescription && data?.answer) {
                const answer = new RTCSessionDescription(data.answer);
                pc.setRemoteDescription(answer);
            }
            if (data?.status === 'ended' || data?.status === 'rejected') {
                endCall(user.uid, true);
            }
        });

        onSnapshot(calleeCandidatesCollection, snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const candidate = new RTCIceCandidate(change.doc.data());
                    pc.addIceCandidate(candidate);
                }
            });
        });

    } else if (role === 'callee') {
        pc.onicecandidate = event => {
            if (event.candidate) addDoc(calleeCandidatesCollection, event.candidate.toJSON());
        };

        const roomSnap = await getDoc(roomRef);
        const roomData = roomSnap.data();
        
        if(roomData.offer) {
            await pc.setRemoteDescription(new RTCSessionDescription(roomData.offer));
            const answer = await pc.createAnswer();
            answer.sdp = setMediaBitrate(answer.sdp, 'audio', 16); // Optimization
            await pc.setLocalDescription(answer);
            await updateDoc(roomRef, { answer: { type: answer.type, sdp: answer.sdp }, status: 'connected' });
        }

        onSnapshot(callerCandidatesCollection, snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const candidate = new RTCIceCandidate(change.doc.data());
                    pc.addIceCandidate(candidate);
                }
            });
        });
        
        onSnapshot(roomRef, (snapshot) => {
            if (snapshot.data()?.status === 'ended') endCall(user.uid, true);
        });
    }
}

// Low Network Feature: Monitor Connection Quality
function startStatsMonitor() {
    const indicator = document.getElementById('network-indicator');
    statsInterval = setInterval(async () => {
        if(!pc) return;
        const stats = await pc.getStats(null);
        stats.forEach(report => {
            if (report.type === 'inbound-rtp' && report.kind === 'audio') {
                const packetLoss = report.packetsLost / report.packetsReceived;
                indicator.className = 'network-indicator';
                if (packetLoss > 0.05) {
                    indicator.innerText = "Network: Poor (High Packet Loss)";
                    indicator.classList.add('network-Poor');
                } else if (packetLoss > 0.01) {
                    indicator.innerText = "Network: Medium";
                    indicator.classList.add('network-Medium');
                } else {
                    indicator.innerText = "Network: Good";
                    indicator.classList.add('network-Good');
                }
            }
        });
    }, 3000);
}

function startTimer() {
    callStartTime = Date.now();
    timerInterval = setInterval(() => {
        const diff = new Date(Date.now() - callStartTime);
        document.getElementById('call-timer').innerText = diff.toISOString().substring(11, 19);
    }, 1000);
}

function toggleMute() {
    const audioTrack = localStream.getAudioTracks()[0];
    audioTrack.enabled = !audioTrack.enabled;
    document.getElementById('mute-btn').innerText = audioTrack.enabled ? "Mute" : "Unmute";
    document.getElementById('mute-btn').style.background = audioTrack.enabled ? "var(--primary-color)" : "gray";
}

async function endCall(userId, fromRemote = false) {
    if(!fromRemote) {
        await updateDoc(doc(db, 'rooms', roomId), { status: 'ended' });
        // Log history to 'calls' collection
        await addDoc(collection(db, 'calls'), {
            roomId: roomId,
            endedBy: userId,
            timestamp: new Date().toISOString()
        });
    }
    
    pc?.close();
    localStream?.getTracks().forEach(track => track.stop());
    clearInterval(timerInterval);
    clearInterval(statsInterval);
    
    // Auto cleanup room
    try { await deleteDoc(doc(db, 'rooms', roomId)); } catch(e){}
    
    window.location.href = 'dashboard.html';
}