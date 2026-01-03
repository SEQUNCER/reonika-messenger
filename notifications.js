// notifications.js
class REonikaNotifications {
    constructor(messenger) {
        this.messenger = messenger;
        this.notificationPermission = 'default';
        this.init();
    }

    async init() {
        // Используем менеджер разрешений вместо прямого запроса
        if (window.permissionManager) {
            const result = await window.permissionManager.requestSpecificPermission('notifications');
            this.notificationPermission = result.permission;
        } else {
            // Fallback если менеджер разрешений не загружен
            await this.requestPermission();
        }

        // Настраиваем push-уведомления
        await this.setupPushNotifications();

        this.setupRealtime();
    }

    async requestPermission() {
        if (!('Notification' in window)) return;
        this.notificationPermission = await Notification.requestPermission();
    }

    async setupPushNotifications() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.log('Push notifications not supported');
            return;
        }

        try {
            const registration = await navigator.serviceWorker.ready;

            // Проверяем существующую подписку
            let subscription = await registration.pushManager.getSubscription();

            if (!subscription) {
                // VAPID ключ для push-уведомлений (нужен для реальных push-сообщений)
                // Для тестирования используем базовую подписку без VAPID
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: this.urlBase64ToUint8Array(
                        // Это пример VAPID public key - в реальном приложении нужно сгенерировать свой
                        'BKxQzAkP6v5QK7LxYQH6t8m6gJvQK6QK6QK6QK6QK6QK6QK6QK6QK6QK6QK6QK6QK6QK6QK6QK6QK6QK6QK6QK6Q'
                    )
                });

                console.log('Push subscription created:', subscription);
            } else {
                console.log('Push subscription already exists:', subscription);
            }

            // Сохраняем подписку локально для тестирования
            localStorage.setItem('pushSubscription', JSON.stringify(subscription));

        } catch (error) {
            console.error('Error setting up push notifications:', error);
        }
    }

    // Вспомогательная функция для конвертации VAPID ключа
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

                if (this.notificationPermission === 'granted' &&
                    document.visibilityState === 'hidden') {
                    // Получаем данные отправителя
                    const { data: sender } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', message.sender_id)
                        .single();

                    if (sender) {
                        const notificationMessage = { ...message, sender };
                        this.showNotification(notificationMessage);
                    }
                }
            })
            .subscribe();

        this.messenger.realtimeSubscriptions.push(subscription);
    }

    showNotification(message) {
        if (!message.sender) return;

        // Проверяем, можем ли отправить push-уведомление
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            // Отправляем данные в service worker для push-уведомления
            navigator.serviceWorker.controller.postMessage({
                type: 'SHOW_NOTIFICATION',
                title: 'Новое сообщение в REonika',
                body: `${message.sender.username}: ${message.content || 'Голосовое/Изображение'}`,
                icon: message.sender.avatar_url || '/icon.png',
                tag: 'reonika-message',
                data: {
                    chatId: message.chat_id,
                    messageId: message.id
                }
            });
        } else {
            // Fallback для обычных уведомлений
            new Notification('Новое сообщение в REonika', {
                body: `${message.sender.username}: ${message.content || 'Голосовое/Изображение'}`,
                icon: message.sender.avatar_url || '/icon.png',
                tag: 'reonika-message'
            });
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const checkMessenger = () => {
        if (window.messenger) {
            window.notifications = new REonikaNotifications(window.messenger);
        } else {
            setTimeout(checkMessenger, 100);
        }
    };
    setTimeout(checkMessenger, 1000);
});
