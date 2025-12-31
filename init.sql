-- Database Schema for Rental Property Management System

CREATE DATABASE IF NOT EXISTS rental_system;
USE rental_system;

-- 1. Users (Admin, Staff)
CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'staff') NOT NULL DEFAULT 'staff',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Buildings
CREATE TABLE IF NOT EXISTS buildings (
    building_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    address TEXT,
    water_rate DECIMAL(10, 2) NOT NULL DEFAULT 18.00, -- Default price per unit
    elec_rate DECIMAL(10, 2) NOT NULL DEFAULT 7.00,   -- Default price per unit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Rooms
CREATE TABLE IF NOT EXISTS rooms (
    room_id INT AUTO_INCREMENT PRIMARY KEY,
    building_id INT NOT NULL,
    room_number VARCHAR(20) NOT NULL,
    floor INT NOT NULL,
    base_rent DECIMAL(10, 2) NOT NULL,
    status ENUM('vacant', 'occupied', 'reserved', 'maintenance') NOT NULL DEFAULT 'vacant',
    FOREIGN KEY (building_id) REFERENCES buildings(building_id) ON DELETE CASCADE,
    UNIQUE(building_id, room_number)
);

-- 4. Tenants
CREATE TABLE IF NOT EXISTS tenants (
    tenant_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    id_card VARCHAR(20) UNIQUE NOT NULL,
    phone VARCHAR(20),
    line_id VARCHAR(50),
    address TEXT,
    photo_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Contracts
CREATE TABLE IF NOT EXISTS contracts (
    contract_id INT AUTO_INCREMENT PRIMARY KEY,
    room_id INT NOT NULL,
    tenant_id INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    deposit DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    rent_amount DECIMAL(10, 2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(room_id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
);

-- 6. Meter Readings
CREATE TABLE IF NOT EXISTS meter_readings (
    reading_id INT AUTO_INCREMENT PRIMARY KEY,
    room_id INT NOT NULL,
    reading_date DATE NOT NULL,
    water_reading DECIMAL(10, 2) NOT NULL,
    elec_reading DECIMAL(10, 2) NOT NULL,
    month_year VARCHAR(7) NOT NULL, -- Format: YYYY-MM
    recorded_by INT, -- User ID
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(room_id),
    FOREIGN KEY (recorded_by) REFERENCES users(user_id)
);

-- 7. Invoices
CREATE TABLE IF NOT EXISTS invoices (
    invoice_id INT AUTO_INCREMENT PRIMARY KEY,
    contract_id INT NOT NULL,
    month_year VARCHAR(7) NOT NULL, -- YYYY-MM
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    status ENUM('pending', 'paid', 'overdue', 'cancelled') NOT NULL DEFAULT 'pending',
    issue_date DATE DEFAULT (CURRENT_DATE),
    due_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contract_id) REFERENCES contracts(contract_id)
);

-- 8. Invoice Items
CREATE TABLE IF NOT EXISTS invoice_items (
    item_id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_id INT NOT NULL,
    description VARCHAR(255) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    item_type ENUM('rent', 'water', 'electric', 'other') NOT NULL,
    FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id) ON DELETE CASCADE
);

-- 9. Payments
CREATE TABLE IF NOT EXISTS payments (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_id INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    slip_image_url VARCHAR(255),
    payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    status ENUM('pending', 'approved') NOT NULL DEFAULT 'pending',
    approved_by INT, -- User ID
    FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id),
    FOREIGN KEY (approved_by) REFERENCES users(user_id)
);

-- 10. Maintenance Requests
CREATE TABLE IF NOT EXISTS maintenance_requests (
    request_id INT AUTO_INCREMENT PRIMARY KEY,
    room_id INT NOT NULL,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    photo_url VARCHAR(255),
    status ENUM('pending', 'in_progress', 'completed') NOT NULL DEFAULT 'pending',
    cost DECIMAL(10, 2) DEFAULT 0.00,
    reported_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_date DATETIME,
    FOREIGN KEY (room_id) REFERENCES rooms(room_id)
);

-- Create Indexes for performance
CREATE INDEX idx_room_status ON rooms(status);
CREATE INDEX idx_contract_room ON contracts(room_id);
CREATE INDEX idx_contract_tenant ON contracts(tenant_id);
CREATE INDEX idx_meter_room_date ON meter_readings(room_id, month_year);
CREATE INDEX idx_invoice_status ON invoices(status);
