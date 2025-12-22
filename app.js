import { supabase } from './supabase.js';

class REonikaMessenger {
    constructor() {
        this.currentUser = null;
        this.currentChat = null;
        this.chats = [];
        this.messages = [];
        this.onlineUsers = new Set();
        
        this.searchTimeout = null;
        this.updateInterval = null;
        this.realtimeSubscriptions = [];
        this.initEventListeners();
        this.checkAuth();
    }

    initEventListeners() {
        // Авторизация
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

        // Поиск пользователей с автоопределением
        const searchUserBtn = document.getElementById('search-user-btn');
        if (searchUserBtn) {
            searchUserBtn.addEventListener('click', () => this.searchUser());
        }
        
        const userSearch = document.getElementById('user-search');
        if (userSearch) {
            userSearch.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.searchUser();
            });
            
            // Автоопределение при вводе
            userSearch.addEventListener('input', (e) => {
                const searchText = e.target.value.trim();
                if (searchText.length >= 2) {
                    this.debouncedSearch(searchText);
                } else {
                    this.hideSearchResults();
                }
            });
            
            // Очистка результатов при изменении текста
            userSearch.addEventListener('input', () => {
                if (!userSearch.value.trim()) {
                    this.hideSearchResults();
                }
            });
        }

        // Отправка сообщений
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
        }

        // Загрузка файлов
        const avatarUpload = document.getElementById('avatar-upload');
        if (avatarUpload) {
            avatarUpload.addEventListener('change', (e) => this.uploadAvatar(e));
        }
        
        const imageUpload = document.getElementById('image-upload');
        if (imageUpload) {
            imageUpload.addEventListener('change', (e) => this.uploadImage(e));
        }
        
        // Клик вне области результатов поиска
        document.addEventListener('click', (e) => {
            const searchResults = document.getElementById('search-results');
            const userSearch = document.getElementById('user-search');
            
            if (searchResults && userSearch && 
                !searchResults.contains(e.target) && 
                !userSearch.contains(e.target)) {
                this.hideSearchResults();
            }
        });

        // Обновление статуса онлайн
        window.addEventListener('focus', () => this.updateOnlineStatus(true));
        window.addEventListener('blur', () => this.updateOnlineStatus(false));
        document.addEventListener('visibilitychange', () => {
            this.updateOnlineStatus(document.visibilityState === 'visible');
        });
    }

    // Дебаунс для поиска
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
        // Отписываемся от старых подписок
        this.realtimeSubscriptions.forEach(subscription => {
            supabase.removeChannel(subscription);
        });
        this.realtimeSubscriptions = [];

        // Подписка на новые сообщения
        const messagesChannel = supabase
            .channel('messages')
            .on('postgres_changes', 
                { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'messages' 
                }, 
                (payload) => {
                    if (this.currentChat && payload.new.chat_id === this.currentChat.id) {
                        this.loadMessages(this.currentChat.id);
                    }
                    this.loadChats(); // Обновляем список чатов
                }
            )
            .on('postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'messages'
                },
                (payload) => {
                    if (this.currentChat && payload.new.chat_id === this.currentChat.id) {
                        this.loadMessages(this.currentChat.id);
                    }
                }
            )
            .subscribe();

        // Подписка на изменения чатов
        const chatsChannel = supabase
            .channel('chats')
            .on('postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'chats'
                },
                (payload) => {
                    if (payload.new.user1_id === this.currentUser?.id || 
                        payload.new.user2_id === this.currentUser?.id) {
                        this.loadChats();
                    }
                }
            )
            .on('postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'chats'
                },
                (payload) => {
                    this.loadChats();
                }
            )
            .subscribe();

        // Подписка на изменения профилей
        const profilesChannel = supabase
            .channel('profiles')
            .on('postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles'
                },
                async (payload) => {
                    // Обновляем профиль текущего пользователя
                    if (payload.new.id === this.currentUser?.id) {
                        if (this.currentUser.profile) {
                            this.currentUser.profile = { ...this.currentUser.profile, ...payload.new };
                        }
                        this.updateUserUI();
                    }
                    
                    // Обновляем информацию в активном чате
                    if (this.currentChat) {
                        const partner = this.currentChat.user1_id === this.currentUser?.id 
                            ? this.currentChat.user2 
                            : this.currentChat.user1;
                        
                        if (partner && partner.id === payload.new.id) {
                            await this.loadChats();
                            if (this.currentChat) {
                                const updatedChat = this.chats.find(c => c.id === this.currentChat.id);
                                if (updatedChat) {
                                    this.currentChat = updatedChat;
                                    this.updateChatUI();
                                }
                            }
                        }
                    }
                    
                    // Обновляем список чатов
                    this.loadChats();
                }
            )
            .subscribe();

        // Подписка на статус онлайн
        const presenceChannel = supabase
            .channel('online-users')
            .on('presence', { event: 'sync' }, () => {
                const state = presenceChannel.presenceState();
                this.onlineUsers = new Set(Object.keys(state));
                this.updateOnlineStatusUI();
            })
            .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                newPresences.forEach(presence => {
                    this.onlineUsers.add(presence.user_id);
                });
                this.updateOnlineStatusUI();
            })
            .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                leftPresences.forEach(presence => {
                    this.onlineUsers.delete(presence.user_id);
                });
                this.updateOnlineStatusUI();
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED' && this.currentUser) {
                    await presenceChannel.track({
                        user_id: this.currentUser.id,
                        online_at: new Date().toISOString(),
                        last_seen: new Date().toISOString()
                    });
                }
            });

        this.realtimeSubscriptions = [messagesChannel, chatsChannel, profilesChannel, presenceChannel];

        // Периодическое обновление данных (как fallback)
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        this.updateInterval = setInterval(() => {
            if (this.currentUser) {
                this.loadChats();
                if (this.currentChat) {
                    this.loadMessages(this.currentChat.id);
                }
            }
        }, 30000); // Обновляем каждые 30 секунд
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
            statusElement.textContent = isOnline ? 'в сети' : 'не в сети';
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
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                console.error('Login error:', error);
                if (error.message.includes('Invalid login credentials')) {
                    this.showNotification('Неверный email или пароль', 'error');
                } else if (error.message.includes('Email not confirmed')) {
                    this.showNotification('Email не подтвержден', 'error');
                } else {
                    this.showNotification(error.message, 'error');
                }
                return;
            }

            this.currentUser = data.user;
            await this.loadUserProfile();
            this.showMainScreen();
            this.showNotification('Вход выполнен успешно', 'success');
            
            // Очистка полей
            if (emailInput) emailInput.value = '';
            if (passwordInput) passwordInput.value = '';
            
        } catch (error) {
            console.error('Login exception:', error);
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
            
            // Очистка полей
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
            // Обновляем статус перед выходом
            await this.updateOnlineStatus(false);
            
            // Отписываемся от всех подписок
            this.realtimeSubscriptions.forEach(subscription => {
                supabase.removeChannel(subscription);
            });
            this.realtimeSubscriptions = [];
            
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
                this.updateInterval = null;
            }
            
            const { error } = await supabase.auth.signOut();
            if (error) {
                console.error('Logout error:', error);
            }
            
            this.currentUser = null;
            this.currentChat = null;
            this.chats = [];
            this.messages = [];
            this.onlineUsers.clear();
            
            this.showAuthScreen();
            this.showNotification('Вы вышли из системы', 'success');
        } catch (error) {
            console.error('Logout exception:', error);
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
                // Профиль не существует, создаем его
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
                await this.loadChats();
            }
        } catch (error) {
            console.error('Load profile error:', error);
        }
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

            // Если найден только один пользователь, сразу создаем/открываем чат
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
                // Если найдено несколько пользователей, показываем список
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
            
            // Добавляем обработчик для кнопки начала чата
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
                
                if (error.code === '23505') { // Unique violation
                    // Чат уже существует, находим его
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
                            .select('content, created_at, image_url, sender_id')
                            .eq('chat_id', chat.id)
                            .order('created_at', { ascending: false })
                            .limit(1)
                            .single();

                        let lastMessageText = 'Нет сообщений';
                        if (lastMessage) {
                            if (lastMessage.image_url) {
                                lastMessageText = '🖼️ Изображение';
                            } else if (lastMessage.content) {
                                lastMessageText = lastMessage.content;
                            }
                            
                            // Помечаем прочитанными
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
                .eq('is_read', false);

            if (error) {
                console.error('Error marking messages as read:', error);
            }
        } catch (error) {
            console.error('Mark messages as read exception:', error);
        }
    }

    async selectChat(chat) {
        try {
            this.currentChat = chat;
            this.updateChatUI();
            await this.loadMessages(chat.id);
            
            // Помечаем сообщения как прочитанные
            await this.markMessagesAsRead(chat.id);
            
            // Активируем поле ввода
            const messageInput = document.getElementById('message-input');
            const sendBtn = document.getElementById('send-btn');
            
            if (messageInput) {
                messageInput.disabled = false;
                messageInput.focus();
            }
            if (sendBtn) sendBtn.disabled = false;
            
            // Показываем чат
            const chatHeader = document.getElementById('chat-header');
            const chatInputContainer = document.getElementById('chat-input-container');
            const noChatSelected = document.querySelector('.no-chat-selected');
            
            if (chatHeader) chatHeader.style.display = 'flex';
            if (chatInputContainer) chatInputContainer.style.display = 'flex';
            if (noChatSelected) noChatSelected.style.display = 'none';
            
            this.hideSearchResults();
            
        } catch (error) {
            console.error('Error selecting chat:', error);
            this.showNotification('Ошибка выбора чата', 'error');
        }
    }

    async loadMessages(chatId) {
        try {
            const { data, error } = await supabase
                .from('messages')
                .select(`
                    *,
                    sender:profiles(*)
                `)
                .eq('chat_id', chatId)
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

            // Проверяем, является ли пользователь участником чата
            const isParticipant = this.currentChat.user1_id === this.currentUser.id || 
                                  this.currentChat.user2_id === this.currentUser.id;
            
            if (!isParticipant) {
                this.showNotification('Вы не участник этого чата', 'error');
                return;
            }

            const { data, error } = await supabase
                .from('messages')
                .insert([
                    {
                        chat_id: this.currentChat.id,
                        sender_id: this.currentUser.id,
                        content: text,
                        created_at: new Date().toISOString(),
                        is_read: false
                    }
                ])
                .select('*') // Возвращаем вставленные данные
                .single();

            if (error) {
                console.error('Send message error details:', error);
                
                // Более подробные сообщения об ошибках
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

            if (input) {
                input.value = '';
                input.focus();
            }
            
            // Немедленно обновляем сообщения
            await this.loadMessages(this.currentChat.id);
            
        } catch (error) {
            console.error('Send message exception:', error);
            this.showNotification('Неизвестная ошибка при отправке сообщения', 'error');
        }
    }

    async uploadAvatar(event) {
        const file = event.target.files[0];
        if (!file || !this.currentUser) return;

        if (file.size > 5 * 1024 * 1024) {
            this.showNotification('Файл слишком большой (макс 5MB)', 'error');
            return;
        }

        // Проверяем тип файла
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            this.showNotification('Недопустимый тип файла. Используйте JPG, PNG, GIF или WebP', 'error');
            return;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${this.currentUser.id}/${Date.now()}.${fileExt}`;

        try {
            // Сначала удаляем старый аватар, если он есть
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

            // Загружаем новый аватар
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

            // Получаем публичный URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName);

            // Обновляем профиль в базе данных
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

            // Обновляем локальные данные
            if (this.currentUser.profile) {
                this.currentUser.profile.avatar_url = publicUrl;
                this.currentUser.profile.updated_at = new Date().toISOString();
            }
            
            this.updateUserUI();
            this.loadChats(); // Обновляем чаты, чтобы везде отобразился новый аватар
            this.showNotification('Аватар обновлен', 'success');
            
        } catch (error) {
            console.error('Error uploading avatar:', error);
            this.showNotification(`Ошибка загрузки аватара: ${error.message}`, 'error');
        }
        
        event.target.value = '';
    }

    async uploadImage(event) {
        const file = event.target.files[0];
        if (!file || !this.currentChat || !this.currentUser) {
            console.error('Cannot upload image: missing data');
            return;
        }

        // Проверяем, является ли пользователь участником чата
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

        const fileExt = file.name.split('.').pop();
        const fileName = `${this.currentUser.id}/${Date.now()}.${fileExt}`;

        try {
            this.showNotification('Загрузка изображения...', 'info');

            // Загружаем в Storage
            const { error: uploadError } = await supabase.storage
                .from('chat_images')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) {
                console.error('Upload error:', uploadError);
                throw new Error(`Ошибка загрузки: ${uploadError.message}`);
            }

            // Получаем публичный URL
            const { data: { publicUrl } } = supabase.storage
                .from('chat_images')
                .getPublicUrl(fileName);

            console.log('Uploaded image URL:', publicUrl);

            // Вставляем сообщение с изображением
            const { data: messageData, error: messageError } = await supabase
                .from('messages')
                .insert([
                    {
                        chat_id: this.currentChat.id,
                        sender_id: this.currentUser.id,
                        content: '🖼️ Изображение',
                        image_url: publicUrl,
                        created_at: new Date().toISOString(),
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
            
            // Немедленно обновляем сообщения
            await this.loadMessages(this.currentChat.id);
            
        } catch (error) {
            console.error('Error uploading image:', error);
            this.showNotification(`Ошибка загрузки изображения: ${error.message}`, 'error');
        } finally {
            event.target.value = '';
        }
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
        
        // Обновляем основной аватар
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
        
        // Обновляем имя
        const currentUserName = document.getElementById('current-user-name');
        if (currentUserName) currentUserName.textContent = profile.username;
        
        // Обновляем email
        const currentUserEmail = document.getElementById('current-user-email');
        if (currentUserEmail) currentUserEmail.textContent = profile.email;
        
        // Обновляем дату обновления
        const currentUserUpdated = document.getElementById('current-user-updated');
        if (currentUserUpdated && profile.updated_at) {
            const updatedDate = new Date(profile.updated_at);
            currentUserUpdated.textContent = `Обновлено: ${updatedDate.toLocaleDateString('ru-RU')}`;
        }
    }

    updateChatUI() {
        if (!this.currentChat || !this.currentUser) return;

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
            `;
            
            chatItem.addEventListener('click', () => this.selectChat(chat));
            container.appendChild(chatItem);
        });
    }

    renderMessages() {
        const container = document.getElementById('messages-container');
        if (!container) return;

        container.innerHTML = '';

        if (!this.messages || this.messages.length === 0) {
            container.innerHTML = '<div class="empty-chat"><p>Нет сообщений. Начните общение!</p></div>';
            return;
        }

        let lastSenderId = null;
        let lastDate = null;

        this.messages.forEach((message, index) => {
            const isSent = message.sender_id === this.currentUser.id;
            const messageDate = new Date(message.created_at).toDateString();
            
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
            messageDiv.className = `message ${isSent ? 'sent' : 'received'} ${lastSenderId === message.sender_id ? 'same-sender' : ''}`;
            
            let content = '';
            
            if (message.image_url) {
                content += `
                    <div class="message-image-container">
                        <img src="${message.image_url}" alt="Изображение" class="message-img" loading="lazy" onerror="this.style.display='none'; this.parentElement.innerHTML+='<div class=\\'message-text\\'>⚠️ Не удалось загрузить изображение</div>'">
                        ${message.content !== '🖼️ Изображение' ? `<div class="message-text">${message.content}</div>` : ''}
                    </div>
                `;
            } else {
                content += `<div class="message-text">${message.content}</div>`;
            }
            
            content += `
                <div class="message-footer">
                    <div class="message-time">${this.formatTime(message.created_at)}</div>
                    ${isSent ? `<div class="message-status ${message.is_read ? 'read' : 'unread'}">${message.is_read ? '✓✓' : '✓'}</div>` : ''}
                </div>
            `;
            
            messageDiv.innerHTML = content;
            
            if (message.image_url) {
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