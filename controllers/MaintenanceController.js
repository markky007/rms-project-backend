const db = require("../db");

// Get all maintenance requests
exports.getAllMaintenanceRequests = async (req, res) => {
  try {
    const { room_id, status } = req.query;

    let query = "SELECT * FROM maintenance_requests";
    let conditions = [];
    let values = [];

    if (room_id) {
      conditions.push("room_id = ?");
      values.push(room_id);
    }
    if (status) {
      conditions.push("status = ?");
      values.push(status);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY reported_date DESC";

    const [rows] = await db.query(query, values);
    res.json(rows);
  } catch (error) {
    console.error("Error fetching maintenance requests:", error);
    res.status(500).json({ error: "Failed to fetch maintenance requests" });
  }
};

// Get maintenance request by ID
exports.getMaintenanceRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(
      "SELECT * FROM maintenance_requests WHERE request_id = ?",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Maintenance request not found" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Error fetching maintenance request:", error);
    res.status(500).json({ error: "Failed to fetch maintenance request" });
  }
};

// Create new maintenance request
exports.createMaintenanceRequest = async (req, res) => {
  try {
    const { room_id, title, description, photo_url } = req.body;

    if (!room_id || !title) {
      return res.status(400).json({ error: "Room ID and title are required" });
    }

    const [result] = await db.query(
      "INSERT INTO maintenance_requests (room_id, title, description, photo_url, status, cost) VALUES (?, ?, ?, ?, ?, ?)",
      [room_id, title, description || null, photo_url || null, "pending", 0]
    );

    res.status(201).json({
      request_id: result.insertId,
      room_id,
      title,
      description: description || null,
      photo_url: photo_url || null,
      status: "pending",
      cost: 0,
      message: "Maintenance request created successfully",
    });
  } catch (error) {
    console.error("Error creating maintenance request:", error);
    res.status(500).json({ error: "Failed to create maintenance request" });
  }
};

// Update maintenance request
exports.updateMaintenanceRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, status, cost, resolved_date } = req.body;

    let updateFields = [];
    let values = [];

    if (title !== undefined) {
      updateFields.push("title = ?");
      values.push(title);
    }
    if (description !== undefined) {
      updateFields.push("description = ?");
      values.push(description);
    }
    if (status !== undefined) {
      updateFields.push("status = ?");
      values.push(status);
    }
    if (cost !== undefined) {
      updateFields.push("cost = ?");
      values.push(cost);
    }
    if (resolved_date !== undefined) {
      updateFields.push("resolved_date = ?");
      values.push(resolved_date);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(id);

    const [result] = await db.query(
      `UPDATE maintenance_requests SET ${updateFields.join(
        ", "
      )} WHERE request_id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Maintenance request not found" });
    }

    res.json({ message: "Maintenance request updated successfully" });
  } catch (error) {
    console.error("Error updating maintenance request:", error);
    res.status(500).json({ error: "Failed to update maintenance request" });
  }
};

// Update maintenance status
exports.updateMaintenanceStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, cost } = req.body;

    if (!status) {
      return res.status(400).json({ error: "Status is required" });
    }

    let updateData = { status };

    if (cost !== undefined) {
      updateData.cost = cost;
    }

    if (status === "completed") {
      updateData.resolved_date = new Date();
    }

    const updateFields = Object.keys(updateData).map((key) => `${key} = ?`);
    const values = [...Object.values(updateData), id];

    const [result] = await db.query(
      `UPDATE maintenance_requests SET ${updateFields.join(
        ", "
      )} WHERE request_id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Maintenance request not found" });
    }

    res.json({ message: "Maintenance status updated successfully" });
  } catch (error) {
    console.error("Error updating maintenance status:", error);
    res.status(500).json({ error: "Failed to update maintenance status" });
  }
};

// Upload maintenance photo
exports.uploadMaintenancePhoto = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const photo_url = `/uploads/${req.file.filename}`;

    const [result] = await db.query(
      "UPDATE maintenance_requests SET photo_url = ? WHERE request_id = ?",
      [photo_url, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Maintenance request not found" });
    }

    res.json({ photo_url, message: "Photo uploaded successfully" });
  } catch (error) {
    console.error("Error uploading photo:", error);
    res.status(500).json({ error: "Failed to upload photo" });
  }
};
