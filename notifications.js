// notifications.js - НОВАЯ ПРОСТАЯ СИСТЕМА УВЕДОМЛЕНИЙ
class REonikaNotifications {
    constructor(messenger) {
        this.messenger = messenger;
        this.notificationPermission = 'default';
        this.isOnline = navigator.onLine;
        this.init();
    }

    async init() {
        console.log('🚀 Инициализация новой системы уведомлений...');

        // Запрос разрешений на уведомления
        await this.requestPermission();

        // Настройка онлайн/оффлайн статус
        this.setupOnlineStatus();

        // Настройка визуальных индикаторов
        this.setupVisualIndicators();

        // Проверяем, авторизован ли пользователь
        if (this.messenger?.currentUser) {
            // Получение FCM токена и настройка realtime подписок
            await this.getFCMToken();
            this.setupRealtime();
        } else {
            // Подписываемся на событие авторизации
            this.setupAuthListener();
        }

        console.log('✅ Новая система уведомлений инициализирована');
    }

    async requestPermission() {
        if (!('Notification' in window)) {
            console.log('❌ Notifications API не поддерживается');
            return;
        }

        // Запрос разрешения на уведомления
        this.notificationPermission = await Notification.requestPermission();

        if (this.notificationPermission === 'granted') {
            console.log('✅ Разрешение на уведомления получено');
        } else {
            console.log('❌ Разрешение на уведомления отклонено');
        }
    }

    async getFCMToken() {
        console.log('🔑 Начинаем получение FCM токена...');

        if (!window.firebaseGetToken || !window.firebaseMessaging) {
            console.log('❌ Firebase messaging не инициализирован');
            console.log('window.firebaseGetToken:', window.firebaseGetToken);
            console.log('window.firebaseMessaging:', window.firebaseMessaging);
            return;
        }

        if (this.notificationPermission !== 'granted') {
            console.log('⚠️ Разрешения на уведомления не предоставлены, пропускаем FCM токен');
            return;
        }

        try {
            console.log('📡 Пытаемся получить FCM токен...');

            // Сначала попробуем без VAPID ключа для диагностики
            let token;
            try {
                console.log('🔄 Попытка получения токена без VAPID ключа...');
                token = await window.firebaseGetToken();
                console.log('✅ Токен получен без VAPID:', !!token);
            } catch (noVapidError) {
                console.log('⚠️ Не удалось получить токен без VAPID:', noVapidError.message);
            }

            // Если не получилось, пробуем с VAPID ключом
            if (!token) {
                console.log('🔄 Попытка получения токена с VAPID ключом...');
                // VAPID ключ должен быть сгенерирован в Firebase Console для web push
                const vapidKey = "BP9MbxkOem3B6DXtLDWIZs3iLzsLNTzZ2_KVnMAgbPvroRO6VmU2NliFmDFI8TJLdsANTJWV8ZBoG51nngk3tQA";
                console.log('🔑 Используем VAPID ключ:', vapidKey.substring(0, 20) + '...');

                token = await window.firebaseGetToken({
                    vapidKey: vapidKey
                });
            }

            if (token) {
                console.log('✅ FCM токен получен:', token.substring(0, 20) + '...');
                this.fcmToken = token;

                // Сохраняем токен в базе данных
                await this.saveFCMTokenToDatabase(token);

                // Настраиваем обработчик сообщений
                window.firebaseOnMessage((payload) => {
                    console.log('📨 Получено сообщение в foreground:', payload);
                    this.showNotificationFromPayload(payload);
                });

            } else {
                console.log('❌ FCM токен не получен ни одним способом');
                console.log('💡 Возможные причины:');
                console.log('   - Неправильный VAPID ключ');
                console.log('   - Приложение не запущено на HTTPS (для продакшена)');
                console.log('   - Firebase проект не настроен для web push');
            }
        } catch (error) {
            console.error('❌ Ошибка получения FCM токена:', error);
            console.error('Детали ошибки:', error);
        }
    }

