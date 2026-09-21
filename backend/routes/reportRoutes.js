const router = require("express").Router();
const c = require("../controllers/reportController");
const { requireAuth } = require("../middleware/authMiddleware");

router.get("/validation", requireAuth, c.list);
router.get("/validation/:id", requireAuth, c.get);

module.exports = router;
