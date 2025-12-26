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
                table: 'messages',
                filter: `receiver_id=eq.${userId}`
            }, (payload) => {
                const message = payload.new;
                if (this.notificationPermission === 'granted' &&
                    document.visibilityState === 'hidden') {
                    this.showNotification(message);
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