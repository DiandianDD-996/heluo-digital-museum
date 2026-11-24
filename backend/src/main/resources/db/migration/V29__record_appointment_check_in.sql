ALTER TABLE appointments ADD COLUMN checked_in_at DATETIME(3) NULL;
CREATE INDEX idx_appointments_checked_in_at ON appointments(checked_in_at);
