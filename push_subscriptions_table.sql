-- Создание таблицы для хранения push-подписок
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh_key TEXT,
    auth_key TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    
    -- Уникальность комбинации пользователя и endpoint
    UNIQUE(user_id, endpoint)
);

-- Создание индексов для оптимизации
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_is_active ON push_subscriptions(is_active);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_created_at ON push_subscriptions(created_at);

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_push_subscriptions_updated_at 
    BEFORE UPDATE ON push_subscriptions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) политики
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Пользователи могут управлять только своими подписками
CREATE POLICY "Users can view own push subscriptions"
    ON push_subscriptions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own push subscriptions"
    ON push_subscriptions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own push subscriptions"
    ON push_subscriptions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own push subscriptions"
    ON push_subscriptions FOR DELETE
    USING (auth.uid() = user_id);

-- Сервисные функции для отправки push-уведомлений
CREATE OR REPLACE FUNCTION send_push_notification(
    p_user_id UUID,
    p_title TEXT DEFAULT 'REonika',
    p_body TEXT DEFAULT 'Новое сообщение',
    p_data JSONB DEFAULT '{}'::jsonb,
    p_tag TEXT DEFAULT 'reonika-message'
)
RETURNS BOOLEAN AS $$
DECLARE
    subscription_record RECORD;
    v_result BOOLEAN := FALSE;
BEGIN
    -- Получаем активные подписки пользователя
    FOR subscription_record IN 
        SELECT endpoint, p256dh_key, auth_key 
        FROM push_subscriptions 
        WHERE user_id = p_user_id AND is_active = true
    LOOP
        -- Здесь будет логика отправки через push-сервис
        -- В реальном приложении здесь вызывается внешний сервис
        -- Например, через HTTP запрос к VAPID сервису
        
        -- Пока просто логируем
        RAISE LOG 'Would send push to endpoint: %', subscription_record.endpoint;
        v_result := TRUE;
    END LOOP;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Функция для очистки старых неактивных подписок
CREATE OR REPLACE FUNCTION cleanup_old_push_subscriptions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM push_subscriptions 
    WHERE is_active = false 
    AND updated_at < NOW() - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Комментарии к таблице
COMMENT ON TABLE push_subscriptions IS 'Таблица для хранения push-подписок пользователей';
COMMENT ON COLUMN push_subscriptions.user_id IS 'ID пользователя из auth.users';
COMMENT ON COLUMN push_subscriptions.endpoint IS 'Endpoint push-сервиса';
COMMENT ON COLUMN push_subscriptions.p256dh_key IS 'P-256 DH ключ для шифрования';
COMMENT ON COLUMN push_subscriptions.auth_key IS 'Authentication ключ';
COMMENT ON COLUMN push_subscriptions.user_agent IS 'User agent браузера';
COMMENT ON COLUMN push_subscriptions.is_active IS 'Флаг активности подписки';
