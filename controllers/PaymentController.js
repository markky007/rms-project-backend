const db = require("../db");

// Get all payments
exports.getAllPayments = async (req, res) => {
  try {
    const { invoice_id, status } = req.query;

    let query = "SELECT * FROM payments";
    let conditions = [];
    let values = [];

    if (invoice_id) {
      conditions.push("invoice_id = ?");
      values.push(invoice_id);
    }
    if (status) {
      conditions.push("status = ?");
      values.push(status);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY payment_date DESC";

    const [rows] = await db.query(query, values);
    res.json(rows);
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).json({ error: "Failed to fetch payments" });
  }
};

// Get payment by ID
exports.getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(
      "SELECT * FROM payments WHERE payment_id = ?",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Payment not found" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Error fetching payment:", error);
    res.status(500).json({ error: "Failed to fetch payment" });
  }
};

// Create new payment
exports.createPayment = async (req, res) => {
  try {
    const { invoice_id, amount, slip_image_url, payment_date } = req.body;

    if (!invoice_id || !amount) {
      return res
        .status(400)
        .json({ error: "Invoice ID and amount are required" });
    }

    const [result] = await db.query(
      "INSERT INTO payments (invoice_id, amount, slip_image_url, payment_date, status) VALUES (?, ?, ?, ?, ?)",
      [
        invoice_id,
        amount,
        slip_image_url || null,
        payment_date || new Date(),
        "pending",
      ]
    );

    res.status(201).json({
      payment_id: result.insertId,
      invoice_id,
      amount,
      slip_image_url: slip_image_url || null,
      status: "pending",
      message: "Payment created successfully",
    });
  } catch (error) {
    console.error("Error creating payment:", error);
    res.status(500).json({ error: "Failed to create payment" });
  }
};

// Upload payment slip
exports.uploadPaymentSlip = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const slip_image_url = `/uploads/${req.file.filename}`;

    const [result] = await db.query(
      "UPDATE payments SET slip_image_url = ? WHERE payment_id = ?",
      [slip_image_url, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Payment not found" });
    }

    res.json({ slip_image_url, message: "Payment slip uploaded successfully" });
  } catch (error) {
    console.error("Error uploading slip:", error);
    res.status(500).json({ error: "Failed to upload slip" });
  }
};

// Approve payment
exports.approvePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { approved_by } = req.body;

    if (!approved_by) {
      return res.status(400).json({ error: "Approver user ID is required" });
    }

    // Get payment details
    const [payments] = await db.query(
      "SELECT invoice_id FROM payments WHERE payment_id = ?",
      [id]
    );

    if (payments.length === 0) {
      return res.status(404).json({ error: "Payment not found" });
    }

    const invoice_id = payments[0].invoice_id;

    // Update payment status
    await db.query(
      "UPDATE payments SET status = ?, approved_by = ? WHERE payment_id = ?",
      ["approved", approved_by, id]
    );

    // Update invoice status to paid
    await db.query("UPDATE invoices SET status = ? WHERE invoice_id = ?", [
      "paid",
      invoice_id,
    ]);

    res.json({ message: "Payment approved successfully" });
  } catch (error) {
    console.error("Error approving payment:", error);
    res.status(500).json({ error: "Failed to approve payment" });
  }
};
