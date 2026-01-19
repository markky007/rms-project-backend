const express = require("express");
const router = express.Router();
const maintenanceController = require("../controllers/MaintenanceController");
const upload = require("../middleware/upload");
const { authenticateToken } = require("../middleware/auth");

// Public routes
router.get("/", maintenanceController.getAllMaintenanceRequests);
router.get("/:id", maintenanceController.getMaintenanceRequestById);

// Protected routes (require authentication)
router.post(
  "/",
  authenticateToken,
  maintenanceController.createMaintenanceRequest,
);
router.put(
  "/:id",
  authenticateToken,
  maintenanceController.updateMaintenanceRequest,
);
router.patch(
  "/:id/status",
  authenticateToken,
  maintenanceController.updateMaintenanceStatus,
);
router.post(
  "/:id/photo",
  authenticateToken,
  upload.single("photo"),
  maintenanceController.uploadMaintenancePhoto,
);

module.exports = router;
