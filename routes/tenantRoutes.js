const express = require("express");
const router = express.Router();
const tenantController = require("../controllers/TenantController");
const upload = require("../middleware/upload");

router.get("/", tenantController.getAllTenants);
router.get("/:id", tenantController.getTenantById);
router.post("/", tenantController.createTenant);
router.put("/:id", tenantController.updateTenant);
router.delete("/:id", tenantController.deleteTenant);
router.post(
  "/:id/photo",
  upload.single("photo"),
  tenantController.uploadTenantPhoto
);

module.exports = router;
