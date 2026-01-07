// notifications.js - улучшенная система push-уведомлений
class REonikaNotifications {
    constructor(messenger) {
        this.messenger = messenger;
        this.notificationPermission = 'default';
        this.pushSubscription = null;
        this.isSupported = this.checkSupport();
        this.init();
    }

    checkSupport() {
        const hasServiceWorker = 'serviceWorker' in navigator;
        const hasPushManager = 'PushManager' in window;
        const hasNotification = 'Notification' in window;
        
        console.log('Поддержка уведомлений:', {
            serviceWorker: hasServiceWorker,
            pushManager: hasPushManager,
            notification: hasNotification
        });
        
        return hasServiceWorker && hasPushManager && hasNotification;
    }

    async init() {
        if (!this.isSupported) {
            console.warn('Push-уведомления не поддерживаются в этом браузере');
            await this.initBasicNotifications();
            return;
        }

        try {
            // Регистрация Service Worker
            await this.registerServiceWorker();
            
            // Запрос разрешений
            await this.requestPermissions();
            
            // Настройка push-подписки
            await this.setupPushSubscription();
            
            // Настройка real-time подписок
            this.setupRealtime();
            
            // Обработка сообщений от Service Worker
            this.setupMessageListener();
            
        } catch (error) {
            console.error('Ошибка инициализации уведомлений:', error);
            await this.initBasicNotifications();
        }
    }

    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js', {
                    scope: '/'
                });
                
                console.log('Service Worker зарегистрирован:', registration.scope);
                
                // Ожидаем активации
                if (registration.active) {
                    console.log('Service Worker уже активен');
                } else {
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'activated') {
                                console.log('Service Worker активирован');
                            }
                        });
                    });
                }
                
                return registration;
            } catch (error) {
                console.error('Ошибка регистрации Service Worker:', error);
                throw error;
            }
        }
        throw new Error('Service Worker не поддерживается');
    }

    async requestPermissions() {
        // Используем менеджер разрешений если доступен
        if (window.permissionManager) {
            const result = await window.permissionManager.requestNotificationPermission();
            this.notificationPermission = result.permission;
        } else {
            // Запрашиваем разрешения напрямую
            this.notificationPermission = await Notification.requestPermission();
        }
        
        console.log('Разрешение на уведомления:', this.notificationPermission);
        
        if (this.notificationPermission !== 'granted') {
            throw new Error('Разрешение на уведомления не получено');
        }
        
        return this.notificationPermission;
    }

    async setupPushSubscription() {
        if (!this.isSupported || this.notificationPermission !== 'granted') {
            return;
        }

        try {
            const registration = await navigator.serviceWorker.ready;
            
            // Проверяем существующую подписку
            let subscription = await registration.pushManager.getSubscription();
            
            if (!subscription) {
                // Создаем новую подписку
                const vapidPublicKey = await this.getVapidPublicKey();
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey)
                });
            }
            
            this.pushSubscription = subscription;
            
            // Сохраняем подписку в Supabase
            await this.savePushSubscription(subscription);
            
            console.log('Push-подписка настроена успешно');
            
        } catch (error) {
            console.error('Ошибка настройки push-подписки:', error);
            throw error;
        }
    }

    async getVapidPublicKey() {
        // VAPID ключи для Supabase Edge Functions
        // В реальном приложении эти ключи должны быть на сервере
        return 'BMzFTk3Lh8l7e6vD9jJnGnJYcXkMvLzRzCfQdWqEeT7UfN3mKpB8sVg5tYwLqNxHqJrZyPpStUwVqEeT7UfN3mKpB8sVg5tYwLqNxHqJrZyP';
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

    async savePushSubscription(subscription) {
        if (!this.messenger?.currentUser?.id) return;

        try {
            const { data, error } = await supabase
                .from('push_subscriptions')
                .upsert({
                    user_id: this.messenger.currentUser.id,
                    endpoint: subscription.endpoint,
                    p256dh_key: subscription.toJSON().keys.p256dh,
                    auth_key: subscription.toJSON().keys.auth,
                    user_agent: navigator.userAgent,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) {
                console.error('Ошибка сохранения push-подписки:', error);
                throw error;
            }

            console.log('Push-подписка сохранена:', data);
            
        } catch (error) {
            console.error('Ошибка сохранения push-подписки:', error);
            throw error;
        }
    }

    setupRealtime() {
        if (!this.messenger) return;

        const userId = this.messenger.currentUser?.id;
        if (!userId) return;

        // Подписка на новые сообщения
        const subscription = supabase
            .channel('new-messages')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages'
            }, async (payload) => {
                const message = payload.new;

                // Проверяем, что сообщение не от текущего пользователя
                if (message.sender_id === userId) return;

                // Проверяем, что это чат пользователя
                const isUserChat = this.messenger.chats.some(chat => chat.id === message.chat_id);
                if (!isUserChat) return;

                // Отправляем push-уведомление через Supabase Edge Function
                await this.sendPushNotification(message);
                
                // Показываем локальное уведомление если вкладка неактивна
                if (document.visibilityState === 'hidden') {
                    await this.showLocalNotification(message);
                }
            })
            .subscribe();

        this.messenger.realtimeSubscriptions.push(subscription);
    }

    async sendPushNotification(message) {
        try {
            // Получаем данные отправителя
            const { data: sender } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', message.sender_id)
                .single();

            if (!sender) return;

            // Получаем все push-подписки получателя
            const { data: subscriptions } = await supabase
                .from('push_subscriptions')
                .select('*')
                .eq('user_id', this.messenger.currentUser.id);

            if (!subscriptions || subscriptions.length === 0) {
                console.log('Нет push-подписок для пользователя');
                return;
            }

            // Отправляем push-уведомления через Supabase Edge Function
            for (const subscription of subscriptions) {
                try {
                    const response = await supabase.functions.invoke('send-push-notification', {
                        body: {
                            subscription: {
                                endpoint: subscription.endpoint,
                                keys: {
                                    p256dh: subscription.p256dh_key,
                                    auth: subscription.auth_key
                                }
                            },
                            notification: {
                                title: `Новое сообщение от ${sender.username}`,
                                body: message.content || 'Голосовое сообщение или изображение',
                                icon: sender.avatar_url || '/icon.png',
                                badge: '/icon.png',
                                tag: `chat-${message.chat_id}`,
                                data: {
                                    chatId: message.chat_id,
                                    senderId: message.sender_id,
                                    messageId: message.id
                                },
                                actions: [
                                    {
                                        action: 'open',
                                        title: 'Открыть чат'
                                    }
                                ]
                            }
                        }
                    });

                    if (response.error) {
                        console.error('Ошибка отправки push-уведомления:', response.error);
                    } else {
                        console.log('Push-уведомление отправлено успешно');
                    }
                } catch (error) {
                    console.error('Ошибка отправки push-уведомления для подписки:', error);
                }
            }
        } catch (error) {
            console.error('Ошибка в sendPushNotification:', error);
        }
    }

    async showLocalNotification(message) {
        if (this.notificationPermission !== 'granted') return;

        try {
            // Получаем данные отправителя
            const { data: sender } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', message.sender_id)
                .single();

            if (!sender) return;

            const title = `Новое сообщение от ${sender.username}`;
            let body = 'Голосовое сообщение или изображение';
            
            if (message.content) {
                body = message.content;
            } else if (message.image_url) {
                body = '📷 Изображение';
            } else if (message.voice_url) {
                body = '🎤 Голосовое сообщение';
            }

            const notification = new Notification(title, {
                body: body,
                icon: sender.avatar_url || '/icon.png',
                badge: '/icon.png',
                tag: `chat-${message.chat_id}`,
                data: {
                    chatId: message.chat_id,
                    senderId: message.sender_id,
                    messageId: message.id
                },
                requireInteraction: true,
                silent: false
            });

            // Обработка клика по уведомлению
            notification.onclick = () => {
                notification.close();
                
                // Фокусируемся на окне
                window.focus();
                
                // Открываем соответствующий чат
                if (this.messenger && message.chat_id) {
                    const chat = this.messenger.chats.find(c => c.id === message.chat_id);
                    if (chat) {
                        this.messenger.selectChat(chat);
                    }
                }
            };

        } catch (error) {
            console.error('Ошибка показа локального уведомления:', error);
        }
    }

    setupMessageListener() {
        // Обработка сообщений от Service Worker
        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'open_chat') {
                const { chatId, senderId } = event.data;
                
                if (this.messenger) {
                    // Ищем чат в загруженных чатах
                    const chat = this.messenger.chats.find(c => c.id === chatId);
                    if (chat) {
                        this.messenger.selectChat(chat);
                    } else {
                        // Если чат не найден, перезагружаем список чатов
                        this.messenger.loadChats().then(() => {
                            const reloadedChat = this.messenger.chats.find(c => c.id === chatId);
                            if (reloadedChat) {
                                this.messenger.selectChat(reloadedChat);
                            }
                        });
                    }
                }
            }
        });
    }

    async initBasicNotifications() {
        // Резервная система базовых уведомлений
        if (window.permissionManager) {
            const result = await window.permissionManager.requestNotificationPermission();
            this.notificationPermission = result.permission;
        } else {
            this.notificationPermission = await Notification.requestPermission();
        }
        
        this.setupBasicRealtime();
    }

    setupBasicRealtime() {
        if (!this.messenger) return;

        const userId = this.messenger.currentUser?.id;
        if (!userId) return;

        const subscription = supabase
            .channel('new-messages-basic')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages'
            }, async (payload) => {
                const message = payload.new;

                if (message.sender_id === userId) return;

                const isUserChat = this.messenger.chats.some(chat => chat.id === message.chat_id);
                if (!isUserChat) return;

                if (this.notificationPermission === 'granted' && 
                    document.visibilityState === 'hidden') {
                    await this.showBasicNotification(message);
                }
            })
            .subscribe();

        this.messenger.realtimeSubscriptions.push(subscription);
    }

    async showBasicNotification(message) {
        try {
            const { data: sender } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', message.sender_id)
                .single();

            if (!sender) return;

            let body = 'Новое сообщение';
            if (message.content) {
                body = `${sender.username}: ${message.content}`;
            } else if (message.image_url) {
                body = `${sender.username}: 📷 Изображение`;
            } else if (message.voice_url) {
                body = `${sender.username}: 🎤 Голосовое сообщение`;
            }

            new Notification('REonika', {
                body: body,
                icon: sender.avatar_url || '/icon.png'
            });
        } catch (error) {
            console.error('Ошибка базового уведомления:', error);
        }
    }

    // Метод для проверки статуса уведомлений
    getStatus() {
        return {
            supported: this.isSupported,
            permission: this.notificationPermission,
            pushSubscription: !!this.pushSubscription,
            serviceWorkerReady: !!navigator.serviceWorker?.controller
        };
    }

    // Метод для удаления push-подписки
    async unsubscribeFromPush() {
        if (!this.pushSubscription) return true;

        try {
            await this.pushSubscription.unsubscribe();
            
            // Удаляем из базы данных
            if (this.messenger?.currentUser?.id) {
                await supabase
                    .from('push_subscriptions')
                    .delete()
                    .eq('user_id', this.messenger.currentUser.id);
            }
            
            this.pushSubscription = null;
            console.log('Отписка от push-уведомлений выполнена');
            return true;
        } catch (error) {
            console.error('Ошибка отписки от push-уведомлений:', error);
            return false;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const checkMessenger = () => {
        if (window.messenger) {
            window.notifications = new REonikaNotifications(window.messenger);
            console.log('Система уведомлений инициализирована');
        } else {
            setTimeout(checkMessenger, 100);
        }
    };
    setTimeout(checkMessenger, 1000);
});

export { REonikaNotifications };
