CREATE TABLE IF NOT EXISTS app_state (
 id INTEGER PRIMARY KEY CHECK (id = 1),
 state TEXT NOT NULL CHECK (json_valid(state)),
 revision INTEGER NOT NULL DEFAULT 0,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO app_state(id,state,revision)
VALUES(1,'{"items":[],"purchases":[],"orders":[],"adjustments":[],"expenses":[],"settings":{"whatsapp":"","storeName":"CloudVibes"}}',0);
