const db = require("../db");

// Get all contracts
exports.getAllContracts = async (req, res) => {
  try {
    const { room_id, tenant_id, is_active } = req.query;

    let query = `
      SELECT c.*, r.house_number, t.full_name as tenant_name, t.phone as tenant_phone
      FROM contracts c
      JOIN rooms r ON c.room_id = r.room_id
      JOIN tenants t ON c.tenant_id = t.tenant_id
    `;
    let conditions = [];
    let values = [];

    if (room_id) {
      conditions.push("c.room_id = ?");
      values.push(room_id);
    }
    if (tenant_id) {
      conditions.push("c.tenant_id = ?");
      values.push(tenant_id);
    }
    if (is_active !== undefined) {
      conditions.push("c.is_active = ?");
      values.push(is_active === "true" || is_active === "1");
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY c.contract_id ASC";

    const [rows] = await db.query(query, values);
    res.json(rows);
  } catch (error) {
    console.error("Error fetching contracts:", error);
    res.status(500).json({ error: "Failed to fetch contracts" });
  }
};

// Get contract by ID
exports.getContractById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(
      "SELECT * FROM contracts WHERE contract_id = ?",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Contract not found" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Error fetching contract:", error);
    res.status(500).json({ error: "Failed to fetch contract" });
  }
};

// Create new contract
exports.createContract = async (req, res) => {
  try {
    const { room_id, tenant_id, start_date, end_date, deposit, rent_amount } =
      req.body;

    if (
      !room_id ||
      !tenant_id ||
      !start_date ||
      !end_date ||
      deposit === undefined ||
      !rent_amount
    ) {
      return res
        .status(400)
        .json({ error: "All contract fields are required" });
    }

    const [result] = await db.query(
      "INSERT INTO contracts (room_id, tenant_id, start_date, end_date, deposit, rent_amount, is_active) VALUES (?, ?, ?, ?, ?, ?, TRUE)",
      [room_id, tenant_id, start_date, end_date, deposit, rent_amount]
    );

    // Update room status to occupied and set current tenant
    await db.query(
      "UPDATE rooms SET status = ?, current_tenant_id = ? WHERE room_id = ?",
      ["occupied", tenant_id, room_id]
    );

    res.status(201).json({
      contract_id: result.insertId,
      room_id,
      tenant_id,
      start_date,
      end_date,
      deposit,
      rent_amount,
      is_active: true,
      message: "Contract created successfully",
    });
  } catch (error) {
    console.error("Error creating contract:", error);
    res.status(500).json({ error: "Failed to create contract" });
  }
};

// Update contract
exports.updateContract = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      room_id,
      tenant_id,
      start_date,
      end_date,
      deposit,
      rent_amount,
      is_active,
    } = req.body;

    let updateFields = [];
    let values = [];

    if (room_id !== undefined) {
      updateFields.push("room_id = ?");
      values.push(room_id);
    }
    if (tenant_id !== undefined) {
      updateFields.push("tenant_id = ?");
      values.push(tenant_id);
    }
    if (start_date !== undefined) {
      updateFields.push("start_date = ?");
      values.push(start_date);
    }
    if (end_date !== undefined) {
      updateFields.push("end_date = ?");
      values.push(end_date);
    }
    if (deposit !== undefined) {
      updateFields.push("deposit = ?");
      values.push(deposit);
    }
    if (rent_amount !== undefined) {
      updateFields.push("rent_amount = ?");
      values.push(rent_amount);
    }
    if (is_active !== undefined) {
      updateFields.push("is_active = ?");
      values.push(is_active);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(id);

    const [result] = await db.query(
      `UPDATE contracts SET ${updateFields.join(", ")} WHERE contract_id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Contract not found" });
    }

    // If is_active was updated, update room's current_tenant_id
    if (is_active !== undefined) {
      const [contract] = await db.query(
        "SELECT room_id, tenant_id FROM contracts WHERE contract_id = ?",
        [id]
      );

      if (contract.length > 0) {
        const { room_id: contractRoomId, tenant_id: contractTenantId } =
          contract[0];

        if (is_active) {
          // Contract activated - set current tenant
          await db.query(
            "UPDATE rooms SET current_tenant_id = ?, status = 'occupied' WHERE room_id = ?",
            [contractTenantId, contractRoomId]
          );
        } else {
          // Contract deactivated - clear current tenant
          await db.query(
            "UPDATE rooms SET current_tenant_id = NULL, status = 'vacant' WHERE room_id = ?",
            [contractRoomId]
          );
        }
      }
    }

    res.json({ message: "Contract updated successfully" });
  } catch (error) {
    console.error("Error updating contract:", error);
    res.status(500).json({ error: "Failed to update contract" });
  }
};

// Terminate contract
exports.terminateContract = async (req, res) => {
  try {
    const { id } = req.params;

    // Get contract details
    const [contracts] = await db.query(
      "SELECT room_id FROM contracts WHERE contract_id = ?",
      [id]
    );

    if (contracts.length === 0) {
      return res.status(404).json({ error: "Contract not found" });
    }

    const room_id = contracts[0].room_id;

    // Update contract status
    await db.query(
      "UPDATE contracts SET is_active = FALSE WHERE contract_id = ?",
      [id]
    );

    // Update room status to vacant and clear current tenant
    await db.query(
      "UPDATE rooms SET status = ?, current_tenant_id = NULL WHERE room_id = ?",
      ["vacant", room_id]
    );

    res.json({ message: "Contract terminated successfully" });
  } catch (error) {
    console.error("Error terminating contract:", error);
    res.status(500).json({ error: "Failed to terminate contract" });
  }
};
// Delete contract
exports.deleteContract = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if contract exists
    const [existing] = await db.query(
      "SELECT * FROM contracts WHERE contract_id = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: "Contract not found" });
    }

    const contract = existing[0];

    // If active, clear room status
    if (contract.is_active) {
      await db.query(
        "UPDATE rooms SET status = 'vacant', current_tenant_id = NULL WHERE room_id = ?",
        [contract.room_id]
      );
    }

    // START FIX: Cascade delete items
    const [invoices] = await db.query(
      "SELECT invoice_id FROM invoices WHERE contract_id = ?",
      [id]
    );

    if (invoices.length > 0) {
      const invoiceIds = invoices.map((i) => i.invoice_id);

      // 1. Delete payments associated with these invoices
      await db.query("DELETE FROM payments WHERE invoice_id IN (?)", [
        invoiceIds,
      ]);

      // 2. Delete invoice_items
      await db.query("DELETE FROM invoice_items WHERE invoice_id IN (?)", [
        invoiceIds,
      ]);

      // 3. Delete invoices
      await db.query("DELETE FROM invoices WHERE contract_id = ?", [id]);
    }

    await db.query("DELETE FROM contracts WHERE contract_id = ?", [id]);

    res.json({ message: "Contract deleted successfully" });
  } catch (error) {
    console.error("Error deleting contract:", error);
    res.status(500).json({ error: "Failed to delete contract" });
  }
};
