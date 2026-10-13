CREATE TABLE IF NOT EXISTS reading_exceptions (
    lemma TEXT PRIMARY KEY,
    reading TEXT NOT NULL,
    deleted_at TEXT
);

INSERT INTO reading_exceptions(lemma, reading, deleted_at)
VALUES ('私', 'わたし', NULL);
