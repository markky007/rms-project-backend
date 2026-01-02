const db = require("../db");

// Calculate bill based on current reading and previous reading
exports.calculateBill = async (req, res) => {
  try {
    const { room_id, current_water, current_elec } = req.body;

    // 1. Fetch Room Details & Rates from the Room itself
    const [roomRows] = await db.query(
      `
            SELECT r.base_rent, r.water_rate, r.elec_rate 
            FROM rooms r
            WHERE r.room_id = ? OR r.house_number = ?
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

// Get Latest Meter Reading for a Room
exports.getLatestReadings = async (req, res) => {
  try {
    const { room_id } = req.params;

    const [rows] = await db.query(
      `
            SELECT water_reading, elec_reading 
            FROM meter_readings 
            WHERE room_id = ? 
            ORDER BY reading_date DESC 
            LIMIT 1
        `,
      [room_id]
    );

    if (rows.length === 0) {
      // No previous readings found (new room)
      return res.json({ water: 0, elec: 0 });
    }

    res.json({
      water: rows[0].water_reading,
      elec: rows[0].elec_reading,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch latest readings" });
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

    // 1. Re-calculate to match backend state (ensure integrity)
    const [roomRows] = await connection.query(
      `
            SELECT r.base_rent, r.water_rate, r.elec_rate 
            FROM rooms r
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
// Get All Invoices
exports.getAllInvoices = async (req, res) => {
  try {
    const query = `
            SELECT 
                i.invoice_id, 
                i.month_year, 
                i.total_amount, 
                i.status, 
                i.issue_date,
                r.house_number,
                t.full_name as tenant_name
            FROM invoices i
            JOIN contracts c ON i.contract_id = c.contract_id
            JOIN rooms r ON c.room_id = r.room_id
            JOIN tenants t ON c.tenant_id = t.tenant_id
            ORDER BY i.invoice_id ASC
        `;

    const [rows] = await db.query(query);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch invoices" });
  }
};

// Get Invoice by ID
exports.getInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Get Invoice Details
    const [invoiceRows] = await db.query(
      `
      SELECT 
        i.*,
        r.house_number,
        t.full_name as tenant_name,
        r.room_id
      FROM invoices i
      JOIN contracts c ON i.contract_id = c.contract_id
      JOIN rooms r ON c.room_id = r.room_id
      JOIN tenants t ON c.tenant_id = t.tenant_id
      WHERE i.invoice_id = ?
    `,
      [id]
    );

    if (invoiceRows.length === 0) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    const invoice = invoiceRows[0];

    // 2. Get Invoice Items
    const [itemRows] = await db.query(
      "SELECT * FROM invoice_items WHERE invoice_id = ?",
      [id]
    );

    invoice.items = itemRows;

    res.json(invoice);
  } catch (err) {
    console.error("Error fetching invoice:", err);
    res.status(500).json({ error: "Failed to fetch invoice details" });
  }
};
