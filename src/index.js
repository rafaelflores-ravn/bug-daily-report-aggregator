require("dotenv").config();
const { startScheduler } = require("./scheduler");

// Validate required env vars on startup
const required = [
  "SLACK_BOT_TOKEN",
  "SLACK_CHANNEL_ID",
  "GROQ_API_KEY",
  "REPORT_CHANNEL_ID",
];

const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`[Startup] Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("[Startup] Bug Aggregator Bot is running.");
startScheduler();
