const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/PaymentController");
const upload = require("../middleware/upload");

router.get("/", paymentController.getAllPayments);
router.get("/:id", paymentController.getPaymentById);
router.post("/", paymentController.createPayment);
router.post(
  "/:id/slip",
  upload.single("slip"),
  paymentController.uploadPaymentSlip
);
router.patch("/:id/approve", paymentController.approvePayment);

module.exports = router;
