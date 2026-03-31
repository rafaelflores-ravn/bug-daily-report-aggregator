/**
 * postReport.js
 *
 * Receives a JSON file with clustered bug groups (output from Claude Code)
 * and posts the formatted report to Slack.
 *
 * Usage:
 *   node src/scripts/postReport.js output/claude_response.json
 *
 * The JSON file should contain the array returned by Claude, e.g.:
 * [
 *   {
 *     "title": "Checkout button unresponsive",
 *     "summary": "Multiple reports of CTA failing on iOS Safari.",
 *     "occurrenceTs": ["1234567890.123", "1234567891.456"]
 *   }
 * ]
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { getPermalink, postReport } = require("../services/slackService");

async function postFromFile(jsonFilePath) {
  if (!jsonFilePath) {
    console.error("[PostReport] Usage: node src/scripts/postReport.js <path-to-json>");
    process.exit(1);
  }

  const resolved = path.resolve(jsonFilePath);

  if (!fs.existsSync(resolved)) {
    console.error(`[PostReport] File not found: ${resolved}`);
    process.exit(1);
  }

  let bugGroups;
  try {
    const raw = fs.readFileSync(resolved, "utf8");
    bugGroups = JSON.parse(raw);
  } catch (err) {
    console.error("[PostReport] Failed to parse JSON file:", err.message);
    process.exit(1);
  }

  if (!Array.isArray(bugGroups) || bugGroups.length === 0) {
    console.error("[PostReport] JSON must be a non-empty array of bug groups.");
    process.exit(1);
  }

  console.log(`[PostReport] Processing ${bugGroups.length} bug group(s)...`);

  // Resolve Slack permalinks for each occurrence
  for (const group of bugGroups) {
    group.permalinks = [];
    for (const ts of group.occurrenceTs || []) {
      try {
        const link = await getPermalink(ts);
        group.permalinks.push(link);
      } catch {
        console.warn(`[PostReport] Could not get permalink for ts: ${ts}`);
        group.permalinks.push(null);
      }
    }
  }

  // Build and post the report
  const blocks = buildReportBlocks(bugGroups);
  await postReport(blocks);
  console.log("[PostReport] Report posted to Slack successfully.");
}

function buildReportBlocks(bugGroups) {
  const SEVERITY_ICONS = ["🔴", "🟠", "🟡", "🔵", "⚪"];
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: `📋 Daily Bug Report — ${today}`, emoji: true },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `*${bugGroups.length}* distinct issue(s) identified · _Clustered via Claude Code_`,
        },
      ],
    },
    { type: "divider" },
  ];

  bugGroups.forEach((group, i) => {
    const icon = SEVERITY_ICONS[i % SEVERITY_ICONS.length];
    const links = (group.permalinks || [])
      .map((link, j) => (link ? `<${link}|#${j + 1}>` : `#${j + 1}`))
      .join("  |  ");

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${icon} *${group.title}*\n${group.summary}\n_${group.occurrenceTs?.length || 0} occurrence(s):_  ${links}`,
      },
    });
    blocks.push({ type: "divider" });
  });

  blocks.push({
    type: "context",
    elements: [
      { type: "mrkdwn", text: "_Generated via Claude Code (manual mode)_ 🤖" },
    ],
  });

  return blocks;
}

// Entry point
const jsonArg = process.argv[2];
postFromFile(jsonArg).catch(console.error);