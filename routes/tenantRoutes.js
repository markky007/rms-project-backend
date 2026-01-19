const express = require("express");
const router = express.Router();
const tenantController = require("../controllers/TenantController");
const upload = require("../middleware/upload");
const { authenticateToken } = require("../middleware/auth");

// Public routes
router.get("/", tenantController.getAllTenants);
router.get("/:id", tenantController.getTenantById);

// Protected routes (require authentication)
router.post("/", authenticateToken, tenantController.createTenant);
router.put("/:id", authenticateToken, tenantController.updateTenant);
router.delete("/:id", authenticateToken, tenantController.deleteTenant);
router.post(
  "/:id/photo",
  authenticateToken,
  upload.single("photo"),
  tenantController.uploadTenantPhoto,
);

module.exports = router;
