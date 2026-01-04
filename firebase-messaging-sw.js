// sw.js - Service Worker для push-уведомлений
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: "AIzaSyDCk6bvEna6FB8P0B2B0Hq7Rs_kPB-qmy0",
    authDomain: "reonika-push.firebaseapp.com",
    projectId: "reonika-push",
    storageBucket: "reonika-push.appspot.com",
    messagingSenderId: "1092234073124",
    appId: "1:1092234073124:web:a63fdc322aa0ef4a82b4b1"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Обработка фоновых сообщений
messaging.onBackgroundMessage((payload) => {
    console.log('Получено фоновое сообщение:', payload);

    const notificationTitle = payload.notification?.title || 'Новое сообщение в REonika';
    const notificationOptions = {
        body: payload.notification?.body || 'У вас новое сообщение',
        icon: payload.notification?.icon || '/icon.png',
        badge: '/icon.png',
        tag: 'reonika-message',
        requireInteraction: true,
        data: payload.data || {}
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Обработка клика по уведомлению
self.addEventListener('notificationclick', (event) => {
    console.log('Клик по уведомлению:', event);

    event.notification.close();

    // Открыть приложение или фокус на вкладке
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // Если есть открытая вкладка, фокус на неё
            for (let client of windowClients) {
                if (client.url.includes('index.html') && 'focus' in client) {
                    return client.focus();
                }
            }
            // Иначе открыть новую вкладку
            if (clients.openWindow) {
                return clients.openWindow('/index.html');
            }
        })
    );
});
