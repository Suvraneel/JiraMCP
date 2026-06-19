# Jira MCP Server

A production-ready **Model Context Protocol (MCP)** server that integrates with **Jira Cloud** and exposes tools usable by **GitHub Copilot Chat**, **Claude**, **Cursor**, **Kiro**, **JetBrains AI Assistant**, and other MCP-compatible clients.

---

## Features

| Tool | Description |
|---|---|
| `get_jira_issue` | Fetch a single issue by key (e.g. `PROJ-123`) |
| `search_jira_issues` | Search issues using JQL |
| `add_jira_comment` | Add a new comment, or edit an existing one via optional `commentId` |
| `get_jira_comments` | Get all comments for an issue |
| `create_jira_issue` | Create a new issue (Story, Task, Bug, Epic, Sub-task) |
| `search_jira_users` | Search users by name/email to get account IDs |
| `assign_jira_issue` | Assign an issue to a user by account ID |
| `get_jira_transitions` | List available workflow transitions for an issue |
| `transition_jira_issue` | Move an issue to a target workflow status |
| `update_jira_issue` | Update issue summary and/or description |
| `get_jira_issue_changelog` | Fetch full issue field-change history |
| `get_jira_link_types` | List available Jira issue link types |
| `link_jira_issues` | Create links between two issues (e.g. Relates, Blocks) |
| `get_jira_boards` | List Jira boards (Scrum/Kanban), optional project filter |
| `get_jira_sprint_issues` | List issues in a sprint by sprint ID |

**Built-in reliability:**

- ✅ In-memory cache with 60 s TTL (GET & search requests)
- ✅ Automatic retry with exponential back-off (up to 3 attempts)
- ✅ Rate-limit handling — respects `Retry-After` header on HTTP 429
- ✅ Input validation via Zod schemas
- ✅ Structured JSON responses (no raw Jira payloads)
- ✅ Graceful error handling with meaningful messages

---

## Prerequisites

| Requirement | Minimum Version |
|---|---|
| **Node.js** | ≥ 18 LTS |
| **npm** | ≥ 9 |
| **Git** | any recent version |
| **Jira Cloud** instance | REST API v3 (`/rest/api/3`) |

> ⚠️ **Jira Server / Data Center** may work but is not officially tested. This server targets Jira Cloud REST API v3.

---

## 1 — Generate a Jira API Token

1. Log in to your Atlassian account
2. Go to → <https://id.atlassian.com/manage-profile/security/api-tokens>
3. Click **Create API token**
4. Give it a label (e.g. _"MCP Server"_) and click **Create**
5. **Copy the token immediately** — you won't be able to see it again

> 💡 The token is tied to your Atlassian email. You will need both the **email** and the **token** for authentication.

---

## 2 — Clone & Install

```bash
# Clone the repository
git clone https://github.com/<your-org>/JiraMCP.git
cd JiraMCP

# Install dependencies
npm install
```

### Dependencies installed

| Package | Purpose |
|---|---|
| `@modelcontextprotocol/sdk` | MCP server framework |
| `axios` | HTTP client for Jira REST API |
| `dotenv` | Loads `.env` config |
| `zod` | Input schema validation |
| `typescript` | Build toolchain (dev) |

---

## 3 — Configure Environment Variables

```bash
# Copy the example file
cp .env.example .env        # macOS / Linux
copy .env.example .env      # Windows (cmd)
```

Edit `.env` with your values:

```dotenv
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-api-token-here
```

| Variable | Description | Example |
|---|---|---|
| `JIRA_BASE_URL` | Your Jira Cloud instance URL (no trailing slash) | `https://mycompany.atlassian.net` |
| `JIRA_EMAIL` | The email address linked to your Atlassian account | `dev@mycompany.com` |
| `JIRA_API_TOKEN` | API token generated in Step 1 | `ATATT3xFfGF0...` |

> ⚠️ **Never commit `.env` to version control.** It is already listed in `.gitignore`.

---

## 4 — Build & Run

```bash
# Compile TypeScript → dist/
npm run build

# Start the MCP server (stdio transport)
npm start
```

For development with auto-compilation:

```bash
npm run dev
```

### How it works

The server uses **stdio transport** — it reads JSON-RPC messages from `stdin` and writes responses to `stdout`. All diagnostic/log messages go to `stderr` so they never interfere with the MCP protocol.

You **don't** interact with it directly in a terminal. Instead, you configure your IDE to launch it as a subprocess (see below).

---

## 5 — Client Configuration

Detailed `mcp.json` instructions are split into per-client guides (each includes Windows/macOS/Linux paths where applicable):

- GitHub Copilot (VS Code + JetBrains): `docs/mcp/github-copilot.md`
- Claude Desktop: `docs/mcp/claude.md`
- Claude Code (CLI): `docs/mcp/claude-code.md`
- Cursor (Desktop/UI): `docs/mcp/cursor.md`
- Cursor CLI: `docs/mcp/cursor-cli.md`
- Kiro (Desktop/UI): `docs/mcp/kiro.md`
- Kiro CLI: `docs/mcp/kiro-cli.md`
- Other MCP-capable clients (compatibility notes): `docs/mcp/other-clients.md`

Quick reminder for all clients:

- Use `node` as the command.
- Point args to an absolute path for `dist/server.js`.
- Provide `JIRA_BASE_URL`, `JIRA_EMAIL`, and `JIRA_API_TOKEN` in environment variables.
- Restart the client after changing MCP config.

---

## 6 — Verify It Works

Once configured, open Copilot Chat in your IDE and try:

