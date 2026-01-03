import { supabase } from './supabase.js';

class LoginManager {
    constructor() {
        this.initEventListeners();
        this.initAuthStateListener();
        this.checkAuth();
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
                    window.location.href = 'index.html';
                    break;

                case 'SIGNED_OUT':
                    console.log('User signed out');
                    break;

                case 'INITIAL_SESSION':
                    console.log('Initial session');
                    if (session?.user) {
                        window.location.href = 'index.html';
                    }
                    break;
            }
        });
    }

    async checkAuth() {
        try {
            const { data: { session }, error } = await supabase.auth.getSession();

            if (error) {
                console.error('Session error:', error);
                return;
            }

            if (session) {
                console.log('Found existing session, redirecting to main app');
                window.location.href = 'index.html';
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