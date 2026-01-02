// notifications.js
class REonikaNotifications {
    constructor(messenger) {
        this.messenger = messenger;
        this.notificationPermission = 'default';
        this.init();
    }

    async init() {
        await this.requestPermission();
        this.setupRealtime();
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

        new Notification('Новое сообщение в REonika', {
            body: `${message.sender.username}: ${message.content || 'Голосовое/Изображение'}`,
            icon: message.sender.avatar_url || '/default-icon.png'
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