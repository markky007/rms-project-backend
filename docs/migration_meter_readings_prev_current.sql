-- Migration to add prev/current meter reading columns to meter_readings table
-- This allows storing both previous and current readings in one record per room per month

USE rental_system;

-- Add previous reading columns to meter_readings table
ALTER TABLE meter_readings
ADD COLUMN prev_water_reading DECIMAL(10, 2) DEFAULT 0.00 COMMENT 'Previous water meter reading',
ADD COLUMN prev_elec_reading DECIMAL(10, 2) DEFAULT 0.00 COMMENT 'Previous electricity meter reading';

-- Populate previous readings from existing data
-- For each record, find the previous month's current reading and set it as prev reading
UPDATE meter_readings mr1
LEFT JOIN (
    SELECT 
        room_id,
        month_year,
        water_reading,
        elec_reading,
        LEAD(month_year) OVER (PARTITION BY room_id ORDER BY month_year) as next_month
    FROM meter_readings
) mr2 ON mr1.room_id = mr2.room_id AND mr1.month_year = mr2.next_month
SET 
    mr1.prev_water_reading = COALESCE(mr2.water_reading, 0),
    mr1.prev_elec_reading = COALESCE(mr2.elec_reading, 0);

-- Add unique constraint to prevent duplicate records per room per month
-- First, remove any duplicate records if they exist (keep the latest one)
DELETE mr1 FROM meter_readings mr1
INNER JOIN meter_readings mr2 
WHERE 
    mr1.room_id = mr2.room_id 
    AND mr1.month_year = mr2.month_year
    AND mr1.reading_id < mr2.reading_id;

-- Now add the unique constraint
ALTER TABLE meter_readings
ADD UNIQUE KEY unique_room_month (room_id, month_year);

-- Add index for better query performance
CREATE INDEX idx_meter_room_month ON meter_readings(room_id, month_year, reading_date);

-- Note: Now one record per room per month
-- When creating invoice, use INSERT ON DUPLICATE KEY UPDATE pattern
