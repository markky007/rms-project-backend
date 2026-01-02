const express = require("express");
const router = express.Router();
const billingController = require("../controllers/BillingController");

router.post("/calculate", billingController.calculateBill);
router.get("/latest-reading/:room_id", billingController.getLatestReadings);
router.post("/create-invoice", billingController.createInvoice);
router.patch("/bulk-status", billingController.bulkUpdateStatus); // Must be before /:id routes
router.get("/", billingController.getAllInvoices);
router.get("/:id", billingController.getInvoiceById);
router.delete("/:id", billingController.deleteInvoice);
router.patch("/:id/status", billingController.updateInvoiceStatus);

module.exports = router;
