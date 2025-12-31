const express = require("express");
const router = express.Router();
const userController = require("../controllers/UserController");

// User routes
router.get("/", userController.getAllUsers);
router.get("/:id", userController.getUserById);
router.post("/", userController.createUser);
router.put("/:id", userController.updateUser);
router.delete("/:id", userController.deleteUser);

// Auth routes
router.post("/auth/login", userController.login);

module.exports = router;
