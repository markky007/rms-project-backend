const db = require("./db");

(async () => {
  try {
    console.log("\n========== Verifying Database Schema ==========\n");

    // Check invoices table - should NOT have meter reading columns
    console.log("1. Checking invoices table...");
    const [invoicesCols] = await db.query("DESCRIBE invoices");
    const meterColsInInvoices = invoicesCols.filter((c) =>
      c.Field.includes("reading")
    );

    if (meterColsInInvoices.length === 0) {
      console.log(
        "✓ Invoices table does NOT have meter reading columns (correct)\n"
      );
    } else {
      console.log("✗ WARNING: Invoices table still has meter reading columns:");
      console.table(meterColsInInvoices);
    }

    // Check meter_readings table - should have prev columns
    console.log("2. Checking meter_readings table...");
    const [meterCols] = await db.query("DESCRIBE meter_readings");
    const prevCols = meterCols.filter((c) => c.Field.includes("prev_"));

    if (prevCols.length > 0) {
      console.log("✓ meter_readings has prev columns:");
      console.table(prevCols);
    } else {
      console.log("✗ ERROR: meter_readings missing prev columns\n");
    }

    // Check unique constraint
    console.log("3. Checking unique constraint...");
    const [indexes] = await db.query(
      "SHOW INDEXES FROM meter_readings WHERE Key_name = 'unique_room_month'"
    );

    if (indexes.length > 0) {
      console.log("✓ Unique constraint (room_id, month_year) exists\n");
    } else {
      console.log("✗ WARNING: Unique constraint missing\n");
    }

    // Show sample data
    console.log("4. Sample meter_readings data:");
    const [sampleData] = await db.query(`
      SELECT room_id, month_year, prev_water_reading, water_reading,
             prev_elec_reading, elec_reading
      FROM meter_readings
      ORDER BY room_id, month_year DESC
      LIMIT 10
    `);
    console.table(sampleData);

    // Check for duplicates
    console.log("\n5. Checking for duplicate records...");
    const [duplicates] = await db.query(`
      SELECT room_id, month_year, COUNT(*) as count
      FROM meter_readings
      GROUP BY room_id, month_year
      HAVING count > 1
    `);

    if (duplicates.length === 0) {
      console.log("✓ No duplicate records found\n");
    } else {
      console.log("✗ WARNING: Duplicate records found:");
      console.table(duplicates);
    }

    console.log("\n========== Verification Complete ==========\n");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
})();
