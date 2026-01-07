// Service Worker для REonika - push-уведомления
const CACHE_NAME = 'reonika-v1';
const STATIC_CACHE_URLS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/notifications.js',
  '/permission-manager.js',
  '/supabase.js',
  '/mobile-enhancements.js',
  '/mobile-session-manager.js',
  '/auth-redirect.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// Установка Service Worker и кэширование статических файлов
self.addEventListener('install', (event) => {
  console.log('Service Worker: Установка...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Кэширование статических файлов');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => {
        console.log('Service Worker: Установлен успешно');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Ошибка установки', error);
      })
  );
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Активация...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('Service Worker: Удаление старого кэша', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Активирован');
        return self.clients.claim();
      })
  );
});

// Обработка запросов
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Если есть в кэше, возвращаем оттуда
        if (response) {
          return response;
        }
        
        // Иначе делаем сетевой запрос
        return fetch(event.request)
          .then((response) => {
            // Проверяем, что ответ валидный
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Кэшируем ответ для будущих запросов
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch((error) => {
            console.error('Service Worker: Ошибка загрузки', error);
            
            // Для HTML запросов возвращаем офлайн страницу
            if (event.request.destination === 'document') {
              return caches.match('/index.html');
            }
          });
      })
  );
});

// Обработка push-уведомлений
self.addEventListener('push', (event) => {
  console.log('Service Worker: Получено push-уведомление');
  
  if (!event.data) {
    console.log('Service Worker: Push-уведомление без данных');
    return;
  }
  
  let notificationData;
  
  try {
    notificationData = event.data.json();
  } catch (e) {
    notificationData = {
      title: 'REonika',
      body: event.data.text(),
      icon: '/icon.png'
    };
  }
  
  const options = {
    body: notificationData.body || 'Новое сообщение',
    icon: notificationData.icon || '/icon.png',
    badge: '/icon.png',
    vibrate: [200, 100, 200],
    data: notificationData.data || {},
    actions: [
      {
        action: 'open',
        title: 'Открыть'
      },
      {
        action: 'close',
        title: 'Закрыть'
      }
    ],
    requireInteraction: true,
    silent: false
  };
  
  // Добавляем изображение если есть
  if (notificationData.image) {
    options.image = notificationData.image;
  }
  
  event.waitUntil(
    self.registration.showNotification(
      notificationData.title || 'REonika',
      options
    )
  );
});

// Обработка кликов по уведомлениям
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Клик по уведомлению', event.notification.data);
  
  event.notification.close();
  
  const action = event.action;
  const notificationData = event.notification.data || {};
  
  if (action === 'close') {
    return;
  }
  
  // Открываем или фокусируемся на приложении
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    })
      .then((clientList) => {
        // Ищем открытый клиент
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            // Если есть данные о чате, открываем соответствующий чат
            if (notificationData.chatId) {
              // Отправляем сообщение в клиент для открытия чата
              client.postMessage({
                type: 'open_chat',
                chatId: notificationData.chatId,
                senderId: notificationData.senderId
              });
            }
            return client.focus();
          }
        }
        
        // Если нет открытых клиентов, открываем новый
        if (clients.openWindow) {
          let url = '/';
          
          // Если есть данные о чате, добавляем их в URL
          if (notificationData.chatId) {
            url += `?chat=${notificationData.chatId}`;
            if (notificationData.senderId) {
              url += `&sender=${notificationData.senderId}`;
            }
          }
          
          return clients.openWindow(url);
        }
      })
  );
});

// Обработка закрытия уведомлений
self.addEventListener('notificationclose', (event) => {
  console.log('Service Worker: Уведомление закрыто', event);
});

// Синхронизация фоновых событий
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Фоновая синхронизация', event.tag);
  
  if (event.tag === 'background-sync-messages') {
    event.waitUntil(
      // Здесь можно добавить логику синхронизации сообщений
      console.log('Service Worker: Синхронизация сообщений')
    );
  }
});

// Обработка сообщений от клиента
self.addEventListener('message', (event) => {
  console.log('Service Worker: Сообщение от клиента', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Периодическая проверка обновлений
self.addEventListener('periodicsync', (event) => {
  console.log('Service Worker: Периодическая синхронизация', event.tag);
  
  if (event.tag === 'check-updates') {
    event.waitUntil(
      // Проверка обновлений приложения
      checkForUpdates()
    );
  }
});

async function checkForUpdates() {
  try {
    const response = await fetch('/');
    if (response.ok) {
      console.log('Service Worker: Проверка обновлений завершена');
    }
  } catch (error) {
    console.error('Service Worker: Ошибка проверки обновлений', error);
  }
}
