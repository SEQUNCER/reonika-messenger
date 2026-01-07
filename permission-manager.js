// permission-manager.js
class PermissionManager {
    constructor() {
        this.permissions = {
            notifications: 'default',
            microphone: 'default',
            camera: 'default',
            clipboard: 'default',
            geolocation: 'default',
            persistentStorage: 'default'
        };

        console.log('Permission Manager initialized');
    }

    async requestNotificationPermission() {
        if (!('Notification' in window)) {
            console.log('Notifications not supported');
            return { permission: 'unsupported', name: 'notifications' };
        }

        try {
            const permission = await Notification.requestPermission();
            this.permissions.notifications = permission;
            console.log(`Notification permission: ${permission}`);
            return { permission, name: 'notifications' };
        } catch (error) {
            console.error(`Error requesting notification permission: ${error.message}`);
            return { permission: 'error', name: 'notifications', error };
        }
    }

    async requestMicrophonePermission() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.log('Microphone not supported');
            return { permission: 'unsupported', name: 'microphone' };
        }

        try {
            let permissionState = 'prompt';

            if (navigator.permissions) {
                try {
                    const permission = await navigator.permissions.query({ name: 'microphone' });
                    permissionState = permission.state;
                    this.permissions.microphone = permission.state;
                } catch (permError) {
                    console.log(`Could not query microphone permission: ${permError.message}`);
                }
            }

            if (permissionState === 'prompt' || permissionState === 'default') {
                const constraints = {
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    },
                    video: false
                };

                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                stream.getTracks().forEach(track => track.stop());

                if (navigator.permissions) {
                    try {
                        const updatedPermission = await navigator.permissions.query({ name: 'microphone' });
                        this.permissions.microphone = updatedPermission.state;
                        console.log(`Microphone permission granted: ${updatedPermission.state}`);
                        return { permission: updatedPermission.state, name: 'microphone' };
                    } catch (updateError) {
                        console.log(`Could not update microphone permission status: ${updateError.message}`);
                    }
                }

                console.log('Microphone permission granted');
                return { permission: 'granted', name: 'microphone' };
            }

            return { permission: permissionState, name: 'microphone' };
        } catch (error) {
            console.error(`Error requesting microphone permission: ${error.message}`);

            if (error.name === 'NotAllowedError') {
                console.log('Microphone access denied by user');
            } else if (error.name === 'NotFoundError') {
                console.log('No microphone device found');
            } else if (error.name === 'NotReadableError') {
                console.log('Microphone is already in use by another application');
            }

            return { permission: 'denied', name: 'microphone', error };
        }
    }

    async requestEssentialPermissions() {
        console.log('Requesting essential permissions at startup...');

        const permissionPromises = [
            this.requestNotificationPermission(),
            this.requestMicrophonePermission()
        ];

        try {
            const results = await Promise.allSettled(permissionPromises);
            console.log('Essential permission request results:', results);
            return results;
        } catch (error) {
            console.error(`Error requesting essential permissions: ${error.message}`);
            return [];
        }
    }

    async checkNotificationSupport() {
        const hasServiceWorker = 'serviceWorker' in navigator;
        const hasPushManager = 'PushManager' in window;
        const hasNotification = 'Notification' in window;
        
        return {
            supported: hasServiceWorker && hasPushManager && hasNotification,
            serviceWorker: hasServiceWorker,
            pushManager: hasPushManager,
            notification: hasNotification
        };
    }

    async requestSpecificPermission(permissionName) {
        if (!permissionName) {
            throw new Error('Permission name is required');
        }

        switch (permissionName) {
            case 'notifications':
                return await this.requestNotificationPermission();
            case 'microphone':
                return await this.requestMicrophonePermission();
            default:
                throw new Error(`Unknown permission: ${permissionName}`);
        }
    }

    showPermissionGuide(permissionType, isMobile = false) {
        const messages = {
            notifications: {
                title: 'Разрешите уведомления',
                message: isMobile 
                    ? 'Для получения уведомлений о новых сообщениях, разрешите уведомления в настройках браузера и добавьте сайт на главный экран.'
                    : 'Для получения уведомлений о новых сообщениях, разрешите уведомления в настройках браузера.',
                icon: 'fa-bell'
            },
            microphone: {
                title: 'Разрешите доступ к микрофону',
                message: 'Для отправки голосовых сообщений разрешите доступ к микрофону в настройках браузера.',
                icon: 'fa-microphone'
            }
        };

        const guide = messages[permissionType];
        if (!guide) return;

        // Проверяем, не показывали ли это сообщение сегодня
        const storageKey = `permission_guide_${permissionType}_shown`;
        const lastShown = localStorage.getItem(storageKey);
        const today = new Date().toDateString();
        
        if (lastShown === today) return;

        // Создаем модальное окно с инструкцией
        const modal = document.createElement('div');
        modal.className = 'permission-guide-modal';
        modal.innerHTML = `
            <div class="permission-guide-content">
                <div class="permission-guide-icon">
                    <i class="fas ${guide.icon}"></i>
                </div>
                <h3>${guide.title}</h3>
                <p>${guide.message}</p>
                <div class="permission-guide-actions">
                    <button class="btn-primary" onclick="this.closest('.permission-guide-modal').remove()">
                        Понятно
                    </button>
                </div>
            </div>
        `;

        // Добавляем стили для модального окна
        if (!document.getElementById('permission-guide-styles')) {
            const styles = document.createElement('style');
            styles.id = 'permission-guide-styles';
            styles.textContent = `
                .permission-guide-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    animation: fadeIn 0.3s ease;
                }
                
                .permission-guide-content {
                    background: white;
                    border-radius: 12px;
                    padding: 30px;
                    max-width: 400px;
                    margin: 20px;
                    text-align: center;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                    animation: slideUp 0.3s ease;
                }
                
                .permission-guide-icon {
                    font-size: 48px;
                    color: #4a5568;
                    margin-bottom: 20px;
                }
                
                .permission-guide-content h3 {
                    margin: 0 0 15px 0;
                    color: #2d3748;
                }
                
                .permission-guide-content p {
                    margin: 0 0 25px 0;
                    color: #718096;
                    line-height: 1.5;
                }
                
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                
                @keyframes slideUp {
                    from { 
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to { 
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `;
            document.head.appendChild(styles);
        }

        document.body.appendChild(modal);
        
        // Сохраняем, что показали сегодня
        localStorage.setItem(storageKey, today);

        // Автоматически закрываем через 10 секунд
        setTimeout(() => {
            if (modal.parentNode) {
                modal.remove();
            }
        }, 10000);
    }

    async requestNotificationPermissionEnhanced() {
        // Проверяем поддержку
        const support = await this.checkNotificationSupport();
        if (!support.supported) {
            console.warn('Push-уведомления не поддерживаются');
            this.showPermissionGuide('notifications', /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
            return { permission: 'unsupported', name: 'notifications' };
        }

        // Если уже есть разрешение, возвращаем его
        if (Notification.permission === 'granted') {
            this.permissions.notifications = 'granted';
            return { permission: 'granted', name: 'notifications' };
        }

        // Если разрешение запрещено, показываем инструкцию
        if (Notification.permission === 'denied') {
            this.showPermissionGuide('notifications', /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
            return { permission: 'denied', name: 'notifications' };
        }

        // Запрашиваем разрешение
        try {
            const permission = await Notification.requestPermission();
            this.permissions.notifications = permission;
            
            if (permission === 'granted') {
                console.log('Разрешение на уведомления получено');
                // Показываем успешное уведомление
                if (window.messenger) {
                    window.messenger.showNotification('Уведомления включены!', 'success');
                }
            } else {
                this.showPermissionGuide('notifications', /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
            }
            
            return { permission, name: 'notifications' };
        } catch (error) {
            console.error('Error requesting notification permission:', error);
            return { permission: 'error', name: 'notifications', error };
        }
    }
}

// Инициализация менеджера разрешений
window.permissionManager = new PermissionManager();
console.log('Permission Manager initialized');

// Экспортируем класс для использования в других модулях
export { PermissionManager };
