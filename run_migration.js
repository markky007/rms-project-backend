// Script to run rollback and new migration
const db = require("./db");
const fs = require("fs");
const path = require("path");

async function runMigrations() {
  try {
    console.log("\n========== Step 1: Rollback invoices table ==========\n");

    const rollbackSQL = fs.readFileSync(
      path.join(__dirname, "rollback_invoices_meter_readings.sql"),
      "utf8"
    );

    const rollbackStatements = rollbackSQL
      .replace(/USE rental_system;/g, "")
      .replace(/--[^\n]*/g, "")
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 10);

    console.log(
      `Running ${rollbackStatements.length} rollback statements...\n`
    );

    for (let i = 0; i < rollbackStatements.length; i++) {
      const statement = rollbackStatements[i];
      console.log(
        `Executing rollback ${i + 1}/${rollbackStatements.length}...`
      );
      try {
        await db.query(statement);
        console.log("[OK] Success\n");
      } catch (err) {
        if (err.message.includes("check that column/key exists")) {
          console.log("[WARN] Already rolled back, skipping...\n");
        } else {
          console.error(`[FAIL] Failed: ${err.message}\n`);
        }
      }
    }

    console.log(
      "\n========== Step 2: Migrate meter_readings table ==========\n"
    );

    const migrationSQL = fs.readFileSync(
      path.join(__dirname, "migration_meter_readings_prev_current.sql"),
      "utf8"
    );

    const migrationStatements = migrationSQL
      .replace(/USE rental_system;/g, "")
      .replace(/--[^\n]*/g, "")
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 10);

    console.log(
      `Running ${migrationStatements.length} migration statements...\n`
    );

    for (let i = 0; i < migrationStatements.length; i++) {
      const statement = migrationStatements[i];
      console.log(
        `Executing migration ${i + 1}/${migrationStatements.length}...`
      );
      const preview = statement.substring(0, 80).replace(/\s+/g, " ");
      console.log(preview + "...");
      try {
        await db.query(statement);
        console.log("[OK] Success\n");
      } catch (err) {
        if (err.message.includes("Duplicate column name")) {
          console.log("[WARN] Column already exists, skipping...\n");
        } else if (err.message.includes("Duplicate key name")) {
          console.log("[WARN] Key already exists, skipping...\n");
        } else {
          console.error(`[FAIL] Failed: ${err.message}\n`);
        }
      }
    }

    console.log("\n[OK] All migrations completed!\n");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

runMigrations();
