ALTER TABLE documents ADD COLUMN description TEXT;

CREATE TABLE tags (
    name TEXT COLLATE NOCASE PRIMARY KEY,
    color TEXT NOT NULL,
    CHECK (length(trim(name)) > 0),
    CHECK (length(trim(color)) > 0)
);

CREATE TABLE document_tags (
    document_id TEXT NOT NULL,
    tag_name TEXT COLLATE NOCASE NOT NULL,
    position INTEGER NOT NULL CHECK (position >= 0),
    PRIMARY KEY (document_id, tag_name),
    UNIQUE (document_id, position),
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_name) REFERENCES tags(name)
);

CREATE INDEX document_tags_document_idx
    ON document_tags(document_id, position);
