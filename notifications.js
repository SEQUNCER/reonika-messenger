// notifications.js - с поддержкой Push-уведомлений
class REonikaNotifications {
    constructor(messenger) {
        this.messenger = messenger;
        this.notificationPermission = 'default';
        this.notifications = [];
        this.unreadCount = 0;
        this.isVisible = false;
        this.pushSubscription = null;
        this.serviceWorkerRegistration = null;
        
        this.init();
    }

    async init() {
        await this.requestPermission();
        await this.registerServiceWorker();
        this.setupRealtime();
        this.setupUI();
        this.setupEventListeners();
        this.loadStoredNotifications();
    }

    async requestPermission() {
        if (!('Notification' in window)) {
            console.warn('Уведомления не поддерживаются в этом браузере');
            return;
        }
        
        if (Notification.permission === 'granted') {
            this.notificationPermission = 'granted';
            console.log('Разрешение на уведомления уже получено');
            return;
        }
        
        if (Notification.permission === 'denied') {
            this.notificationPermission = 'denied';
            console.log('Разрешение на уведомления отклонено');
            return;
        }
        
        // Запрашиваем разрешение при первой загрузке
        const permission = await Notification.requestPermission();
        this.notificationPermission = permission;
        console.log('Разрешение на уведомления:', permission);
    }

