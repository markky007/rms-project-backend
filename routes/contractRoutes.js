const express = require("express");
const router = express.Router();
const contractController = require("../controllers/ContractController");

router.get("/", contractController.getAllContracts);
router.get("/:id", contractController.getContractById);
router.post("/", contractController.createContract);
router.put("/:id", contractController.updateContract);
router.patch("/:id/terminate", contractController.terminateContract);

module.exports = router;
