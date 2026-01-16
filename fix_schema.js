const Database = require("better-sqlite3");
const path = require("path");

// Connect to the database
const dbPath = path.join(__dirname, "data.sqlite");
const db = new Database(dbPath);

console.log("Starting schema fix...");

// Enable foreign keys but defer checks
db.pragma("foreign_keys = OFF");

// Get all table data first
const tables = [
  {
    name: "users",
    oldName: "users_old",
    createSql: `CREATE TABLE users (
      user_id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    columns: "user_id, username, password_hash, role, created_at",
  },
  {
    name: "buildings",
    oldName: "buildings_old",
    createSql: `CREATE TABLE buildings (
      building_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      water_rate REAL NOT NULL DEFAULT 18.00,
      elec_rate REAL NOT NULL DEFAULT 7.00,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    columns: "building_id, name, address, water_rate, elec_rate, created_at",
  },
  {
    name: "tenants",
    oldName: "tenants_old",
    createSql: `CREATE TABLE tenants (
      tenant_id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      id_card TEXT UNIQUE NOT NULL,
      phone TEXT,
      line_id TEXT,
      address TEXT,
      photo_url TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    columns:
      "tenant_id, full_name, id_card, phone, line_id, address, photo_url, created_at",
  },
  {
    name: "rooms",
    oldName: "rooms_old",
    createSql: `CREATE TABLE rooms (
      room_id INTEGER PRIMARY KEY AUTOINCREMENT,
      house_number TEXT NOT NULL UNIQUE,
      base_rent REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'vacant',
      current_tenant_id INTEGER,
      bedrooms INTEGER NOT NULL DEFAULT 1,
      bathrooms INTEGER NOT NULL DEFAULT 1,
      water_rate REAL DEFAULT 20.00,
      elec_rate REAL DEFAULT 7.00,
      FOREIGN KEY (current_tenant_id) REFERENCES tenants(tenant_id) ON DELETE SET NULL
    )`,
    columns:
      "room_id, house_number, base_rent, status, current_tenant_id, bedrooms, bathrooms, water_rate, elec_rate",
  },
  {
    name: "contracts",
    oldName: "contracts_old",
    createSql: `CREATE TABLE contracts (
      contract_id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL,
      tenant_id INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      deposit REAL NOT NULL DEFAULT 0.00,
      rent_amount REAL NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (room_id) REFERENCES rooms(room_id),
      FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
    )`,
    columns:
      "contract_id, room_id, tenant_id, start_date, end_date, deposit, rent_amount, is_active, created_at",
  },
  {
    name: "meter_readings",
    oldName: "meter_readings_old",
    createSql: `CREATE TABLE meter_readings (
      reading_id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL,
      reading_date TEXT NOT NULL,
      water_reading REAL NOT NULL,
      elec_reading REAL NOT NULL,
      month_year TEXT NOT NULL,
      recorded_by INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      prev_water_reading REAL,
      prev_elec_reading REAL,
      FOREIGN KEY (room_id) REFERENCES rooms(room_id),
      FOREIGN KEY (recorded_by) REFERENCES users(user_id)
    )`,
    columns:
      "reading_id, room_id, reading_date, water_reading, elec_reading, month_year, recorded_by, created_at, prev_water_reading, prev_elec_reading",
  },
  {
    name: "invoices",
    oldName: "invoices_old",
    createSql: `CREATE TABLE invoices (
      invoice_id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id INTEGER NOT NULL,
      month_year TEXT NOT NULL,
      total_amount REAL NOT NULL DEFAULT 0.00,
      status TEXT NOT NULL DEFAULT 'pending',
      issue_date TEXT DEFAULT (DATE('now')),
      due_date TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (contract_id) REFERENCES contracts(contract_id)
    )`,
    columns:
      "invoice_id, contract_id, month_year, total_amount, status, issue_date, due_date, created_at",
  },
  {
    name: "invoice_items",
    oldName: "invoice_items_old",
    createSql: `CREATE TABLE invoice_items (
      item_id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      item_type TEXT NOT NULL,
      FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id) ON DELETE CASCADE
    )`,
    columns: "item_id, invoice_id, description, amount, item_type",
  },
  {
    name: "payments",
    oldName: "payments_old",
    createSql: `CREATE TABLE payments (
      payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      slip_image_url TEXT,
      payment_date TEXT DEFAULT CURRENT_TIMESTAMP,
      status TEXT NOT NULL DEFAULT 'pending',
      approved_by INTEGER,
      FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id),
      FOREIGN KEY (approved_by) REFERENCES users(user_id)
    )`,
    columns:
      "payment_id, invoice_id, amount, slip_image_url, payment_date, status, approved_by",
  },
  {
    name: "maintenance_requests",
    oldName: "maintenance_requests_old",
    createSql: `CREATE TABLE maintenance_requests (
      request_id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      photo_url TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      cost REAL DEFAULT 0.00,
      reported_date TEXT DEFAULT CURRENT_TIMESTAMP,
      resolved_date TEXT,
      FOREIGN KEY (room_id) REFERENCES rooms(room_id)
    )`,
    columns:
      "request_id, room_id, title, description, photo_url, status, cost, reported_date, resolved_date",
  },
];

try {
  // Process each table
  for (const table of tables) {
    console.log(`Processing table: ${table.name}`);

    // Check if table exists
    const tableExists = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
      .get(table.name);

    if (!tableExists) {
      console.log(`  Table ${table.name} doesn't exist, creating...`);
      db.exec(table.createSql);
      continue;
    }

    // Rename old table
    db.exec(`ALTER TABLE ${table.name} RENAME TO ${table.oldName}`);
    console.log(`  Renamed to ${table.oldName}`);

    // Create new table with proper schema
    db.exec(table.createSql);
    console.log(`  Created new table with proper schema`);

    // Copy data (only rows with valid primary key)
    const copyResult = db.exec(`
      INSERT INTO ${table.name} (${table.columns})
      SELECT ${table.columns} FROM ${table.oldName}
      WHERE ${table.columns.split(",")[0].trim()} IS NOT NULL
    `);
    console.log(`  Copied data with valid IDs`);

    // Drop old table
    db.exec(`DROP TABLE ${table.oldName}`);
    console.log(`  Dropped old table`);
  }

  // Create indexes
  console.log("\nCreating indexes...");

  const indexes = [
    "CREATE INDEX IF NOT EXISTS idx_room_status ON rooms(status)",
    "CREATE INDEX IF NOT EXISTS idx_contract_room ON contracts(room_id)",
    "CREATE INDEX IF NOT EXISTS idx_contract_tenant ON contracts(tenant_id)",
    "CREATE INDEX IF NOT EXISTS idx_meter_room_date ON meter_readings(room_id, month_year)",
    "CREATE INDEX IF NOT EXISTS idx_invoice_status ON invoices(status)",
  ];

  for (const indexSql of indexes) {
    try {
      db.exec(indexSql);
    } catch (e) {
      // Index might already exist, ignore
    }
  }

  // Re-enable foreign keys
  db.pragma("foreign_keys = ON");

  console.log("\n✅ Schema fix completed successfully!");
  console.log("\nFinal schema:");

  const schema = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type='table' ORDER BY name`)
    .all();
  schema.forEach((row) => {
    if (row.sql) {
      console.log(row.sql + ";\n");
    }
  });
} catch (error) {
  console.error("Error fixing schema:", error);
  process.exit(1);
} finally {
  db.close();
}
