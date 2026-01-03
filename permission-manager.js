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
        
        this.isFirstVisit = !localStorage.getItem('permissions_requested');
        this.init();
    }

    async init() {
        console.log('Permission Manager initialized');
        
        // Если это первый визит, запрашиваем все разрешения
        if (this.isFirstVisit) {
            await this.requestAllPermissions();
            localStorage.setItem('permissions_requested', 'true');
        }
    }

    async requestAllPermissions() {
        console.log('Requesting all permissions on first visit...');
        
        const permissionPromises = [
            this.requestNotificationPermission(),
            this.requestMicrophonePermission(),
            this.requestCameraPermission(),
            this.requestClipboardPermission(),
            this.requestGeolocationPermission(),
            this.requestPersistentStoragePermission()
        ];

        try {
            const results = await Promise.allSettled(permissionPromises);
            console.log('Permission request results:', results);
            
            // Показываем пользователю результаты
            this.showPermissionSummary(results);
            
        } catch (error) {
            console.error('Error requesting permissions:', error);
        }
    }

    async requestNotificationPermission() {
        if (!('Notification' in window)) {
            console.log('Notifications not supported');
            return { permission: 'unsupported', name: 'notifications' };
        }

        try {
            const permission = await Notification.requestPermission();
            this.permissions.notifications = permission;
            console.log('Notification permission:', permission);
            return { permission, name: 'notifications' };
        } catch (error) {
            console.error('Error requesting notification permission:', error);
            return { permission: 'error', name: 'notifications', error };
        }
    }

    async requestMicrophonePermission() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.log('Microphone not supported');
            return { permission: 'unsupported', name: 'microphone' };
        }

        try {
            // Сначала проверяем текущее состояние
            const permission = await navigator.permissions.query({ name: 'microphone' });
            this.permissions.microphone = permission.state;
            
            if (permission.state === 'prompt') {
                // Запрашиваем доступ только если нужно
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    audio: true,
                    video: false 
                });
                // Сразу закрываем поток после получения разрешения
                stream.getTracks().forEach(track => track.stop());
                console.log('Microphone permission granted');
            }
            
            return { permission: permission.state, name: 'microphone' };
        } catch (error) {
            console.error('Error requesting microphone permission:', error);
            return { permission: 'denied', name: 'microphone', error };
        }
    }

    async requestCameraPermission() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.log('Camera not supported');
            return { permission: 'unsupported', name: 'camera' };
        }

        try {
            const permission = await navigator.permissions.query({ name: 'camera' });
            this.permissions.camera = permission.state;
            
            if (permission.state === 'prompt') {
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    audio: false,
                    video: true 
                });
                stream.getTracks().forEach(track => track.stop());
                console.log('Camera permission granted');
            }
            
            return { permission: permission.state, name: 'camera' };
        } catch (error) {
            console.error('Error requesting camera permission:', error);
            return { permission: 'denied', name: 'camera', error };
        }
    }

    async requestClipboardPermission() {
        if (!navigator.permissions || !navigator.clipboard) {
            console.log('Clipboard API not supported');
            return { permission: 'unsupported', name: 'clipboard' };
        }

        try {
            // Проверяем поддержку Clipboard API
            if (navigator.clipboard && navigator.clipboard.readText) {
                const permission = await navigator.permissions.query({ name: 'clipboard-read' });
                this.permissions.clipboard = permission.state;
                return { permission: permission.state, name: 'clipboard' };
            }
            return { permission: 'unsupported', name: 'clipboard' };
        } catch (error) {
            console.error('Error requesting clipboard permission:', error);
            return { permission: 'error', name: 'clipboard', error };
        }
    }

    async requestGeolocationPermission() {
        if (!navigator.geolocation) {
            console.log('Geolocation not supported');
            return { permission: 'unsupported', name: 'geolocation' };
        }

        try {
            const permission = await navigator.permissions.query({ name: 'geolocation' });
            this.permissions.geolocation = permission.state;
            
            if (permission.state === 'prompt') {
                // Запрашиваем геолокацию для получения разрешения
                await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(
                        resolve, 
                        reject,
                        { timeout: 5000, enableHighAccuracy: false }
                    );
                });
                console.log('Geolocation permission granted');
            }
            
            return { permission: permission.state, name: 'geolocation' };
        } catch (error) {
            console.error('Error requesting geolocation permission:', error);
            return { permission: 'denied', name: 'geolocation', error };
        }
    }

    async requestPersistentStoragePermission() {
        if (!navigator.storage || !navigator.storage.persist) {
            console.log('Persistent storage not supported');
            return { permission: 'unsupported', name: 'persistentStorage' };
        }

        try {
            const isPersistent = await navigator.storage.persist();
            this.permissions.persistentStorage = isPersistent ? 'granted' : 'denied';
            console.log('Persistent storage permission:', isPersistent);
            return { permission: isPersistent ? 'granted' : 'denied', name: 'persistentStorage' };
        } catch (error) {
            console.error('Error requesting persistent storage permission:', error);
            return { permission: 'error', name: 'persistentStorage', error };
        }
    }

    showPermissionSummary(results) {
        const granted = results.filter(r => r.value.permission === 'granted').length;
        const denied = results.filter(r => r.value.permission === 'denied').length;
        const unsupported = results.filter(r => r.value.permission === 'unsupported').length;
        const errors = results.filter(r => r.value.permission === 'error').length;

        let message = `Настройки разрешений REonika:\n\n`;
        
        if (granted > 0) {
            message += `✅ Разрешено: ${granted}\n`;
        }
        
        if (denied > 0) {
            message += `❌ Запрещено: ${denied}\n`;
        }
        
        if (unsupported > 0) {
            message += `⚠️ Не поддерживается: ${unsupported}\n`;
        }
        
        if (errors > 0) {
            message += `⚠️ Ошибки: ${errors}\n`;
        }

        message += `\nВы можете изменить разрешения в настройках браузера в любой момент.`;

        // Показываем уведомление если есть хотя бы одно разрешение
        if (granted > 0 || denied > 0) {
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('REonika - Настройки разрешений', {
                    body: message,
                    icon: '/icon.png'
                });
            }
        }

        // Также показываем в консоли для отладки
        console.log(message);
        
        // Создаем модальное окно с результатами
        this.showPermissionModal(results);
    }

    showPermissionModal(results) {
        // Создаем модальное окно если его еще нет
        let modal = document.getElementById('permission-modal');
        
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'permission-modal';
            modal.className = 'permission-modal';
            modal.innerHTML = `
                <div class="permission-modal-overlay"></div>
                <div class="permission-modal-content">
                    <div class="permission-modal-header">
                        <h2>Настройки разрешений REonika</h2>
                        <button class="permission-modal-close">&times;</button>
                    </div>
                    <div class="permission-modal-body">
                        <p>REonika запросила следующие разрешения для полной функциональности:</p>
                        <div class="permission-list" id="permission-list"></div>
                        <div class="permission-info">
                            <h3>Зачем нужны эти разрешения?</h3>
                            <ul>
                                <li><strong>Уведомления:</strong> Для получения сообщений когда приложение свернуто</li>
                                <li><strong>Микрофон:</strong> Для отправки голосовых сообщений</li>
                                <li><strong>Камера:</strong> Для отправки фотографий и видеосообщений</li>
                                <li><strong>Буфер обмена:</strong> Для быстрой вставки текста и изображений</li>
                                <li><strong>Геолокация:</strong> Для определения местоположения (опционально)</li>
                                <li><strong>Постоянное хранилище:</strong> Для офлайн-работы приложения</li>
                            </ul>
                        </div>
                        <div class="permission-actions">
                            <button class="btn-primary permission-continue">Продолжить</button>
                            <button class="btn-secondary permission-settings">Настройки браузера</button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Добавляем обработчики событий
            const closeBtn = modal.querySelector('.permission-modal-close');
            const continueBtn = modal.querySelector('.permission-continue');
            const settingsBtn = modal.querySelector('.permission-settings');
            const overlay = modal.querySelector('.permission-modal-overlay');
            
            closeBtn.addEventListener('click', () => this.hidePermissionModal());
            continueBtn.addEventListener('click', () => this.hidePermissionModal());
            settingsBtn.addEventListener('click', () => this.openBrowserSettings());
            overlay.addEventListener('click', () => this.hidePermissionModal());
        }
        
        // Заполняем список разрешений
        const permissionList = modal.querySelector('#permission-list');
        permissionList.innerHTML = '';
        
        const permissionNames = {
            notifications: 'Уведомления',
            microphone: 'Микрофон',
            camera: 'Камера',
            clipboard: 'Буфер обмена',
            geolocation: 'Геолокация',
            persistentStorage: 'Постоянное хранилище'
        };
        
        results.forEach(result => {
            const { permission, name, error } = result.value;
            const permissionDiv = document.createElement('div');
            permissionDiv.className = `permission-item ${permission}`;
            
            let statusIcon = '';
            let statusText = '';
            
            switch (permission) {
                case 'granted':
                    statusIcon = '✅';
                    statusText = 'Разрешено';
                    break;
                case 'denied':
                    statusIcon = '❌';
                    statusText = 'Запрещено';
                    break;
                case 'unsupported':
                    statusIcon = '⚠️';
                    statusText = 'Не поддерживается';
                    break;
                case 'error':
                    statusIcon = '⚠️';
                    statusText = 'Ошибка';
                    break;
                default:
                    statusIcon = '❓';
                    statusText = 'Неизвестно';
            }
            
            permissionDiv.innerHTML = `
                <div class="permission-name">${permissionNames[name] || name}</div>
                <div class="permission-status">${statusIcon} ${statusText}</div>
                ${error ? `<div class="permission-error">${error.message}</div>` : ''}
            `;
            
            permissionList.appendChild(permissionDiv);
        });
        
        // Показываем модальное окно
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    hidePermissionModal() {
        const modal = document.getElementById('permission-modal');
        if (modal) {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        }
    }

    openBrowserSettings() {
        // Пытаемся открыть настройки браузера
        if (navigator.userAgent.includes('Chrome')) {
            window.open('chrome://settings/content/permissions', '_blank');
        } else if (navigator.userAgent.includes('Firefox')) {
            window.open('about:preferences#privacy', '_blank');
        } else if (navigator.userAgent.includes('Safari')) {
            window.open('x-apple.systempreferences:com.apple.preference.security?Privacy', '_blank');
        } else {
            // Общая инструкция
            alert('Чтобы изменить разрешения, зайдите в настройки вашего браузера:\n\n' +
                  'Chrome: chrome://settings/content/permissions\n' +
                  'Firefox: about:preferences#privacy\n' +
                  'Safari: Настройки → Конфиденциальность');
        }
    }

    // Метод для повторного запроса конкретного разрешения
    async requestSpecificPermission(permissionName) {
        switch (permissionName) {
            case 'notifications':
                return await this.requestNotificationPermission();
            case 'microphone':
                return await this.requestMicrophonePermission();
            case 'camera':
                return await this.requestCameraPermission();
            case 'clipboard':
                return await this.requestClipboardPermission();
            case 'geolocation':
                return await this.requestGeolocationPermission();
            case 'persistentStorage':
                return await this.requestPersistentStoragePermission();
            default:
                console.error('Unknown permission:', permissionName);
                return { permission: 'error', name: permissionName, error: new Error('Unknown permission') };
        }
    }

    // Метод для проверки текущего состояния разрешений
    async checkPermissionStatus(permissionName) {
        if (!navigator.permissions) {
            return 'unsupported';
        }
        
        try {
            const permission = await navigator.permissions.query({ name: permissionName });
            return permission.state;
        } catch (error) {
            console.error('Error checking permission status:', error);
            return 'error';
        }
    }
}

// Инициализация менеджера разрешений
document.addEventListener('DOMContentLoaded', () => {
    // Ждем загрузки основного приложения
    const initPermissionManager = () => {
        if (window.messenger || window.authRedirectManager) {
            window.permissionManager = new PermissionManager();
            console.log('Permission Manager initialized successfully');
        } else {
            setTimeout(initPermissionManager, 100);
        }
    };
    
    setTimeout(initPermissionManager, 1000);
});

// Экспортируем класс для использования в других модулях
export { PermissionManager };
