const express = require("express");
const router = express.Router();
const contractController = require("../controllers/ContractController");
const { authenticateToken } = require("../middleware/auth");

// Public routes
router.get("/", contractController.getAllContracts);
router.get("/:id", contractController.getContractById);

// Protected routes (require authentication)
router.post("/", authenticateToken, contractController.createContract);
router.put("/:id", authenticateToken, contractController.updateContract);
router.patch(
  "/:id/terminate",
  authenticateToken,
  contractController.terminateContract,
);
router.delete("/:id", authenticateToken, contractController.deleteContract);

module.exports = router;
