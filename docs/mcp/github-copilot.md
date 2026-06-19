# GitHub Copilot MCP Setup

This guide covers both VS Code and JetBrains GitHub Copilot integrations.

## Prerequisites

- Build the server first so `dist/server.js` exists.
- Use absolute paths for `dist/server.js` whenever possible.

## VS Code (workspace)

Create or update `.vscode/mcp.json` in your project:

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

## JetBrains GitHub Copilot (global)

Use your OS-specific `mcp.json` path:

- Windows: `%LOCALAPPDATA%\github-copilot\intellij\mcp.json`
- macOS: `~/Library/Application Support/github-copilot/intellij/mcp.json`
- Linux: `~/.config/github-copilot/intellij/mcp.json`

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

You can also configure this from JetBrains UI via:
`Settings -> Tools -> AI Assistant -> Model Context Protocol (MCP)`

