// webview-integration.js - Интеграция с мобильными WebView и улучшения
class WebViewIntegration {
    constructor(messenger) {
        this.messenger = messenger;
        this.isWebView = this.detectWebView();
        this.platform = this.detectPlatform();
        this.nativeBridge = this.setupNativeBridge();
        this.init();
    }

    detectWebView() {
        const userAgent = navigator.userAgent.toLowerCase();
        
        // Проверки для WebView
        const isWebView = (
            // iOS WebView
            (/wv/.test(userAgent)) ||
            // Android WebView
            (/version\/[\d.]+.*mobile/.test(userAgent) && !/chrome/.test(userAgent)) ||
            // Общие признаки WebView
            window.webkit?.messageHandlers ||
            window.REonikaWebView ||
            window.AndroidWebView ||
            // Проверка на отсутствие некоторых API которые обычно есть в браузерах
            (!window.openDatabase && !window.indexedDB && !window.localStorage)
        );
        
        console.log('WebView detected:', isWebView);
        console.log('User Agent:', userAgent);
        
        return isWebView;
    }

    detectPlatform() {
        const userAgent = navigator.userAgent.toLowerCase();
        
        if (/iphone|ipad|ipod/.test(userAgent)) {
            return 'ios';
        } else if (/android/.test(userAgent)) {
            return 'android';
        } else if (/windows phone/.test(userAgent)) {
            return 'windows';
        } else {
            return 'web';
        }
    }

    setupNativeBridge() {
        const bridge = {
            // iOS WebView bridge
            ios: {
                available: !!window.webkit?.messageHandlers,
                postMessage: (name, data) => {
                    if (window.webkit?.messageHandlers[name]) {
                        try {
                            window.webkit.messageHandlers[name].postMessage(data);
                            return true;
                        } catch (error) {
                            console.error('iOS bridge error:', error);
                            return false;
                        }
                    }
                    return false;
                }
            },
            
            // Android WebView bridge
            android: {
                available: !!window.REonikaWebView || !!window.AndroidWebView,
                postMessage: (name, data) => {
                    try {
                        if (window.REonikaWebView && typeof window.REonikaWebView[name] === 'function') {
                            window.REonikaWebView[name](JSON.stringify(data));
                            return true;
                        } else if (window.AndroidWebView && typeof window.AndroidWebView[name] === 'function') {
                            window.AndroidWebView[name](JSON.stringify(data));
                            return true;
                        }
                        return false;
                    } catch (error) {
                        console.error('Android bridge error:', error);
                        return false;
                    }
                }
            }
        };
        
        return bridge;
    }

    init() {
        if (!this.isWebView) {
            console.log('Running in regular browser, WebView integration disabled');
            return;
        }

        console.log(`Initializing WebView integration for ${this.platform}`);
        
        // Настраиваем обработчики событий
        this.setupEventHandlers();
        
        // Настраиваем нативные уведомления
        this.setupNativeNotifications();
        
        // Настраиваем обработчики состояния приложения
        this.setupAppStateHandlers();
        
        // Оптимизируем интерфейс для WebView
        this.optimizeForWebView();
        
        // Настраиваем интеграцию с нативными функциями
        this.setupNativeFeatures();
    }

    setupEventHandlers() {
        // Обработка изменений видимости
        document.addEventListener('visibilitychange', () => {
            const state = document.visibilityState === 'visible' ? 'foreground' : 'background';
            this.notifyAppStateChange(state);
        });

        // Обработка фокуса/разфокуса
        window.addEventListener('focus', () => {
            this.notifyAppStateChange('foreground');
        });

        window.addEventListener('blur', () => {
            this.notifyAppStateChange('background');
        });

        // Обработка ориентации экрана
        window.addEventListener('orientationchange', () => {
            this.handleOrientationChange();
        });

        // Обработка сети
        window.addEventListener('online', () => {
            this.notifyNetworkChange('online');
        });

        window.addEventListener('offline', () => {
            this.notifyNetworkChange('offline');
        });
    }

    setupNativeNotifications() {
        if (!window.notifications) {
            console.warn('Notifications module not available');
            return;
        }

        // Переопределяем метод показа уведомлений для WebView
        const originalShowNotification = window.notifications.showNotification.bind(window.notifications);
        
        window.notifications.showNotification = (message) => {
            // Сначала пытаемся использовать нативные уведомления
            if (this.tryNativeNotification(message)) {
                return;
            }
            
            // Fallback на веб-уведомления
            originalShowNotification(message);
        };

        // Добавляем метод для нативных уведомлений
        window.notifications.showNativeNotification = (title, body, data = {}) => {
            this.sendNativeNotification(title, body, data);
        };
    }

