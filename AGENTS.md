# AGENTS.md — AI Instructions for Jira MCP Tools

> **Purpose:** This file teaches AI agents (GitHub Copilot, ChatGPT, Claude, etc.) exactly how to use the Jira MCP tools exposed by this server. If you are an AI reading this, follow these instructions precisely.

---

## Server Overview

This is a **Model Context Protocol (MCP)** server that connects to **Jira Cloud REST API v3**. It exposes **6 tools** over stdio transport. All tools return structured JSON — never raw Jira API responses.

---

## Available Tools

### 1. `get_jira_issue`

**Purpose:** Fetch a single Jira issue by its key.

**When to use:**
- User asks about a specific Jira issue (e.g. "What's the status of DEV-5?")
- User mentions an issue key like `PROJ-123`, `DEV-5`, `MYAPP-42`
- User wants the description, assignee, or status of a known issue

**Input schema:**
```json
{
  "issueKey": "DEV-5"
}
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `issueKey` | `string` | ✅ | The Jira issue key. Must be uppercase project prefix + hyphen + number (e.g. `PROJ-123`). |

**Output format:**
```json
{
  "key": "DEV-5",
  "summary": "Copilot ↔ Jira MCP Integration",
  "status": "In Progress",
  "assignee": "Suvraneel Bhuin",
  "description": "Build an MCP server that exposes Jira issue data..."
}
```

**Important notes:**
- Issue keys are **case-sensitive** — always use UPPERCASE (e.g. `DEV-5`, not `dev-5`).
- `assignee` is `null` if the issue is unassigned.
- `description` is `null` if empty. Descriptions are returned as **plain text** (converted from Atlassian Document Format).
- Results are cached for 60 seconds.

---

### 2. `search_jira_issues`

**Purpose:** Search for Jira issues using a JQL (Jira Query Language) query.

**When to use:**
- User wants to find issues matching criteria (status, assignee, project, date range, labels, etc.)
- User asks something like "Show me my open bugs" or "Find issues created this week"
- User wants a list of issues, not a single specific one

**Input schema:**
```json
{
  "jql": "project = DEV AND status = 'In Progress' AND assignee = currentUser() ORDER BY created DESC"
}
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `jql` | `string` | ✅ | A valid JQL query string. |

**Output format:**
```json
[
  {
    "key": "DEV-5",
    "summary": "Copilot ↔ Jira MCP Integration",
    "status": "In Progress",
    "assignee": "Suvraneel Bhuin"
  }
]
```

**JQL cheat sheet — use these patterns:**

| User intent | JQL to generate |
|---|---|
| Issues assigned to me | `assignee = currentUser() ORDER BY updated DESC` |
| My in-progress issues | `assignee = currentUser() AND status = "In Progress" ORDER BY updated DESC` |
| Open bugs in a project | `project = PROJ AND type = Bug AND status != Done ORDER BY priority DESC` |
| Issues created in last N days | `createdDate >= -Nd ORDER BY created DESC` (e.g. `-7d` for 7 days) |
| Issues updated recently | `updatedDate >= -1d ORDER BY updated DESC` |
| Issues by specific assignee | `assignee = "Display Name" ORDER BY updated DESC` |
| High priority issues | `priority in (Highest, High) AND status != Done ORDER BY priority DESC` |
| Sprint-specific issues | `sprint in openSprints() AND project = PROJ ORDER BY rank ASC` |
| Text search | `text ~ "search term" ORDER BY updated DESC` |
| Combined filters | `project = PROJ AND status = "In Progress" AND createdDate >= -2d AND assignee = currentUser() ORDER BY created DESC` |

**Important notes:**
- Always use **valid JQL syntax**. String values with spaces must be quoted: `status = "In Progress"`, not `status = In Progress`.
- Use `currentUser()` when the user says "my issues" or "assigned to me" — never guess the user's name.
- Returns a **maximum of 50 results**.
- Results include `key`, `summary`, `status`, and `assignee` only (no description — use `get_jira_issue` for full details).
- Results are cached for 60 seconds.
- Always include an `ORDER BY` clause for predictable results.

