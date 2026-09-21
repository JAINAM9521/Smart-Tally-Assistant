const crypto = require("crypto");
const User = require("../models/User");
const PasswordReset = require("../models/PasswordReset");
const { hashPassword, comparePassword } = require("../utils/password");
const { signToken } = require("../utils/jwt");
const {
  sendVerificationEmail,
  sendPasswordResetOtp,
} = require("../services/emailService");
const { expired } = require("../utils/dateUtils");
const hashToken = (token) =>
  crypto.createHash("sha256").update(String(token)).digest("hex");

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  organization: user.organization,
  role: user.role,
  isEmailVerified: user.isEmailVerified,
});

exports.register = async (req, res, next) => {
  let createdUser = null;
  try {
    const { name, email, password, organization } = req.body;
    if (await User.exists({ email: email.toLowerCase() }))
      return res.status(409).json({
        success: false,
        message: "Email is already registered",
        code: "CONFLICT",
      });
    const token = crypto.randomBytes(32).toString("hex");
    const hashedToken = hashToken(token);
    const user = await User.create({
      name,
      email,
      organization,
      passwordHash: await hashPassword(password),
      role: "accountant",
      isEmailVerified: false,
      verificationToken: hashedToken,
      verificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    createdUser = user;

    try {
      await sendVerificationEmail({ email, token });
    } catch (emailError) {
      // Rollback newly created unverified account if email delivery fails
      if (createdUser?._id) {
        await User.deleteOne({ _id: createdUser._id, isEmailVerified: false });
      }
      return res.status(500).json({
        success: false,
        message:
          "Failed to deliver verification email. Account creation rolled back.",
        code: "EMAIL_DELIVERY_FAILED",
      });
    }

    res.status(201).json({
      success: true,
      message: "Account created. Verify your email before signing in.",
      user: publicUser(user),
      developmentVerificationToken:
        process.env.NODE_ENV === "production" || process.env.EMAIL_HOST
          ? undefined
          : token,
    });
  } catch (e) {
    if (createdUser?._id) {
      try {
        await User.deleteOne({ _id: createdUser._id, isEmailVerified: false });
      } catch (_) {}
    }
    next(e);
  }
};

exports.login = async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email.toLowerCase() });
    if (!user || !(await comparePassword(req.body.password, user.passwordHash)))
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
        code: "UNAUTHORIZED",
      });
    if (
      !user.isEmailVerified &&
      (process.env.NODE_ENV === "production" ||
        process.env.DEV_EMAIL_VERIFICATION !== "false")
    )
      return res.status(403).json({
        success: false,
        message: "Please verify your email before signing in.",
        code: "EMAIL_NOT_VERIFIED",
        email: user.email,
      });
    const token = signToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });
    res.json({ success: true, token, user: publicUser(user) });
  } catch (e) {
    next(e);
  }
};

exports.me = async (req, res) =>
  res.json({ success: true, user: publicUser(req.user) });
exports.logout = async (req, res) =>
  res.json({ success: true, message: "Logged out" });
exports.refresh = async (req, res) =>
  res.json({
    success: false,
    message: "Login again to issue a fresh token",
    code: "UNAUTHORIZED",
  });

exports.verifyEmail = async (req, res, next) => {
  try {
    const token = String(req.body?.token || "").trim();
    if (!token)
      return res.status(400).json({
        success: false,
        message: "Verification token is required.",
        code: "VALIDATION_ERROR",
      });
    const hashed = hashToken(token);
    const user = await User.findOne({
      $or: [{ verificationToken: hashed }, { verificationToken: token }],
    });
    if (!user)
      return res.status(400).json({
        success: false,
        message: "Verification token is invalid.",
        code: "INVALID_TOKEN",
      });
    if (!user.verificationExpires || expired(user.verificationExpires))
      return res.status(400).json({
        success: false,
        message: "Verification token has expired. Please request a new one.",
        code: "EXPIRED_TOKEN",
      });
    user.isEmailVerified = true;
    user.verificationToken = undefined;
    user.verificationExpires = undefined;
    await user.save();
    return res.json({ success: true, message: "Email verified successfully." });
  } catch (e) {
    next(e);
  }
};

