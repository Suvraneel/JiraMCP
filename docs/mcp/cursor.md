# Cursor MCP Setup

Cursor supports MCP over stdio. Depending on Cursor release, configure via MCP UI or `mcp.json`.

## Config Location

Use one of these approaches:

- Cursor UI: `Settings -> MCP` (or `Tools -> MCP`)
- Workspace file (common): `.cursor/mcp.json`
- Global file (common):
  - Windows: `%USERPROFILE%\\.cursor\\mcp.json`
  - macOS: `~/.cursor/mcp.json`
  - Linux: `~/.cursor/mcp.json`

If these paths are not available in your version, use the in-app MCP UI.

## Config Snippet

```jsonc
{
  "servers": {
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
}
```

