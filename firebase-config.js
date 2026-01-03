// firebase-config.js - версия для обычных скриптов
const firebaseConfig = {
    apiKey: "AIzaSyDCk6bvEna6FB8P0B2B0Hq7Rs_kPB-qmy0",
    authDomain: "reonika-push.firebaseapp.com",
    projectId: "reonika-push",
    storageBucket: "reonika-push.appspot.com",
    messagingSenderId: "1092234073124",
    appId: "1:1092234073124:web:a63fdc322aa0ef4a82b4b1"
};

console.log('🔥 Начинаем инициализацию Firebase...');

// Проверяем доступность Firebase
if (typeof firebase === 'undefined') {
    console.error('❌ Firebase SDK не загружен!');
} else {
    console.log('✅ Firebase SDK доступен');

    try {
        // Инициализируем Firebase
        const app = firebase.initializeApp(firebaseConfig);
        console.log('✅ Firebase app инициализирован');

        const messaging = firebase.messaging();
        console.log('✅ Firebase messaging инициализирован');

        // Экспортируем глобально для совместимости
        window.firebaseApp = app;
        window.firebaseMessaging = messaging;
        window.firebaseGetToken = messaging.getToken.bind(messaging);
        window.firebaseOnMessage = messaging.onMessage.bind(messaging);

        console.log('🔥 Firebase полностью инициализирован в firebase-config.js');
    } catch (error) {
        console.error('❌ Ошибка инициализации Firebase:', error);
    }
}
