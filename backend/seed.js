"use strict";

require("dotenv").config();

const dns = require("dns");

// Use public DNS resolvers for MongoDB Atlas SRV records.
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const mongoose = require("mongoose");

const User = require("./models/User");
const { connectDatabase } = require("./config/db");
const { hashPassword } = require("./utils/password");

async function seedDemoAdmin() {
  try {
    console.log("Connecting to MongoDB Atlas...");

    await connectDatabase();

    console.log("MongoDB connected");

    const passwordHash = await hashPassword("Demo@123");

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
