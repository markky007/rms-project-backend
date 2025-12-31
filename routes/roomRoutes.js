const express = require("express");
const router = express.Router();
const roomController = require("../controllers/RoomController");

router.get("/", roomController.getAllRooms);
router.post("/", roomController.createRoom);
router.put("/:id/status", roomController.updateRoomStatus);

module.exports = router;
