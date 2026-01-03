// sw.js - Service Worker для push-уведомлений REonika
importScripts('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');

// Инициализация Supabase
const supabaseUrl = 'https://khosjiirbcxkgbpwsgmx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtob3NqaWlyYmN4a2dicHdzZ214Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjM4MTQ5MCwiZXhwIjoyMDgxOTU3NDkwfQ.9O0CiAQCkl7CluomZhiLk1R82p4gMbD1ns69InzVVZM';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

self.addEventListener('install', (event) => {
    console.log('Service Worker installing.');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker activating.');
    event.waitUntil(clients.claim());
});

// Обработка push-событий
self.addEventListener('push', (event) => {
    console.log('Push message received:', event);

    if (!event.data) {
        console.log('Push event but no data');
        return;
    }

    const data = event.data.json();
    console.log('Push data:', data);

    const options = {
        body: data.body,
        icon: data.icon || '/icon.png',
        badge: '/icon.png',
        image: data.image,
        tag: data.tag || 'reonika-message',
        requireInteraction: true,
        silent: false,
        actions: [
            {
                action: 'view',
                title: 'Открыть',
                icon: '/icon.png'
            },
            {
                action: 'close',
                title: 'Закрыть'
            }
        ],
        data: {
            url: data.url || '/',
            chatId: data.chatId,
            messageId: data.messageId
        }
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'REonika', options)
    );
});

// Обработка клика по уведомлению
self.addEventListener('notificationclick', (event) => {
    console.log('Notification click received:', event);

    event.notification.close();

    const data = event.notification.data || {};
    const url = data.url || '/';

    if (event.action === 'close') {
        return;
    }

    // Открыть или фокусировать окно приложения
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // Проверить, есть ли уже открытое окно
            for (let client of windowClients) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.focus();
                }
            }

            // Если нет открытого окна, открыть новое
            if (clients.openWindow) {
                return clients.openWindow(url);
            }
        })
    );
});

// Обработка сообщений от основного потока
self.addEventListener('message', (event) => {
    console.log('Service Worker received message:', event.data);

    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
        // Показываем уведомление из основного потока
        const { title, body, icon, tag, data } = event.data;

        const options = {
            body: body,
            icon: icon || '/icon.png',
            badge: '/icon.png',
            tag: tag || 'reonika-message',
            requireInteraction: true,
            silent: false,
            actions: [
                {
                    action: 'view',
                    title: 'Открыть',
                    icon: '/icon.png'
                },
                {
                    action: 'close',
                    title: 'Закрыть'
                }
            ],
            data: data || {}
        };

        self.registration.showNotification(title || 'REonika', options);
    }
});