---

### 3. `add_jira_comment`

**Purpose:** Add a text comment to an existing Jira issue.

**When to use:**
- User explicitly asks to add/post a comment on an issue
- User says something like "Comment on DEV-5 that the fix is deployed"
- User wants to log a note on a Jira ticket

**Input schema:**
```json
{
  "issueKey": "DEV-5",
  "comment": "The fix has been deployed to production."
}
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `issueKey` | `string` | ✅ | The Jira issue key (e.g. `PROJ-123`). |
| `comment` | `string` | ✅ | The comment body text. Plain text only. |

**Output format:**
```json
{
  "success": true,
  "commentId": "10036"
}
```

**Important notes:**
- This is a **write operation** — always confirm with the user before calling this tool unless they explicitly asked to add a comment.
- The comment is posted as the authenticated user (the account whose API token is configured).
- Comments are stored in Atlassian Document Format (ADF) internally, but you provide **plain text** — the server converts it.
- After adding a comment, the cached data for that issue is automatically invalidated.
- Issue key must be UPPERCASE.

---

### 4. `create_jira_issue`

**Purpose:** Create a new Jira issue — Story, Task, Bug, Epic, or Sub-task.

**When to use:**
- User asks to create a new issue, story, task, or bug (e.g. "Create a task in DEV for refactoring the auth module")
- User wants to log a new ticket in Jira
- User asks to add a sub-task under an existing issue

**Input schema:**
```json
{
  "projectKey": "DEV",
  "issueType": "Task",
  "summary": "Refactor authentication module",
  "description": "Break the auth module into smaller services for testability.",
  "priority": "High",
  "labels": ["refactor", "backend"],
  "parentKey": "DEV-5"
}
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `projectKey` | `string` | ✅ | The Jira project key (e.g. `DEV`, `PROJ`). |
| `issueType` | `string` | ✅ | Issue type: `"Story"`, `"Task"`, `"Bug"`, `"Epic"`, or `"Sub-task"`. |
| `summary` | `string` | ✅ | A brief title for the issue. |
| `description` | `string` | ❌ | Optional detailed description (plain text — converted to ADF). |
| `assignee` | `string` | ❌ | Optional Atlassian account ID of the assignee. |
| `priority` | `string` | ❌ | Optional priority: `"Highest"`, `"High"`, `"Medium"`, `"Low"`, `"Lowest"`. |
| `labels` | `string[]` | ❌ | Optional array of labels to attach. |
| `parentKey` | `string` | ❌ | Optional parent issue key for sub-tasks or child issues (e.g. `DEV-5`). |

**Output format:**
```json
{
  "key": "DEV-7",
  "id": "10042",
  "self": "https://your-domain.atlassian.net/rest/api/3/issue/10042",
  "summary": "Refactor authentication module"
}
```

**Important notes:**
- This is a **write operation** — always confirm with the user before calling this tool unless they explicitly asked to create an issue.
- `projectKey` must be UPPERCASE and correspond to an existing Jira project.
- `issueType` must match one of the types configured in the target project (exact spelling matters).
- `assignee` requires a valid Atlassian **account ID** (not display name). If unknown, omit it and let the issue be unassigned.
- After creation, all cached search results are automatically cleared.
- The returned `key` is the newly created issue's key — use it for follow-up actions (e.g. adding comments).

---

### 5. `search_jira_users`

**Purpose:** Search for Jira users by display name or email to find their Atlassian account IDs.

**When to use:**
- Before assigning an issue — you need the account ID, not the display name
- User says "assign to me" or "assign to John" — look up the account ID first
- User asks "who is on this project?" or "find user X"