    async saveFCMTokenToDatabase(token) {
        if (!this.messenger?.currentUser?.id) {
            console.log('⚠️ Пользователь не авторизован, токен не сохранен');
            return;
        }

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ fcm_token: token })
                .eq('id', this.messenger.currentUser.id);

            if (error) {
                console.error('❌ Ошибка сохранения FCM токена в базу данных:', error);
            } else {
                console.log('✅ FCM токен сохранен в базу данных');
            }
        } catch (error) {
            console.error('❌ Ошибка сохранения FCM токена:', error);
        }
    }

    setupRealtime() {
        if (!this.messenger) return;

        const userId = this.messenger.currentUser?.id;
        if (!userId) return;

        console.log('📡 Настройка realtime подписок для уведомлений...');

        // Подписка на новые сообщения в чатах пользователя
        // Используем тот же канал, что и в app.js
        const messageSubscription = supabase
            .channel('messages')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages'
            }, async (payload) => {
                const message = payload.new;

                // Проверяем, что сообщение не от самого пользователя
                if (message.sender_id === userId) return;

                console.log('📨 Новое сообщение для уведомления:', message);
                await this.handleNewMessage(message);
            })
            .subscribe();

        // Подписка на изменения статуса пользователей
        const presenceSubscription = supabase
            .channel('presence-updates')
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'profiles',
                filter: `id=neq.${userId}`
            }, (payload) => {
                console.log('👤 Изменение статуса пользователя:', payload);
                this.handlePresenceUpdate(payload);
            })
            .subscribe();

        this.messenger.realtimeSubscriptions.push(messageSubscription);
        this.messenger.realtimeSubscriptions.push(presenceSubscription);
    }

    async handleNewMessage(message) {
        try {
            // Получаем данные отправителя
            const { data: sender } = await supabase
                .from('profiles')
                .select('username, avatar_url')
                .eq('id', message.sender_id)
                .single();

            if (!sender) return;

            // Определяем тип уведомления
            const notificationType = this.getNotificationType(message);

            // Отправляем уведомление выбранного типа
            await this.sendNotificationByType(notificationType, sender, message);

            // Визуальные индикаторы
            this.updateVisualIndicators();

        } catch (error) {
            console.error('❌ Ошибка обработки нового сообщения:', error);
        }
    }

    async sendNotificationByType(type, sender, message) {
        switch (type) {
            case 'push':
                await this.sendPushNotification(message);
                break;
            case 'local':
                this.sendLocalNotification(sender, message);
                break;
            case 'sound':
                // Только звук - можно добавить позже
                console.log('🔊 Только звук для уведомления');
                break;
            default:
                console.log('⚠️ Неизвестный тип уведомления:', type);
        }
    }

    getNotificationType(message) {
        // Логика определения типа уведомления
        const isPageVisible = !document.hidden;
        const isChatOpen = this.isCurrentChat(message.chat_id);

        if (!isPageVisible) {
            return 'push'; // Push-уведомление если страница не видна
        } else if (!isChatOpen) {
            return 'local'; // Локальное уведомление если чат не открыт
        } else {
            return 'sound'; // Только звук если чат открыт
        }
    }

    isCurrentChat(chatId) {
        // Проверяем, открыт ли данный чат
        return this.messenger?.currentChat?.id === chatId;
    }

    async sendPushNotification(message) {
        try {
            // Получаем данные отправителя
            const { data: sender } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', message.sender_id)
                .single();

            if (!sender) return;

            // Получаем данные чата для определения получателя
            const { data: chat, error: chatError } = await supabase
                .from('chats')
                .select('user1_id, user2_id')
                .eq('id', message.chat_id)
                .single();

            if (chatError || !chat) return;

            // Определяем получателя (другого участника чата)
            const receiverId = chat.user1_id === message.sender_id ? chat.user2_id : chat.user1_id;

            // Проверяем, есть ли FCM токен для отправки push-уведомления
            if (this.fcmToken && this.notificationPermission === 'granted') {
                try {
                    // Вызываем Supabase Edge Function для отправки push-уведомления
                    const { data, error } = await supabase.functions.invoke('send-notification', {
                        body: {
                            receiver_id: receiverId,
                            sender_id: message.sender_id,
                            message_content: message.content,
                            chat_id: message.chat_id
                        }
                    });

                    if (error) {
                        console.error('Ошибка вызова функции уведомлений:', error);
                        // Fallback: локальное уведомление
                        this.sendLocalNotification(sender, message);
                    } else {
                        console.log('✅ Push-уведомление отправлено через FCM:', data);
                    }
                } catch (funcError) {
                    console.error('❌ Ошибка отправки push-уведомления, используем локальное:', funcError);
                    // Fallback: локальное уведомление
                    this.sendLocalNotification(sender, message);
                }
            } else {
                console.log('⚠️ FCM не доступен, используем локальное уведомление');
                // Fallback: локальное уведомление
                this.sendLocalNotification(sender, message);
            }

        } catch (error) {
            console.error('❌ Ошибка отправки уведомлений:', error);
            // Emergency fallback
            try {
                this.sendLocalNotification({ username: 'REonika' }, message);
            } catch (fallbackError) {
                console.error('❌ Даже локальное уведомление не работает:', fallbackError);
            }
        }
    }

    // Метод для отправки локальных уведомлений (работает всегда)
    sendLocalNotification(sender, message) {
        if (this.notificationPermission !== 'granted') {
            console.log('⚠️ Разрешения на уведомления не предоставлены');
            return;
        }

        try {
            const notification = new Notification('Новое сообщение в REonika', {
                body: `${sender.username}: ${message.content || 'Голосовое/Изображение'}`,
                icon: '/icon.png',
                badge: '/icon.png',
                tag: 'reonika-message',
                requireInteraction: true
            });

            console.log('✅ Локальное уведомление показано');

            // Автоматически закрываем через 5 секунд
            setTimeout(() => {
                notification.close();
            }, 5000);

        } catch (error) {
            console.error('❌ Ошибка показа локального уведомления:', error);
        }
    }

    showNotification(notificationData) {
        if (!notificationData) return;

        new Notification(notificationData.title, {
            body: notificationData.body,
            icon: notificationData.icon,
            badge: '/icon.png',
            tag: 'reonika-message',
            requireInteraction: true,
            data: notificationData.data || {}
        });
    }

    showNotificationFromPayload(payload) {
        const notification = payload.notification || {};
        const data = payload.data || {};

        this.showNotification({
            title: notification.title || 'Новое сообщение в REonika',
            body: notification.body || 'У вас новое сообщение',
            icon: notification.icon || '/icon.png',
            data: data
        });
    }

    setupOnlineStatus() {
        // Настройка обработчиков онлайн/оффлайн статуса
        window.addEventListener('online', () => {
            this.isOnline = true;
            console.log('🌐 Подключение восстановлено');
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.log('📴 Подключение потеряно');
        });
    }

    setupVisualIndicators() {
        // Настройка визуальных индикаторов (можно расширить позже)
        console.log('👁️ Визуальные индикаторы настроены');
    }

    setupVisibilityHandlers() {
        // Обработчики видимости страницы
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                console.log('📱 Страница скрыта');
            } else {
                console.log('📱 Страница видна');
            }
        });
    }

    updateVisualIndicators() {
        // Обновление визуальных индикаторов (можно расширить позже)
        // Например, обновление счетчиков уведомлений
    }

    handlePresenceUpdate(payload) {
        // Обработка обновлений статуса присутствия
        console.log('👤 Обновление статуса присутствия:', payload);
    }

    setupAuthListener() {
        // Слушаем события авторизации от messenger
        if (this.messenger && typeof this.messenger.addEventListener === 'function') {
            this.messenger.addEventListener('userSignedIn', async () => {
                console.log('👤 Пользователь авторизовался, инициализируем уведомления...');
                await this.getFCMToken();
                this.setupRealtime();
            });
        } else {
            // Fallback: проверяем каждые 2 секунды
            console.log('⚠️ Messenger не имеет addEventListener, используем polling');
            this.authCheckInterval = setInterval(async () => {
                if (this.messenger?.currentUser && !this.fcmToken) {
                    console.log('👤 Пользователь авторизовался (polling), инициализируем уведомления...');
                    await this.getFCMToken();
                    this.setupRealtime();
                    clearInterval(this.authCheckInterval);
                }
            }, 2000);
        }
    }
}

