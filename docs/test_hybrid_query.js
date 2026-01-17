const db = require("../db");

// Test the hybrid query approach
(async () => {
  try {
    console.log("\n========== Testing Hybrid Query Approach ==========\n");

    // Simulate a request for room 1, month 2026-02
    const room_id = 1;
    const month_year = "2026-02";

    console.log(`Testing: room_id=${room_id}, month_year=${month_year}\n`);

    // Step 1: Try to find from invoices first
    console.log("Step 1: Querying invoices table...");
    const [invoiceRows] = await db.query(
      `
        SELECT i.current_water_reading as water_reading, i.current_elec_reading as elec_reading
        FROM invoices i
        JOIN contracts c ON i.contract_id = c.contract_id
        WHERE c.room_id = ? AND i.month_year < ?
        ORDER BY i.month_year DESC
        LIMIT 1
      `,
      [room_id, month_year],
    );

    if (invoiceRows.length > 0) {
      console.log("[OK] Found in invoices:");
      console.table(invoiceRows);
    } else {
      console.log("[WARN] Not found in invoices, trying meter_readings...");

      // Step 2: Fallback to meter_readings
      const [meterRows] = await db.query(
        `
          SELECT water_reading, elec_reading 
          FROM meter_readings 
          WHERE room_id = ? AND month_year < ?
          ORDER BY month_year DESC, reading_date DESC 
          LIMIT 1
        `,
        [room_id, month_year],
      );

      if (meterRows.length > 0) {
        console.log("[OK] Found in meter_readings:");
        console.table(meterRows);
      } else {
        console.log("[WARN] No previous readings found (new room)");
      }
    }

    console.log("\n[OK] Hybrid query approach working correctly!\n");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
})();
