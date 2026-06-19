# Claude MCP Setup (Desktop)

This page is for Claude Desktop.

For Claude Code (CLI), use `docs/mcp/claude-code.md`.

Claude Desktop uses `claude_desktop_config.json` with an `mcpServers` section.

## Config File Path

Common locations by OS:

- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

If your install uses a different path, open Claude settings and use the MCP/config location shown there.

## Config Snippet

```jsonc
{
  "mcpServers": {
    "jira": {
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

After saving, restart Claude Desktop.