// Полная диагностика push-уведомлений
window.diagnosePushNotifications = async () => {
    console.log('🔍 🔍 🔍 ПОЛНАЯ ДИАГНОСТИКА PUSH-УВЕДОМЛЕНИЙ 🔍 🔍 🔍');

    const results = {
        permissions: false,
        firebase: false,
        token: false,
        database: false,
        function: false,
        serviceWorker: false
    };

    // 1. Проверка разрешений
    console.log('\n📋 1. Проверка разрешений уведомлений...');
    if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        results.permissions = permission === 'granted';
        console.log(`   Разрешения: ${permission} ${results.permissions ? '✅' : '❌'}`);
    } else {
        console.log('   Notifications API не поддерживается ❌');
    }

    // 2. Проверка Firebase
    console.log('\n🔥 2. Проверка Firebase...');
    if (window.firebaseMessaging && window.firebaseGetToken && window.firebaseOnMessage) {
        results.firebase = true;
        console.log('   Firebase SDK загружен ✅');
    } else {
        console.log('   Firebase SDK не загружен ❌');
    }

    // 3. Проверка FCM токена
    console.log('\n🎫 3. Проверка FCM токена...');
    if (window.notifications?.fcmToken) {
        results.token = true;
        console.log(`   FCM токен: ${window.notifications.fcmToken.substring(0, 20)}... ✅`);
    } else {
        console.log('   FCM токен не получен ❌');
    }

    // 4. Проверка базы данных
    console.log('\n💾 4. Проверка базы данных...');
    if (window.messenger?.currentUser?.id) {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('fcm_token')
                .eq('id', window.messenger.currentUser.id)
                .single();

            if (data?.fcm_token) {
                results.database = true;
                console.log('   Токен сохранен в базе данных ✅');
            } else {
                console.log('   Токен НЕ сохранен в базе данных ❌', error);
            }
        } catch (error) {
            console.log('   Ошибка запроса к базе данных ❌', error);
        }
    } else {
        console.log('   Пользователь не авторизован ❌');
    }

    // 5. Проверка Service Worker
    console.log('\n👷 5. Проверка Service Worker...');
    if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration('/sw.js');
        if (registration) {
            results.serviceWorker = true;
            console.log('   Service Worker зарегистрирован ✅');
        } else {
            console.log('   Service Worker НЕ зарегистрирован ❌');
        }
    } else {
        console.log('   Service Worker API не поддерживается ❌');
    }

    // 6. Проверка Edge Function
    console.log('\n☁️ 6. Проверка Edge Function...');
    try {
        const testResponse = await supabase.functions.invoke('send-notification', {
            body: {
                receiver_id: 'test',
                sender_id: 'test',
                message_content: 'Test message',
                chat_id: 'test'
            }
        });

        // Ожидаемая ошибка (пользователь test не существует)
        if (testResponse.error && (
            (typeof testResponse.error === 'string' && testResponse.error.includes('FCM token not found')) ||
            (typeof testResponse.error === 'object' && testResponse.error.error && testResponse.error.error.includes('FCM token not found'))
        )) {
            results.function = true;
            console.log('   Edge Function работает (вернула ожидаемую ошибку) ✅');
        } else {
            console.log('   Edge Function вернула неожиданный результат ❌', testResponse);
        }
    } catch (error) {
        console.log('   Edge Function недоступна ❌', error);
    }

    // Резюме
    console.log('\n📊 РЕЗУЛЬТАТЫ ДИАГНОСТИКИ:');
    console.log(`   Разрешения: ${results.permissions ? '✅' : '❌'}`);
    console.log(`   Firebase: ${results.firebase ? '✅' : '❌'}`);
    console.log(`   FCM токен: ${results.token ? '✅' : '❌'}`);
    console.log(`   База данных: ${results.database ? '✅' : '❌'}`);
    console.log(`   Service Worker: ${results.serviceWorker ? '✅' : '❌'}`);
    console.log(`   Edge Function: ${results.function ? '✅' : '❌'}`);

    const allGood = Object.values(results).every(r => r);
    if (allGood) {
        console.log('\n🎉 ВСЕ КОМПОНЕНТЫ РАБОТАЮТ! Push-уведомления должны приходить.');
        console.log('💡 Если уведомления не приходят, проверьте логи в Supabase Edge Functions');
    } else {
        console.log('\n⚠️ НЕКОТОРЫЕ КОМПОНЕНТЫ НЕ РАБОТАЮТ. Исправьте ошибки выше.');
    }

    console.log('\n🔍 🔍 🔍 ДИАГНОСТИКА ЗАВЕРШЕНА 🔍 🔍 🔍');
};

