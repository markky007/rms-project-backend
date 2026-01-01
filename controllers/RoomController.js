const db = require("../db");

// Get all rooms, optionally filtered by building
exports.getAllRooms = async (req, res) => {
  try {
    const { building_id } = req.query;
    let query = `
            SELECT r.*, b.name as building_name,
                   t.tenant_id, t.full_name as tenant_name, t.phone as tenant_phone
            FROM rooms r
            JOIN buildings b ON r.building_id = b.building_id
            LEFT JOIN tenants t ON r.current_tenant_id = t.tenant_id
        `;
    const params = [];

    if (building_id) {
      query += " WHERE r.building_id = ?";
      params.push(building_id);
    }

    query += " ORDER BY b.name, r.floor, r.room_number ASC";

    const [rooms] = await db.query(query, params);
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
      `SELECT r.*, b.name as building_name,
              t.tenant_id, t.full_name as tenant_name, t.phone as tenant_phone
       FROM rooms r
       JOIN buildings b ON r.building_id = b.building_id
       LEFT JOIN tenants t ON r.current_tenant_id = t.tenant_id
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
      building_id,
      room_number,
      floor,
      base_rent,
      status,
      current_tenant_id,
    } = req.body;

    // Validate required fields
    if (!building_id || !room_number || floor === undefined || !base_rent) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Check if room number already exists in the building
    const [existing] = await db.query(
      "SELECT room_id FROM rooms WHERE building_id = ? AND room_number = ?",
      [building_id, room_number]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        error: "Room number already exists in this building",
      });
    }

    const [result] = await db.query(
      "INSERT INTO rooms (building_id, room_number, floor, base_rent, status, current_tenant_id) VALUES (?, ?, ?, ?, ?, ?)",
      [
        building_id,
        room_number,
        floor,
        base_rent,
        status || "vacant",
        current_tenant_id || null,
      ]
    );

    // Fetch the created room with building name
    const [newRoom] = await db.query(
      `SELECT r.*, b.name as building_name,
              t.tenant_id, t.full_name as tenant_name, t.phone as tenant_phone
       FROM rooms r
       JOIN buildings b ON r.building_id = b.building_id
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
      building_id,
      room_number,
      floor,
      base_rent,
      status,
      current_tenant_id,
    } = req.body;

    // Check if room exists
    const [existing] = await db.query(
      "SELECT room_id FROM rooms WHERE room_id = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: "Room not found" });
    }

    // Check for duplicate room number in the same building
    if (building_id && room_number) {
      const [duplicate] = await db.query(
        "SELECT room_id FROM rooms WHERE building_id = ? AND room_number = ? AND room_id != ?",
        [building_id, room_number, id]
      );

      if (duplicate.length > 0) {
        return res.status(400).json({
          error: "Room number already exists in this building",
        });
      }
    }

    // Build update query dynamically
    const updates = [];
    const params = [];

    if (building_id !== undefined) {
      updates.push("building_id = ?");
      params.push(building_id);
    }
    if (room_number !== undefined) {
      updates.push("room_number = ?");
      params.push(room_number);
    }
    if (floor !== undefined) {
      updates.push("floor = ?");
      params.push(floor);
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
      `SELECT r.*, b.name as building_name,
              t.tenant_id, t.full_name as tenant_name, t.phone as tenant_phone
       FROM rooms r
       JOIN buildings b ON r.building_id = b.building_id
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

    // Check if room has active contracts
    const [contracts] = await db.query(
      "SELECT contract_id FROM contracts WHERE room_id = ? AND is_active = TRUE",
      [id]
    );

    if (contracts.length > 0) {
      return res.status(400).json({
        error: "Cannot delete room with active contracts",
      });
    }

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
      `SELECT r.*, b.name as building_name,
              t.tenant_id, t.full_name as tenant_name, t.phone as tenant_phone
       FROM rooms r
       JOIN buildings b ON r.building_id = b.building_id
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