exports.verifyEmailToken = async (req, res, next) => {
  try {
    const token = String(req.params.token || "").trim();
    if (!token)
      return res.status(400).json({
        success: false,
        message: "Verification token is required",
        code: "VALIDATION_ERROR",
      });
    const hashed = hashToken(token);
    const user = await User.findOne({
      $or: [{ verificationToken: hashed }, { verificationToken: token }],
    });
    if (!user)
      return res.status(400).json({
        success: false,
        message: "Verification token is invalid",
        code: "INVALID_TOKEN",
      });
    if (!user.verificationExpires || expired(user.verificationExpires))
      return res.status(400).json({
        success: false,
        message: "Verification token has expired. Please request a new one.",
        code: "EXPIRED_TOKEN",
      });
    user.isEmailVerified = true;
    user.verificationToken = undefined;
    user.verificationExpires = undefined;
    await user.save();
    res.json({ success: true, message: "Email verified successfully" });
  } catch (e) {
    next(e);
  }
};

exports.resendVerification = async (req, res, next) => {
  try {
    const email = String(req.body?.email || "")
      .toLowerCase()
      .trim();
    if (!email)
      return res.status(400).json({
        success: false,
        message: "Email is required",
        code: "VALIDATION_ERROR",
      });

    const user = await User.findOne({ email });
    // Generic response to prevent account enumeration
    if (!user || user.isEmailVerified) {
      return res.json({
        success: true,
        message:
          "If an unverified account with that email exists, a new verification email has been sent.",
      });
    }

    const token = crypto.randomBytes(32).toString("hex");
    user.verificationToken = hashToken(token);
    user.verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    await sendVerificationEmail({ email: user.email, token });

    return res.json({
      success: true,
      message:
        "If an unverified account with that email exists, a new verification email has been sent.",
      developmentVerificationToken:
        process.env.NODE_ENV === "production" || process.env.EMAIL_HOST
          ? undefined
          : token,
    });
  } catch (e) {
    next(e);
  }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email.toLowerCase() });
    if (!user)
      return res.json({
        success: true,
        message: "If the account exists, an OTP has been generated.",
      });
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    await PasswordReset.deleteMany({ user: user._id, used: false });
    const reset = await PasswordReset.create({
      user: user._id,
      otpHash: await hashPassword(otp),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    const delivery = await sendPasswordResetOtp({ email: user.email, otp });
    res.json({
      success: true,
      message: "Password reset instructions were sent.",
      developmentOtp:
        process.env.NODE_ENV === "production" || !delivery.development
          ? undefined
          : otp,
      resetId: reset._id,
    });
  } catch (e) {
    next(e);
  }
};
exports.resetPassword = async (req, res, next) => {
  try {
    const reset = await PasswordReset.findById(req.body.resetId);
    if (!reset || reset.used || expired(reset.expiresAt))
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
        code: "VALIDATION_ERROR",
      });
    if (Number(reset.attempts || 0) >= 5)
      return res.status(429).json({
        success: false,
        message: "Too many OTP attempts. Request a new code.",
        code: "TOO_MANY_ATTEMPTS",
      });
    if (!(await comparePassword(req.body.otp, reset.otpHash))) {
      reset.attempts = Number(reset.attempts || 0) + 1;
      await reset.save();
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
        code: "VALIDATION_ERROR",
      });
    }
    const user = await User.findById(reset.user);
    user.passwordHash = await hashPassword(req.body.password);
    await user.save();
    reset.used = true;
    await reset.save();
    res.json({ success: true, message: "Password reset successfully" });
  } catch (e) {
    next(e);
  }
};
