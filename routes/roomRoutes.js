const express = require("express");
const router = express.Router();
const roomController = require("../controllers/RoomController");

router.get("/", roomController.getAllRooms);
router.get("/:id", roomController.getRoomById);
router.post("/", roomController.createRoom);
router.put("/:id", roomController.updateRoom);
router.delete("/:id", roomController.deleteRoom);
router.patch("/:id/status", roomController.updateRoomStatus);

module.exports = router;
