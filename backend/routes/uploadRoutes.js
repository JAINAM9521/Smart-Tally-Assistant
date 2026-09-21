const router = require("express").Router();
const c = require("../controllers/uploadController");
const { requireAuth } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");
const { uploadSingle } = require("../middleware/uploadMiddleware");
const { actionLimiter } = require("../middleware/rateLimitMiddleware");

router.get("/", requireAuth, c.list);
router.post(
  "/",
  requireAuth,
  allowRoles("admin", "accountant"),
  actionLimiter,
  uploadSingle,
  c.create,
);
router.get("/:uploadId/preview", requireAuth, c.preview);

module.exports = router;