    tryNativeNotification(message) {
        const title = 'Новое сообщение в REonika';
        const body = `${message.sender?.username}: ${message.content || 'Голосовое/Изображение'}`;
        const data = {
            chatId: message.chat_id,
            senderId: message.sender_id,
            type: 'new_message'
        };

        return this.sendNativeNotification(title, body, data);
    }

    sendNativeNotification(title, body, data) {
        if (this.platform === 'ios' && this.nativeBridge.ios.available) {
            return this.nativeBridge.ios.postMessage('showNotification', {
                title,
                body,
                data
            });
        } else if (this.platform === 'android' && this.nativeBridge.android.available) {
            return this.nativeBridge.android.postMessage('showNotification', {
                title,
                body,
                data
            });
        }
        
        return false;
    }

    setupAppStateHandlers() {
        // Уведомляем нативное приложение о состоянии
        this.notifyAppStateChange('foreground');
    }

    notifyAppStateChange(state) {
        console.log('App state changed:', state);
        
        if (this.platform === 'ios' && this.nativeBridge.ios.available) {
            this.nativeBridge.ios.postMessage('appStateChange', { state });
        } else if (this.platform === 'android' && this.nativeBridge.android.available) {
            this.nativeBridge.android.postMessage('appStateChange', { state });
        }
    }

    notifyNetworkChange(state) {
        console.log('Network state changed:', state);
        
        if (this.platform === 'ios' && this.nativeBridge.ios.available) {
            this.nativeBridge.ios.postMessage('networkChange', { state });
        } else if (this.platform === 'android' && this.nativeBridge.android.available) {
            this.nativeBridge.android.postMessage('networkChange', { state });
        }
    }

    handleOrientationChange() {
        const orientation = window.orientation || (window.innerWidth > window.innerHeight ? 'landscape' : 'portrait');
        console.log('Orientation changed:', orientation);
        
        // Обновляем CSS переменные для ориентации
        document.documentElement.style.setProperty('--app-orientation', orientation);
        
        // Уведомляем нативное приложение
        if (this.platform === 'ios' && this.nativeBridge.ios.available) {
            this.nativeBridge.ios.postMessage('orientationChange', { orientation });
        } else if (this.platform === 'android' && this.nativeBridge.android.available) {
            this.nativeBridge.android.postMessage('orientationChange', { orientation });
        }
    }

    optimizeForWebView() {
        // Добавляем CSS класс для WebView
        document.body.classList.add('webview');
        document.body.classList.add(`webview-${this.platform}`);

        // Создаем стили для WebView
        const style = document.createElement('style');
        style.textContent = `
            .webview {
                /* Оптимизации для WebView */
                -webkit-overflow-scrolling: touch;
                -webkit-transform: translateZ(0);
                transform: translateZ(0);
                backface-visibility: hidden;
                perspective: 1000px;
            }
            
            .webview-ios {
                /* Специфичные для iOS WebView */
                padding-top: env(safe-area-inset-top);
                padding-bottom: env(safe-area-inset-bottom);
                padding-left: env(safe-area-inset-left);
                padding-right: env(safe-area-inset-right);
            }
            
            .webview-android {
                /* Специфичные для Android WebView */
                overscroll-behavior: contain;
            }
            
            /* Улучшение производительности для WebView */
            .webview * {
                -webkit-tap-highlight-color: transparent;
                -webkit-touch-callout: none;
                -webkit-user-select: none;
                user-select: none;
            }
            
            .webview input,
            .webview textarea,
            .webview [contenteditable] {
                -webkit-user-select: text;
                user-select: text;
            }
            
            /* Предотвращение zoom на input */
            .webview input,
            .webview textarea,
            .webview select {
                font-size: 16px !important;
                transform-origin: left top;
                transform: scale(1);
            }
        `;
        document.head.appendChild(style);

        // Настраиваем viewport
        this.setupViewport();
    }

