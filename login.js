import { supabase } from './supabase.js';
import { MobileSessionManager } from './mobile-session-manager.js';

class LoginManager {
    constructor() {
        this.initEventListeners();
        this.initAuthStateListener();
        this.checkAuth();
        
        // Инициализируем менеджер мобильных сессий
        if (window.mobileSessionManager) {
            window.mobileSessionManager.startSessionMonitoring();
            console.log('Mobile session manager started on login page');
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
    }

    initAuthStateListener() {
        supabase.auth.onAuthStateChange((event, session) => {
            console.log('Auth state changed:', event, session);

            switch (event) {
                case 'SIGNED_IN':
                    console.log('User signed in, redirecting to main app');
                    // Небольшая задержка для сохранения сессии
                    setTimeout(() => {
                        this.redirectToMainApp();
                    }, 500);
                    break;

                case 'SIGNED_OUT':
                    console.log('User signed out');
                    break;

                case 'INITIAL_SESSION':
                    console.log('Initial session');
                    if (session?.user) {
                        this.redirectToMainApp();
                    }
                    break;
            }
        });
    }

    redirectToMainApp() {
        // Проверяем на наличие циклических перенаправлений
        const redirectCount = sessionStorage.getItem('auth_state_redirect_count') || '0';
        const lastRedirectTime = sessionStorage.getItem('auth_state_redirect_time') || '0';
        const now = Date.now();
        
        // Если было более 3 перенаправлений за последние 10 секунд, это цикл
        if (parseInt(redirectCount) > 3 && (now - parseInt(lastRedirectTime)) < 10000) {
            console.error('Detected auth state redirect loop, stopping redirects');
            sessionStorage.removeItem('auth_state_redirect_count');
            sessionStorage.removeItem('auth_state_redirect_time');
            return;
        }
        
        // Увеличиваем счетчик перенаправлений
        sessionStorage.setItem('auth_state_redirect_count', (parseInt(redirectCount) + 1).toString());
        sessionStorage.setItem('auth_state_redirect_time', now.toString());
        
        window.location.href = 'index.html';
    }

    async checkAuth() {
        try {
            // Проверяем валидность сессии напрямую
            const sessionPromise = supabase.auth.getSession();
            const timeoutPromise = new Promise((resolve) => 
                setTimeout(() => resolve({ data: { session: null }, error: { message: 'Connection timeout' } }), 10000)
            );
            
            const { data: { session }, error } = await Promise.race([sessionPromise, timeoutPromise]);

            if (error) {
                console.error('Session error:', error);
                this.clearStoredAuth();
                return;
            }

            if (session) {
                // Дополнительно проверяем пользователя
                const userPromise = supabase.auth.getUser();
                const userTimeoutPromise = new Promise((resolve) => 
                    setTimeout(() => resolve({ data: { user: null }, error: { message: 'Connection timeout' } }), 10000)
                );
                
                const { data: { user }, error: userError } = await Promise.race([userPromise, userTimeoutPromise]);

                if (userError || !user) {
                    console.log('Invalid user session, clearing stored data');
                    this.clearStoredAuth();
                    return;
                }

                console.log('Found valid session, redirecting to main app');
                
                // Проверяем на наличие циклических перенаправлений
                const redirectCount = sessionStorage.getItem('login_redirect_count') || '0';
                const lastRedirectTime = sessionStorage.getItem('login_redirect_time') || '0';
                const now = Date.now();
                
                // Если было более 3 перенаправлений за последние 10 секунд, это цикл
                if (parseInt(redirectCount) > 3 && (now - parseInt(lastRedirectTime)) < 10000) {
                    console.error('Detected redirect loop, stopping redirects');
                    sessionStorage.removeItem('login_redirect_count');
                    sessionStorage.removeItem('login_redirect_time');
                    this.clearStoredAuth();
                    return;
                }
                
                // Увеличиваем счетчик перенаправлений
                sessionStorage.setItem('login_redirect_count', (parseInt(redirectCount) + 1).toString());
                sessionStorage.setItem('login_redirect_time', now.toString());
                
                window.location.href = 'index.html';
            } else {
                console.log('No valid session found, clearing stored data');
                this.clearStoredAuth();
            }
        } catch (error) {
            console.error('Check auth error:', error);
            this.clearStoredAuth();
        }
    }

    clearStoredAuth() {
        // Очищаем сохраненные данные авторизации
        localStorage.removeItem('supabase.auth.token');
        localStorage.removeItem('supabase.auth.refreshToken');
        sessionStorage.removeItem('supabase.auth.token');
        sessionStorage.removeItem('supabase.auth.refreshToken');
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

            // Redirect will happen via auth state listener

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
}

document.addEventListener('DOMContentLoaded', () => {
    window.loginManager = new LoginManager();
});
