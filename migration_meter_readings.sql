-- Migration to add meter reading fields to invoices table
-- This simplifies data retrieval and prevents data accumulation issues

USE rental_system;

-- Add meter reading columns to invoices table
ALTER TABLE invoices
ADD COLUMN prev_water_reading DECIMAL(10, 2) DEFAULT 0.00 COMMENT 'Previous water meter reading',
ADD COLUMN current_water_reading DECIMAL(10, 2) DEFAULT 0.00 COMMENT 'Current water meter reading',
ADD COLUMN prev_elec_reading DECIMAL(10, 2) DEFAULT 0.00 COMMENT 'Previous electricity meter reading',
ADD COLUMN current_elec_reading DECIMAL(10, 2) DEFAULT 0.00 COMMENT 'Current electricity meter reading';

-- Migrate existing data from meter_readings to invoices
-- This populates the new fields for existing invoices
UPDATE invoices i
JOIN contracts c ON i.contract_id = c.contract_id
LEFT JOIN meter_readings mr ON c.room_id = mr.room_id AND i.month_year = mr.month_year
SET 
    i.current_water_reading = COALESCE(mr.water_reading, 0),
    i.current_elec_reading = COALESCE(mr.elec_reading, 0);

-- Update previous readings by finding the reading from the month before
-- This is a one-time data migration for existing invoices
UPDATE invoices i
JOIN contracts c ON i.contract_id = c.contract_id
LEFT JOIN (
    SELECT 
        mr.room_id,
        mr.month_year as current_month,
        LAG(mr.water_reading) OVER (PARTITION BY mr.room_id ORDER BY mr.month_year) as prev_water,
        LAG(mr.elec_reading) OVER (PARTITION BY mr.room_id ORDER BY mr.month_year) as prev_elec
    FROM meter_readings mr
) prev ON c.room_id = prev.room_id AND i.month_year = prev.current_month
SET 
    i.prev_water_reading = COALESCE(prev.prev_water, 0),
    i.prev_elec_reading = COALESCE(prev.prev_elec, 0);

-- Add indexes for better query performance
CREATE INDEX idx_invoice_room_month ON invoices(contract_id, month_year);

-- Note: The meter_readings table is kept for historical reference and audit trail
-- but new invoices will primarily use the data stored in the invoices table