    setupViewport() {
        const viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
            const content = viewport.getAttribute('content');
            const newContent = this.platform === 'ios' 
                ? content + ', viewport-fit=cover'
                : content;
            
            viewport.setAttribute('content', newContent);
        }
    }

    setupNativeFeatures() {
        // Интеграция с нативными функциями
        
        // Камера
        this.setupNativeCamera();
        
        // Галерея
        this.setupNativeGallery();
        
        // Геолокация
        this.setupNativeGeolocation();
        
        // Вибрация
        this.setupNativeVibration();
        
        // Шеринг
        this.setupNativeSharing();
    }

    setupNativeCamera() {
        // Переопределение выбора фото для использования нативной камеры
        if (this.platform === 'android' && this.nativeBridge.android.available) {
            const imageUpload = document.getElementById('image-upload');
            if (imageUpload) {
                imageUpload.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.nativeBridge.android.postMessage('openCamera');
                });
            }
        }
    }

    setupNativeGallery() {
        // Интеграция с нативной галереей
        if (this.nativeBridge.android.available || this.nativeBridge.ios.available) {
            window.openNativeGallery = () => {
                if (this.platform === 'android') {
                    this.nativeBridge.android.postMessage('openGallery');
                } else {
                    this.nativeBridge.ios.postMessage('openGallery');
                }
            };
        }
    }

    setupNativeGeolocation() {
        // Использование нативной геолокации если доступна
        if (this.nativeBridge.android.available || this.nativeBridge.ios.available) {
            window.getNativeLocation = (callback) => {
                if (this.platform === 'android') {
                    this.nativeBridge.android.postMessage('getLocation');
                } else {
                    this.nativeBridge.ios.postMessage('getLocation');
                }
                
                // Ожидаем ответ от нативного кода
                window.onNativeLocation = callback;
            };
        }
    }

    setupNativeVibration() {
        // Нативная вибрация
        window.vibrateNative = (pattern) => {
            if (this.platform === 'android' && this.nativeBridge.android.available) {
                this.nativeBridge.android.postMessage('vibrate', { pattern });
            } else if ('vibrate' in navigator) {
                navigator.vibrate(pattern);
            }
        };
    }

    setupNativeSharing() {
        // Нативный шеринг
        window.shareNative = (title, text, url) => {
            if (this.platform === 'android' && this.nativeBridge.android.available) {
                return this.nativeBridge.android.postMessage('share', { title, text, url });
            } else if (this.platform === 'ios' && this.nativeBridge.ios.available) {
                return this.nativeBridge.ios.postMessage('share', { title, text, url });
            } else if ('share' in navigator) {
                return navigator.share({ title, text, url });
            }
            return Promise.resolve(false);
        };
    }

    // Метод для обработки сообщений от нативного кода
    handleNativeMessage(message) {
        console.log('Received native message:', message);
        
        switch (message.type) {
            case 'notificationTapped':
                this.handleNotificationTap(message.data);
                break;
            case 'appLaunched':
                this.handleAppLaunch(message.data);
                break;
            case 'cameraResult':
                this.handleCameraResult(message.data);
                break;
            case 'locationResult':
                this.handleLocationResult(message.data);
                break;
            default:
                console.warn('Unknown native message type:', message.type);
        }
    }

    handleNotificationTap(data) {
        // Обработка тапа на нативное уведомление
        if (this.messenger && data.chatId) {
            const chat = this.messenger.chats.find(c => c.id === data.chatId);
            if (chat) {
                this.messenger.selectChat(chat);
            }
        }
        
        // Фокусируемся на приложении
        window.focus();
    }

    handleAppLaunch(data) {
        // Обработка запуска приложения из нативного уведомления
        console.log('App launched with data:', data);
        
        // Обновляем данные при запуске
        if (this.messenger) {
            this.messenger.loadChats();
            if (this.messenger.currentChat) {
                this.messenger.loadMessages(this.messenger.currentChat.id);
            }
        }
    }

    handleCameraResult(data) {
        // Обработка результата с камеры
        if (data.imageData && this.messenger) {
            // Конвертируем base64 в blob и обрабатываем как фото
            const byteCharacters = atob(data.imageData);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'image/jpeg' });
            
            // Создаем файл и обрабатываем его
            const file = new File([blob], 'camera_photo.jpg', { type: 'image/jpeg' });
            const event = { target: { files: [file] } };
            this.messenger.handleImageSelect(event);
        }
    }

    handleLocationResult(data) {
        // Обработка результата геолокации
        if (window.onNativeLocation) {
            window.onNativeLocation(data);
        }
    }

    // Получение информации об устройстве
    getDeviceInfo() {
        return {
            isWebView: this.isWebView,
            platform: this.platform,
            userAgent: navigator.userAgent,
            nativeBridge: {
                ios: this.nativeBridge.ios.available,
                android: this.nativeBridge.android.available
            }
        };
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    const checkMessenger = () => {
        if (window.messenger) {
            window.webViewIntegration = new WebViewIntegration(window.messenger);
            
            // Добавляем глобальные методы для тестирования
            window.getWebViewInfo = () => {
                if (window.webViewIntegration) {
                    return window.webViewIntegration.getDeviceInfo();
                }
                return null;
            };
            
            // Устанавливаем глобальный обработчик для сообщений от нативного кода
            window.handleNativeMessage = (message) => {
                if (window.webViewIntegration) {
                    window.webViewIntegration.handleNativeMessage(message);
                }
            };
            
            console.log('WebView integration initialized');
            console.log('Use getWebViewInfo() to check WebView status');
        } else {
            setTimeout(checkMessenger, 100);
        }
    };
    setTimeout(checkMessenger, 1000);
});
