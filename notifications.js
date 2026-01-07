// notifications.js - Улучшенная версия с поддержкой Push API и Service Worker
class REonikaNotifications {
    constructor(messenger) {
        this.messenger = messenger;
        this.notificationPermission = 'default';
        this.pushSubscription = null;
        this.isSupported = this.checkSupport();
        this.serviceWorkerRegistration = null;
        this.init();
    }

    checkSupport() {
        const supported = {
            notifications: 'Notification' in window,
            push: 'PushManager' in window,
            serviceWorker: 'serviceWorker' in navigator,
            vapid: true // VAPID ключи будут добавлены
        };

        console.log('Notification support:', supported);
        return supported.notifications && supported.push && supported.serviceWorker;
    }

    async init() {
        if (!this.isSupported) {
            console.warn('Push notifications не поддерживаются в этом браузере');
            // Используем fallback на обычные уведомления
            await this.initFallbackNotifications();
            return;
        }

        try {
            // Регистрируем Service Worker
            await this.registerServiceWorker();
            
            // Запрашиваем разрешения
            await this.requestPermissions();
            
            // Настраиваем подписку на push
            await this.setupPushSubscription();
            
            // Настраиваем realtime
            this.setupRealtime();
            
            console.log('Push notifications initialized successfully');
        } catch (error) {
            console.error('Error initializing push notifications:', error);
            // Fallback на обычные уведомления
            await this.initFallbackNotifications();
        }
    }

    async initFallbackNotifications() {
        // Используем менеджер разрешений вместо прямого запроса
        if (window.permissionManager) {
            const result = await window.permissionManager.requestSpecificPermission('notifications');
            this.notificationPermission = result.permission;
        } else {
            // Fallback если менеджер разрешений не загружен
            await this.requestPermission();
        }
        this.setupRealtime();
    }

    async registerServiceWorker() {
        try {
            // Создаем Service Worker "на лету"
            const swUrl = this.createServiceWorker();
            const blob = new Blob([swUrl], { type: 'application/javascript' });
            const swUrlObject = URL.createObjectURL(blob);
            
            this.serviceWorkerRegistration = await navigator.serviceWorker.register(swUrlObject);
            console.log('Service Worker registered successfully');
            
            // Очищаем URL после регистрации
            setTimeout(() => URL.revokeObjectURL(swUrlObject), 1000);
            
            return this.serviceWorkerRegistration;
        } catch (error) {
            console.error('Service Worker registration failed:', error);
            throw error;
        }
    }

    createServiceWorker() {
        return `
            // Service Worker для REonika Push Notifications
            const CACHE_NAME = 'reonika-push-v1';
            
            self.addEventListener('install', (event) => {
                console.log('Service Worker installing...');
                self.skipWaiting();
            });
            
            self.addEventListener('activate', (event) => {
                console.log('Service Worker activating...');
                event.waitUntil(self.clients.claim());
            });
            
            self.addEventListener('push', (event) => {
                console.log('Push message received:', event);
                
                if (!event.data) {
                    console.log('Push event has no data');
                    return;
                }
                
                try {
                    const data = event.data.json();
                    console.log('Push data:', data);
                    
                    const title = data.title || 'REonika';
                    const options = {
                        body: data.body || 'Новое сообщение',
                        icon: data.icon || '/icon.png',
                        badge: '/icon.png',
                        tag: data.tag || 'reonika-message',
                        data: data.data || {},
                        requireInteraction: false,
                        silent: false,
                        vibrate: [200, 100, 200],
                        actions: [
                            {
                                action: 'open',
                                title: 'Открыть'
                            },
                            {
                                action: 'dismiss',
                                title: 'Закрыть'
                            }
                        ]
                    };
                    
                    event.waitUntil(
                        self.registration.showNotification(title, options)
                    );
                } catch (error) {
                    console.error('Error processing push message:', error);
                }
            });
            
            self.addEventListener('notificationclick', (event) => {
                console.log('Notification clicked:', event);
                
                event.notification.close();
                
                if (event.action === 'dismiss') {
                    return;
                }
                
                const urlToOpen = event.notification.data?.url || '/';
                
                event.waitUntil(
                    clients.matchAll({ type: 'window' }).then((clientList) => {
                        for (const client of clientList) {
                            if (client.url === urlToOpen && 'focus' in client) {
                                return client.focus();
                            }
                        }
                        
                        if (clients.openWindow) {
                            return clients.openWindow(urlToOpen);
                        }
                    })
                );
            });
            
            self.addEventListener('pushsubscriptionchange', (event) => {
                console.log('Push subscription changed');
                event.waitUntil(
                    self.registration.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: urlB64ToUint8Array('BLbVQ7nJz8o5h9K1nGz2X4f6Y8p0r2t4w6x8z0c2v4b6n8m0q2s4u6w8y0z2a4')
                    })
                    .then((subscription) => {
                        console.log('New subscription:', subscription);
                        // Здесь можно отправить новую подписку на сервер
                    })
                );
            });
            
            // Вспомогательная функция для конвертации VAPID ключа
            function urlB64ToUint8Array(base64String) {
                const padding = '='.repeat((4 - base64String.length % 4) % 4);
                const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
                const rawData = window.atob(base64);
                const outputArray = new Uint8Array(rawData.length);
                
                for (let i = 0; i < rawData.length; ++i) {
                    outputArray[i] = rawData.charCodeAt(i);
                }
                return outputArray;
            }
        `;
    }

