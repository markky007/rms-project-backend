const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/PaymentController");
const upload = require("../middleware/upload");
const { authenticateToken } = require("../middleware/auth");

// All payment routes require authentication
router.get("/", authenticateToken, paymentController.getAllPayments);
router.get("/:id", authenticateToken, paymentController.getPaymentById);
router.post("/", authenticateToken, paymentController.createPayment);
router.post(
  "/:id/slip",
  authenticateToken,
  upload.single("slip"),
  paymentController.uploadPaymentSlip,
);
router.patch(
  "/:id/approve",
  authenticateToken,
  paymentController.approvePayment,
);

module.exports = router;
