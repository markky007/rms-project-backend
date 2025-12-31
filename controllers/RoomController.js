const db = require("../db");

// Get all rooms, optionally filtered by building
exports.getAllRooms = async (req, res) => {
  try {
    const { building_id } = req.query;
    let query = `
            SELECT r.*, b.name as building_name 
            FROM rooms r
            JOIN buildings b ON r.building_id = b.building_id
        `;
    const params = [];

    if (building_id) {
      query += " WHERE r.building_id = ?";
      params.push(building_id);
    }

    query += " ORDER BY r.room_number ASC";

    const [rooms] = await db.query(query, params);
    res.json(rooms);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch rooms" });
  }
};

// Update room status
exports.updateRoomStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'vacant', 'occupied', 'reserved', 'maintenance'

    await db.query("UPDATE rooms SET status = ? WHERE room_id = ?", [
      status,
      id,
    ]);
    res.json({ message: "Room status updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update room status" });
  }
};

// Create a new room (Helper for seeding/testing)
exports.createRoom = async (req, res) => {
  try {
    const { building_id, room_number, floor, base_rent } = req.body;
    const [result] = await db.query(
      "INSERT INTO rooms (building_id, room_number, floor, base_rent) VALUES (?, ?, ?, ?)",
      [building_id, room_number, floor, base_rent]
    );
    res.status(201).json({ id: result.insertId, message: "Room created" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
