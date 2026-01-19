const express = require("express");
const router = express.Router();
const roomController = require("../controllers/RoomController");
const { authenticateToken } = require("../middleware/auth");

// Public routes
router.get("/", roomController.getAllRooms);
router.get("/:id", roomController.getRoomById);

// Protected routes (require authentication)
router.post("/", authenticateToken, roomController.createRoom);
router.put("/:id", authenticateToken, roomController.updateRoom);
router.delete("/:id", authenticateToken, roomController.deleteRoom);
router.patch("/:id/status", authenticateToken, roomController.updateRoomStatus);

module.exports = router;
