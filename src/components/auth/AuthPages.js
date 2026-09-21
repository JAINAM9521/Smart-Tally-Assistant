"use client";

import { useState, useEffect } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Database,
  FileCode2,
  FileSpreadsheet,
  ShieldCheck,
} from "lucide-react";

import {
  loginUser,
  registerUser,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
  resendVerification,
} from "../../lib/api";

import { save } from "../../lib/utils";
import { Logo } from "../layout/AppLayout";

/* =========================================================
   AUTH
========================================================= */

function Auth({ mode }) {
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    email: "",
    organization: "",
    password: "",
    confirm: "",
  });

  const [error, setError] = useState("");

  const [loading, setLoading] = useState(false);

  const [success, setSuccess] = useState("");
  const [resendingVerification, setResendingVerification] = useState(false);
  const [resendStatus, setResendStatus] = useState("");

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleResend = async () => {
    if (!form.email) {
      setError("Please enter your email to resend the verification link.");
      return;
    }
    setResendingVerification(true);
    setResendStatus("");
    try {
      await resendVerification(form.email.trim());
      setResendStatus(
        "A new verification link has been sent. Please check your inbox.",
      );
    } catch (err) {
      setResendStatus(err?.message || "Failed to resend verification email.");
    } finally {
      setResendingVerification(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();

    setLoading(true);
    setError("");
    setSuccess("");
    setResendStatus("");

    try {
      if (mode === "register" && form.password.length < 8) {
        throw new Error("Password must be at least 8 characters.");
      }

      if (mode === "register" && form.password !== form.confirm) {
        throw new Error("Passwords do not match.");
      }

      if (mode === "register") {
        await registerUser({
          name: form.name,
          email: form.email.trim(),
          organization: form.organization,
          password: form.password,
        });

        setSuccess(
          "Account created successfully! We've sent a verification link to your email. Please verify your email before signing in.",
        );

        setForm({
          name: "",
          email: form.email,
          organization: "",
          password: "",
          confirm: "",
        });

        return;
      }

      const user = await loginUser(form.email.trim(), form.password);

      save("currentUser", user);

      router.replace("/dashboard");
    } catch (err) {
      setError(err?.message || "Unable to complete this request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <AuthBrand />

      <div className="auth-form-wrap">
        <div className="auth-form">
          <div className="auth-mobile-logo">
            <Logo />
          </div>

          <span className="eyebrow">
            {mode === "login" ? "WELCOME BACK" : "GET STARTED"}
          </span>

          <h2>
            {mode === "login"
              ? "Sign in to your workspace"
              : "Create your workspace"}
          </h2>

          <p>
            {mode === "login"
              ? "Your cleanest imports start here."
              : "Set up your account in less than a minute."}
          </p>

          <form onSubmit={submit}>
            {mode === "register" && (
              <label>
                Full name
                <input
                  required
                  placeholder="Jainam Shah"
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                />
              </label>
            )}

            <label>
              Work email
              <input
                required
                type="email"
                placeholder="you@company.com"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
              />
            </label>

            {mode === "register" && (
              <label>
                Organization
                <input
                  required
                  placeholder="Saroj Metal"
                  value={form.organization}
                  onChange={(event) =>
                    updateField("organization", event.target.value)
                  }
                />
              </label>
            )}

            <label>
              Password
              <input
                required
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={(event) =>
                  updateField("password", event.target.value)
                }
              />
            </label>

            {mode === "register" && (
              <label>
                Confirm password
                <input
                  required
                  type="password"
                  placeholder="••••••••"
                  value={form.confirm}
                  onChange={(event) =>
                    updateField("confirm", event.target.value)
                  }
                />
              </label>
            )}

            {error && (
              <div className="form-error">
                {error}
                {error.toLowerCase().includes("verify your email") && (
                  <div style={{ marginTop: 8 }}>
                    <button
                      type="button"
                      className="btn btn-secondary full"
                      onClick={handleResend}
                      disabled={resendingVerification}
                    >
                      {resendingVerification
                        ? "Sending..."
                        : "Resend verification email"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {resendStatus && <div className="form-success">{resendStatus}</div>}

            {success && <div className="form-success">{success}</div>}

            <button
              type="submit"
              className="btn btn-primary full"
              disabled={loading}
            >
              {loading
                ? "Please wait..."
                : mode === "login"
                  ? "Sign in"
                  : "Create account"}

              <ArrowRight size={16} />
            </button>
          </form>

          {mode === "login" ? (
            <div className="auth-switch">
              <span>New to Smart Tally?</span>

              <Link href="/register">Create an account</Link>

              <Link href="/forgot-password">Forgot password?</Link>
            </div>
          ) : (
            <div className="auth-switch">
              <span>Already have an account?</span>

              <Link href="/login">Sign in</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   AUTH BRAND
========================================================= */

function AuthBrand() {
  return (
    <div className="auth-brand">
      {/*
        IMPORTANT:
        Logo already returns a Link.
        Do NOT wrap <Logo /> in another Link.
      */}
      <Logo />

      <div className="auth-art">
        <div className="eyebrow">
          <span className="pulse-dot" />
          SMART ACCOUNTING WORKFLOW
        </div>

        <h1>
          From spreadsheet
          <br />
          to <em>books-ready.</em>
        </h1>

        <p>
          Validate every row. Fix what matters. Generate XML with confidence.
        </p>

        <div className="auth-flow">
          <span>
            <FileSpreadsheet />
          </span>

          <i />

          <span>
            <ShieldCheck />
          </span>

          <i />

          <span>
            <FileCode2 />
          </span>

          <i />

          <span>
            <Database />
          </span>
        </div>

        <small>
          Excel data <b>→</b> Smart validation <b>→</b> Tally XML
        </small>
      </div>

      <div className="auth-foot">© 2026 Smart Tally XML Assistant</div>
    </div>
  );
}

/* =========================================================
   FORGOT PASSWORD
========================================================= */

function ForgotPassword() {
  const [stage, setStage] = useState(1);

  const [form, setForm] = useState({
    email: "",
    otp: "",
    password: "",
    confirm: "",
    resetId: "",
  });

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  const [loading, setLoading] = useState(false);

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const submit = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      if (stage === 1) {
        const result = await requestPasswordReset(form.email.trim());

        if (result?.resetId) {
          setForm((current) => ({
            ...current,
            resetId: result.resetId,
          }));

          if (result?.developmentOtp) {
            setSuccess(
              `Development verification code: ${result.developmentOtp}`,
            );
          } else {
            setSuccess(
              "Password reset instructions have been sent to your email.",
            );
          }

          setStage(2);
        } else {
          // Unknown email: protect against account enumeration by staying on stage 1 with a generic success notice
          setSuccess(
            "If an account exists with that email address, password reset instructions have been sent.",
          );
        }

        return;
      }

      if (stage === 2) {
        if (!form.resetId) {
          throw new Error("Password reset session is missing. Start again.");
        }

        if (!form.otp) {
          throw new Error("Enter the verification code.");
        }

        if (form.password.length < 8) {
          throw new Error("Password must be at least 8 characters.");
        }

        if (form.password !== form.confirm) {
          throw new Error("Passwords do not match.");
        }

        await resetPassword({
          resetId: form.resetId,
          email: form.email.trim(),
          otp: form.otp,
          password: form.password,
        });

        setStage(3);

        return;
      }
    } catch (err) {
      setError(err?.message || "Unable to complete password reset.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <AuthBrand />

      <div className="auth-form-wrap">
        <div className="auth-form">
          <Link href="/login" className="text-link">
            <ArrowLeft size={15} />
            Back to login
          </Link>

          <span
            className="eyebrow"
            style={{
              marginTop: 45,
            }}
          >
            RESET PASSWORD
          </span>

          <h2>{stage === 3 ? "Password updated" : "Recover your account"}</h2>

          <p>
            {stage === 1
              ? "Enter your account email to begin the password reset."
              : stage === 2
                ? "Enter the verification code and choose a new password."
                : "Your password has been updated successfully."}
          </p>

          {stage < 3 ? (
            <form onSubmit={submit}>
              {stage === 1 ? (
                <label>
                  Email
                  <input
                    required
                    type="email"
                    placeholder="you@company.com"
                    value={form.email}
                    onChange={(event) =>
                      updateField("email", event.target.value)
                    }
                  />
                </label>
              ) : (
                <>
                  <label>
                    Verification code
                    <input
                      required
                      placeholder="Enter code"
                      value={form.otp}
                      onChange={(event) =>
                        updateField("otp", event.target.value)
                      }
                    />
                  </label>

                  <label>
                    New password
                    <input
                      required
                      type="password"
                      placeholder="••••••••"
                      value={form.password}
                      onChange={(event) =>
                        updateField("password", event.target.value)
                      }
                    />
                  </label>

                  <label>
                    Confirm password
                    <input
                      required
                      type="password"
                      placeholder="••••••••"
                      value={form.confirm}
                      onChange={(event) =>
                        updateField("confirm", event.target.value)
                      }
                    />
                  </label>
                </>
              )}

              {error && <div className="form-error">{error}</div>}

              {success && <div className="form-success">{success}</div>}

              <button
                type="submit"
                className="btn btn-primary full"
                disabled={loading}
              >
                {loading
                  ? "Please wait..."
                  : stage === 1
                    ? "Verify email"
                    : "Reset password"}

                <ArrowRight size={15} />
              </button>
            </form>
          ) : (
            <>
              <div className="success-empty">
                <CheckCircle2 size={42} />

                <p>
                  Your password has been updated. You can now sign in with the
                  new password.
                </p>
              </div>

              <Link href="/login" className="btn btn-primary full">
                Return to login
                <ArrowRight size={15} />
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   VERIFY EMAIL PAGE
========================================================= */

function VerifyEmailPage({ token }) {
  const [status, setStatus] = useState("loading"); // 'loading' | 'success' | 'expired' | 'invalid' | 'idle'
  const [message, setMessage] = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  useEffect(() => {
    let rawToken = token;
    if (!rawToken && typeof window !== "undefined") {
      const parts = window.location.pathname.split("/verify-email/");
      if (parts.length > 1 && parts[1]) {
        rawToken = decodeURIComponent(parts[1].split(/[?#]/)[0]);
      }
    }

    if (!rawToken) {
      setStatus("idle");
      return;
    }

    let active = true;
    async function doVerify() {
      try {
        await verifyEmail(rawToken);
        if (active) {
          setStatus("success");
          setMessage("Your email address has been successfully verified.");
        }
      } catch (err) {
        if (!active) return;
        const msg = String(err?.message || "");
        if (msg.toLowerCase().includes("expired")) {
          setStatus("expired");
          setMessage(
            "Your verification link has expired. Request a new one below.",
          );
        } else {
          setStatus("invalid");
          setMessage(
            "This verification link is invalid. It may have already been used.",
          );
        }
      }
    }

    doVerify();
    return () => {
      active = false;
    };
  }, [token]);

  const handleResend = async (e) => {
    e.preventDefault();
    if (!resendEmail) return;
    setResending(true);
    setResendMessage("");
    try {
      await resendVerification(resendEmail.trim());
      setResendMessage(
        "If an unverified account exists with that email, a new verification link has been sent.",
      );
    } catch (err) {
      setResendMessage(err?.message || "Unable to resend verification email.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-page">
      <AuthBrand />
      <div className="auth-form-wrap">
        <div className="auth-form">
          <div className="auth-mobile-logo">
            <Logo />
          </div>

          <span className="eyebrow">ACCOUNT VERIFICATION</span>

          {status === "loading" && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div
                className="loading-spinner"
                style={{ margin: "0 auto 16px" }}
              />
              <h2>Verifying your email...</h2>
              <p>Please wait while we confirm your credentials.</p>
            </div>
          )}

          {status === "success" && (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ color: "#10b981", marginBottom: 16 }}>
                <CheckCircle2 size={48} style={{ margin: "0 auto" }} />
              </div>
              <h2>Email verified!</h2>
              <p>
                {message ||
                  "Your email address has been successfully verified."}
              </p>
              <div style={{ marginTop: 24 }}>
                <Link href="/login" className="btn btn-primary full">
                  Go to login <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          )}

          {(status === "expired" ||
            status === "invalid" ||
            status === "idle") && (
            <div>
              <div style={{ color: "#ef4444", marginBottom: 12 }}>
                <AlertCircle size={40} />
              </div>
              <h2>
                {status === "expired"
                  ? "Verification link expired"
                  : status === "invalid"
                    ? "Invalid verification link"
                    : "Verify your email"}
              </h2>
              <p>
                {status === "idle"
                  ? "Enter your work email address below to receive a new verification link."
                  : message}
              </p>

              <form onSubmit={handleResend} style={{ marginTop: 20 }}>
                <label>
                  Work email
                  <input
                    required
                    type="email"
                    placeholder="you@company.com"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                  />
                </label>
                {resendMessage && (
                  <div
                    className={
                      resendMessage.includes("sent")
                        ? "form-success"
                        : "form-error"
                    }
                  >
                    {resendMessage}
                  </div>
                )}
                <button
                  type="submit"
                  className="btn btn-primary full"
                  disabled={resending}
                  style={{ marginTop: 12 }}
                >
                  {resending ? "Sending link..." : "Resend verification email"}
                </button>
              </form>

              <div className="auth-switch" style={{ marginTop: 24 }}>
                <Link href="/login" className="text-link">
                  <ArrowLeft size={15} /> Back to login
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { Auth, ForgotPassword, VerifyEmailPage };
