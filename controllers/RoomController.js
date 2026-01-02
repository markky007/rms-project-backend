const db = require("../db");

// Get all rooms
exports.getAllRooms = async (req, res) => {
  try {
    let query = `
            SELECT r.*,
                   t.tenant_id, t.full_name as tenant_name, t.phone as tenant_phone,
                   c.contract_id as current_contract_id
            FROM rooms r
            LEFT JOIN tenants t ON r.current_tenant_id = t.tenant_id
            LEFT JOIN contracts c ON r.room_id = c.room_id AND c.is_active = TRUE
        `;

    query += " ORDER BY r.room_id ASC";

    const [rooms] = await db.query(query);
    res.json(rooms);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch rooms" });
  }
};

// Get room by ID
exports.getRoomById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rooms] = await db.query(
      `SELECT r.*,
              t.tenant_id, t.full_name as tenant_name, t.phone as tenant_phone,
              c.contract_id as current_contract_id
       FROM rooms r
       LEFT JOIN tenants t ON r.current_tenant_id = t.tenant_id
       LEFT JOIN contracts c ON r.room_id = c.room_id AND c.is_active = TRUE
       WHERE r.room_id = ?`,
      [id]
    );

    if (rooms.length === 0) {
      return res.status(404).json({ error: "Room not found" });
    }

    res.json(rooms[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch room" });
  }
};

// Create a new room
exports.createRoom = async (req, res) => {
  try {
    const {
      house_number,
      bedrooms,
      bathrooms,
      base_rent,
      status,
      current_tenant_id,
      water_rate,
      elec_rate,
    } = req.body;

    // Validate required fields
    if (!house_number || !base_rent) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Check if house number already exists
    const [existing] = await db.query(
      "SELECT room_id FROM rooms WHERE house_number = ?",
      [house_number]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        error: "House number already exists",
      });
    }

    const [result] = await db.query(
      "INSERT INTO rooms (house_number, bedrooms, bathrooms, base_rent, status, current_tenant_id, water_rate, elec_rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        house_number,
        bedrooms || 1,
        bathrooms || 1,
        base_rent,
        status || "vacant",
        current_tenant_id || null,
        water_rate || 18.0,
        elec_rate || 7.0,
      ]
    );

    // Fetch the created room
    const [newRoom] = await db.query(
      `SELECT r.*,
              t.tenant_id, t.full_name as tenant_name, t.phone as tenant_phone
       FROM rooms r
       LEFT JOIN tenants t ON r.current_tenant_id = t.tenant_id
       WHERE r.room_id = ?`,
      [result.insertId]
    );

    res.status(201).json(newRoom[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// Update room
exports.updateRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      house_number,
      bedrooms,
      bathrooms,
      base_rent,
      status,
      current_tenant_id,
      water_rate,
      elec_rate,
    } = req.body;

    // Check if room exists
    const [existing] = await db.query(
      "SELECT room_id FROM rooms WHERE room_id = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: "Room not found" });
    }

    // Check for duplicate house number
    if (house_number) {
      const [duplicate] = await db.query(
        "SELECT room_id FROM rooms WHERE house_number = ? AND room_id != ?",
        [house_number, id]
      );

      if (duplicate.length > 0) {
        return res.status(400).json({
          error: "House number already exists",
        });
      }
    }

    // Build update query dynamically
    const updates = [];
    const params = [];

    if (house_number !== undefined) {
      updates.push("house_number = ?");
      params.push(house_number);
    }
    if (bedrooms !== undefined) {
      updates.push("bedrooms = ?");
      params.push(bedrooms);
    }
    if (bathrooms !== undefined) {
      updates.push("bathrooms = ?");
      params.push(bathrooms);
    }
    if (base_rent !== undefined) {
      updates.push("base_rent = ?");
      params.push(base_rent);
    }
    if (status !== undefined) {
      updates.push("status = ?");
      params.push(status);
    }
    if (current_tenant_id !== undefined) {
      updates.push("current_tenant_id = ?");
      params.push(current_tenant_id);
    }
    if (water_rate !== undefined) {
      updates.push("water_rate = ?");
      params.push(water_rate);
    }
    if (elec_rate !== undefined) {
      updates.push("elec_rate = ?");
      params.push(elec_rate);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    params.push(id);
    await db.query(
      `UPDATE rooms SET ${updates.join(", ")} WHERE room_id = ?`,
      params
    );

    // Fetch updated room
    const [updatedRoom] = await db.query(
      `SELECT r.*,
              t.tenant_id, t.full_name as tenant_name, t.phone as tenant_phone
       FROM rooms r
       LEFT JOIN tenants t ON r.current_tenant_id = t.tenant_id
       WHERE r.room_id = ?`,
      [id]
    );

    res.json(updatedRoom[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update room" });
  }
};

// Delete room
exports.deleteRoom = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Delete Meter Readings
    await db.query("DELETE FROM meter_readings WHERE room_id = ?", [id]);

    // 2. Find associated Contracts
    const [contracts] = await db.query(
      "SELECT contract_id FROM contracts WHERE room_id = ?",
      [id]
    );

    if (contracts.length > 0) {
      const contractIds = contracts.map((c) => c.contract_id);

      // 3. Find associated Invoices
      const [invoices] = await db.query(
        "SELECT invoice_id FROM invoices WHERE contract_id IN (?)",
        [contractIds]
      );

      if (invoices.length > 0) {
        const invoiceIds = invoices.map((i) => i.invoice_id);

        // 4. Delete Payments
        await db.query("DELETE FROM payments WHERE invoice_id IN (?)", [
          invoiceIds,
        ]);

        // 5. Delete Invoice Items
        await db.query("DELETE FROM invoice_items WHERE invoice_id IN (?)", [
          invoiceIds,
        ]);

        // 6. Delete Invoices
        await db.query("DELETE FROM invoices WHERE contract_id IN (?)", [
          contractIds,
        ]);
      }

      // 7. Delete Contracts
      await db.query("DELETE FROM contracts WHERE room_id = ?", [id]);
    }

    // 8. Delete Room
    const [result] = await db.query("DELETE FROM rooms WHERE room_id = ?", [
      id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Room not found" });
    }

    res.json({ message: "Room deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete room" });
  }
};

// Update room status
exports.updateRoomStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["vacant", "occupied", "reserved", "maintenance"].includes(status)) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    const [result] = await db.query(
      "UPDATE rooms SET status = ? WHERE room_id = ?",
      [status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Room not found" });
    }

    // Fetch updated room
    const [updatedRoom] = await db.query(
      `SELECT r.*,
              t.tenant_id, t.full_name as tenant_name, t.phone as tenant_phone
       FROM rooms r
       LEFT JOIN tenants t ON r.current_tenant_id = t.tenant_id
       WHERE r.room_id = ?`,
      [id]
    );

    res.json(updatedRoom[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update room status" });
  }
};
