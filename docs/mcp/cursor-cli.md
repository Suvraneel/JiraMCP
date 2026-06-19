# Cursor CLI MCP Setup

This guide covers CLI-style Cursor usage where MCP servers are configured from file or command line.

## 1) Verify CLI Availability

```bash
cursor --help
```

If `cursor` is not available, use Cursor desktop MCP setup from `docs/mcp/cursor.md`.

## 2) MCP Server Definition

```jsonc
{
  "jira": {
    "type": "stdio",
    "command": "node",
    "args": ["/absolute/path/to/JiraMCP/dist/server.js"],
    "env": {
      "JIRA_BASE_URL": "https://your-domain.atlassian.net",
      "JIRA_EMAIL": "your-email@example.com",
      "JIRA_API_TOKEN": "your-api-token-here"
    }
  }
}
```

## 3) File-Based Config (Common OS Locations)

Common locations for CLI/global config files:

- Windows: `%USERPROFILE%\\.cursor\\mcp.json`
- macOS: `~/.cursor/mcp.json`
- Linux: `~/.cursor/mcp.json`

If your installed release does not use these paths, use the in-app MCP UI or the CLI's config command flow.

## 4) Quick Sanity Check

Run a Jira request from Cursor after reload:

- `List transitions for DEV-5`
- `Show comments on DEV-5`

