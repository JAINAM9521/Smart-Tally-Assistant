"use strict";

require("dotenv").config();

if (
  process.env.NODE_ENV === "production" &&
  process.env.ALLOW_SEED !== "true"
) {
  console.error("Database seeding is disabled in production environments.");
  process.exit(1);
}

const dns = require("dns");
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (_) {}

const mongoose = require("mongoose");
const User = require("./models/User");
const { connectDatabase } = require("./config/db");
const { hashPassword } = require("./utils/password");

async function seedDemoAdmin() {
  try {
    console.log("Connecting to MongoDB Atlas...");
    await connectDatabase();
    console.log("MongoDB connected");

    const demoPassword = process.env.DEMO_ADMIN_PASSWORD || "Demo@123";
    const passwordHash = await hashPassword(demoPassword);

    await User.findOneAndUpdate(
      {
        email: "admin@smarttally.com",
      },
      {
        name: "Jainam Shah",
        email: "admin@smarttally.com",
        organization: "Saroj Metal",
        role: "admin",
        passwordHash,
        isEmailVerified: true,
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );

    console.log("Demo admin seeded successfully");
  } catch (error) {
    console.error("Database seed failed:");
    console.error(error);
    process.exitCode = 1;
  } finally {
    try {
      await mongoose.disconnect();
      console.log("MongoDB connection closed");
    } catch (disconnectError) {
      console.error("Error closing MongoDB connection:", disconnectError);
    }
  }
}

seedDemoAdmin();