    async registerServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            console.warn('Service Worker не поддерживается');
            return;
        }

        try {
            this.serviceWorkerRegistration = await navigator.serviceWorker.register('service-worker.js', {
                scope: '/'
            });
            
            console.log('Service Worker зарегистрирован:', this.serviceWorkerRegistration);
            
            // Подписываемся на Push-уведомления
            await this.subscribeToPush();
            
        } catch (error) {
            console.error('Ошибка регистрации Service Worker:', error);
        }
    }

    async subscribeToPush() {
        if (!this.serviceWorkerRegistration) return;
        
        try {
            // Используем VAPID ключ (для демо используем публичный ключ)
            // В продакшене нужно использовать реальный VAPID ключ
            const vapidPublicKey = 'BLx3wUcFZ9y5VlO7xqT4a8bR6nM9pQ2sW1eY3hG5jK7iL0oP8uV4cF6dA2sE9gH3j';
            
            const subscription = await this.serviceWorkerRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey)
            });
            
            this.pushSubscription = subscription;
            console.log('Подписка на Push-уведомления создана:', subscription);
            
            // Сохраняем подписку в Supabase (нужно добавить таблицу для подписок)
            await this.savePushSubscription(subscription);
            
        } catch (error) {
            console.warn('Ошибка подписки на Push-уведомления:', error);
        }
    }

    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');
        
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    async savePushSubscription(subscription) {
        if (!this.messenger.currentUser) return;
        
        try {
            const { error } = await supabase
                .from('push_subscriptions')
                .upsert({
                    user_id: this.messenger.currentUser.id,
                    subscription: subscription,
                    created_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id'
                });
            
            if (error) {
                console.error('Ошибка сохранения подписки:', error);
            }
        } catch (error) {
            console.error('Ошибка сохранения подписки:', error);
        }
    }

    setupUI() {
        // Создаем контейнер если его нет
        if (!document.getElementById('notifications-container')) {
            const container = document.createElement('div');
            container.id = 'notifications-container';
            container.className = 'notifications-container';
            container.style.display = 'none';
            document.body.appendChild(container);
        }
        
        // Создаем кнопку если ее нет
        if (!document.getElementById('notifications-toggle')) {
            const navLinks = document.querySelector('.nav-links');
            if (navLinks) {
                const toggleBtn = document.createElement('button');
                toggleBtn.id = 'notifications-toggle';
                toggleBtn.className = 'notifications-toggle tooltip';
                toggleBtn.setAttribute('data-tooltip', 'Уведомления');
                toggleBtn.innerHTML = `
                    <i class="fas fa-bell"></i>
                    <span class="notifications-badge" id="notifications-badge" style="display: none;">0</span>
                `;
                navLinks.insertBefore(toggleBtn, navLinks.querySelector('.user-info'));
            }
        }
    }

    setupEventListeners() {
        const toggleBtn = document.getElementById('notifications-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleNotifications();
            });
        }
        
        // Закрываем уведомления при клике вне их
        document.addEventListener('click', (e) => {
            const container = document.getElementById('notifications-container');
            const toggleBtn = document.getElementById('notifications-toggle');
            
            if (container && container.style.display !== 'none' &&
                !container.contains(e.target) && 
                !toggleBtn.contains(e.target)) {
                this.hideNotifications();
            }
        });
    }

    setupRealtime() {
        if (!this.messenger || !this.messenger.currentUser) return;

        const userId = this.messenger.currentUser.id;
        
        // Подписка на новые сообщения
        const messagesSubscription = supabase
            .channel('user-messages')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages'
            }, async (payload) => {
                const message = payload.new;
                
                // Проверяем, адресовано ли сообщение текущему пользователю
                const chat = this.messenger.chats.find(c => c.id === message.chat_id);
                if (chat) {
                    const isForCurrentUser = chat.user1_id === userId || chat.user2_id === userId;
                    const isFromCurrentUser = message.sender_id === userId;
                    
                    if (isForCurrentUser && !isFromCurrentUser) {
                        // Получаем информацию об отправителе
                        const { data: sender } = await supabase
                            .from('profiles')
                            .select('username, avatar_url')
                            .eq('id', message.sender_id)
                            .single();
                        
                        if (sender) {
                            const notification = {
                                id: `msg_${message.id}`,
                                type: 'new_message',
                                title: 'Новое сообщение',
                                content: message.content || '📎 Вложение',
                                sender: sender,
                                chatId: message.chat_id,
                                messageId: message.id,
                                timestamp: new Date().toISOString(),
                                read: false
                            };
                            
                            this.addNotification(notification);
                            
                            // Проверяем, активно ли окно
                            const isPageActive = document.visibilityState === 'visible';
                            const isSameChat = this.messenger.currentChat && 
                                               this.messenger.currentChat.id === message.chat_id;
                            
                            // Всегда показываем push-уведомление, даже если страница активна
                            // Но если пользователь в том же чате, не показываем
                            if (!isSameChat) {
                                this.showPushNotification(notification);
                            }
                        }
                    }
                }
            })
            .subscribe();

        this.messenger.realtimeSubscriptions.push(messagesSubscription);
    }

    async showPushNotification(notification) {
        // Показываем браузерное уведомление
        if (this.notificationPermission === 'granted') {
            const options = {
                body: `${notification.sender?.username || 'Кто-то'}: ${notification.content}`,
                icon: notification.sender?.avatar_url || '/favicon.ico',
                badge: '/favicon.ico',
                vibrate: [100, 50, 100],
                data: {
                    url: '/',
                    chatId: notification.chatId,
                    messageId: notification.messageId
                },
                requireInteraction: true,
                actions: [
                    {
                        action: 'open',
                        title: 'Открыть чат'
                    },
                    {
                        action: 'dismiss',
                        title: 'Закрыть'
                    }
                ]
            };
            
            const pushNotification = new Notification(notification.title, options);
            
            pushNotification.onclick = (event) => {
                event.preventDefault();
                if (notification.chatId) {
                    this.openChat(notification.chatId);
                }
                window.focus();
                pushNotification.close();
            };
        }
        
        // Отправляем сообщение в Service Worker для показа уведомления
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'NEW_MESSAGE',
                title: notification.title,
                body: `${notification.sender?.username || 'Кто-то'}: ${notification.content}`,
                icon: notification.sender?.avatar_url || '/favicon.ico',
                chatId: notification.chatId
            });
        }
    }

    addNotification(notification) {
        this.notifications.unshift(notification);
        if (!notification.read) {
            this.unreadCount++;
            this.updateBadge();
        }
        
        this.saveNotifications();
        this.renderNotifications();
        
        // Автоудаление через 30 секунд
        setTimeout(() => {
            this.removeNotification(notification.id);
        }, 30000);
    }

    removeNotification(notificationId) {
        const index = this.notifications.findIndex(n => n.id === notificationId);
        if (index !== -1) {
            const notification = this.notifications[index];
            if (!notification.read) {
                this.unreadCount--;
                this.updateBadge();
            }
            
            const element = document.querySelector(`[data-notification-id="${notificationId}"]`);
            if (element) {
                element.classList.add('removing');
                setTimeout(() => {
                    this.notifications.splice(index, 1);
                    this.saveNotifications();
                    this.renderNotifications();
                }, 300);
            } else {
                this.notifications.splice(index, 1);
                this.saveNotifications();
                this.renderNotifications();
            }
        }
    }

    markAsRead(notificationId) {
        const notification = this.notifications.find(n => n.id === notificationId);
        if (notification && !notification.read) {
            notification.read = true;
            this.unreadCount--;
            this.updateBadge();
            this.saveNotifications();
            this.renderNotifications();
        }
    }

    markAllAsRead() {
        this.notifications.forEach(n => {
            if (!n.read) {
                n.read = true;
            }
        });
        this.unreadCount = 0;
        this.updateBadge();
        this.saveNotifications();
        this.renderNotifications();
    }

    updateBadge() {
        const badge = document.getElementById('notifications-badge');
        if (badge) {
            if (this.unreadCount > 0) {
                badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
                badge.style.display = 'block';
            } else {
                badge.style.display = 'none';
            }
        }
    }

    renderNotifications() {
        const container = document.getElementById('notifications-container');
        if (!container) return;

        if (this.notifications.length === 0) {
            container.innerHTML = `
                <div class="notification-item">
                    <div class="notification-title">
                        <i class="fas fa-bell-slash"></i>
                        Нет уведомлений
                    </div>
                    <div class="notification-content">
                        Здесь будут появляться уведомления о новых сообщениях
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="notification-header" style="margin: 0 0 10px 0; padding: 10px;">
                <div class="notification-title">
                    <i class="fas fa-bell"></i>
                    Уведомления
                    ${this.unreadCount > 0 ? `<span style="color: var(--error); font-size: 12px;">(${this.unreadCount} новых)</span>` : ''}
                </div>
                ${this.unreadCount > 0 ? `
                    <button id="mark-all-read" class="btn-icon" style="font-size: 12px; padding: 4px 8px;" title="Отметить все как прочитанные">
                        <i class="fas fa-check-double"></i>
                    </button>
                ` : ''}
            </div>
        `;

        this.notifications.slice(0, 10).forEach(notification => {
            const notificationElement = document.createElement('div');
            notificationElement.className = `notification-item ${notification.type} ${notification.read ? 'message-read' : 'new-message'}`;
            notificationElement.setAttribute('data-notification-id', notification.id);
            
            let content = notification.content;
            if (content.length > 50) {
                content = content.substring(0, 50) + '...';
            }
            
            let avatar = '';
            if (notification.sender && notification.sender.avatar_url) {
                avatar = `<img src="${notification.sender.avatar_url}" alt="${notification.sender.username}" class="notification-sender-avatar">`;
            } else {
                const initials = notification.sender?.username?.charAt(0).toUpperCase() || '?';
                avatar = `<div class="notification-sender-avatar" style="background: var(--primary-gray); color: white; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold;">${initials}</div>`;
            }
            
            notificationElement.innerHTML = `
                <div class="notification-header">
                    <div class="notification-title">
                        <i class="fas fa-${notification.type === 'new_message' ? 'comment' : 'bell'}"></i>
                        ${notification.title}
                    </div>
                    <div class="notification-time">${this.formatTime(notification.timestamp)}</div>
                </div>
                <div class="notification-content">${content}</div>
                ${notification.sender ? `
                    <div class="notification-sender">
                        ${avatar}
                        <span class="notification-sender-name">${notification.sender.username}</span>
                    </div>
                ` : ''}
                <div class="notification-actions">
                    ${notification.chatId ? `
                        <button class="notification-btn open" data-chat-id="${notification.chatId}">
                            <i class="fas fa-comment"></i> Перейти
                        </button>
                    ` : ''}
                    <button class="notification-btn dismiss" data-notification-id="${notification.id}">
                        <i class="fas fa-times"></i> Закрыть
                    </button>
                </div>
            `;
            
            container.appendChild(notificationElement);
            
            const openBtn = notificationElement.querySelector('.notification-btn.open');
            const dismissBtn = notificationElement.querySelector('.notification-btn.dismiss');
            
            if (openBtn) {
                openBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const chatId = openBtn.getAttribute('data-chat-id');
                    this.openChat(chatId);
                    this.markAsRead(notification.id);
                    this.hideNotifications();
                });
            }
            
            if (dismissBtn) {
                dismissBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const notificationId = dismissBtn.getAttribute('data-notification-id');
                    this.removeNotification(notificationId);
                });
            }
            
            notificationElement.addEventListener('click', (e) => {
                if (!e.target.closest('.notification-btn')) {
                    this.markAsRead(notification.id);
                    if (notification.chatId) {
                        this.openChat(notification.chatId);
                        this.hideNotifications();
                    }
                }
            });
        });

        const markAllBtn = container.querySelector('#mark-all-read');
        if (markAllBtn) {
            markAllBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.markAllAsRead();
            });
        }
    }

    openChat(chatId) {
        if (!this.messenger) return;
        
        const chat = this.messenger.chats.find(c => c.id === chatId);
        if (chat) {
            this.messenger.selectChat(chat);
        } else {
            this.messenger.loadChats().then(() => {
                const chat = this.messenger.chats.find(c => c.id === chatId);
                if (chat) {
                    this.messenger.selectChat(chat);
                } else {
                    this.messenger.showNotification('Чат не найден', 'error');
                }
            });
        }
    }

    toggleNotifications() {
        const container = document.getElementById('notifications-container');
        const toggleBtn = document.getElementById('notifications-toggle');
        
        if (container.style.display === 'none') {
            this.showNotifications();
        } else {
            this.hideNotifications();
        }
    }

    showNotifications() {
        const container = document.getElementById('notifications-container');
        const toggleBtn = document.getElementById('notifications-toggle');
        
        container.style.display = 'flex';
        toggleBtn.classList.add('active');
        this.isVisible = true;
        this.renderNotifications();
    }

    hideNotifications() {
        const container = document.getElementById('notifications-container');
        const toggleBtn = document.getElementById('notifications-toggle');
        
        container.style.display = 'none';
        toggleBtn.classList.remove('active');
        this.isVisible = false;
    }

    saveNotifications() {
        try {
            localStorage.setItem('reonika_notifications', JSON.stringify({
                notifications: this.notifications,
                unreadCount: this.unreadCount,
                lastUpdated: new Date().toISOString()
            }));
        } catch (e) {
            console.warn('Не удалось сохранить уведомления:', e);
        }
    }

    loadStoredNotifications() {
        try {
            const data = localStorage.getItem('reonika_notifications');
            if (data) {
                const parsed = JSON.parse(data);
                this.notifications = parsed.notifications || [];
                this.unreadCount = parsed.unreadCount || 0;
                this.updateBadge();
                
                const oneDayAgo = new Date();
                oneDayAgo.setDate(oneDayAgo.getDate() - 1);
                
                this.notifications = this.notifications.filter(n => {
                    const notificationDate = new Date(n.timestamp);
                    return notificationDate > oneDayAgo;
                });
                
                this.saveNotifications();
            }
        } catch (e) {
            console.warn('Не удалось загрузить уведомления:', e);
        }
    }

    formatTime(dateString) {
        try {
            const date = new Date(dateString);
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            
            if (diffMins < 1) return 'только что';
            if (diffMins < 60) return `${diffMins} мин назад`;
            
            const diffHours = Math.floor(diffMins / 60);
            if (diffHours < 24) return `${diffHours} ч назад`;
            
            return date.toLocaleDateString('ru-RU', { 
                day: 'numeric',
                month: 'short'
            });
        } catch (e) {
            return '';
        }
    }
}

