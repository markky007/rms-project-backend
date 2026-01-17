-- Rollback previous migration to invoices table
-- Remove meter reading columns that were added

USE rental_system;

-- Drop the index created for meter readings (if exists)
ALTER TABLE invoices DROP INDEX idx_invoice_room_month;

-- Remove meter reading columns from invoices table
ALTER TABLE invoices
DROP COLUMN prev_water_reading,
DROP COLUMN current_water_reading,
DROP COLUMN prev_elec_reading,
DROP COLUMN current_elec_reading;

-- Invoices table is now back to original structure
