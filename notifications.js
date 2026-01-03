// notifications.js
import { messaging, getToken, onMessage } from './firebase-config.js';

class REonikaNotifications {
    constructor(messenger) {
        this.messenger = messenger;
        this.notificationPermission = 'default';
        this.fcmToken = null;
        this.init();
    }

    async init() {
        // Запрос разрешений на уведомления
        await this.requestPermission();

        // Инициализация Firebase Messaging
        await this.initFirebaseMessaging();

        // Настройка realtime подписок
        this.setupRealtime();
    }

    async requestPermission() {
        if (!('Notification' in window)) return;

        // Запрос разрешения на уведомления
        this.notificationPermission = await Notification.requestPermission();

        if (this.notificationPermission === 'granted') {
            console.log('Разрешение на уведомления получено');
        } else {
            console.log('Разрешение на уведомления отклонено');
        }
    }

    async initFirebaseMessaging() {
        try {
            // Получение FCM токена
            this.fcmToken = await getToken(messaging, {
                vapidKey: 'BGkgVqZM0y7uwlJ5RL3gleUfsYWzfzokSjrek3sCpC8KzwcAoXQwuNyp0R8Tfgf9rQjQn9CtIcfgrAcYpeAhDHI'
            });

            if (this.fcmToken) {
                console.log('FCM токен получен:', this.fcmToken);

                // Сохраняем токен в базе данных для пользователя
                await this.saveTokenToDatabase();

                // Обработка сообщений в foreground
                onMessage(messaging, (payload) => {
                    console.log('Сообщение в foreground:', payload);
                    this.showNotificationFromPayload(payload);
                });
            } else {
                console.log('Не удалось получить FCM токен');
            }
        } catch (error) {
            console.error('Ошибка инициализации FCM:', error);
        }
    }

    async saveTokenToDatabase() {
        if (!this.fcmToken || !this.messenger?.currentUser?.id) return;

        try {
            // Сохраняем токен в таблице user_fcm_tokens или profiles
            const { error } = await supabase
                .from('profiles')
                .update({ fcm_token: this.fcmToken })
                .eq('id', this.messenger.currentUser.id);

            if (error) {
                console.error('Ошибка сохранения FCM токена:', error);
            } else {
                console.log('FCM токен сохранен в базе данных');
            }
        } catch (error) {
            console.error('Ошибка сохранения токена:', error);
        }
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

                // Отправляем push-уведомление через Firebase
                await this.sendPushNotification(message);
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

            // Получаем список участников чата для отправки уведомлений
            const { data: chatMembers, error: membersError } = await supabase
                .from('chat_members')
                .select('user_id')
                .eq('chat_id', message.chat_id);

            if (membersError || !chatMembers) return;

            // Отправляем уведомления всем участникам чата, кроме отправителя
            const notificationPromises = chatMembers
                .filter(member => member.user_id !== message.sender_id)
                .map(async (member) => {
                    try {
                        // Вызываем Supabase Edge Function для отправки push-уведомления
                        const { data, error } = await supabase.functions.invoke('send-notification', {
                            body: {
                                receiver_id: member.user_id,
                                sender_id: message.sender_id,
                                message_content: message.content,
                                chat_id: message.chat_id
                            }
                        });

                        if (error) {
                            console.error('Ошибка вызова функции уведомлений:', error);
                        } else {
                            console.log('Push-уведомление отправлено:', data);
                        }
                    } catch (funcError) {
                        console.error('Ошибка отправки push-уведомления пользователю:', member.user_id, funcError);
                    }
                });

            await Promise.all(notificationPromises);

        } catch (error) {
            console.error('Ошибка отправки push-уведомлений:', error);
        }
    }

    showNotification(notificationData) {
        if (!notificationData) return;

        new Notification(notificationData.title, {
            body: notificationData.body,
            icon: notificationData.icon,
            badge: '/icon.png',
            tag: 'reonika-message',
            requireInteraction: true,
            data: notificationData.data || {}
        });
    }

    showNotificationFromPayload(payload) {
        const notification = payload.notification || {};
        const data = payload.data || {};

        this.showNotification({
            title: notification.title || 'Новое сообщение в REonika',
            body: notification.body || 'У вас новое сообщение',
            icon: notification.icon || '/icon.png',
            data: data
        });
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
