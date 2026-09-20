"use strict";

const nodemailer = require("nodemailer");

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.EMAIL_HOST;
  const port = Number(process.env.EMAIL_PORT || 587);
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASSWORD;

  if (!host || !user || !pass) return null;

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: String(process.env.EMAIL_SECURE || "false") === "true",
    auth: { user, pass },
  });

  return transporter;
}

function appUrl() {
  return String(process.env.CLIENT_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

exports.sendVerificationEmail = async ({ email, token }) => {
  const mailer = getTransporter();
  const url = `${appUrl()}/verify-email/${encodeURIComponent(token)}`;

  if (!mailer) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Email service is not configured. Set EMAIL_HOST, EMAIL_USER and EMAIL_PASSWORD.",
      );
    }
    return { development: true, token, url };
  }

  await mailer.sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: email,
    subject: "Verify your Smart Tally Assistant account",
    html: `<p>Welcome to Smart Tally Assistant.</p><p><a href="${url}">Verify your email</a></p><p>This link expires in 24 hours.</p>`,
  });

  return { sent: true };
};

exports.sendPasswordResetOtp = async ({ email, otp }) => {
  const mailer = getTransporter();

  if (!mailer) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Email service is not configured. Set EMAIL_HOST, EMAIL_USER and EMAIL_PASSWORD.",
      );
    }
    return { development: true, otp };
  }

  await mailer.sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: email,
    subject: "Smart Tally Assistant password reset OTP",
    text: `Your password reset OTP is ${otp}. It expires in 10 minutes.`,
  });

  return { sent: true };
};
