const db = require("../db");

async function migrate() {
  try {
    console.log("Starting migration: Add invoice_type to invoices table");

    // Check if column exists (SQLite doesn't support IF NOT EXISTS for ADD COLUMN in older versions,
    // but we can try to add it and catch the error if it exists, or check table info first)
    // For simplicity with this driver, we'll try to add it.

    try {
      await db.execute(
        `ALTER TABLE invoices ADD COLUMN invoice_type TEXT DEFAULT 'normal'`,
      );
      console.log("Successfully added invoice_type column.");
    } catch (error) {
      if (error.message && error.message.includes("duplicate column name")) {
        console.log("Column invoice_type already exists. Skipping.");
      } else {
        console.error("Error adding column:", error);
        // It might be that the column already exists, let's just proceed to update existing nulls
      }
    }

    console.log(
      'Updating existing invoices to have invoice_type = "normal" where it is null...',
    );
    await db.execute(
      `UPDATE invoices SET invoice_type = 'normal' WHERE invoice_type IS NULL`,
    );

    console.log("Migration completed successfully.");
  } catch (error) {
    console.error("Migration failed:", error);
  }
}

migrate();