// Интеграция с основным приложением
document.addEventListener('DOMContentLoaded', () => {
    // Регистрируем Service Worker сразу при загрузке
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js')
            .then(registration => {
                console.log('Service Worker зарегистрирован:', registration);
            })
            .catch(error => {
                console.log('Ошибка регистрации Service Worker:', error);
            });
    }
    
    const checkMessenger = () => {
        if (window.messenger) {
            window.notifications = new REonikaNotifications(window.messenger);
            
            window.messenger.showNotification = function(message, type = 'info') {
                const notification = {
                    id: `sys_${Date.now()}`,
                    type: type,
                    title: type === 'success' ? 'Успешно' : 
                           type === 'error' ? 'Ошибка' : 
                           type === 'warning' ? 'Предупреждение' : 'Информация',
                    content: message,
                    sender: null,
                    timestamp: new Date().toISOString(),
                    read: false
                };
                
                if (window.notifications) {
                    window.notifications.addNotification(notification);
                }
                
                const oldNotifications = document.querySelectorAll('.notification');
                oldNotifications.forEach(n => {
                    if (n.parentNode) {
                        n.remove();
                    }
                });
                
                const notificationElement = document.createElement('div');
                notificationElement.className = `notification ${type}`;
                notificationElement.innerHTML = `
                    <div class="notification-content">
                        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                        <span>${message}</span>
                    </div>
                `;
                
                document.body.appendChild(notificationElement);
                
                setTimeout(() => {
                    if (notificationElement.parentNode) {
                        notificationElement.remove();
                    }
                }, 3000);
            };
            
            console.log('Система уведомлений загружена и интегрирована');
        } else {
            setTimeout(checkMessenger, 100);
        }
    };
    
    setTimeout(checkMessenger, 1000);
});