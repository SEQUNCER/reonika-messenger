// supabase.js - исправленная версия
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://khosjiirbcxkgbpwsgmx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtob3NqaWlyYmN4a2dicHdzZ214Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjM4MTQ5MCwiZXhwIjoyMDgxOTU3NDkwfQ.9O0CiAQCkl7CluomZhiLk1R82p4gMbD1ns69InzVVZM';

// Создаем клиент Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
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

// Экспортируем глобально для совместимости
window.supabase = supabase;

export { supabase };
