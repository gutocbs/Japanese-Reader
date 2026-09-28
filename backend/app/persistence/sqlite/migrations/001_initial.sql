CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    revision INTEGER NOT NULL CHECK (revision > 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_read_at TEXT
);

CREATE INDEX documents_last_read_at_idx ON documents(last_read_at DESC);

CREATE TABLE document_analyses (
    document_id TEXT NOT NULL,
    document_revision INTEGER NOT NULL,
    content_hash TEXT NOT NULL,
    analyzer_name TEXT NOT NULL,
    analyzer_version TEXT NOT NULL,
    dictionary_name TEXT NOT NULL,
    dictionary_version TEXT NOT NULL,
    metadata_split_mode TEXT NOT NULL,
    analysis_options_json TEXT NOT NULL,
    payload_version INTEGER NOT NULL CHECK (payload_version > 0),
    analysis_json TEXT NOT NULL,
    PRIMARY KEY (
        document_id,
        document_revision,
        content_hash,
        analyzer_name,
        analyzer_version,
        dictionary_name,
        dictionary_version,
        metadata_split_mode,
        analysis_options_json
    ),
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX document_analyses_document_idx ON document_analyses(document_id);

CREATE TABLE vocabulary_selections (
    document_id TEXT NOT NULL,
    lemma TEXT NOT NULL,
    reading_value TEXT NOT NULL,
    reading_is_null INTEGER NOT NULL CHECK (reading_is_null IN (0, 1)),
    vocabulary_key TEXT NOT NULL,
    PRIMARY KEY (document_id, lemma, reading_value, reading_is_null),
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX vocabulary_selections_document_idx ON vocabulary_selections(document_id);

CREATE TABLE vocabulary_display_preferences (
    document_id TEXT NOT NULL,
    lemma TEXT NOT NULL,
    reading_value TEXT NOT NULL,
    reading_is_null INTEGER NOT NULL CHECK (reading_is_null IN (0, 1)),
    vocabulary_key TEXT NOT NULL,
    visibility TEXT NOT NULL CHECK (visibility IN ('inherit', 'show', 'hide')),
    PRIMARY KEY (document_id, lemma, reading_value, reading_is_null),
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX vocabulary_display_preferences_document_idx
    ON vocabulary_display_preferences(document_id);

CREATE TABLE reading_overrides (
    document_id TEXT NOT NULL,
    document_revision INTEGER NOT NULL CHECK (document_revision > 0),
    start_offset INTEGER NOT NULL CHECK (start_offset >= 0),
    end_offset INTEGER NOT NULL CHECK (end_offset > start_offset),
    reading TEXT NOT NULL,
    PRIMARY KEY (document_id, document_revision, start_offset, end_offset),
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX reading_overrides_document_idx ON reading_overrides(document_id);
