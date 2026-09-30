ALTER TABLE documents
    ADD COLUMN source TEXT NOT NULL DEFAULT 'Local'
    CHECK (length(trim(source)) > 0);
