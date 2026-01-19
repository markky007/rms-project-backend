const express = require("express");
const router = express.Router();
const buildingController = require("../controllers/BuildingController");
const { authenticateToken } = require("../middleware/auth");

// Public routes
router.get("/", buildingController.getAllBuildings);
router.get("/:id", buildingController.getBuildingById);

// Protected routes (require authentication)
router.post("/", authenticateToken, buildingController.createBuilding);
router.put("/:id", authenticateToken, buildingController.updateBuilding);
router.delete("/:id", authenticateToken, buildingController.deleteBuilding);

module.exports = router;
