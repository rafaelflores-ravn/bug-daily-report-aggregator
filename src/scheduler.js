const cron = require("node-cron");
const { runDailyReport } = require("./services/reportService");

/**
 * Schedules the daily report using the cron expression from .env
 * Default: Every weekday at 5:00 PM (Honduras timezone)
 *
 * Cron format: "minute hour day month weekday"
 * Examples:
 *   "0 17 * * 1-5"  -> Mon-Fri at 5:00 PM
 *   "0 18 * * *"    -> Every day at 6:00 PM
 *   "30 16 * * 5"   -> Every Friday at 4:30 PM
 */
function startScheduler() {
  const schedule = process.env.REPORT_CRON_SCHEDULE || "0 17 * * 1-5";
  const timezone = process.env.TIMEZONE || "America/Tegucigalpa";

  console.log(`[Scheduler] Report scheduled: "${schedule}" (${timezone})`);

  cron.schedule(
    schedule,
    async () => {
      console.log(`[Scheduler] Triggered at ${new Date().toISOString()}`);
      try {
        await runDailyReport();
      } catch (err) {
        console.error("[Scheduler] Report failed:", err.message);
      }
    },
    { timezone }
  );
}

module.exports = { startScheduler };
