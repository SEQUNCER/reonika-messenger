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
    }
    
    addMobileBackButton() {
        if (!document.getElementById('mobile-back-button')) {
            const chatHeader = document.getElementById('chat-header');
            if (chatHeader) {
                const backButton = document.createElement('button');
                backButton.id = 'mobile-back-button';
                backButton.className = 'mobile-back-button';
                backButton.innerHTML = '<i class="fas fa-arrow-left"></i>';
                backButton.title = 'Вернуться к чатам';
                
                chatHeader.insertBefore(backButton, chatHeader.firstChild);
                
                backButton.addEventListener('click', () => {
                    this.closeMobileChat();
                });
            }
        }
        
        this.addMobileBackButtonStyles();
    }
    
    closeMobileChat() {
        if (this.messenger.isMobile && this.messenger.currentChat) {
            const chatArea = document.getElementById('chat-area');
            if (chatArea) {
                chatArea.classList.remove('chat-active');
            }
            
            this.messenger.currentChat = null;
            this.messenger.updateChatUI();
            this.showChatsList();
            
            setTimeout(() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }, 100);
        }
    }
    
    showChatsList() {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            sidebar.style.display = 'block';
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
                    setTimeout(() => {
                        messageInput.focus();
                    }, 100);
                }
                if (sendBtn) sendBtn.disabled = false;
                
                const chatHeader = document.getElementById('chat-header');
                const chatInputContainer = document.getElementById('chat-input-container');
                const noChatSelected = document.querySelector('.no-chat-selected');
                const chatArea = document.getElementById('chat-area');
                
                if (chatHeader) chatHeader.style.display = 'flex';
                if (chatInputContainer) chatInputContainer.style.display = 'flex';
                if (noChatSelected) noChatSelected.style.display = 'none';
                if (this.isMobile && chatArea) {
                    chatArea.classList.add('chat-active');
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
                    padding-bottom: 100px !important;
                    box-sizing: border-box;
                }
                
                @media (max-width: 768px) {
                    .chat-messages {
                        padding-bottom: 120px !important;
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
                .mobile-back-button {
                    display: none !important;
                    align-items: center;
                    justify-content: center;
                    width: 40px;
                    height: 40px;
                    background: var(--primary-gray);
                    color: white;
                    border: none;
                    border-radius: 50%;
                    font-size: 18px;
                    cursor: pointer;
                    transition: all 0.3s;
                    margin-right: 12px;
                    flex-shrink: 0;
                }
                
                .mobile-back-button:hover {
                    background: var(--secondary-gray);
                    transform: scale(1.05);
                }
                
                @media (max-width: 768px) {
                    .chat-area.chat-active .mobile-back-button {
                        display: flex !important;
                    }
                    
                    .chat-header {
                        padding: 12px 16px;
                    }
                    
                    .btn-primary, .btn-icon, .chat-item {
                        min-height: 44px;
                        min-width: 44px;
                    }
                    
                    .btn-icon {
                        padding: 12px;
                    }
                    
                    .message-text {
                        font-size: 16px;
                        line-height: 1.6;
                    }
                    
                    #message-input {
                        font-size: 16px;
                    }
                    
                    .chat-messages {
                        -webkit-overflow-scrolling: touch;
                        overscroll-behavior: contain;
                    }
                }
                
                @media (max-width: 360px) {
                    .mobile-back-button {
                        width: 36px;
                        height: 36px;
                        font-size: 16px;
                        margin-right: 8px;
                    }
                    
                    .chat-partner-info h2 {
                        font-size: 18px;
                    }
                    
                    .chat-input-container {
                        padding: 10px;
                    }
                    
                    .chat-messages {
                        padding-bottom: 140px !important;
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
                        window.scrollTo(0, 0);
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
        }
    }
    
    handleSwipeRight() {
        if (this.messenger.currentChat && this.messenger.isMobile) {
            this.closeMobileChat();
            this.messenger.showNotification('Вернулись к чатам', 'info');
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
            
            const voiceRecordBtn = document.getElementById('voice-record-btn');
            if (voiceRecordBtn) {
                voiceRecordBtn.addEventListener('mousedown', () => {
                    if (window.mobileEnhancements) {
                        window.mobileEnhancements.startVoiceRecordingWithPermission();
                    } else {
                        window.messenger.startVoiceRecording();
                    }
                });
                
                voiceRecordBtn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    if (window.mobileEnhancements) {
                        window.mobileEnhancements.startVoiceRecordingWithPermission();
                    } else {
                        window.messenger.startVoiceRecording();
                    }
                });
            }
            
            console.log('Мобильные улучшения загружены и интегрированы');
        } else {
            setTimeout(checkMessenger, 100);
        }
    };
    
    setTimeout(checkMessenger, 1000);
});