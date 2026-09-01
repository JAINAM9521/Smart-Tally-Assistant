const router = require("express").Router();

const c = require("../controllers/xmlController");

const { requireAuth } = require("../middleware/authMiddleware");

const { allowRoles } = require("../middleware/roleMiddleware");

/* =========================================================
   XML ROUTES
========================================================= */

/*
 * List generated XML files
 */
router.get("/", requireAuth, c.list);

/*
 * Generate XML from a validated run
 */
router.post(
  "/generate/:validationId",
  requireAuth,
  allowRoles("admin", "accountant"),
  c.generate,
);

/*
 * Download XML
 */
router.get("/:xmlId/download", requireAuth, c.download);

/*
 * Get XML details/content
 */
router.get("/:xmlId", requireAuth, c.get);

/*
 * Delete generated XML
 */
router.delete(
  "/:xmlId",
  requireAuth,
  allowRoles("admin", "accountant"),
  c.remove,
);

module.exports = router;
