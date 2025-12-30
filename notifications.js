// notifications.js
class REonikaNotifications {
    constructor(messenger) {
        this.messenger = messenger;
        this.notificationPermission = 'default';
        this.serviceWorkerRegistration = null;
        this.publicVapidKey = 'YOUR_PUBLIC_VAPID_KEY'; // Нужно сгенерировать
        this.init();
    }

    async init() {
        await this.requestPermission();
        await this.registerServiceWorker();
        this.setupRealtime();
    }

    async requestPermission() {
        if (!('Notification' in window)) {
            console.warn('Уведомления не поддерживаются');
            return;
        }
        
        this.notificationPermission = await Notification.requestPermission();
        
        if (this.notificationPermission === 'granted') {
            console.log('Разрешение на уведомления получено');
            
            // Подписываем на push-уведомления
            await this.subscribeToPush();
        }
    }

    async registerServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            console.warn('Service Worker не поддерживается');
            return;
        }

        try {
            this.serviceWorkerRegistration = await navigator.serviceWorker.register('/sw.js', {
                scope: '/'
            });
            
            console.log('Service Worker зарегистрирован');
            
            // Проверяем, есть ли активный Service Worker
            if (this.serviceWorkerRegistration.active) {
                console.log('Service Worker активен');
            }
            
        } catch (error) {
            console.error('Ошибка регистрации Service Worker:', error);
        }
    }

    async subscribeToPush() {
        if (!this.serviceWorkerRegistration) {
            console.warn('Service Worker не зарегистрирован');
            return;
        }

        try {
            const subscription = await this.serviceWorkerRegistration.pushManager.getSubscription();
            
            if (subscription) {
                console.log('Уже подписан на push-уведомления');
                return subscription;
            }

            // Конвертируем VAPID key
            const convertedVapidKey = this.urlBase64ToUint8Array(this.publicVapidKey);
            
            const newSubscription = await this.serviceWorkerRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey
            });
            
            console.log('Подписан на push-уведомления');
            
            // Отправляем подписку на сервер
            await this.sendSubscriptionToServer(newSubscription);
            
            return newSubscription;
            
        } catch (error) {
            console.error('Ошибка подписки на push-уведомления:', error);
        }
    }

    async sendSubscriptionToServer(subscription) {
        if (!this.messenger.currentUser) return;
        
        try {
            // Сохраняем подписку в Supabase
            const { error } = await supabase
                .from('push_subscriptions')
                .upsert({
                    user_id: this.messenger.currentUser.id,
                    subscription: JSON.stringify(subscription),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });

            if (error) {
                console.error('Ошибка сохранения подписки:', error);
            }
            
        } catch (error) {
            console.error('Ошибка отправки подписки на сервер:', error);
        }
    }

    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    setupRealtime() {
        if (!this.messenger) return;

        // Подписываемся на новые сообщения
        const subscription = supabase
            .channel('user-messages')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `receiver_id=eq.${this.messenger.currentUser?.id}`
            }, async (payload) => {
                const message = payload.new;
                
                // Получаем информацию об отправителе
                const { data: sender } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', message.sender_id)
                    .single();

                if (sender) {
                    // Показываем уведомление
                    this.showNotification(message, sender);
                }
            })
            .subscribe();

        this.messenger.realtimeSubscriptions.push(subscription);
    }

    showNotification(message, sender) {
        if (!message.sender_id || message.sender_id === this.messenger.currentUser?.id) return;

        const options = {
            body: `${sender.username}: ${message.content || 'Голосовое/Изображение'}`,
            icon: sender.avatar_url || '/icon-192x192.png',
            badge: '/badge-72x72.png',
            vibrate: [200, 100, 200],
            data: {
                chatId: message.chat_id,
                messageId: message.id,
                url: window.location.origin
            },
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

        // Проверяем видимость страницы
        if (document.visibilityState === 'hidden') {
            if (this.notificationPermission === 'granted') {
                // Создаем браузерное уведомление
                const notification = new Notification('REonika: Новое сообщение', options);
                
                notification.onclick = (event) => {
                    event.preventDefault();
                    window.focus();
                    
                    if (this.messenger.currentChat?.id !== message.chat_id) {
                        // Открываем соответствующий чат
                        this.messenger.selectChatById(message.chat_id);
                    }
                    
                    notification.close();
                };
            }
        }
    }

    // Метод для отправки push-уведомлений с сервера
    async sendPushNotification(userId, title, body, data = {}) {
        try {
            // Получаем подписку пользователя из базы данных
            const { data: subscriptionData } = await supabase
                .from('push_subscriptions')
                .select('subscription')
                .eq('user_id', userId)
                .single();

            if (!subscriptionData) {
                console.log('У пользователя нет подписки на push-уведомления');
                return;
            }

            const subscription = JSON.parse(subscriptionData.subscription);
            
            // Отправляем push-уведомление через серверную функцию
            const response = await fetch('/api/send-push', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    subscription,
                    title,
                    body,
                    data
                })
            });

            if (!response.ok) {
                console.error('Ошибка отправки push-уведомления');
            }
            
        } catch (error) {
            console.error('Ошибка отправки push-уведомления:', error);
        }
    }
}

// Инициализация Service Worker
if ('serviceWorker' in navigator && 'PushManager' in window) {
    window.addEventListener('load', () => {
        const checkMessenger = () => {
            if (window.messenger) {
                window.notifications = new REonikaNotifications(window.messenger);
            } else {
                setTimeout(checkMessenger, 100);
            }
        };
        setTimeout(checkMessenger, 1000);
    });
}