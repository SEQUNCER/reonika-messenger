# reonika-messenger

## Настройка Push-уведомлений

Для работы push-уведомлений необходимо выполнить следующие шаги:

### 1. Настройка Firebase
1. Перейдите в [Firebase Console](https://console.firebase.google.com/)
2. Выберите проект "reonika-push" или создайте новый
3. В разделе "Project settings" > "General" скопируйте:
   - API Key
   - Project ID
   - Sender ID
   - App ID

### 2. Обновление конфигурационных файлов
Замените плейсхолдеры в файлах:

Firebase конфигурация уже настроена с вашими ключами в `firebase-config.js` и `sw.js`.

**notifications.js:**
```javascript
this.fcmToken = await getToken(messaging, {
    vapidKey: 'ВАШ_VAPID_KEY' // Получить в Firebase Console > Project Settings > Cloud Messaging > Web Push certificates
});
```

### 3. Настройка базы данных Supabase
Добавьте колонку `fcm_token` в таблицу `profiles`:
```sql
ALTER TABLE profiles ADD COLUMN fcm_token TEXT;
```

### 4. Настройка Supabase Edge Functions
1. Установите Supabase CLI: `npm install -g supabase`
2. Войдите в аккаунт: `supabase login`
3. Перейдите в папку проекта: `cd supabase`
4. Разверните функцию: `supabase functions deploy send-notification`

### 5. Переменные окружения не нужны
Функция использует встроенные Firebase credentials для аутентификации

### 6. Разверните Edge Function
```bash
npx supabase functions deploy send-notification
```
Или через Supabase Dashboard > Edge Functions > Создать функцию "send-notification" и вставить код из файла `supabase/functions/send-notification/index.ts`

### 6. Тестирование
1. Откройте приложение в браузере
2. Предоставьте разрешение на уведомления
3. Отправьте сообщение другому пользователю
4. Push-уведомление должно прийти даже при закрытой вкладке

## Особенности
- Push-уведомления работают бесплатно через Firebase Cloud Messaging
- Серверная часть использует Supabase Edge Functions (бесплатно)
- Уведомления приходят даже когда приложение закрыто
- Поддержка foreground и background уведомлений
