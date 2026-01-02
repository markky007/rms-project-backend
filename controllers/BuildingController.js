const db = require("../db");

// Get all buildings
exports.getAllBuildings = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM buildings ORDER BY building_id ASC"
    );
    res.json(rows);
  } catch (error) {
    console.error("Error fetching buildings:", error);
    res.status(500).json({ error: "Failed to fetch buildings" });
  }
};

// Get building by ID
exports.getBuildingById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(
      "SELECT * FROM buildings WHERE building_id = ?",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Building not found" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Error fetching building:", error);
    res.status(500).json({ error: "Failed to fetch building" });
  }
};

// Create new building
exports.createBuilding = async (req, res) => {
  try {
    const { name, address, water_rate, elec_rate } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Building name is required" });
    }

    const [result] = await db.query(
      "INSERT INTO buildings (name, address, water_rate, elec_rate) VALUES (?, ?, ?, ?)",
      [name, address || null, water_rate || 18.0, elec_rate || 7.0]
    );

    res.status(201).json({
      building_id: result.insertId,
      name,
      address: address || null,
      water_rate: water_rate || 18.0,
      elec_rate: elec_rate || 7.0,
      message: "Building created successfully",
    });
  } catch (error) {
    console.error("Error creating building:", error);
    res.status(500).json({ error: "Failed to create building" });
  }
};

// Update building
exports.updateBuilding = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, water_rate, elec_rate } = req.body;

    let updateFields = [];
    let values = [];

    if (name !== undefined) {
      updateFields.push("name = ?");
      values.push(name);
    }
    if (address !== undefined) {
      updateFields.push("address = ?");
      values.push(address);
    }
    if (water_rate !== undefined) {
      updateFields.push("water_rate = ?");
      values.push(water_rate);
    }
    if (elec_rate !== undefined) {
      updateFields.push("elec_rate = ?");
      values.push(elec_rate);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(id);

    const [result] = await db.query(
      `UPDATE buildings SET ${updateFields.join(", ")} WHERE building_id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Building not found" });
    }

    res.json({ message: "Building updated successfully" });
  } catch (error) {
    console.error("Error updating building:", error);
    res.status(500).json({ error: "Failed to update building" });
  }
};

// Delete building
exports.deleteBuilding = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if building has rooms
    const [rooms] = await db.query(
      "SELECT COUNT(*) as count FROM rooms WHERE building_id = ?",
      [id]
    );

    if (rooms[0].count > 0) {
      return res.status(400).json({
        error:
          "Cannot delete building with existing rooms. Please delete rooms first or use cascade delete.",
      });
    }

    const [result] = await db.query(
      "DELETE FROM buildings WHERE building_id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Building not found" });
    }

    res.json({ message: "Building deleted successfully" });
  } catch (error) {
    console.error("Error deleting building:", error);
    res.status(500).json({ error: "Failed to delete building" });
  }
};
