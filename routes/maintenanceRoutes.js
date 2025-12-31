const express = require("express");
const router = express.Router();
const maintenanceController = require("../controllers/MaintenanceController");
const upload = require("../middleware/upload");

router.get("/", maintenanceController.getAllMaintenanceRequests);
router.get("/:id", maintenanceController.getMaintenanceRequestById);
router.post("/", maintenanceController.createMaintenanceRequest);
router.put("/:id", maintenanceController.updateMaintenanceRequest);
router.patch("/:id/status", maintenanceController.updateMaintenanceStatus);
router.post(
  "/:id/photo",
  upload.single("photo"),
  maintenanceController.uploadMaintenancePhoto
);

module.exports = router;
