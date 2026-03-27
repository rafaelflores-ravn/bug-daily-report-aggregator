const { WebClient } = require("@slack/web-api");

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

/**
 * Fetches all messages from the bug channel for the current day.
 * Handles pagination automatically via cursor.
 */
async function fetchTodaysMessages() {
  const channelId = process.env.SLACK_CHANNEL_ID;

  // Build start/end timestamps for yesterday (midnight to now)
  //Yesterday for testing purposes
  const now = new Date()
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const oldest = String(startOfDay.getTime() / 1000);
  const latest = String(now.getTime() / 1000);

  let messages = [];
  let cursor;

  // Paginate through all results
  do {
    const res = await slack.conversations.history({
      channel: channelId,
      oldest,
      latest,
      limit: 200,
      ...(cursor && { cursor }),
    });

    const valid = (res.messages || []).filter(
      (m) =>
        m.type === "message" &&
        m.subtype === "bot_message"
    );

    messages = messages.concat(valid);
    cursor = res.response_metadata?.next_cursor;
  } while (cursor);

  console.log(`[Slack] Fetched ${messages.length} messages for today.`);
  return messages;
}

/**
 * Generates a permalink for a specific message timestamp.
 */
async function getPermalink(messageTs) {
  const res = await slack.chat.getPermalink({
    channel: process.env.SLACK_CHANNEL_ID,
    message_ts: messageTs,
  });
  return res.permalink;
}

/**
 * Posts a Block Kit message to the report channel.
 */
async function postReport(blocks) {
  await slack.chat.postMessage({
    channel: process.env.REPORT_CHANNEL_ID,
    text: "Daily Bug Report Summary", // fallback for notifications
    blocks,
  });
  console.log("[Slack] Report posted successfully.");
}

module.exports = { fetchTodaysMessages, getPermalink, postReport };