// Краткий тест для быстрой проверки
window.testPushNotifications = window.diagnosePushNotifications;

// Простая тестовая функция на всякий случай
window.simpleTest = () => {
    console.log('🎯 Простой тест: notifications.js загружен');
    console.log('window.notifications:', window.notifications);
    console.log('window.messenger:', window.messenger);
};

// Тестовое уведомление
window.testLocalNotification = () => {
    console.log('🔔 Тестируем локальное уведомление...');
    if (window.notifications) {
        window.notifications.sendLocalNotification(
            { username: 'Тест' },
            { content: 'Это тестовое уведомление!' }
        );
    } else {
        console.error('❌ Notifications не инициализирован');
    }
};

// Тест получения FCM токена вручную
window.testFCMToken = async () => {
    console.log('🔑 Тестируем получение FCM токена вручную...');

    if (!window.firebaseGetToken) {
        console.error('❌ Firebase не инициализирован');
        return;
    }

    try {
        console.log('🔄 Попытка без VAPID...');
        const token1 = await window.firebaseGetToken();
        console.log('Результат без VAPID:', token1 ? 'УСПЕХ' : 'НЕТ ТОКЕНА');

        console.log('🔄 Попытка с VAPID...');
        const vapidKey = "BP9MbxkOem3B6DXtLDWIZs3iLzsLNTzZ2_KVnMAgbPvroRO6VmU2NliFmDFI8TJLdsANTJWV8ZBoG51nngk3tQA";
        const token2 = await window.firebaseGetToken({ vapidKey });
        console.log('Результат с VAPID:', token2 ? 'УСПЕХ' : 'НЕТ ТОКЕНА');

        if (token2) {
            console.log('✅ FCM токен получен:', token2);
            return token2;
        } else {
            console.log('❌ FCM токен не получен');
            console.log('💡 Возможные причины:');
            console.log('   - Неправильный VAPID ключ');
            console.log('   - Firebase проект не настроен для web push');
            console.log('   - Сертификат сайта не HTTPS');
        }
    } catch (error) {
        console.error('❌ Ошибка при получении токена:', error);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const checkMessenger = () => {
        if (window.messenger) {
            window.notifications = new REonikaNotifications(window.messenger);
        } else {
            setTimeout(checkMessenger, 100);
        }
    };
    setTimeout(checkMessenger, 1000);
});
