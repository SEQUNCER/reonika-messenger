// service-worker.js
const CACHE_NAME = 'reonika-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/notifications.js',
  '/mobile-enhancements.js',
  '/supabase.js'
];

// Установка Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Кэширование файлов');
        return cache.addAll(urlsToCache);
      })
  );
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Удаление старого кэша:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Обработка fetch запросов
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

// Обработка push-уведомлений
self.addEventListener('push', (event) => {
  console.log('Push-уведомление получено:', event);
  
  let data = {};
  if (event.data) {
    data = event.data.json();
  }
  
  const options = {
    body: data.body || 'Новое сообщение',
    icon: data.icon || '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
      chatId: data.chatId,
      messageId: data.messageId
    },
    actions: [
      {
        action: 'open',
        title: 'Открыть чат'
      },
      {
        action: 'dismiss',
        title: 'Закрыть'
      }
    ],
    requireInteraction: true
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'REonika', options)
  );
});

// Обработка кликов по уведомлениям
self.addEventListener('notificationclick', (event) => {
  console.log('Клик по уведомлению:', event);
  
  event.notification.close();
  
  const urlToOpen = event.notification.data.url || '/';
  
  if (event.action === 'open') {
    event.waitUntil(
      clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      }).then((windowClients) => {
        // Проверяем, открыта ли уже вкладка
        for (let client of windowClients) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // Если вкладка не открыта, открываем новую
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
    );
  } else if (event.action === 'dismiss') {
    // Просто закрываем уведомление
    event.notification.close();
  } else {
    // Клик по телу уведомления
    event.waitUntil(
      clients.openWindow(urlToOpen)
    );
  }
});

// Обработка уведомлений о сообщениях
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'NEW_MESSAGE') {
    const { title, body, icon, chatId } = event.data;
    
    self.registration.showNotification(title, {
      body,
      icon,
      badge: '/favicon.ico',
      vibrate: [100, 50, 100],
      data: {
        url: '/',
        chatId
      },
      requireInteraction: true
    });
  }
});