const express = require("express");
const router = express.Router();
const billingController = require("../controllers/BillingController");

router.post("/calculate", billingController.calculateBill);
router.post("/create-invoice", billingController.createInvoice);
router.get("/", billingController.getAllInvoices);

module.exports = router;
