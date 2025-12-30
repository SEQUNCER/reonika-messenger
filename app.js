import { supabase } from './supabase.js';

class REonikaMessenger {

   
    async startVoiceRecording() {
        try {
            
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                this.showNotification('Микрофон не поддерживается в этом браузере', 'error');
                return;
            }
            
            
            const permission = await navigator.permissions.query({ name: 'microphone' });
            if (permission.state === 'denied') {
                this.showNotification('Разрешите доступ к микрофону в настройках приложения', 'error');
                return;
            }
            
            
            
        } catch (error) {
            console.error('Microphone error:', error);
            this.showNotification('Ошибка доступа к микрофону', 'error');
        }
    }

    constructor() {
        this.currentUser = null;
        this.currentChat = null;
        this.chats = [];
        this.messages = [];
        this.onlineUsers = new Set();
        this.voiceMessages = new Map();
        
        this.currentImageFile = null;
        this.imagePreviewUrl = null;
        this.voiceRecordingTimeout = null;        
        this.searchTimeout = null;
        this.updateInterval = null;
        this.realtimeSubscriptions = [];
        this.isMobile = window.innerWidth <= 768;
        this.isSessionRestored = false; 
        
        
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.recordingStartTime = null;
        this.recordingTimer = null;
        this.currentAudio = null;
        
        this.initEventListeners();
        this.initAuthStateListener(); 
        this.autoLogin(); 
        
        window.addEventListener('resize', () => {
            this.isMobile = window.innerWidth <= 768;
            this.updateChatUI();
        });
        
        
        this.startAutoCleanup();


        
        
        setTimeout(() => {
            if (window.notifications) {
                console.log('Уведомления интегрированы');
            }
        }, 500);

        setTimeout(() => {
            if (window.mobileEnhancements) {
                console.log('Мобильные улучшения интегрированы');
            }
        }, 500);
    }

    
    initAuthStateListener() {
        supabase.auth.onAuthStateChange((event, session) => {
            console.log('Auth state changed:', event, session);
            
            switch (event) {
                case 'SIGNED_IN':
                    console.log('User signed in!');
                    if (!this.isSessionRestored) {
                        this.handleUserSignIn(session.user);
                    }
                    break;
                    
                case 'TOKEN_REFRESHED':
                    console.log('Token refreshed');
                    if (this.currentUser && this.currentUser.id === session?.user?.id) {
                        this.updateOnlineStatus(true);
                    }
                    break;
                    
                case 'SIGNED_OUT':
                    console.log('User signed out!');
                    this.handleUserSignOut();
                    break;
                    
                case 'USER_UPDATED':
                    console.log('User updated');
                    if (session?.user) {
                        this.currentUser = session.user;
                        this.updateUserUI();
                    }
                    break;
                    
                case 'INITIAL_SESSION':
                    console.log('Initial session restored');
                    this.isSessionRestored = true;
                    if (session?.user) {
                        this.handleUserSignIn(session.user);
                    }
                    break;
                    
                case 'USER_DELETED':
                    console.log('User deleted');
                    this.handleUserSignOut();
                    break;
            }
        });
    }

    
    async autoLogin() {
        try {
            console.log('Attempting auto login...');
            
            
            this.showLoading(true);
            
            
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            
            if (sessionError) {
                console.error('Session error:', sessionError);
                this.showLoading(false);
                this.showAuthScreen();
                return;
            }
            
            if (session) {
                console.log('Found existing session');
                
                const { data: { user }, error: userError } = await supabase.auth.getUser();
                
                if (userError) {
                    console.error('User error:', userError);
                    this.showLoading(false);
                    this.showAuthScreen();
                    return;
                }
                
                if (user) {
                    console.log('User found, auto login successful');
                    this.isSessionRestored = true;
                    await this.handleUserSignIn(user);
                    this.showLoading(false);
                    return;
                }
            }
            
            
            console.log('No session found, showing auth screen');
            this.showLoading(false);
            this.showAuthScreen();
            
        } catch (error) {
            console.error('Auto login error:', error);
            this.showLoading(false);
            this.showAuthScreen();
        }
    }

    async handleUserSignIn(user) {
        try {
            this.currentUser = user;
            
            await this.loadUserProfile();
            
            this.showMainScreen();
            this.showChatsScreen();
            
            this.setupRealtime();
            
            await this.updateOnlineStatus(true);
            
            this.updateUserUI();
            this.updateProfileUI();
            
            await this.loadChats();
            
            console.log('User signed in successfully:', user.email);
            
        } catch (error) {
            console.error('Error handling user sign in:', error);
            this.showNotification('Ошибка загрузки данных пользователя', 'error');
            await this.logout();
        }
    }

    async handleUserSignOut() {
        try {
            this.realtimeSubscriptions.forEach(subscription => {
                supabase.removeChannel(subscription);
            });
            this.realtimeSubscriptions = [];
            
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
                this.updateInterval = null;
            }
            
            this.currentUser = null;
            this.currentChat = null;
            this.chats = [];
            this.messages = [];
            this.onlineUsers.clear();
            this.isSessionRestored = false;
            
            this.voiceMessages.clear();
            
            this.showAuthScreen();
            
            console.log('User signed out successfully');
            
        } catch (error) {
            console.error('Error handling user sign out:', error);
        }
    }

    showLoading(show) {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            if (show) {
                loadingOverlay.classList.remove('hidden');
            } else {
                loadingOverlay.classList.add('hidden');
            }
        }
    }

    initEventListeners() {
        const showRegisterBtn = document.getElementById('show-register');
        if (showRegisterBtn) {
            showRegisterBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showRegisterForm();
            });
        }

        const showLoginBtn = document.getElementById('show-login');
        if (showLoginBtn) {
            showLoginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showLoginForm();
            });
        }

        const loginBtn = document.getElementById('login-btn');
        if (loginBtn) loginBtn.addEventListener('click', () => this.login());
        
        const registerBtn = document.getElementById('register-btn');
        if (registerBtn) registerBtn.addEventListener('click', () => this.register());
        
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) logoutBtn.addEventListener('click', () => this.logout());

        const navChatsBtn = document.getElementById('nav-chats-btn');
        if (navChatsBtn) {
            navChatsBtn.addEventListener('click', () => this.showChatsScreen());
        }
        
        const navProfileBtn = document.getElementById('nav-profile-btn');
        if (navProfileBtn) {
            navProfileBtn.addEventListener('click', () => this.showProfileScreen());
        }

        const deleteChatBtn = document.getElementById('delete-chat-btn');
        if (deleteChatBtn) {
            deleteChatBtn.addEventListener('click', () => this.deleteChat());
        }

        const searchUserBtn = document.getElementById('search-user-btn');
        if (searchUserBtn) {
            searchUserBtn.addEventListener('click', () => this.searchUser());
        }
        
        const userSearch = document.getElementById('user-search');
        if (userSearch) {
            userSearch.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.searchUser();
            });
            
            userSearch.addEventListener('input', (e) => {
                const searchText = e.target.value.trim();
                if (searchText.length >= 2) {
                    this.debouncedSearch(searchText);
                } else {
                    this.hideSearchResults();
                }
            });
            
            userSearch.addEventListener('input', () => {
                if (!userSearch.value.trim()) {
                    this.hideSearchResults();
                }
            });
        }

        const sendBtn = document.getElementById('send-btn');
        if (sendBtn) sendBtn.addEventListener('click', () => this.sendMessage());
        
        const messageInput = document.getElementById('message-input');
        if (messageInput) {
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
            
            if (this.isMobile) {
                messageInput.addEventListener('focus', () => {
                    setTimeout(() => {
                        this.scrollToLastMessage();
                    }, 300);
                });
            }
        }

        const imageUpload = document.getElementById('image-upload');
        if (imageUpload) {
            imageUpload.addEventListener('change', (e) => this.handleImageSelect(e));
        }
        
        const profileAvatarUpload = document.getElementById('profile-avatar-upload');
        if (profileAvatarUpload) {
            profileAvatarUpload.addEventListener('change', (e) => this.uploadProfileAvatar(e));
        }

        const saveProfileBtn = document.getElementById('save-profile-btn');
        if (saveProfileBtn) {
            saveProfileBtn.addEventListener('click', () => this.saveProfile());
        }
        
        const changePasswordBtn = document.getElementById('change-password-btn');
        if (changePasswordBtn) {
            changePasswordBtn.addEventListener('click', () => this.changePassword());
        }

        const deleteAccountBtn = document.getElementById('delete-account-btn');
        if (deleteAccountBtn) {
            deleteAccountBtn.addEventListener('click', () => this.showDeleteAccountConfirm());
        }

        const voiceRecordBtn = document.getElementById('voice-record-btn');
        if (voiceRecordBtn) {
            voiceRecordBtn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.startVoiceRecording();
            });
            
            voiceRecordBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.startVoiceRecording();
            });
            
            document.addEventListener('mouseup', () => {
                if (this.isRecording) {
                    this.stopVoiceRecording();
                }
            });
            
            document.addEventListener('touchend', (e) => {
                if (this.isRecording) {
                    e.preventDefault();
                    this.stopVoiceRecording();
                }
            });
        }

        const confirmModalCancel = document.getElementById('confirm-modal-cancel');
        if (confirmModalCancel) {
            confirmModalCancel.addEventListener('click', () => this.hideConfirmModal());
        }
        
        const confirmModalConfirm = document.getElementById('confirm-modal-confirm');
        if (confirmModalConfirm) {
            confirmModalConfirm.addEventListener('click', () => this.handleConfirmAction());
        }
        
        document.addEventListener('click', (e) => {
            const searchResults = document.getElementById('search-results');
            const userSearch = document.getElementById('user-search');
            
            if (searchResults && userSearch && 
                !searchResults.contains(e.target) && 
                !userSearch.contains(e.target)) {
                this.hideSearchResults();
            }
        });

        window.addEventListener('focus', () => this.updateOnlineStatus(true));
        window.addEventListener('blur', () => this.updateOnlineStatus(false));
        document.addEventListener('visibilitychange', () => {
            this.updateOnlineStatus(document.visibilityState === 'visible');
        });
    }

    closeMobileChat() {
        if (this.isMobile && this.currentChat) {
            const chatArea = document.getElementById('chat-area');
            if (chatArea) {
                chatArea.classList.remove('chat-active');
            }
            
            const sidebar = document.querySelector('.sidebar');
            if (sidebar) {
                sidebar.style.display = 'block';
            }
            
            this.currentChat = null;
            this.updateChatUI();
            
            this.showChatsList();
        }
    }
    
    showChatsList() {
        const sidebar = document.querySelector('.sidebar');
        const chatArea = document.getElementById('chat-area');
        
        if (this.isMobile) {
            if (sidebar) {
                sidebar.style.display = 'block';
            }
            if (chatArea) {
                chatArea.classList.remove('chat-active');
            }
        }
    }

    debouncedSearch(searchText) {
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }
        
        this.searchTimeout = setTimeout(() => {
            this.autoSearchUsers(searchText);
        }, 300);
    }

    async autoSearchUsers(searchText) {
        if (!searchText || searchText.length < 2 || !this.currentUser) {
            this.hideSearchResults();
            return;
        }

        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .or(`username.ilike.%${searchText}%,email.ilike.%${searchText}%`)
                .neq('id', this.currentUser.id)
                .limit(10);

            if (error) {
                console.error('Auto search error:', error);
                return;
            }

            if (data && data.length > 0) {
                this.showSearchResults(data);
            } else {
                this.hideSearchResults();
            }
            
        } catch (error) {
            console.error('Auto search exception:', error);
        }
    }

    setupRealtime() {
        this.realtimeSubscriptions.forEach(subscription => {
            supabase.removeChannel(subscription);
        });
        this.realtimeSubscriptions = [];

        const messagesChannel = supabase
            .channel('messages')
            .on('postgres_changes', 
                { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'messages' 
                }, 
                async (payload) => {
                    if (this.currentChat && payload.new.chat_id === this.currentChat.id) {
                        if (payload.new.sender_id === this.currentUser?.id) {
                            return;
                        }
                        
                        const { data: sender } = await supabase
                            .from('profiles')
                            .select('*')
                            .eq('id', payload.new.sender_id)
                            .single();
                        
                        const newMessage = {
                            ...payload.new,
                            sender: sender
                        };
                        
                        this.messages.push(newMessage);
                        this.renderMessages();
                        this.scrollToLastMessage();
                        
                        await this.markMessagesAsRead(this.currentChat.id);
                    }
                    this.loadChats(); 
                }
            )
            .subscribe();

   
    }

    async updateOnlineStatus(isOnline) {
        if (!this.currentUser || !this.realtimeSubscriptions[3]) return;
        
        try {
            await this.realtimeSubscriptions[3].track({
                user_id: this.currentUser.id,
                online_at: new Date().toISOString(),
                last_seen: new Date().toISOString(),
                is_online: isOnline
            });
        } catch (error) {
            console.error('Error updating online status:', error);
        }
    }

    updateOnlineStatusUI() {
        if (!this.currentChat) return;
        
        const partner = this.currentChat.user1_id === this.currentUser?.id 
            ? this.currentChat.user2 
            : this.currentChat.user1;
        
        if (!partner) return;
        
        const statusElement = document.getElementById('chat-partner-status');
        if (statusElement) {
            const isOnline = this.onlineUsers.has(partner.id);
            statusElement.innerHTML = `<i class="fas fa-circle"></i> <span>${isOnline ? 'в сети' : 'не в сети'}</span>`;
            statusElement.style.color = isOnline ? '#48bb78' : '#718096';
        }
    }

    async checkAuth() {
        try {
            const { data: { user }, error } = await supabase.auth.getUser();
            if (error) {
                console.error('Auth error:', error);
                return;
            }
            
            if (user) {
                this.currentUser = user;
                await this.loadUserProfile();
                this.showMainScreen();
                this.showChatsScreen();
                this.setupRealtime();
                this.updateOnlineStatus(true);
            }
        } catch (error) {
            console.error('Check auth error:', error);
        }
    }

    showRegisterForm() {
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');
        if (loginForm) loginForm.classList.add('hidden');
        if (registerForm) registerForm.classList.remove('hidden');
    }

    showLoginForm() {
        const registerForm = document.getElementById('register-form');
        const loginForm = document.getElementById('login-form');
        if (registerForm) registerForm.classList.add('hidden');
        if (loginForm) loginForm.classList.remove('hidden');
    }

    async login() {
        const emailInput = document.getElementById('login-email');
        const passwordInput = document.getElementById('login-password');
        
        const email = emailInput ? emailInput.value.trim() : '';
        const password = passwordInput ? passwordInput.value : '';

        if (!email || !password) {
            this.showNotification('Введите email и пароль', 'error');
            return;
        }

        try {
            this.showLoading(true);
            
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                console.error('Login error:', error);
                this.showLoading(false);
                
                if (error.message.includes('Invalid login credentials')) {
                    this.showNotification('Неверный email или пароль', 'error');
                } else if (error.message.includes('Email not confirmed')) {
                    this.showNotification('Email не подтвержден', 'error');
                } else {
                    this.showNotification(error.message, 'error');
                }
                return;
            }

            
            if (emailInput) emailInput.value = '';
            if (passwordInput) passwordInput.value = '';
            
            this.showNotification('Вход выполнен успешно', 'success');
            
        } catch (error) {
            console.error('Login exception:', error);
            this.showLoading(false);
            this.showNotification('Ошибка входа', 'error');
        }
    }

    async register() {
        const usernameInput = document.getElementById('register-username');
        const emailInput = document.getElementById('register-email');
        const passwordInput = document.getElementById('register-password');
        
        const username = usernameInput ? usernameInput.value.trim() : '';
        const email = emailInput ? emailInput.value.trim() : '';
        const password = passwordInput ? passwordInput.value : '';

        if (!username || !email || !password) {
            this.showNotification('Заполните все поля', 'error');
            return;
        }

        if (password.length < 6) {
            this.showNotification('Пароль должен быть не менее 6 символов', 'error');
            return;
        }

        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        username: username
                    }
                }
            });

            if (error) {
                console.error('Register error:', error);
                if (error.message.includes('already registered')) {
                    this.showNotification('Этот email уже зарегистрирован', 'error');
                } else if (error.message.includes('invalid email')) {
                    this.showNotification('Неверный формат email', 'error');
                } else {
                    this.showNotification(error.message, 'error');
                }
                return;
            }

            this.showNotification('Регистрация успешна! Теперь войдите в систему.', 'success');
            this.showLoginForm();
            
            if (usernameInput) usernameInput.value = '';
            if (emailInput) emailInput.value = '';
            if (passwordInput) passwordInput.value = '';
            
        } catch (error) {
            console.error('Register exception:', error);
            this.showNotification('Ошибка регистрации', 'error');
        }
    }

    async logout() {
        try {
            await this.updateOnlineStatus(false);
            
            const { error } = await supabase.auth.signOut();
            
            if (error) {
                console.error('Logout error:', error);
                this.showNotification('Ошибка выхода из системы', 'error');
                return;
            }
            
            this.showNotification('Вы вышли из системы', 'success');
            
            
        } catch (error) {
            console.error('Logout exception:', error);
            this.showNotification('Ошибка выхода из системы', 'error');
        }
    }

    async loadUserProfile() {
        if (!this.currentUser) return;

        try {
            let { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', this.currentUser.id)
                .single();

            if (error && error.code === 'PGRST116') {
                const username = this.currentUser.user_metadata?.username || 
                               this.currentUser.email?.split('@')[0] || 'Пользователь';
                
                const { data: newProfile, error: createError } = await supabase
                    .from('profiles')
                    .insert([
                        {
                            id: this.currentUser.id,
                            username: username,
                            email: this.currentUser.email,
                            avatar_url: null,
                            status: 'Привет! Я использую REonika',
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        }
                    ])
                    .select()
                    .single();

                if (createError) {
                    console.error('Error creating profile:', createError);
                    return;
                }
                
                data = newProfile;
            } else if (error) {
                console.error('Error loading profile:', error);
                return;
            }

            if (data) {
                this.currentUser.profile = data;
                this.updateUserUI();
                this.updateProfileUI();
                await this.loadChats();
            }
        } catch (error) {
            console.error('Load profile error:', error);
        }
    }

    showChatsScreen() {
        const chatsScreen = document.getElementById('chats-screen');
        const profileScreen = document.getElementById('profile-screen');
        const navChatsBtn = document.getElementById('nav-chats-btn');
        const navProfileBtn = document.getElementById('nav-profile-btn');
        
        if (chatsScreen) chatsScreen.classList.remove('hidden');
        if (profileScreen) profileScreen.classList.add('hidden');
        if (navChatsBtn) navChatsBtn.classList.add('active');
        if (navProfileBtn) navProfileBtn.classList.remove('active');
        
        if (this.isMobile) {
            this.showChatsList();
        }
    }
    
    showProfileScreen() {
        const chatsScreen = document.getElementById('chats-screen');
        const profileScreen = document.getElementById('profile-screen');
        const navChatsBtn = document.getElementById('nav-chats-btn');
        const navProfileBtn = document.getElementById('nav-profile-btn');
        
        if (chatsScreen) chatsScreen.classList.add('hidden');
        if (profileScreen) profileScreen.classList.remove('hidden');
        if (navChatsBtn) navChatsBtn.classList.remove('active');
        if (navProfileBtn) navProfileBtn.classList.add('active');
        
        this.updateProfileUI();
    }

    async searchUser() {
        const searchInput = document.getElementById('user-search');
        if (!searchInput || !this.currentUser) return;
        
        const searchText = searchInput.value.trim();
        if (!searchText) {
            this.showNotification('Введите имя пользователя или email', 'error');
            return;
        }

        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .or(`username.ilike.%${searchText}%,email.ilike.%${searchText}%`)
                .neq('id', this.currentUser.id)
                .limit(10);

            if (error) {
                console.error('Search error:', error);
                this.showNotification('Ошибка поиска', 'error');
                return;
            }

            if (!data || data.length === 0) {
                this.showNotification('Пользователь не найден', 'error');
                this.hideSearchResults();
                return;
            }

            if (data.length === 1) {
                const user = data[0];
                const existingChat = await this.findChatWithUser(user.id);
                
                if (existingChat) {
                    this.selectChat(existingChat);
                } else {
                    await this.createChat(user.id);
                }
                
                searchInput.value = '';
                this.hideSearchResults();
            } else {
                this.showSearchResults(data);
            }
            
        } catch (error) {
            console.error('Search exception:', error);
            this.showNotification('Ошибка поиска', 'error');
        }
    }

    showSearchResults(users) {
        const container = document.getElementById('search-results');
        if (!container) return;

        container.innerHTML = '';
        
        users.forEach(user => {
            const userElement = document.createElement('div');
            userElement.className = 'search-result-item';
            
            const avatar = user.avatar_url || 
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=4a5568&color=fff`;
            
            userElement.innerHTML = `
                <img src="${avatar}" alt="${user.username}" class="avatar">
                <div class="search-result-info">
                    <div class="search-result-name">${user.username}</div>
                    <div class="search-result-email">${user.email}</div>
                    <div class="search-result-status ${this.onlineUsers.has(user.id) ? 'online' : 'offline'}">
                        ${this.onlineUsers.has(user.id) ? '🟢 онлайн' : '⚫ не в сети'}
                    </div>
                </div>
                <div class="search-result-action">
                    <button class="btn-icon start-chat-btn" data-user-id="${user.id}" title="Начать чат">
                        <i class="fas fa-comment"></i>
                    </button>
                </div>
            `;
            
            const chatBtn = userElement.querySelector('.start-chat-btn');
            chatBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const userId = chatBtn.getAttribute('data-user-id');
                const existingChat = await this.findChatWithUser(userId);
                
                if (existingChat) {
                    this.selectChat(existingChat);
                } else {
                    await this.createChat(userId);
                }
                
                const searchInput = document.getElementById('user-search');
                if (searchInput) searchInput.value = '';
                
                this.hideSearchResults();
            });
            
            container.appendChild(userElement);
        });
        
        container.style.display = 'block';
    }

    hideSearchResults() {
        const container = document.getElementById('search-results');
        if (container) {
            container.style.display = 'none';
        }
    }

    async findChatWithUser(otherUserId) {
        if (!this.currentUser) return null;
        
        try {
            const { data, error } = await supabase
                .from('chats')
                .select('*, user1:profiles!chats_user1_id_fkey(*), user2:profiles!chats_user2_id_fkey(*)')
                .or(`and(user1_id.eq.${this.currentUser.id},user2_id.eq.${otherUserId}),and(user1_id.eq.${otherUserId},user2_id.eq.${this.currentUser.id})`)
                .is('is_deleted', false)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('Error finding chat:', error);
            }

            return data;
        } catch (error) {
            console.error('Find chat exception:', error);
            return null;
        }
    }

    async createChat(otherUserId) {
        if (!this.currentUser) return;

        try {
            console.log('Creating chat with user:', otherUserId);

            const { data, error } = await supabase
                .from('chats')
                .insert([
                    {
                        user1_id: this.currentUser.id,
                        user2_id: otherUserId,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }
                ])
                .select('*, user1:profiles!chats_user1_id_fkey(*), user2:profiles!chats_user2_id_fkey(*)')
                .single();

            if (error) {
                console.error('Create chat error details:', error);
                
                if (error.code === '23505') {
                    const existingChat = await this.findChatWithUser(otherUserId);
                    if (existingChat) {
                        this.selectChat(existingChat);
                        this.showNotification('Чат уже существует', 'info');
                        return;
                    }
                }
                
                this.showNotification('Ошибка создания чата', 'error');
                return;
            }

            console.log('Chat created:', data);
            await this.loadChats();
            this.selectChat(data);
            this.showNotification('Чат создан', 'success');
            
        } catch (error) {
            console.error('Create chat exception:', error);
            this.showNotification('Ошибка создания чата', 'error');
        }
    }

    async loadChats() {
        if (!this.currentUser) return;

        try {
            const { data, error } = await supabase
                .from('chats')
                .select('*, user1:profiles!chats_user1_id_fkey(*), user2:profiles!chats_user2_id_fkey(*)')
                .or(`user1_id.eq.${this.currentUser.id},user2_id.eq.${this.currentUser.id}`)
                .is('is_deleted', false)
                .order('updated_at', { ascending: false });

            if (error) {
                console.error('Error loading chats:', error);
                return;
            }

            const chatsWithLastMessage = await Promise.all(
                data.map(async (chat) => {
                    try {
                        const { data: lastMessage } = await supabase
                            .from('messages')
                            .select('content, created_at, image_url, voice_url, sender_id, expires_at')
                            .eq('chat_id', chat.id)
                            .is('is_deleted', false)
                            .gt('expires_at', new Date().toISOString()) 
                            .order('created_at', { ascending: false })
                            .limit(1)
                            .single();

                        let lastMessageText = 'Нет сообщений';
                        if (lastMessage) {
                            if (lastMessage.image_url) {
                                lastMessageText = '🖼️ Изображение';
                            } else if (lastMessage.voice_url) {
                                lastMessageText = '🎤 Голосовое сообщение';
                            } else if (lastMessage.content) {
                                lastMessageText = lastMessage.content;
                            }
                            
                            if (lastMessage.sender_id !== this.currentUser.id) {
                                await this.markMessagesAsRead(chat.id);
                            }
                        }

                        return {
                            ...chat,
                            last_message: lastMessageText,
                            last_message_at: lastMessage?.created_at,
                            unread_count: await this.getUnreadCount(chat.id)
                        };
                    } catch (error) {
                        return {
                            ...chat,
                            last_message: 'Нет сообщений',
                            last_message_at: null,
                            unread_count: 0
                        };
                    }
                })
            );

            this.chats = chatsWithLastMessage;
            this.renderChats();
            
        } catch (error) {
            console.error('Load chats exception:', error);
        }
    }

    async getUnreadCount(chatId) {
        if (!this.currentUser) return 0;
        
        try {
            const { count, error } = await supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('chat_id', chatId)
                .eq('is_read', false)
                .is('is_deleted', false)
                .gt('expires_at', new Date().toISOString()) 
                .neq('sender_id', this.currentUser.id);

            if (error) {
                console.error('Error getting unread count:', error);
                return 0;
            }

            return count || 0;
        } catch (error) {
            console.error('Get unread count exception:', error);
            return 0;
        }
    }

    async markMessagesAsRead(chatId) {
        if (!this.currentUser || !chatId) return;
        
        try {
            const { error } = await supabase
                .from('messages')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .eq('chat_id', chatId)
                .neq('sender_id', this.currentUser.id)
                .eq('is_read', false)
                .is('is_deleted', false)
                .gt('expires_at', new Date().toISOString()); 

            if (error) {
                console.error('Error marking messages as read:', error);
            }
        } catch (error) {
            console.error('Mark messages as read exception:', error);
        }
    }


    scrollToLastMessage() {
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
    }

    async loadMessages(chatId) {
        try {
            const { data, error } = await supabase
                .from('messages')
                .select(`*, sender:profiles(*)`)
                .eq('chat_id', chatId)
                .is('is_deleted', false)
                .gt('expires_at', new Date().toISOString()) 
                .order('created_at', { ascending: true });

            if (error) {
                console.error('Error loading messages:', error);
                this.showNotification('Ошибка загрузки сообщений', 'error');
                return;
            }

            this.messages = data || [];
            this.renderMessages();
            
        } catch (error) {
            console.error('Load messages exception:', error);
            this.showNotification('Ошибка загрузки сообщений', 'error');
        }
    }

    async sendMessage() {
        const input = document.getElementById('message-input');
        const text = input ? input.value.trim() : '';
        
        if (!text || !this.currentChat || !this.currentUser) {
            console.error('Cannot send message: missing data');
            return;
        }

        try {
            console.log('Sending message:', {
                chat_id: this.currentChat.id,
                sender_id: this.currentUser.id,
                content: text
            });

            
            const isParticipant = this.currentChat.user1_id === this.currentUser.id || 
                                this.currentChat.user2_id === this.currentUser.id;
            
            if (!isParticipant) {
                this.showNotification('Вы не участник этого чата', 'error');
                return;
            }

            const tempMessage = {
                id: `temp_${Date.now()}`,
                chat_id: this.currentChat.id,
                sender_id: this.currentUser.id,
                content: text,
                created_at: new Date().toISOString(),
                is_read: false,
                is_temporary: true,
                expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                sender: this.currentUser.profile 
            };

            this.messages.push(tempMessage);
            this.renderMessages();
            this.scrollToLastMessage();

            if (input) {
                input.value = '';
                if (!this.isMobile) {
                    setTimeout(() => {
                        input.focus();
                    }, 50);
                }
            }

            const { data, error } = await supabase
                .from('messages')
                .insert([
                    {
                        chat_id: this.currentChat.id,
                        sender_id: this.currentUser.id,
                        content: text,
                        created_at: new Date().toISOString(),
                        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), 
                        is_read: false
                    }
                ])
                .select('*, sender:profiles(*)')
                .single();

            if (error) {
                console.error('Send message error details:', error);
                
                this.messages = this.messages.filter(m => m.id !== tempMessage.id);
                this.renderMessages();
                
                if (error.code === '42501') {
                    this.showNotification('Нет прав для отправки сообщения в этот чат', 'error');
                } else if (error.code === '23503') {
                    this.showNotification('Чат не существует или был удален', 'error');
                } else if (error.message.includes('check_message_sender')) {
                    this.showNotification('Вы не участник этого чата', 'error');
                } else if (error.message.includes('content_or_image')) {
                    this.showNotification('Сообщение не может быть пустым', 'error');
                } else {
                    this.showNotification(`Ошибка отправки: ${error.message}`, 'error');
                }
                return;
            }

            console.log('Message sent successfully:', data);
            
            const tempIndex = this.messages.findIndex(m => m.id === tempMessage.id);
            if (tempIndex !== -1) {
                this.messages[tempIndex] = data;
                this.renderMessages();
            }
            
            await this.loadChats();
            
        } catch (error) {
            console.error('Send message exception:', error);
            
            this.messages = this.messages.filter(m => m.id?.startsWith('temp_'));
            this.renderMessages();
            
            this.showNotification('Неизвестная ошибка при отправке сообщения', 'error');
        }
    } 

    async handleImageSelect(event) {
        const file = event.target.files[0];
        if (!file || !this.currentChat || !this.currentUser) {
            console.error('Cannot upload image: missing data');
            return;
        }

        const isParticipant = this.currentChat.user1_id === this.currentUser.id || 
                            this.currentChat.user2_id === this.currentUser.id;
        
        if (!isParticipant) {
            this.showNotification('Вы не участник этого чата', 'error');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            this.showNotification('Файл слишком большой (макс 10MB)', 'error');
            return;
        }

        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
        if (!validTypes.includes(file.type)) {
            this.showNotification('Недопустимый тип файла. Используйте JPG, PNG, GIF, WebP или SVG', 'error');
            return;
        }

        this.currentImageFile = file;
        this.imagePreviewUrl = URL.createObjectURL(file);
        
        this.showImagePreview();
    }

    showImagePreview() {
        if (!this.imagePreviewUrl || !this.currentImageFile) return;
        
        let previewOverlay = document.getElementById('image-preview-overlay');
        if (!previewOverlay && this.isMobile) {
            previewOverlay = document.createElement('div');
            previewOverlay.id = 'image-preview-overlay';
            previewOverlay.className = 'image-preview-overlay';
            document.body.appendChild(previewOverlay);
            
            // Закрываем по клику на оверлей
            previewOverlay.addEventListener('click', (e) => {
                if (e.target === previewOverlay) {
                    this.removeImagePreview();
                }
            });
        }
        let previewContainer = document.getElementById('image-preview-container');
        
        if (!previewContainer) {
            previewContainer = document.createElement('div');
            previewContainer.id = 'image-preview-container';
            previewContainer.className = 'image-preview-container';
            previewContainer.innerHTML = `
                <div class="image-preview">
                    <img id="preview-image" src="${this.imagePreviewUrl}" alt="Превью">
                    <button id="remove-preview-btn" class="image-preview-remove" title="Убрать">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="image-preview-actions">
                    <input type="text" id="image-caption" placeholder="Добавьте подпись к изображению...">
                    <button id="send-image-btn" class="btn-primary">
                        <i class="fas fa-paper-plane"></i> Отправить
                    </button>
                    <button id="cancel-image-btn" class="btn-secondary" style="margin-left: 10px;">
                        <i class="fas fa-times"></i> Отмена
                    </button>
                </div>
            `;
            
            const chatInputContainer = document.getElementById('chat-input-container');
            if (chatInputContainer) {
                chatInputContainer.parentNode.insertBefore(previewContainer, chatInputContainer);
            }
            
            const removeBtn = document.getElementById('remove-preview-btn');
            const sendBtn = document.getElementById('send-image-btn');
            const cancelBtn = document.getElementById('cancel-image-btn');
            
            if (removeBtn) {
                removeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.removeImagePreview();
                });
            }
            
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => this.removeImagePreview());
            }
            
            if (sendBtn) {
                sendBtn.addEventListener('click', () => this.sendImageMessage());
            }
            
            const captionInput = document.getElementById('image-caption');
            if (captionInput) {
                captionInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.sendImageMessage();
                    }
                });
                
                captionInput.focus();
            }
        }
    }

    removeImagePreview() {
        // Очищаем URL объекта
        if (this.imagePreviewUrl) {
            URL.revokeObjectURL(this.imagePreviewUrl);
        }
        
        this.currentImageFile = null;
        this.imagePreviewUrl = null;
        
        // Удаляем контейнер превью
        const previewContainer = document.getElementById('image-preview-container');
        if (previewContainer) {
            previewContainer.remove();
        }
        
        // Удаляем оверлей
        const previewOverlay = document.getElementById('image-preview-overlay');
        if (previewOverlay) {
            previewOverlay.remove();
        }
        
        // Очищаем поле загрузки
        const imageUpload = document.getElementById('image-upload');
        if (imageUpload) {
            imageUpload.value = '';
        }
    }

    async sendImageMessage() {
        if (!this.currentImageFile || !this.currentChat || !this.currentUser) {
            console.error('Cannot send image: missing data');
            return;
        }

        try {
            this.showNotification('Загрузка изображения...', 'info');

            const fileExt = this.currentImageFile.name.split('.').pop();
            const fileName = `${this.currentUser.id}/${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('chat_images')
                .upload(fileName, this.currentImageFile, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) {
                console.error('Upload error:', uploadError);
                throw new Error(`Ошибка загрузки: ${uploadError.message}`);
            }

            const { data: { publicUrl } } = supabase.storage
                .from('chat_images')
                .getPublicUrl(fileName);

            console.log('Uploaded image URL:', publicUrl);

            const captionInput = document.getElementById('image-caption');
            const caption = captionInput ? captionInput.value.trim() : '';

            const { data: messageData, error: messageError } = await supabase
                .from('messages')
                .insert([
                    {
                        chat_id: this.currentChat.id,
                        sender_id: this.currentUser.id,
                        content: caption || '🖼️ Изображение',
                        image_url: publicUrl,
                        created_at: new Date().toISOString(),
                        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), 
                        is_read: false
                    }
                ])
                .select('*')
                .single();

            if (messageError) {
                console.error('Message insert error:', messageError);
                throw new Error(`Ошибка сохранения сообщения: ${messageError.message}`);
            }

            this.showNotification('Изображение отправлено', 'success');
            console.log('Image message sent:', messageData);
            
            await this.loadMessages(this.currentChat.id);
            
            this.removeImagePreview();
            
        } catch (error) {
            console.error('Error uploading image:', error);
            this.showNotification(`Ошибка загрузки изображения: ${error.message}`, 'error');
        }
    }
    async uploadProfileAvatar(event) {
        const file = event.target.files[0];
        if (!file || !this.currentUser) return;

        if (file.size > 5 * 1024 * 1024) {
            this.showNotification('Файл слишком большой (макс 5MB)', 'error');
            return;
        }

        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            this.showNotification('Недопустимый тип файла. Используйте JPG, PNG, GIF или WebP', 'error');
            return;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${this.currentUser.id}/${Date.now()}.${fileExt}`;

        try {
            this.showNotification('Загрузка аватара...', 'info');

            if (this.currentUser.profile?.avatar_url) {
                const oldFileName = this.currentUser.profile.avatar_url.split('/').pop();
                if (oldFileName) {
                    try {
                        await supabase.storage
                            .from('avatars')
                            .remove([`${this.currentUser.id}/${oldFileName}`]);
                    } catch (removeError) {
                        console.warn('Could not remove old avatar:', removeError);
                    }
                }
            }

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, file, { 
                    upsert: true,
                    cacheControl: '3600'
                });

            if (uploadError) {
                console.error('Upload error:', uploadError);
                throw new Error(`Ошибка загрузки: ${uploadError.message}`);
            }

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName);

            const { error: updateError } = await supabase
                .from('profiles')
                .update({ 
                    avatar_url: publicUrl,
                    updated_at: new Date().toISOString()
                })
                .eq('id', this.currentUser.id);

            if (updateError) {
                console.error('Update error:', updateError);
                throw new Error(`Ошибка обновления профиля: ${updateError.message}`);
            }

            if (this.currentUser.profile) {
                this.currentUser.profile.avatar_url = publicUrl;
                this.currentUser.profile.updated_at = new Date().toISOString();
            }
            
            this.updateUserUI();
            this.updateProfileUI();
            this.loadChats();
            this.showNotification('Аватар обновлен', 'success');
            
        } catch (error) {
            console.error('Error uploading avatar:', error);
            this.showNotification(`Ошибка загрузки аватара: ${error.message}`, 'error');
        }
        
        event.target.value = '';
    }

    async saveProfile() {
        const usernameInput = document.getElementById('profile-username');
        const statusInput = document.getElementById('profile-status');
        
        const username = usernameInput ? usernameInput.value.trim() : '';
        const status = statusInput ? statusInput.value.trim() : '';

        if (!username) {
            this.showNotification('Имя пользователя не может быть пустым', 'error');
            return;
        }

        try {
            const updates = {
                username: username,
                status: status || null, // Разрешаем пустой статус
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', this.currentUser.id);

            if (error) {
                console.error('Error updating profile:', error);
                
                let errorMessage = 'Ошибка сохранения профиля';
                if (error.code === '23514') {
                    errorMessage = 'Некорректные данные в профиле';
                } else if (error.message.includes('username')) {
                    errorMessage = 'Имя пользователя уже занято';
                }
                
                this.showNotification(errorMessage, 'error');
                return;
            }

            if (this.currentUser.profile) {
                this.currentUser.profile.username = username;
                this.currentUser.profile.status = status;
                this.currentUser.profile.updated_at = updates.updated_at;
            }
            
            this.updateUserUI();
            this.updateProfileUI();
            this.loadChats();
            this.showNotification('Профиль успешно обновлен', 'success');
            
        } catch (error) {
            console.error('Save profile exception:', error);
            this.showNotification('Ошибка сохранения профиля. Проверьте подключение к интернету', 'error');
        }
    }

    async changePassword() {
        const currentPasswordInput = document.getElementById('current-password');
        const newPasswordInput = document.getElementById('new-password');
        const confirmPasswordInput = document.getElementById('confirm-password');
        
        const currentPassword = currentPasswordInput ? currentPasswordInput.value : '';
        const newPassword = newPasswordInput ? newPasswordInput.value : '';
        const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : '';

        if (!currentPassword) {
            this.showNotification('Введите текущий пароль', 'error');
            return;
        }

        if (newPassword && newPassword.length < 6) {
            this.showNotification('Новый пароль должен быть не менее 6 символов', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            this.showNotification('Пароли не совпадают', 'error');
            return;
        }

        try {
            const { error: authError } = await supabase.auth.signInWithPassword({
                email: this.currentUser.email,
                password: currentPassword
            });

            if (authError) {
                this.showNotification('Неверный текущий пароль', 'error');
                return;
            }

            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword || undefined
            });

            if (updateError) {
                console.error('Error updating password:', updateError);
                this.showNotification('Ошибка изменения пароля', 'error');
                return;
            }

            this.showNotification('Пароль успешно изменен', 'success');
            
            if (currentPasswordInput) currentPasswordInput.value = '';
            if (newPasswordInput) newPasswordInput.value = '';
            if (confirmPasswordInput) confirmPasswordInput.value = '';
            
        } catch (error) {
            console.error('Change password exception:', error);
            this.showNotification('Ошибка изменения пароля', 'error');
        }
    }

    async deleteContact(chatId) {
        if (!this.currentUser) return;
        
        this.showConfirmModal(
            'Удалить контакт?',
            'Это действие удалит чат и все сообщения с этим пользователем. Это действие нельзя отменить.',
            'error',
            async () => {
                try {
                    const { error: chatError } = await supabase
                        .from('chats')
                        .update({
                            is_deleted: true,
                            deleted_at: new Date().toISOString()
                        })
                        .eq('id', chatId);

                    if (chatError) {
                        console.error('Error deleting chat:', chatError);
                        this.showNotification('Ошибка удаления контакта', 'error');
                        return;
                    }

                    if (this.currentChat && this.currentChat.id === chatId) {
                        this.currentChat = null;
                        this.updateChatUI();
                        
                        const chatHeader = document.getElementById('chat-header');
                        const chatInputContainer = document.getElementById('chat-input-container');
                        const noChatSelected = document.querySelector('.no-chat-selected');
                        const messagesContainer = document.getElementById('messages-container');
                        const chatArea = document.getElementById('chat-area');
                        
                        if (chatHeader) chatHeader.style.display = 'none';
                        if (chatInputContainer) chatInputContainer.style.display = 'none';
                        if (noChatSelected) noChatSelected.style.display = 'flex';
                        if (messagesContainer) messagesContainer.innerHTML = `
                            <div class="no-chat-selected">
                                <i class="fas fa-comments"></i>
                                <p>Выберите чат для начала общения</p>
                            </div>
                        `;
                        if (this.isMobile && chatArea) {
                            chatArea.classList.remove('chat-active');
                        }
                    }

                    this.showNotification('Контакт удален', 'success');
                    
                    await this.loadChats();
                    
                } catch (error) {
                    console.error('Delete contact exception:', error);
                    this.showNotification('Ошибка удаления контакта', 'error');
                }
            }
        );
    }

    async deleteMessage(messageId) {
        if (!this.currentUser || !messageId) return;
        
        this.showConfirmModal(
            'Удалить сообщение?',
            'Это действие нельзя отменить.',
            'warning',
            async () => {
                try {
                    const { error } = await supabase
                        .from('messages')
                        .update({
                            is_deleted: true,
                            deleted_at: new Date().toISOString(),
                            content: 'Сообщение удалено',
                            image_url: null,
                            voice_url: null
                        })
                        .eq('id', messageId)
                        .eq('sender_id', this.currentUser.id); // Только свои сообщения

                    if (error) {
                        console.error('Error deleting message:', error);
                        this.showNotification('Ошибка удаления сообщения', 'error');
                        return;
                    }

                    this.showNotification('Сообщение удалено', 'success');
                    
                    if (this.currentChat) {
                        await this.loadMessages(this.currentChat.id);
                    }
                    
                } catch (error) {
                    console.error('Delete message exception:', error);
                    this.showNotification('Ошибка удаления сообщения', 'error');
                }
            }
        );
    }

    async deleteChat() {
        if (!this.currentChat || !this.currentUser) return;
        
        this.showConfirmModal(
            'Удалить чат?',
            'Все сообщения в этом чате будут удалены. Это действие нельзя отменить.',
            'error',
            async () => {
                try {
                    const { error } = await supabase
                        .from('chats')
                        .update({
                            is_deleted: true,
                            deleted_at: new Date().toISOString()
                        })
                        .eq('id', this.currentChat.id);

                    if (error) {
                        console.error('Error deleting chat:', error);
                        this.showNotification('Ошибка удаления чата', 'error');
                        return;
                    }

                    this.showNotification('Чат удален', 'success');
                    
                    this.currentChat = null;
                    
                    await this.loadChats();
                    
                    const chatHeader = document.getElementById('chat-header');
                    const chatInputContainer = document.getElementById('chat-input-container');
                    const noChatSelected = document.querySelector('.no-chat-selected');
                    const messagesContainer = document.getElementById('messages-container');
                    const chatArea = document.getElementById('chat-area');
                    
                    if (chatHeader) chatHeader.style.display = 'none';
                    if (chatInputContainer) chatInputContainer.style.display = 'none';
                    if (noChatSelected) noChatSelected.style.display = 'flex';
                    if (messagesContainer) messagesContainer.innerHTML = `
                        <div class="no-chat-selected">
                            <i class="fas fa-comments"></i>
                            <p>Выберите чат для начала общения</p>
                        </div>
                    `;
                    if (this.isMobile && chatArea) {
                        chatArea.classList.remove('chat-active');
                        this.showChatsList();
                    }
                    
                } catch (error) {
                    console.error('Delete chat exception:', error);
                    this.showNotification('Ошибка удаления чата', 'error');
                }
            }
        );
    }

    showDeleteAccountConfirm() {
        this.showConfirmModal(
            'Удалить аккаунт?',
            'ВНИМАНИЕ: Вы удаляете свой аккаунт. Это действие нельзя отменить. Все ваши данные будут удалены.',
            'error',
            async () => {
                const password = prompt('Введите ваш пароль для подтверждения:');
                if (!password) return;
                
                try {
                    const { error: authError } = await supabase.auth.signInWithPassword({
                        email: this.currentUser.email,
                        password: password
                    });
                    
                    if (authError) {
                        this.showNotification('Неверный пароль', 'error');
                        return;
                    }
                    
                    const { error: profileError } = await supabase
                        .from('profiles')
                        .delete()
                        .eq('id', this.currentUser.id);
                    
                    if (profileError) {
                        console.error('Error deleting profile:', profileError);
                    }
                    
                    try {
                        await supabase.storage
                            .from('avatars')
                            .remove([`${this.currentUser.id}/`]);
                    } catch (storageError) {
                        console.warn('Error deleting avatar:', storageError);
                    }
                    
                    const { error: signOutError } = await supabase.auth.signOut();
                    if (signOutError) {
                        console.error('Error signing out:', signOutError);
                    }
                    
                    this.showNotification('Аккаунт удален', 'success');
                    
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                    
                } catch (error) {
                    console.error('Delete account exception:', error);
                    this.showNotification('Ошибка удаления аккаунт', 'error');
                }
            }
        );
    }

    async startVoiceRecording() {
        if (this.isRecording) return;
        
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                this.showNotification('Микрофон не поддерживается в этом браузере', 'error');
                return;
            }
            
            const permission = await navigator.permissions.query({ name: 'microphone' });
            if (permission.state === 'denied') {
                this.showNotification('Разрешите доступ к микрофону в настройках приложения', 'error');
                return;
            }
            
            if (this.voiceRecordingTimeout) {
                clearTimeout(this.voiceRecordingTimeout);
                this.voiceRecordingTimeout = null;
            }
            
            const voiceBtn = document.getElementById('voice-record-btn');
            if (voiceBtn) {
                voiceBtn.classList.add('pressed');
            }
            
            this.voiceRecordingTimeout = setTimeout(async () => {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ 
                        audio: {
                            echoCancellation: true,
                            noiseSuppression: true,
                            sampleRate: 44100
                        }
                    });
                    
                    this.mediaRecorder = new MediaRecorder(stream);
                    this.audioChunks = [];
                    
                    this.mediaRecorder.ondataavailable = (event) => {
                        if (event.data.size > 0) {
                            this.audioChunks.push(event.data);
                        }
                    };
                    
                    this.mediaRecorder.onstop = async () => {
                        try {
                            const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                            await this.sendVoiceMessage(audioBlob);
                        } catch (error) {
                            console.error('Error in voice recording onstop:', error);
                            this.showNotification('Ошибка обработки записи', 'error');
                        } finally {
                            stream.getTracks().forEach(track => track.stop());
                            
                            if (voiceBtn) {
                                voiceBtn.classList.remove('recording');
                                voiceBtn.classList.remove('pressed');
                            }
                            
                            this.hideRecordingIndicator();
                        }
                    };
                    
                    this.mediaRecorder.start(100);
                    this.isRecording = true;
                    this.recordingStartTime = Date.now();
                    
                    if (voiceBtn) {
                        voiceBtn.classList.remove('pressed');
                        voiceBtn.classList.add('recording');
                    }
                    
                    this.showRecordingIndicator();
                    
                    this.startRecordingTimer();
                    
                } catch (error) {
                    console.error('Error getting microphone stream:', error);
                    this.showNotification('Не удалось получить доступ к микрофону', 'error');
                    
                    const voiceBtn = document.getElementById('voice-record-btn');
                    if (voiceBtn) {
                        voiceBtn.classList.remove('pressed');
                    }
                }
            }, 300);
            
        } catch (error) {
            console.error('Microphone error:', error);
            this.showNotification('Ошибка доступа к микрофону', 'error');
        }
    }

    stopVoiceRecording() {
        if (this.voiceRecordingTimeout) {
            clearTimeout(this.voiceRecordingTimeout);
            this.voiceRecordingTimeout = null;
        }
        
        const voiceBtn = document.getElementById('voice-record-btn');
        if (voiceBtn) {
            voiceBtn.classList.remove('pressed');
        }
        
        if (!this.isRecording || !this.mediaRecorder) {
            return;
        }
        
        if (voiceBtn) {
            voiceBtn.classList.remove('recording');
            voiceBtn.classList.remove('pressed');
        }
        
        if (this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        }
        
        this.isRecording = false;
        
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }
        
        this.hideRecordingIndicator();
    }

    showRecordingIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'voice-recording-indicator';
        indicator.id = 'voice-recording-indicator';
        indicator.innerHTML = `
            <i class="fas fa-microphone"></i>
            <div class="voice-recording-timer" id="recording-timer">00:00</div>
            <div class="voice-recording-hint">Отпустите кнопку, чтобы отправить голосовое сообщение</div>
        `;
        
        document.body.appendChild(indicator);
    }

    hideRecordingIndicator() {
        const indicator = document.getElementById('voice-recording-indicator');
        if (indicator) {
            indicator.style.opacity = '0';
            indicator.style.transform = 'translate(-50%, -50%) scale(0.9)';
            
            setTimeout(() => {
                if (indicator.parentNode) {
                    indicator.remove();
                }
            }, 300);
        }
    }

    startRecordingTimer() {
        this.recordingTimer = setInterval(() => {
            if (!this.recordingStartTime) return;
            
            const elapsed = Date.now() - this.recordingStartTime;
            const seconds = Math.floor(elapsed / 1000);
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            
            const timerElement = document.getElementById('recording-timer');
            if (timerElement) {
                timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
            }
            
            if (seconds >= 120) {
                this.stopVoiceRecording();
            }
        }, 1000);
    }

    async sendVoiceMessage(audioBlob) {
        if (!this.currentChat || !this.currentUser) {
            console.error('Cannot send voice message: no active chat or user');
            return;
        }
        
        const isParticipant = this.currentChat.user1_id === this.currentUser.id || 
                            this.currentChat.user2_id === this.currentUser.id;
        
        if (!isParticipant) {
            this.showNotification('Вы не участник этого чата', 'error');
            return;
        }

        if (audioBlob.size === 0) {
            this.showNotification('Запись слишком короткая', 'error');
            return;
        }

        const fileName = `${this.currentUser.id}/${Date.now()}.webm`;

        try {
            this.showNotification('Отправка голосового сообщения...', 'info');

            const { error: uploadError } = await supabase.storage
                .from('voice_messages')
                .upload(fileName, audioBlob, {
                    cacheControl: '3600',
                    upsert: false,
                    contentType: 'audio/webm'
                });

            if (uploadError) {
                console.error('Upload error:', uploadError);
                throw new Error(`Ошибка загрузки: ${uploadError.message}`);
            }

            const { data: { publicUrl } } = supabase.storage
                .from('voice_messages')
                .getPublicUrl(fileName);

            const audio = new Audio();
            audio.src = URL.createObjectURL(audioBlob);
            
            return new Promise((resolve, reject) => {
                audio.onloadedmetadata = async () => {
                    try {
                        const duration = Math.round(audio.duration);
                        
                        const { error: messageError } = await supabase
                            .from('messages')
                            .insert([
                                {
                                    chat_id: this.currentChat.id,
                                    sender_id: this.currentUser.id,
                                    content: '🎤 Голосовое сообщение',
                                    voice_url: publicUrl,
                                    voice_duration: duration,
                                    created_at: new Date().toISOString(),
                                    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 часа
                                    is_read: false
                                }
                            ]);

                        if (messageError) {
                            console.error('Message insert error:', messageError);
                            throw new Error(`Ошибка сохранения сообщения: ${messageError.message}`);
                        }

                        this.showNotification('Голосовое сообщение отправлено', 'success');
                        
                        await this.loadMessages(this.currentChat.id);
                        
                        resolve();
                    } catch (error) {
                        reject(error);
                    } finally {
                        URL.revokeObjectURL(audio.src);
                    }
                };
                
                audio.onerror = () => {
                    reject(new Error('Не удалось загрузить аудио'));
                    URL.revokeObjectURL(audio.src);
                };
            });
            
        } catch (error) {
            console.error('Error sending voice message:', error);
            this.showNotification(`Ошибка отправки голосового сообщения: ${error.message}`, 'error');
            throw error;
        }
    }

    playVoiceMessage(url, button) {
        if (this.voiceMessages.has(url)) {
            const audio = this.voiceMessages.get(url);
            if (audio.paused) {
                audio.play();
                button.innerHTML = '<i class="fas fa-pause"></i>';
                button.classList.add('playing');
            } else {
                audio.pause();
                button.innerHTML = '<i class="fas fa-play"></i>';
                button.classList.remove('playing');
            }
            return;
        }

        const audio = new Audio(url);
        this.voiceMessages.set(url, audio);
        
        button.innerHTML = '<i class="fas fa-pause"></i>';
        button.classList.add('playing');
        
        audio.addEventListener('ended', () => {
            button.innerHTML = '<i class="fas fa-play"></i>';
            button.classList.remove('playing');
        });
        
        audio.addEventListener('pause', () => {
            button.innerHTML = '<i class="fas fa-play"></i>';
            button.classList.remove('playing');
        });
        
        audio.play();
    }

    async cleanupOldMessages() {
        if (!this.currentUser) return;
        
        try {
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            
            const { error } = await supabase
                .from('messages')
                .delete()
                .lt('expires_at', twentyFourHoursAgo)
                .neq('sender_id', this.currentUser.id); // Не удаляем свои сообщения сразу

            if (error) {
                console.error('Error cleaning up old messages:', error);
            }
            
        } catch (error) {
            console.error('Cleanup old messages exception:', error);
        }
    }

    startAutoCleanup() {
        setInterval(() => {
            this.cleanupOldMessages();
        }, 5 * 60 * 1000);
        
        this.cleanupOldMessages();
    }

    showConfirmModal(title, message, type = 'error', confirmCallback) {
        const modal = document.getElementById('confirm-modal');
        const modalTitle = document.getElementById('confirm-modal-title');
        const modalMessage = document.getElementById('confirm-modal-message');
        const confirmBtn = document.getElementById('confirm-modal-confirm');
        
        if (modal && modalTitle && modalMessage && confirmBtn) {
            modalTitle.textContent = title;
            modalMessage.textContent = message;
            
            confirmBtn.dataset.callback = 'temp';
            window.tempConfirmCallback = confirmCallback;
            
            confirmBtn.className = 'confirm-modal-confirm';
            if (type === 'warning') {
                confirmBtn.classList.add('warning');
            }
            
            modal.classList.remove('hidden');
        }
    }

    hideConfirmModal() {
        const modal = document.getElementById('confirm-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    handleConfirmAction() {
        if (window.tempConfirmCallback) {
            window.tempConfirmCallback();
            delete window.tempConfirmCallback;
        }
        this.hideConfirmModal();
    }

    updateUserUI() {
        if (!this.currentUser?.profile) return;
        
        const profile = this.currentUser.profile;
        const avatar = profile.avatar_url || 
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.username)}&background=2d3748&color=fff&bold=true&size=128`;
        
        // Обновляем аватар в навигации
        const navAvatar = document.getElementById('nav-avatar');
        if (navAvatar) {
            navAvatar.innerHTML = '';
            if (profile.avatar_url) {
                const img = document.createElement('img');
                img.src = avatar;
                img.alt = profile.username;
                img.onerror = () => {
                    navAvatar.textContent = profile.username.charAt(0).toUpperCase();
                };
                navAvatar.appendChild(img);
            } else {
                const initials = profile.username.charAt(0).toUpperCase();
                navAvatar.textContent = initials;
                navAvatar.style.backgroundColor = '#4a5568';
                navAvatar.style.color = '#fff';
                navAvatar.style.fontWeight = 'bold';
            }
        }
        
        // Обновляем имя в навигации
        const navUsername = document.getElementById('nav-username');
        if (navUsername) navUsername.textContent = profile.username;
        
        // Обновляем основной аватар в чатах
        const currentUserAvatar = document.getElementById('current-user-avatar');
        if (currentUserAvatar) {
            currentUserAvatar.innerHTML = '';
            if (profile.avatar_url) {
                const img = document.createElement('img');
                img.src = avatar;
                img.alt = profile.username;
                img.onerror = () => {
                    currentUserAvatar.textContent = profile.username.charAt(0).toUpperCase();
                };
                currentUserAvatar.appendChild(img);
            } else {
                const initials = profile.username.charAt(0).toUpperCase();
                currentUserAvatar.textContent = initials;
                currentUserAvatar.style.backgroundColor = '#4a5568';
                currentUserAvatar.style.color = '#fff';
                currentUserAvatar.style.fontSize = '24px';
                currentUserAvatar.style.fontWeight = 'bold';
            }
        }
        
        // Обновляем имя в чатах
        const currentUserName = document.getElementById('current-user-name');
        if (currentUserName) currentUserName.textContent = profile.username;
        
        // Обновляем статус в чатах
        const currentUserStatus = document.getElementById('current-user-status');
        if (currentUserStatus) {
            currentUserStatus.textContent = profile.status || 'Привет! Я использую REonika';
        }
    }

    updateProfileUI() {
        if (!this.currentUser?.profile) return;
        
        const profile = this.currentUser.profile;
        
        // Обновляем аватар в профиле
        const profileAvatar = document.getElementById('profile-avatar');
        if (profileAvatar) {
            profileAvatar.innerHTML = '';
            if (profile.avatar_url) {
                const img = document.createElement('img');
                img.src = profile.avatar_url;
                img.alt = profile.username;
                img.className = 'profile-avatar';
                img.onerror = () => {
                    profileAvatar.textContent = profile.username.charAt(0).toUpperCase();
                    profileAvatar.className = 'avatar large';
                };
                profileAvatar.appendChild(img);
            } else {
                profileAvatar.className = 'avatar large';
                profileAvatar.textContent = profile.username.charAt(0).toUpperCase();
                profileAvatar.style.backgroundColor = '#4a5568';
                profileAvatar.style.color = '#fff';
                profileAvatar.style.fontSize = '42px';
                profileAvatar.style.fontWeight = 'bold';
            }
        }
        
        // Обновляем поля формы
        const usernameInput = document.getElementById('profile-username');
        const emailInput = document.getElementById('profile-email');
        const statusInput = document.getElementById('profile-status');
        
        if (usernameInput) usernameInput.value = profile.username || '';
        if (emailInput) emailInput.value = profile.email || '';
        if (statusInput) statusInput.value = profile.status || '';
    }

    updateChatUI() {
        if (!this.currentChat || !this.currentUser) {
            // Скрываем интерфейс чата, если нет активного чата
            const chatHeader = document.getElementById('chat-header');
            const chatInputContainer = document.getElementById('chat-input-container');
            const noChatSelected = document.querySelector('.no-chat-selected');
            
            if (chatHeader) chatHeader.style.display = 'none';
            if (chatInputContainer) chatInputContainer.style.display = 'none';
            if (noChatSelected) noChatSelected.style.display = 'flex';
            return;
        }

        const partner = this.currentChat.user1_id === this.currentUser.id 
            ? this.currentChat.user2 
            : this.currentChat.user1;

        if (!partner) return;

        const chatPartnerName = document.getElementById('chat-partner-name');
        if (chatPartnerName) chatPartnerName.textContent = partner.username;
        
        const partnerAvatar = document.getElementById('chat-partner-avatar');
        if (partnerAvatar) {
            partnerAvatar.innerHTML = '';
            if (partner.avatar_url) {
                const img = document.createElement('img');
                img.src = partner.avatar_url;
                img.alt = partner.username;
                img.onerror = () => {
                    partnerAvatar.textContent = partner.username.charAt(0).toUpperCase();
                };
                partnerAvatar.appendChild(img);
            } else {
                const initials = partner.username.charAt(0).toUpperCase();
                partnerAvatar.textContent = initials;
                partnerAvatar.style.backgroundColor = '#4a5568';
                partnerAvatar.style.color = '#fff';
                partnerAvatar.style.fontWeight = 'bold';
            }
        }
        
        // Обновляем статус онлайн
        this.updateOnlineStatusUI();
    }

    renderChats() {
        const container = document.getElementById('chats-list');
        if (!container || !this.currentUser) return;

        container.innerHTML = '';

        if (!this.chats || this.chats.length === 0) {
            container.innerHTML = `
                <div class="no-chats">
                    <i class="fas fa-comments"></i>
                    <p>Нет чатов</p>
                    <p style="font-size: 14px; margin-top: 10px;">Найдите пользователя, чтобы начать общение</p>
                </div>
            `;
            return;
        }

        this.chats.forEach(chat => {
            const partner = chat.user1_id === this.currentUser.id ? chat.user2 : chat.user1;
            if (!partner) return;
            
            const lastMessage = chat.last_message || 'Нет сообщений';
            const lastTime = chat.last_message_at ? this.formatTime(chat.last_message_at) : '';
            const isOnline = this.onlineUsers.has(partner.id);
            const unreadCount = chat.unread_count || 0;
            
            const chatItem = document.createElement('div');
            chatItem.className = `chat-item ${this.currentChat && this.currentChat.id === chat.id ? 'active' : ''}`;
            
            let partnerAvatarHTML = '';
            if (partner.avatar_url) {
                partnerAvatarHTML = `<img src="${partner.avatar_url}" alt="${partner.username}" class="avatar" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'avatar\\'>${partner.username.charAt(0).toUpperCase()}</div>'">`;
            } else {
                const initials = partner.username.charAt(0).toUpperCase();
                partnerAvatarHTML = `<div class="avatar">${initials}</div>`;
            }
            
            chatItem.innerHTML = `
                <div class="chat-avatar-container">
                    ${partnerAvatarHTML}
                    <span class="online-status ${isOnline ? 'online' : 'offline'}"></span>
                </div>
                <div class="chat-info">
                    <div class="chat-header-info">
                        <h4>${partner.username}</h4>
                        ${lastTime ? `<span class="timestamp">${lastTime}</span>` : ''}
                    </div>
                    <p class="last-message">${lastMessage}</p>
                </div>
                ${unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : ''}
                <button class="delete-contact-btn" data-chat-id="${chat.id}" title="Удалить контакт">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            chatItem.addEventListener('click', (e) => {
                // Не открываем чат если кликнули на кнопку удаления
                if (!e.target.closest('.delete-contact-btn')) {
                    this.selectChat(chat);
                }
            });
            
            // Добавляем обработчик для кнопки удаления контакта
            const deleteBtn = chatItem.querySelector('.delete-contact-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const chatId = deleteBtn.getAttribute('data-chat-id');
                    this.deleteContact(chatId);
                });
            }
            
            container.appendChild(chatItem);
        });
    }

    renderMessages() {
        const container = document.getElementById('messages-container');
        if (!container) return;

        container.innerHTML = '';

        // Сортируем сообщения по времени
        this.messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));       

        if (!this.messages || this.messages.length === 0) {
            container.innerHTML = '<div class="empty-chat"><p>Нет сообщений. Начните общение!</p></div>';
            return;
        }

        let lastSenderId = null;
        let lastDate = null;

        this.messages.forEach((message, index) => {
            const isSent = message.sender_id === this.currentUser.id;
            const messageDate = new Date(message.created_at).toDateString();
            const isDeleted = message.is_deleted;
            
            // Добавляем дату, если она изменилась
            if (lastDate !== messageDate) {
                const dateDiv = document.createElement('div');
                dateDiv.className = 'message-date';
                dateDiv.textContent = this.formatDate(message.created_at);
                container.appendChild(dateDiv);
                lastDate = messageDate;
            }
            
            // Добавляем аватар для входящих сообщений, если отправитель изменился
            if (!isSent && lastSenderId !== message.sender_id && message.sender) {
                const avatarDiv = document.createElement('div');
                avatarDiv.className = 'message-avatar';
                
                if (message.sender.avatar_url) {
                    avatarDiv.innerHTML = `<img src="${message.sender.avatar_url}" alt="${message.sender.username}" onerror="this.onerror=null; this.parentElement.textContent='${message.sender.username.charAt(0).toUpperCase()}'">`;
                } else {
                    avatarDiv.textContent = message.sender.username.charAt(0).toUpperCase();
                }
                
                container.appendChild(avatarDiv);
            }
            
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${isSent ? 'sent' : 'received'} ${lastSenderId === message.sender_id ? 'same-sender' : ''} ${isDeleted ? 'deleted' : ''}`;
            
            let content = '';
            
            if (isDeleted) {
                content += `<div class="message-text deleted-text"><i>Сообщение удалено</i></div>`;
            } else if (message.image_url) {
                content += `
                    <div class="message-image-container">
                        <img src="${message.image_url}" alt="Изображение" class="message-img" loading="lazy" onerror="this.style.display='none'; this.parentElement.innerHTML+='<div class=\\'message-text\\'>⚠️ Не удалось загрузить изображение</div>'">
                        ${message.content !== '🖼️ Изображение' ? `<div class="message-text">${message.content}</div>` : ''}
                    </div>
                `;
            } else if (message.voice_url) {
                const duration = message.voice_duration || 0;
                const minutes = Math.floor(duration / 60);
                const seconds = duration % 60;
                const durationText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                
                content += `
                    <div class="voice-message">
                        <button class="play-voice-btn" data-url="${message.voice_url}">
                            <i class="fas fa-play"></i>
                        </button>
                        <div class="voice-waveform"></div>
                        <span class="voice-duration">${durationText}</span>
                    </div>
                `;
            } else {
                content += `<div class="message-text">${message.content}</div>`;
            }
            
            // Добавляем индикатор времени жизни сообщения
            if (message.expires_at) {
                const expiresDate = new Date(message.expires_at);
                const now = new Date();
                const hoursLeft = Math.round((expiresDate - now) / (1000 * 60 * 60));
                
                if (hoursLeft > 0) {
                    content += `
                        <div class="message-expiry">
                            <i class="fas fa-clock"></i>
                            <span>Удаляется через ${hoursLeft}ч</span>
                        </div>
                    `;
                }
            }
            
            content += `
                <div class="message-footer">
                    <div class="message-time">${this.formatTime(message.created_at)}</div>
                    ${isSent ? `<div class="message-status ${message.is_read ? 'read' : 'unread'}">${message.is_read ? '✓✓' : '✓'}</div>` : ''}
                    ${isSent && !isDeleted ? `<button class="btn-icon delete-message-btn" data-message-id="${message.id}" title="Удалить сообщение"><i class="fas fa-trash"></i></button>` : ''}
                </div>
            `;
            
            messageDiv.innerHTML = content;
            
            // Добавляем обработчик удаления сообщения
            if (isSent && !isDeleted) {
                const deleteBtn = messageDiv.querySelector('.delete-message-btn');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const messageId = deleteBtn.getAttribute('data-message-id');
                        this.deleteMessage(messageId);
                    });
                }
            }
            
            // Добавляем обработчик для голосового сообщения
            if (message.voice_url && !isDeleted) {
                const playBtn = messageDiv.querySelector('.play-voice-btn');
                if (playBtn) {
                    playBtn.addEventListener('click', () => {
                        const url = playBtn.getAttribute('data-url');
                        this.playVoiceMessage(url, playBtn);
                    });
                }
            }
            
            if (message.image_url && !isDeleted) {
                const img = messageDiv.querySelector('.message-img');
                if (img) {
                    img.addEventListener('click', () => {
                        const modal = document.createElement('div');
                        modal.className = 'image-modal';
                        modal.innerHTML = `
                            <div class="image-modal-content">
                                <img src="${message.image_url}" alt="Изображение">
                                <button class="image-modal-close">&times;</button>
                                <button class="image-modal-download" title="Скачать">
                                    <i class="fas fa-download"></i>
                                </button>
                            </div>
                        `;
                        document.body.appendChild(modal);
                        
                        modal.querySelector('.image-modal-close').addEventListener('click', () => modal.remove());
                        modal.querySelector('.image-modal-download').addEventListener('click', () => {
                            const link = document.createElement('a');
                            link.href = message.image_url;
                            link.download = `image_${message.id}.jpg`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                        });
                        modal.addEventListener('click', (e) => {
                            if (e.target === modal) modal.remove();
                        });
                    });
                }
            }
            
            container.appendChild(messageDiv);
            lastSenderId = message.sender_id;
        });

        // Прокрутка вниз
        setTimeout(() => {
            container.scrollTop = container.scrollHeight;
        }, 100);
    }

    formatDate(dateString) {
        try {
            const date = new Date(dateString);
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            
            if (date.toDateString() === today.toDateString()) {
                return 'Сегодня';
            } else if (date.toDateString() === yesterday.toDateString()) {
                return 'Вчера';
            } else {
                return date.toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
                });
            }
        } catch (e) {
            return '';
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
            
            return date.toLocaleTimeString('ru-RU', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false
            });
        } catch (e) {
            return '';
        }
    }

    showNotification(message, type = 'info') {
        const oldNotifications = document.querySelectorAll('.notification');
        oldNotifications.forEach(n => {
            if (n.parentNode) {
                n.remove();
            }
        });
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }

    showAuthScreen() {
        const authScreen = document.getElementById('auth-screen');
        const mainScreen = document.getElementById('main-screen');
        if (authScreen) {
            authScreen.style.display = 'block';
            authScreen.classList.remove('hidden');
        }
        if (mainScreen) {
            mainScreen.style.display = 'none';
            mainScreen.classList.add('hidden');
        }
    }

    showMainScreen() {
        const authScreen = document.getElementById('auth-screen');
        const mainScreen = document.getElementById('main-screen');
        if (authScreen) {
            authScreen.style.display = 'none';
            authScreen.classList.add('hidden');
        }
        if (mainScreen) {
            mainScreen.style.display = 'block';
            mainScreen.classList.remove('hidden');
        }
    }
}



// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    window.messenger = new REonikaMessenger();
});