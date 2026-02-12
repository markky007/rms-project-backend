const db = require("../db");

// Calculate bill based on current reading and previous reading
exports.calculateBill = async (req, res) => {
  try {
    const { room_id, current_water, current_elec, month_year } = req.body;

    // 1. Fetch Room Details & Rates from the Room itself
    const [roomRows] = await db.query(
      `
            SELECT r.base_rent, r.water_rate, r.elec_rate 
            FROM rooms r
            WHERE r.room_id = ? OR r.house_number = ?
        `,
      [room_id, room_id],
    );

    if (roomRows.length === 0)
      return res.status(404).json({ error: "Room not found" });
    const room = roomRows[0];

    // 2. Fetch Previous Month's Reading from meter_readings
    let prevWater = 0;
    let prevElec = 0;

    const [prevRows] = await db.query(
      `SELECT water_reading, elec_reading 
       FROM meter_readings 
       WHERE room_id = ? AND month_year < ?
       ORDER BY month_year DESC
       LIMIT 1`,
      [room_id, month_year],
    );

    if (prevRows.length > 0) {
      prevWater = prevRows[0].water_reading;
      prevElec = prevRows[0].elec_reading;
    }

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
    const { month_year } = req.query;

    let query, params;

    if (month_year) {
      query = `
        SELECT water_reading, elec_reading 
        FROM meter_readings 
        WHERE room_id = ? AND month_year < ?
        ORDER BY month_year DESC 
        LIMIT 1
      `;
      params = [room_id, month_year];
    } else {
      query = `
        SELECT water_reading, elec_reading 
        FROM meter_readings 
        WHERE room_id = ? 
        ORDER BY month_year DESC 
        LIMIT 1
      `;
      params = [room_id];
    }

    const [rows] = await db.query(query, params);

    if (rows.length === 0) {
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
  try {
    const {
      contract_id,
      room_id,
      month_year,
      water_reading,
      elec_reading,
      recorded_by,
    } = req.body;

    // Check for duplicate invoice (same contract and month_year)
    const [existingInvoice] = await db.query(
      `SELECT invoice_id 
       FROM invoices 
       WHERE contract_id = ? AND month_year = ?`,
      [contract_id, month_year],
    );

    if (existingInvoice.length > 0) {
      return res.status(400).json({
        error: `Invoice already exists for this contract and month ${month_year}`,
      });
    }

    // 1. Fetch room details and calculate
    const [roomRows] = await db.query(
      `SELECT r.base_rent, r.water_rate, r.elec_rate 
       FROM rooms r
       WHERE r.room_id = ?`,
      [room_id],
    );
    const room = roomRows[0];

    // Find Previous Reading
    const [prevRows] = await db.query(
      `SELECT water_reading, elec_reading 
       FROM meter_readings 
       WHERE room_id = ? AND month_year < ?
       ORDER BY month_year DESC
       LIMIT 1`,
      [room_id, month_year],
    );

    const prevWater = prevRows.length > 0 ? prevRows[0].water_reading : 0;
    const prevElec = prevRows.length > 0 ? prevRows[0].elec_reading : 0;

    const waterUsage = water_reading - prevWater;
    const elecUsage = elec_reading - prevElec;
    const waterCost = waterUsage * room.water_rate;
    const elecCost = elecUsage * room.elec_rate;
    const totalAmount = waterCost + elecCost + parseFloat(room.base_rent);

    // 2. Check if meter reading exists for this month
    const [existingReading] = await db.query(
      `SELECT reading_id FROM meter_readings WHERE room_id = ? AND month_year = ?`,
      [room_id, month_year],
    );

    if (existingReading.length > 0) {
      // Update existing reading
      await db.query(
        `UPDATE meter_readings 
         SET prev_water_reading = ?, water_reading = ?, prev_elec_reading = ?, 
             elec_reading = ?, reading_date = datetime('now'), recorded_by = ?
         WHERE room_id = ? AND month_year = ?`,
        [
          prevWater,
          water_reading,
          prevElec,
          elec_reading,
          recorded_by,
          room_id,
          month_year,
        ],
      );
    } else {
      // Insert new reading
      await db.query(
        `INSERT INTO meter_readings 
         (room_id, month_year, prev_water_reading, water_reading, prev_elec_reading, elec_reading, reading_date, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)`,
        [
          room_id,
          month_year,
          prevWater,
          water_reading,
          prevElec,
          elec_reading,
          recorded_by,
        ],
      );
    }

    // 3. Create Invoice
    const [, invMeta] = await db.query(
      `INSERT INTO invoices (contract_id, month_year, total_amount, status, issue_date)
       VALUES (?, ?, ?, 'pending', datetime('now'))`,
      [contract_id, month_year, totalAmount],
    );

    const invoiceId = invMeta.insertId;

    // 4. Create Invoice Items
    const items = [
      { desc: "Room Rent", amount: room.base_rent, type: "rent" },
      {
        desc: `Water (${waterUsage} units)`,
        amount: waterCost,
        type: "water",
      },
      {
        desc: `Electricity (${elecUsage} units)`,
        amount: elecCost,
        type: "electric",
      },
    ];

    for (const item of items) {
      await db.query(
        `INSERT INTO invoice_items (invoice_id, description, amount, item_type)
         VALUES (?, ?, ?, ?)`,
        [invoiceId, item.desc, item.amount, item.type],
      );
    }

    res
      .status(201)
      .json({ message: "Invoice created successfully", invoice_id: invoiceId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create invoice" });
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

    // Get Invoice Details with meter readings from meter_readings table
    const [invoiceRows] = await db.query(
      `SELECT 
        i.*,
        r.house_number,
        r.room_id,
        r.water_rate,
        r.elec_rate,
        r.base_rent,
        t.full_name as tenant_name,
        mr.reading_id,
        mr.prev_water_reading,
        mr.water_reading as current_water_reading,
        mr.prev_elec_reading,
        mr.elec_reading as current_elec_reading
      FROM invoices i
      JOIN contracts c ON i.contract_id = c.contract_id
      JOIN rooms r ON c.room_id = r.room_id
      JOIN tenants t ON c.tenant_id = t.tenant_id
      LEFT JOIN meter_readings mr ON r.room_id = mr.room_id AND i.month_year = mr.month_year
      WHERE i.invoice_id = ?`,
      [id],
    );

    if (invoiceRows.length === 0) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    const invoice = invoiceRows[0];

    // Get Invoice Items
    const [itemRows] = await db.query(
      "SELECT * FROM invoice_items WHERE invoice_id = ?",
      [id],
    );

    invoice.items = itemRows;

    res.json(invoice);
  } catch (err) {
    console.error("Error fetching invoice:", err);
    res.status(500).json({ error: "Failed to fetch invoice details" });
  }
};

// Delete Invoice
exports.deleteInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    const [invoiceRows] = await db.query(
      "SELECT invoice_id FROM invoices WHERE invoice_id = ?",
      [id],
    );

    if (invoiceRows.length === 0) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    await db.query("DELETE FROM invoices WHERE invoice_id = ?", [id]);

    res.json({ message: "Invoice deleted successfully" });
  } catch (err) {
    console.error("Error deleting invoice:", err);
    res.status(500).json({ error: "Failed to delete invoice" });
  }
};

// Update Invoice Status (single)
exports.updateInvoiceStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["pending", "paid", "overdue", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    const [invoiceRows] = await db.query(
      "SELECT invoice_id FROM invoices WHERE invoice_id = ?",
      [id],
    );

    if (invoiceRows.length === 0) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    await db.query("UPDATE invoices SET status = ? WHERE invoice_id = ?", [
      status,
      id,
    ]);

    const [updatedRows] = await db.query(
      "SELECT * FROM invoices WHERE invoice_id = ?",
      [id],
    );

    res.json(updatedRows[0]);
  } catch (err) {
    console.error("Error updating invoice status:", err);
    res.status(500).json({ error: "Failed to update invoice status" });
  }
};

// Bulk Update Invoice Status
exports.bulkUpdateStatus = async (req, res) => {
  try {
    const { invoice_ids, status } = req.body;

    if (!Array.isArray(invoice_ids) || invoice_ids.length === 0) {
      return res
        .status(400)
        .json({ error: "invoice_ids must be a non-empty array" });
    }

    const validStatuses = ["pending", "paid", "overdue", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    const placeholders = invoice_ids.map(() => "?").join(",");
    await db.query(
      `UPDATE invoices SET status = ? WHERE invoice_id IN (${placeholders})`,
      [status, ...invoice_ids],
    );

    res.json({
      message: `Successfully updated ${invoice_ids.length} invoice(s) to status: ${status}`,
      updated_count: invoice_ids.length,
    });
  } catch (err) {
    console.error("Error bulk updating invoice status:", err);
    res.status(500).json({ error: "Failed to bulk update invoice status" });
  }
};

// Update Meter Reading and Recalculate Invoice
exports.updateMeterReading = async (req, res) => {
  try {
    const { reading_id } = req.params;
    const { water_reading, elec_reading, recorded_by } = req.body;

    // 1. Get existing meter reading
    const [readingRows] = await db.query(
      `SELECT mr.*, r.base_rent, r.water_rate, r.elec_rate, r.room_id
       FROM meter_readings mr
       JOIN rooms r ON mr.room_id = r.room_id
       WHERE mr.reading_id = ?`,
      [reading_id],
    );

    if (readingRows.length === 0) {
      return res.status(404).json({ error: "Meter reading not found" });
    }

    const reading = readingRows[0];
    const { room_id, month_year } = reading;

    // 2. Get previous month's reading for validation
    const [prevRows] = await db.query(
      `SELECT water_reading, elec_reading 
       FROM meter_readings 
       WHERE room_id = ? AND month_year < ?
       ORDER BY month_year DESC
       LIMIT 1`,
      [room_id, month_year],
    );

    const prevWater = prevRows.length > 0 ? prevRows[0].water_reading : 0;
    const prevElec = prevRows.length > 0 ? prevRows[0].elec_reading : 0;

    // 3. Validation
    if (water_reading < prevWater || elec_reading < prevElec) {
      return res.status(400).json({
        error: "Current reading cannot be less than previous reading",
        prevWater,
        prevElec,
      });
    }

    // 4. Calculate new usage and costs
    const waterUsage = water_reading - prevWater;
    const elecUsage = elec_reading - prevElec;
    const waterCost = waterUsage * reading.water_rate;
    const elecCost = elecUsage * reading.elec_rate;
    const totalAmount = waterCost + elecCost + parseFloat(reading.base_rent);

    // 5. Update meter reading
    await db.query(
      `UPDATE meter_readings 
       SET prev_water_reading = ?, water_reading = ?, 
           prev_elec_reading = ?, elec_reading = ?, 
           reading_date = datetime('now'), recorded_by = ?
       WHERE reading_id = ?`,
      [
        prevWater,
        water_reading,
        prevElec,
        elec_reading,
        recorded_by,
        reading_id,
      ],
    );

    // 6. Find associated invoice
    const [invoiceRows] = await db.query(
      `SELECT i.invoice_id, i.contract_id 
       FROM invoices i
       JOIN contracts c ON i.contract_id = c.contract_id
       WHERE c.room_id = ? AND i.month_year = ?`,
      [room_id, month_year],
    );

    if (invoiceRows.length > 0) {
      const invoice_id = invoiceRows[0].invoice_id;

      // 7. Update invoice total
      await db.query(
        `UPDATE invoices SET total_amount = ? WHERE invoice_id = ?`,
        [totalAmount, invoice_id],
      );

      // 8. Update invoice items
      await db.query(
        `UPDATE invoice_items 
         SET amount = ? 
         WHERE invoice_id = ? AND item_type = 'water'`,
        [waterCost, invoice_id],
      );

      await db.query(
        `UPDATE invoice_items 
         SET amount = ?, description = ? 
         WHERE invoice_id = ? AND item_type = 'electric'`,
        [elecCost, `Electricity (${elecUsage} units)`, invoice_id],
      );

      await db.query(
        `UPDATE invoice_items 
         SET description = ? 
         WHERE invoice_id = ? AND item_type = 'water'`,
        [`Water (${waterUsage} units)`, invoice_id],
      );
    }

    res.json({
      message: "Meter reading updated successfully",
      reading_id,
      updated_values: {
        water_reading,
        elec_reading,
        total_amount: totalAmount,
      },
    });
  } catch (err) {
    console.error("Error updating meter reading:", err);
    res.status(500).json({ error: "Failed to update meter reading" });
  }
};

// Apply Late Fee - Create adjusted invoice with late fee
exports.applyLateFee = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Get original invoice details with all items
    const [invoiceRows] = await db.query(
      `SELECT 
        i.*,
        r.house_number,
        r.room_id,
        t.full_name as tenant_name
      FROM invoices i
      JOIN contracts c ON i.contract_id = c.contract_id
      JOIN rooms r ON c.room_id = r.room_id
      JOIN tenants t ON c.tenant_id = t.tenant_id
      WHERE i.invoice_id = ?`,
      [id],
    );

    if (invoiceRows.length === 0) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    const invoice = invoiceRows[0];

    // 2. Check if invoice is pending
    if (invoice.status !== "pending") {
      return res.status(400).json({
        error: "Late fee can only be applied to pending invoices",
      });
    }

    // 3. Calculate late fee
    // Parse month_year (format: "YYYY-MM")
    const [year, month] = invoice.month_year.split("-");
    // Change calculation to start from next month
    // For December (12), parseInt(12) creates date in January of next year
    const dueDate = new Date(parseInt(year), parseInt(month), 5); // 5th of next month

    // Reset time components to compare dates only
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    // Check if current date is past due date
    if (currentDate <= dueDate) {
      return res.status(400).json({
        error: "Invoice is not yet overdue (due date is 5th of the next month)",
      });
    }

    // Calculate days late
    const timeDiff = currentDate.getTime() - dueDate.getTime();
    const daysLate = Math.ceil(timeDiff / (1000 * 3600 * 24));
    const lateFee = daysLate * 50; // 50 baht per day

    // 4. Get original invoice items
    const [itemRows] = await db.query(
      "SELECT * FROM invoice_items WHERE invoice_id = ?",
      [id],
    );

    // 5. Calculate new total
    const newTotalAmount = parseFloat(invoice.total_amount) + lateFee;

    // 6. Create new invoice with late fee
    const [, newInvoiceMeta] = await db.query(
      `INSERT INTO invoices (contract_id, month_year, total_amount, status, issue_date)
       VALUES (?, ?, ?, 'pending', datetime('now'))`,
      [invoice.contract_id, invoice.month_year, newTotalAmount],
    );

    const newInvoiceId = newInvoiceMeta.insertId;

    // 7. Copy all original invoice items to new invoice
    for (const item of itemRows) {
      await db.query(
        `INSERT INTO invoice_items (invoice_id, description, amount, item_type)
         VALUES (?, ?, ?, ?)`,
        [newInvoiceId, item.description, item.amount, item.item_type],
      );
    }

    // 8. Add late fee item
    await db.query(
      `INSERT INTO invoice_items (invoice_id, description, amount, item_type)
       VALUES (?, ?, ?, ?)`,
      [
        newInvoiceId,
        `ค่าปรับชำระล่าช้า (${daysLate} วัน × 50 บาท)`,
        lateFee,
        "late_fee",
      ],
    );

    // 9. Update original invoice status to cancelled
    await db.query(
      "UPDATE invoices SET status = 'cancelled' WHERE invoice_id = ?",
      [id],
    );

    res.status(201).json({
      message: "Late fee applied successfully",
      new_invoice_id: newInvoiceId,
      days_late: daysLate,
      late_fee: lateFee,
      new_total: newTotalAmount,
      original_invoice_id: id,
    });
  } catch (err) {
    console.error("Error applying late fee:", err);
    res.status(500).json({ error: "Failed to apply late fee" });
  }
};
