// notifications.js - версия без ES модулей для совместимости
class REonikaNotifications {
    constructor(messenger) {
        this.messenger = messenger;
        this.notificationPermission = 'default';
        this.fcmToken = null;
        this.init();
    }

    async init() {
        console.log('🚀 Инициализация REonikaNotifications...');

        // Ждем загрузки Firebase
        await this.waitForFirebase();

        // Запрос разрешений на уведомления
        await this.requestPermission();

        // Настройка realtime подписок (сразу, не ждем пользователя)
        this.setupRealtime();

        // Инициализация Firebase Messaging (всегда, токен будет получен при входе)
        await this.initFirebaseMessaging();

        console.log('✅ REonikaNotifications инициализирован');
    }

    async waitForFirebase() {
        return new Promise((resolve) => {
            const checkFirebase = () => {
                if (window.firebaseMessaging && window.firebaseGetToken && window.firebaseOnMessage) {
                    resolve();
                } else {
                    setTimeout(checkFirebase, 100);
                }
            };
            checkFirebase();
        });
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

    async initFirebaseMessaging() {
        try {
            console.log('🔥 Инициализация Firebase Messaging...');

            // Проверяем, что все компоненты Firebase доступны
            console.log('Firebase messaging object:', window.firebaseMessaging);
            console.log('Firebase getToken function:', window.firebaseGetToken);

            // Получение FCM токена
            console.log('Запрашиваем FCM токен с VAPID key...');
            this.fcmToken = await window.firebaseGetToken(window.firebaseMessaging, {
                vapidKey: 'BGkgVqZM0y7uwlJ5RL3gleUfsYWzfzokSjrek3sCpC8KzwcAoXQwuNyp0R8Tfgf9rQjQn9CtIcfgrAcYpeAhDHI'
            });

            console.log('Результат получения токена:', this.fcmToken);

            if (this.fcmToken) {
                console.log('✅ FCM токен получен:', this.fcmToken);

                // Сохраняем токен в базе данных для пользователя
                await this.saveTokenToDatabase();

                // Обработка сообщений в foreground
                window.firebaseOnMessage(window.firebaseMessaging, (payload) => {
                    console.log('📱 Сообщение в foreground:', payload);
                    this.showNotificationFromPayload(payload);
                });

                console.log('✅ Firebase Messaging инициализирован');
            } else {
                console.log('❌ Не удалось получить FCM токен - токен пустой');
                console.log('Возможные причины:');
                console.log('1. VAPID key неправильный');
                console.log('2. FCM API не включен в Firebase Console');
                console.log('3. Сайт не на HTTPS (localhost может работать)');
                console.log('4. Разрешения на уведомления не предоставлены');
            }
        } catch (error) {
            console.error('❌ Ошибка инициализации FCM:', error);
            console.error('Детали ошибки:', error.message);
            console.error('Stack trace:', error.stack);

            if (error.code) {
                console.error('Код ошибки:', error.code);
            }
        }
    }

    async saveTokenToDatabase() {
        if (!this.fcmToken || !this.messenger?.currentUser?.id) return;

        try {
            // Сохраняем токен в таблице user_fcm_tokens или profiles
            const { error } = await supabase
                .from('profiles')
                .update({ fcm_token: this.fcmToken })
                .eq('id', this.messenger.currentUser.id);

            if (error) {
                console.error('Ошибка сохранения FCM токена:', error);
            } else {
                console.log('FCM токен сохранен в базе данных');
            }
        } catch (error) {
            console.error('Ошибка сохранения токена:', error);
        }
    }

    setupRealtime() {
        if (!this.messenger) return;

        const userId = this.messenger.currentUser?.id;
        if (!userId) return;

        // Подписка на новые сообщения в чатах пользователя
        const subscription = supabase
            .channel('new-messages')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages'
            }, async (payload) => {
                const message = payload.new;

                // Проверяем, что сообщение не от самого пользователя
                if (message.sender_id === userId) return;

                // Всегда отправляем push-уведомление при новом сообщении
                // (даже если пользователь не в этом чате на UI)
                console.log('Новое сообщение для отправки уведомления:', message);
                await this.sendPushNotification(message);
            })
            .subscribe();

        this.messenger.realtimeSubscriptions.push(subscription);
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
                } else {
                    console.log('Push-уведомление отправлено:', data);
                }
            } catch (funcError) {
                console.error('Ошибка отправки push-уведомления пользователю:', receiverId, funcError);
            }

        } catch (error) {
            console.error('Ошибка отправки push-уведомлений:', error);
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
