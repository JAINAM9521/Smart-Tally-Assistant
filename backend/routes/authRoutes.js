const router = require("express").Router();
const c = require("../controllers/authController");
const { requireAuth } = require("../middleware/authMiddleware");
const { authLimiter } = require("../middleware/rateLimitMiddleware");
const { z } = require("zod");
const { validateBody } = require("../middleware/validationMiddleware");
const registration = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  organization: z.string().min(2),
});
const login = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
const forgot = z.object({ email: z.string().email() });
const resend = z.object({ email: z.string().email() });
const reset = z.object({
  resetId: z.string().min(1),
  otp: z.string().min(4).max(10),
  password: z.string().min(8),
});
router.post("/register", authLimiter, validateBody(registration), c.register);
router.post("/login", authLimiter, validateBody(login), c.login);
router.post("/logout", requireAuth, c.logout);
router.get("/me", requireAuth, c.me);
router.post("/refresh", c.refresh);
router.post("/verify-email", c.verifyEmail);
router.get("/verify-email/:token", c.verifyEmailToken);
router.post(
  "/resend-verification",
  authLimiter,
  validateBody(resend),
  c.resendVerification,
);
router.post(
  "/forgot-password",
  authLimiter,
  validateBody(forgot),
  c.forgotPassword,
);
router.post(
  "/reset-password",
  authLimiter,
  validateBody(reset),
  c.resetPassword,
);
module.exports = router;
