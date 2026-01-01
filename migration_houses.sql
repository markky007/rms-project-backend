-- Migration to refactor rooms table
-- Remove foreign key constraint
ALTER TABLE rooms DROP FOREIGN KEY rooms_ibfk_1;
-- Drop indexes that might use the columns to be removed
DROP INDEX building_id ON rooms;

-- Alter table columns
ALTER TABLE rooms 
DROP COLUMN building_id,
DROP COLUMN floor,
CHANGE COLUMN room_number house_number VARCHAR(20) NOT NULL,
ADD COLUMN bedrooms INT NOT NULL DEFAULT 1,
ADD COLUMN bathrooms INT NOT NULL DEFAULT 1;

-- Add unique constraint to house_number
ALTER TABLE rooms ADD UNIQUE (house_number);
