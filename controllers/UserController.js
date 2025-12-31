const db = require("../db");
const bcrypt = require("bcrypt");

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT user_id, username, role, created_at FROM users"
    );
    res.json(rows);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
};

// Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(
      "SELECT user_id, username, role, created_at FROM users WHERE user_id = ?",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
};

// Create new user
exports.createUser = async (req, res) => {
  try {
    const { username, password, role } = req.body;

    // Validate input
    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required" });
    }

    // Hash password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const [result] = await db.query(
      "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
      [username, password_hash, role || "staff"]
    );

    res.status(201).json({
      user_id: result.insertId,
      username,
      role: role || "staff",
      message: "User created successfully",
    });
  } catch (error) {
    console.error("Error creating user:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Username already exists" });
    }
    res.status(500).json({ error: "Failed to create user" });
  }
};

// Update user
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password, role } = req.body;

    let updateFields = [];
    let values = [];

    if (username) {
      updateFields.push("username = ?");
      values.push(username);
    }

    if (password) {
      const saltRounds = 10;
      const password_hash = await bcrypt.hash(password, saltRounds);
      updateFields.push("password_hash = ?");
      values.push(password_hash);
    }

    if (role) {
      updateFields.push("role = ?");
      values.push(role);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(id);

    const [result] = await db.query(
      `UPDATE users SET ${updateFields.join(", ")} WHERE user_id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "User updated successfully" });
  } catch (error) {
    console.error("Error updating user:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Username already exists" });
    }
    res.status(500).json({ error: "Failed to update user" });
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.query("DELETE FROM users WHERE user_id = ?", [
      id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
};

// Login
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required" });
    }

    const [rows] = await db.query(
      "SELECT user_id, username, password_hash, role FROM users WHERE username = ?",
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // In production, generate JWT token here
    res.json({
      token: "dummy-token", // Replace with actual JWT
      user: {
        user_id: user.user_id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ error: "Login failed" });
  }
};
