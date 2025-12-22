// Конфигурация вашего Supabase проекта
const SUPABASE_URL = 'https://khosjiirbcxkgbpwsgmx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtob3NqaWlyYmN4a2dicHdzZ214Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzODE0OTAsImV4cCI6MjA4MTk1NzQ5MH0.swOufpecF3q913aUOfaCU_bJGaP5F_EUyYenXjNGON8';

// Инициализация Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export { supabase };