-- 0004_face_auth.sql: Face biometric credentials and liveness challenges

CREATE TABLE IF NOT EXISTS user_face_credentials (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  descriptor             jsonb NOT NULL,
  model_version          text NOT NULL DEFAULT 'v1',
  registered_expression  text NOT NULL DEFAULT 'smile',
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  last_used_at           timestamptz
);

CREATE INDEX IF NOT EXISTS user_face_credentials_user_idx ON user_face_credentials (user_id);

CREATE TABLE IF NOT EXISTS face_auth_challenges (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES users(id) ON DELETE CASCADE,
  challenge_type  text NOT NULL DEFAULT 'smile' CHECK (challenge_type IN ('smile', 'blink', 'surprise', 'neutral')),
  nonce           text NOT NULL,
  expires_at      timestamptz NOT NULL,
  used_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS face_auth_challenges_user_idx ON face_auth_challenges (user_id, expires_at);