**Input schema:**
```json
{
  "query": "Suvraneel"
}
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `query` | `string` | ✅ | Search string — matches display name, email, or account ID. |

**Output format:**
```json
[
  {
    "accountId": "60d5f4a2e3b1c20069a1b2c3",
    "displayName": "Suvraneel Bhuin",
    "emailAddress": "suvraneel@example.com",
    "active": true
  }
]
```

**Important notes:**
- Returns up to 10 matching users.
- The `accountId` value is what you pass to `assign_jira_issue` or `create_jira_issue` (assignee field).
- Results are cached for 60 seconds.

---

### 6. `assign_jira_issue`

**Purpose:** Assign a Jira issue to a specific user.

**When to use:**
- User asks to assign an issue to someone (e.g. "assign DEV-8 to me", "assign all tasks to Suvraneel")
- After creating issues that need an assignee
- Bulk assignment workflows

**Workflow:** Always call `search_jira_users` first to get the `accountId`, then call `assign_jira_issue`.

**Input schema:**
```json
{
  "issueKey": "DEV-8",
  "accountId": "60d5f4a2e3b1c20069a1b2c3"
}
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `issueKey` | `string` | ✅ | The Jira issue key to assign (e.g. `DEV-8`). |
| `accountId` | `string` | ✅ | The Atlassian account ID of the assignee. Use `search_jira_users` to find this. |

**Output format:**
```json
{
  "success": true,
  "issueKey": "DEV-8",
  "assignee": {
    "accountId": "60d5f4a2e3b1c20069a1b2c3",
    "displayName": "Suvraneel Bhuin"
  }
}
```

**Important notes:**
- This is a **write operation** — confirm with the user before bulk-assigning.
- `accountId` must be a valid Atlassian account ID (not display name). Always use `search_jira_users` first.
- After assignment, cached issue and search results are automatically invalidated.
- To **unassign** an issue, a separate unassign flow would be needed (not yet supported — the tool requires a non-empty accountId).

---

## Error Handling

All tools return errors in this format when something goes wrong:

```json
{
  "isError": true,
  "content": [{ "type": "text", "text": "Error: Jira API error (HTTP 404): ..." }]
}
```

**Common errors and what to do:**

| Error | Meaning | Action |
|---|---|---|
| `HTTP 401` | Authentication failed | Tell the user to check their `JIRA_EMAIL` and `JIRA_API_TOKEN` |
| `HTTP 403` | No permission | The user's account doesn't have access to that project/issue |
| `HTTP 404` | Issue not found | Verify the issue key is correct and exists |
| `HTTP 429` | Rate limited | The server retries automatically; if persistent, wait a moment |
| `Validation error` | Bad input | Check that `issueKey` or `jql` is non-empty and correctly formatted |

---

## Decision Guide for AI Agents

Use this flowchart to decide which tool to call:

```
User request
│
├─ Mentions a specific issue key (e.g. "DEV-5", "PROJ-123")?
│   ├─ Wants to add a comment? → use `add_jira_comment`
│   ├─ Wants to assign it? → use `search_jira_users` then `assign_jira_issue`
│   └─ Wants details/status/info? → use `get_jira_issue`
│
├─ Wants to create a new issue/story/task/bug?
│   └─ Gather project key, type, summary → use `create_jira_issue`
│
├─ Wants to assign issues to someone?
│   └─ Look up user → `search_jira_users` → then `assign_jira_issue` per issue
│
├─ Wants to find a user / look up account ID?
│   └─ Use `search_jira_users`
│
├─ Wants to find/search/list issues?
│   └─ Construct JQL query → use `search_jira_issues`
│
├─ Asks about "my issues" or "assigned to me"?
│   └─ Use `search_jira_issues` with `assignee = currentUser()`
│
└─ Vague request about Jira?
    └─ Ask the user to clarify the project or issue key
```

---

## Best Practices

1. **Prefer `get_jira_issue` for single issues** — it returns more data (including description) than search results.
2. **Construct precise JQL** — the more specific the query, the better the results. Always include `ORDER BY`.
3. **Don't guess issue keys** — if the user doesn't provide one, ask or use `search_jira_issues` to find it.
4. **Confirm before writing** — always confirm with the user before calling `add_jira_comment`.
5. **Chain tools when needed** — e.g. search first to find the issue key, then get full details, then add a comment.
6. **Present results cleanly** — format the JSON output as readable text/tables for the user. Don't dump raw JSON.
7. **Handle empty results gracefully** — if search returns `[]`, tell the user no issues matched and suggest adjusting the query.

