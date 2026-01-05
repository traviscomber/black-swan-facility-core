ALTER TABLE assets ADD COLUMN last_audit_date timestamp without time zone;
UPDATE assets SET last_audit_date = created_at;