    async requestPermissions() {
        try {
            // Запрашиваем разрешение на уведомления
            this.notificationPermission = await Notification.requestPermission();
            
            if (this.notificationPermission !== 'granted') {
                throw new Error('Notification permission denied');
            }
            
            console.log('Notification permission granted');
        } catch (error) {
            console.error('Error requesting notification permission:', error);
            throw error;
        }
    }

    async setupPushSubscription() {
        if (!this.serviceWorkerRegistration) {
            throw new Error('Service Worker not registered');
        }

        try {
            // Проверяем существующую подписку
            let subscription = await this.serviceWorkerRegistration.pushManager.getSubscription();
            
            if (!subscription) {
                // Создаем новую подписку
                // Используем генерированный VAPID ключ для демонстрации
                // В реальном приложении нужно использовать реальные ключи
                const applicationServerKey = this.urlB64ToUint8Array(
                    'BLbVQ7nJz8o5h9K1nGz2X4f6Y8p0r2t4w6x8z0c2v4b6n8m0q2s4u6w8y0z2a4'
                );
                
                subscription = await this.serviceWorkerRegistration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: applicationServerKey
                });
                
                console.log('New push subscription created:', subscription);
                
                // Сохраняем подписку в базе данных
                await this.savePushSubscription(subscription);
            } else {
                console.log('Existing push subscription found:', subscription);
            }
            
