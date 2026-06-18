-- ─── ODM Social Media Scheduler — Initial Schema ─────────────────────────────
-- Run order: users → clients → junction tables → posts → post children

SET FOREIGN_KEY_CHECKS = 0;

-- ─── users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('admin', 'member') NOT NULL DEFAULT 'member',
  avatar_url    VARCHAR(512),
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role  (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── refresh_tokens ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token_hash (token_hash),
  INDEX idx_user_id    (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── clients ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(200) NOT NULL,
  logo_url   VARCHAR(512),
  industry   VARCHAR(100),
  status     ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_by INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── client_team_access ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_team_access (
  user_id    INT UNSIGNED NOT NULL,
  client_id  INT UNSIGNED NOT NULL,
  granted_by INT UNSIGNED NOT NULL,
  granted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, client_id),
  FOREIGN KEY (user_id)    REFERENCES users(id)   ON DELETE CASCADE,
  FOREIGN KEY (client_id)  REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── social_accounts ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_accounts (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  client_id             INT UNSIGNED NOT NULL,
  platform              ENUM('facebook', 'instagram') NOT NULL,
  page_id               VARCHAR(100),                     -- FB page ID or IG account ID
  ig_business_id        VARCHAR(100),                     -- linked IG business account id (on FB records)
  account_name          VARCHAR(255) NOT NULL,
  username              VARCHAR(100),
  profile_pic_url       VARCHAR(512),
  access_token_encrypted TEXT NOT NULL,
  token_expires_at      DATETIME,
  status                ENUM('active', 'token_expired', 'disconnected') NOT NULL DEFAULT 'active',
  connected_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_refreshed_at     DATETIME,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  INDEX idx_client_id  (client_id),
  INDEX idx_platform   (platform),
  INDEX idx_status     (status),
  INDEX idx_expires    (token_expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── posts ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS posts (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  client_id      INT UNSIGNED NOT NULL,
  caption        TEXT,
  content_type   ENUM('image', 'video', 'carousel', 'story') NOT NULL,
  status         ENUM('draft', 'scheduled', 'publishing', 'published', 'failed', 'partially_failed') NOT NULL DEFAULT 'draft',
  scheduled_time DATETIME,
  timezone       VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
  created_by     INT UNSIGNED NOT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id)  REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_client_id      (client_id),
  INDEX idx_status         (status),
  INDEX idx_scheduled_time (scheduled_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── post_media ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_media (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  post_id     INT UNSIGNED NOT NULL,
  media_url   VARCHAR(1024) NOT NULL,
  media_type  ENUM('image', 'video') NOT NULL,
  order_index TINYINT UNSIGNED NOT NULL DEFAULT 0,
  r2_key      VARCHAR(512) NOT NULL,
  file_size   INT UNSIGNED,
  mime_type   VARCHAR(100),
  width       SMALLINT UNSIGNED,
  height      SMALLINT UNSIGNED,
  duration_s  FLOAT,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  INDEX idx_post_id (post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── post_platforms ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_platforms (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  post_id           INT UNSIGNED NOT NULL,
  social_account_id INT UNSIGNED NOT NULL,
  platform_post_id  VARCHAR(200),                -- ID returned by Meta after publish
  publish_status    ENUM('pending', 'publishing', 'published', 'failed') NOT NULL DEFAULT 'pending',
  error_log         TEXT,
  attempt_count     TINYINT UNSIGNED NOT NULL DEFAULT 0,
  next_retry_at     DATETIME,
  published_at      DATETIME,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id)           REFERENCES posts(id)           ON DELETE CASCADE,
  FOREIGN KEY (social_account_id) REFERENCES social_accounts(id) ON DELETE CASCADE,
  INDEX idx_post_id           (post_id),
  INDEX idx_social_account_id (social_account_id),
  INDEX idx_publish_status    (publish_status),
  INDEX idx_next_retry_at     (next_retry_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── publish_logs ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS publish_logs (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  post_platform_id  INT UNSIGNED NOT NULL,
  attempt_number    TINYINT UNSIGNED NOT NULL,
  status            ENUM('success', 'failed') NOT NULL,
  response_body     TEXT,
  error_message     TEXT,
  duration_ms       INT UNSIGNED,
  logged_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_platform_id) REFERENCES post_platforms(id) ON DELETE CASCADE,
  INDEX idx_post_platform_id (post_platform_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
