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
        this.setupBackButton();
        this.requestPermissions();
        this.enhanceResponsiveness();
        this.addSwipeGestures();
        this.fixMessageScrolling();
        this.addMessageBottomPadding();
        this.fixKeyboardIssues();
    }
    
    setupBackButton() {
        // Используем существующую кнопку из HTML
        const backBtn = document.getElementById('mobile-back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeMobileChat();
            });
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
                sidebar.style.display = 'flex';
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
        
        this.messenger.renderMessages = function() {
            originalRenderMessages.call(this);
            
            setTimeout(() => {
                this.scrollToLastMessage();
            }, 100);
        }.bind(this.messenger);
        
        const originalSelectChat = this.messenger.selectChat;
        
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
                @media (max-width: 768px) {
                    .chat-input-container {
                        padding: 10px 12px !important;
                        gap: 8px !important;
                    }
                    
                    .chat-input-container .btn-icon {
                        width: 40px !important;
                        height: 40px !important;
                        padding: 8px !important;
                        margin: 0 2px !important;
                        border-radius: 50% !important;
                        border: 1px solid var(--border-gray) !important;
                        background: var(--white) !important;
                    }
                    
                    .chat-input-container .btn-primary {
                        width: 40px !important;
                        height: 40px !important;
                        padding: 8px !important;
                        margin-left: 2px !important;
                        border-radius: 50% !important;
                        background: linear-gradient(135deg, var(--primary-gray), var(--secondary-gray)) !important;
                    }
                    
                    #message-input {
                        padding: 10px 14px !important;
                        border-radius: 20px !important;
                        font-size: 16px !important;
                        border: 1px solid var(--border-gray) !important;
                        background: var(--white) !important;
                        margin: 0 2px !important;
                    }
                    
                    #logout-btn {
                        padding: 12px !important;
                        min-width: 44px !important;
                        min-height: 44px !important;
                        border-radius: 10px !important;
                        background: linear-gradient(135deg, #e53e3e, #c53030) !important;
                        color: white !important;
                        border: none !important;
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
    }
    
    optimizeTouchElements() {
        if (this.messenger.isMobile) {
            const style = document.createElement('style');
            style.textContent = `
                @media (max-width: 768px) {
                    .touch-target {
                        min-height: 44px;
                        min-width: 44px;
                    }
                    
                    .chat-item {
                        padding: 16px 12px;
                    }
                    
                    .chat-messages {
                        -webkit-overflow-scrolling: touch;
                    }
                    
                    .btn-icon {
                        touch-action: manipulation;
                    }
                    
                    input, textarea {
                        font-size: 16px !important;
                    }
                    
                    button, .btn-primary, .btn-icon {
                        touch-action: manipulation;
                    }
                    
                    * {
                        -webkit-tap-highlight-color: transparent;
                    }
                    
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
                    setTimeout(() => {
                        document.body.style.zoom = "1.0";
                    }, 100);
                });
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
        
        let lastHeight = window.innerHeight;
        let resizeTimeout;
        
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                const newHeight = window.innerHeight;
                const messageInput = document.getElementById('message-input');
                const messagesContainer = document.getElementById('messages-container');
                
                if (newHeight < lastHeight && messageInput && document.activeElement === messageInput) {
                    messageInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    if (messagesContainer) {
                        messagesContainer.style.paddingBottom = '200px';
                    }
                } else if (newHeight > lastHeight) {
                    if (messagesContainer) {
                        messagesContainer.style.paddingBottom = '';
                    }
                    setTimeout(() => {
                        this.messenger.scrollToLastMessage();
                    }, 300);
                }
                
                lastHeight = newHeight;
            }, 100);
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
            const diffY = Math.abs(startY - endY);
            
            if (Math.abs(diffX) > threshold && diffY < restraint) {
                if (diffX > 0) {
                    // Свайп влево
                } else {
                    this.closeMobileChat();
                }
            }
            
            startX = null;
            startY = null;
        }, { passive: true });
    }
    
    handleSwipeLeft() {
        // Можно добавить функциональность
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
                    'Разрешите доступ к микрофону в настройках браузера',
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
            
            const originalSendMessage = window.messenger.sendMessage;
            window.messenger.sendMessage = async function() {
                await originalSendMessage.call(this);
                
                setTimeout(() => {
                    if (window.messenger.scrollToLastMessage) {
                        window.messenger.scrollToLastMessage();
                    }
                }, 300);
            }.bind(window.messenger);
            
            console.log('Мобильные улучшения загружены');
        } else {
            setTimeout(checkMessenger, 100);
        }
    };
    
    setTimeout(checkMessenger, 500);
});