            this.pushSubscription = subscription;
            return subscription;
        } catch (error) {
            console.error('Error setting up push subscription:', error);
            throw error;
        }
    }

    urlB64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    async savePushSubscription(subscription) {
        if (!this.messenger?.currentUser) {
            console.warn('Cannot save push subscription: no current user');
            return;
        }

        try {
            const subscriptionData = {
                user_id: this.messenger.currentUser.id,
                endpoint: subscription.endpoint,
                p256dh_key: subscription.getKey('p256dh') ? 
                    btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')))) : null,
                auth_key: subscription.getKey('auth') ? 
                    btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')))) : null,
                created_at: new Date().toISOString(),
                user_agent: navigator.userAgent,
                is_active: true
            };

            // Сохраняем в Supabase
            const { error } = await supabase
                .from('push_subscriptions')
                .upsert(subscriptionData, {
                    onConflict: 'user_id,endpoint'
                });

            if (error) {
                console.error('Error saving push subscription:', error);
                throw error;
            }

            console.log('Push subscription saved successfully');
        } catch (error) {
            console.error('Error saving push subscription:', error);
            // Не выбрасываем ошибку, чтобы не прерывать инициализацию
        }
    }

    async requestPermission() {
        if (!('Notification' in window)) return;
        this.notificationPermission = await Notification.requestPermission();
    }

    setupRealtime() {
        if (!this.messenger) return;

        const userId = this.messenger.currentUser?.id;
        if (!userId) return;

        // Подписка на новые сообщения в чатах пользователя
        const subscription = supabase
            .channel('new-messages')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages'
            }, async (payload) => {
                const message = payload.new;

                // Проверяем, что сообщение в чате пользователя и не от самого пользователя
                if (message.sender_id === userId) return;

                const isUserChat = this.messenger.chats.some(chat => chat.id === message.chat_id);
                if (!isUserChat) return;

                // Показываем уведомление если страница не активна
                if (this.notificationPermission === 'granted' &&
                    (document.visibilityState === 'hidden' || !document.hasFocus())) {
                    
                    // Получаем данные отправителя
                    const { data: sender } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', message.sender_id)
                        .single();

                    if (sender) {
                        const notificationMessage = { ...message, sender };
                        
                        // Показываем push уведомление если доступно
                        if (this.isSupported && this.pushSubscription) {
                            await this.showPushNotification(notificationMessage);
                        } else {
                            // Fallback на обычное уведомление
                            this.showNotification(notificationMessage);
                        }
                    }
                }
            })
            .subscribe();

        this.messenger.realtimeSubscriptions.push(subscription);
    }

    async showPushNotification(message) {
        if (!message.sender) return;

        try {
            // Отправляем push через сервис (можно использовать вебсокеты или другой сервис)
            // Для демонстрации используем обычное уведомление
            this.showNotification(message);
        } catch (error) {
            console.error('Error showing push notification:', error);
            // Fallback
            this.showNotification(message);
        }
    }

    showNotification(message) {
        if (!message.sender) return;

        const notification = new Notification('Новое сообщение в REonika', {
            body: `${message.sender.username}: ${message.content || 'Голосовое/Изображение'}`,
            icon: message.sender.avatar_url || '/icon.png',
            badge: '/icon.png',
            tag: `reonika-message-${message.chat_id}`,
            requireInteraction: false,
            silent: false,
            vibrate: [200, 100, 200]
        });

        // Обработка клика на уведомление
        notification.onclick = () => {
            // Фокусируемся на окне если оно открыто
            window.focus();
            
            // Открываем чат если он не выбран
            if (this.messenger) {
                const chat = this.messenger.chats.find(c => c.id === message.chat_id);
                if (chat) {
                    this.messenger.selectChat(chat);
                }
            }
            
            notification.close();
        };

        // Автоматически закрываем уведомление через 5 секунд
        setTimeout(() => {
            notification.close();
        }, 5000);
    }

    // Метод для тестирования уведомлений
    async testNotification() {
        if (this.notificationPermission !== 'granted') {
            console.warn('Notification permission not granted');
            return false;
        }

        const testMessage = {
            sender: {
                username: 'Тестовый пользователь',
                avatar_url: '/icon.png'
            },
            content: 'Это тестовое push-уведомление',
            chat_id: 'test'
        };

        this.showNotification(testMessage);
        return true;
    }

    // Метод для получения статуса push-уведомлений
    getStatus() {
        return {
            isSupported: this.isSupported,
            permission: this.notificationPermission,
            hasSubscription: !!this.pushSubscription,
            serviceWorkerRegistered: !!this.serviceWorkerRegistration
        };
    }

    // Метод для мобильных WebView улучшений
    enhanceForMobile() {
        if (!this.messenger?.isMobile) return;

        // Добавляем специальные обработчики для мобильных устройств
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                // При возврате в приложение обновляем данные
                if (this.messenger) {
                    this.messenger.loadChats();
                    if (this.messenger.currentChat) {
                        this.messenger.loadMessages(this.messenger.currentChat.id);
                    }
                }
            }
        });

        // ОбработкаAppState для WebView
        if (window.webkit && window.webkit.messageHandlers) {
            // iOS WebView обработчики
            window.webkit.messageHandlers.appStateChange.postMessage({
                state: 'foreground'
            });
        }

        // Android WebView обработчики
        if (window.REonikaWebView) {
            window.REonikaWebView.onAppStateChange('foreground');
        }
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    const checkMessenger = () => {
        if (window.messenger) {
            window.notifications = new REonikaNotifications(window.messenger);
            
            // Добавляем метод для тестирования уведомлений в глобальную область
            window.testNotification = () => {
                if (window.notifications) {
                    return window.notifications.testNotification();
                }
                return false;
            };

            // Добавляем метод для получения статуса
            window.getNotificationStatus = () => {
                if (window.notifications) {
                    return window.notifications.getStatus();
                }
                return null;
            };
            
            console.log('Push notifications initialized. Use testNotification() to test');
            console.log('Use getNotificationStatus() to check status');
        } else {
            setTimeout(checkMessenger, 100);
        }
    };
    setTimeout(checkMessenger, 1000);
});
