# Push Уведомления для REonika

## Обзор

Система push-уведомлений REonika поддерживает:
- **Push API** для современных браузеров на PC
- **Service Worker** для фоновых уведомлений
- **WebView интеграцию** для мобильных приложений
- **Fallback уведомления** для старых браузеров

## Установка

### 1. Создание таблицы в Supabase

Выполните SQL из файла `push_subscriptions_table.sql` в вашей базе Supabase:

```sql
-- Скопируйте и выполните содержимое файла push_subscriptions_table.sql
```

### 2. Подключение модулей

Убедитесь что все модули подключены в `index.html`:

```html
<script type="module" src="mobile-enhancements.js"></script>
<script type="module" src="notifications.js"></script>
<script type="module" src="permission-manager.js"></script>
<script type="module" src="webview-integration.js"></script>
```

## Как это работает

### Для браузеров с поддержкой Push API

1. **Service Worker регистрация**: Создается автоматически при загрузке
2. **Push подписка**: Запрашивается разрешение и создается подписка
3. **VAPID ключи**: Используются для безопасности推送-сообщений
4. **Офлайн поддержка**: Уведомления работают даже когда вкладка неактивна

### Для мобильных WebView

1. **Определение WebView**: Автоматически определяется тип устройства
2. **Native Bridge**: Создается мост к нативному коду
3. **Нативные уведомления**: Интегрируются с системой уведомлений ОС
4. **Оптимизация интерфейса**: Специальные стили для WebView

## Тестирование

### Базовое тестирование

```javascript
// Проверить статус push-уведомлений
console.log(getNotificationStatus());

// Тестовое уведомление
testNotification();

// Проверить информацию о WebView
console.log(getWebViewInfo());
```

### Тестирование в консоли

Откройте консоль разработчика и выполните:

```javascript
// Проверить поддержку
window.notifications.getStatus()

// Отправить тестовое уведомление
window.notifications.testNotification()

// Проверить WebView статус
window.webViewIntegration.getDeviceInfo()
```

## Интеграция с мобильными приложениями

### Android WebView

Для интеграции с Android WebView добавьте в Java/Kotlin код:

```java
// JavaScript интерфейс
public class WebAppInterface {
    @JavascriptInterface
    public void showNotification(String title, String body, String data) {
        // Показать нативное уведомление
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context)
            .setSmallIcon(R.drawable.icon)
            .setContentTitle(title)
            .setContentText(body);
            
        NotificationManager notificationManager = 
            (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        notificationManager.notify(1, builder.build());
    }
}

// Добавить интерфейс к WebView
webView.addJavascriptInterface(new WebAppInterface(), "REonikaWebView");
```

### iOS WebView

Для интеграции с iOS WebView используйте:

```swift
// Message handler для уведомлений
func userContentController(_ userContentController: WKUserContentController, 
                            didReceive message: WKScriptMessage) {
    if message.name == "showNotification" {
        // Показать нативное уведомление
        let content = UNUserNotificationContent()
        content.title = message.body["title"] as? String ?? ""
        content.body = message.body["body"] as? String ?? ""
        
        UNUserNotificationCenter.current().add(content)
    }
}

// Добавить message handler
configuration.userContentController.add(self, name: "showNotification")
```

## VAPID Ключи

Для production использования нужно сгенерировать реальные VAPID ключи:

```bash
# Установить web-push библиотеку
npm install -g web-push

# Сгенерировать ключи
web-push generate-vapid-keys
```

Замените демонстрационные ключи в `notifications.js`:

```javascript
const applicationServerKey = this.urlB64ToUint8Array(
    'ВАШ_PUBLIC_VAPID_КЛЮЧ' // Замените на ваш ключ
);
```

## API Методы

### Основные методы

```javascript
// Получить статус уведомлений
window.notifications.getStatus()

// Показать тестовое уведомление
window.notifications.testNotification()

// Показать нативное уведомление (для WebView)
window.notifications.showNativeNotification(title, body, data)

// Получить информацию о WebView
window.webViewIntegration.getDeviceInfo()
```

### События

```javascript
// Обработка тапа на уведомление
window.handleNativeMessage = function(message) {
    switch(message.type) {
        case 'notificationTapped':
            // Обработка клика на уведомление
            break;
        case 'appLaunched':
            // Обработка запуска из уведомления
            break;
    }
}
```

## Отладка

### Проверка логов

```javascript
// Включить отладочные логи
localStorage.setItem('debug_notifications', 'true');

// Проверить консоль
console.log('Notifications:', window.notifications);
console.log('WebView Integration:', window.webViewIntegration);
```

### Распространенные проблемы

1. **Разрешение отклонено**: Проверьте настройки браузера
2. **Service Worker не регистрируется**: Проверьте HTTPS
3. **WebView не определяется**: Проверьте User Agent
4. **Уведомления не показываются**: Проверьте системные настройки

## Совместимость

### Поддерживаемые браузеры

- ✅ Chrome 50+
- ✅ Firefox 44+
- ✅ Safari 16+ (macOS)
- ✅ Edge 17+
- ✅ Android WebView 70+
- ✅ iOS WKWebView

### Ограничения

- Требуется HTTPS для production
- Нужны разрешения пользователя
- Некоторые старые браузеры не поддерживаются

## Production настройка

1. **Сгенерируйте VAPID ключи**
2. **Настройте HTTPS**
3. **Добавьте домен в whitelist**
4. **Протестируйте на различных устройствах**
5. **Настройте fallback для старых браузеров**

## Безопасность

- Все уведомления шифруются с помощью VAPID
- Подписки уникальны для каждого устройства
- RLS политики в базе данных защищают данные пользователей
- Service Worker работает в изолированной среде

## Поддержка

При возникновении проблем:

1. Проверьте консоль браузера
2. Убедитесь что все модули загружены
3. Проверьте права доступа в Supabase
4. Протестируйте на разных устройствах

Для дополнительной информации смотрите логи в консоли и используйте методы отладки.
