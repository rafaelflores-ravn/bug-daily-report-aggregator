# Bug Aggregator Bot

A Node.js service that automatically reads bug reports from a Slack channel, clusters them into distinct issues using an LLM, and posts a formatted daily summary back to Slack.

## Architecture Overview

```
                        +-----------+
  Vercel Cron --------->| api/cron  |----+
  (weekdays 11 PM UTC)  +-----------+    |
                                         v
  node-cron (local) --->  runDailyReport()
                            |
          +-----------------+------------------+
          |                 |                  |
          v                 v                  v
   slackService       aiService         reportService
   (fetch msgs)     (cluster bugs)    (build blocks & post)
```

### Pipeline Steps

The core logic lives in `reportService.runDailyReport()` and executes a five-step pipeline:

1. **Fetch** -- `slackService.fetchTodaysMessages()` pulls all bot messages from the configured bug channel for the current day. It paginates automatically using Slack's cursor-based API.

2. **Cluster** -- `aiService.clusterBugReports()` sends the raw messages to an LLM (via Groq) with a prompt that instructs it to identify distinct bug patterns, group duplicates, and return a JSON array of `{ title, summary, occurrenceTs[] }`.

3. **Resolve permalinks** -- For each occurrence timestamp returned by the LLM, `slackService.getPermalink()` is called to get a clickable Slack link. Failures are handled gracefully (the link is replaced with `null`).

4. **Build Slack blocks** -- `reportService.buildReportBlocks()` assembles a Block Kit payload with a header, stats context line, one section per bug group (title, summary, numbered occurrence links), and a footer.

5. **Post** -- `slackService.postReport()` sends the Block Kit message to the configured report channel.

### Service Responsibilities

| File | Role |
|---|---|
| `src/index.js` | Entry point. Validates required env vars and starts the scheduler. |
| `src/scheduler.js` | Configures `node-cron` to trigger `runDailyReport()` on a cron schedule (default: weekdays at 5 PM, Honduras timezone). |
| `src/services/reportService.js` | Orchestrates the full pipeline and builds the Slack Block Kit payload. |
| `src/services/slackService.js` | All Slack API interactions -- fetching messages, getting permalinks, posting reports. |
| `src/services/aiService.js` | Sends messages to Groq for LLM-based bug clustering and parses the JSON response. |
| `api/cron.js` | Vercel serverless function endpoint triggered by Vercel Cron. Authenticates via `CRON_SECRET` bearer token. |

### Deployment Modes

The bot supports two ways to trigger the daily report:

- **Local / long-running process** -- `npm start` boots the scheduler which uses `node-cron` to fire at the configured time.
- **Vercel Cron** -- When deployed to Vercel, `vercel.json` defines a cron job that hits `/api/cron` (weekdays at 11 PM UTC). The endpoint validates a bearer token before running the pipeline.

## Setup

### Prerequisites

- Node.js >= 18
- A Slack app with `channels:history`, `channels:read`, and `chat:write` scopes
- A Groq API key

### Installation

```bash
cd bug-aggregator
npm install
cp .env.example .env   # fill in your values
```

### Environment Variables

| Variable | Description |
|---|---|
| `SLACK_BOT_TOKEN` | Slack bot OAuth token (`xoxb-...`) |
| `SLACK_CHANNEL_ID` | Channel ID to read bug reports from |
| `GROQ_API_KEY` | API key for Groq |
| `REPORT_CHANNEL_ID` | Channel ID where the summary is posted |
| `REPORT_CRON_SCHEDULE` | Cron expression (default: `0 17 * * 1-5`) |
| `TIMEZONE` | IANA timezone for the scheduler (default: `America/Tegucigalpa`) |
| `CRON_SECRET` | Bearer token for authenticating Vercel Cron requests |

### Running

```bash
# Start with scheduler
npm start

# Start with hot-reload (development)
npm run dev

# Trigger a report immediately (useful for testing)
npm run trigger
```

## Making Improvements

### Adding a new data source

Create a new service in `src/services/` that exports a fetch function returning an array of `{ ts, text }` objects. Call it from `runDailyReport()` alongside or instead of `fetchTodaysMessages()`.

### Changing the LLM provider

Edit `src/services/aiService.js`. The prompt and expected JSON response shape are defined inline in `clusterBugReports()`. Swap the Groq client for any OpenAI-compatible SDK.

### Customizing the report format

Modify `buildReportBlocks()` in `src/services/reportService.js`. It returns a standard Slack Block Kit array -- refer to [Slack's Block Kit Builder](https://app.slack.com/block-kit-builder) to prototype changes.

### Adding severity levels

The `SEVERITY_ICON` constant in `reportService.js` is currently static. To support dynamic severity, extend the LLM prompt in `aiService.js` to return a `severity` field per group, then map it to different icons in `buildReportBlocks()`.
