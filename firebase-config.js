// firebase-config.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js';
import { getMessaging, getToken, onMessage } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js';

const firebaseConfig = {
    apiKey: "AIzaSyDCk6bvEna6FB8P0B2B0Hq7Rs_kPB-qmy0",
    authDomain: "reonika-push.firebaseapp.com",
    projectId: "reonika-push",
    storageBucket: "reonika-push.appspot.com",
    messagingSenderId: "1092234073124",
    appId: "1:1092234073124:web:a63fdc322aa0ef4a82b4b1"
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

export { messaging, getToken, onMessage };
