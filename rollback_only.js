const db = require("./db");

(async () => {
  try {
    console.log("\n========== Rolling back invoices table ==========\n");

    // Try to drop index
    console.log("Dropping index idx_invoice_room_month...");
    try {
      await db.query("ALTER TABLE invoices DROP INDEX idx_invoice_room_month");
      console.log("[OK] Index dropped\n");
    } catch (err) {
      if (err.message.includes("check that it exists")) {
        console.log("[WARN] Index doesn't exist, skipping...\n");
      } else {
        console.error(`[FAIL] Error: ${err.message}\n`);
      }
    }

    // Try to drop columns one by one
    const columns = [
      "prev_water_reading",
      "current_water_reading",
      "prev_elec_reading",
      "current_elec_reading",
    ];

    for (const col of columns) {
      console.log(`Dropping column ${col}...`);
      try {
        await db.query(`ALTER TABLE invoices DROP COLUMN ${col}`);
        console.log(`[OK] Column ${col} dropped\n`);
      } catch (err) {
        if (err.message.includes("check that it exists")) {
          console.log(`[WARN] Column ${col} doesn't exist, skipping...\n`);
        } else {
          console.error(`[FAIL] Error: ${err.message}\n`);
        }
      }
    }

    console.log("[OK] Rollback completed!\n");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
})();
