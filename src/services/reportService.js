const { fetchTodaysMessages, getPermalink, postReport } = require("./slackService");
const { clusterBugReports } = require("./aiService");

const SEVERITY_ICON = "⚪";

/**
 * Main pipeline: fetch → cluster → build blocks → post
 */
async function runDailyReport() {
  console.log("[Report] Starting daily bug report pipeline...");

  // 1. Fetch today's messages
  const messages = await fetchTodaysMessages();

  if (messages.length === 0) {
    console.log("[Report] No messages today. Skipping report.");
    return;
  }

  // 2. Cluster via Groq
  const simplified = messages.map((m) => ({ ts: m.ts, text: m.text }));
  const bugGroups = await clusterBugReports(simplified);

  if (bugGroups.length === 0) {
    console.log("[Report] Groq found no distinct bug groups. Skipping report.");
    return;
  }

  // 3. Resolve permalinks for each occurrence
  for (const group of bugGroups) {
    group.permalinks = [];
    for (const ts of group.occurrenceTs) {
      try {
        const link = await getPermalink(ts);
        group.permalinks.push(link);
      } catch {
        group.permalinks.push(null); // gracefully skip broken links
      }
    }
  }

  // 4. Build Block Kit payload
  const blocks = buildReportBlocks(bugGroups, messages.length);

  // 5. Post to Slack
  await postReport(blocks);
  console.log("[Report] Pipeline complete.");
}

/**
 * Builds a Slack Block Kit array from the clustered bug groups.
 */
function buildReportBlocks(bugGroups, totalMessages) {
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
          text: `*${totalMessages}* messages analyzed → *${bugGroups.length}* distinct issue(s) identified`,
        },
      ],
    },
    { type: "divider" },
  ];

  bugGroups.forEach((group, i) => {
    const occurrenceCount = group.occurrenceTs.length;

    // Build occurrence links
    const links = group.permalinks
      .map((link, j) => (link ? `<${link}|#${j + 1}>` : `#${j + 1}`))
      .join("  |  ");

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${SEVERITY_ICON} *${group.title}*\n${group.summary}\n_${occurrenceCount} occurrence(s):_  ${links}`,
      },
    });

    blocks.push({ type: "divider" });
  });

  // Footer
  blocks.push({
    type: "context",
    elements: [
      { type: "mrkdwn", text: "_Generated automatically by Bug Aggregator Bot_ 🤖" },
    ],
  });

  return blocks;
}

module.exports = { runDailyReport };
