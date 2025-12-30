// sw.js
self.addEventListener('install', (event) => {
    console.log('Service Worker установлен');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker активирован');
    event.waitUntil(clients.claim());
});

// Обработка push-уведомлений
self.addEventListener('push', (event) => {
    console.log('Получено push-уведомление');
    
    let data = {};
    
    if (event.data) {
        data = event.data.json();
    }
    
    const title = data.title || 'REonika';
    const options = {
        body: data.body || 'Новое сообщение',
        icon: data.icon || '/icon-192x192.png',
        badge: '/badge-72x72.png',
        vibrate: [200, 100, 200],
        data: data.data || {},
        actions: [
            {
                action: 'open',
                title: 'Открыть чат'
            },
            {
                action: 'close',
                title: 'Закрыть'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// Обработка кликов по уведомлениям
self.addEventListener('notificationclick', (event) => {
    console.log('Клик по уведомлению', event.notification.data);
    
    event.notification.close();
    
    const chatId = event.notification.data?.chatId;
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Проверяем, открыто ли уже окно приложения
                for (const client of clientList) {
                    if (client.url.includes('/') && 'focus' in client) {
                        client.focus();
                        
                        // Отправляем сообщение о необходимости открыть чат
                        if (chatId) {
                            client.postMessage({
                                type: 'OPEN_CHAT',
                                chatId: chatId
                            });
                        }
                        
                        return;
                    }
                }
                
                // Если окно не открыто, открываем новое
                if (clients.openWindow) {
                    return clients.openWindow('/');
                }
            })
    );
});

// Обработка сообщений от клиента
self.addEventListener('message', (event) => {
    console.log('Service Worker получил сообщение:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});