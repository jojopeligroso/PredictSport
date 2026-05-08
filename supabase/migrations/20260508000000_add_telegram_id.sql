-- Add Telegram user ID for linking Telegram accounts to app users
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_id bigint UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_username text;

-- Index for fast lookup during Mini App auth
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id) WHERE telegram_id IS NOT NULL;
