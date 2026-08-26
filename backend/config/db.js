"use strict";

const dns = require("dns");

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const mongoose = require("mongoose");

const { mongoUri } = require("./env");

async function connectDatabase() {
  if (!mongoUri) {
    throw new Error("MONGO_URI is required to start the Smart Tally API.");
  }

  try {
    await mongoose.connect(mongoUri);

    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection failed:");

    console.error(error?.message || error);

    throw error;
  }
}

module.exports = {
  connectDatabase,
};
