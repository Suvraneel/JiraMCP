# Kiro MCP Setup

Kiro supports MCP stdio servers. Configure through the MCP UI or JSON config, depending on your release channel.

## Config Location

Use one of these approaches:

- Kiro MCP UI (recommended when available)
- Kiro MCP JSON config file (location can vary by release)

Common global config locations by OS (if your build exposes file-based config):

- Windows: `%APPDATA%\\Kiro\\mcp.json`
- macOS: `~/Library/Application Support/Kiro/mcp.json`
- Linux: `~/.config/Kiro/mcp.json`

If your install does not use these paths, configure the server in Kiro's MCP settings UI.

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

