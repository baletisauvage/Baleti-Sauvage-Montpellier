-- Le Coin des Sauvages : migration à appliquer sur la base D1 de production.
CREATE TABLE IF NOT EXISTS forum_posts (
 id TEXT PRIMARY KEY,
 parent_id TEXT,
 nickname TEXT NOT NULL,
 body TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 hidden INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS forum_posts_expiration ON forum_posts(expires_at);
CREATE INDEX IF NOT EXISTS forum_posts_parent ON forum_posts(parent_id);
CREATE TABLE IF NOT EXISTS forum_limits (
 fingerprint TEXT PRIMARY KEY,
 last_post_at INTEGER NOT NULL
);
