const express = require("express");
const router = express.Router();
const billingController = require("../controllers/BillingController");
const { authenticateToken } = require("../middleware/auth");

// Public routes
router.get("/", billingController.getAllInvoices);
router.get("/:id", billingController.getInvoiceById);
router.get("/latest-reading/:room_id", billingController.getLatestReadings);

// Protected routes (require authentication)
router.post("/calculate", authenticateToken, billingController.calculateBill);
router.post(
  "/create-invoice",
  authenticateToken,
  billingController.createInvoice,
);
router.patch(
  "/bulk-status",
  authenticateToken,
  billingController.bulkUpdateStatus,
);
router.delete("/:id", authenticateToken, billingController.deleteInvoice);
router.patch(
  "/:id/status",
  authenticateToken,
  billingController.updateInvoiceStatus,
);

module.exports = router;
