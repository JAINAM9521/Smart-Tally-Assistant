"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
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

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const submit = async (event) => {
    event.preventDefault();

    setLoading(true);
    setError("");
    setSuccess("");

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

        setSuccess("Account created successfully. Please sign in.");

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

            {error && <div className="form-error">{error}</div>}

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

        setForm((current) => ({
          ...current,
          resetId: result?.resetId || "",
        }));

        /*
            Development environments may return an OTP
            through the backend response. We do not
            hardcode or persist a fake OTP on the frontend.
          */
        if (result?.developmentOtp) {
          setSuccess(`Development verification code: ${result.developmentOtp}`);
        } else {
          setSuccess(
            "Password reset instructions were sent if this account exists.",
          );
        }

        setStage(2);

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

export { Auth, ForgotPassword };
