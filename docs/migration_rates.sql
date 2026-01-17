-- Migration to add utility rates to rooms table
ALTER TABLE rooms
ADD COLUMN water_rate DECIMAL(10, 2) NOT NULL DEFAULT 18.00,
ADD COLUMN elec_rate DECIMAL(10, 2) NOT NULL DEFAULT 7.00;
