const express = require("express");
const cors = require("cors");
const app = express();
const db = require("./db");
require("dotenv").config();

const roomRoutes = require("./routes/roomRoutes");
const billingRoutes = require("./routes/billingRoutes");

const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/rooms", roomRoutes);
app.use("/api/billing", billingRoutes);

// Test Route
app.get("/", (req, res) => {
  res.send("Server is running!");
});

// Users Route
app.get("/users", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM users");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
