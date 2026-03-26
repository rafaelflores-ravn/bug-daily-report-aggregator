const Groq = require("groq-sdk");

const client = new Groq({
  apiKey: process.env.GROQ_API_KEY || "null",
});

/**
 * Sends today's messages to Groq and gets back grouped bug clusters.
 *
 * @param {Array} messages - Array of { ts, text } objects
 * @returns {Array} bugGroups - [ { title, summary, occurrenceTs: [] } ]
 */
async function clusterBugReports(messages) {
  if (messages.length === 0) {
    console.log("[Groq] No messages to cluster.");
    return [];
  }

  // Format messages for the prompt
  const formatted = messages
    .map((m, i) => `[${i + 1}] (ts: ${m.ts}) ${m.text}`)
    .join("\n");

  const prompt = `
You are a senior QA analyst. Below are bug report messages collected from a Slack channel today.
Your job is to:
1. Identify distinct underlying bug patterns across all messages.
2. Group messages that describe the same issue or are pretty similar (even if worded differently).
3. For each group, write a short technical title and a 1-2 sentence summary.

Return ONLY a valid JSON array. No explanation, no markdown, no backticks.
Format: 
[
  {
    "title": "Short bug title",
    "summary": "Brief description of the common issue found across occurrences.",
    "occurrenceTs": ["ts_value_1", "ts_value_2"]
  }
]

Messages:
${formatted}
`.trim();

  const response = await client.chat.completions.create({
    model: "openai/gpt-oss-120b",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.choices[0]?.message?.content || "[]";

  try {
    const parsed = JSON.parse(raw);
    console.log(`[Groq] Identified ${parsed.length} bug group(s).`);
    return parsed;
  } catch (err) {
    console.error("[Groq] Failed to parse response:", raw);
    throw new Error("Groq returned invalid JSON. Check the prompt or response.");
  }
}

module.exports = { clusterBugReports };
