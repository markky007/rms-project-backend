const db = require("../db");

// Get all tenants
exports.getAllTenants = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM tenants ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (error) {
    console.error("Error fetching tenants:", error);
    res.status(500).json({ error: "Failed to fetch tenants" });
  }
};

// Get tenant by ID
exports.getTenantById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query("SELECT * FROM tenants WHERE tenant_id = ?", [
      id,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Error fetching tenant:", error);
    res.status(500).json({ error: "Failed to fetch tenant" });
  }
};

// Create new tenant
exports.createTenant = async (req, res) => {
  try {
    const { full_name, id_card, phone, line_id, address, photo_url } = req.body;

    if (!full_name || !id_card) {
      return res
        .status(400)
        .json({ error: "Full name and ID card are required" });
    }

    const [result] = await db.query(
      "INSERT INTO tenants (full_name, id_card, phone, line_id, address, photo_url) VALUES (?, ?, ?, ?, ?, ?)",
      [
        full_name,
        id_card,
        phone || null,
        line_id || null,
        address || null,
        photo_url || null,
      ]
    );

    res.status(201).json({
      tenant_id: result.insertId,
      full_name,
      id_card,
      phone: phone || null,
      line_id: line_id || null,
      address: address || null,
      photo_url: photo_url || null,
      message: "Tenant created successfully",
    });
  } catch (error) {
    console.error("Error creating tenant:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "ID card already exists" });
    }
    res.status(500).json({ error: "Failed to create tenant" });
  }
};

// Update tenant
exports.updateTenant = async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, id_card, phone, line_id, address, photo_url } = req.body;

    let updateFields = [];
    let values = [];

    if (full_name !== undefined) {
      updateFields.push("full_name = ?");
      values.push(full_name);
    }
    if (id_card !== undefined) {
      updateFields.push("id_card = ?");
      values.push(id_card);
    }
    if (phone !== undefined) {
      updateFields.push("phone = ?");
      values.push(phone);
    }
    if (line_id !== undefined) {
      updateFields.push("line_id = ?");
      values.push(line_id);
    }
    if (address !== undefined) {
      updateFields.push("address = ?");
      values.push(address);
    }
    if (photo_url !== undefined) {
      updateFields.push("photo_url = ?");
      values.push(photo_url);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(id);

    const [result] = await db.query(
      `UPDATE tenants SET ${updateFields.join(", ")} WHERE tenant_id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    res.json({ message: "Tenant updated successfully" });
  } catch (error) {
    console.error("Error updating tenant:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "ID card already exists" });
    }
    res.status(500).json({ error: "Failed to update tenant" });
  }
};

// Delete tenant
exports.deleteTenant = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.query("DELETE FROM tenants WHERE tenant_id = ?", [
      id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    res.json({ message: "Tenant deleted successfully" });
  } catch (error) {
    console.error("Error deleting tenant:", error);
    res.status(500).json({ error: "Failed to delete tenant" });
  }
};

// Upload tenant photo
exports.uploadTenantPhoto = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const photo_url = `/uploads/${req.file.filename}`;

    const [result] = await db.query(
      "UPDATE tenants SET photo_url = ? WHERE tenant_id = ?",
      [photo_url, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    res.json({ photo_url, message: "Photo uploaded successfully" });
  } catch (error) {
    console.error("Error uploading photo:", error);
    res.status(500).json({ error: "Failed to upload photo" });
  }
};
