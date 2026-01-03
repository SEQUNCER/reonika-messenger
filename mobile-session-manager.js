import { supabase } from './supabase.js';

class MobileSessionManager {
    constructor() {
        this.sessionCheckInterval = null;
        this.isOnline = navigator.onLine;
        this.lastActivity = Date.now();
        
        this.initNetworkListeners();
        this.startActivityTracking();
    }

    initNetworkListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            console.log('Network connection restored');
            this.validateSession();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.log('Network connection lost');
        });
    }

    startActivityTracking() {
        // Отслеживаем активность пользователя
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
        
        events.forEach(event => {
            document.addEventListener(event, () => {
                this.lastActivity = Date.now();
            }, { passive: true });
        });
    }

    async validateSession() {
        if (!this.isOnline) return false;

        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            
            if (error) {
                console.error('Session validation error:', error);
                this.clearStoredSession();
                return false;
            }

            if (!session) {
                console.log('No active session found');
                this.clearStoredSession();
                return false;
            }

            // Проверяем, не истек ли токен
            const now = Date.now();
            const expiresAt = session.expires_at ? new Date(session.expires_at).getTime() : 0;
            
            if (expiresAt <= now) {
                console.log('Session expired');
                this.clearStoredSession();
                return false;
            }

            console.log('Session is valid');
            return true;

        } catch (error) {
            console.error('Session validation exception:', error);
            this.clearStoredSession();
            return false;
        }
    }

    clearStoredSession() {
        localStorage.removeItem('supabase.auth.token');
        localStorage.removeItem('supabase.auth.refreshToken');
        sessionStorage.removeItem('supabase.auth.token');
        sessionStorage.removeItem('supabase.auth.refreshToken');
        console.log('Stored session data cleared');
    }

    startSessionMonitoring() {
        // Проверяем сессию каждые 5 минут
        this.sessionCheckInterval = setInterval(() => {
            this.validateSession();
        }, 5 * 60 * 1000);

        // Также проверяем при возврате на страницу
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.isOnline) {
                const timeSinceLastActivity = Date.now() - this.lastActivity;
                
                // Если пользователь был неактивен более 30 минут, проверяем сессию
                if (timeSinceLastActivity > 30 * 60 * 1000) {
                    this.validateSession();
                }
            }
        });
    }

    stopSessionMonitoring() {
        if (this.sessionCheckInterval) {
            clearInterval(this.sessionCheckInterval);
            this.sessionCheckInterval = null;
        }
    }

    async restoreSession() {
        console.log('Attempting to restore session...');
        
        // Проверяем наличие сохраненных данных сессии
        const hasStoredSession = localStorage.getItem('supabase.auth.token') || 
                               sessionStorage.getItem('supabase.auth.token');

        if (!hasStoredSession) {
            console.log('No stored session data found');
            return false;
        }

        if (!this.isOnline) {
            console.log('Device is offline, cannot validate session');
            return false;
        }

        try {
            const { data: { session }, error } = await supabase.auth.getSession();

            if (error) {
                console.error('Error restoring session:', error);
                this.clearStoredSession();
                return false;
            }

            if (session && session.user) {
                console.log('Session restored successfully');
                return true;
            } else {
                console.log('No valid session to restore');
                this.clearStoredSession();
                return false;
            }

        } catch (error) {
            console.error('Session restoration exception:', error);
            this.clearStoredSession();
            return false;
        }
    }

    // Проверяем, находится ли приложение в мобильном режиме
    isMobileApp() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               (window.innerWidth <= 768 && 'ontouchstart' in window);
    }

    // Получаем информацию о состоянии приложения
    getAppState() {
        return {
            isOnline: this.isOnline,
            isMobile: this.isMobileApp(),
            lastActivity: this.lastActivity,
            hasStoredSession: !!(localStorage.getItem('supabase.auth.token') || 
                               sessionStorage.getItem('supabase.auth.token'))
        };
    }
}

// Экспортируем для использования в других модулях
export { MobileSessionManager };

// Глобальный экземпляр для удобства использования
window.mobileSessionManager = new MobileSessionManager();
