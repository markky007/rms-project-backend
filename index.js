const express = require("express");
const cors = require("cors");
const path = require("path");
const app = express();
const db = require("./db");
require("dotenv").config();

// Import routes
const roomRoutes = require("./routes/roomRoutes");
const billingRoutes = require("./routes/billingRoutes");
const userRoutes = require("./routes/userRoutes");
const buildingRoutes = require("./routes/buildingRoutes");
const tenantRoutes = require("./routes/tenantRoutes");
const contractRoutes = require("./routes/contractRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const maintenanceRoutes = require("./routes/maintenanceRoutes");

const port = process.env.PORT || 3000;

// CORS Configuration
const allowedOrigins = [
  process.env.CORS_ORIGIN,
  "http://localhost:9000",
  "http://localhost:5173",
  "http://localhost:3000",
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json());

// Serve static files from uploads directory
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// API Routes
app.use("/api/rooms", roomRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/users", userRoutes);
app.use("/api/buildings", buildingRoutes);
app.use("/api/tenants", tenantRoutes);
app.use("/api/contracts", contractRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/maintenance", maintenanceRoutes);

// Test Route
app.get("/", (req, res) => {
  res.send("Server is running!");
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
