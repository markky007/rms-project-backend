const express = require("express");
const router = express.Router();
const billingController = require("../controllers/BillingController");

router.post("/calculate", billingController.calculateBill);
router.get("/latest-reading/:room_id", billingController.getLatestReadings);
router.post("/create-invoice", billingController.createInvoice);
router.get("/", billingController.getAllInvoices);
router.get("/:id", billingController.getInvoiceById);

module.exports = router;
