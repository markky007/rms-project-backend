const db = require("../db");

// Calculate bill based on current reading and previous reading
exports.calculateBill = async (req, res) => {
  try {
    const { room_id, current_water, current_elec, month_year } = req.body;

    // 1. Fetch Room & Building Details (for rates)
    const [roomRows] = await db.query(
      `
            SELECT r.base_rent, b.water_rate, b.elec_rate 
            FROM rooms r
            JOIN buildings b ON r.building_id = b.building_id
            WHERE r.room_id = ? OR r.room_number = ?
        `,
      [room_id, room_id]
    );

    if (roomRows.length === 0)
      return res.status(404).json({ error: "Room not found" });
    const room = roomRows[0];

    // 2. Fetch Previous Month's Reading
    // Logic: specific month sorting or just taking the latest before this one
    const [prevReadingRows] = await db.query(
      `
            SELECT water_reading, elec_reading 
            FROM meter_readings 
            WHERE room_id = ? 
            ORDER BY reading_date DESC 
            LIMIT 1
        `,
      [room_id]
    );

    const prevWater =
      prevReadingRows.length > 0 ? prevReadingRows[0].water_reading : 0;
    const prevElec =
      prevReadingRows.length > 0 ? prevReadingRows[0].elec_reading : 0;

    // 3. Validation
    if (current_water < prevWater || current_elec < prevElec) {
      return res.status(400).json({
        error: "Current reading cannot be less than previous reading",
        prevWater,
        prevElec,
      });
    }

    // 4. Calculate Usage
    const waterUsage = current_water - prevWater;
    const elecUsage = current_elec - prevElec;

    // 5. Calculate Cost
    const waterCost = waterUsage * room.water_rate;
    const elecCost = elecUsage * room.elec_rate;
    const totalRent = parseFloat(room.base_rent);

    const totalAmount = waterCost + elecCost + totalRent;

    res.json({
      prev_readings: { water: prevWater, elec: prevElec },
      usage: { water: waterUsage, elec: elecUsage },
      costs: { water: waterCost, elec: elecCost, rent: totalRent },
      rates: { water: room.water_rate, elec: room.elec_rate },
      total_amount: totalAmount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Calculation failed" });
  }
};

// Create Invoice and save Meter Reading
exports.createInvoice = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const {
      contract_id,
      room_id,
      month_year,
      water_reading,
      elec_reading,
      recorded_by,
    } = req.body;

    // 1. Re-calculate to match backend state (ensure integrity)
    // ... (Repeating fetch logic akin to calculateBill for safety, or trusting frontend if simple)
    // For production, always Recalculate. Here we'll do a simplified version based on request but fetching rates again.

    const [roomRows] = await connection.query(
      `
            SELECT r.base_rent, b.water_rate, b.elec_rate 
            FROM rooms r
            JOIN buildings b ON r.building_id = b.building_id
            WHERE r.room_id = ?
        `,
      [room_id]
    );
    const room = roomRows[0];

    // Find Previous Reading
    const [prevRows] = await connection.query(
      `
            SELECT water_reading, elec_reading 
            FROM meter_readings 
            WHERE room_id = ? 
            ORDER BY reading_date DESC LIMIT 1
        `,
      [room_id]
    );

    const prevWater = prevRows.length > 0 ? prevRows[0].water_reading : 0;
    const prevElec = prevRows.length > 0 ? prevRows[0].elec_reading : 0;

    const waterUsage = water_reading - prevWater;
    const elecUsage = elec_reading - prevElec;
    const waterCost = waterUsage * room.water_rate;
    const elecCost = elecUsage * room.elec_rate;
    const totalAmount = waterCost + elecCost + parseFloat(room.base_rent);

    // 2. Insert Meter Reading
    await connection.query(
      `
            INSERT INTO meter_readings (room_id, reading_date, water_reading, elec_reading, month_year, recorded_by)
            VALUES (?, NOW(), ?, ?, ?, ?)
        `,
      [room_id, water_reading, elec_reading, month_year, recorded_by]
    );

    // 3. Create Invoice
    const [invResult] = await connection.query(
      `
            INSERT INTO invoices (contract_id, month_year, total_amount, status, issue_date)
            VALUES (?, ?, ?, 'pending', NOW())
        `,
      [contract_id, month_year, totalAmount]
    );

    const invoiceId = invResult.insertId;

    // 4. Create Invoice Items
    const items = [
      { desc: "Room Rent", amount: room.base_rent, type: "rent" },
      { desc: `Water (${waterUsage} units)`, amount: waterCost, type: "water" },
      {
        desc: `Electricity (${elecUsage} units)`,
        amount: elecCost,
        type: "electric",
      },
    ];

    for (const item of items) {
      await connection.query(
        `
                INSERT INTO invoice_items (invoice_id, description, amount, item_type)
                VALUES (?, ?, ?, ?)
            `,
        [invoiceId, item.desc, item.amount, item.type]
      );
    }

    await connection.commit();
    res
      .status(201)
      .json({ message: "Invoice created successfully", invoice_id: invoiceId });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ error: "Failed to create invoice" });
  } finally {
    connection.release();
  }
};
