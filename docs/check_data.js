const db = require("../db");
(async () => {
  try {
    console.log("\n========== Checking meter_readings table ==========\n");
    const [meterReadings] = await db.query(`
      SELECT room_id, month_year, water_reading, elec_reading, reading_date 
      FROM meter_readings 
      ORDER BY room_id, month_year DESC 
      LIMIT 10
    `);
    console.table(meterReadings);

    console.log(
      "\n========== Checking invoices table meter readings ==========\n"
    );
    const [invoices] = await db.query(`
      SELECT i.invoice_id, c.room_id, i.month_year, 
             i.prev_water_reading, i.current_water_reading,
             i.prev_elec_reading, i.current_elec_reading
      FROM invoices i
      JOIN contracts c ON i.contract_id = c.contract_id
      ORDER BY c.room_id, i.month_year DESC
      LIMIT 10
    `);
    console.table(invoices);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
