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
        
        // Добавляем обработчик для обнаружения возврата из настроек
        this.setupVisibilityChangeListener();
    }

    // Настройка обработчика изменения видимости страницы
    setupVisibilityChangeListener() {
        // Отслеживаем когда страница становится видимой снова (возврат из настроек)
        document.addEventListener('visibilitychange', async () => {
            if (!document.hidden) {
                console.log('Page became visible, checking permissions...');
                await this.refreshPermissionModal();
            }
        });

        // Отслеживаем фокус окна
        window.addEventListener('focus', async () => {
            console.log('Window gained focus, checking permissions...');
            await this.refreshPermissionModal();
        });

        // Отслеживаем изменение размера окна (может указывать на возврат из настроек)
        let lastWidth = window.innerWidth;
        let lastHeight = window.innerHeight;
        
        window.addEventListener('resize', async () => {
            const currentWidth = window.innerWidth;
            const currentHeight = window.innerHeight;
            
            // Если размер изменился значительно, возможно пользователь вернулся из настроек
            if (Math.abs(currentWidth - lastWidth) > 100 || Math.abs(currentHeight - lastHeight) > 100) {
                console.log('Significant resize detected, checking permissions...');
                setTimeout(async () => {
                    await this.refreshPermissionModal();
                }, 500);
            }
            
            lastWidth = currentWidth;
            lastHeight = currentHeight;
        });
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
            // Для мобильных устройств используем более надежный способ запроса
            let permissionState = 'prompt';
            
            if (navigator.permissions) {
                try {
                    const permission = await navigator.permissions.query({ name: 'microphone' });
                    permissionState = permission.state;
                    this.permissions.microphone = permission.state;
                } catch (permError) {
                    console.warn('Could not query microphone permission:', permError);
                }
            }
            
            if (permissionState === 'prompt' || permissionState === 'default') {
                // Запрашиваем доступ с улучшенными параметрами для мобильных
                const constraints = {
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    },
                    video: false
                };
                
                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                
                // Сразу закрываем поток после получения разрешения
                stream.getTracks().forEach(track => track.stop());
                
                // Обновляем статус
                if (navigator.permissions) {
                    try {
                        const updatedPermission = await navigator.permissions.query({ name: 'microphone' });
                        this.permissions.microphone = updatedPermission.state;
                        console.log('Microphone permission granted:', updatedPermission.state);
                        return { permission: updatedPermission.state, name: 'microphone' };
                    } catch (updateError) {
                        console.warn('Could not update microphone permission status:', updateError);
                    }
                }
                
                console.log('Microphone permission granted');
                return { permission: 'granted', name: 'microphone' };
            }
            
            return { permission: permissionState, name: 'microphone' };
        } catch (error) {
            console.error('Error requesting microphone permission:', error);
            
            // Дополнительная информация об ошибке для мобильных
            if (error.name === 'NotAllowedError') {
                console.warn('Microphone access denied by user');
            } else if (error.name === 'NotFoundError') {
                console.warn('No microphone device found');
            } else if (error.name === 'NotReadableError') {
                console.warn('Microphone is already in use by another application');
            }
            
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
            message += `[+] Разрешено: ${granted}\n`;
        }
        
        if (denied > 0) {
            message += `[-] Запрещено: ${denied}\n`;
        }
        
        if (unsupported > 0) {
            message += `[!] Не поддерживается: ${unsupported}\n`;
        }
        
        if (errors > 0) {
            message += `[!] Ошибки: ${errors}\n`;
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
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Добавляем обработчики событий
            const closeBtn = modal.querySelector('.permission-modal-close');
            const continueBtn = modal.querySelector('.permission-continue');
            const overlay = modal.querySelector('.permission-modal-overlay');
            
            closeBtn.addEventListener('click', () => this.hidePermissionModal());
            continueBtn.addEventListener('click', () => this.hidePermissionModal());
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
                    statusIcon = '[+]';
                    statusText = 'Разрешено';
                    break;
                case 'denied':
                    statusIcon = '[-]';
                    statusText = 'Запрещено';
                    break;
                case 'unsupported':
                    statusIcon = '[!]';
                    statusText = 'Не поддерживается';
                    break;
                case 'error':
                    statusIcon = '[!]';
                    statusText = 'Ошибка';
                    break;
                default:
                    statusIcon = '[?]';
                    statusText = 'Неизвестно';
            }
            
            // Добавляем возможность повторного запроса для запрещенных разрешений
            const isClickable = (permission === 'denied' || permission === 'prompt');
            const clickableClass = isClickable ? 'permission-clickable' : '';
            
            permissionDiv.innerHTML = `
                <div class="permission-name ${clickableClass}" data-permission="${name}">${permissionNames[name] || name}</div>
                <div class="permission-status">${statusIcon} ${statusText}</div>
                ${error ? `<div class="permission-error">${error.message}</div>` : ''}
                ${isClickable ? `<div class="permission-hint">Нажмите для повторного запроса</div>` : ''}
            `;
            
            permissionList.appendChild(permissionDiv);
        });
        
        // Добавляем обработчики для кликабельных разрешений
        const clickablePermissions = modal.querySelectorAll('.permission-clickable');
        clickablePermissions.forEach(element => {
            element.addEventListener('click', async (e) => {
                const permissionName = e.target.getAttribute('data-permission');
                if (permissionName) {
                    await this.rerequestPermission(permissionName);
                }
            });
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
        // Убираем эту функцию так как кнопка настроек удалена
        console.log('Browser settings button removed');
    }

    // Метод для повторного запроса конкретного разрешения
    async rerequestPermission(permissionName) {
        console.log(`Re-requesting permission: ${permissionName}`);
        
        try {
            const result = await this.requestSpecificPermission(permissionName);
            console.log(`Re-request result for ${permissionName}:`, result);
            
            // Показываем уведомление о результате
            this.showPermissionUpdateNotification(permissionName, result);
            
            // Обновляем модальное окно с актуальной информацией
            await this.refreshPermissionModal();
            
        } catch (error) {
            console.error(`Error re-requesting ${permissionName}:`, error);
            this.showPermissionUpdateNotification(permissionName, { permission: 'error', error });
        }
    }

    // Показать уведомление об обновлении разрешения
    showPermissionUpdateNotification(permissionName, result) {
        const permissionNames = {
            notifications: 'Уведомления',
            microphone: 'Микрофон',
            camera: 'Камера',
            clipboard: 'Буфер обмена',
            geolocation: 'Геолокация',
            persistentStorage: 'Постоянное хранилище'
        };
        
        const name = permissionNames[permissionName] || permissionName;
        let message = '';
        
        switch (result.permission) {
            case 'granted':
                message = `[+] Разрешение "${name}" предоставлено`;
                break;
            case 'denied':
                message = `[-] Разрешение "${name}" запрещено`;
                break;
            case 'error':
                message = `[!] Ошибка при запросе разрешения "${name}"`;
                break;
            default:
                message = `[?] Статус разрешения "${name}" изменен`;
        }
        
        console.log(message);
        
        // Показываем системное уведомление если разрешено
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('REonika - Обновление разрешений', {
                body: message,
                icon: '/icon.png'
            });
        }
    }

    // Обновить модальное окно с актуальной информацией
    async refreshPermissionModal() {
        // Проверяем все разрешения заново
        const permissionPromises = [
            this.checkPermissionStatus('notifications'),
            this.checkPermissionStatus('microphone'),
            this.checkPermissionStatus('camera'),
            this.checkPermissionStatus('clipboard'),
            this.checkPermissionStatus('geolocation'),
            this.checkPermissionStatus('persistentStorage')
        ];

        try {
            const results = await Promise.allSettled(permissionPromises);
            
            // Форматируем результаты для showPermissionModal
            const formattedResults = results.map((result, index) => {
                const permissionNames = ['notifications', 'microphone', 'camera', 'clipboard', 'geolocation', 'persistentStorage'];
                const name = permissionNames[index];
                return {
                    value: {
                        permission: result.value || 'error',
                        name: name
                    }
                };
            });
            
            // Обновляем модальное окно
            this.updatePermissionModalContent(formattedResults);
            
        } catch (error) {
            console.error('Error refreshing permission modal:', error);
        }
    }

    // Обновить содержимое модального окна
    updatePermissionModalContent(results) {
        const modal = document.getElementById('permission-modal');
        if (!modal) return;
        
        const permissionList = modal.querySelector('#permission-list');
        if (!permissionList) return;
        
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
            const { permission, name } = result.value;
            const permissionDiv = document.createElement('div');
            permissionDiv.className = `permission-item ${permission}`;
            
            let statusIcon = '';
            let statusText = '';
            
            switch (permission) {
                case 'granted':
                    statusIcon = '[+]';
                    statusText = 'Разрешено';
                    break;
                case 'denied':
                    statusIcon = '[-]';
                    statusText = 'Запрещено';
                    break;
                case 'unsupported':
                    statusIcon = '[!]';
                    statusText = 'Не поддерживается';
                    break;
                case 'error':
                    statusIcon = '[!]';
                    statusText = 'Ошибка';
                    break;
                default:
                    statusIcon = '[?]';
                    statusText = 'Неизвестно';
            }
            
            // Добавляем возможность повторного запроса для запрещенных разрешений
            const isClickable = (permission === 'denied' || permission === 'prompt');
            const clickableClass = isClickable ? 'permission-clickable' : '';
            
            permissionDiv.innerHTML = `
                <div class="permission-name ${clickableClass}" data-permission="${name}">${permissionNames[name] || name}</div>
                <div class="permission-status">${statusIcon} ${statusText}</div>
                ${isClickable ? `<div class="permission-hint">Нажмите для повторного запроса</div>` : ''}
            `;
            
            permissionList.appendChild(permissionDiv);
        });
        
        // Добавляем обработчики для кликабельных разрешений
        const clickablePermissions = modal.querySelectorAll('.permission-clickable');
        clickablePermissions.forEach(element => {
            element.addEventListener('click', async (e) => {
                const permissionName = e.target.getAttribute('data-permission');
                if (permissionName) {
                    await this.rerequestPermission(permissionName);
                }
            });
        });
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
