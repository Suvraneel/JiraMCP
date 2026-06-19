# Kiro CLI MCP Setup

This guide covers CLI-driven Kiro setups where MCP is configured through files or commands.

## 1) Verify CLI Availability

```bash
kiro --help
```

If `kiro` is not available, use the desktop/client setup from `docs/mcp/kiro.md`.

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

If your Kiro CLI build uses config files, common locations are:

- Windows: `%APPDATA%\\Kiro\\mcp.json`
- macOS: `~/Library/Application Support/Kiro/mcp.json`
- Linux: `~/.config/Kiro/mcp.json`

Paths can vary by release channel. Use your CLI help output or in-app settings if these are not present.

## 4) Quick Sanity Check

After configuration reload, run a Jira prompt such as:

- `List boards in project DEV`
- `Get sprint issues for sprint 123`

