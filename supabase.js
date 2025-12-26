// supabase.js - обновленный с настройками для сессий
const SUPABASE_URL = 'https://khosjiirbcxkgbpwsgmx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtob3NqaWlyYmN4a2dicHdzZ214Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzODE0OTAsImV4cCI6MjA4MTk1NzQ5MH0.swOufpecF3q913aUOfaCU_bJGaP5F_EUyYenXjNGON8';

// Инициализация Supabase с настройками для сохранения сессии
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storageKey: 'reonika_auth',
        storage: {
            getItem: (key) => {
                try {
                    return JSON.parse(localStorage.getItem(key));
                } catch (error) {
                    return null;
                }
            },
            setItem: (key, value) => {
                try {
                    localStorage.setItem(key, JSON.stringify(value));
                } catch (error) {
                    console.warn('LocalStorage setItem error:', error);
                }
            },
            removeItem: (key) => {
                try {
                    localStorage.removeItem(key);
                } catch (error) {
                    console.warn('LocalStorage removeItem error:', error);
                }
            }
        }
    }
});

// Функция для проверки и восстановления сессии
export const checkAndRestoreSession = async () => {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
            console.error('Session error:', error);
            return null;
        }
        
        return session;
    } catch (error) {
        console.error('Check session error:', error);
        return null;
    }
};

// Функция для получения текущего пользователя
export const getCurrentUser = async () => {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error) {
            console.error('Get user error:', error);
            return null;
        }
        
        return user;
    } catch (error) {
        console.error('Get current user error:', error);
        return null;
    }
};

export { supabase };