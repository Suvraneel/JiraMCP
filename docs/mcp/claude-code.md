# Claude Code (CLI) MCP Setup

This guide is for the CLI app (`Claude Code`), not Claude Desktop.

## 1) Verify CLI Availability

```bash
claude --help
```

If this command is not found, install Claude Code first.

## 2) Choose a Config Method

Claude Code builds may support either:

- MCP setup via CLI commands, or
- MCP setup via a JSON config file.

Use whichever your installed version exposes.

## 3) MCP Server Definition

Use this server definition in either flow:

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

## 4) File-Based Config (Common OS Locations)

If your Claude Code release uses file-based MCP config, these are common locations:

- Windows: `%APPDATA%\\Claude\\mcp.json` or `%APPDATA%\\Claude Code\\mcp.json`
- macOS: `~/Library/Application Support/Claude/mcp.json`
- Linux: `~/.config/Claude/mcp.json`

Location names can vary by release. If these paths are not used in your install, use CLI-based setup or check `claude --help` for config commands.

## 5) Quick Sanity Check

After configuring, restart Claude Code and run a Jira prompt such as:

- `Get the details of DEV-5`
- `Search my in-progress issues`