| Prompt | Tool invoked |
|---|---|
| _"Get the details of DEV-5"_ | `get_jira_issue` |
| _"Search for open bugs in project MYAPP"_ | `search_jira_issues` |
| _"Find my in-progress issues from the last 2 days"_ | `search_jira_issues` |
| _"Add a comment to DEV-5 saying the fix was deployed"_ | `add_jira_comment` |
| _"Edit comment 10036 on DEV-5 to say rollback completed"_ | `add_jira_comment` |
| _"Show comments on DEV-5"_ | `get_jira_comments` |
| _"List transitions for DEV-5"_ | `get_jira_transitions` |
| _"Move DEV-5 to In Progress"_ | `transition_jira_issue` |
| _"Update DEV-5 summary to 'Refactor auth module'"_ | `update_jira_issue` |
| _"Show changelog for DEV-5"_ | `get_jira_issue_changelog` |
| _"List issue link types"_ | `get_jira_link_types` |
| _"Link DEV-5 and DEV-8 as Relates"_ | `link_jira_issues` |
| _"List boards in project DEV"_ | `get_jira_boards` |
| _"Get sprint issues for sprint 123"_ | `get_jira_sprint_issues` |

### Optional: run the live end-to-end tool test script

```bash
npm run build
node test-all-tools.mjs
```

This script exercises all 15 tools against your configured Jira instance and prints a pass/fail summary.

---

## Project Structure

```
JiraMCP/
├── docs/
│   └── mcp/
│       ├── github-copilot.md  # VS Code + JetBrains MCP config
│       ├── claude.md          # Claude Desktop MCP config
│       ├── claude-code.md     # Claude Code (CLI) MCP config
│       ├── cursor.md          # Cursor desktop MCP config
│       ├── cursor-cli.md      # Cursor CLI MCP config
│       ├── kiro.md            # Kiro desktop MCP config
│       ├── kiro-cli.md        # Kiro CLI MCP config
│       └── other-clients.md   # Compatibility notes for additional MCP clients
├── src/
│   ├── server.ts              # MCP server setup & tool registration
│   ├── jiraClient.ts          # Jira REST API v3 wrapper (cache, retry, rate-limit)
│   └── tools/
│       ├── getIssue.ts        # get_jira_issue tool
│       ├── searchIssues.ts    # search_jira_issues tool
│       ├── addComment.ts      # add_jira_comment (add/edit)
│       ├── getComments.ts     # get_jira_comments
│       ├── createIssue.ts     # create_jira_issue
│       ├── assignIssue.ts     # assign_jira_issue
│       ├── searchUsers.ts     # search_jira_users
│       ├── getTransitions.ts  # get_jira_transitions
│       ├── transitionIssue.ts # transition_jira_issue
│       ├── updateIssue.ts     # update_jira_issue
│       ├── getIssueChangelog.ts # get_jira_issue_changelog
│       ├── getLinkTypes.ts    # get_jira_link_types
│       ├── linkIssues.ts      # link_jira_issues
│       ├── getBoards.ts       # get_jira_boards
│       └── getSprintIssues.ts # get_jira_sprint_issues
├── dist/                      # Compiled JS output (generated by `npm run build`)
├── test-all-tools.mjs         # Live Jira integration test for all tools
├── package.json
├── tsconfig.json
├── .env.example               # Template for environment variables
├── .gitignore
├── AGENTS.md                  # AI agent instructions for tool usage
└── README.md                  # This file
```

---

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| `Missing required environment variables` | `.env` not found or incomplete | Ensure `.env` exists with all 3 vars, or pass them via `env` in MCP config |
| `Jira API error (HTTP 401)` | Bad credentials | Double-check `JIRA_EMAIL` and `JIRA_API_TOKEN` |
| `Jira API error (HTTP 403)` | Insufficient permissions | Ensure the API token's account has access to the target Jira project |
| `Jira API error (HTTP 404)` | Issue not found | Verify the issue key exists (e.g. `DEV-5`, not `dev-5`) |
| `Jira API error (HTTP 410)` | Deprecated API endpoint | Ensure you're on the latest version of this server (uses `/rest/api/3/search/jql`) |
| `Jira API error (HTTP 429)` | Rate limited | Server auto-retries; if persistent, reduce request frequency |
| `ECONNREFUSED` / `ETIMEDOUT` | Network issue | Verify `JIRA_BASE_URL` is reachable (`curl https://your-domain.atlassian.net`) |
| Tools not visible in Copilot Chat | MCP config not loaded | Restart the IDE; verify `mcp.json` syntax is valid JSON |
| `node` not found | Node.js not in PATH | Install Node.js or use the full path to `node` in MCP config |

### Platform-specific notes

| OS | Node.js install | Path separator |
|---|---|---|
| **Windows** | [nodejs.org](https://nodejs.org) or `winget install OpenJS.NodeJS.LTS` | Use `/` or `\\\\` in JSON paths |
| **macOS** | `brew install node@22` | Use `/` |
| **Linux** | `sudo apt install nodejs npm` or use [nvm](https://github.com/nvm-sh/nvm) | Use `/` |

---

## Technical Notes

- **Jira API version**: REST API v3 — uses the new `GET /rest/api/3/search/jql` endpoint (the old `POST /search` was [deprecated and removed](https://developer.atlassian.com/changelog/#CHANGE-2046))
- **Authentication**: HTTP Basic Auth with `email:api_token` base64-encoded
- **Comments**: Posted in Atlassian Document Format (ADF); descriptions are flattened from ADF to plain text for readability
- **Cache**: In-memory `Map`-based cache with 60s TTL; write operations (e.g. adding a comment) invalidate related cache entries
- **Transport**: stdio only (required by VS Code Copilot and JetBrains MCP integration)

---

## License

MIT

