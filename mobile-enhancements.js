// Мобильные улучшения для REonikaMessenger
class MobileREonikaEnhancements {
    constructor(messenger) {
        this.messenger = messenger;
        this.permissionsGranted = {
            microphone: false,
            camera: false,
            notifications: false
        };
        
        this.initMobileFeatures();
    }
    
    initMobileFeatures() {
        this.addMobileBackButton();
        this.requestPermissions();
        this.enhanceResponsiveness();
        this.addSwipeGestures();
        this.fixMessageScrolling();
        this.addMessageBottomPadding();
        this.fixKeyboardIssues();
    }
    
    addMobileBackButton() {
        if (!document.getElementById('mobile-back-button')) {
            const chatHeader = document.getElementById('chat-header');
            if (chatHeader) {
                const backButton = document.createElement('button');
                backButton.id = 'mobile-back-button';
                backButton.className = 'mobile-back-button';
                backButton.innerHTML = '<i class="fas fa-arrow-left"></i>';
                backButton.title = 'Назад к чатам';
                
                chatHeader.insertBefore(backButton, chatHeader.firstChild);
                
                backButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.closeMobileChat();
                });
            }
        }
        
        this.addMobileBackButtonStyles();
    }
    
    closeMobileChat() {
        if (this.messenger.isMobile && this.messenger.currentChat) {
            const chatArea = document.getElementById('chat-area');
            const sidebar = document.querySelector('.sidebar');
            
            if (chatArea) {
                chatArea.classList.remove('chat-active');
            }
            
            if (sidebar) {
                sidebar.style.display = 'block';
            }
            
            this.messenger.currentChat = null;
            this.messenger.updateChatUI();
            
            // Скрываем интерфейс чата
            const chatHeader = document.getElementById('chat-header');
            const chatInputContainer = document.getElementById('chat-input-container');
            const noChatSelected = document.querySelector('.no-chat-selected');
            const messagesContainer = document.getElementById('messages-container');
            
            if (chatHeader) chatHeader.style.display = 'none';
            if (chatInputContainer) chatInputContainer.style.display = 'none';
            if (noChatSelected) noChatSelected.style.display = 'flex';
            if (messagesContainer) messagesContainer.innerHTML = `
                <div class="no-chat-selected">
                    <i class="fas fa-comments"></i>
                    <p>Выберите чат для начала общения</p>
                </div>
            `;
            
            this.messenger.showNotification('Вернулись к списку чатов', 'info');
            
            setTimeout(() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }, 100);
        }
    }
    
    fixMessageScrolling() {
        const originalRenderMessages = this.messenger.renderMessages;
        const originalSelectChat = this.messenger.selectChat;
        
        this.messenger.renderMessages = function() {
            originalRenderMessages.call(this);
            
            setTimeout(() => {
                this.scrollToLastMessage();
            }, 100);
        }.bind(this.messenger);
        
        this.messenger.selectChat = async function(chat) {
            try {
                this.currentChat = chat;
                this.updateChatUI();
                
                await this.loadMessages(chat.id);
                
                await this.markMessagesAsRead(chat.id);
                
                const messageInput = document.getElementById('message-input');
                const sendBtn = document.getElementById('send-btn');
                
                if (messageInput) {
                    messageInput.disabled = false;
                    // НЕ фокусируем автоматически на мобильных
                    if (!this.isMobile) {
                        setTimeout(() => {
                            messageInput.focus();
                        }, 100);
                    }
                }
                if (sendBtn) sendBtn.disabled = false;
                
                const chatHeader = document.getElementById('chat-header');
                const chatInputContainer = document.getElementById('chat-input-container');
                const noChatSelected = document.querySelector('.no-chat-selected');
                const chatArea = document.getElementById('chat-area');
                const sidebar = document.querySelector('.sidebar');
                
                if (chatHeader) chatHeader.style.display = 'flex';
                if (chatInputContainer) chatInputContainer.style.display = 'flex';
                if (noChatSelected) noChatSelected.style.display = 'none';
                if (this.isMobile) {
                    if (chatArea) {
                        chatArea.classList.add('chat-active');
                    }
                    if (sidebar) {
                        sidebar.style.display = 'none';
                    }
                }
                
                this.hideSearchResults();
                
                setTimeout(() => {
                    this.scrollToLastMessage();
                }, 300);
                
            } catch (error) {
                console.error('Error selecting chat:', error);
                this.showNotification('Ошибка выбора чата', 'error');
            }
        }.bind(this.messenger);
        
        this.messenger.scrollToLastMessage = function() {
            const container = document.getElementById('messages-container');
            if (!container) return;
            
            const messages = container.querySelectorAll('.message');
            if (messages.length === 0) return;
            
            const lastMessage = messages[messages.length - 1];
            const inputContainer = document.getElementById('chat-input-container');
            
            let inputHeight = 0;
            if (inputContainer && inputContainer.style.display !== 'none') {
                inputHeight = inputContainer.offsetHeight;
            }
            
            const lastMessageBottom = lastMessage.offsetTop + lastMessage.offsetHeight;
            const containerHeight = container.clientHeight;
            const scrollPosition = Math.max(0, lastMessageBottom - containerHeight + inputHeight + 20);
            
            container.scrollTo({
                top: scrollPosition,
                behavior: 'smooth'
            });
        }.bind(this.messenger);
    }
    
    addMessageBottomPadding() {
        const styleId = 'message-bottom-padding';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                .chat-messages {
                    padding-bottom: 120px !important;
                    box-sizing: border-box;
                }
                
                @media (max-width: 768px) {
                    .chat-messages {
                        padding-bottom: 160px !important;
                    }
                }
                
                .no-chat-selected {
                    padding-bottom: 0 !important;
                }
                
                .message:last-child {
                    margin-bottom: 10px;
                }
                
                @keyframes fadeInUp {
                    from {
                        opacity: 0;
                        transform: translateY(10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                
                .message:last-child {
                    animation: fadeInUp 0.3s ease;
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    addMobileBackButtonStyles() {
        if (!document.getElementById('mobile-styles')) {
            const style = document.createElement('style');
            style.id = 'mobile-styles';
            style.textContent = `
                /* ... существующие стили ... */
                
                @media (max-width: 768px) {
                    .chat-input-container {
                        padding: 16px 24px !important;
                        gap: 12px !important;
                    }
                    
                    .chat-input-container .btn-icon {
                        width: 48px !important;
                        height: 48px !important;
                        padding: 12px !important;
                        margin: 0 4px !important;
                        border-radius: 12px !important;
                        border: 2px solid var(--border-gray) !important;
                        background: var(--white) !important;
                        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08) !important;
                    }
                    
                    .chat-input-container .btn-primary {
                        width: 48px !important;
                        height: 48px !important;
                        padding: 12px !important;
                        margin-left: 4px !important;
                        border-radius: 12px !important;
                        background: linear-gradient(135deg, var(--primary-gray), var(--secondary-gray)) !important;
                        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1) !important;
                    }
                    
                    #message-input {
                        padding: 14px 18px !important;
                        border-radius: 12px !important;
                        font-size: 16px !important;
                        border: 2px solid var(--border-gray) !important;
                        background: var(--white) !important;
                        margin: 0 4px !important;
                    }
                    
                    .nav-links {
                        gap: 16px !important;
                        padding-right: 12px !important;
                    }
                    
                    #logout-btn {
                        padding: 12px !important;
                        min-width: 48px !important;
                        min-height: 48px !important;
                        border-radius: 10px !important;
                        background: linear-gradient(135deg, #e53e3e, #f56565) !important;
                        color: white !important;
                        border: none !important;
                        margin-left: 4px !important;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    async requestPermissions() {
        if (!this.messenger.isMobile) return;
        
        try {
            await this.requestMicrophonePermission();
            await this.requestCameraPermission();
            await this.requestNotificationPermission();
        } catch (error) {
            console.log('Разрешения не запрошены:', error.message);
        }
    }
    
    async requestMicrophonePermission() {
        if (typeof navigator.mediaDevices === 'undefined' || 
            typeof navigator.mediaDevices.getUserMedia === 'undefined') {
            console.warn('MediaDevices API не поддерживается');
            return;
        }
        
        try {
            const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
            
            if (permissionStatus.state === 'granted') {
                this.permissionsGranted.microphone = true;
                console.log('Микрофон уже разрешен');
                return;
            }
            
            if (permissionStatus.state === 'denied') {
                console.log('Микрофон запрещен пользователем');
                this.showPermissionGuide('microphone');
                return;
            }
            
            console.log('Разрешение на микрофон будет запрошено при первой записи');
            
        } catch (error) {
            console.warn('Не удалось проверить разрешение микрофона:', error);
        }
    }
    
    async requestCameraPermission() {
        if (typeof navigator.mediaDevices === 'undefined' || 
            typeof navigator.mediaDevices.getUserMedia === 'undefined') {
            console.warn('MediaDevices API не поддерживается');
            return;
        }
        
        try {
            const permissionStatus = await navigator.permissions.query({ name: 'camera' });
            
            if (permissionStatus.state === 'granted') {
                this.permissionsGranted.camera = true;
                console.log('Камера уже разрешена');
                return;
            }
            
            if (permissionStatus.state === 'denied') {
                console.log('Камера запрещена пользователем');
                this.showPermissionGuide('camera');
                return;
            }
            
            console.log('Разрешение на камеру будет запрошено при первой загрузке фото');
            
        } catch (error) {
            console.warn('Не удалось проверить разрешение камеры:', error);
        }
    }
    
    async requestNotificationPermission() {
        if (!('Notification' in window)) {
            console.warn('Уведомления не поддерживаются');
            return;
        }
        
        if (Notification.permission === 'granted') {
            this.permissionsGranted.notifications = true;
            console.log('Уведомления уже разрешены');
            return;
        }
        
        if (Notification.permission === 'denied') {
            console.log('Уведомления запрещены пользователем');
            this.showPermissionGuide('notifications');
            return;
        }
        
        console.log('Разрешение на уведомления будет запрошено позже');
    }
    
    showPermissionGuide(permissionType) {
        if (!this.messenger.isMobile) return;
        
        const messages = {
            microphone: 'Для отправки голосовых сообщений разрешите доступ к микрофону в настройках браузера.',
            camera: 'Для отправки фото разрешите доступ к камере в настройках браузера.',
            notifications: 'Чтобы получать уведомления о новых сообщениях, разрешите их в настройках браузера.'
        };
        
        const guide = messages[permissionType];
        if (guide) {
            const storageKey = `permission_guide_${permissionType}_shown`;
            const lastShown = localStorage.getItem(storageKey);
            const today = new Date().toDateString();
            
            if (lastShown !== today) {
                this.messenger.showNotification(guide, 'info');
                localStorage.setItem(storageKey, today);
            }
        }
    }
    
    enhanceResponsiveness() {
        this.optimizeTouchElements();
        this.preventZoomOnInput();
        this.adjustViewport();
        this.fixInputScrolling();
    }
    
    optimizeTouchElements() {
        if (this.messenger.isMobile) {
            const style = document.createElement('style');
            style.textContent = `
                @media (max-width: 768px) {
                    .touch-target {
                        min-height: 44px;
                        min-width: 44px;
                        padding: 12px;
                    }
                    
                    .chat-item {
                        padding: 16px 12px;
                    }
                    
                    .chat-messages {
                        -webkit-overflow-scrolling: touch;
                    }
                    
                    .message:last-child {
                        margin-bottom: 20px;
                    }
                    
                    .btn-icon {
                        touch-action: manipulation;
                    }
                    
                    input, textarea {
                        font-size: 16px !important;
                    }
                    
                    /* Улучшаем отзывчивость кнопок */
                    button, .btn-primary, .btn-icon {
                        touch-action: manipulation;
                    }
                    
                    /* Предотвращаем выделение текста при быстром тапе */
                    * {
                        -webkit-tap-highlight-color: transparent;
                    }
                    
                    /* Улучшаем скроллинг */
                    .chat-messages, .chats-list {
                        scroll-behavior: smooth;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    preventZoomOnInput() {
        if (this.messenger.isMobile) {
            const inputs = document.querySelectorAll('input, textarea, select');
            inputs.forEach(input => {
                input.addEventListener('focus', () => {
                    // Предотвращаем автоматическое увеличение масштаба
                    setTimeout(() => {
                        document.body.style.zoom = "1.0";
                    }, 100);
                });
            });
        }
    }
    
    fixInputScrolling() {
        if (!this.messenger.isMobile) return;
        
        const messageInput = document.getElementById('message-input');
        if (messageInput) {
            messageInput.addEventListener('focus', () => {
                setTimeout(() => {
                    // Прокручиваем так, чтобы поле ввода было видно
                    const inputRect = messageInput.getBoundingClientRect();
                    const viewportHeight = window.innerHeight;
                    
                    if (inputRect.bottom > viewportHeight - 200) {
                        window.scrollTo({
                            top: window.scrollY + (inputRect.bottom - viewportHeight + 250),
                            behavior: 'smooth'
                        });
                    }
                    
                    // Также прокручиваем контейнер сообщений
                    const messagesContainer = document.getElementById('messages-container');
                    if (messagesContainer) {
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    }
                }, 300);
            });
        }
    }
    
    adjustViewport() {
        if (this.messenger.isMobile) {
            const viewport = document.querySelector('meta[name="viewport"]');
            if (viewport) {
                viewport.setAttribute('content', 
                    'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
            }
        }
    }
    
    fixKeyboardIssues() {
        if (!this.messenger.isMobile) return;
        
        // Отслеживаем изменения высоты viewport (когда появляется/скрывается клавиатура)
        let lastHeight = window.innerHeight;
        
        window.addEventListener('resize', () => {
            const newHeight = window.innerHeight;
            
            // Если высота уменьшилась (появилась клавиатура)
            if (newHeight < lastHeight) {
                setTimeout(() => {
                    const messageInput = document.getElementById('message-input');
                    if (messageInput && document.activeElement === messageInput) {
                        // Прокручиваем к полю ввода
                        messageInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        
                        // Добавляем отступ снизу для контейнера сообщений
                        const messagesContainer = document.getElementById('messages-container');
                        if (messagesContainer) {
                            messagesContainer.style.paddingBottom = '200px';
                        }
                    }
                }, 100);
            } 
            // Если высота увеличилась (скрылась клавиатура)
            else if (newHeight > lastHeight) {
                // Убираем дополнительный отступ
                const messagesContainer = document.getElementById('messages-container');
                if (messagesContainer) {
                    messagesContainer.style.paddingBottom = '';
                }
                
                // Прокручиваем к последнему сообщению
                setTimeout(() => {
                    this.messenger.scrollToLastMessage();
                }, 300);
            }
            
            lastHeight = newHeight;
        });
    }
    
    addSwipeGestures() {
        if (!this.messenger.isMobile) return;
        
        let startX, startY;
        const threshold = 50;
        const restraint = 100;
        
        document.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
            }
        }, { passive: true });
        
        document.addEventListener('touchend', (e) => {
            if (!startX || !startY || e.changedTouches.length !== 1) return;
            
            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            
            const diffX = startX - endX;
            const diffY = startY - endY;
            
            // Горизонтальный свайп
            if (Math.abs(diffX) > threshold && Math.abs(diffY) < restraint) {
                if (diffX > 0) {
                    this.handleSwipeLeft();
                } else {
                    this.handleSwipeRight();
                }
            }
            
            startX = null;
            startY = null;
        }, { passive: true });
    }
    
    handleSwipeLeft() {
        if (this.messenger.currentChat && this.messenger.isMobile) {
            console.log('Свайп влево в чате');
            // Можно добавить функциональность, например, показать меню действий
        }
    }
    
    handleSwipeRight() {
        if (this.messenger.currentChat && this.messenger.isMobile) {
            this.closeMobileChat();
        }
    }
    
    async ensureMicrophonePermission() {
        if (this.permissionsGranted.microphone) {
            return true;
        }
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            
            this.permissionsGranted.microphone = true;
            console.log('Разрешение на микрофон получено');
            return true;
            
        } catch (error) {
            console.error('Не удалось получить доступ к микрофону:', error);
            
            this.showPermissionGuide('microphone');
            
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                this.messenger.showNotification(
                    'Разрешите доступ к микрофону в настройках браузера для отправки голосовых сообщений',
                    'error'
                );
            }
            
            return false;
        }
    }
    
    async startVoiceRecordingWithPermission() {
        if (!this.messenger.isMobile) {
            this.messenger.startVoiceRecording();
            return;
        }
        
        // Проверяем, не записываем ли уже
        if (this.messenger.isRecording) {
            return;
        }
        
        const hasPermission = await this.ensureMicrophonePermission();
        
        if (hasPermission) {
            this.messenger.startVoiceRecording();
        }
    }
}



document.addEventListener('DOMContentLoaded', () => {
    const checkMessenger = () => {
        if (window.messenger) {
            window.mobileEnhancements = new MobileREonikaEnhancements(window.messenger);
            
            // Улучшенная отправка сообщений с корректной прокруткой
            const originalSendMessage = window.messenger.sendMessage;
            window.messenger.sendMessage = async function() {
                await originalSendMessage.call(this);
                
                setTimeout(() => {
                    if (window.messenger.scrollToLastMessage) {
                        window.messenger.scrollToLastMessage();
                    }
                }, 300);
            }.bind(window.messenger);
            
            // Исправленные обработчики для голосовых сообщений (без дублирования)
            const voiceRecordBtn = document.getElementById('voice-record-btn');
            if (voiceRecordBtn) {
                // Удаляем старые обработчики чтобы избежать дублирования
                const newVoiceBtn = voiceRecordBtn.cloneNode(true);
                voiceRecordBtn.parentNode.replaceChild(newVoiceBtn, voiceRecordBtn);
                
                // Добавляем новые обработчики
                newVoiceBtn.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (window.mobileEnhancements) {
                        window.mobileEnhancements.startVoiceRecordingWithPermission();
                    } else {
                        window.messenger.startVoiceRecording();
                    }
                });
                
                newVoiceBtn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (window.mobileEnhancements) {
                        window.mobileEnhancements.startVoiceRecordingWithPermission();
                    } else {
                        window.messenger.startVoiceRecording();
                    }
                });
                
                // Остановка записи
                document.addEventListener('mouseup', () => {
                    if (this.messenger.isRecording) {
                        this.messenger.stopVoiceRecording();
                    }
                });

                document.addEventListener('touchend', (e) => {
                    if (this.messenger.isRecording) {
                        e.preventDefault();
                        this.messenger.stopVoiceRecording();
                    }
                });
            }
            
            // Обработчик для поля ввода на мобильных устройствах
            const messageInput = document.getElementById('message-input');
            if (messageInput && window.messenger.isMobile) {
                messageInput.addEventListener('focus', () => {
                    // Не прокручиваем автоматически, только когда пользователь сам коснется
                    setTimeout(() => {
                        if (window.messenger.scrollToLastMessage) {
                            window.messenger.scrollToLastMessage();
                        }
                    }, 500);
                });
            }
            
            console.log('Мобильные улучшения загружены и интегрированы');
        } else {
            setTimeout(checkMessenger, 100);
        }
    };
    
    // Запускаем проверку с задержкой
    setTimeout(checkMessenger, 1000);
});