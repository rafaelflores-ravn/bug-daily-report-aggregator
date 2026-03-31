require("dotenv").config();
const { startScheduler } = require("./scheduler");
const { runDailyReport } = require("./services/reportService");

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

const args = process.argv.slice(2);

if (args.includes("--run-now")) {
  console.log("[Manual] Running daily report now...");
  runDailyReport()
    .then(() => {
      console.log("[Manual] Report completed.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[Manual] Report failed:", err.message);
      process.exit(1);
    });
} else {
  console.log("[Startup] Bug Aggregator Bot is running.");
  startScheduler();
}
