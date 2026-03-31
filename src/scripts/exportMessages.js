/**
 * exportMessages.js
 *
 * Fetches today's bug report messages from Slack and writes them
 * to a local file ready to be fed into Claude Code manually.
 *
 * Usage: node src/scripts/exportMessages.js
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { fetchTodaysMessages } = require("../services/slackService");

async function exportMessages() {
  console.log("[Export] Fetching today's messages from Slack...");
  const messages = await fetchTodaysMessages();

  if (messages.length === 0) {
    console.log("[Export] No messages found for today.");
    return;
  }

  // Build the prompt file content — ready to paste into Claude Code
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const promptContent = `
# Bug Report Clustering Task — ${today}

You are a senior QA analyst. Below are bug report messages collected from a Slack channel today.

Your job:
1. Identify distinct underlying bug patterns across all messages.
2. Group messages that describe the same issue (even if worded differently).
3. For each group, write a short technical title and a 1-2 sentence summary.

Return ONLY a valid JSON array with this exact format (no explanation, no markdown, no backticks):
[
  {
    "title": "Short bug title",
    "summary": "Brief description of the common issue found across occurrences.",
    "occurrenceTs": ["ts_value_1", "ts_value_2"]
  }
]

## Messages (${messages.length} total):

${messages.map((m, i) => `[${i + 1}] (ts: ${m.ts}) ${m.text}`).join("\n")}
`.trim();

  // Write to file
  const outputDir = path.join(__dirname, "../../output");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  const outputPath = path.join(outputDir, "messages_for_claude.txt");
  fs.writeFileSync(outputPath, promptContent, "utf8");

  console.log(`[Export] Done! File written to: ${outputPath}`);
  console.log(`[Export] ${messages.length} messages exported.`);
  console.log("\n--- Next Steps ---");
  console.log("1. Open Claude Code in your terminal: claude");
  console.log(`2. Run: cat output/messages_for_claude.txt | claude`);
  console.log("3. Copy the JSON output and run: npm run post-report <json>");
}

exportMessages().catch(console.error);