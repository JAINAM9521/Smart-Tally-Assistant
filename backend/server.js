"use strict";

const app = require("./app");

const { connectDatabase } = require("./config/db");

const { port } = require("./config/env");

async function startServer() {
  try {
    await connectDatabase();

    app.listen(port, () => {
      console.log(`Smart Tally API listening on http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Failed to start Smart Tally API:");

    console.error(error?.message || error);

    process.exit(1);
  }
}

startServer();
