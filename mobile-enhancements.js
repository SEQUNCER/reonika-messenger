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
    
// В методе closeMobileChat() заменить:
closeMobileChat() {
    if (this.messenger.isMobile && this.messenger.currentChat) {
        const chatArea = document.getElementById('chat-area');
        const sidebar = document.querySelector('.sidebar');
        
        if (chatArea) {
            chatArea.classList.remove('chat-active');
            // Возвращаем нормальное позиционирование
            chatArea.style.position = '';
            chatArea.style.top = '';
            chatArea.style.left = '';
            chatArea.style.right = '';
            chatArea.style.bottom = '';
        }
        
        if (sidebar) {
            sidebar.style.display = 'block';
        }
        
        this.messenger.currentChat = null;
        this.messenger.updateChatUI();
        
        // Прокручиваем к началу
        setTimeout(() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 100);
    }
}

    // В методе addMobileBackButtonStyles() обновить:
    addMobileBackButtonStyles() {
        if (!document.getElementById('mobile-styles')) {
            const style = document.createElement('style');
            style.id = 'mobile-styles';
            style.textContent = `
                @media (max-width: 768px) {
                    /* Фиксированный чат только когда активен */
                    .chat-area {
                        position: relative;
                        height: auto;
                        min-height: 400px;
                        margin-bottom: 20px;
                        transform: none;
                    }
                    
                    .chat-area.chat-active {
                        position: fixed !important;
                        top: 0 !important;
                        left: 0 !important;
                        right: 0 !important;
                        bottom: 0 !important;
                        z-index: 1000 !important;
                        transform: translateX(0) !important;
                        border-radius: 0 !important;
                        margin: 0 !important;
                    }
                    
                    /* sidebar всегда виден кроме активного чата */
                    .chat-area.chat-active ~ .sidebar {
                        display: none !important;
                    }
                    
                    .sidebar {
                        display: block !important;
                        position: relative !important;
                        height: auto !important;
                        max-height: none !important;
                    }
                    
                    /* Контейнер ввода на фиксированной позиции только в активном чате */
                    .chat-area .chat-input-container {
                        position: relative;
                        padding: 16px;
                    }
                    
                    .chat-area.chat-active .chat-input-container {
                        position: fixed;
                        bottom: 0;
                        left: 0;
                        right: 0;
                        padding: 10px 12px;
                    }
                }
                
                @media (max-width: 360px) {
                    .chat-input-container {
                        gap: 6px;
                    }
                    
                    .chat-input-container input {
                        min-width: 0;
                        flex: 1 1 auto;
                    }
                    
                    /* Скрываем лишние кнопки на очень маленьких экранах */
                    label[for="image-upload"] {
                        display: none;
                    }
                }
            `;
            document.head.appendChild(style);
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
                .mobile-back-button {
                    display: none !important;
                    align-items: center;
                    justify-content: center;
                    width: 44px;
                    height: 44px;
                    background: var(--primary-gray) !important;
                    color: white !important;
                    border: 2px solid rgba(255, 255, 255, 0.2) !important;
                    border-radius: 50%;
                    font-size: 18px;
                    cursor: pointer;
                    transition: all 0.3s;
                    margin-right: 12px;
                    flex-shrink: 0;
                    z-index: 100;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
                    position: relative;
                }
                
                .mobile-back-button::after {
                    content: 'Назад к чатам';
                    position: absolute;
                    left: 50px;
                    top: 50%;
                    transform: translateY(-50%);
                    background: rgba(0, 0, 0, 0.8);
                    color: white;
                    padding: 6px 10px;
                    border-radius: 6px;
                    font-size: 12px;
                    white-space: nowrap;
                    opacity: 0;
                    pointer-events: none;
                    transition: opacity 0.3s;
                    z-index: 101;
                }
                
                .mobile-back-button:hover::after {
                    opacity: 1;
                }
                
                .mobile-back-button:hover {
                    background: var(--secondary-gray) !important;
                    transform: scale(1.05);
                    border-color: rgba(255, 255, 255, 0.4) !important;
                }
                
                .mobile-back-button:active {
                    transform: scale(0.95);
                }
                
                @media (max-width: 768px) {
                    .chat-area.chat-active .mobile-back-button {
                        display: flex !important;
                    }
                    
                    .chat-header {
                        padding: 12px 16px;
                        background: linear-gradient(135deg, var(--primary-gray), var(--secondary-gray)) !important;
                        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    }
                    
                    .chat-partner-info h2 {
                        color: white !important;
                        font-size: 18px;
                    }
                    
                    .status {
                        color: rgba(255, 255, 255, 0.8) !important;
                        font-size: 13px;
                    }
                    
                    .chat-partner-info .avatar {
                        border-color: white !important;
                    }
                    
                    #delete-chat-btn {
                        color: white !important;
                        opacity: 0.8;
                    }
                    
                    #delete-chat-btn:hover {
                        color: #ff6b6b !important;
                        opacity: 1;
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
                        padding-bottom: 180px !important;
                    }
                    
                    /* Стили для скрытия сайдбара при открытом чате */
                    .chat-area.chat-active ~ .sidebar {
                        display: none !important;
                    }
                    
                    /* Стили для отображения чата на весь экран */
                    .chat-area {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        z-index: 1000;
                        background: white;
                        transform: translateX(100%);
                        transition: transform 0.3s ease;
                    }
                    
                    .chat-area.chat-active {
                        transform: translateX(0);
                    }
                    
                    /* Поле ввода фиксировано внизу */
                    .chat-input-container {
                        position: fixed;
                        bottom: 0;
                        left: 0;
                        right: 0;
                        background: white;
                        border-top: 1px solid var(--lighter-gray);
                        padding: 12px 16px;
                        z-index: 1001;
                        box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
                    }
                }
                
                @media (max-width: 360px) {
                    .mobile-back-button {
                        width: 40px;
                        height: 40px;
                        font-size: 16px;
                        margin-right: 8px;
                    }
                    
                    .mobile-back-button::after {
                        display: none;
                    }
                    
                    .chat-partner-info h2 {
                        font-size: 16px;
                    }
                    
                    .chat-input-container {
                        padding: 10px;
                    }
                    
                    .chat-messages {
                        padding-bottom: 180px !important;
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
                    if (window.messenger.isRecording) {
                        window.messenger.stopVoiceRecording();
                    }
                });
                
                document.addEventListener('touchend', (e) => {
                    if (window.messenger.isRecording) {
                        e.preventDefault();
                        window.messenger.stopVoiceRecording();
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