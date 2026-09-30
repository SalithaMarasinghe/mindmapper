-- ============================================================
-- Migration: AI Assistant Conversations & Messages
-- Tables created: assistant_conversations, assistant_messages
-- ============================================================

-- 1. assistant_conversations table
CREATE TABLE IF NOT EXISTS assistant_conversations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text        NOT NULL DEFAULT 'New Conversation',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assistant_conversations_user
  ON assistant_conversations (user_id, updated_at DESC);

ALTER TABLE assistant_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assistant_conversations_select_own"
  ON assistant_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "assistant_conversations_insert_own"
  ON assistant_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "assistant_conversations_update_own"
  ON assistant_conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "assistant_conversations_delete_own"
  ON assistant_conversations FOR DELETE
  USING (auth.uid() = user_id);

-- 2. assistant_messages table
CREATE TABLE IF NOT EXISTS assistant_messages (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid        NOT NULL REFERENCES assistant_conversations(id) ON DELETE CASCADE,
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role             text        NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content          text        NOT NULL,
  proposals        jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assistant_messages_conversation
  ON assistant_messages (conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_assistant_messages_user
  ON assistant_messages (user_id, created_at DESC);

ALTER TABLE assistant_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assistant_messages_select_own"
  ON assistant_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "assistant_messages_insert_own"
  ON assistant_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "assistant_messages_update_own"
  ON assistant_messages FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "assistant_messages_delete_own"
  ON assistant_messages FOR DELETE
  USING (auth.uid() = user_id);
