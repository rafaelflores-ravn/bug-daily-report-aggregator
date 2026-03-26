// Vercel Serverless Function — triggered by Vercel Cron
// No need for dotenv; Vercel injects env vars automatically.

const { runDailyReport } = require("../src/services/reportService");

module.exports = async function handler(req, res) {
  // Verify the request comes from Vercel Cron (not an external caller)
  const authHeader = req.headers["authorization"];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    console.log("[Cron] Vercel cron triggered at", new Date().toISOString());
    await runDailyReport();
    return res.status(200).json({ ok: true, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("[Cron] Report failed:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
