-- Migration script to add current_tenant_id to existing rooms table
-- Run this if you already have data in your database

USE rental_system;

-- Add current_tenant_id column to rooms
ALTER TABLE rooms 
ADD COLUMN current_tenant_id INT NULL;

-- Add foreign key constraint
ALTER TABLE rooms 
ADD CONSTRAINT fk_rooms_current_tenant 
FOREIGN KEY (current_tenant_id) REFERENCES tenants(tenant_id) ON DELETE SET NULL;

-- Populate current_tenant_id from active contracts
UPDATE rooms r
LEFT JOIN contracts c ON r.room_id = c.room_id AND c.is_active = TRUE
SET r.current_tenant_id = c.tenant_id
WHERE c.tenant_id IS NOT NULL;

-- Update room status based on active contracts
UPDATE rooms r
LEFT JOIN contracts c ON r.room_id = c.room_id AND c.is_active = TRUE
SET r.status = CASE 
    WHEN c.contract_id IS NOT NULL THEN 'occupied'
    ELSE 'vacant'
END;
