import { supabase } from './supabase.js';
import { MobileSessionManager } from './mobile-session-manager.js';
import { REonikaMessenger } from './app.js';

class AuthRedirectManager {
    constructor() {
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                         (window.innerWidth <= 768 && 'ontouchstart' in window);
        this.init();
    }

    async init() {
        console.log('Auth Redirect Manager initialized. Mobile:', this.isMobile);
        
        // Проверяем, не находимся ли мы уже на странице логина
        if (window.location.pathname.includes('login.html')) {
            console.log('Already on login page, skipping auth redirect');
            return;
        }
        
        // Показываем загрузочный экран
        this.showLoading();
        
        try {
            // Проверяем валидность сессии напрямую, без проверки сохраненных данных
            const isValidSession = await this.validateSession();
            
            if (isValidSession) {
                console.log('Valid session found, staying on main page');
                this.hideLoading();
                // Инициализируем основное приложение
                this.initializeMainApp();
            } else {
                console.log('Invalid or expired session, clearing data and redirecting to login');
                this.clearStoredAuth();
                this.redirectToLogin();
            }
            
        } catch (error) {
            console.error('Auth redirect error:', error);
            this.clearStoredAuth();
            this.redirectToLogin();
        }
    }

    async validateSession() {
        try {
            // Добавляем таймаут для предотвращения долгой загрузки
            const sessionPromise = supabase.auth.getSession();
            const timeoutPromise = new Promise((resolve) => 
                setTimeout(() => resolve({ data: { session: null }, error: { message: 'Connection timeout' } }), 10000)
            );
            
            const { data: { session }, error } = await Promise.race([sessionPromise, timeoutPromise]);

            if (error) {
                console.error('Session validation error:', error);
                return false;
            }

            if (!session) {
                console.log('No active session found');
                return false;
            }

            // Проверяем, не истек ли токен
            const now = Date.now();
            const expiresAt = session.expires_at ? new Date(session.expires_at).getTime() : 0;
            
            if (expiresAt <= now) {
                console.log('Session expired');
                return false;
            }

            // Дополнительно проверяем пользователя
            const userPromise = supabase.auth.getUser();
            const userTimeoutPromise = new Promise((resolve) => 
                setTimeout(() => resolve({ data: { user: null }, error: { message: 'Connection timeout' } }), 10000)
            );
            
            const { data: { user }, error: userError } = await Promise.race([userPromise, userTimeoutPromise]);

            if (userError) {
                console.error('User validation error:', userError);
                return false;
            }

            if (!user) {
                console.log('No valid user found');
                return false;
            }

            console.log('Session is valid for user:', user.email);
            return true;

        } catch (error) {
            console.error('Session validation exception:', error);
            return false;
        }
    }

    clearStoredAuth() {
        localStorage.removeItem('supabase.auth.token');
        localStorage.removeItem('supabase.auth.refreshToken');
        sessionStorage.removeItem('supabase.auth.token');
        sessionStorage.removeItem('supabase.auth.refreshToken');
        console.log('Stored session data cleared');
    }

    redirectToLogin() {
        // Проверяем, не находимся ли мы уже на странице логина
        if (window.location.pathname.includes('login.html')) {
            this.hideLoading();
            return;
        }
        
        // Проверяем на наличие циклических перенаправлений
        const redirectCount = sessionStorage.getItem('auth_redirect_count') || '0';
        const lastRedirectTime = sessionStorage.getItem('auth_redirect_time') || '0';
        const now = Date.now();
        
        // Если было более 3 перенаправлений за последние 10 секунд, это цикл
        if (parseInt(redirectCount) > 3 && (now - parseInt(lastRedirectTime)) < 10000) {
            console.error('Detected redirect loop, stopping redirects');
            sessionStorage.removeItem('auth_redirect_count');
            sessionStorage.removeItem('auth_redirect_time');
            this.clearStoredAuth();
            this.hideLoading();
            return;
        }
        
        // Увеличиваем счетчик перенаправлений
        sessionStorage.setItem('auth_redirect_count', (parseInt(redirectCount) + 1).toString());
        sessionStorage.setItem('auth_redirect_time', now.toString());
        
        console.log('Redirecting to login page');
        window.location.href = 'login.html';
    }

    initializeMainApp() {
        // Инициализируем основное приложение только если сессия валидна
        if (typeof window.messenger === 'undefined') {
            try {
                // Создаем экземпляр приложения напрямую
                window.messenger = new REonikaMessenger();
                console.log('Main app initialized successfully');
            } catch (error) {
                console.error('Failed to initialize main app:', error);
                this.redirectToLogin();
            }
        }
        
        // Инициализируем менеджер мобильных сессий
        if (window.mobileSessionManager) {
            window.mobileSessionManager.startSessionMonitoring();
        }
    }

    showLoading() {
        let loadingOverlay = document.getElementById('loading-overlay');
        if (!loadingOverlay) {
            loadingOverlay = document.createElement('div');
            loadingOverlay.id = 'loading-overlay';
            loadingOverlay.className = 'loading-overlay';
            loadingOverlay.innerHTML = `
                <div class="loading-spinner">
                    <div class="spinner"></div>
                    <div class="loading-text">Загрузка...</div>
                </div>
            `;
            document.body.appendChild(loadingOverlay);
        }
        loadingOverlay.classList.remove('hidden');
    }

    hideLoading() {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.classList.add('hidden');
        }
    }
}

// Инициализируем менеджер перенаправления авторизации
document.addEventListener('DOMContentLoaded', () => {
    // Проверяем, что мы на основной странице, а не на странице логина
    if (!window.location.pathname.includes('login.html')) {
        window.authRedirectManager = new AuthRedirectManager();
    }
});
